import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import config from '../config.js';

const notion = new Client({ auth: config.notion.apiKey });
const n2m = new NotionToMarkdown({ notionClient: notion });

/**
 * Pull content from Notion database to local markdown files
 */
export async function pullFromNotion(options = {}) {
  const { force = false } = options;

  // Ensure cache directory exists
  await fs.mkdir(config.paths.cacheDir, { recursive: true });

  // Query Notion database
  console.log(`📖 Querying Notion database: ${config.notion.databaseId}`);

  const response = await notion.databases.query({
    database_id: config.notion.databaseId,
  });

  console.log(`📄 Found ${response.results.length} pages in Notion`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const page of response.results) {
    try {
      await pullPage(page, force);
      successCount++;
    } catch (error) {
      console.error(`❌ Error processing page ${page.id}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Pull Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Update sync state
  await updateSyncState(response.results);
}

/**
 * Pull a single page from Notion
 */
async function pullPage(page, force) {
  // Extract page properties
  const title = extractTitle(page);
  const pageId = page.id;
  const lastEditedTime = page.last_edited_time;

  console.log(`  📄 Processing: ${title}`);

  // Convert page to markdown
  const mdblocks = await n2m.pageToMarkdown(pageId);
  const mdString = n2m.toMarkdownString(mdblocks);

  // Prepare frontmatter
  const frontmatter = {
    notion_id: pageId,
    notion_url: page.url,
    last_synced: new Date().toISOString(),
    last_edited_notion: lastEditedTime,
  };

  // Add custom properties from Notion
  Object.keys(page.properties).forEach((key) => {
    const prop = page.properties[key];
    frontmatter[key.toLowerCase()] = extractProperty(prop);
  });

  // Create markdown content with frontmatter
  const content = matter.stringify(mdString.parent, frontmatter);

  // Determine file path
  const fileName = sanitizeFileName(title) + '.md';
  const filePath = path.join(config.paths.syncDir, fileName);

  // Check if file exists
  const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

  if (fileExists && !force) {
    // Check if local file is newer
    const localContent = await fs.readFile(filePath, 'utf-8');
    const localData = matter(localContent);

    if (localData.data.last_edited_notion === lastEditedTime) {
      console.log(`    ⏭️  Skipped (no changes)`);
      return;
    }
  }

  // Write file
  await fs.writeFile(filePath, content, 'utf-8');
  console.log(`    ✅ Saved to: ${fileName}`);
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

/**
 * Extract property value from Notion property object
 */
function extractProperty(prop) {
  switch (prop.type) {
    case 'title':
      return prop.title.map(t => t.plain_text).join('');
    case 'rich_text':
      return prop.rich_text.map(t => t.plain_text).join('');
    case 'number':
      return prop.number;
    case 'select':
      return prop.select?.name;
    case 'multi_select':
      return prop.multi_select?.map(s => s.name);
    case 'date':
      return prop.date?.start;
    case 'checkbox':
      return prop.checkbox;
    case 'url':
      return prop.url;
    case 'email':
      return prop.email;
    case 'phone_number':
      return prop.phone_number;
    default:
      return null;
  }
}

/**
 * Sanitize filename for filesystem
 */
function sanitizeFileName(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

/**
 * Update sync state file
 */
async function updateSyncState(pages) {
  const state = {
    last_sync: new Date().toISOString(),
    page_count: pages.length,
    pages: pages.map(p => ({
      id: p.id,
      title: extractTitle(p),
      last_edited: p.last_edited_time,
    })),
  };

  await fs.writeFile(
    config.paths.stateFile,
    JSON.stringify(state, null, 2),
    'utf-8'
  );
}

export default pullFromNotion;
