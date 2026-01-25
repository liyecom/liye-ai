#!/usr/bin/env node

/**
 * reasoning_assets_gate.mjs - CI Gate for Reasoning Assets (v0.2)
 *
 * Validates that all reasoning playbooks conform to schema requirements:
 * 1. YAML files must contain required fields
 * 2. JSON schemas must be valid
 * 3. Playbooks must have observation_id, version, cause_candidates/impact_analysis
 * 4. [v0.2] Rationale must be non-empty for each cause
 * 5. [v0.2] Evidence requirements must be defined for each cause
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation failures found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { parse as parseYaml } from 'yaml';

const CONTRACTS_DIR = 'docs/contracts/reasoning';

// Required fields for observation playbooks
const REQUIRED_OBSERVATION_FIELDS = [
  'observation_id',
  'version'
];

// At least one of these must be present
const REQUIRED_CONTENT_FIELDS = [
  ['cause_candidates', 'impact_analysis']  // observation OR governance style
];

// Recommended fields (warn if missing) - for governance-style playbooks
const RECOMMENDED_FIELDS = [
  'counterfactuals',
  'recommendations'
];

// For observation playbooks with cause_candidates, check nested fields
// cause_candidates[].recommended_actions and cause_candidates[].counterfactuals

let errors = [];
let warnings = [];

/**
 * Recursively find all YAML files in a directory
 */
function findYamlFiles(dir) {
  const files = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...findYamlFiles(fullPath));
      } else if (extname(entry) === '.yaml' || extname(entry) === '.yml') {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Directory doesn't exist yet - not an error during initial setup
  }

  return files;
}

/**
 * Check if file is an observation playbook (vs concept/mapping file)
 */
function isObservationPlaybook(filePath, playbook) {
  // Must be in an observations directory
  if (!filePath.includes('/observations/')) {
    return false;
  }

  // Must have observation_id field
  if (!playbook?.observation_id) {
    return false;
  }

  return true;
}

/**
 * Validate a single playbook YAML file
 */
function validatePlaybook(filePath) {
  const relativePath = filePath.replace(process.cwd() + '/', '');

  try {
    const content = readFileSync(filePath, 'utf-8');
    const playbook = parseYaml(content);

    // Skip non-observation files (concepts.yaml, evidence_fetch_map.yaml, etc.)
    if (!isObservationPlaybook(filePath, playbook)) {
      // Just validate YAML is parseable
      if (!playbook || typeof playbook !== 'object') {
        errors.push(`${relativePath}: Invalid YAML structure`);
      }
      return; // Skip observation-specific validation
    }

    // Check required fields
    for (const field of REQUIRED_OBSERVATION_FIELDS) {
      if (!playbook[field]) {
        errors.push(`${relativePath}: Missing required field '${field}'`);
      }
    }

    // Check at least one content field is present
    for (const fieldGroup of REQUIRED_CONTENT_FIELDS) {
      const hasAny = fieldGroup.some(f => playbook[f]);
      if (!hasAny) {
        errors.push(`${relativePath}: Must have at least one of: ${fieldGroup.join(', ')}`);
      }
    }

    // Check recommended fields (warnings only)
    // For cause_candidates style: check nested fields
    // For impact_analysis style: check top-level fields
    if (playbook.cause_candidates) {
      // Observation-style playbook - recommended fields are nested in causes
      // Skip top-level check, will check nested fields below
    } else {
      // Governance-style playbook - check top-level fields
      for (const field of RECOMMENDED_FIELDS) {
        if (!playbook[field]) {
          warnings.push(`${relativePath}: Missing recommended field '${field}'`);
        }
      }
    }

    // Validate cause_candidates structure if present
    if (playbook.cause_candidates) {
      for (let i = 0; i < playbook.cause_candidates.length; i++) {
        const cause = playbook.cause_candidates[i];
        if (!cause.id) {
          errors.push(`${relativePath}: cause_candidates[${i}] missing 'id'`);
        }
        if (!cause.description) {
          errors.push(`${relativePath}: cause_candidates[${i}] missing 'description'`);
        }

        // [v0.2] Rationale must be non-empty
        if (!cause.rationale || !Array.isArray(cause.rationale) || cause.rationale.length === 0) {
          errors.push(`${relativePath}: cause_candidates[${i}] (${cause.id || 'unknown'}) missing or empty 'rationale' - system cannot explain "why"`);
        }

        // [v0.2] Evidence requirements must be defined
        if (!cause.evidence_requirements || !Array.isArray(cause.evidence_requirements) || cause.evidence_requirements.length === 0) {
          errors.push(`${relativePath}: cause_candidates[${i}] (${cause.id || 'unknown'}) missing 'evidence_requirements' - cannot validate cause without evidence`);
        }

        // [v0.2] Check nested recommended_actions (warn if missing)
        if (!cause.recommended_actions || !Array.isArray(cause.recommended_actions) || cause.recommended_actions.length === 0) {
          warnings.push(`${relativePath}: cause_candidates[${i}] (${cause.id || 'unknown'}) missing 'recommended_actions'`);
        }

        // [v0.2] Check nested counterfactuals (warn if missing)
        if (!cause.counterfactuals || !Array.isArray(cause.counterfactuals) || cause.counterfactuals.length === 0) {
          warnings.push(`${relativePath}: cause_candidates[${i}] (${cause.id || 'unknown'}) missing 'counterfactuals'`);
        }
      }
    }

    // Validate recommendations structure if present
    if (playbook.recommendations) {
      for (let i = 0; i < playbook.recommendations.length; i++) {
        const rec = playbook.recommendations[i];
        if (!rec.action_id) {
          errors.push(`${relativePath}: recommendations[${i}] missing 'action_id'`);
        }
        if (!rec.risk_level) {
          errors.push(`${relativePath}: recommendations[${i}] missing 'risk_level'`);
        }
      }
    }

    // Validate counterfactuals structure if present
    if (playbook.counterfactuals) {
      for (let i = 0; i < playbook.counterfactuals.length; i++) {
        const cf = playbook.counterfactuals[i];
        if (!cf.if) {
          errors.push(`${relativePath}: counterfactuals[${i}] missing 'if'`);
        }
        if (!cf.expected && !cf.expected_decision) {
          errors.push(`${relativePath}: counterfactuals[${i}] missing 'expected' or 'expected_decision'`);
        }
      }
    }

  } catch (e) {
    errors.push(`${relativePath}: Parse error - ${e.message}`);
  }
}

/**
 * Validate JSON schema files
 */
function validateSchemas(dir) {
  const sharedDir = join(dir, '_shared');

  try {
    const files = readdirSync(sharedDir);

    for (const file of files) {
      if (extname(file) === '.json') {
        const filePath = join(sharedDir, file);
        const relativePath = filePath.replace(process.cwd() + '/', '');

        try {
          const content = readFileSync(filePath, 'utf-8');
          JSON.parse(content);
        } catch (e) {
          errors.push(`${relativePath}: Invalid JSON - ${e.message}`);
        }
      }
    }
  } catch {
    // _shared directory doesn't exist yet
  }
}

/**
 * Main validation function
 */
function runGate() {
  console.log('🔍 Reasoning Assets Gate\n');

  // Find and validate all playbooks
  const yamlFiles = findYamlFiles(CONTRACTS_DIR);

  if (yamlFiles.length === 0) {
    console.log('⚠️  No playbook files found in', CONTRACTS_DIR);
    console.log('   This is OK during initial setup.\n');
  } else {
    console.log(`Found ${yamlFiles.length} playbook file(s)\n`);

    for (const file of yamlFiles) {
      validatePlaybook(file);
    }
  }

  // Validate schema files
  validateSchemas(CONTRACTS_DIR);

  // Report results
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    for (const w of warnings) {
      console.log(`   - ${w}`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log('❌ Errors:');
    for (const e of errors) {
      console.log(`   - ${e}`);
    }
    console.log('');
    console.log(`Gate FAILED: ${errors.length} error(s) found`);
    process.exit(1);
  }

  console.log('✅ Gate PASSED: All reasoning assets validated');
  process.exit(0);
}

// Run gate
runGate();
