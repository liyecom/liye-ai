#!/usr/bin/env node
/**
 * Glossary Schema Validator
 * Validates all glossary files referenced in domain-mapping.yaml
 * Part of Memory as a Product (MaaP) v1.0
 *
 * Minimal Zod-free validator to avoid bundling TS at runtime.
 * If you want to use the full Zod schema (src/memory/schema/glossary.ts),
 * you can add a TS build step.
 */

import fs from "fs";
import YAML from "yaml";
import path from "path";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadYaml(p) {
  return YAML.parse(fs.readFileSync(p, "utf8"));
}

function validateGlossaryFile(p) {
  const obj = loadYaml(p);

  assert(typeof obj.file_version === "number", `${p}: file_version missing/invalid`);
  assert(typeof obj.domain === "string" && obj.domain.length > 0, `${p}: domain missing/invalid`);
  assert(Array.isArray(obj.concepts), `${p}: concepts missing/invalid`);

  for (const c of obj.concepts) {
    assert(
      typeof c.concept_id === "string" && c.concept_id.length > 2,
      `${p}: concept_id invalid`
    );
    assert(
      /^v\d+\.\d+(\.\d+)?$/.test(String(c.version || "")),
      `${p}: version invalid for ${c.concept_id}`
    );
    assert(
      typeof c.domain === "string" && c.domain.length > 0,
      `${p}: concept domain invalid ${c.concept_id}`
    );
    assert(
      typeof c.name === "string" && c.name.length > 0,
      `${p}: name invalid ${c.concept_id}`
    );
    assert(
      typeof c.definition === "string" && c.definition.length > 0,
      `${p}: definition invalid ${c.concept_id}`
    );
  }

  return { ok: true, path: p, concepts: obj.concepts.length };
}

function main() {
  const map = loadYaml(".claude/config/domain-mapping.yaml");
  const glos = map.domains.map(d => d.glossary).filter(Boolean);
  const results = [];
  const warnings = [];

  for (const g of glos) {
    if (!fs.existsSync(g)) {
      console.warn(`[WARN] glossary missing: ${g}`);
      warnings.push(g);
      continue;
    }
    try {
      results.push(validateGlossaryFile(g));
      console.log(`✅ Validated: ${g}`);
    } catch (e) {
      console.error(`❌ Failed: ${g} - ${e.message}`);
      process.exit(1);
    }
  }

  console.log();
  console.log(JSON.stringify({
    ok: true,
    validated: results,
    missing: warnings,
    total_concepts: results.reduce((sum, r) => sum + r.concepts, 0)
  }, null, 2));
}

main();
