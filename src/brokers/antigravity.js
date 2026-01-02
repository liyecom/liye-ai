/**
 * Antigravity Broker
 * Manual broker for cross-browser/cross-tool exploration tasks
 * Generates execution prompts for Antigravity platform
 */

const fs = require('fs');
const path = require('path');
const { BaseBroker } = require('./interface');
const { BrokerKind } = require('../mission/types');

class AntigravityBroker extends BaseBroker {
  id() {
    return 'antigravity';
  }

  kind() {
    return BrokerKind.MANUAL;
  }

  /**
   * Antigravity is always "available" as it's manual
   */
  async check() {
    return {
      ok: true,
      detail: 'Antigravity is a manual broker - prompts will be generated for external execution',
    };
  }

  /**
   * Generate Antigravity execution prompt
   * Does NOT attempt automation - only generates instructions
   */
  async run(missionDir, options = {}) {
    const { mission, repoRoot } = options;
    const outputsDir = path.join(missionDir, 'outputs');
    const evidenceDir = path.join(missionDir, 'evidence');

    // Ensure output directories exist
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

    // Read context and constraints
    const contextPath = path.join(missionDir, 'context.md');
    const constraintsPath = path.join(missionDir, 'constraints.md');
    const context = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, 'utf8') : '';
    const constraints = fs.existsSync(constraintsPath) ? fs.readFileSync(constraintsPath, 'utf8') : '';

    // Generate Antigravity prompt
    const prompt = this._buildAntigravityPrompt(mission, context, constraints, outputsDir, evidenceDir);

    // Write prompt to outputs
    const promptPath = path.join(outputsDir, 'ANTIGRAVITY_PROMPT.md');
    fs.writeFileSync(promptPath, prompt);

    // Print instructions
    console.log('\n🚀 Antigravity Mission Generated\n');
    console.log('This is a manual broker for complex, cross-tool exploration tasks.');
    console.log('Please execute the mission in Antigravity and save results back.\n');
    console.log('─'.repeat(60));
    console.log(`📄 Prompt file: ${promptPath}`);
    console.log(`📁 Save outputs to: ${outputsDir}/`);
    console.log(`📂 Save evidence to: ${evidenceDir}/`);
    console.log('─'.repeat(60));
    console.log('\n📋 Quick Start:');
    console.log('1. Open Antigravity');
    console.log('2. Paste the content from ANTIGRAVITY_PROMPT.md');
    console.log('3. Complete the mission');
    console.log('4. Save deliverables to outputs/');
    console.log('5. Save screenshots/evidence to evidence/');
    console.log(`6. Run: liye mission ingest ${missionDir}\n`);

    return {
      status: 'ok',
      outputs: ['ANTIGRAVITY_PROMPT.md'],
      evidence: [],
      notes: 'Manual execution required - open ANTIGRAVITY_PROMPT.md in Antigravity platform',
    };
  }

  _buildAntigravityPrompt(mission, context, constraints, outputsDir, evidenceDir) {
    const timestamp = new Date().toISOString();

    return `# Antigravity Mission

## Mission ID
${mission.id}

## Generated At
${timestamp}

## Objective
${mission.objective}

## Done Definition
${mission.done_definition || 'Complete the objective and save deliverables'}

---

## Context
${context || 'No additional context provided.'}

---

## Constraints
${constraints || 'No specific constraints.'}

---

## Output Requirements

### Deliverables (Required)
Save all deliverables to:
\`${outputsDir}/\`

Expected outputs:
- answer.md - Main response/findings
- Any additional files relevant to the task

### Evidence (Recommended)
Save evidence to:
\`${evidenceDir}/\`

Recommended evidence:
- screenshots/ - Visual proof of actions
- links.txt - List of URLs visited/referenced
- steps.md - Step-by-step log of actions taken
- recordings/ - Screen recordings if applicable

---

## Execution Notes

1. **Cross-Browser Tasks**: If this involves multiple websites or tools, document each step
2. **Long-Chain Exploration**: Keep a log of your exploration path
3. **External API Calls**: Document any API interactions
4. **Data Collection**: Save raw data before processing

---

## After Completion

Run the following command to ingest results:
\`\`\`bash
liye mission ingest ${mission.id}
\`\`\`

This will:
- Log the artifacts to events.jsonl
- Update the mission index
- Mark the mission as completed

---

## Tags
${(mission.tags || []).join(', ') || 'none'}

## Budget
- Max Steps: ${mission.budget?.maxSteps || 50}
- Max Time: ${mission.budget?.maxTimeMinutes || 30} minutes
`;
  }
}

module.exports = { AntigravityBroker };
