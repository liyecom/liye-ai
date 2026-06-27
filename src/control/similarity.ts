/**
 * Tag-set similarity helpers
 * Location: src/control/similarity.ts
 *
 * Shared Jaccard similarity over capability tag sets. Extracted from the
 * byte-identical local copies in control/registry.ts and
 * runtime/orchestrator/router.ts (cut ④ §7 helper merge — DRY, behavior-preserving).
 */

/**
 * Compute Jaccard similarity between two tag sets
 */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}
