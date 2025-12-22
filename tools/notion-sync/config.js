import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // Notion API
  notion: {
    apiKey: process.env.NOTION_API_KEY,
    databaseId: process.env.NOTION_DATABASE_ID,
  },

  // Local paths
  paths: {
    root: __dirname,
    syncDir: path.resolve(__dirname, process.env.LOCAL_SYNC_DIR || '../Documents/Obsidian Vault'),
    cacheDir: path.join(__dirname, '.cache'),
    stateFile: path.join(__dirname, '.cache', 'sync-state.json'),
  },

  // Sync settings
  sync: {
    interval: parseInt(process.env.SYNC_INTERVAL_MINUTES || '30', 10),
    autoSync: process.env.AUTO_SYNC_ENABLED === 'true',
    conflictResolution: process.env.CONFLICT_RESOLUTION || 'ask',
  },

  // Validation
  validate() {
    const errors = [];

    if (!this.notion.apiKey) {
      errors.push('NOTION_API_KEY is not set in .env file');
    }

    if (!this.notion.databaseId) {
      errors.push('NOTION_DATABASE_ID is not set in .env file');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }

    return true;
  }
};

export default config;
