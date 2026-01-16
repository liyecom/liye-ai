#!/usr/bin/env node
/**
 * SFC Sweep (WARNING-only)
 * Batch scan repo for SKILL.md and output Top N "Skill Debt" list.
 *
 * Usage:
 *   node .claude/scripts/sfc_sweep.mjs --root . --limit 20 --out docs/reports/skill-factory/SFC_SWEEP_REPORT.md
 *
 * Output:
 * - Markdown report (Top N debt)
 * - Console summary
 *
 * Debt scoring (v0.1, lightweight):
 * - Missing YAML frontmatter: +60
 * - Missing each required key: +8
 * - Invalid skeleton value: +12
 * - SKILL.md line count > 500: + (3 + ceil((lines-500)/150))
 * - Missing verification evidence_required: +6 (best-effort heuristic)
 *
 * NOTE:
 * - This is intentionally "warning-only" and heuristic-based.
 * - Goal: make skill debt visible and prioritize fixes (Top 20).
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

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".compiled",
  ".session",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  ".cache",
  ".DS_Store",
]);

const SKIP_PATH_PARTS = [
  `${path.sep}docs${path.sep}`,
  `${path.sep}_meta${path.sep}skill_template${path.sep}`,
  `${path.sep}_meta${path.sep}skill-factory${path.sep}`,
  `${path.sep}.claude${path.sep}.compiled${path.sep}`,
  `${path.sep}.claude${path.sep}.session${path.sep}`,
];

function nowString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function shouldSkipDir(dirPath) {
  if (!dirPath) return true;
  for (const part of SKIP_PATH_PARTS) {
    if (dirPath.includes(part)) return true;
  }
  return false;
}

function walkForSkillMd(rootDir) {
  const results = new Set();

  function walk(currentDir) {
    if (shouldSkipDir(currentDir)) return;

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const full = path.join(currentDir, ent.name);

      if (ent.isDirectory()) {
        if (SKIP_DIR_NAMES.has(ent.name)) continue;
        walk(full);
        continue;
      }

      if (ent.isFile() && ent.name === "SKILL.md") {
        results.add(path.dirname(full));
      }
    }
  }

  walk(rootDir);
  return Array.from(results);
}

function extractFrontmatter(md) {
  if (!md) return null;
  const trimmed = md.trimStart();
  if (!trimmed.startsWith("---")) return null;

  const lines = trimmed.split("\n");
  // Find closing --- after first line
  let end = -1;
  for (let i = 1; i < Math.min(lines.length, 300); i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return null;

  const fm = lines.slice(1, end).join("\n");
  return fm;
}

function hasKey(frontmatter, key) {
  // Top-level YAML key existence heuristic: ^key:
  // Also allow indented accidentally? keep strict to top-level to reduce false positives.
  const re = new RegExp(`^${key}\\s*:`, "m");
  return re.test(frontmatter);
}

function getSkeletonValue(frontmatter) {
  const m = frontmatter.match(/^skeleton\s*:\s*(.+)\s*$/m);
  if (!m) return null;
  let v = m[1].trim();
  // strip quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  // normalize
  return v.toLowerCase();
}

function getNameValue(frontmatter) {
  const m = frontmatter.match(/^name\s*:\s*(.+)\s*$/m);
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

function bestEffortVerification(frontmatter, md) {
  // best-effort: check "evidence_required: true" OR "how_to_verify"
  const inFM = /evidence_required\s*:\s*true/i.test(frontmatter || "");
  const howTo = /how_to_verify\s*:/i.test(frontmatter || "");
  // fallback scan in body
  const bodyHasVerify = /\bhow to verify\b/i.test(md || "") || /\bverification\b/i.test(md || "");
  return { evidenceRequired: inFM, hasHowTo: howTo, hasVerifyMention: bodyHasVerify };
}

function scoreSkill(skillDir, rootDir) {
  const skillMdPath = path.join(skillDir, "SKILL.md");
  const md = readFileSafe(skillMdPath);

  const rel = path.relative(rootDir, skillDir);
  const lineCount = md ? md.split("\n").length : 0;

  let debt = 0;
  const warnings = [];
  const missingKeys = [];

  if (!md) {
    debt += 100;
    warnings.push("Missing SKILL.md (unexpected)");
    return {
      skillDir,
      rel,
      name: "(unknown)",
      skeleton: "(unknown)",
      lineCount,
      debt,
      missingKeys,
      warnings,
    };
  }

  const fm = extractFrontmatter(md);
  if (!fm) {
    debt += 60;
    warnings.push("Missing YAML frontmatter");
    for (const k of REQUIRED_KEYS) missingKeys.push(k);
  } else {
    for (const k of REQUIRED_KEYS) {
      if (!hasKey(fm, k)) {
        debt += 8;
        missingKeys.push(k);
      }
    }

    const skeleton = getSkeletonValue(fm);
    if (skeleton && !ALLOWED_SKELETONS.has(skeleton)) {
      debt += 12;
      warnings.push(`Invalid skeleton: ${skeleton}`);
    }

    const v = bestEffortVerification(fm, md);
    // If verification key exists but lacks evidence_required=true & has no how_to_verify, add debt
    if (hasKey(fm, "verification") && !v.evidenceRequired && !v.hasHowTo) {
      debt += 6;
      warnings.push("verification present but missing evidence_required/how_to_verify (best-effort)");
    }
  }

  if (lineCount > 500) {
    const extra = lineCount - 500;
    const add = 3 + Math.ceil(extra / 150);
    debt += add;
    warnings.push(`SKILL.md too long: ${lineCount} lines (>500)`);
  }

  const name = fm ? getNameValue(fm) || "(missing name)" : "(no frontmatter)";
  const skeleton = fm ? getSkeletonValue(fm) || "(missing skeleton)" : "(no frontmatter)";

  // PASS if no debt at all
  const status = debt === 0 ? "PASS" : "DEBT";

  return {
    skillDir,
    rel,
    name,
    skeleton,
    lineCount,
    debt,
    missingKeys,
    warnings,
    status,
  };
}

function toMarkdownTableRow(cols) {
  return `| ${cols.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function buildReport({ rootDir, limit, skills }) {
  const generatedAt = nowString();
  const total = skills.length;
  const passCount = skills.filter((s) => s.debt === 0).length;
  const debtCount = total - passCount;

  const sorted = [...skills].sort((a, b) => {
    if (b.debt !== a.debt) return b.debt - a.debt;
    return b.lineCount - a.lineCount;
  });

  const top = sorted.filter((s) => s.debt > 0).slice(0, limit);

  const lines = [];
  lines.push(`# SFC Sweep Report`);
  lines.push(``);
  lines.push(`- Generated: **${generatedAt}**`);
  lines.push(`- Root: \`${rootDir}\``);
  lines.push(`- Total SKILL.md found: **${total}**`);
  lines.push(`- PASS (0 debt): **${passCount}**`);
  lines.push(`- With debt: **${debtCount}**`);
  lines.push(``);

  lines.push(`## Top ${limit} Skill Debt (Highest → Lowest)`);
  lines.push(``);
  lines.push(toMarkdownTableRow(["Rank", "Debt", "Skill", "Skeleton", "Lines", "Missing Keys", "Path"]));
  lines.push(toMarkdownTableRow(["---", "---", "---", "---", "---", "---", "---"]));

  top.forEach((s, idx) => {
    const missing = s.missingKeys.length ? s.missingKeys.join(", ") : "-";
    lines.push(
      toMarkdownTableRow([
        idx + 1,
        s.debt,
        s.name,
        s.skeleton,
        s.lineCount,
        missing,
        `\`${s.rel}\``,
      ])
    );
  });

  lines.push(``);
  lines.push(`## Notes`);
  lines.push(`- This is **WARNING-only** debt scoring for prioritization, not a gate.`);
  lines.push(`- Fix strategy: start from Top 5, patch missing frontmatter + required keys, then rerun sweep.`);
  lines.push(`- If a skill is intentionally long (>500 lines), move bulky sections into \`references/\` and keep SKILL.md concise (SFC guideline).`);
  lines.push(``);

  lines.push(`## Quick Next Actions (Recommended)`);
  lines.push(`1. Patch **Top 5** debt skills to SFC required frontmatter keys.`);
  lines.push(`2. Rerun sweep and confirm Top 20 debt shrinks.`);
  lines.push(`3. Only after debt stabilizes, consider upgrading lint strictness (future).`);
  lines.push(``);

  return lines.join("\n");
}

function parseArgs(argv) {
  const args = {
    root: ".",
    limit: 20,
    out: "docs/reports/skill-factory/SFC_SWEEP_REPORT.md",
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) {
      args.root = argv[++i];
      continue;
    }
    if (a === "--limit" && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (!Number.isNaN(n) && n > 0) args.limit = n;
      continue;
    }
    if (a === "--out" && argv[i + 1]) {
      args.out = argv[++i];
      continue;
    }
    if (a === "-h" || a === "--help") {
      console.log(`SFC Sweep (WARNING-only)
Usage:
  node .claude/scripts/sfc_sweep.mjs --root . --limit 20 --out docs/reports/skill-factory/SFC_SWEEP_REPORT.md
`);
      process.exit(0);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  const rootDir = path.resolve(process.cwd(), args.root);
  const limit = args.limit;
  const outPath = path.resolve(process.cwd(), args.out);

  if (!fs.existsSync(rootDir)) {
    console.error(`❌ Root does not exist: ${rootDir}`);
    process.exit(1);
  }

  const skillDirs = walkForSkillMd(rootDir);

  const skills = skillDirs.map((d) => scoreSkill(d, rootDir));

  const report = buildReport({ rootDir, limit, skills });

  // Ensure output directory exists
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, report, "utf8");

  const total = skills.length;
  const passCount = skills.filter((s) => s.debt === 0).length;
  const debtCount = total - passCount;

  const sorted = [...skills].sort((a, b) => {
    if (b.debt !== a.debt) return b.debt - a.debt;
    return b.lineCount - a.lineCount;
  });

  const top = sorted.filter((s) => s.debt > 0).slice(0, limit);

  console.log(`✅ SFC Sweep DONE (WARNING-only)`);
  console.log(`Root: ${rootDir}`);
  console.log(`Total SKILL.md: ${total}`);
  console.log(`PASS: ${passCount}`);
  console.log(`With Debt: ${debtCount}`);
  console.log(`Report: ${outPath}`);
  console.log(``);
  console.log(`Top ${limit} Debt Summary:`);
  top.forEach((s, idx) => {
    const miss = s.missingKeys.length ? ` missing=[${s.missingKeys.join(", ")}]` : "";
    console.log(`${idx + 1}. debt=${s.debt} lines=${s.lineCount} skill=${s.name} path=${s.rel}${miss}`);
  });
}

main().catch((e) => {
  console.error("❌ SFC Sweep FAILED:", e?.message || e);
  process.exit(1);
});
