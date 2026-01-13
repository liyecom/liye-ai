#!/usr/bin/env node
/**
 * pre_tool_check.mjs
 * - PreToolUse/UserPromptSubmit: re-align to goal/phase/next actions before risky moves
 * - PostToolUse (--post): update tool_call_count + consecutive error strike (3-strike)
 *
 * Design constraints:
 * - No second plan/findings/progress file system
 * - Track-first: if active_track exists, use Track plan; else use session plan yaml
 * - F1: write facts to traces; do not curate memory_brief in Fast Path
 *
 * Hook payload: Claude Code provides event JSON to stdin for tool events.
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

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function loadMemoryState() {
  try {
    return JSON.parse(fs.readFileSync(MEMORY_STATE_PATH, "utf8"));
  } catch {
    return {
      execution_mode: "fast",
      governed_upgrade_reason: null,
      tool_call_count: 0,
      error_count_consecutive: 0,
      error_count_total: 0,
      active_track: null,
      session_id: process.env.CLAUDE_SESSION_ID || null,
    };
  }
}

function saveMemoryState(s) {
  ensureDir(COMPILED_DIR);
  fs.writeFileSync(MEMORY_STATE_PATH, JSON.stringify(s, null, 2));
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

function ensureSessionPlanExists() {
  ensureDir(SESSION_DIR);
  if (fs.existsSync(SESSION_PLAN_PATH)) return;

  const now = new Date().toISOString();
  const template = [
    "version: 1",
    `created_at: "${now}"`,
    'goal: "(Fill session goal)"',
    "success_criteria:",
    '  - "(Acceptance criteria 1)"',
    '  - "(Acceptance criteria 2)"',
    "phases:",
    '  - id: "research"',
    '    description: "Understand current state"',
    '    status: "pending"',
    '  - id: "implement"',
    '    description: "Implement changes"',
    '    status: "pending"',
    '  - id: "verify"',
    '    description: "Verify/test"',
    '    status: "pending"',
  ].join("\n") + "\n";

  fs.writeFileSync(SESSION_PLAN_PATH, template, "utf8");
}

function resolvePlanSource(memoryState) {
  const id = memoryState.active_track;
  if (id && typeof id === "string") {
    const candidates = [
      path.join(PROJECT_DIR, "tracks", id, "plan.md"),
      path.join(PROJECT_DIR, "tracks", id, "spec.md"),
      path.join(PROJECT_DIR, "track", id, "plan.md"),
      path.join(PROJECT_DIR, "track", "plan.md"),
      path.join(PROJECT_DIR, "tracks", "plan.md"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return { type: "track-md", path: p };
    }
  }
  ensureSessionPlanExists();
  return { type: "session-yaml", path: SESSION_PLAN_PATH };
}

function summarizePlan(planSource) {
  if (planSource.type === "session-yaml") {
    const y = parseYamlVeryLight(fs.readFileSync(planSource.path, "utf8"));
    const goal = y.goal || "(goal not set)";
    const criteria = Array.isArray(y.success_criteria) ? y.success_criteria.slice(0, 3) : [];
    return { goal, criteria, source: planSource.path };
  }

  const md = fs.readFileSync(planSource.path, "utf8");
  const goalLine =
    md.split(/\r?\n/).find((l) => /^#+\s*Goal\b|^#+\s*目标\b/i.test(l)) ||
    md.split(/\r?\n/).find((l) => l.toLowerCase().includes("goal:")) ||
    "";
  const goal = goalLine ? goalLine.replace(/^#+\s*/,"").replace(/^\s*goal:\s*/i,"").trim() : "(track plan has no explicit Goal)";
  return { goal, criteria: [], source: planSource.path };
}

function isToolFailure(payload) {
  const out = payload.tool_output || payload.toolOutput || {};
  if (typeof out.exit_code === "number") return out.exit_code !== 0;
  if (typeof out.is_error === "boolean") return out.is_error;
  if (out.error || out.stderr) return true;
  return false;
}

function maybeUpgradeToGoverned(state, reason) {
  if (state.execution_mode === "governed") return state;
  state.execution_mode = "governed";
  state.governed_upgrade_reason = reason;
  return state;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const isPost = args.has("--post");

  const payload = safeJsonParse(await readStdin());
  const state = loadMemoryState();

  if (isPost) {
    state.tool_call_count = (state.tool_call_count || 0) + 1;

    if (isToolFailure(payload)) {
      state.error_count_total = (state.error_count_total || 0) + 1;
      state.error_count_consecutive = (state.error_count_consecutive || 0) + 1;
      state.last_error_at = new Date().toISOString();

      if (state.error_count_consecutive >= 3) {
        maybeUpgradeToGoverned(state, "3-strike: consecutive failures >= 3");
      }
    } else {
      state.error_count_consecutive = 0;
      state.last_success_at = new Date().toISOString();
    }

    saveMemoryState(state);
    process.exit(0);
  }

  const planSource = resolvePlanSource(state);
  const summary = summarizePlan(planSource);

  if (state.active_track && !state.execution_mode) state.execution_mode = "governed";
  if (!state.execution_mode) state.execution_mode = "fast";
  saveMemoryState(state);

  const header = state.execution_mode === "governed"
    ? "[Governed Path Alignment]"
    : "[Fast Path Alignment]";

  const toolName = payload.tool_name || payload.toolName || process.env.CLAUDE_TOOL_NAME || "(unknown)";
  const msg = [
    header,
    `Plan Source: ${summary.source}`,
    `Goal: ${summary.goal}`,
    summary.criteria?.length ? "Success (top):\n- " + summary.criteria.join("\n- ") : "Success: (not structured / not provided)",
    `Consecutive Errors: ${state.error_count_consecutive || 0}`,
    `Tool: ${toolName}`,
    "",
    "Next step rule: if this action doesn't serve the Goal, STOP and update the plan.",
  ].join("\n");

  process.stderr.write(msg + "\n");
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(String(e?.stack || e) + "\n");
  process.exit(0);
});
