import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import diff from 'fast-diff';
import config from '../config.js';

const notion = new Client({ auth: config.notion.apiKey });
const n2m = new NotionToMarkdown({ notionClient: notion });

/**
 * Show differences between local and Notion content
 */
export async function showDiff() {
  console.log(`🔍 Comparing local files with Notion database\n`);

  // Get Notion pages
  const notionPages = await getNotionPages();
  console.log(`📖 Notion: ${notionPages.length} pages`);

  // Get local files
  const localFiles = await getLocalFiles();
  console.log(`📂 Local: ${localFiles.length} files\n`);

  // Create maps for comparison
  const notionMap = new Map(notionPages.map(p => [p.id, p]));
  const localMap = new Map();

  for (const file of localFiles) {
    const content = await fs.readFile(file.path, 'utf-8');
    const { data } = matter(content);
    if (data.notion_id) {
      localMap.set(data.notion_id, file);
    }
  }

  // Find differences
  const results = {
    onlyNotion: [],
    onlyLocal: [],
    modified: [],
    unchanged: [],
  };

  // Check Notion pages
  for (const [id, page] of notionMap) {
    if (!localMap.has(id)) {
      results.onlyNotion.push(page);
    } else {
      const localFile = localMap.get(id);
      const isModified = await compareContent(page, localFile);
      if (isModified) {
        results.modified.push({ notion: page, local: localFile });
      } else {
        results.unchanged.push({ notion: page, local: localFile });
      }
    }
  }

  // Check local files without Notion ID
  for (const file of localFiles) {
    const content = await fs.readFile(file.path, 'utf-8');
    const { data } = matter(content);
    if (!data.notion_id) {
      results.onlyLocal.push(file);
    }
  }

  // Display results
  displayDiffResults(results);

  return results;
}

/**
 * Get all pages from Notion database
 */
async function getNotionPages() {
  const response = await notion.databases.query({
    database_id: config.notion.databaseId,
  });

  return response.results.map(page => ({
    id: page.id,
    title: extractTitle(page),
    url: page.url,
    lastEdited: page.last_edited_time,
    raw: page,
  }));
}

/**
 * Get all local markdown files
 */
async function getLocalFiles() {
  const files = await fs.readdir(config.paths.syncDir);
  const markdownFiles = files.filter(f => f.endsWith('.md'));

  return markdownFiles.map(file => ({
    name: file,
    path: path.join(config.paths.syncDir, file),
  }));
}

/**
 * Compare content between Notion page and local file
 */
async function compareContent(notionPage, localFile) {
  try {
    // Get local content
    const localContent = await fs.readFile(localFile.path, 'utf-8');
    const { data: frontmatter, content: localMarkdown } = matter(localContent);

    // Check timestamps first
    const notionLastEdited = new Date(notionPage.lastEdited);
    const localLastSynced = frontmatter.last_synced ? new Date(frontmatter.last_synced) : new Date(0);

    if (notionLastEdited > localLastSynced) {
      return true; // Modified in Notion
    }

    // Check file modification time
    const stats = await fs.stat(localFile.path);
    const localLastModified = stats.mtime;

    if (localLastModified > localLastSynced) {
      return true; // Modified locally
    }

    return false; // Unchanged
  } catch (error) {
    console.error(`Error comparing ${localFile.name}:`, error.message);
    return true; // Assume modified on error
  }
}

/**
 * Display diff results in a readable format
 */
function displayDiffResults(results) {
  console.log('═'.repeat(80));
  console.log('📊 SYNC STATUS REPORT');
  console.log('═'.repeat(80));

  // Only in Notion
  if (results.onlyNotion.length > 0) {
    console.log(`\n📥 ONLY IN NOTION (${results.onlyNotion.length} pages):`);
    console.log('   These pages exist in Notion but not locally. Run "pull" to download.\n');
    results.onlyNotion.forEach(page => {
      console.log(`   📄 ${page.title}`);
      console.log(`      ID: ${page.id}`);
      console.log(`      Last edited: ${page.lastEdited}\n`);
    });
  }

  // Only local
  if (results.onlyLocal.length > 0) {
    console.log(`\n📤 ONLY LOCAL (${results.onlyLocal.length} files):`);
    console.log('   These files exist locally but not in Notion. Run "push" to upload.\n');
    results.onlyLocal.forEach(file => {
      console.log(`   📄 ${file.name}`);
      console.log(`      Path: ${file.path}\n`);
    });
  }

  // Modified
  if (results.modified.length > 0) {
    console.log(`\n🔄 MODIFIED (${results.modified.length} items):`);
    console.log('   These items have been modified since last sync.\n');
    results.modified.forEach(({ notion, local }) => {
      console.log(`   📄 ${notion.title} / ${local.name}`);
      console.log(`      Notion last edited: ${notion.lastEdited}`);
      console.log(`      Use "pull" to get Notion changes or "push --force" to overwrite\n`);
    });
  }

  // Unchanged
  if (results.unchanged.length > 0) {
    console.log(`\n✅ IN SYNC (${results.unchanged.length} items):`);
    console.log('   These items are synchronized.\n');
  }

  // Summary
  console.log('═'.repeat(80));
  console.log('SUMMARY:');
  console.log(`  📥 Pull needed: ${results.onlyNotion.length}`);
  console.log(`  📤 Push needed: ${results.onlyLocal.length}`);
  console.log(`  🔄 Conflicts: ${results.modified.length}`);
  console.log(`  ✅ In sync: ${results.unchanged.length}`);
  console.log('═'.repeat(80));
}

/**
 * Extract title from Notion page
 */
function extractTitle(page) {
  const titleProp = Object.values(page.properties).find(
    (prop) => prop.type === 'title'
  );

  if (titleProp && titleProp.title.length > 0) {
    return titleProp.title[0].plain_text;
  }

  return 'Untitled';
}

export default showDiff;
