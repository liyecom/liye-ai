#!/usr/bin/env node
/**
 * ESS Sweep (WARNING-only)
 *
 * Output:
 * - total ESS count
 * - per-file warning count
 * - Top N debt list
 *
 * Usage:
 *   node .claude/scripts/ess_sweep.mjs --top 20
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

// minimal YAML parser
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
      parent[key] = inside ? inside.split(",").map(s => parseScalar(s.trim())) : [];
    } else {
      parent[key] = parseScalar(rest);
    }
  }

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

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--top") out.top = Number(argv[i+1] || "20");
  }
  return out;
}

async function debtScore(spec) {
  // Debt = missing required fields count
  const required = [
    "ess_version",
    "metadata.skill_id",
    "metadata.name",
    "trigger",
    "input.schema",
    "execution.type",
    "execution.entry",
    "output.contract",
  ];
  let missing = 0;
  const missingKeys = [];

  for (const k of required) {
    if (!pick(spec, k)) {
      missing++;
      missingKeys.push(k);
    }
  }

  // extra debt if execution.type != script (current MVP runner mismatch)
  const execType = pick(spec, "execution.type");
  if (execType && execType !== "script") {
    missing += 2;
    missingKeys.push("execution.type!=script");
  }

  return { debt: missing, missingKeys };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const top = args.top || 20;

  const root = path.resolve(".claude/ess");
  if (!exists(root)) {
    console.log("ℹ️ ESS Sweep INFO: .claude/ess not found. Skipping.");
    process.exit(0);
  }

  const files = walk(root);
  if (files.length === 0) {
    console.log("ℹ️ ESS Sweep INFO: no .ess.yaml found.");
    process.exit(0);
  }

  const rows = [];

  for (const f of files) {
    const raw = readFile(f);
    const spec = raw ? await parseYaml(raw) : {};
    const id = pick(spec, "metadata.skill_id") || "(missing skill_id)";
    const { debt, missingKeys } = await debtScore(spec);
    rows.push({
      path: path.relative(process.cwd(), f),
      skill_id: id,
      debt,
      missing: missingKeys.join(", "),
    });
  }

  const withDebt = rows.filter(r => r.debt > 0).sort((a,b) => b.debt - a.debt);
  const pass = rows.filter(r => r.debt === 0);

  console.log("=== ESS Sweep (WARNING-only) ===");
  console.log(`Root: ${root}`);
  console.log(`Total ESS: ${rows.length}`);
  console.log(`PASS: ${pass.length}`);
  console.log(`With Debt: ${withDebt.length}\n`);

  const show = withDebt.slice(0, top);
  if (show.length > 0) {
    console.log(`Top ${show.length} Debt:`);
    for (let i = 0; i < show.length; i++) {
      const r = show[i];
      console.log(`${String(i+1).padStart(2," ")}. debt=${r.debt} | ${r.skill_id} | ${r.path}`);
      console.log(`    missing: ${r.missing}`);
    }
  } else {
    console.log("✅ No debt. All ESS specs are clean.");
  }

  process.exit(0);
}

main();
