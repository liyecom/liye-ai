#!/usr/bin/env node
/**
 * stop_gate.mjs
 * - Stop hook: enforce completion only in Governed mode (definition-of-done gate)
 * - Fast mode: never blocks; only provides alignment reminder
 *
 * Hook behavior: Stop hook runs when Claude Code finishes responding.
 */

import fs from "node:fs";
import path from "node:path";

const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SESSION_DIR = path.join(PROJECT_DIR, ".claude", ".session");
const COMPILED_DIR = path.join(PROJECT_DIR, ".claude", ".compiled");
const MEMORY_STATE_PATH = path.join(COMPILED_DIR, "memory_state.json");
const SESSION_PLAN_PATH = path.join(SESSION_DIR, "plan.yaml");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.resume();
  });
}

function safeJsonParse(s) {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}

function loadMemoryState() {
  try { return JSON.parse(fs.readFileSync(MEMORY_STATE_PATH, "utf8")); }
  catch { return { execution_mode: "fast", error_count_consecutive: 0, active_track: null }; }
}

function parseYamlVeryLight(yamlText) {
  const out = {};
  const lines = yamlText.split(/\r?\n/);
  let key = null;
  for (const raw of lines) {
    const line = raw.replace(/\t/g, "  ");
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)\s*$/);
    if (m && !line.startsWith("  ")) {
      key = m[1];
      const v = m[2];
      if (v === "") out[key] = out[key] ?? [];
      else out[key] = v.replace(/^"(.*)"$/, "$1");
      continue;
    }
    const a = line.match(/^\s*-\s*(.*)\s*$/);
    if (a && key) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(a[1].replace(/^"(.*)"$/, "$1"));
    }
  }
  return out;
}

function planCompletionGaps() {
  if (!fs.existsSync(SESSION_PLAN_PATH)) return { ok: true, gaps: [] };
  const y = parseYamlVeryLight(fs.readFileSync(SESSION_PLAN_PATH, "utf8"));
  const goal = y.goal || "";
  const criteria = Array.isArray(y.success_criteria) ? y.success_criteria : [];
  const gaps = [];
  if (!goal || goal.includes("Fill") || goal.includes("填写")) gaps.push("Goal not filled in session plan.yaml");
  if (!criteria.length) gaps.push("success_criteria missing in session plan.yaml");
  return { ok: gaps.length === 0, gaps };
}

async function main() {
  safeJsonParse(await readStdin());

  const state = loadMemoryState();
  const mode = state.execution_mode || "fast";

  if (mode !== "governed") {
    const msg = [
      "[Stop Gate: Fast Path]",
      "No blocking in Fast mode.",
      `Consecutive Errors: ${state.error_count_consecutive || 0}`,
      "If you are about to end the work: ensure traces contain enough facts to resume later.",
    ].join("\n");
    process.stderr.write(msg + "\n");
    process.exit(0);
  }

  const { ok, gaps } = planCompletionGaps();

  if (ok) {
    process.stderr.write("[Stop Gate: Governed Path] PASS\n");
    process.exit(0);
  }

  const msg = [
    "[Stop Gate: Governed Path] BLOCKED",
    "Completion criteria not satisfied. Fix gaps or explicitly mark skipped.",
    "",
    "Gaps:",
    ...gaps.map((g) => `- ${g}`),
    "",
    "Action:",
    "1) Update plan.yaml (goal + success_criteria), OR",
    "2) Upgrade the Track plan/spec to include structured Goal/Success, OR",
    "3) If intentionally skipping, record rationale in traces and update plan.",
  ].join("\n");

  process.stderr.write(msg + "\n");
  process.exit(2);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(0);
});
