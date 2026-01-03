#!/usr/bin/env node
/**
 * Concept ID Global Uniqueness Validator
 * Ensures concept_id is unique across ALL glossaries
 *
 * Part of Memory as a Product (MaaP) v1.0
 */

import fs from "fs";
import YAML from "yaml";

function fail(msg) {
  console.error("[CONCEPT_ID VALIDATION FAIL]", msg);
  process.exit(1);
}

function loadYaml(p) {
  return YAML.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const mapPath = ".claude/config/domain-mapping.yaml";
  if (!fs.existsSync(mapPath)) fail(`missing ${mapPath}`);

  const mapping = loadYaml(mapPath);
  const domains = mapping.domains || [];
  const glossaryPaths = domains.map(d => d.glossary).filter(Boolean);

  const seen = new Map(); // concept_id -> {file, name, domain, version}
  const duplicates = [];
  const missingFiles = [];
  let totalConcepts = 0;

  for (const gp of glossaryPaths) {
    if (!fs.existsSync(gp)) {
      missingFiles.push(gp);
      continue;
    }
    const g = loadYaml(gp);
    const concepts = g.concepts || [];
    totalConcepts += concepts.length;

    for (const c of concepts) {
      const id = String(c.concept_id || "").trim();
      if (!id) fail(`${gp}: empty concept_id`);
      const cur = { file: gp, name: c.name, domain: c.domain, version: c.version };

      if (seen.has(id)) {
        duplicates.push({ concept_id: id, a: seen.get(id), b: cur });
      } else {
        seen.set(id, cur);
      }
    }
  }

  if (duplicates.length) {
    const lines = duplicates.slice(0, 20).map(d =>
      `- ${d.concept_id}\n  - A: ${d.a.file} (${d.a.domain} | ${d.a.version} | ${d.a.name})\n  - B: ${d.b.file} (${d.b.domain} | ${d.b.version} | ${d.b.name})`
    ).join("\n");
    fail(`duplicate concept_id found (${duplicates.length})\n${lines}`);
  }

  // Soft warn for missing glossary files
  if (missingFiles.length) {
    console.warn("[WARN] missing glossaries:", missingFiles);
  }

  console.log(JSON.stringify({
    ok: true,
    glossaries: glossaryPaths.length,
    missing_glossaries: missingFiles,
    total_concepts: totalConcepts,
    unique_concept_ids: seen.size
  }, null, 2));
}

main();
