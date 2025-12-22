# LiYe OS Notion Sync

Bidirectional synchronization tool between local Markdown files and Notion databases.

## Features

- 📥 **Pull**: Download Notion pages as Markdown files with frontmatter
- 📤 **Push**: Upload local Markdown files to Notion database
- 🔍 **Diff**: Compare local and Notion content to identify changes
- 🔄 **Sync**: Bidirectional sync with conflict detection (planned)

## Installation

```bash
cd tools/notion-sync
npm install
```

## Configuration

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Notion credentials:
```env
NOTION_API_KEY=your_notion_integration_token_here
NOTION_DATABASE_ID=your_database_id_here
LOCAL_SYNC_DIR=../Documents/Obsidian Vault
```

### Getting Notion Credentials

#### 1. Create a Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "+ New integration"
3. Give it a name (e.g., "LiYe OS Sync")
4. Select the workspace you want to sync
5. Copy the **Internal Integration Token** (this is your `NOTION_API_KEY`)

#### 2. Get Database ID

1. Open your Notion database in a browser
2. The URL will look like: `https://www.notion.so/workspace/{database_id}?v=...`
3. Copy the `database_id` part (32 characters, no hyphens)

#### 3. Share Database with Integration

1. Open your Notion database
2. Click "..." menu in the top right
3. Click "Add connections"
4. Select your integration name
5. Click "Confirm"

## Usage

### Check Differences

See what needs to be synced:

```bash
npm run diff
```

### Pull from Notion

Download all pages from Notion to local Markdown files:

```bash
npm run pull
```

Force overwrite local files:

```bash
npm run pull -- --force
```

### Push to Notion

Upload local Markdown files to Notion:

```bash
npm run push
```

Force overwrite Notion pages:

```bash
npm run push -- --force
```

### Using CLI Commands

You can also use the CLI directly:

```bash
node index.js pull
node index.js push
node index.js diff
node index.js sync --dry-run
```

## File Structure

```
tools/notion-sync/
├── index.js              # Main CLI entry point
├── config.js             # Configuration loader
├── package.json          # Node.js dependencies
├── .env                  # Environment variables (create from .env.example)
├── .env.example          # Example environment config
├── README.md             # This file
├── .cache/               # Cache directory (auto-created)
│   └── sync-state.json   # Sync state tracker
├── lib/                  # Shared utilities (future)
└── scripts/
    ├── pull.js           # Pull from Notion
    ├── push.js           # Push to Notion
    └── diff.js           # Compare changes
```

## Markdown Format

### Frontmatter

Synced files include YAML frontmatter with metadata:

```yaml
---
notion_id: abc123def456
notion_url: https://www.notion.so/...
last_synced: 2024-01-20T10:30:00Z
last_edited_notion: 2024-01-20T09:15:00Z
title: My Page Title
tags:
  - tag1
  - tag2
status: In Progress
---

# Content starts here

Your markdown content...
```

### Property Mapping

Notion properties are automatically mapped to frontmatter:

| Notion Property | Frontmatter Field | Type |
|----------------|-------------------|------|
| Title | `title` | string |
| Tags | `tags` | array |
| Status | `status` | string |
| Date | `date` | ISO 8601 |
| URL | `url` | string |
| Number | varies | number |
| Checkbox | varies | boolean |

## Sync Workflow

### Initial Setup

1. Run `npm run pull` to download existing Notion pages
2. Each file will have a `notion_id` in frontmatter
3. Edit files locally as needed

### Regular Sync

1. Run `npm run diff` to see what changed
2. Run `npm run pull` to get Notion updates
3. Run `npm run push` to upload local changes

### Conflict Resolution

If both local and Notion versions have changed:

- Use `npm run pull --force` to prefer Notion version
- Use `npm run push --force` to prefer local version
- Manually merge by comparing the files

## Limitations

### Current Version

- Basic markdown conversion (headings, lists, paragraphs)
- No support for:
  - Notion databases within pages
  - Advanced block types (callouts, toggles, etc.)
  - Embedded files/images
  - Code blocks with syntax highlighting
  - Tables

### Planned Features

- [ ] Full bidirectional sync with conflict resolution
- [ ] Support for advanced Notion blocks
- [ ] Image/file attachment sync
- [ ] Incremental sync (only changed pages)
- [ ] Watch mode for auto-sync
- [ ] Multiple database support
- [ ] Custom property mappings

## Troubleshooting

### "Configuration errors: NOTION_API_KEY is not set"

Make sure you've created a `.env` file and added your Notion API key.

### "Could not find database"

1. Check that `NOTION_DATABASE_ID` is correct
2. Ensure you've shared the database with your integration
3. Verify the integration has access to your workspace

### "Permission denied"

The integration needs permission to access your database. Go to the database and add the integration via "Add connections".

### Files not syncing

Check that:
- The `LOCAL_SYNC_DIR` path exists and is correct
- You have write permissions for the directory
- File names don't contain invalid characters

## Contributing

This is part of the LiYe OS project. For issues or suggestions, please create an issue in the main repository.

## License

MIT
