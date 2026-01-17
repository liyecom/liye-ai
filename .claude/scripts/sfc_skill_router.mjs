#!/usr/bin/env node
// SFC Skill Router (WARNING-only)
// Goal: Input a query or slash-command, recommend best-matching Skill ID
// Sources: Internal Skills, External plugins (read-only)
// Exit: always 0

import fs from "fs";
import path from "path";
import os from "os";

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readFile(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function extractFrontmatter(md) {
  if (!md) return null;
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  return m ? m[1] : null;
}

function parseYamlSimple(yaml) {
  if (!yaml) return {};
  const obj = {};
  const lines = yaml.split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*(.+)\s*$/);
    if (!m) continue;
    const k = m[1].trim();
    const v = m[2].trim().replace(/^["']|["']$/g, "");
    obj[k] = v;
  }
  return obj;
}

function parseTriggers(md) {
  const fm = extractFrontmatter(md);
  if (!fm) return { commands: [], patterns: [] };

  const commands = [];
  const patterns = [];

  const cmdBlock = fm.match(/triggers:\s*[\s\S]*?commands:\s*\[([^\]]*)\]/m);
  if (cmdBlock && cmdBlock[1]) {
    cmdBlock[1].split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean).forEach(x => commands.push(x));
  }

  const patBlock = fm.match(/triggers:\s*[\s\S]*?patterns:\s*\[([^\]]*)\]/m);
  if (patBlock && patBlock[1]) {
    patBlock[1].split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean).forEach(x => patterns.push(x));
  }

  return { commands, patterns };
}

function scoreSkill(query, meta, triggers, namespacePriority = 0) {
  const q = (query || "").trim();
  if (!q) return 0;

  let score = 0;

  if (triggers.commands.includes(q)) score += 100;
  if ((meta.name || "") === q) score += 60;

  for (const p of triggers.patterns) {
    if (!p) continue;
    if (q.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(q.toLowerCase())) {
      score += 40;
      break;
    }
  }

  if ((meta.description || "").toLowerCase().includes(q.toLowerCase())) score += 15;
  score += namespacePriority;

  return score;
}

function loadRegistry() {
  const p = path.resolve(".claude/skills/index.yaml");
  if (!exists(p)) return null;
  return readFile(p);
}

function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.log("Usage: node .claude/scripts/sfc_skill_router.mjs \"your query or /command\"");
    process.exit(0);
  }

  const registryRaw = loadRegistry();
  if (!registryRaw) {
    console.log("Registry missing: .claude/skills/index.yaml");
    process.exit(0);
  }

  const internalRoot = path.resolve("Skills");
  const externalRoot = path.join(os.homedir(), ".claude/skills");

  const candidates = [];

  if (exists(internalRoot)) {
    const files = walk(internalRoot).filter(p => path.basename(p) === "SKILL.md");
    for (const f of files) {
      const md = readFile(f);
      const fm = extractFrontmatter(md);
      const meta = parseYamlSimple(fm || "");
      const triggers = parseTriggers(md || "");
      if (!meta.name) continue;
      candidates.push({
        skill_id: "liye-os:" + meta.name,
        name: meta.name,
        description: meta.description || "",
        path: f,
        triggers,
        namespace_priority: 3,
      });
    }
  }

  if (exists(externalRoot)) {
    const files = walk(externalRoot).filter(p => path.basename(p) === "SKILL.md");
    for (const f of files) {
      const md = readFile(f);
      const fm = extractFrontmatter(md);
      const meta = parseYamlSimple(fm || "");
      const triggers = parseTriggers(md || "");
      if (!meta.name) continue;
      candidates.push({
        skill_id: "external:" + meta.name,
        name: meta.name,
        description: meta.description || "",
        path: f,
        triggers,
        namespace_priority: 1,
      });
    }
  }

  // Alias quick resolution
  const escapedQuery = query.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const aliasMatch = registryRaw.match(new RegExp('"' + escapedQuery + '":\\s*"([^"]+)"'));
  if (aliasMatch && aliasMatch[1]) {
    console.log("ROUTE (alias)");
    console.log("Query: " + query);
    console.log("Skill: " + aliasMatch[1]);
    process.exit(0);
  }

  const ranked = candidates
    .map(c => ({
      ...c,
      score: scoreSkill(query, { name: c.name, description: c.description }, c.triggers, c.namespace_priority),
    }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  console.log("=== SFC Skill Router (recommendation-only) ===");
  console.log("Query: " + query);
  console.log("");

  if (!ranked.length) {
    console.log("No matching skills found.");
    console.log("Suggested action:");
    console.log("1) Try a slash-command like /create-skill");
    console.log("2) Or add triggers.patterns to your target SKILL.md frontmatter");
    process.exit(0);
  }

  console.log("Top matches:");
  for (const r of ranked) {
    console.log("- " + r.skill_id + "  (score=" + r.score + ")");
    console.log("  path: " + r.path);
  }

  console.log("");
  console.log("Recommended: " + ranked[0].skill_id);
  process.exit(0);
}

main();
