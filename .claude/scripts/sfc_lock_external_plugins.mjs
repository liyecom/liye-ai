#!/usr/bin/env node
/**
 * SFC External Plugins Lockfile Generator
 *
 * Scans: ~/.claude/skills/*
 * For each skill folder, record:
 * - skill_dir
 * - SKILL.md sha256
 * - frontmatter name/version if present
 *
 * Output:
 * _meta/skill-factory/external-skills.lock.json
 *
 * WARNING-only, does not modify external plugins.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
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

function main() {
  const home = os.homedir();
  const externalRoot = path.join(home, ".claude/skills");
  const outPath = path.resolve("_meta/skill-factory/external-skills.lock.json");

  if (!exists(externalRoot)) {
    console.log(`SKIP: external root not found -> ${externalRoot}`);
    process.exit(0);
  }

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
      last_seen_at: new Date().toISOString(),
    });
  }

  const lock = {
    lock_version: "1.0",
    generated_at: new Date().toISOString(),
    external_root: externalRoot,
    total_locked: items.length,
    items: items.sort((a, b) => a.name.localeCompare(b.name)),
  };

  fs.writeFileSync(outPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
  console.log(`DONE ✅ External plugins lockfile updated.`);
  console.log(`Path: ${outPath}`);
  console.log(`Total locked: ${lock.total_locked}`);
}

main();
