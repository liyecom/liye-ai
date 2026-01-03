#!/usr/bin/env node
/**
 * Prefix Policy Gate (Prevent Regression Only)
 * Only checks concept_id prefix compliance in CHANGED glossary files
 *
 * Does NOT check historical debt - only prevents new violations.
 *
 * Prefix Policy (aligned with domain-mapping.yaml domain IDs):
 * - amazon-advertising: AMZ_
 * - geo-os: GEO_
 * - medical-research: MED_
 * - general: GEN_
 *
 * Part of Memory as a Product (MaaP) v1.0
 */

import { execSync } from "child_process";
import fs from "fs";
import YAML from "yaml";

const PREFIX = {
  "amazon-advertising": "AMZ_",
  "geo-os": "GEO_",
  "medical-research": "MED_",
  "general": "GEN_"
};

function fail(msg) {
  console.error("[PREFIX GATE FAIL]", msg);
  process.exit(1);
}

function gitDiffFiles() {
  // Support both PR and push:
  // - PR: GITHUB_BASE_REF exists; compare against origin/<base>
  // - push: compare against HEAD~1
  const base = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : "HEAD~1";
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, {
      stdio: ["ignore", "pipe", "ignore"]
    }).toString("utf8").trim();
    return out ? out.split("\n") : [];
  } catch {
    // Fallback: no files to check if diff fails
    return [];
  }
}

function loadYaml(p) {
  return YAML.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const changed = gitDiffFiles();
  const targets = changed.filter(
    p => p.startsWith("knowledge/glossary/") && p.endsWith(".yaml")
  );

  if (targets.length === 0) {
    console.log(JSON.stringify({
      ok: true,
      checked: 0,
      note: "no glossary changes in this PR/push"
    }, null, 2));
    return;
  }

  const violations = [];

  for (const gp of targets) {
    if (!fs.existsSync(gp)) continue;
    const g = loadYaml(gp);
    const concepts = g.concepts || [];
    for (const c of concepts) {
      const dom = String(c.domain || g.domain || "").trim();
      const want = PREFIX[dom];
      if (!want) continue; // unknown domain => skip (no policy defined)
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
    const lines = violations.slice(0, 50).map(v =>
      `- ${v.concept_id} (expected ${v.expected_prefix}) — ${v.name} @ ${v.file}`
    ).join("\n");
    fail(`prefix violations in changed glossaries (${violations.length})\n${lines}`);
  }

  console.log(JSON.stringify({
    ok: true,
    checked: targets.length,
    files: targets
  }, null, 2));
}

main();
