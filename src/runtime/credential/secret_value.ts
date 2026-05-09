/**
 * BGHS Credential Mediation — SecretValue wrapper
 * Location: src/runtime/credential/secret_value.ts
 *
 * ADR-Credential-Mediation §6. Node.js implementation of the
 * contract-level SecretValue requirements:
 *   - default JSON / string / util.inspect output is masked
 *   - reveal() is the only sanctioned path to the raw string
 */

import type { SecretValue } from './types';

const MASK = '***REDACTED***' as const;

/**
 * Wrap a raw secret in a SecretValue. The returned object hides the raw
 * value from every default serialization path; callers must explicitly
 * call `reveal()` to get the string, and are responsible for dropping
 * the reference quickly (ADR M9).
 */
export function wrapSecret(raw: string): SecretValue {
  return {
    reveal: () => raw,
    toJSON: () => MASK,
    toString: () => MASK,
    // Node.js-specific: util.inspect custom hook so that console.log and
    // debug-print paths also emit the mask.
    [Symbol.for('nodejs.util.inspect.custom')]: () => MASK,
  } as SecretValue & { [key: symbol]: () => string };
}

export const SECRET_MASK = MASK;
