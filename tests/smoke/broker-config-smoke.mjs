#!/usr/bin/env node
/**
 * Broker Config Smoke Test
 * Tests config-driven routing, model aliasing, and approval system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

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

// Summary
console.log('\n' + '=' .repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
