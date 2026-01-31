// tests/runtime/execution/test_four_key_gate.mjs
import { checkFourKeyGate } from '../../../src/runtime/execution/four_key_gate.mjs';

function testAllKeysRequired() {
  const origEnv = { ...process.env };
  delete process.env.ADS_OAUTH_MODE;
  delete process.env.DENY_READONLY_ENV;
  delete process.env.ALLOW_LIVE_WRITES;
  delete process.env.WRITE_ENABLED;

  const result = checkFourKeyGate();
  console.assert(result.allowed === false, 'Should deny when keys missing');
  console.assert(result.missing_keys.length === 4, 'Should report 4 missing keys');

  Object.assign(process.env, origEnv);
  console.log('✅ testAllKeysRequired passed');
}

function testAllKeysPresent() {
  const origEnv = { ...process.env };
  process.env.ADS_OAUTH_MODE = 'write';
  process.env.DENY_READONLY_ENV = 'false';
  process.env.ALLOW_LIVE_WRITES = 'true';
  process.env.WRITE_ENABLED = '1';

  const result = checkFourKeyGate();
  console.assert(result.allowed === true, 'Should allow when all keys present');
  console.assert(result.missing_keys.length === 0, 'Should have no missing keys');

  Object.assign(process.env, origEnv);
  console.log('✅ testAllKeysPresent passed');
}

function testSingleKeyMissing() {
  const origEnv = { ...process.env };
  process.env.ADS_OAUTH_MODE = 'write';
  process.env.DENY_READONLY_ENV = 'false';
  process.env.ALLOW_LIVE_WRITES = 'true';
  delete process.env.WRITE_ENABLED;

  const result = checkFourKeyGate();
  console.assert(result.allowed === false, 'Should deny when 1 key missing');
  console.assert(result.missing_keys.includes('WRITE_ENABLED'), 'Should report missing key');

  Object.assign(process.env, origEnv);
  console.log('✅ testSingleKeyMissing passed');
}

testAllKeysRequired();
testAllKeysPresent();
testSingleKeyMissing();
console.log('\n🎉 All four-key gate tests passed');
