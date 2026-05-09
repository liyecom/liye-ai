/**
 * BGHS Credential Mediation — CredentialReference parser
 * Location: src/runtime/credential/reference.ts
 *
 * ADR-Credential-Mediation §1 / §7 — URI validation.
 */

import {
  InvalidCredentialReferenceError,
  type CredentialReference,
  type ParsedCredentialRef,
} from './types';

const REF_RE = /^cred:\/\/([a-z0-9-]+)\/([a-z0-9-]{3,64})(\?.*)?$/;

function parseQualifiers(query: string | undefined): Record<string, string> {
  if (!query) return {};
  const s = query.startsWith('?') ? query.slice(1) : query;
  if (!s) return {};
  const out: Record<string, string> = {};
  for (const part of s.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq <= 0) {
      throw new InvalidCredentialReferenceError(query, `malformed qualifier "${part}"`);
    }
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (!/^[a-z0-9_-]+$/.test(key)) {
      throw new InvalidCredentialReferenceError(query, `qualifier key "${key}" invalid`);
    }
    out[key] = value;
  }
  return out;
}

/** Parse `cred://owner/name[?k=v&...]` into its structural fields. Throws on invalid input. */
export function parseCredentialRef(ref: CredentialReference): ParsedCredentialRef {
  const m = ref.match(REF_RE);
  if (!m) {
    throw new InvalidCredentialReferenceError(
      ref,
      'expected format "cred://<owner>/<name>[?q=v]" with owner [a-z0-9-]+ and name [a-z0-9-]{3,64}',
    );
  }
  return {
    scheme: 'cred',
    owner: m[1],
    name: m[2],
    qualifiers: parseQualifiers(m[3]),
  };
}

/** True iff `ref` is a syntactically valid CredentialReference. */
export function isValidCredentialRef(ref: string): boolean {
  try {
    parseCredentialRef(ref);
    return true;
  } catch {
    return false;
  }
}
