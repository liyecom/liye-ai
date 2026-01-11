/**
 * Signal Agent - Geo Pipeline
 *
 * Purpose: Compute metrics only, no judgments
 *
 * Rules:
 * - ❌ Do NOT return decisions
 * - ❌ Do NOT compare benchmarks
 * - ✅ Only return numeric facts
 */

export function runSignals(input) {
  return {
    visibility_score: input.impressions / input.category_avg_impressions,
    local_pack_rank: input.local_pack_position,
    review_rating: input.total_rating_score / input.review_count,
    review_count: input.review_count,
    review_response_rate: input.responded_reviews / input.review_count,
    profile_completeness: input.filled_fields / input.total_fields,
    citation_consistency_score: input.consistent_citations / input.total_citations,
    days_since_last_post: input.days_since_post
  };
}
