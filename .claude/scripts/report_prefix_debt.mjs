#!/usr/bin/env node
/**
 * Prefix Debt Report Generator
 * Documents all existing prefix policy violations for tracking/migration
 *
 * Output: docs/governance/PREFIX_DEBT_REPORT.md
 *
 * Part of Memory as a Product (MaaP) v1.0
 */

import fs from "fs";
import YAML from "yaml";

const PREFIX = {
  "amazon-advertising": "AMZ_",
  "geo-os": "GEO_",
  "medical-research": "MED_",
  "general": "GEN_"
};

function loadYaml(p) {
  return YAML.parse(fs.readFileSync(p, "utf8"));
}

function slugifyId(s) {
  return String(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function suggestedId(domain, concept) {
  const want = PREFIX[domain];
  if (!want) return null;
  const base = concept.name ? slugifyId(concept.name) : slugifyId(concept.concept_id);
  return `${want}${base}`;
}

function main() {
  const mapPath = ".claude/config/domain-mapping.yaml";
  if (!fs.existsSync(mapPath)) {
    console.error(`[FAIL] missing ${mapPath}`);
    process.exit(1);
  }

  const map = loadYaml(mapPath);
  const domains = map.domains || [];

  const violations = [];

  for (const d of domains) {
    const gp = d.glossary;
    if (!gp || !fs.existsSync(gp)) continue;

    const g = loadYaml(gp);
    const concepts = g.concepts || [];

    for (const c of concepts) {
      const dom = String(c.domain || d.id).trim();
      const want = PREFIX[dom];
      if (!want) continue;

      const id = String(c.concept_id || "").trim();
      if (!id.startsWith(want)) {
        violations.push({
          domain: dom,
          file: gp,
          concept_id: id,
          name: c.name || "",
          version: c.version || "",
          suggested: suggestedId(dom, c)
        });
      }
    }
  }

  const byDomain = {};
  for (const v of violations) {
    byDomain[v.domain] ||= [];
    byDomain[v.domain].push(v);
  }

  const lines = [];
  lines.push(`# Prefix Debt Report`);
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Policy: prevent-regression enforced; legacy debt tracked here.`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push(`- Total violations: **${violations.length}**`);
  lines.push(`- Domains covered: ${Object.keys(PREFIX).join(", ")}`);
  lines.push("");

  for (const dom of Object.keys(byDomain).sort()) {
    const list = byDomain[dom];
    lines.push(`## Domain: ${dom} (violations=${list.length})`);
    lines.push(`| concept_id (current) | suggested new id | name | version | file |`);
    lines.push(`|---|---|---|---|---|`);
    for (const v of list) {
      lines.push(`| ${v.concept_id} | ${v.suggested || ""} | ${v.name} | ${v.version} | ${v.file} |`);
    }
    lines.push("");
  }

  fs.mkdirSync("docs/governance", { recursive: true });
  fs.writeFileSync("docs/governance/PREFIX_DEBT_REPORT.md", lines.join("\n"), "utf8");

  console.log(JSON.stringify({
    ok: true,
    violations: violations.length,
    out: "docs/governance/PREFIX_DEBT_REPORT.md"
  }, null, 2));
}

main();
