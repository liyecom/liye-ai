// tests/runtime/execution/test_kill_switch.mjs
// Kill Switch Tests - P6-C Emergency Stop Mechanism

import {
  isKillSwitchActive,
  checkKillSwitch,
  assertKillSwitchInactive
} from '../../../src/runtime/execution/kill_switch.mjs';

function testKillSwitchActive() {
  const origEnv = { ...process.env };
  process.env.KILL_SWITCH = 'true';

  const result = checkKillSwitch();
  console.assert(result.active === true, 'Kill switch should be active');
  console.assert(result.blocked_actions.includes('suggest'), 'Should block suggest');
  console.assert(result.blocked_actions.includes('live_write'), 'Should block live_write');
  console.assert(result.blocked_actions.includes('retry'), 'Should block retry');
  console.assert(result.blocked_actions.includes('replay'), 'Should block replay');

  Object.assign(process.env, origEnv);
  if (!origEnv.KILL_SWITCH) delete process.env.KILL_SWITCH;
  console.log('✅ testKillSwitchActive passed');
}

function testKillSwitchInactive() {
  const origEnv = { ...process.env };
  delete process.env.KILL_SWITCH;

  const result = checkKillSwitch();
  console.assert(result.active === false, 'Kill switch should be inactive');
  console.assert(result.blocked_actions.length === 0, 'Should not block anything');

  Object.assign(process.env, origEnv);
  console.log('✅ testKillSwitchInactive passed');
}

function testIsKillSwitchActive() {
  const origEnv = { ...process.env };

  process.env.KILL_SWITCH = 'true';
  console.assert(isKillSwitchActive() === true, 'Should return true when KILL_SWITCH=true');

  process.env.KILL_SWITCH = 'false';
  console.assert(isKillSwitchActive() === false, 'Should return false when KILL_SWITCH=false');

  delete process.env.KILL_SWITCH;
  console.assert(isKillSwitchActive() === false, 'Should return false when unset');

  Object.assign(process.env, origEnv);
  if (!origEnv.KILL_SWITCH) delete process.env.KILL_SWITCH;
  console.log('✅ testIsKillSwitchActive passed');
}

function testAssertKillSwitchInactive() {
  const origEnv = { ...process.env };

  // Test when kill switch is active - should throw
  process.env.KILL_SWITCH = 'true';
  let threwError = false;
  try {
    assertKillSwitchInactive('suggest');
  } catch (e) {
    threwError = true;
    console.assert(e.message.includes('KILL_SWITCH active'), 'Error message should mention KILL_SWITCH');
    console.assert(e.message.includes('suggest'), 'Error message should include operation name');
  }
  console.assert(threwError === true, 'Should throw when kill switch is active');

  // Test when kill switch is inactive - should not throw
  delete process.env.KILL_SWITCH;
  let didNotThrow = true;
  try {
    assertKillSwitchInactive('suggest');
  } catch (e) {
    didNotThrow = false;
  }
  console.assert(didNotThrow === true, 'Should not throw when kill switch is inactive');

  Object.assign(process.env, origEnv);
  if (!origEnv.KILL_SWITCH) delete process.env.KILL_SWITCH;
  console.log('✅ testAssertKillSwitchInactive passed');
}

function testCheckKillSwitchReason() {
  const origEnv = { ...process.env };

  // Test reason when active
  process.env.KILL_SWITCH = 'true';
  let result = checkKillSwitch();
  console.assert(result.reason.includes('KILL_SWITCH=true'), 'Reason should mention KILL_SWITCH=true');

  // Test reason when inactive
  delete process.env.KILL_SWITCH;
  result = checkKillSwitch();
  console.assert(result.reason.includes('inactive'), 'Reason should mention inactive');

  Object.assign(process.env, origEnv);
  if (!origEnv.KILL_SWITCH) delete process.env.KILL_SWITCH;
  console.log('✅ testCheckKillSwitchReason passed');
}

// Run all tests
testKillSwitchActive();
testKillSwitchInactive();
testIsKillSwitchActive();
testAssertKillSwitchInactive();
testCheckKillSwitchReason();

console.log('\n🎉 All kill switch tests passed');
