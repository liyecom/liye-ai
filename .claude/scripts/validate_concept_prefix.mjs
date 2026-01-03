#!/usr/bin/env node
/**
 * Concept ID Prefix Policy Validator
 * Enforces naming convention: prefix must match domain
 *
 * Prefix Policy:
 * - amazon-advertising: AMZ_
 * - geo-os: GEO_
 * - medical-research: MED_
 * - general: GEN_
 *
 * Part of Memory as a Product (MaaP) v1.0
 */

import fs from "fs";
import YAML from "yaml";

function fail(msg) {
  console.error("[CONCEPT_PREFIX VALIDATION FAIL]", msg);
  process.exit(1);
}

function loadYaml(p) {
  return YAML.parse(fs.readFileSync(p, "utf8"));
}

const PREFIX = {
  "amazon-advertising": "AMZ_",
  "geo-os": "GEO_",
  "medical-research": "MED_",
  "general": "GEN_"
};
// Note: geo-seo is not a separate domain yet. If it becomes one,
// add an ADR explaining the split and add GEOSEO_ prefix here.

function main() {
  const mapping = loadYaml(".claude/config/domain-mapping.yaml");
  const domains = mapping.domains || [];

  const violations = [];
  for (const d of domains) {
    const gp = d.glossary;
    if (!gp || !fs.existsSync(gp)) continue;
    const g = loadYaml(gp);
    const concepts = g.concepts || [];
    for (const c of concepts) {
      const dom = String(c.domain || d.id).trim();
      const want = PREFIX[dom];
      if (!want) continue; // unknown domain => skip
      const id = String(c.concept_id || "").trim();
      if (!id.startsWith(want)) {
        violations.push({
          file: gp,
          domain: dom,
          concept_id: id,
          expected_prefix: want,
          name: c.name
        });
      }
    }
  }

  if (violations.length) {
    const lines = violations.slice(0, 30).map(v =>
      `- ${v.concept_id} (expected ${v.expected_prefix}) — ${v.name} @ ${v.file}`
    ).join("\n");
    fail(`concept_id prefix violations (${violations.length})\n${lines}`);
  }

  console.log(JSON.stringify({ ok: true, prefix_policy: PREFIX }, null, 2));
}

main();
