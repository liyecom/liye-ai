#!/usr/bin/env node
/**
 * SFC Patch Missing Keys (WARNING-only)
 * - Adds missing SFC v0.1 required keys into SKILL.md frontmatter
 * - Does NOT rewrite body content
 * - Keeps existing name/description intact
 *
 * Usage:
 *   node .claude/scripts/sfc_patch_missing_keys.mjs --root Skills --skills ui-ux,kaizen,pdf
 *
 * Notes:
 * - If frontmatter is missing, it will create one with minimal safe defaults.
 */

import fs from "fs";
import path from "path";

const REQUIRED_KEYS = [
  "name",
  "description",
  "skeleton",
  "triggers",
  "inputs",
  "outputs",
  "failure_modes",
  "verification",
];

const ALLOWED_SKELETONS = new Set(["workflow", "task", "reference", "capabilities"]);

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}
function writeFileSafe(p, content) {
  fs.writeFileSync(p, content, "utf8");
}

function parseArgs(argv) {
  const args = { root: "Skills", skills: "" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i+1]) args.root = argv[++i];
    else if (a === "--skills" && argv[i+1]) args.skills = argv[++i];
    else if (a === "-h" || a === "--help") {
      console.log(`Usage:
node .claude/scripts/sfc_patch_missing_keys.mjs --root Skills --skills ui-ux,kaizen,pdf
`);
      process.exit(0);
    }
  }
  return args;
}

function walkForSkillMd(rootDir) {
  const results = [];
  const SKIP_DIR = new Set([".git", "node_modules", ".compiled", ".session", "dist", "build", "out", ".next", ".turbo", ".cache"]);
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIR.has(ent.name)) continue;
        walk(full);
      } else if (ent.isFile() && ent.name === "SKILL.md") {
        results.push(full);
      }
    }
  }
  walk(rootDir);
  return results;
}

function extractFrontmatter(md) {
  const trimmed = md.trimStart();
  if (!trimmed.startsWith("---")) return null;
  const lines = trimmed.split("\n");
  let end = -1;
  for (let i = 1; i < Math.min(lines.length, 400); i++) {
    if (lines[i].trim() === "---") { end = i; break; }
  }
  if (end === -1) return null;
  return { fm: lines.slice(1, end).join("\n"), body: lines.slice(end+1).join("\n") };
}

function hasKey(fm, key) {
  const re = new RegExp(`^${key}\\s*:`, "m");
  return re.test(fm);
}

function getKeyValue(fm, key) {
  const re = new RegExp(`^${key}\\s*:\\s*(.+)\\s*$`, "m");
  const m = fm.match(re);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  return v;
}

function skillNameFromPath(skillMdPath) {
  return path.basename(path.dirname(skillMdPath));
}

function normalizeSkillId(s) {
  return String(s || "").trim().toLowerCase();
}

function defaultPatchBlock(skillId, skeletonGuess) {
  const skeleton = ALLOWED_SKELETONS.has(skeletonGuess) ? skeletonGuess : "reference";
  return `
# SFC v0.1 Required Fields
skeleton: "${skeleton}"
triggers:
  commands: ["/${skillId}"]
  patterns: ["${skillId}"]
inputs:
  required: []
  optional: []
outputs:
  artifacts: ["SKILL.md"]
failure_modes:
  - symptom: "Missing required inputs or context"
    recovery: "Provide the missing info and retry"
  - symptom: "Unexpected tool/runtime failure"
    recovery: "Rerun with minimal steps; escalate after 3 failures"
verification:
  evidence_required: true
  how_to_verify: ["node .claude/scripts/sfc_lint.mjs <skill_dir>"]
governance:
  constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
  policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
`.trim();
}

function guessSkeleton(skillId) {
  // lightweight: tool/doc skills tend to be "task"; meta specs are "reference"; builders are "workflow"
  const s = skillId;
  if (["pdf","xlsx","docx","pptx","csv-summarizer"].includes(s)) return "task";
  if (["canvas-design","theme-factory","mcp-builder","artifacts-builder","playwright","kaizen"].includes(s)) return "workflow";
  if (["prompt-engineering","software-architecture","ui-ux","ui-ux-pro-max","content-writer"].includes(s)) return "reference";
  return "reference";
}

function patchSkillFile(skillMdPath, allowSet) {
  const md = readFileSafe(skillMdPath);
  if (!md) return { changed: false, reason: "read_fail" };

  const extracted = extractFrontmatter(md);
  const dir = path.dirname(skillMdPath);
  const skillId = normalizeSkillId(skillNameFromPath(skillMdPath));

  if (allowSet.size > 0 && !allowSet.has(skillId)) {
    return { changed: false, reason: "not_in_scope", skillId };
  }

  let fm = "";
  let body = md;
  let created = false;

  if (!extracted) {
    // create minimal frontmatter without clobbering body
    created = true;
    const titleLine = md.split("\n").find(l => l.trim().length > 0) || "";
    const description = `SFC patched skill. Use when "${skillId}" is relevant.`;
    fm = `name: ${skillId}\ndescription: ${description}`;
    body = md;
  } else {
    fm = extracted.fm;
    body = extracted.body;

    // If name missing, add from dirname
    if (!hasKey(fm, "name")) fm += `\nname: ${skillId}`;
    // If description missing, add safe default
    if (!hasKey(fm, "description")) fm += `\ndescription: SFC patched skill. Use when "${skillId}" is relevant.`;
  }

  // ensure missing required keys get appended
  const missing = REQUIRED_KEYS.filter(k => !hasKey(fm, k));
  if (missing.length === 0 && !created) {
    return { changed: false, reason: "already_ok", skillId };
  }

  // skeleton guess
  const skeletonGuess = guessSkeleton(skillId);

  // only add the missing block for the 6 fields if absent
  const needAnyOfSix = ["skeleton","triggers","inputs","outputs","failure_modes","verification"].some(k => !hasKey(fm, k));
  if (needAnyOfSix) {
    fm += "\n\n" + defaultPatchBlock(skillId, skeletonGuess) + "\n";
  }

  // normalize skeleton if present but invalid
  const skeletonVal = getKeyValue(fm, "skeleton");
  if (skeletonVal && !ALLOWED_SKELETONS.has(String(skeletonVal).toLowerCase())) {
    fm = fm.replace(/^skeleton\s*:\s*.+$/m, `skeleton: "reference"`);
  }

  const rebuilt = `---\n${fm.trim()}\n---\n\n${body.trimStart()}`;
  writeFileSafe(skillMdPath, rebuilt);

  return { changed: true, skillId, created, missing };
}

async function main() {
  const args = parseArgs(process.argv);
  const root = path.resolve(process.cwd(), args.root);
  const allowSet = new Set(
    (args.skills || "")
      .split(",")
      .map(s => normalizeSkillId(s))
      .filter(Boolean)
  );

  if (!fs.existsSync(root)) {
    console.error(`❌ Root not found: ${root}`);
    process.exit(1);
  }

  const skillMdFiles = walkForSkillMd(root);
  const results = [];
  for (const p of skillMdFiles) {
    results.push(patchSkillFile(p, allowSet));
  }

  const changed = results.filter(r => r.changed).length;
  const scoped = results.filter(r => r.reason !== "not_in_scope").length;

  console.log(`✅ SFC Patch DONE (WARNING-only)`);
  console.log(`Root: ${root}`);
  console.log(`Scope skills: ${allowSet.size ? Array.from(allowSet).join(", ") : "(all)"}`);
  console.log(`Scanned: ${skillMdFiles.length} SKILL.md`);
  console.log(`Scoped hits: ${scoped}`);
  console.log(`Changed: ${changed}`);

  const changedList = results.filter(r => r.changed).map(r => r.skillId);
  if (changedList.length) {
    console.log(`Changed skills: ${changedList.join(", ")}`);
  }
}

main().catch(e => {
  console.error("❌ SFC Patch FAILED:", e?.message || e);
  process.exit(1);
});
