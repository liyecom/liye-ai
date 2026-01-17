#!/usr/bin/env node
/**
 * SFC External Plugins Drift Check (WARNING-only)
 *
 * Compares:
 * - baseline lockfile: _meta/skill-factory/external-skills.lock.json
 * - current snapshot from: ~/.claude/skills
 *
 * Output: Added / Removed / Changed (sha256)
 * Exit: always 0 (warning-only)
 */

import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function extractFrontmatter(md) {
  if (!md) return null;
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  return m ? m[1] : null;
}

function getYamlKey(yaml, key) {
  if (!yaml) return null;
  const re = new RegExp(`^\\s*${key}:\\s*(.+)\\s*$`, "m");
  const m = yaml.match(re);
  if (!m) return null;
  return m[1].replace(/^["']|["']$/g, "").trim();
}

function snapshotExternal(externalRoot) {
  if (!exists(externalRoot)) return [];

  const dirs = fs.readdirSync(externalRoot)
    .map(name => path.join(externalRoot, name))
    .filter(p => fs.statSync(p).isDirectory());

  const items = [];
  for (const d of dirs) {
    const skillMd = path.join(d, "SKILL.md");
    if (!exists(skillMd)) continue;

    const md = readFile(skillMd);
    const fm = extractFrontmatter(md);
    const name = getYamlKey(fm, "name") || path.basename(d);
    const version = getYamlKey(fm, "version") || "unknown";

    items.push({
      name,
      version,
      skill_dir: d,
      skill_md_path: skillMd,
      skill_md_sha256: md ? sha256(md) : null,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function toMap(items) {
  const m = new Map();
  for (const it of items) m.set(it.name, it);
  return m;
}

function main() {
  const lockPath = path.resolve("_meta/skill-factory/external-skills.lock.json");
  const baseline = readJson(lockPath);

  if (!baseline) {
    console.log(`⚠️ DRIFT CHECK SKIP: baseline lockfile missing or invalid: ${lockPath}`);
    process.exit(0);
  }

  const externalRoot = baseline.external_root || path.join(os.homedir(), ".claude/skills");
  const currentItems = snapshotExternal(externalRoot);

  const baseItems = (baseline.items || []).map(x => ({
    name: x.name,
    version: x.version || "unknown",
    skill_md_sha256: x.skill_md_sha256 || null,
  }));

  const baseMap = toMap(baseItems);
  const curMap = toMap(currentItems);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [name, cur] of curMap.entries()) {
    if (!baseMap.has(name)) {
      added.push(cur);
      continue;
    }
    const base = baseMap.get(name);
    if ((base.skill_md_sha256 || "") !== (cur.skill_md_sha256 || "")) {
      changed.push({ name, base_sha: base.skill_md_sha256, cur_sha: cur.skill_md_sha256, version: cur.version });
    }
  }

  for (const [name, base] of baseMap.entries()) {
    if (!curMap.has(name)) removed.push(base);
  }

  const hasDrift = added.length || removed.length || changed.length;

  console.log("=== SFC External Drift Check (warning-only) ===");
  console.log(`Baseline: ${lockPath}`);
  console.log(`External Root: ${externalRoot}`);
  console.log(`Now: ${new Date().toISOString()}`);
  console.log("");

  if (!hasDrift) {
    console.log("✅ NO DRIFT: external plugins unchanged.");
    process.exit(0);
  }

  console.log("⚠️ DRIFT DETECTED (non-blocking)");
  console.log("");

  if (added.length) {
    console.log(`+ Added (${added.length})`);
    for (const a of added) console.log(`  - ${a.name}@${a.version}`);
    console.log("");
  }

  if (removed.length) {
    console.log(`- Removed (${removed.length})`);
    for (const r of removed) console.log(`  - ${r.name}@${r.version}`);
    console.log("");
  }

  if (changed.length) {
    console.log(`~ Changed (${changed.length})`);
    for (const c of changed) {
      console.log(`  - ${c.name}@${c.version}`);
      console.log(`    base: ${c.base_sha}`);
      console.log(`    now : ${c.cur_sha}`);
    }
    console.log("");
  }

  console.log("Suggested action:");
  console.log("1) Review drift log");
  console.log("2) If acceptable: regenerate lockfile via node .claude/scripts/sfc_lock_external_plugins.mjs");
  console.log("3) Commit lockfile update");
  process.exit(0);
}

main();
