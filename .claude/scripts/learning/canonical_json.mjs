#!/usr/bin/env node
/**
 * Canonical JSON — token-preserving parser + Python-`json.dumps`-equivalent emit.
 * SSOT: .claude/scripts/learning/canonical_json.mjs
 *
 * Phase: 1b (GHL fact importer). Consumed by import_facts.mjs.
 * Normative: SPEC `.planning/phase-1b/SPEC.md` §1.7.X (blob 4a606e18) + CODE-SSOT
 *   AGE `scripts/learning/emit_fact.py::canonical_json_bytes`.
 *
 * WHY token-preserving (NOT JSON.parse + re-stringify):
 *   AGE emit_fact writes every sidecar as
 *     json.dumps(obj, sort_keys=True, separators=(",",":"), ensure_ascii=False).encode("utf-8")
 *   so the sidecar bytes are ALREADY Python-canonical. Node `JSON.parse` folds
 *   `1.0`→`1`, loses >2^53 integer precision, and `JSON.stringify` re-formats
 *   numbers / escapes U+2028 differently than Python. Reproducing Python's float
 *   `repr` + string escaping from scratch is fragile (and Q2 forbids RFC8785/JCS
 *   libs because JCS is NOT byte-equal to `json.dumps(ensure_ascii=False)`).
 *
 *   Instead we parse to an AST that preserves each scalar's EXACT source token,
 *   then re-emit: object keys sorted by decoded code-point order, `,`/`:` with no
 *   whitespace, scalar tokens verbatim. Because the source was already
 *   Python-canonical, byte-equality holds BY CONSTRUCTION — no float-repr / escape
 *   reimplementation, robust to the entire §1.7.X divergence domain
 *   (1.0 / 1e+16 / 1e-07 / -0.0 / big-int / raw U+2028).
 *
 *   GROUND-TRUTH NOTE (CODE-SSOT > SPEC prose, per SPEC §0 / §0.1): the live
 *   `python3` here proves `json.dumps(chr(0x2028), ensure_ascii=False)` emits a
 *   RAW U+2028 (only `"`, `\`, and control chars < 0x20 are escaped). SPEC §1.7.X
 *   prose ("强制转义 U+2028/U+2029") is therefore inaccurate; force-escaping would
 *   diverge from the emitted sidecar and false-reject. Token preservation matches
 *   actual emit_fact output and sidesteps the prose entirely.
 *
 * This module is GENERIC (no GHL field knowledge). The identity / content /
 * record-hash recompute (which keys to drop) lives in import_facts.mjs.
 */

import { createHash } from 'crypto';

/**
 * Token-preserving JSON parse.
 * AST node shapes:
 *   { t: 'obj', entries: [{ keyRaw, keyStr, value }, ...] }
 *   { t: 'arr', items: [node, ...] }
 *   { t: 'str', raw: '"..."', value: <decoded JS string> }
 *   { t: 'num', raw: '1e+16' }
 *   { t: 'bool', raw: 'true' | 'false' }
 *   { t: 'null' }
 * `keyRaw` / `raw` are the EXACT source bytes (as a JS string slice); they are
 * re-emitted verbatim so Python's escaping / number formatting is preserved.
 *
 * @param {string} text  UTF-8-decoded JSON document.
 * @returns {object} AST root node.
 */
export function parseCanonical(text) {
  if (typeof text !== 'string') throw new TypeError('parseCanonical expects a string');
  let i = 0;
  const n = text.length;

  const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r';
  const skipWs = () => { while (i < n && isWs(text[i])) i++; };

  function fail(msg) {
    throw new SyntaxError(`canonical_json: ${msg} at offset ${i}`);
  }

  function parseValue() {
    skipWs();
    if (i >= n) fail('unexpected end of input');
    const c = text[i];
    if (c === '{') return parseObject();
    if (c === '[') return parseArray();
    if (c === '"') return parseString();
    if (c === 't' || c === 'f') return parseBool();
    if (c === 'n') { expectLiteral('null'); return { t: 'null' }; }
    if (c === '-' || (c >= '0' && c <= '9')) return parseNumber();
    return fail(`unexpected character ${JSON.stringify(c)}`);
  }

  function expectLiteral(lit) {
    if (text.slice(i, i + lit.length) !== lit) fail(`expected '${lit}'`);
    i += lit.length;
  }

  function parseBool() {
    if (text[i] === 't') { expectLiteral('true'); return { t: 'bool', raw: 'true' }; }
    expectLiteral('false');
    return { t: 'bool', raw: 'false' };
  }

  function parseString() {
    const start = i;
    i++; // opening quote
    let decoded = '';
    while (i < n) {
      const ch = text[i];
      if (ch === '\\') {
        const esc = text[i + 1];
        if (esc === undefined) fail('unterminated escape');
        if (esc === 'u') {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('bad \\u escape');
          decoded += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else {
          const map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
          if (!(esc in map)) fail(`bad escape \\${esc}`);
          decoded += map[esc];
          i += 2;
        }
      } else if (ch === '"') {
        i++; // closing quote
        return { t: 'str', raw: text.slice(start, i), value: decoded };
      } else {
        decoded += ch;
        i++;
      }
    }
    return fail('unterminated string');
  }

  function parseNumber() {
    const start = i;
    if (text[i] === '-') i++;
    if (!(text[i] >= '0' && text[i] <= '9')) fail('invalid number');
    while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    if (text[i] === '.') { i++; if (!(text[i] >= '0' && text[i] <= '9')) fail('invalid fraction'); while (i < n && text[i] >= '0' && text[i] <= '9') i++; }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!(text[i] >= '0' && text[i] <= '9')) fail('invalid exponent');
      while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    }
    return { t: 'num', raw: text.slice(start, i) };
  }

  function parseObject() {
    i++; // '{'
    const entries = [];
    skipWs();
    if (text[i] === '}') { i++; return { t: 'obj', entries }; }
    for (;;) {
      skipWs();
      if (text[i] !== '"') fail('expected object key');
      const key = parseString();
      skipWs();
      if (text[i] !== ':') fail("expected ':'");
      i++;
      const value = parseValue();
      entries.push({ keyRaw: key.raw, keyStr: key.value, value });
      skipWs();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; break; }
      return fail("expected ',' or '}'");
    }
    return { t: 'obj', entries };
  }

  function parseArray() {
    i++; // '['
    const items = [];
    skipWs();
    if (text[i] === ']') { i++; return { t: 'arr', items }; }
    for (;;) {
      items.push(parseValue());
      skipWs();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; break; }
      return fail("expected ',' or ']'");
    }
    return { t: 'arr', items };
  }

  const root = parseValue();
  skipWs();
  if (i !== n) fail('trailing content after JSON value');
  return root;
}

/**
 * Code-point-order string comparator (matches Python `sorted()` over `str`).
 * JS default `<` compares UTF-16 code units, which differs from code-point order
 * for astral characters; `Array.from` iterates code points so this matches CPython.
 */
export function codePointCompare(a, b) {
  const ca = Array.from(a);
  const cb = Array.from(b);
  const len = Math.min(ca.length, cb.length);
  for (let k = 0; k < len; k++) {
    const d = ca[k].codePointAt(0) - cb[k].codePointAt(0);
    if (d !== 0) return d;
  }
  return ca.length - cb.length;
}

/**
 * Re-emit an AST as canonical JSON text byte-equal to Python
 * `json.dumps(obj, sort_keys=True, separators=(",",":"), ensure_ascii=False)`.
 * Scalars are emitted from their preserved source token; object keys are sorted
 * by decoded code-point order; no insignificant whitespace.
 *
 * @param {object} node  AST node (from parseCanonical or constructed).
 * @returns {string} canonical JSON text (UTF-8 encode it before hashing).
 */
export function emitCanonical(node) {
  switch (node.t) {
    case 'str':
    case 'num':
    case 'bool':
      return node.raw;
    case 'null':
      return 'null';
    case 'arr':
      return '[' + node.items.map(emitCanonical).join(',') + ']';
    case 'obj': {
      const sorted = [...node.entries].sort((x, y) => codePointCompare(x.keyStr, y.keyStr));
      return '{' + sorted.map((e) => e.keyRaw + ':' + emitCanonical(e.value)).join(',') + '}';
    }
    default:
      throw new TypeError(`emitCanonical: unknown node type ${node && node.t}`);
  }
}

/** sha256 of a UTF-8 string, prefixed `sha256:` (matches emit_fact `_sha256_prefixed`). */
export function sha256Prefixed(text) {
  return 'sha256:' + createHash('sha256').update(Buffer.from(text, 'utf-8')).digest('hex');
}

/** Hash an AST node via canonical emit (`sha256:` + sha256(canonical bytes)). */
export function hashCanonical(node) {
  return sha256Prefixed(emitCanonical(node));
}

/**
 * Construct a `{ t: 'str' }` node from a decoded JS string, encoding the token
 * with `JSON.stringify`. SAFE for ASCII keys / values only (which is all this
 * importer constructs: the 8 literal identity keys). For arbitrary parsed values
 * always reuse the preserved node rather than reconstructing.
 */
export function makeStringNode(value) {
  return { t: 'str', raw: JSON.stringify(value), value };
}

/** Build an object AST node from `[key, valueNode]` pairs (keys must be ASCII). */
export function makeObjectNode(pairs) {
  return {
    t: 'obj',
    entries: pairs.map(([key, value]) => ({ keyRaw: JSON.stringify(key), keyStr: key, value })),
  };
}

/** Look up an entry's value node in an object AST node (first match), or undefined. */
export function getEntry(objNode, key) {
  if (!objNode || objNode.t !== 'obj') return undefined;
  const hit = objNode.entries.find((e) => e.keyStr === key);
  return hit ? hit.value : undefined;
}

/**
 * Realize an AST node into plain JS values (for JSON-schema validation only —
 * NEVER for hashing). `num` is coerced via `Number(raw)`, which folds precision;
 * acceptable because validation only inspects type/enum/pattern, not exact value.
 */
export function astToValue(node) {
  switch (node.t) {
    case 'str': return node.value;
    case 'num': return Number(node.raw);
    case 'bool': return node.raw === 'true';
    case 'null': return null;
    case 'arr': return node.items.map(astToValue);
    case 'obj': {
      const out = {};
      for (const e of node.entries) out[e.keyStr] = astToValue(e.value);
      return out;
    }
    default:
      throw new TypeError(`astToValue: unknown node type ${node && node.t}`);
  }
}

/**
 * True if any `num` (native JSON number) node appears anywhere in the subtree.
 * Used to enforce the Pilot-1 string-encode-all content policy (SPEC §1.7.X):
 * native numbers in `raw_payload_summary` → NUMERIC_NOT_STRING reject.
 */
export function containsNativeNumber(node) {
  if (!node) return false;
  switch (node.t) {
    case 'num': return true;
    case 'arr': return node.items.some(containsNativeNumber);
    case 'obj': return node.entries.some((e) => containsNativeNumber(e.value));
    default: return false;
  }
}
