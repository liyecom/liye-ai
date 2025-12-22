#!/usr/bin/env node
/**
 * LiYe OS Guardrail - 性能边界检查
 * 确保 CLAUDE.md 和 Packs 不超过规定字符数限制
 */

import fs from "node:fs";
import path from "path";

const rules = [
  { file: "CLAUDE.md", maxChars: 10000 },
  { dir: ".claude/packs", suffix: ".md", maxChars: 15000 },
];

function charCount(filePath) {
  // Unicode-safe character count (handles emoji, Chinese, etc.)
  return [...fs.readFileSync(filePath, "utf8")].length;
}

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;

  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listFiles(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

let failed = false;
const results = [];

for (const r of rules) {
  if (r.file) {
    if (!fs.existsSync(r.file)) {
      results.push({ file: r.file, status: "SKIP", reason: "not found" });
      continue;
    }

    const n = charCount(r.file);
    const status = n > r.maxChars ? "FAIL" : "PASS";
    results.push({
      file: r.file,
      chars: n,
      maxChars: r.maxChars,
      status,
      percentage: Math.round((n / r.maxChars) * 100),
    });

    if (status === "FAIL") {
      console.error(`❌ FAIL: ${r.file} has ${n} chars > ${r.maxChars} (${Math.round((n / r.maxChars) * 100)}%)`);
      failed = true;
    }
  }

  if (r.dir) {
    if (!fs.existsSync(r.dir)) {
      results.push({ dir: r.dir, status: "SKIP", reason: "not found" });
      continue;
    }

    const files = listFiles(r.dir).filter(f => f.endsWith(r.suffix));
    for (const f of files) {
      const n = charCount(f);
      const status = n > r.maxChars ? "FAIL" : "PASS";
      results.push({
        file: f,
        chars: n,
        maxChars: r.maxChars,
        status,
        percentage: Math.round((n / r.maxChars) * 100),
      });

      if (status === "FAIL") {
        console.error(`❌ FAIL: ${f} has ${n} chars > ${r.maxChars} (${Math.round((n / r.maxChars) * 100)}%)`);
        failed = true;
      }
    }
  }
}

// Print summary
console.log("\n=== Guardrail Check Results ===\n");

const passed = results.filter(r => r.status === "PASS");
const failedItems = results.filter(r => r.status === "FAIL");
const skipped = results.filter(r => r.status === "SKIP");

if (passed.length > 0) {
  console.log("✅ PASSED:");
  for (const r of passed) {
    console.log(`   ${r.file}: ${r.chars.toLocaleString()} / ${r.maxChars.toLocaleString()} chars (${r.percentage}%)`);
  }
  console.log();
}

if (failedItems.length > 0) {
  console.log("❌ FAILED:");
  for (const r of failedItems) {
    const excess = r.chars - r.maxChars;
    console.log(`   ${r.file}: ${r.chars.toLocaleString()} / ${r.maxChars.toLocaleString()} chars (${r.percentage}%)`);
    console.log(`      → Excess: ${excess.toLocaleString()} chars (need to reduce)`);
  }
  console.log();
}

if (skipped.length > 0) {
  console.log("⏭️  SKIPPED:");
  for (const r of skipped) {
    console.log(`   ${r.file || r.dir}: ${r.reason}`);
  }
  console.log();
}

console.log("=== Summary ===");
console.log(`Total: ${results.length} | ✅ ${passed.length} | ❌ ${failedItems.length} | ⏭️  ${skipped.length}`);
console.log();

if (failed) {
  console.error("❌ Guardrail check FAILED. Please reduce file sizes before committing.");
  process.exit(1);
}

console.log("✅ Guardrail check PASSED. All files within limits.");
process.exit(0);
