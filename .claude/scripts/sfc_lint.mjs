#!/usr/bin/env node
/**
 * SFC Lint (WARNING-only)
 * Usage:
 *   node .claude/scripts/sfc_lint.mjs <skill_dir>
 *
 * Checks:
 * - SKILL.md exists
 * - Line count <= 500 (warning if exceeds)
 * - YAML frontmatter exists
 * - Required keys exist
 * - skeleton value is allowed
 */

import fs from "fs";
import path from "path";
import {
  checkCompliance,
  extractFrontmatterBlock,
  parseFrontmatter,
} from "./sfc_frontmatter.mjs";

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function main() {
  const skillDir = process.argv[2];
  if (!skillDir) {
    console.log("SFC Lint (WARNING-only)");
    console.log("Usage: node .claude/scripts/sfc_lint.mjs <skill_dir>");
    process.exit(0);
  }

  const absDir = path.resolve(skillDir);
  const skillMdPath = path.join(absDir, "SKILL.md");
  const md = readFileSafe(skillMdPath);

  const warnings = [];

  if (!md) {
    // Check if this is a template directory (not a real skill)
    const templateFile = path.join(absDir, "skill_definition_template.md");
    const isTemplateDir = fs.existsSync(templateFile) || absDir.includes("skill_template");

    if (isTemplateDir) {
      console.log("ℹ️ SFC Lint INFO: This directory looks like a template folder, not a skill folder. Skipping warnings.");
      console.log(`Directory: ${absDir}`);
      process.exit(0);
    }

    warnings.push(`Missing SKILL.md: ${skillMdPath}`);
  } else {
    const lines = md.split("\n").length;
    if (lines > 500) {
      warnings.push(
        `SKILL.md too long (${lines} lines). Consider moving details into references/ (SFC progressive disclosure).`
      );
    }

    const fm = extractFrontmatterBlock(md);
    if (!fm) {
      warnings.push("Missing YAML frontmatter at top of SKILL.md (required by SFC).");
    } else {
      const compliance = checkCompliance(parseFrontmatter(md));
      for (const k of compliance.missing) {
        warnings.push(`Frontmatter missing required key: ${k}`);
      }
      if (!compliance.skeleton) {
        warnings.push("Frontmatter missing 'skeleton' value.");
      } else if (!compliance.skeletonValid) {
        warnings.push(
          `Invalid skeleton: "${compliance.skeleton}". Allowed: workflow | task | reference | capabilities`
        );
      }
    }
  }

  if (warnings.length === 0) {
    console.log("✅ SFC Lint PASS (no warnings)");
    console.log(`Skill Dir: ${absDir}`);
    process.exit(0);
  }

  console.log("⚠️ SFC Lint WARNINGS");
  console.log(`Skill Dir: ${absDir}`);
  for (const w of warnings) {
    console.log(`- ${w}`);
  }

  console.log("\nSuggested Fix (minimal):");
  console.log("1) Ensure SKILL.md exists");
  console.log("2) Add YAML frontmatter with required keys");
  console.log("3) Keep SKILL.md <= 500 lines; move long parts to references/");
  console.log("4) Use skeleton in: workflow/task/reference/capabilities");

  // WARNING-only: always exit 0
  process.exit(0);
}

main();
