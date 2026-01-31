// src/runtime/execution/four_key_gate.mjs
const FOUR_KEYS = [
  { env: 'ADS_OAUTH_MODE', required_value: 'write', owner: 'AGE', description: 'OAuth mode must be write' },
  { env: 'DENY_READONLY_ENV', required_value: 'false', owner: 'LiYe', description: 'Readonly deny must be false' },
  { env: 'ALLOW_LIVE_WRITES', required_value: 'true', owner: 'LiYe', description: 'Live writes master switch' },
  { env: 'WRITE_ENABLED', required_value: '1', owner: 'LiYe', description: 'Write enabled flag' }
];

export function checkFourKeyGate() {
  const missing_keys = [];
  const key_status = {};

  for (const key of FOUR_KEYS) {
    const value = process.env[key.env];
    const valid = value === key.required_value;
    key_status[key.env] = { present: value !== undefined, value: value || null, required: key.required_value, valid, owner: key.owner, description: key.description };
    if (!valid) missing_keys.push(key.env);
  }

  return { allowed: missing_keys.length === 0, missing_keys, key_status, reason: missing_keys.length === 0 ? 'All four keys valid' : `Missing/invalid keys: ${missing_keys.join(', ')}` };
}

export function getFourKeyReport() {
  const result = checkFourKeyGate();
  const lines = ['Four-Key Gate Status:'];
  for (const [key, status] of Object.entries(result.key_status)) {
    const icon = status.valid ? '✅' : '❌';
    const value = status.present ? `"${status.value}"` : 'NOT SET';
    lines.push(`  ${icon} ${key} = ${value} (need: "${status.required}")`);
  }
  lines.push('', result.allowed ? '✅ GATE: OPEN' : '❌ GATE: CLOSED');
  return lines.join('\n');
}

export default { checkFourKeyGate, getFourKeyReport };
