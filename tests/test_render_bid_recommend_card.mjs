#!/usr/bin/env node
/**
 * Bid Recommend Card Renderer Tests
 * SSOT: tests/test_render_bid_recommend_card.mjs
 *
 * DoD Verification:
 * ✅ Given fixture recommendation, output card JSON
 * ✅ Assert: has 3 buttons
 * ✅ Assert: run_id in payload
 * ✅ Assert: no secrets (blacklist: access_token|refresh_token|password)
 */

import { renderBidRecommendCard } from '../.claude/scripts/proactive/render_recommendation_card_bid_recommend.mjs';
import { handleCallback, generateHmac, verifyHmac } from '../.claude/scripts/proactive/operator_callback.mjs';
import { strict as assert } from 'assert';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';

// ===============================================================
// Test Fixtures
// ===============================================================

const FIXTURE_RUN_META = {
  run_id: 'age:bid_recommend:test-20260211',
  engine_id: 'age',
  playbook_id: 'bid_recommend',
  inputs_hash: 'sha256:abc123def456',
  policy_id: 'BID_RECOMMEND_ACOS_EXACT_CVRHIGH_ACOSLOW_17ED8F'
};

const FIXTURE_RECOMMENDATION = {
  primary_metric: { name: 'acos', anomaly_direction: 'low' },
  entities: [
    { keyword_text: 'organic mushroom', match_type: 'exact', acos_7d: 0.22, cvr_7d: 0.18, delta_pct: 20 },
    { keyword_text: 'muddy mat dog', match_type: 'exact', acos_7d: 0.19, cvr_7d: 0.21, delta_pct: 15 },
    { keyword_text: 'natural fiber rug', match_type: 'phrase', acos_7d: 0.25, cvr_7d: 0.16, delta_pct: 10 }
  ],
  max_delta_pct: 20,
  cap_pct: 30,
  rollback_plan: {
    type: 'automatic',
    steps: ['Revert bid to original value', 'Wait 48h for stabilization'],
    safe_window_hours: 48
  },
  lookback_days: 7
};

const SECRET_PATTERNS = /access_token|refresh_token|password|secret_key|api_key|private_key/i;

// ===============================================================
// Card Renderer Tests
// ===============================================================

function testCardHasThreeButtons() {
  console.log('Test: Card has exactly 3 buttons...');

  const card = renderBidRecommendCard({
    run_meta: FIXTURE_RUN_META,
    recommendation: FIXTURE_RECOMMENDATION
  });

  // Find action element with buttons
  const actionElement = card.elements.find(el => el.tag === 'action');
  assert.ok(actionElement, 'Card must have an action element');
  assert.ok(Array.isArray(actionElement.actions), 'Action element must have actions array');
  assert.equal(actionElement.actions.length, 3, 'Card must have exactly 3 buttons');

  // Verify button types
  const buttonTexts = actionElement.actions.map(a => a.text?.content);
  assert.ok(buttonTexts.some(t => t.includes('Approve') && t.includes('Applied')), 'Must have Approve & Applied button');
  assert.ok(buttonTexts.some(t => t.includes('Approve') && t.includes('Not Applied')), 'Must have Approve (Not Applied) button');
  assert.ok(buttonTexts.some(t => t.includes('Reject')), 'Must have Reject button');

  console.log('  ✅ Card has 3 buttons: Approve & Applied, Approve (Not Applied), Reject');
}

function testCardHasRunIdInPayload() {
  console.log('Test: run_id present in button payloads...');

  const card = renderBidRecommendCard({
    run_meta: FIXTURE_RUN_META,
    recommendation: FIXTURE_RECOMMENDATION
  });

  const actionElement = card.elements.find(el => el.tag === 'action');

  for (const action of actionElement.actions) {
    const payloadStr = action.value?.payload;
    assert.ok(payloadStr, `Button "${action.text?.content}" must have payload`);

    const payload = JSON.parse(payloadStr);
    assert.equal(payload.run_id, FIXTURE_RUN_META.run_id,
      `Button "${action.text?.content}" payload must contain run_id`);
  }

  console.log(`  ✅ All buttons contain run_id: ${FIXTURE_RUN_META.run_id}`);
}

function testCardNoSecrets() {
  console.log('Test: Card contains no secrets...');

  const card = renderBidRecommendCard({
    run_meta: FIXTURE_RUN_META,
    recommendation: FIXTURE_RECOMMENDATION
  });

  const cardJson = JSON.stringify(card);
  const secretMatch = cardJson.match(SECRET_PATTERNS);

  assert.ok(!secretMatch, `Card must not contain secrets, found: ${secretMatch?.[0]}`);

  console.log('  ✅ No secrets found in card JSON');
}

function testCardStructure() {
  console.log('Test: Card has valid Feishu structure...');

  const card = renderBidRecommendCard({
    run_meta: FIXTURE_RUN_META,
    recommendation: FIXTURE_RECOMMENDATION
  });

  assert.ok(card.config, 'Card must have config');
  assert.ok(card.header, 'Card must have header');
  assert.ok(card.header.title, 'Card must have header.title');
  assert.ok(card.header.template, 'Card must have header.template');
  assert.ok(Array.isArray(card.elements), 'Card must have elements array');

  console.log('  ✅ Card has valid Feishu structure');
}

function testCardEmptyEntities() {
  console.log('Test: Card handles empty entities gracefully...');

  const card = renderBidRecommendCard({
    run_meta: FIXTURE_RUN_META,
    recommendation: { ...FIXTURE_RECOMMENDATION, entities: [] }
  });

  assert.ok(card, 'Card should be generated even with empty entities');
  assert.ok(card.header.title.content.includes('0 keywords'), 'Title should show 0 keywords');

  console.log('  ✅ Card handles empty entities gracefully');
}

// ===============================================================
// Callback Handler Tests
// ===============================================================

function testCallbackHmacVerification() {
  console.log('Test: HMAC verification works correctly...');

  const payload = { run_id: 'test-run', decision: 'approve' };
  const signature = generateHmac(payload);

  assert.ok(verifyHmac(payload, signature), 'Valid signature should verify');
  assert.ok(!verifyHmac(payload, 'invalid_signature'), 'Invalid signature should fail');
  assert.ok(!verifyHmac({ ...payload, tampered: true }, signature), 'Tampered payload should fail');

  console.log('  ✅ HMAC verification works correctly');
}

function testCallbackValidation() {
  console.log('Test: Callback validates required fields...');

  // Missing run_id
  let result = handleCallback({ decision: 'approve', action_taken: 'applied', operator_source: 'cli' });
  assert.equal(result.status, 400, 'Missing run_id should return 400');

  // Invalid decision
  result = handleCallback({ run_id: 'test', decision: 'maybe', action_taken: 'applied', operator_source: 'cli' });
  assert.equal(result.status, 400, 'Invalid decision should return 400');

  // Invalid action_taken
  result = handleCallback({ run_id: 'test', decision: 'approve', action_taken: 'unknown', operator_source: 'cli' });
  assert.equal(result.status, 400, 'Invalid action_taken should return 400');

  // Missing applied_at when action_taken='applied'
  result = handleCallback({
    run_id: 'test',
    decision: 'approve',
    action_taken: 'applied',
    operator_source: 'cli'
    // missing applied_at
  });
  assert.equal(result.status, 400, 'Missing applied_at for applied action should return 400');

  console.log('  ✅ Callback validation works correctly');
}

function testCallbackRunNotFound() {
  console.log('Test: Callback returns 404 for non-existent run...');

  const result = handleCallback({
    run_id: 'non-existent-run-12345',
    decision: 'approve',
    action_taken: 'not_applied',
    operator_source: 'cli'
  });

  assert.equal(result.status, 404, 'Non-existent run should return 404');
  assert.ok(result.message.includes('not exist'), 'Message should indicate run not found');

  console.log('  ✅ Returns 404 for non-existent run');
}

function testCallbackIdempotency() {
  console.log('Test: Callback is idempotent (409 on duplicate)...');

  const testRunId = `test-idempotency-${Date.now()}`;
  const runDir = join(process.cwd(), 'data', 'runs', testRunId);

  try {
    // Create test run directory
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, 'playbook_output.json'), JSON.stringify({ test: true }));

    const payload = {
      run_id: testRunId,
      decision: 'approve',
      action_taken: 'applied',
      applied_at: new Date().toISOString(),
      operator_source: 'cli'
    };

    // First call should succeed
    const result1 = handleCallback(payload);
    assert.equal(result1.status, 200, 'First callback should succeed');
    assert.ok(result1.ok, 'First callback should be ok');

    // Second call with same payload should return 409
    const result2 = handleCallback(payload);
    assert.equal(result2.status, 409, 'Duplicate callback should return 409');
    assert.ok(!result2.ok, 'Duplicate callback should not be ok');
    assert.ok(result2.message.includes('duplicate') || result2.message.includes('Conflict'),
      'Message should indicate duplicate');

    console.log('  ✅ Idempotency works correctly (409 on duplicate)');
  } finally {
    // Cleanup
    if (existsSync(runDir)) {
      rmSync(runDir, { recursive: true, force: true });
    }
  }
}

function testCallbackWritesSignalAndFact() {
  console.log('Test: Callback writes operator_signal.json and appends fact...');

  const testRunId = `test-write-${Date.now()}`;
  const runDir = join(process.cwd(), 'data', 'runs', testRunId);
  const factsFile = join(process.cwd(), 'state', 'memory', 'facts', 'fact_run_outcomes.jsonl');

  try {
    // Create test run directory
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, 'playbook_output.json'), JSON.stringify({ test: true }));

    // Get initial facts count
    let initialFactsCount = 0;
    if (existsSync(factsFile)) {
      initialFactsCount = readFileSync(factsFile, 'utf-8').trim().split('\n').filter(Boolean).length;
    }

    const payload = {
      run_id: testRunId,
      decision: 'reject',
      action_taken: 'n/a',
      operator_source: 'cli',
      note: 'Test rejection'
    };

    const result = handleCallback(payload);
    assert.equal(result.status, 200, 'Callback should succeed');

    // Verify operator_signal.json exists
    const signalPath = join(runDir, 'operator_signal.json');
    assert.ok(existsSync(signalPath), 'operator_signal.json should exist');

    const signal = JSON.parse(readFileSync(signalPath, 'utf-8'));
    assert.equal(signal.run_id, testRunId, 'Signal should have correct run_id');
    assert.equal(signal.decision, 'reject', 'Signal should have correct decision');
    assert.equal(signal.note, 'Test rejection', 'Signal should have note');

    // Verify fact was appended
    assert.ok(existsSync(factsFile), 'fact_run_outcomes.jsonl should exist');
    const factsContent = readFileSync(factsFile, 'utf-8').trim().split('\n').filter(Boolean);
    assert.ok(factsContent.length > initialFactsCount, 'Fact should be appended');

    const lastFact = JSON.parse(factsContent[factsContent.length - 1]);
    assert.equal(lastFact.run_id, testRunId, 'Fact should have correct run_id');
    assert.equal(lastFact.event_type, 'operator_signal', 'Fact should have correct event_type');

    console.log('  ✅ Writes operator_signal.json and appends fact correctly');
  } finally {
    // Cleanup
    if (existsSync(runDir)) {
      rmSync(runDir, { recursive: true, force: true });
    }
  }
}

// ===============================================================
// Test Runner
// ===============================================================

async function runAllTests() {
  console.log('\n========================================');
  console.log('Bid Recommend Card & Callback Tests');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  const tests = [
    // Card tests
    testCardHasThreeButtons,
    testCardHasRunIdInPayload,
    testCardNoSecrets,
    testCardStructure,
    testCardEmptyEntities,
    // Callback tests
    testCallbackHmacVerification,
    testCallbackValidation,
    testCallbackRunNotFound,
    testCallbackIdempotency,
    testCallbackWritesSignalAndFact
  ];

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (e) {
      console.error(`  ❌ FAILED: ${e.message}`);
      if (e.stack) {
        console.error(`     ${e.stack.split('\n')[1]}`);
      }
      failed++;
    }
  }

  console.log('\n========================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});
