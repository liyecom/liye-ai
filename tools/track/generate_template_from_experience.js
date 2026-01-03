#!/usr/bin/env node
/**
 * Generate Track Template from Experience
 *
 * Purpose: Create structural skeleton from existing Track
 * Constraint: SKELETON ONLY - no content, no binding, no auto-execution
 *
 * Usage: node generate_template_from_experience.js <source_track_id> <new_track_id>
 */

const fs = require("fs");
const path = require("path");

const TRACKS_DIR = path.join(__dirname, "../../tracks");

/**
 * Extract section headers from spec.md
 * Returns only structural elements, no content
 */
function extractSpecSkeleton(specContent) {
  const lines = specContent.split("\n");
  const headers = [];

  for (const line of lines) {
    // Match markdown headers (##, ###, etc.)
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      headers.push({
        level: headerMatch[1].length,
        title: headerMatch[2].trim()
      });
    }
  }

  // Generate skeleton spec
  let skeleton = "# Spec\n\n";

  for (const header of headers) {
    if (header.level === 1) continue; // Skip title
    const prefix = "#".repeat(header.level);
    skeleton += `${prefix} ${header.title}\n`;
    skeleton += "<!-- Define content here -->\n\n";
  }

  // Ensure minimum structure if no headers found
  if (headers.length <= 1) {
    skeleton = `# Spec

## Goal
<!-- Define the objective -->

## Constraints
<!-- Define boundaries -->

## Non-Goals
<!-- Explicitly state what is NOT included -->
`;
  }

  return skeleton;
}

/**
 * Extract step titles from plan.md
 * Returns only step names, no details
 */
function extractPlanSkeleton(planContent) {
  const lines = planContent.split("\n");
  const steps = [];

  for (const line of lines) {
    // Match numbered steps in various formats:
    // - "1. Step name"
    // - "### 1. Step name"
    // - "## 1. Step name"
    const stepMatch = line.match(/^(?:#{1,4}\s+)?(\d+)\.\s+(.+)$/);
    if (stepMatch) {
      steps.push({
        number: parseInt(stepMatch[1]),
        title: stepMatch[2].trim()
      });
    }
  }

  // Generate skeleton plan
  let skeleton = "# Plan\n\n";

  if (steps.length > 0) {
    for (const step of steps) {
      skeleton += `${step.number}. ${step.title}\n`;
      skeleton += "   <!-- Describe intent -->\n\n";
    }
  } else {
    // Default structure if no steps found
    skeleton = `# Plan

1. Step 1
   <!-- Describe intent -->

2. Step 2
   <!-- Describe intent -->

3. Step 3
   <!-- Describe intent -->
`;
  }

  return skeleton;
}

function main() {
  const sourceTrackId = process.argv[2];
  const newTrackId = process.argv[3];

  if (!sourceTrackId || !newTrackId) {
    console.error(
      "Usage: node generate_template_from_experience.js <source_track_id> <new_track_id>"
    );
    console.error("");
    console.error("Example:");
    console.error(
      "  node generate_template_from_experience.js amz_optimize_ppc_20260101 amz_new_campaign_20260103"
    );
    process.exit(1);
  }

  const sourceDir = path.join(TRACKS_DIR, sourceTrackId);
  const targetDir = path.join(TRACKS_DIR, newTrackId);

  // Validate source track exists
  if (!fs.existsSync(sourceDir)) {
    console.error(`Source track not found: ${sourceTrackId}`);
    process.exit(1);
  }

  // Validate source has experience.yaml (must be from experience)
  const experiencePath = path.join(sourceDir, "experience.yaml");
  if (!fs.existsSync(experiencePath)) {
    console.error(`Source track has no experience.yaml: ${sourceTrackId}`);
    console.error("Templates can only be generated from completed tracks with experience.");
    process.exit(1);
  }

  // Check target doesn't already exist
  if (fs.existsSync(targetDir)) {
    console.error(`Target track already exists: ${newTrackId}`);
    process.exit(1);
  }

  // Read source spec.md
  const specPath = path.join(sourceDir, "spec.md");
  let specContent = "";
  if (fs.existsSync(specPath)) {
    specContent = fs.readFileSync(specPath, "utf8");
  }

  // Read source plan.md
  const planPath = path.join(sourceDir, "plan.md");
  let planContent = "";
  if (fs.existsSync(planPath)) {
    planContent = fs.readFileSync(planPath, "utf8");
  }

  // Generate skeletons (structure only, no content)
  const specSkeleton = extractSpecSkeleton(specContent);
  const planSkeleton = extractPlanSkeleton(planContent);

  // Create target directory
  fs.mkdirSync(targetDir, { recursive: true });

  // Write skeleton files ONLY (no state.yaml, workflow.yaml, etc.)
  fs.writeFileSync(path.join(targetDir, "spec.md"), specSkeleton);
  fs.writeFileSync(path.join(targetDir, "plan.md"), planSkeleton);

  // Output confirmation
  console.log(
    `✓ Track template generated from experience: ${sourceTrackId}`
  );
  console.log("");
  console.log("New Track (skeleton only):");
  console.log(`- tracks/${newTrackId}/spec.md`);
  console.log(`- tracks/${newTrackId}/plan.md`);
  console.log("");
  console.log("⚠️  This is a TEMPLATE.");
  console.log("No domain, glossary, or experience has been applied.");
}

main();
