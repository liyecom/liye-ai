/**
 * Verdict Agent - Amazon Growth OS
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

  if (ruleResults.ACOS_TOO_HIGH) {
    const decision = {
      decision_id: "ACOS_TOO_HIGH",
      domain: "amazon-growth",
      severity: "warning",
      confidence: 0.82,
      evidence: {
        acos: signals.acos
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: ACOS_TOO_HIGH");
    }
    decisions.push(decision);
  }

  if (ruleResults.CONVERSION_RATE_TOO_LOW) {
    const decision = {
      decision_id: "CONVERSION_RATE_TOO_LOW",
      domain: "amazon-growth",
      severity: "warning",
      confidence: 0.76,
      evidence: {
        conversion_rate: signals.conversion_rate
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: CONVERSION_RATE_TOO_LOW");
    }
    decisions.push(decision);
  }

  if (ruleResults.STOCKOUT_RISK) {
    const decision = {
      decision_id: "STOCKOUT_RISK",
      domain: "amazon-growth",
      severity: "critical",
      confidence: 0.88,
      evidence: {
        inventory_days_left: signals.inventory_days_left
      },
      timestamp,
      version: "v1.0"
    };
    if (!validate(decision)) {
      throw new Error("Schema validation failed: STOCKOUT_RISK");
    }
    decisions.push(decision);
  }

  return decisions;
}
