/**
 * Verdict Agent - GEO OS
 *
 * Purpose: Output schema-bound decisions only
 *
 * Rules:
 * - ❌ Do NOT return natural language
 * - ❌ Validation failure throws error
 * - ✅ Only return schema-validated JSON
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const schema = require("../../contracts/schema/decision.schema.json");

const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(schema);

export function generateVerdicts(ruleResults, signals) {
  const decisions = [];
  const timestamp = new Date().toISOString();

  if (ruleResults.VISIBILITY_TOO_LOW) {
    const decision = {
      decision_id: "VISIBILITY_TOO_LOW",
      domain: "geo-os",
      severity: "warning",
      confidence: 0.80,
      evidence: {
        visibility_score: signals.visibility_score
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: VISIBILITY_TOO_LOW");
    }
    decisions.push(decision);
  }

  if (ruleResults.LOCAL_PACK_RANK_DROP) {
    const decision = {
      decision_id: "LOCAL_PACK_RANK_DROP",
      domain: "geo-os",
      severity: "critical",
      confidence: 0.85,
      evidence: {
        local_pack_rank: signals.local_pack_rank
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: LOCAL_PACK_RANK_DROP");
    }
    decisions.push(decision);
  }

  if (ruleResults.REVIEW_RATING_TOO_LOW) {
    const decision = {
      decision_id: "REVIEW_RATING_TOO_LOW",
      domain: "geo-os",
      severity: "warning",
      confidence: 0.82,
      evidence: {
        review_rating: signals.review_rating
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: REVIEW_RATING_TOO_LOW");
    }
    decisions.push(decision);
  }

  if (ruleResults.REVIEW_COUNT_TOO_LOW) {
    const decision = {
      decision_id: "REVIEW_COUNT_TOO_LOW",
      domain: "geo-os",
      severity: "warning",
      confidence: 0.78,
      evidence: {
        review_count: signals.review_count
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: REVIEW_COUNT_TOO_LOW");
    }
    decisions.push(decision);
  }

  if (ruleResults.REVIEW_RESPONSE_RATE_LOW) {
    const decision = {
      decision_id: "REVIEW_RESPONSE_RATE_LOW",
      domain: "geo-os",
      severity: "warning",
      confidence: 0.75,
      evidence: {
        review_response_rate: signals.review_response_rate
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: REVIEW_RESPONSE_RATE_LOW");
    }
    decisions.push(decision);
  }

  if (ruleResults.PROFILE_INCOMPLETE) {
    const decision = {
      decision_id: "PROFILE_INCOMPLETE",
      domain: "geo-os",
      severity: "warning",
      confidence: 0.90,
      evidence: {
        profile_completeness: signals.profile_completeness
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: PROFILE_INCOMPLETE");
    }
    decisions.push(decision);
  }

  if (ruleResults.CITATION_INCONSISTENCY) {
    const decision = {
      decision_id: "CITATION_INCONSISTENCY",
      domain: "geo-os",
      severity: "warning",
      confidence: 0.85,
      evidence: {
        citation_consistency_score: signals.citation_consistency_score
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: CITATION_INCONSISTENCY");
    }
    decisions.push(decision);
  }

  if (ruleResults.POSTS_STALE) {
    const decision = {
      decision_id: "POSTS_STALE",
      domain: "geo-os",
      severity: "info",
      confidence: 0.88,
      evidence: {
        days_since_last_post: signals.days_since_last_post
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: POSTS_STALE");
    }
    decisions.push(decision);
  }

  return decisions;
}
