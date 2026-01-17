#!/usr/bin/env node
/**
 * ESS Runner v0.1 (script-only MVP)
 *
 * Goal:
 * - Load ESS spec by skill_id
 * - Execute underlying script (node/python) with templated args
 * - Persist REPORT (evidence) + TRACE (audit trail)
 *
 * WARNING-only: never blocks CI unless explicitly wired later.
 *
 * Usage:
 *   node .claude/scripts/ess_run.mjs liye-os:sfc-sweep --root .
 *   node .claude/scripts/ess_run.mjs liye-os:sfc-lint --skill_dir Skills/00_Core_Utilities/meta/skill-creator
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function parseYaml(text) {
  // Try 'yaml' package if available; fallback to minimal parser
  try {
    const mod = await import("yaml");
    return mod.parse(text);
  } catch {
    return parseYamlMini(text);
  }
}

// Minimal YAML parser for our subset (key: value, nested maps, arrays)
function parseYamlMini(text) {
  const lines = text.split("\n");
  const root = {};
  const stack = [{ indent: -1, obj: root }];

  function setKV(obj, key, val) {
    obj[key] = val;
  }
  function parseScalar(v) {
    const s = v.trim();
    if (s === "true") return true;
    if (s === "false") return false;
    if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;

    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    const line = raw.trim();

    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    if (line.startsWith("- ")) {
      // array item
      const item = parseScalar(line.slice(2));
      if (!Array.isArray(parent.__arr)) parent.__arr = [];
      parent.__arr.push(item);
      continue;
    }

    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;

    const key = m[1];
    const rest = m[2];

    if (rest === "") {
      // start nested object
      const obj = {};
      setKV(parent, key, obj);
      stack.push({ indent, obj });
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      const inside = rest.slice(1, -1).trim();
      const arr = inside
        ? inside.split(",").map(s => parseScalar(s.trim().replace(/^["']|["']$/g, "")))
        : [];
      setKV(parent, key, arr);
    } else {
      setKV(parent, key, parseScalar(rest));
    }
  }

  // Convert any __arr marker into actual arrays
  function normalize(obj) {
    for (const k of Object.keys(obj)) {
      if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) {
        // Check if this object is actually an array (has __arr)
        if (obj[k].__arr && Array.isArray(obj[k].__arr)) {
          obj[k] = obj[k].__arr;
        } else {
          normalize(obj[k]);
        }
      }
    }
  }
  normalize(root);
  return root;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function applyTemplate(str, vars) {
  return String(str)
    .replaceAll("{{timestamp}}", vars.timestamp)
    .replaceAll("{{root}}", vars.root ?? ".")
    .replaceAll("{{skill_dir}}", vars.skill_dir ?? "");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const k = a.slice(2);
    const v = argv[i+1] && !argv[i+1].startsWith("--") ? argv[++i] : "true";
    args[k] = v;
  }
  return args;
}

function toYAML(obj) {
  // Minimal YAML writer for trace (safe enough for audit)
  const lines = [];
  const walk = (o, indent = 0) => {
    const sp = " ".repeat(indent);
    if (Array.isArray(o)) {
      for (const it of o) {
        if (typeof it === "object" && it !== null) {
          lines.push(`${sp}-`);
          walk(it, indent + 2);
        } else {
          lines.push(`${sp}- ${String(it)}`);
        }
      }
      return;
    }
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object") {
        lines.push(`${sp}${k}:`);
        walk(v, indent + 2);
      } else {
        lines.push(`${sp}${k}: ${String(v)}`);
      }
    }
  };
  walk(obj, 0);
  return lines.join("\n") + "\n";
}

async function loadESSBySkillId(skillId) {
  const base = path.resolve(".claude/ess");
  if (!exists(base)) return null;

  const parts = skillId.split(":");
  if (parts.length !== 2) return null;

  const ns = parts[0];
  const name = parts[1];

  const p = path.join(base, ns, `${name}.ess.yaml`);
  if (!exists(p)) return null;

  const raw = readFile(p);
  if (!raw) return null;

  const spec = await parseYaml(raw);
  return { path: p, spec };
}

async function main() {
  const skillId = process.argv[2];
  if (!skillId) {
    console.log("Usage: node .claude/scripts/ess_run.mjs <skill_id> [--key value...]");
    process.exit(0);
  }

  const { path: essPath, spec } = (await loadESSBySkillId(skillId)) || {};
  if (!spec) {
    console.log(`⚠️ ESS not found for skill_id: ${skillId}`);
    console.log(`Expected: .claude/ess/<namespace>/<name>.ess.yaml`);
    process.exit(0);
  }

  const ts = nowStamp();
  const inputs = parseArgs(process.argv.slice(3));
  const vars = { timestamp: ts, ...inputs };

  const execType = spec?.execution?.type;
  const runtime = spec?.execution?.runtime;
  const entry = spec?.execution?.entry;
  const args = spec?.execution?.args || [];

  const reportDir = applyTemplate(spec?.output?.contract?.report_dir || "docs/reports/ess", vars);
  const reportName = applyTemplate(spec?.output?.contract?.report_name || `ESS-RUN-${ts}.md`, vars);
  const tracePath = applyTemplate(spec?.output?.contract?.trace_path || `traces/ESS-TRACE-${ts}.yaml`, vars);

  ensureDir(reportDir);
  ensureDir(path.dirname(tracePath));

  const start = Date.now();

  // MVP: script-only execution
  if (execType !== "script") {
    const msg = `⚠️ ESS Runner MVP supports execution.type=script only. Got: ${execType}`;
    fs.writeFileSync(path.join(reportDir, reportName), msg + "\n", "utf8");
    fs.writeFileSync(tracePath, toYAML({
      kind: "ess_trace",
      ess_version: spec.ess_version,
      skill_id: skillId,
      ess_path: essPath,
      status: "unsupported_execution_type",
      execution_type: execType,
      started_at_ms: start,
      ended_at_ms: Date.now(),
      inputs,
      report_file: path.join(reportDir, reportName),
    }), "utf8");
    console.log(msg);
    process.exit(0);
  }

  if (!entry || !runtime) {
    const msg = `⚠️ ESS spec missing execution.entry or execution.runtime`;
    fs.writeFileSync(path.join(reportDir, reportName), msg + "\n", "utf8");
    fs.writeFileSync(tracePath, toYAML({
      kind: "ess_trace",
      ess_version: spec.ess_version,
      skill_id: skillId,
      ess_path: essPath,
      status: "invalid_spec",
      started_at_ms: start,
      ended_at_ms: Date.now(),
      inputs,
      report_file: path.join(reportDir, reportName),
    }), "utf8");
    console.log(msg);
    process.exit(0);
  }

  const resolvedArgs = args.map(a => applyTemplate(a, vars)).filter(Boolean);

  let cmd = null;
  if (runtime === "node") cmd = ["node", entry, ...resolvedArgs];
  else if (runtime === "python") cmd = ["python3", entry, ...resolvedArgs];
  else cmd = [runtime, entry, ...resolvedArgs];

  const res = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8" });
  const end = Date.now();

  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  const exitCode = typeof res.status === "number" ? res.status : 999;

  const reportPath = path.join(reportDir, reportName);

  const report = [
    `# ESS Run Report`,
    ``,
    `- skill_id: \`${skillId}\``,
    `- ess_path: \`${essPath}\``,
    `- timestamp: \`${ts}\``,
    `- cmd: \`${cmd.join(" ")}\``,
    `- exit_code: \`${exitCode}\``,
    ``,
    `---`,
    ``,
    `## STDOUT (evidence)`,
    "```",
    stdout.trimEnd(),
    "```",
    ``,
    `## STDERR`,
    "```",
    stderr.trimEnd(),
    "```",
    ``,
    `---`,
    ``,
    `## Result`,
    exitCode === 0 ? "✅ PASS (Evidence recorded)" : "⚠️ WARNING (Non-zero exit code; evidence recorded)",
    ``,
  ].join("\n");

  fs.writeFileSync(reportPath, report, "utf8");

  const traceObj = {
    kind: "ess_trace",
    ess_version: spec.ess_version,
    skill_id: skillId,
    ess_path: essPath,
    status: exitCode === 0 ? "pass" : "warning",
    started_at_ms: start,
    ended_at_ms: end,
    duration_ms: end - start,
    inputs,
    execution: {
      type: execType,
      runtime,
      entry,
      cmd: cmd.join(" "),
      exit_code: exitCode,
    },
    artifacts: {
      report_file: reportPath,
      trace_file: tracePath,
    },
    governance: spec.governance || {},
  };

  fs.writeFileSync(tracePath, toYAML(traceObj), "utf8");

  console.log(exitCode === 0 ? "✅ ESS RUN PASS" : "⚠️ ESS RUN WARNING");
  console.log(`Report: ${reportPath}`);
  console.log(`Trace:  ${tracePath}`);
  process.exit(0);
}

main();
