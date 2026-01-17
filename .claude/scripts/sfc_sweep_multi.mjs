#!/usr/bin/env node
/**
 * SFC Sweep Multi-Source (WARNING-only)
 *
 * Runs sfc_sweep.mjs against multiple roots:
 * - liye_os repo root (.)
 * - ~/.claude/skills (external plugins)
 * - ~/github/amazon-growth-engine (peer repo) if present
 *
 * Outputs separate reports under:
 * docs/reports/skill-factory/
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function runSweep({ id, root, label }) {
  const script = path.resolve(".claude/scripts/sfc_sweep.mjs");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.resolve(`docs/reports/skill-factory/SFC_SWEEP_${id}_${ts}.md`);

  console.log(`\n=== Running SFC Sweep: ${label} ===`);
  console.log(`Root: ${root}`);
  console.log(`Report: ${reportPath}`);

  const res = spawnSync(process.execPath, [script, root], { encoding: "utf8" });

  const out = [
    `# SFC Sweep Report`,
    ``,
    `- Source: ${label}`,
    `- Root: ${root}`,
    `- Timestamp: ${new Date().toISOString()}`,
    ``,
    `---`,
    ``,
    `## Raw Output`,
    ``,
    "```",
    (res.stdout || "").trim(),
    (res.stderr || "").trim(),
    "```",
    ``,
    `---`,
    ``,
    `Exit Code: ${res.status}`,
    ``,
  ].join("\n");

  fs.writeFileSync(reportPath, out, "utf8");

  return {
    id,
    label,
    root,
    reportPath,
    exitCode: res.status ?? -1,
  };
}

function main() {
  const HOME = process.env.HOME || "";
  const sources = [
    { id: "liye_os", root: ".", label: "LiYe OS Repo (internal)" },
    { id: "external_plugins", root: path.join(HOME, ".claude/skills"), label: "Claude External Skills (read-only plugins)" },
    { id: "amazon_growth_engine", root: path.join(HOME, "github/amazon-growth-engine"), label: "Amazon Growth Engine (peer repo)" },
  ];

  const results = [];
  for (const s of sources) {
    if (!s.root || !exists(s.root)) {
      console.log(`\n--- Skipped: ${s.label}`);
      console.log(`Reason: path not found -> ${s.root}`);
      continue;
    }
    results.push(runSweep(s));
  }

  console.log(`\n=== Summary ===`);
  for (const r of results) {
    console.log(`- ${r.label}`);
    console.log(`  Root: ${r.root}`);
    console.log(`  Report: ${r.reportPath}`);
    console.log(`  Exit: ${r.exitCode}`);
  }

  console.log(`\nDONE ✅ Multi-source sweep complete (reports generated).`);
}

main();
