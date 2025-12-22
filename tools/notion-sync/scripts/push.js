import { Client } from '@notionhq/client';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import config from '../config.js';

const notion = new Client({ auth: config.notion.apiKey });

/**
 * Push local markdown files to Notion database
 */
export async function pushToNotion(options = {}) {
  const { force = false } = options;

  console.log(`📂 Reading markdown files from: ${config.paths.syncDir}`);

  // Read all markdown files
  const files = await fs.readdir(config.paths.syncDir);
  const markdownFiles = files.filter(f => f.endsWith('.md'));

  console.log(`📄 Found ${markdownFiles.length} markdown files`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of markdownFiles) {
    try {
      const filePath = path.join(config.paths.syncDir, file);
      const result = await pushFile(filePath, force);

      if (result === 'skipped') {
        skipCount++;
      } else {
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing file ${file}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Push Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

/**
 * Push a single markdown file to Notion
 */
async function pushFile(filePath, force) {
  const fileName = path.basename(filePath);
  console.log(`  📄 Processing: ${fileName}`);

  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');
  const { data: frontmatter, content: markdown } = matter(content);

  // Get file stats
  const stats = await fs.stat(filePath);
  const lastModified = stats.mtime.toISOString();

  // Check if page already exists in Notion
  const notionId = frontmatter.notion_id;

  if (notionId) {
    // Update existing page
    return await updateNotionPage(notionId, frontmatter, markdown, lastModified, force);
  } else {
    // Create new page
    return await createNotionPage(frontmatter, markdown, fileName);
  }
}

/**
 * Create a new page in Notion
 */
async function createNotionPage(frontmatter, markdown, fileName) {
  console.log(`    ➕ Creating new page in Notion`);

  // Extract title from frontmatter or filename
  const title = frontmatter.title ||
                frontmatter.name ||
                path.basename(fileName, '.md');

  // Convert markdown to Notion blocks (simplified version)
  const blocks = markdownToBlocks(markdown);

  // Create page
  const response = await notion.pages.create({
    parent: {
      database_id: config.notion.databaseId,
    },
    properties: {
      title: {
        title: [
          {
            text: {
              content: title,
            },
          },
        ],
      },
      // Add other properties from frontmatter
      ...buildNotionProperties(frontmatter),
    },
    children: blocks,
  });

  console.log(`    ✅ Created: ${response.url}`);
  console.log(`    💡 Add this to file frontmatter: notion_id: ${response.id}`);

  return 'created';
}

/**
 * Update an existing page in Notion
 */
async function updateNotionPage(notionId, frontmatter, markdown, lastModified, force) {
  // Check if we should update
  if (!force && frontmatter.last_synced) {
    const lastSynced = new Date(frontmatter.last_synced);
    const localModified = new Date(lastModified);

    if (localModified <= lastSynced) {
      console.log(`    ⏭️  Skipped (no changes since last sync)`);
      return 'skipped';
    }
  }

  console.log(`    🔄 Updating existing page in Notion`);

  // Convert markdown to Notion blocks
  const blocks = markdownToBlocks(markdown);

  // Update page properties
  await notion.pages.update({
    page_id: notionId,
    properties: buildNotionProperties(frontmatter),
  });

  // Clear existing content
  const existingBlocks = await notion.blocks.children.list({
    block_id: notionId,
  });

  for (const block of existingBlocks.results) {
    await notion.blocks.delete({ block_id: block.id });
  }

  // Add new content
  if (blocks.length > 0) {
    await notion.blocks.children.append({
      block_id: notionId,
      children: blocks,
    });
  }

  console.log(`    ✅ Updated successfully`);
  return 'updated';
}

/**
 * Build Notion properties object from frontmatter
 */
function buildNotionProperties(frontmatter) {
  const properties = {};

  // Map common frontmatter fields to Notion properties
  if (frontmatter.tags) {
    properties.Tags = {
      multi_select: Array.isArray(frontmatter.tags)
        ? frontmatter.tags.map(tag => ({ name: tag }))
        : [{ name: frontmatter.tags }],
    };
  }

  if (frontmatter.status) {
    properties.Status = {
      select: { name: frontmatter.status },
    };
  }

  if (frontmatter.date) {
    properties.Date = {
      date: { start: frontmatter.date },
    };
  }

  return properties;
}

/**
 * Convert markdown to Notion blocks (simplified)
 * Note: This is a basic implementation. For full markdown support,
 * consider using a library like markdown-to-notion
 */
function markdownToBlocks(markdown) {
  const blocks = [];
  const lines = markdown.trim().split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // Heading
    if (line.startsWith('# ')) {
      blocks.push({
        heading_1: {
          rich_text: [{ text: { content: line.substring(2) } }],
        },
      });
    } else if (line.startsWith('## ')) {
      blocks.push({
        heading_2: {
          rich_text: [{ text: { content: line.substring(3) } }],
        },
      });
    } else if (line.startsWith('### ')) {
      blocks.push({
        heading_3: {
          rich_text: [{ text: { content: line.substring(4) } }],
        },
      });
    }
    // Bullet list
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        bulleted_list_item: {
          rich_text: [{ text: { content: line.substring(2) } }],
        },
      });
    }
    // Numbered list
    else if (line.match(/^\d+\. /)) {
      blocks.push({
        numbered_list_item: {
          rich_text: [{ text: { content: line.replace(/^\d+\. /, '') } }],
        },
      });
    }
    // Paragraph
    else {
      blocks.push({
        paragraph: {
          rich_text: [{ text: { content: line } }],
        },
      });
    }
  }

  // Notion API has a limit of 100 blocks per request
  return blocks.slice(0, 100);
}

export default pushToNotion;
