/**
 * NLP Intent Recognition Smoke Tests
 *
 * Validates the natural language intent recognition module
 *
 * Run: node tests/smoke/nlp-intent-smoke.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '../..');

// Dynamic import for CommonJS module
const intentModule = await import(join(repoRoot, 'src/nlp/intent.js'));
const { recognizeIntent, generateSlug, getProject } = intentModule.default || intentModule;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  }
}

console.log('\n🧪 NLP Intent Recognition Smoke Tests\n');

// ============================================================================
// Amazon Domain Detection
// ============================================================================
console.log('📦 Amazon Domain Detection');

test('detects ASIN pattern B08SVXGTRT', () => {
  const intent = recognizeIntent('分析ASIN：B08SVXGTRT');
  assert.strictEqual(intent.domain, 'amazon');
  assert.strictEqual(intent.entities.asin, 'B08SVXGTRT');
});

test('detects ASIN pattern B0CQ123ABC', () => {
  const intent = recognizeIntent('分析产品 B0CQ123ABC 的竞争对手');
  assert.strictEqual(intent.domain, 'amazon');
  assert.strictEqual(intent.entities.asin, 'B0CQ123ABC');
});

test('detects Amazon keyword in Chinese', () => {
  const intent = recognizeIntent('亚马逊关键词分析');
  assert.strictEqual(intent.domain, 'amazon');
});

test('detects Amazon keyword in English', () => {
  const intent = recognizeIntent('analyze amazon listing');
  assert.strictEqual(intent.domain, 'amazon');
});

test('detects PPC keyword', () => {
  const intent = recognizeIntent('优化PPC广告');
  assert.strictEqual(intent.domain, 'amazon');
});

test('detects 跨境 keyword', () => {
  const intent = recognizeIntent('跨境电商运营');
  assert.strictEqual(intent.domain, 'amazon');
});

// ============================================================================
// Code Domain Detection
// ============================================================================
console.log('\n💻 Code Domain Detection');

test('detects 代码 keyword', () => {
  const intent = recognizeIntent('分析这段代码的性能问题');
  assert.strictEqual(intent.domain, 'code');
  assert.strictEqual(intent.broker, 'claude');
});

test('detects refactor keyword', () => {
  const intent = recognizeIntent('refactor this function');
  assert.strictEqual(intent.domain, 'code');
});

test('detects .js file extension', () => {
  const intent = recognizeIntent('review index.js');
  assert.strictEqual(intent.domain, 'code');
});

// ============================================================================
// Investment Domain Detection
// ============================================================================
console.log('\n💰 Investment Domain Detection');

test('detects 财报 keyword', () => {
  const intent = recognizeIntent('分析Google公司的财报');
  assert.strictEqual(intent.domain, 'investment');
});

test('detects 股票 keyword', () => {
  const intent = recognizeIntent('股票投资分析');
  assert.strictEqual(intent.domain, 'investment');
});

test('detects 公司分析 pattern', () => {
  const intent = recognizeIntent('分析苹果公司');
  assert.strictEqual(intent.domain, 'investment');
});

// ============================================================================
// Medical Domain Detection
// ============================================================================
console.log('\n🏥 Medical Domain Detection');

test('detects 医疗 keyword', () => {
  const intent = recognizeIntent('医疗研究分析');
  assert.strictEqual(intent.domain, 'medical');
});

test('detects 治疗 keyword', () => {
  const intent = recognizeIntent('治疗方案分析');
  assert.strictEqual(intent.domain, 'medical');
});

test('detects 药物 keyword', () => {
  const intent = recognizeIntent('药物副作用研究');
  assert.strictEqual(intent.domain, 'medical');
});

// ============================================================================
// Action Detection
// ============================================================================
console.log('\n🎯 Action Detection');

test('detects 分析 action', () => {
  const intent = recognizeIntent('分析这个问题');
  assert.strictEqual(intent.action, 'analyze');
});

test('detects 搜索 action', () => {
  const intent = recognizeIntent('搜索亚马逊关键词');
  assert.strictEqual(intent.action, 'search');
  assert.strictEqual(intent.broker, 'antigravity');
});

test('detects 优化 action', () => {
  const intent = recognizeIntent('优化这个listing');
  assert.strictEqual(intent.action, 'optimize');
});

test('detects 研究 action', () => {
  const intent = recognizeIntent('研究竞争对手');
  assert.strictEqual(intent.action, 'research');
});

// ============================================================================
// Broker Routing
// ============================================================================
console.log('\n🚀 Broker Routing');

test('routes code tasks to claude', () => {
  const intent = recognizeIntent('优化代码性能');
  assert.strictEqual(intent.broker, 'claude');
});

test('routes search tasks to antigravity', () => {
  const intent = recognizeIntent('搜索产品信息');
  assert.strictEqual(intent.broker, 'antigravity');
});

test('routes general questions to codex', () => {
  const intent = recognizeIntent('什么是机器学习');
  assert.strictEqual(intent.broker, 'codex');
});

// ============================================================================
// Slug Generation
// ============================================================================
console.log('\n🔗 Slug Generation');

test('generates slug from ASIN', () => {
  const intent = recognizeIntent('分析ASIN：B08SVXGTRT');
  const slug = generateSlug(intent);
  assert.ok(slug.includes('b08svxgtrt'));
});

test('generates slug from Chinese text', () => {
  const intent = recognizeIntent('分析关键词趋势');
  const slug = generateSlug(intent);
  assert.ok(slug.length > 0);
  assert.ok(slug.length <= 40);
});

// ============================================================================
// Project Assignment
// ============================================================================
console.log('\n📁 Project Assignment');

test('assigns amazon-growth project for Amazon domain', () => {
  const intent = recognizeIntent('分析ASIN：B08SVXGTRT');
  const project = getProject(intent);
  assert.strictEqual(project, 'amazon-growth');
});

test('assigns investment-os project for Investment domain', () => {
  const intent = recognizeIntent('分析Google财报');
  const project = getProject(intent);
  assert.strictEqual(project, 'investment-os');
});

test('assigns medical-research project for Medical domain', () => {
  const intent = recognizeIntent('医疗研究分析');
  const project = getProject(intent);
  assert.strictEqual(project, 'medical-research');
});

test('assigns code-task project for Code domain', () => {
  const intent = recognizeIntent('优化代码性能');
  const project = getProject(intent);
  assert.strictEqual(project, 'code-task');
});

test('assigns quick-ask project for General domain', () => {
  const intent = recognizeIntent('什么是人工智能');
  const project = getProject(intent);
  assert.strictEqual(project, 'quick-ask');
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n─────────────────────────────────────');
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('─────────────────────────────────────\n');

process.exit(failed > 0 ? 1 : 0);
