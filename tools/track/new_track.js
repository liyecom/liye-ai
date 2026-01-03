#!/usr/bin/env node
/**
 * New Track Creation Script
 *
 * Purpose: Create a new Domain-Scoped Track with Experience hints
 * Constraint: Experience hints are READ-ONLY, no injection into state/memory
 *
 * Usage: node new_track.js <track_id> <domain>
 *
 * Example: node new_track.js amz_test_20260102 amazon-advertising
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const TRACKS_DIR = path.join(__dirname, "../../tracks");
const INDEX_DIR = path.join(__dirname, "../../memory/experience_index");

function showExperienceHint(domain) {
  const indexPath = path.join(INDEX_DIR, `${domain}.yaml`);

  if (!fs.existsSync(indexPath)) {
    return;
  }

  let index;
  try {
    index = yaml.load(fs.readFileSync(indexPath, "utf8"));
  } catch (e) {
    return;
  }

  if (!index.tracks || index.tracks.length === 0) {
    return;
  }

  // Output hint (READ-ONLY, no return, no injection)
  console.log("");
  console.log(`ℹ️  Found ${index.tracks.length} relevant past experience(s):`);

  for (const track of index.tracks) {
    console.log(
      `   - ${track.track_id} (verdict: ${track.verdict}, confidence: ${track.confidence})`
    );
  }

  console.log("");
  console.log(
    `   You may review tracks/<track_id>/experience.yaml if useful.`
  );
  console.log("");
}

function createTrack(trackId, domain) {
  const trackDir = path.join(TRACKS_DIR, trackId);

  // Check if track already exists
  if (fs.existsSync(trackDir)) {
    console.error(`Track already exists: ${trackId}`);
    process.exit(1);
  }

  // Create track directory
  fs.mkdirSync(trackDir, { recursive: true });

  // Create state.yaml
  const state = {
    track_id: trackId,
    domain: domain,
    status: "draft",
    current_step: null,
    glossary_version: "v1.0",
    created_at: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(trackDir, "state.yaml"),
    yaml.dump(state, { lineWidth: -1 })
  );

  // Create spec.md template
  const spec = `# ${trackId}

Domain: ${domain}
Glossary Version: v1.0

## Goal
{Description using only glossary terms}

## Constraints
- All metrics must come from glossary
- No undefined terms allowed

## Success Criteria
{Measurable outcomes using glossary metrics}
`;
  fs.writeFileSync(path.join(trackDir, "spec.md"), spec);

  // Create plan.md template
  const plan = `# Execution Plan

{Numbered steps, each referencing glossary terms}

1. Step one...
2. Step two...
`;
  fs.writeFileSync(path.join(trackDir, "plan.md"), plan);

  console.log(`✓ Track created: ${trackId}`);
  console.log(`  Domain: ${domain}`);
  console.log(`  Path: tracks/${trackId}/`);

  // Show Experience hint (READ-ONLY)
  showExperienceHint(domain);
}

function main() {
  const trackId = process.argv[2];
  const domain = process.argv[3];

  if (!trackId || !domain) {
    console.error("Usage: node new_track.js <track_id> <domain>");
    console.error("");
    console.error("Example:");
    console.error(
      "  node new_track.js amz_test_20260102 amazon-advertising"
    );
    process.exit(1);
  }

  // Validate track_id format: <prefix>_<name>_<YYYYMMDD>
  const trackIdPattern = /^[a-z]{3,4}_[a-z0-9_]+_\d{8}$/;
  if (!trackIdPattern.test(trackId)) {
    console.error(
      `Invalid track_id format. Expected: <prefix>_<name>_<YYYYMMDD>`
    );
    console.error(`Example: amz_optimize_ppc_20260102`);
    process.exit(1);
  }

  createTrack(trackId, domain);
}

main();
