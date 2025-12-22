#!/usr/bin/env node
/**
 * LiYe OS Guardrail
 * - Size limits (CLAUDE.md + Packs)
 * - Secret-like pattern gate (STAGED files only)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rules = [
  { file: "CLAUDE.md", maxChars: 10000 },
  { dir: ".claude/packs", suffix: ".md", maxChars: 15000 },
];

// ---- helpers ----
function charCount(p) {
  // unicode-safe char count
  return [...fs.readFileSync(p, "utf8")].length;
}

function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

function stagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only", { encoding: "utf8" });
    return out.split("\n").map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isTextLikeFile(f) {
  // 保守：只扫常见文本/配置/文档/代码；避免误扫二进制导致卡顿
  return /\.(md|txt|json|ya?ml|toml|ini|env|js|mjs|ts|py|sh|bash|zsh|rb|go|java|kt|swift|php|sql|csv)$/i.test(f)
    || /(^|\/)(README|LICENSE|Dockerfile)(\..*)?$/i.test(f);
}

// ---- 1) size limits ----
let failed = false;

for (const r of rules) {
  if (r.file) {
    if (!fs.existsSync(r.file)) continue;
    const n = charCount(r.file);
    if (n > r.maxChars) {
      console.error(`FAIL: ${r.file} ${n} chars > ${r.maxChars}`);
      failed = true;
    }
  }
  if (r.dir) {
    if (!fs.existsSync(r.dir)) continue;
    const files = listFiles(r.dir).filter(f => f.endsWith(r.suffix));
    for (const f of files) {
      const n = charCount(f);
      if (n > r.maxChars) {
        console.error(`FAIL: ${f} ${n} chars > ${r.maxChars}`);
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);

// ---- 2) secret-like gate (staged only) ----
const secretPatterns = [
  // Anthropic
  { name: "Anthropic sk-ant-api03", re: /sk-ant-api03-[A-Za-z0-9_-]{10,}/g },
  // OpenAI-like
  { name: "OpenAI sk-*", re: /sk-[A-Za-z0-9]{20,}/g },
  // Notion / generic secret_*
  { name: "secret_* token", re: /secret_[A-Za-z0-9]{12,}/g },
  // AWS access key id
  { name: "AWS AKIA", re: /AKIA[0-9A-Z]{16}/g },
  // Generic Bearer tokens (very conservative)
  { name: "Bearer token", re: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}/gi },
];

for (const f of stagedFiles()) {
  if (!fs.existsSync(f)) continue;
  if (!isTextLikeFile(f)) continue;

  let txt = "";
  try {
    txt = fs.readFileSync(f, "utf8");
  } catch {
    continue;
  }

  for (const p of secretPatterns) {
    if (p.re.test(txt)) {
      console.error(`FAIL: secret-like token detected (${p.name}) in staged file: ${f}`);
      process.exit(1);
    }
  }
}

console.log("OK: guardrail passed");
