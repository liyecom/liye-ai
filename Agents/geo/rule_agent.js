/**
 * Rule Agent - Geo Pipeline
 *
 * Purpose: Evaluate boolean triggers only, no verdicts
 *
 * Rules:
 * - ❌ Do NOT output Decision JSON
 * - ❌ Do NOT write recommendations or explanations
 * - ✅ Only output decision_id: true/false
 */

export function applyRules(signals, thresholds) {
  return {
    VISIBILITY_TOO_LOW: signals.visibility_score < thresholds.min_visibility_score,
    LOCAL_PACK_RANK_DROP: signals.local_pack_rank > thresholds.max_local_pack_rank,
    REVIEW_RATING_TOO_LOW: signals.review_rating < thresholds.min_review_rating,
    REVIEW_COUNT_TOO_LOW: signals.review_count < thresholds.min_review_count,
    REVIEW_RESPONSE_RATE_LOW: signals.review_response_rate < thresholds.min_response_rate,
    PROFILE_INCOMPLETE: signals.profile_completeness < thresholds.min_profile_completeness,
    CITATION_INCONSISTENCY: signals.citation_consistency_score < thresholds.min_citation_consistency,
    POSTS_STALE: signals.days_since_last_post > thresholds.max_days_since_post
  };
}
