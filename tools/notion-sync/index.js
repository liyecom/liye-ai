#!/usr/bin/env node

import { Command } from 'commander';
import config from './config.js';
import { pullFromNotion } from './scripts/pull.js';
import { pushToNotion } from './scripts/push.js';
import { showDiff } from './scripts/diff.js';

const program = new Command();

program
  .name('notion-sync')
  .description('LiYe OS Notion Sync Tool - Bidirectional sync between local markdown and Notion')
  .version('1.0.0');

program
  .command('pull')
  .description('Pull content from Notion to local markdown files')
  .option('-f, --force', 'Force overwrite local files')
  .action(async (options) => {
    try {
      config.validate();
      console.log('📥 Pulling from Notion...');
      await pullFromNotion(options);
      console.log('✅ Pull completed successfully');
    } catch (error) {
      console.error('❌ Pull failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('push')
  .description('Push local markdown files to Notion')
  .option('-f, --force', 'Force overwrite Notion pages')
  .action(async (options) => {
    try {
      config.validate();
      console.log('📤 Pushing to Notion...');
      await pushToNotion(options);
      console.log('✅ Push completed successfully');
    } catch (error) {
      console.error('❌ Push failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('diff')
  .description('Show differences between local and Notion content')
  .action(async () => {
    try {
      config.validate();
      console.log('🔍 Comparing local and Notion content...');
      await showDiff();
    } catch (error) {
      console.error('❌ Diff failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('sync')
  .description('Bidirectional sync with conflict detection')
  .option('--dry-run', 'Show what would be synced without making changes')
  .action(async (options) => {
    try {
      config.validate();
      console.log('🔄 Starting bidirectional sync...');

      if (options.dryRun) {
        console.log('🔍 Dry run mode - no changes will be made');
      }

      // Check for differences
      await showDiff();

      // TODO: Implement full bidirectional sync logic
      console.log('⚠️  Full sync not yet implemented. Use pull/push commands separately.');

    } catch (error) {
      console.error('❌ Sync failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
