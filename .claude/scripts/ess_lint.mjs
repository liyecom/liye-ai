#!/usr/bin/env node
/**
 * ESS Lint (WARNING-only)
 *
 * Checks:
 * - Find .ess.yaml under .claude/ess/**
 * - Validate minimal required fields for ess v0.1
 * - Validate execution.type=script (current runner supports only script)
 * - Validate trigger + input + output.contract exists
 *
 * Usage:
 *   node .claude/scripts/ess_lint.mjs
 */

import fs from "fs";
import path from "path";

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

async function parseYaml(text) {
  try {
    const mod = await import("yaml");
    return mod.parse(text);
  } catch {
    return parseYamlMini(text);
  }
}

// Minimal YAML parser (good enough for our ESS subset)
function parseYamlMini(text) {
  const lines = text.split("\n");
  const root = {};
  const stack = [{ indent: -1, obj: root }];

  function parseScalar(v) {
    const s = v.trim();
    if (s === "true") return true;
    if (s === "false") return false;
    if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;

    const indent = raw.match(/^\s*/)?.[0].length ?? 0;
    const line = raw.trim();

    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    if (line.startsWith("- ")) {
      if (!Array.isArray(parent.__arr)) parent.__arr = [];
      parent.__arr.push(parseScalar(line.slice(2)));
      continue;
    }

    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;

    const key = m[1];
    const rest = m[2];

    if (rest === "") {
      const obj = {};
      parent[key] = obj;
      stack.push({ indent, obj });
    } else if (rest.startsWith("[") && rest.endsWith("]")) {
      const inside = rest.slice(1, -1).trim();
      parent[key] = inside
        ? inside.split(",").map(s => parseScalar(s.trim().replace(/^["']|["']$/g, "")))
        : [];
    } else {
      parent[key] = parseScalar(rest);
    }
  }

  // normalize __arr to arrays when possible
  function normalize(obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object" && !Array.isArray(v)) normalize(v);
    }
    if (obj.__arr && Array.isArray(obj.__arr)) {
      // best-effort: if object only has __arr, caller can use obj.__arr
    }
  }
  normalize(root);

  return root;
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, out);
    else if (it.isFile() && it.name.endsWith(".ess.yaml")) out.push(p);
  }
  return out;
}

function pick(obj, pathStr) {
  const parts = pathStr.split(".");
  let cur = obj;
  for (const k of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}

function warn(list, msg) {
  list.push(msg);
}

async function lintOne(filePath) {
  const raw = readFile(filePath);
  const warnings = [];
  if (!raw) {
    warn(warnings, `Missing file content: ${filePath}`);
    return warnings;
  }

  const spec = await parseYaml(raw);

  // Required
  if (!pick(spec, "ess_version")) warn(warnings, "Missing: ess_version");
  if (!pick(spec, "metadata.skill_id")) warn(warnings, "Missing: metadata.skill_id");
  if (!pick(spec, "metadata.name")) warn(warnings, "Missing: metadata.name");
  if (!pick(spec, "trigger")) warn(warnings, "Missing: trigger");
  if (!pick(spec, "input.schema")) warn(warnings, "Missing: input.schema");
  if (!pick(spec, "execution.type")) warn(warnings, "Missing: execution.type");
  if (!pick(spec, "execution.entry")) warn(warnings, "Missing: execution.entry");
  if (!pick(spec, "output.contract")) warn(warnings, "Missing: output.contract");

  const execType = pick(spec, "execution.type");
  if (execType && execType !== "script") {
    warn(warnings, `Unsupported execution.type for MVP: ${execType} (runner supports script only)`);
  }

  const runtime = pick(spec, "execution.runtime");
  if (execType === "script" && !runtime) {
    warn(warnings, `Missing: execution.runtime (node/python recommended)`);
  }

  // trigger sanity
  const cmds = pick(spec, "trigger.commands");
  const patterns = pick(spec, "trigger.patterns");
  if (!cmds && !patterns) warn(warnings, "trigger must provide commands or patterns");

  return warnings;
}

async function main() {
  const root = path.resolve(".claude/ess");
  if (!exists(root)) {
    console.log("ℹ️ ESS Lint INFO: .claude/ess not found. Skipping.");
    process.exit(0);
  }

  const files = walk(root);
  if (files.length === 0) {
    console.log("ℹ️ ESS Lint INFO: no .ess.yaml files found.");
    process.exit(0);
  }

  let totalWarn = 0;
  console.log(`=== ESS Lint (WARNING-only) ===`);
  console.log(`Root: ${root}`);
  console.log(`Total ESS: ${files.length}\n`);

  for (const f of files) {
    const warnings = await lintOne(f);
    if (warnings.length === 0) {
      console.log(`✅ PASS: ${path.relative(process.cwd(), f)}`);
    } else {
      totalWarn += warnings.length;
      console.log(`⚠️ WARN: ${path.relative(process.cwd(), f)}`);
      for (const w of warnings) console.log(`  - ${w}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`- ESS files: ${files.length}`);
  console.log(`- Total warnings: ${totalWarn}`);
  console.log(`\n✅ ESS Lint DONE (warning-only, never blocks).`);
  process.exit(0);
}

main();
