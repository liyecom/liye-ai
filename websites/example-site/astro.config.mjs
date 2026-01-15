// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import path from 'path';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Load environment variables
const env = loadEnv(import.meta.env?.MODE ?? 'development', process.cwd(), '');

// Validate themes repo path
const themesRepoPath = env.THEMES_REPO_PATH;
if (!themesRepoPath) {
  console.warn('Warning: THEMES_REPO_PATH not set in .env - copy .env.example to .env');
}

// https://astro.build/config
// Example Site - Platform smoke test template
export default defineConfig({
  site: 'https://example.local',

  devToolbar: {
    enabled: false
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // @themes alias for cross-repo theme imports
        // Usage: @import "@themes/example-site/theme.css"
        '@themes': themesRepoPath ? path.resolve(themesRepoPath, 'sites') : ''
      }
    }
  },

  integrations: [sitemap()]
});