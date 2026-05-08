#!/usr/bin/env node
/**
 * BGHS ADR Validation Script
 *
 * Validates ADRs in the BGHS Track format (YAML frontmatter + bolded header
 * fields). Defined by `_meta/EVOLUTION_ROADMAP_2025.md` § BGHS Track.
 *
 * Scope: `_meta/adr/ADR-*.md` files that do NOT start with a numeric prefix
 *        (e.g. ADR-OpenClaw-Capability-Boundary.md).
 *        Legacy numeric-prefix ADRs (ADR-004-*.md) are handled by
 *        validate_adr.mjs (the MaaP validator) and are ignored here.
 *
 * Per-file checks:
 *   1. YAML frontmatter present between two `---` markers.
 *   2. Required keys:
 *      - artifact_scope
 *      - artifact_name
 *      - artifact_role ∈ {doctrine, contract, harvest, component}
 *      - target_layer ∈ {0, 1, 2, 3, cross}
 *      - is_bghs_doctrine ∈ {yes, no, true, false}
 *   3. artifact_name matches filename (`ADR-<artifact_name>.md`).
 *   4. Body has `# ADR` H1 header.
 *   5. `**Status**:` present and ∈ {Proposed, Accepted, Superseded, Rejected, Deprecated}.
 *   6. `**Date**:` present and matches YYYY-MM-DD.
 *   7. Status = Accepted → `**Accepted-Date**:` present and valid date.
 *   8. Status = Superseded → `**Superseded-Date**:` + `**Superseded-By**:` present;
 *      Superseded-By target file must exist.
 *
 * Cross-file checks:
 *   - artifact_name uniqueness across all BGHS ADRs.
 *   - Frontmatter `superseded_by` target file must exist (if set and not "null").
 *
 * Exit 0 = pass. Exit 1 = fail.
 */

import fs from "fs";
import path from "path";
import fg from "fast-glob";

const ADR_DIR = "_meta/adr";
const VALID_ROLES = new Set(["doctrine", "contract", "harvest"]);
const VALID_LAYERS = new Set(["0", "1", "2", "3", "cross", "none"]);
const VALID_BOOL = new Set(["yes", "no", "true", "false"]);
const VALID_STATUS = new Set([
  "Proposed",
  "Accepted",
  "Superseded",
  "Rejected",
  "Deprecated",
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];

function fail(file, msg) {
  errors.push(`[${path.basename(file)}] ${msg}`);
}

/** Parse YAML frontmatter between `---` markers. Returns {meta, body} or null. */
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

function validate(file) {
  const content = fs.readFileSync(file, "utf8");
  const parsed = parseFrontmatter(content);
  if (!parsed) {
    fail(file, "missing YAML frontmatter (expected `---\\n...\\n---\\n` at file head)");
    return null;
  }
  const { meta, body } = parsed;

  // 2. required keys
  for (const k of [
    "artifact_scope",
    "artifact_name",
    "artifact_role",
    "target_layer",
    "is_bghs_doctrine",
  ]) {
    if (!meta[k]) fail(file, `frontmatter missing key: ${k}`);
  }

  if (meta.artifact_role && !VALID_ROLES.has(meta.artifact_role)) {
    fail(
      file,
      `artifact_role invalid: "${meta.artifact_role}" (expected one of ${[...VALID_ROLES].join("/")})`,
    );
  }
  if (meta.target_layer && !VALID_LAYERS.has(String(meta.target_layer))) {
    fail(
      file,
      `target_layer invalid: "${meta.target_layer}" (expected one of ${[...VALID_LAYERS].join("/")})`,
    );
  }
  if (meta.is_bghs_doctrine && !VALID_BOOL.has(String(meta.is_bghs_doctrine))) {
    fail(file, `is_bghs_doctrine invalid: "${meta.is_bghs_doctrine}" (expected yes/no)`);
  }

  // 3. artifact_name matches filename
  const basename = path.basename(file, ".md"); // ADR-OpenClaw-Capability-Boundary
  const expectedName = basename.replace(/^ADR-/, "");
  if (meta.artifact_name && meta.artifact_name !== expectedName) {
    fail(
      file,
      `artifact_name "${meta.artifact_name}" does not match filename-derived "${expectedName}"`,
    );
  }

  // 4. H1 header
  if (!/(^|\n)# ADR/.test(body)) {
    fail(file, "body missing '# ADR' H1 header");
  }

  // 5. Status
  const statusMatch = body.match(/^\*\*Status\*\*:\s*(\S+)/m);
  if (!statusMatch) {
    fail(file, "missing '**Status**:' line");
    return { meta, file };
  }
  const status = statusMatch[1];
  if (!VALID_STATUS.has(status)) {
    fail(
      file,
      `Status invalid: "${status}" (expected one of ${[...VALID_STATUS].join("/")})`,
    );
  }

  // 6. Date
  const dateMatch = body.match(/^\*\*Date\*\*:\s*(\S+)/m);
  if (!dateMatch) {
    fail(file, "missing '**Date**:' line");
  } else if (!DATE_RE.test(dateMatch[1])) {
    fail(file, `Date invalid: "${dateMatch[1]}" (expected YYYY-MM-DD)`);
  }

  // 7. Accepted → Accepted-Date
  if (status === "Accepted") {
    const m = body.match(/^\*\*Accepted-Date\*\*:\s*(\S+)/m);
    if (!m) {
      fail(file, "Accepted status requires '**Accepted-Date**: YYYY-MM-DD' line");
    } else if (!DATE_RE.test(m[1])) {
      fail(file, `Accepted-Date invalid: "${m[1]}" (expected YYYY-MM-DD)`);
    }
  }

  // 8. Superseded → Superseded-Date + Superseded-By + target existence
  if (status === "Superseded") {
    const sdate = body.match(/^\*\*Superseded-Date\*\*:\s*(\S+)/m);
    const sby = body.match(/^\*\*Superseded-By\*\*:\s*`([^`]+)`/m);
    if (!sdate) {
      fail(file, "Superseded status requires '**Superseded-Date**: YYYY-MM-DD' line");
    } else if (!DATE_RE.test(sdate[1])) {
      fail(file, `Superseded-Date invalid: "${sdate[1]}" (expected YYYY-MM-DD)`);
    }
    if (!sby) {
      fail(file, "Superseded status requires '**Superseded-By**: `<path>`' line");
    } else {
      const target = sby[1];
      if (!fs.existsSync(target)) {
        fail(file, `Superseded-By target file does not exist: ${target}`);
      }
    }
  }

  // frontmatter superseded_by target must exist (if a path)
  if (meta.superseded_by && meta.superseded_by !== "null") {
    const v = meta.superseded_by;
    if (v.includes("/") && !fs.existsSync(v)) {
      fail(file, `frontmatter superseded_by target does not exist: ${v}`);
    }
  }

  return { meta, file };
}

function validateLegacySupersede(file) {
  const md = fs.readFileSync(file, "utf8");
  const status = md.match(/\*\*Status\*\*:\s*([^\s*]+)/)?.[1];

  // Only enforce supersede markers when the legacy ADR claims to be Superseded.
  // Active legacy ADRs (Accepted/Proposed) are out of scope; pre-existing missing-status
  // ADRs are pre-PR-2 tech debt left untouched.
  if (status !== "Superseded") return;

  const supersededBy = md.match(/\*\*Superseded-By\*\*:\s*`?([^`\n]+?)`?\s*$/m)?.[1]?.trim();
  const supersededDate = md.match(/\*\*Superseded-Date\*\*:\s*(\S+)/)?.[1];

  if (!supersededBy) {
    fail(file, "legacy ADR marked Superseded but missing **Superseded-By** marker");
  }
  if (!supersededDate || !DATE_RE.test(supersededDate)) {
    fail(file, `legacy ADR marked Superseded but missing or malformed **Superseded-Date** (got "${supersededDate ?? "missing"}")`);
  }
}

function main() {
  const all = fg.sync(`${ADR_DIR}/ADR-*.md`);
  // BGHS format = no numeric prefix after "ADR-"
  const bghsFiles = all.filter((f) => !/\/ADR-\d/.test(f));
  const legacyFiles = all.filter((f) => /\/ADR-\d/.test(f));

  if (legacyFiles.length > 0) {
    console.log(`[BGHS ADR VALIDATION] Legacy supersede-marker check on ${legacyFiles.length} numeric-prefix file(s)...`);
    for (const f of legacyFiles) validateLegacySupersede(f);
  }

  if (bghsFiles.length === 0) {
    if (errors.length > 0) {
      console.error("\n❌ Legacy ADR supersede-marker check FAILED:");
      for (const e of errors) console.error("  - " + e);
      process.exit(1);
    }
    console.log("[BGHS ADR VALIDATION] No BGHS-format ADRs found; nothing to check.");
    process.exit(0);
  }

  console.log(`[BGHS ADR VALIDATION] Checking ${bghsFiles.length} file(s)...`);
  const results = [];
  for (const f of bghsFiles) {
    const r = validate(f);
    if (r) results.push(r);
  }

  // Cross-file uniqueness check
  const nameToFiles = new Map();
  for (const r of results) {
    const n = r.meta.artifact_name;
    if (!n) continue;
    if (!nameToFiles.has(n)) nameToFiles.set(n, []);
    nameToFiles.get(n).push(r.file);
  }
  for (const [name, files] of nameToFiles) {
    if (files.length > 1) {
      errors.push(
        `[cross-file] artifact_name "${name}" appears in multiple files: ${files.map((f) => path.basename(f)).join(", ")}`,
      );
    }
  }

  if (errors.length > 0) {
    console.error("\n❌ BGHS ADR validation FAILED:");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }
  console.log(`✅ All ${bghsFiles.length} BGHS ADR(s) valid.`);
  process.exit(0);
}

main();
