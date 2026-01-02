/**
 * Claude Broker
 * Integrates with Claude Code (cc) for engineering tasks
 * This is the primary broker for build/ship/refactor operations
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BaseBroker } = require('./interface');
const { BrokerKind } = require('../mission/types');

class ClaudeBroker extends BaseBroker {
  id() {
    return 'claude';
  }

  kind() {
    return BrokerKind.CLI;
  }

  /**
   * Check if claude CLI is available
   */
  async check() {
    try {
      execSync('which claude', { stdio: 'pipe' });
      return { ok: true, detail: 'Claude Code CLI found' };
    } catch {
      return {
        ok: false,
        detail: 'Claude Code CLI not found. This broker requires Claude Code to be installed.',
      };
    }
  }

  /**
   * Run mission with Claude Code
   * Note: Claude Code is interactive, so we generate a prompt for manual execution
   */
  async run(missionDir, options = {}) {
    const { model = 'claude-sonnet-4-20250514', mission, repoRoot } = options;
    const outputsDir = path.join(missionDir, 'outputs');
    const evidenceDir = path.join(missionDir, 'evidence');

    // Ensure output directories exist
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

    // Read context
    const contextPath = path.join(missionDir, 'context.md');
    const constraintsPath = path.join(missionDir, 'constraints.md');
    const context = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, 'utf8') : '';
    const constraints = fs.existsSync(constraintsPath) ? fs.readFileSync(constraintsPath, 'utf8') : '';

    // Build prompt
    const prompt = this._buildPrompt(mission, context, constraints, outputsDir);

    // Check if claude is available
    const check = await this.check();

    // Claude Code is interactive, so we always generate a prompt file
    return this._generateClaudePrompt(missionDir, prompt, outputsDir, check.ok);
  }

  _buildPrompt(mission, context, constraints, outputsDir) {
    return `# Mission: ${mission.objective}

## Context
${context}

## Constraints
${constraints}

## Output Requirements
- Complete the engineering task as specified
- Follow existing code patterns and conventions
- Write clean, maintainable code
- Document any significant decisions

## Task
${mission.objective}

## Done Definition
${mission.done_definition || 'Complete the objective'}
`;
  }

  _generateClaudePrompt(missionDir, prompt, outputsDir, cliAvailable) {
    console.log('\n🟣 Claude Code Mission\n');

    // Write prompt to file
    const promptPath = path.join(outputsDir, 'CLAUDE_PROMPT.md');
    fs.writeFileSync(promptPath, prompt);

    if (cliAvailable) {
      console.log('Claude Code CLI is available.');
      console.log('You can run this mission in Claude Code:\n');
      console.log('─'.repeat(60));
      console.log(`cd ${missionDir}`);
      console.log(`claude`);
      console.log('─'.repeat(60));
      console.log(`\nOr paste the prompt from: ${promptPath}\n`);
    } else {
      console.log('Claude Code CLI not found.');
      console.log('Please open Claude Code and paste the prompt:\n');
      console.log('─'.repeat(60));
      console.log(prompt.slice(0, 500) + '...');
      console.log('─'.repeat(60));
      console.log(`\n📄 Full prompt saved to: ${promptPath}\n`);
    }

    console.log('📁 After completion, results will be in this directory.');
    console.log(`📂 Run: liye mission ingest ${missionDir}\n`);

    return {
      status: 'ok',
      outputs: ['CLAUDE_PROMPT.md'],
      evidence: [],
      notes: 'Claude Code mission prepared - execute in Claude Code and run ingest when done',
    };
  }
}

module.exports = { ClaudeBroker };
