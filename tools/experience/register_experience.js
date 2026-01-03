#!/usr/bin/env node
/**
 * Experience Registration Script
 *
 * Purpose: Register completed Track experiences to the experience index
 * Constraint: Only metadata, no content injection, no scoring impact
 *
 * Usage: node register_experience.js <track_id>
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const TRACKS_DIR = path.join(__dirname, "../../tracks");
const INDEX_DIR = path.join(__dirname, "../../memory/experience_index");

function main() {
  const trackId = process.argv[2];

  if (!trackId) {
    console.error("Usage: node register_experience.js <track_id>");
    process.exit(1);
  }

  const trackDir = path.join(TRACKS_DIR, trackId);

  // Check track directory exists
  if (!fs.existsSync(trackDir)) {
    console.error(`Track not found: ${trackId}`);
    process.exit(1);
  }

  // Load experience.yaml
  const experiencePath = path.join(trackDir, "experience.yaml");
  if (!fs.existsSync(experiencePath)) {
    // No experience file - silent exit
    process.exit(0);
  }

  let experience;
  try {
    experience = yaml.load(fs.readFileSync(experiencePath, "utf8"));
  } catch (e) {
    console.error(`Failed to parse experience.yaml: ${e.message}`);
    process.exit(1);
  }

  // Check confidence.human !== "low"
  if (experience.confidence?.human === "low") {
    // Low confidence - silent exit
    process.exit(0);
  }

  // Check checkpoint.yaml exists
  const checkpointPath = path.join(trackDir, "checkpoint.yaml");
  if (!fs.existsSync(checkpointPath)) {
    // No checkpoint - silent exit
    process.exit(0);
  }

  // Load state.yaml to get domain
  const statePath = path.join(trackDir, "state.yaml");
  if (!fs.existsSync(statePath)) {
    console.error(`state.yaml not found for track: ${trackId}`);
    process.exit(1);
  }

  let state;
  try {
    state = yaml.load(fs.readFileSync(statePath, "utf8"));
  } catch (e) {
    console.error(`Failed to parse state.yaml: ${e.message}`);
    process.exit(1);
  }

  const domain = state.domain;
  if (!domain) {
    console.error(`No domain found in state.yaml for track: ${trackId}`);
    process.exit(1);
  }

  // Load or create experience index for domain
  const indexPath = path.join(INDEX_DIR, `${domain}.yaml`);
  let index = { domain, tracks: [] };

  if (fs.existsSync(indexPath)) {
    try {
      index = yaml.load(fs.readFileSync(indexPath, "utf8"));
      if (!index.tracks) {
        index.tracks = [];
      }
    } catch (e) {
      console.error(`Failed to parse index: ${e.message}`);
      process.exit(1);
    }
  }

  // Create index entry (no deduplication per spec)
  const entry = {
    track_id: trackId,
    verdict: experience.outcome?.verdict || "UNKNOWN",
    tags: experience.tags || [],
    confidence: experience.confidence?.human || "unknown"
  };

  // Append entry
  index.tracks.push(entry);

  // Ensure index directory exists
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }

  // Write index file
  try {
    fs.writeFileSync(indexPath, yaml.dump(index, { lineWidth: -1 }));
    console.log(`✓ Registered experience: ${trackId} → ${domain}`);
  } catch (e) {
    console.error(`Failed to write index: ${e.message}`);
    process.exit(1);
  }
}

main();
