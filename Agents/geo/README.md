# Geo Pipeline — Domain Agent Pipeline

This pipeline enforces strict separation of concerns:

- Signal Agent: computes metrics only
- Rule Agent: evaluates boolean triggers only
- Verdict Agent: outputs schema-bound decisions only

Agents must NOT:
- Output natural language conclusions
- Explain reasoning
- Interpret decision contracts

All explanations are handled by Decision Contracts (Phase 5.2).

## Usage

```js
import { runSignals } from "./signal_agent.js";
import { applyRules } from "./rule_agent.js";
import { generateVerdicts } from "./verdict_agent.js";

const input = {
  impressions: 5000,
  category_avg_impressions: 10000,
  local_pack_position: 5,
  total_rating_score: 180,
  review_count: 45,
  responded_reviews: 20,
  filled_fields: 8,
  total_fields: 10,
  consistent_citations: 40,
  total_citations: 50,
  days_since_post: 45
};

const thresholds = {
  min_visibility_score: 0.6,
  max_local_pack_rank: 3,
  min_review_rating: 4.0,
  min_review_count: 50,
  min_response_rate: 0.5,
  min_profile_completeness: 0.9,
  min_citation_consistency: 0.85,
  max_days_since_post: 30
};

const signals = runSignals(input);
const ruleResults = applyRules(signals, thresholds);
const decisions = generateVerdicts(ruleResults, signals);
```

## Expected Output

- `decisions` is an array
- Each element is a valid Decision JSON (schema-validated)
- No natural language output
