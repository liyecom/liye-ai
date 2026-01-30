/**
 * add_negative_keywords.mjs - Add Negative Keywords Action Implementation
 *
 * P3: First auto-executable action with full safety controls.
 * Supports dry-run mode and generates complete rollback payloads.
 *
 * @module reasoning/execution/actions
 * @version v0.1
 */

import { loadActionPlaybook } from '../build_action_proposal.mjs';
import { registerAction } from '../execute_action.mjs';

/**
 * Select candidate negative keywords based on selection policy
 *
 * @param {Array} searchTerms - Search term data with waste metrics
 * @param {Object} policy - Selection policy from playbook
 * @param {Object} limits - Safety limits from playbook
 * @param {Object} state - Current state (brand_terms, existing_negatives)
 * @param {Object} options - Options
 * @param {boolean} options.returnDiagnostics - Return diagnostics object instead of array
 * @returns {Array|Object} Selected keywords (or diagnostics object if returnDiagnostics=true)
 */
export function selectCandidates(searchTerms, policy, limits, state = {}, options = {}) {
  const candidates = [];

  // Filtering diagnostics (Patch-2: audit/observability)
  const diagnostics = {
    candidates_before: searchTerms.length,
    filtered_too_short: [],
    filtered_brand_terms: [],
    filtered_asin_terms: [],
    filtered_dedupe: [],
    final_candidates: 0,
    filter_summary: ''
  };

  // Sort by waste (strategy: top_waste_terms)
  const sorted = [...searchTerms].sort((a, b) => {
    const wasteA = a.spend * (1 - (a.orders > 0 ? 1 : 0));
    const wasteB = b.spend * (1 - (b.orders > 0 ? 1 : 0));
    return wasteB - wasteA;
  });

  // Take top N candidates
  const topN = policy.top_n_candidates || 50;
  const candidatePool = sorted.slice(0, topN);

  // Brand terms (lowercase for comparison)
  const brandTermsLower = (state.brand_terms || []).map(t => t.toLowerCase());

  // Existing negatives (for dedupe)
  const existingNegatives = new Set((state.existing_negatives || []).map(n => n.toLowerCase()));

  // ASIN pattern
  const asinPattern = /^[A-Z0-9]{10}$/i;

  for (const term of candidatePool) {
    let keyword = term.search_term || term.keyword;

    // Normalize
    if (policy.normalize?.lowercase) {
      keyword = keyword.toLowerCase();
    }
    if (policy.normalize?.trim_whitespace) {
      keyword = keyword.trim();
    }

    // Check min length
    if (limits.min_term_length && keyword.length < limits.min_term_length) {
      diagnostics.filtered_too_short.push(keyword);
      continue;
    }

    // Check brand terms
    if (limits.forbid_brand_terms && brandTermsLower.some(bt => keyword.includes(bt))) {
      diagnostics.filtered_brand_terms.push(keyword);
      continue;
    }

    // Check ASIN terms
    if (limits.forbid_asin_terms && asinPattern.test(keyword)) {
      diagnostics.filtered_asin_terms.push(keyword);
      continue;
    }

    // Check dedupe
    if (policy.dedupe && existingNegatives.has(keyword)) {
      diagnostics.filtered_dedupe.push(keyword);
      continue;
    }

    candidates.push(keyword);

    // Respect max per run
    if (limits.max_negatives_per_run && candidates.length >= limits.max_negatives_per_run) {
      break;
    }
  }

  // Update diagnostics
  diagnostics.final_candidates = candidates.length;

  // Generate filter summary for audit notes
  const filters = [];
  if (diagnostics.filtered_too_short.length > 0) {
    filters.push(`too_short=${diagnostics.filtered_too_short.length}`);
  }
  if (diagnostics.filtered_brand_terms.length > 0) {
    filters.push(`brand_terms=${diagnostics.filtered_brand_terms.length}`);
  }
  if (diagnostics.filtered_asin_terms.length > 0) {
    filters.push(`asin_terms=${diagnostics.filtered_asin_terms.length}`);
  }
  if (diagnostics.filtered_dedupe.length > 0) {
    filters.push(`dedupe=${diagnostics.filtered_dedupe.length}`);
  }

  if (candidates.length === 0 && candidatePool.length > 0) {
    diagnostics.filter_summary = `All ${candidatePool.length} candidates filtered: ${filters.join(', ')}`;
  } else if (filters.length > 0) {
    diagnostics.filter_summary = `Filtered: ${filters.join(', ')}; Final: ${candidates.length}`;
  } else {
    diagnostics.filter_summary = `No filtering applied; Final: ${candidates.length}`;
  }

  // Return based on options
  if (options.returnDiagnostics) {
    return {
      candidates,
      diagnostics
    };
  }

  return candidates;
}

/**
 * Select candidates with full diagnostics (convenience wrapper)
 *
 * @param {Array} searchTerms - Search term data
 * @param {Object} policy - Selection policy
 * @param {Object} limits - Safety limits
 * @param {Object} state - Current state
 * @returns {Object} { candidates: Array, diagnostics: Object }
 */
export function selectCandidatesWithDiagnostics(searchTerms, policy, limits, state = {}) {
  return selectCandidates(searchTerms, policy, limits, state, { returnDiagnostics: true });
}

/**
 * Add negative keywords action implementation
 *
 * @param {Object} proposal - Action proposal
 * @param {Object} params - Action parameters
 * @param {Array} params.negative_keywords - Keywords to add
 * @param {string} params.match_type - PHRASE or EXACT
 * @param {string} params.campaign_id - Target campaign
 * @param {string} params.ad_group_id - Target ad group (optional)
 * @param {Object} state - Current state
 * @returns {Object} Execution result
 */
async function addNegativeKeywordsAction(proposal, params, state = {}) {
  const playbook = loadActionPlaybook('ADD_NEGATIVE_KEYWORDS');
  const result = {
    success: false,
    action_id: 'ADD_NEGATIVE_KEYWORDS',
    keywords_processed: 0,
    keywords_added: [],
    keywords_skipped: [],
    rollback_payload: null,
    after_metrics: null,
    error: null
  };

  try {
    const keywords = params.negative_keywords || [];
    const matchType = params.match_type || 'PHRASE';

    // Validate match type
    const allowedTypes = playbook.safety_limits?.match_types_allowed || ['PHRASE', 'EXACT'];
    if (!allowedTypes.includes(matchType)) {
      result.error = `Match type ${matchType} not allowed (allowed: ${allowedTypes.join(', ')})`;
      return result;
    }

    // Validate campaign_id
    if (!params.campaign_id) {
      result.error = 'campaign_id is required';
      return result;
    }

    // Process keywords
    for (const keyword of keywords) {
      // In a real implementation, this would call the Amazon Ads API
      // For P3, we simulate the API call
      const apiResult = await simulateAddNegativeKeyword({
        keyword,
        matchType,
        campaignId: params.campaign_id,
        adGroupId: params.ad_group_id
      });

      if (apiResult.success) {
        result.keywords_added.push({
          keyword,
          matchType,
          negative_keyword_id: apiResult.negative_keyword_id
        });
      } else {
        result.keywords_skipped.push({
          keyword,
          reason: apiResult.error
        });
      }

      result.keywords_processed++;
    }

    // Build rollback payload
    result.rollback_payload = {
      action_id: 'ADD_NEGATIVE_KEYWORDS',
      method: 'remove_negatives',
      campaign_id: params.campaign_id,
      ad_group_id: params.ad_group_id,
      negative_keywords_added: result.keywords_added.map(k => ({
        keyword: k.keyword,
        matchType: k.matchType,
        negative_keyword_id: k.negative_keyword_id
      })),
      match_types: [...new Set(result.keywords_added.map(k => k.matchType))],
      timestamp: new Date().toISOString(),
      executor_id: 'p3_safe_auto',
      trace_id: proposal.trace_id,
      rule_version: proposal.rule_version,
      expires_at: new Date(Date.now() + 168 * 60 * 60 * 1000).toISOString() // 7 days
    };

    // Calculate success
    if (result.keywords_added.length > 0) {
      result.success = true;
    } else if (result.keywords_skipped.length > 0) {
      result.success = false;
      result.error = `All ${result.keywords_skipped.length} keywords were skipped`;
    } else {
      result.success = false;
      result.error = 'No keywords to process';
    }

  } catch (error) {
    result.error = error.message;
    result.success = false;
  }

  return result;
}

/**
 * Simulate adding a negative keyword (for P3 dry-run / testing)
 * In production, this would call the actual Amazon Ads API
 */
async function simulateAddNegativeKeyword({ keyword, matchType, campaignId, adGroupId }) {
  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 10));

  // Simulate occasional failures for testing
  const shouldFail = Math.random() < 0.05; // 5% failure rate

  if (shouldFail) {
    return {
      success: false,
      error: 'Simulated API error'
    };
  }

  return {
    success: true,
    negative_keyword_id: `nkw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  };
}

/**
 * Execute rollback for add_negative_keywords
 *
 * @param {Object} rollbackPayload - Rollback payload from execution result
 * @returns {Object} Rollback result
 */
export async function rollbackAddNegativeKeywords(rollbackPayload) {
  const result = {
    success: false,
    keywords_removed: [],
    keywords_failed: [],
    error: null
  };

  try {
    // Check expiry
    if (new Date(rollbackPayload.expires_at) < new Date()) {
      result.error = 'Rollback expired';
      return result;
    }

    const keywords = rollbackPayload.negative_keywords_added || [];

    for (const kw of keywords) {
      // In production, this would call the Amazon Ads API to remove the negative
      const removeResult = await simulateRemoveNegativeKeyword(kw.negative_keyword_id);

      if (removeResult.success) {
        result.keywords_removed.push(kw);
      } else {
        result.keywords_failed.push({
          ...kw,
          error: removeResult.error
        });
      }
    }

    result.success = result.keywords_failed.length === 0;
    if (!result.success) {
      result.error = `Failed to remove ${result.keywords_failed.length} keywords`;
    }

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

/**
 * Simulate removing a negative keyword
 */
async function simulateRemoveNegativeKeyword(negativeKeywordId) {
  await new Promise(resolve => setTimeout(resolve, 10));
  return { success: true };
}

// Register the action with the executor
registerAction('ADD_NEGATIVE_KEYWORDS', addNegativeKeywordsAction);

// Default export
export default {
  addNegativeKeywordsAction,
  selectCandidates,
  selectCandidatesWithDiagnostics,
  rollbackAddNegativeKeywords
};
