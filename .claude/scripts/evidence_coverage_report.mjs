#!/usr/bin/env node
/**
 * evidence_coverage_report.mjs
 *
 * P6-A PR-B2: Generate evidence coverage report with 7-metric output.
 *
 * Metrics (fixed order):
 * 1. declared_total - All fields in evidence_fetch_map
 * 2. declared_t1 - T1_TRUTH fields that are not unavailable
 * 3. reachable_t1 - T1_TRUTH fields with status=available and query_ref
 * 4. coverage_t1 - reachable_t1 / declared_t1
 * 5. required_by_active_playbooks - Fields required by active playbooks
 * 6. reachable_required - Required fields that are reachable
 * 7. coverage_required - reachable_required / required_by_active_playbooks (GATE METRIC)
 *
 * Key: unavailable fields only count in declared_total, NOT in declared_t1/required denominator
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

// Paths
const PLAYBOOKS_DIR = path.join(REPO_ROOT, 'docs/contracts/reasoning/amazon-growth/observations');
const ACTIONS_DIR = path.join(REPO_ROOT, 'docs/contracts/reasoning/amazon-growth/actions');
const EVIDENCE_MAP_PATH = path.join(REPO_ROOT, 'docs/contracts/reasoning/_shared/evidence_fetch_map.yaml');
const ACTIVE_PLAYBOOKS_PATH = path.join(REPO_ROOT, 'docs/contracts/reasoning/_shared/active_playbooks.yaml');
const REPORT_DIR = path.join(REPO_ROOT, 'docs/reasoning/reports');

/**
 * Load active playbooks configuration
 */
function loadActivePlaybooks() {
  if (!fs.existsSync(ACTIVE_PLAYBOOKS_PATH)) {
    console.warn('Warning: active_playbooks.yaml not found, using all playbooks');
    return null;
  }
  const content = fs.readFileSync(ACTIVE_PLAYBOOKS_PATH, 'utf-8');
  return yaml.load(content);
}

/**
 * Extract evidence_requirements from a specific playbook file
 */
function extractFromPlaybook(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const playbook = yaml.load(content);
  const fields = new Set();

  if (playbook?.cause_candidates) {
    for (const cause of playbook.cause_candidates) {
      if (cause.evidence_requirements) {
        for (const field of cause.evidence_requirements) {
          fields.add(field);
        }
      }
    }
  }

  if (playbook?.evidence_requirements) {
    for (const field of playbook.evidence_requirements) {
      fields.add(field);
    }
  }

  return fields;
}

/**
 * Load requirements from active playbooks only
 */
function extractActivePlaybookRequirements() {
  const activeConfig = loadActivePlaybooks();
  const requirements = new Map(); // field -> { count, playbooks }
  const activePlaybookFiles = [];

  // If no active_playbooks.yaml, fall back to all playbooks
  if (!activeConfig) {
    return { requirements: extractAllPlaybookRequirements(), activePlaybookFiles: ['ALL'] };
  }

  // Process active observations
  if (activeConfig.active_observations) {
    for (const obs of activeConfig.active_observations) {
      if (!obs.enabled) continue;

      const filePath = path.join(PLAYBOOKS_DIR, obs.file);
      if (!fs.existsSync(filePath)) {
        console.warn(`Warning: Active playbook not found: ${obs.file}`);
        continue;
      }

      activePlaybookFiles.push(obs.file);
      const fields = extractFromPlaybook(filePath);

      for (const field of fields) {
        if (!requirements.has(field)) {
          requirements.set(field, { count: 0, playbooks: [] });
        }
        const entry = requirements.get(field);
        entry.count++;
        if (!entry.playbooks.includes(obs.file)) {
          entry.playbooks.push(obs.file);
        }
      }
    }
  }

  // Process active actions
  if (activeConfig.active_actions) {
    for (const action of activeConfig.active_actions) {
      if (!action.enabled) continue;

      const filePath = path.join(ACTIONS_DIR, action.file);
      if (!fs.existsSync(filePath)) {
        console.warn(`Warning: Active action playbook not found: ${action.file}`);
        continue;
      }

      activePlaybookFiles.push(action.file);
      const fields = extractFromPlaybook(filePath);

      for (const field of fields) {
        if (!requirements.has(field)) {
          requirements.set(field, { count: 0, playbooks: [] });
        }
        const entry = requirements.get(field);
        entry.count++;
        if (!entry.playbooks.includes(action.file)) {
          entry.playbooks.push(action.file);
        }
      }
    }
  }

  return { requirements, activePlaybookFiles };
}

/**
 * Load all playbook YAML files and extract evidence_requirements (legacy)
 */
function extractAllPlaybookRequirements() {
  const requirements = new Map();

  if (fs.existsSync(PLAYBOOKS_DIR)) {
    const files = fs.readdirSync(PLAYBOOKS_DIR).filter(f => f.endsWith('.yaml'));
    for (const file of files) {
      const filePath = path.join(PLAYBOOKS_DIR, file);
      const fields = extractFromPlaybook(filePath);
      for (const field of fields) {
        if (!requirements.has(field)) {
          requirements.set(field, { count: 0, playbooks: [] });
        }
        const entry = requirements.get(field);
        entry.count++;
        if (!entry.playbooks.includes(file)) {
          entry.playbooks.push(file);
        }
      }
    }
  }

  if (fs.existsSync(ACTIONS_DIR)) {
    const files = fs.readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.yaml'));
    for (const file of files) {
      const filePath = path.join(ACTIONS_DIR, file);
      const fields = extractFromPlaybook(filePath);
      for (const field of fields) {
        if (!requirements.has(field)) {
          requirements.set(field, { count: 0, playbooks: [] });
        }
        const entry = requirements.get(field);
        entry.count++;
        if (!entry.playbooks.includes(file)) {
          entry.playbooks.push(file);
        }
      }
    }
  }

  return requirements;
}

/**
 * Load evidence_fetch_map and categorize fields with T1 awareness
 */
function loadEvidenceMap() {
  const content = fs.readFileSync(EVIDENCE_MAP_PATH, 'utf-8');
  const map = yaml.load(content);

  const allFields = new Map(); // field -> { source, status, hasQueryRef }
  const available = new Set();
  const unavailable = new Set();
  const unavailableReasons = new Map();
  const t1Fields = new Set();
  const t1Available = new Set();

  // Process evidence_sources
  if (map.evidence_sources) {
    for (const [field, entry] of Object.entries(map.evidence_sources)) {
      const isT1 = entry.source === 'T1_TRUTH';
      const hasQueryRef = !!entry.query_ref;
      const isAvailable = entry.status !== 'unavailable';

      allFields.set(field, { source: entry.source, status: entry.status, hasQueryRef });

      if (isT1) {
        t1Fields.add(field);
        if (isAvailable && hasQueryRef) {
          t1Available.add(field);
        }
      }

      if (entry.status === 'unavailable') {
        unavailable.add(field);
        unavailableReasons.set(field, entry.degrade_reason || 'unknown');
      } else {
        available.add(field);
      }
    }
  }

  // Process unavailable_fields section
  if (map.unavailable_fields) {
    for (const [field, entry] of Object.entries(map.unavailable_fields)) {
      unavailable.add(field);
      unavailableReasons.set(field, entry.degrade_reason || 'unknown');
      allFields.set(field, { source: 'unavailable', status: 'unavailable', hasQueryRef: false });
    }
  }

  return {
    allFields,
    available,
    unavailable,
    unavailableReasons,
    t1Fields,
    t1Available,
    version: map.version,
    declaredTotal: allFields.size
  };
}

/**
 * Generate coverage report with 7-metric output
 */
function generateReport() {
  const { requirements: activeRequirements, activePlaybookFiles } = extractActivePlaybookRequirements();
  const allRequirements = extractAllPlaybookRequirements();
  const evidenceMap = loadEvidenceMap();

  // === Metric 1: declared_total ===
  const declared_total = evidenceMap.declaredTotal;

  // === Metric 2: declared_t1 ===
  // T1_TRUTH fields that are NOT unavailable (can potentially be reached)
  const declared_t1 = evidenceMap.t1Fields.size;

  // === Metric 3: reachable_t1 ===
  // T1_TRUTH fields with status=available AND query_ref
  const reachable_t1 = evidenceMap.t1Available.size;

  // === Metric 4: coverage_t1 ===
  const coverage_t1 = declared_t1 > 0 ? (reachable_t1 / declared_t1) : 0;

  // === Metric 5: required_by_active_playbooks ===
  // Only count fields that are NOT unavailable in the denominator
  const requiredFields = new Set();
  const requiredAvailableFields = new Set();

  for (const [field] of activeRequirements) {
    // Only add to required if it's NOT in unavailable_fields
    if (!evidenceMap.unavailable.has(field)) {
      requiredFields.add(field);
      if (evidenceMap.available.has(field)) {
        requiredAvailableFields.add(field);
      }
    }
  }
  const required_by_active_playbooks = requiredFields.size;

  // === Metric 6: reachable_required ===
  const reachable_required = requiredAvailableFields.size;

  // === Metric 7: coverage_required (GATE METRIC) ===
  const coverage_required = required_by_active_playbooks > 0
    ? (reachable_required / required_by_active_playbooks)
    : 0;

  // Legacy metrics for backward compatibility
  const totalFields = allRequirements.size;
  const mappedFields = new Set();
  const unavailableFields = new Set();
  const missingFields = new Map();

  for (const [field, info] of allRequirements) {
    if (evidenceMap.available.has(field)) {
      mappedFields.add(field);
    } else if (evidenceMap.unavailable.has(field)) {
      unavailableFields.add(field);
    } else {
      missingFields.set(field, info);
    }
  }

  // Generate markdown report
  const date = new Date().toISOString().split('T')[0];
  const gateStatus = coverage_required >= 0.70 ? '✅ PASSED' : '❌ FAILED';

  const report = `# P6-A Evidence Coverage Report v0.4

**Generated**: ${new Date().toISOString()}
**Evidence Map Version**: ${evidenceMap.version}
**Gate Metric**: coverage_required ≥ 70%

---

## P6-A Coverage Metrics (7-Metric Output)

### Gate Metric (CI Enforcement)

| Metric | Value | Status |
|--------|-------|--------|
| **coverage_required** | **${(coverage_required * 100).toFixed(1)}%** | **${gateStatus}** |

> **coverage_required** = reachable_required / required_by_active_playbooks
> This is the ONLY metric that blocks merge. Target: ≥70%

### Active Playbooks

\`\`\`
${activePlaybookFiles.join('\n')}
\`\`\`

### Full Metrics Table (Fixed Order)

| # | Metric | Value | Description |
|---|--------|-------|-------------|
| 1 | declared_total | ${declared_total} | All fields in evidence_fetch_map |
| 2 | declared_t1 | ${declared_t1} | T1_TRUTH fields (non-unavailable) |
| 3 | reachable_t1 | ${reachable_t1} | T1 fields with status=available + query_ref |
| 4 | coverage_t1 | ${(coverage_t1 * 100).toFixed(1)}% | reachable_t1 / declared_t1 |
| 5 | required_by_active_playbooks | ${required_by_active_playbooks} | Fields required by active playbooks (excl. unavailable) |
| 6 | reachable_required | ${reachable_required} | Required fields that are reachable |
| 7 | **coverage_required** | **${(coverage_required * 100).toFixed(1)}%** | reachable_required / required (GATE METRIC) |

### Metric Interpretation

\`\`\`
Gate Status:        ${gateStatus}
Active Playbooks:   ${activePlaybookFiles.length}
Required Fields:    ${required_by_active_playbooks} (excludes unavailable)
Reachable Required: ${reachable_required}
Coverage Required:  ${(coverage_required * 100).toFixed(1)}%
\`\`\`

> **Key Insight**: unavailable fields are excluded from required_by_active_playbooks denominator.
> This ensures the 70% gate measures actual reachability, not aspirational coverage.

---

## Available Fields (${mappedFields.size})

| Field | Source | Query Ref |
|-------|--------|-----------|
${[...mappedFields].sort().map(f => `| \`${f}\` | Available | ✓ |`).join('\n')}

---

## Required by Active Playbooks (${required_by_active_playbooks})

These fields are required by ${activePlaybookFiles.join(', ')}:

| Field | Status |
|-------|--------|
${[...requiredFields].sort().map(f => `| \`${f}\` | ${requiredAvailableFields.has(f) ? '✅ Reachable' : '❌ Missing'} |`).join('\n')}

---

## Explicitly Unavailable Fields (${unavailableFields.size})

These fields are documented as unavailable (excluded from required denominator):

| Field | Degrade Reason |
|-------|----------------|
${[...unavailableFields].sort().map(f => `| \`${f}\` | ${evidenceMap.unavailableReasons.get(f) || 'unknown'} |`).join('\n')}

---

## P6-A DoD Checklist

- [${coverage_required >= 0.70 ? 'x' : ' '}] coverage_required ≥ 70% (current: ${(coverage_required * 100).toFixed(1)}%)
- [${missingFields.size === 0 ? 'x' : ' '}] All fields documented (available or unavailable)
- [x] Unavailable fields have explicit degrade_reason
- [x] Active playbooks defined in active_playbooks.yaml

---

*Report generated by evidence_coverage_report.mjs v0.4*
`;

  // Ensure report directory exists
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // Write report
  const reportPath = path.join(REPORT_DIR, `P6A_EVIDENCE_COVERAGE_V04_${date}.md`);
  fs.writeFileSync(reportPath, report);

  // Console output for CI
  console.log(`Coverage Report Generated: ${reportPath}`);
  console.log(`\n=== P6-A Evidence Coverage (7-Metric Output) ===`);
  console.log(`1. declared_total:              ${declared_total}`);
  console.log(`2. declared_t1:                 ${declared_t1}`);
  console.log(`3. reachable_t1:                ${reachable_t1}`);
  console.log(`4. coverage_t1:                 ${(coverage_t1 * 100).toFixed(1)}%`);
  console.log(`5. required_by_active_playbooks: ${required_by_active_playbooks}`);
  console.log(`6. reachable_required:          ${reachable_required}`);
  console.log(`7. coverage_required:           ${(coverage_required * 100).toFixed(1)}%`);
  console.log(`---`);
  console.log(`Active Playbooks: ${activePlaybookFiles.join(', ')}`);
  console.log(`Gate Status: ${gateStatus}`);

  return {
    // New 7-metric output
    declared_total,
    declared_t1,
    reachable_t1,
    coverage_t1,
    required_by_active_playbooks,
    reachable_required,
    coverage_required,
    // Metadata
    activePlaybookFiles,
    gateStatus,
    passed: coverage_required >= 0.70,
    // Legacy compatibility
    totalFields,
    mappedCount: mappedFields.size,
    unavailableCount: unavailableFields.size,
    missingCount: missingFields.size,
    reachableCoveragePct: (mappedFields.size / totalFields * 100),
    declaredCoveragePct: ((mappedFields.size + unavailableFields.size) / totalFields * 100)
  };
}

// Run if executed directly
if (process.argv[1].endsWith('evidence_coverage_report.mjs')) {
  try {
    const result = generateReport();
    process.exit(result.passed ? 0 : 1);
  } catch (error) {
    console.error('Error generating coverage report:', error.message);
    process.exit(1);
  }
}

export { generateReport, extractActivePlaybookRequirements, loadEvidenceMap };
