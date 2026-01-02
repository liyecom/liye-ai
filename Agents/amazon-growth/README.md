# Amazon Growth OS — Domain Agent Pipeline

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
  ad_spend: 1000,
  ad_sales: 2000,
  total_sales: 5000,
  orders: 50,
  sessions: 1000,
  inventory_units: 100,
  daily_sales_velocity: 20
};

const thresholds = {
  max_acos: 0.35,
  min_cvr: 0.05,
  min_inventory_days: 14
};

const signals = runSignals(input);
const ruleResults = applyRules(signals, thresholds);
const decisions = generateVerdicts(ruleResults, signals);
```

## Expected Output

- `decisions` is an array
- Each element is a valid Decision JSON (schema-validated)
- No natural language output
