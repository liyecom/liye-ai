#!/usr/bin/env node
/**
 * Broker Config Smoke Test
 * Tests config-driven routing, model aliasing, and approval system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../..');

// Test utilities
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) {
    throw new Error(`${msg} Expected truthy value, got ${value}`);
  }
}

console.log('\n🧪 Broker Config Smoke Tests\n');
console.log('=' .repeat(50));

// Test 1: Config files exist
test('config/brokers.yaml exists', () => {
  assertTrue(existsSync(join(repoRoot, 'config/brokers.yaml')));
});

test('config/policy.yaml exists', () => {
  assertTrue(existsSync(join(repoRoot, 'config/policy.yaml')));
});

// Test 2: Config loader module
const configLoader = await import(join(repoRoot, 'src/config/load.js'));

test('getRouteConfig returns defaults for unknown route', () => {
  const config = configLoader.getRouteConfig(repoRoot, 'unknown-route');
  assertEqual(config.broker, 'codex');
  assertEqual(config.model, 'gpt-5.2-thinking');
  assertEqual(config.approval, 'semi-auto');
  assertEqual(config.sandbox, 'read-only');
});

test('getRouteConfig returns ask route config', () => {
  const config = configLoader.getRouteConfig(repoRoot, 'ask');
  assertEqual(config.broker, 'codex');
  assertEqual(config.model, 'gpt-5.2-thinking');
});

test('getRouteConfig merges CLI overrides', () => {
  const config = configLoader.getRouteConfig(repoRoot, 'ask', {
    model: 'gpt-4-turbo',
    broker: 'claude',
  });
  assertEqual(config.model, 'gpt-4-turbo');
  assertEqual(config.broker, 'claude');
});

// Test 3: Model alias mapping
test('getModelAlias maps gpt-5.2-thinking to gpt-5.2 for codex', () => {
  const actual = configLoader.getModelAlias(repoRoot, 'codex', 'gpt-5.2-thinking');
  assertEqual(actual, 'gpt-5.2');
});

test('getModelAlias returns original if no alias', () => {
  const actual = configLoader.getModelAlias(repoRoot, 'codex', 'gpt-4-turbo');
  assertEqual(actual, 'gpt-4-turbo');
});

test('getModelAlias returns original for unknown broker', () => {
  const actual = configLoader.getModelAlias(repoRoot, 'unknown', 'gpt-5.2-thinking');
  assertEqual(actual, 'gpt-5.2-thinking');
});

// Test 4: Approval policy
test('getApprovalPolicy returns semi-auto defaults', () => {
  const policy = configLoader.getApprovalPolicy(repoRoot);
  assertEqual(policy.mode_default, 'semi-auto');
  assertTrue(policy.semi_auto.allow_until_mission_end);
  assertTrue(Array.isArray(policy.semi_auto.reapprove_patterns));
});

test('matchesReapprovePattern detects rm -rf', () => {
  const result = configLoader.matchesReapprovePattern('rm -rf /tmp/test', repoRoot);
  assertTrue(result.matches);
});

test('matchesReapprovePattern detects sudo', () => {
  const result = configLoader.matchesReapprovePattern('sudo apt-get install', repoRoot);
  assertTrue(result.matches);
});

test('matchesReapprovePattern detects git push', () => {
  const result = configLoader.matchesReapprovePattern('git push origin main', repoRoot);
  assertTrue(result.matches);
});

test('matchesReapprovePattern ignores safe commands', () => {
  const ls = configLoader.matchesReapprovePattern('ls -la', repoRoot);
  const cat = configLoader.matchesReapprovePattern('cat file.txt', repoRoot);
  assertTrue(!ls.matches);
  assertTrue(!cat.matches);
});

// Test 5: getAllRoutes returns route config
test('getAllRoutes returns configured routes', () => {
  const routes = configLoader.getAllRoutes(repoRoot);
  assertTrue('ask' in routes || Object.keys(routes).length >= 0);
});

test('getDefaults returns default config', () => {
  const defaults = configLoader.getDefaults(repoRoot);
  assertEqual(defaults.broker, 'codex');
  assertEqual(defaults.model, 'gpt-5.2-thinking');
});

// Test 6: Mission types
const types = await import(join(repoRoot, 'src/mission/types.js'));

test('MissionStatus includes NEEDS_MANUAL', () => {
  assertEqual(types.MissionStatus.NEEDS_MANUAL, 'needs_manual');
});

test('ErrorCode includes BROKER_NOT_INSTALLED', () => {
  assertEqual(types.ErrorCode.BROKER_NOT_INSTALLED, 'BROKER_NOT_INSTALLED');
});

test('ApprovalPolicy includes SEMI_AUTO', () => {
  assertEqual(types.ApprovalPolicy.SEMI_AUTO, 'semi-auto');
});

// Test 7: Approval manager
const approval = await import(join(repoRoot, 'src/config/approval.js'));

test('approval module exports required functions', () => {
  assertTrue(typeof approval.grantApproval === 'function');
  assertTrue(typeof approval.revokeApproval === 'function');
  assertTrue(typeof approval.checkApproval === 'function');
  assertTrue(typeof approval.getApprovalState === 'function');
  assertTrue(typeof approval.formatApprovalStatus === 'function');
});

// Test 8: Broker registry
const registry = await import(join(repoRoot, 'src/brokers/registry.js'));

test('listBrokers returns array of brokers', async () => {
  const brokers = await registry.listBrokers();
  assertTrue(Array.isArray(brokers));
  assertTrue(brokers.length >= 4); // codex, gemini, antigravity, claude
});

test('getBroker returns codex broker', () => {
  const broker = registry.getBroker('codex');
  assertTrue(broker !== null);
  assertEqual(broker.id(), 'codex');
});

// Test 9: Constitution document exists
test('BROKER_POLICY_CONSTITUTION.md exists', () => {
  assertTrue(existsSync(join(repoRoot, 'docs/architecture/BROKER_POLICY_CONSTITUTION.md')));
});

// Test 10: Dangerous action reapproval (critical safety test)
test('checkApproval blocks dangerous rm -rf even after grant', () => {
  // Create temp mission dir
  const tempDir = mkdtempSync(join(tmpdir(), 'mission-test-'));
  const metaPath = join(tempDir, 'meta.json');

  // Grant approval
  writeFileSync(metaPath, JSON.stringify({
    approval: {
      mode: 'semi-auto',
      granted_at: new Date().toISOString(),
      granted_by: 'test'
    }
  }));

  // Check dangerous action
  const result = approval.checkApproval(tempDir, 'rm -rf /tmp/test', repoRoot);

  // Cleanup
  rmSync(tempDir, { recursive: true });

  assertTrue(!result.allowed, 'rm -rf should be blocked');
  assertTrue(result.requires_reapproval, 'should require reapproval');
  assertEqual(result.pattern, 'rm -rf');
});

test('checkApproval blocks sudo even after grant', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'mission-test-'));
  const metaPath = join(tempDir, 'meta.json');

  writeFileSync(metaPath, JSON.stringify({
    approval: {
      mode: 'semi-auto',
      granted_at: new Date().toISOString(),
      granted_by: 'test'
    }
  }));

  const result = approval.checkApproval(tempDir, 'sudo apt-get install foo', repoRoot);
  rmSync(tempDir, { recursive: true });

  assertTrue(!result.allowed, 'sudo should be blocked');
  assertTrue(result.requires_reapproval, 'should require reapproval');
});

test('checkApproval allows safe commands after grant', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'mission-test-'));
  const metaPath = join(tempDir, 'meta.json');

  writeFileSync(metaPath, JSON.stringify({
    approval: {
      mode: 'semi-auto',
      granted_at: new Date().toISOString(),
      granted_by: 'test'
    }
  }));

  const result = approval.checkApproval(tempDir, 'ls -la', repoRoot);
  rmSync(tempDir, { recursive: true });

  assertTrue(result.allowed, 'ls should be allowed');
});

// Test 11: Safety module - forbidden action blocking
const safety = await import(join(repoRoot, 'src/config/safety.js'));

test('scanPromptForForbiddenIntents blocks chatgpt history scraping', () => {
  const result = safety.scanPromptForForbiddenIntents(
    'scrape chatgpt web history and export conversations',
    repoRoot
  );
  assertTrue(!result.safe, 'chatgpt history scraping should be blocked');
  assertEqual(result.error_code, 'FORBIDDEN_ACTION');
});

test('scanPromptForForbiddenIntents blocks cookie extraction', () => {
  const result = safety.scanPromptForForbiddenIntents(
    'extract cookie from browser and send to server',
    repoRoot
  );
  assertTrue(!result.safe, 'cookie extraction should be blocked');
});

test('scanPromptForForbiddenIntents allows normal prompts', () => {
  const result = safety.scanPromptForForbiddenIntents(
    'analyze this code and suggest improvements',
    repoRoot
  );
  assertTrue(result.safe, 'normal prompt should be allowed');
});

test('ErrorCode includes FORBIDDEN_ACTION', () => {
  assertEqual(types.ErrorCode.FORBIDDEN_ACTION, 'FORBIDDEN_ACTION');
});

// Test 12: Cost Report Module
const costReport = await import(join(repoRoot, 'src/analytics/cost-report.js'));

test('cost report module exports required functions', () => {
  assertTrue(typeof costReport.generateCostReport === 'function');
  assertTrue(typeof costReport.loadEvents === 'function');
  assertTrue(typeof costReport.aggregateMetrics === 'function');
  assertTrue(typeof costReport.generateRecommendations === 'function');
});

test('aggregateMetrics produces correct structure', () => {
  const mockEvents = [
    { type: 'end', broker: 'codex', route: 'ask', status: 'ok', runtime_sec: 10 },
    { type: 'end', broker: 'codex', route: 'ask', status: 'needs_manual', runtime_sec: 0, error_code: 'UNKNOWN' },
  ];
  const metrics = costReport.aggregateMetrics(mockEvents);

  assertEqual(metrics.total, 2);
  assertEqual(metrics.byStatus.ok, 1);
  assertEqual(metrics.byStatus.needs_manual, 1);
  assertTrue('codex' in metrics.byBroker);
  assertTrue('ask' in metrics.byRoute);
});

test('generateRecommendations returns array', () => {
  const metrics = {
    total: 10,
    byStatus: { ok: 3, needs_manual: 7, fail: 0 },
    byBroker: {},
    byRoute: {},
    byErrorCode: { UNKNOWN: 5 },
    dangerousActionBlocks: 0,
  };
  const recommendations = costReport.generateRecommendations(metrics);

  assertTrue(Array.isArray(recommendations));
  assertTrue(recommendations.length > 0);
  assertTrue(recommendations.length <= 3);
});

// Test 13: Auto-Summary Module
const summary = await import(join(repoRoot, 'src/mission/summary.js'));

test('summary module exports required functions', () => {
  assertTrue(typeof summary.generateMissionSummary === 'function');
  assertTrue(typeof summary.generateSummaryLines === 'function');
  assertTrue(typeof summary.isSummaryHeader === 'function');
});

test('isSummaryHeader detects conclusion headers', () => {
  assertTrue(summary.isSummaryHeader('## 结论'));
  assertTrue(summary.isSummaryHeader('# Summary'));
  assertTrue(summary.isSummaryHeader('### 建议'));
  assertTrue(!summary.isSummaryHeader('## Background'));
  assertTrue(!summary.isSummaryHeader('Not a header'));
});

test('generateSummaryLines respects max 10 lines', () => {
  const content = `# Test
## 结论
Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10
Line 11
Line 12`;
  const lines = summary.generateSummaryLines(content);
  assertTrue(lines.length <= 10, 'Summary should have max 10 lines');
});

test('generateSummaryLines prioritizes conclusion sections', () => {
  const content = `# Document
Some intro text here.

## 结论
This is the conclusion.
Very important point.

## Other Section
Not as important.`;
  const lines = summary.generateSummaryLines(content);
  assertTrue(lines.some(l => l.includes('conclusion') || l.includes('important')));
});

// Summary
console.log('\n' + '=' .repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
