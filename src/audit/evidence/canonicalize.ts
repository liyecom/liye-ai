/**
 * Deterministic Canonicalization
 * Contract: docs/contracts/EVIDENCE_PACKAGE_V1.md (FROZEN: 2026-02-01)
 *
 * Canonicalization Rules (from Contract Implementation Notes):
 * 1. All object keys MUST be sorted lexicographically (stable).
 * 2. Undefined / null MUST be normalized to empty string "".
 * 3. Arrays MUST be deterministically ordered before hashing.
 * 4. JSON.stringify third argument MUST NOT be relied on for determinism.
 */

/**
 * Recursively sort object keys and normalize values
 */
function normalizeValue(value: unknown): unknown {
  // null / undefined → ""
  if (value === null || value === undefined) {
    return "";
  }

  // Array: normalize each element, then sort by stringified value
  if (Array.isArray(value)) {
    return value
      .map(normalizeValue)
      .map((v) => JSON.stringify(v))
      .sort()
      .map((s) => JSON.parse(s));
  }

  // Object: sort keys lexicographically
  if (typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = normalizeValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  // Primitives: return as-is
  return value;
}

/**
 * Deterministic JSON stringify
 *
 * Guarantees:
 * - Same content, different key order → identical output
 * - null / undefined → ""
 * - Arrays are sorted by stringified element value
 *
 * @param input - Any JSON-serializable value
 * @returns Deterministic JSON string
 */
export function stableStringify(input: unknown): string {
  const normalized = normalizeValue(input);
  return JSON.stringify(normalized);
}
