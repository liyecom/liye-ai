/**
 * Codex Broker
 * Integrates with OpenAI Codex CLI for GPT-powered tasks
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BaseBroker } = require('./interface');
const { BrokerKind } = require('../mission/types');

class CodexBroker extends BaseBroker {
  id() {
    return 'codex';
  }

  kind() {
    return BrokerKind.CLI;
  }

  /**
   * Check if codex CLI is available
   */
  async check() {
    try {
      execSync('which codex', { stdio: 'pipe' });
      return { ok: true, detail: 'Codex CLI found' };
    } catch {
      return {
        ok: false,
        detail: 'Codex CLI not found. Install: npm install -g @openai/codex',
      };
    }
  }

  /**
   * Run mission with Codex
   */
  async run(missionDir, options = {}) {
    const { model = 'gpt-4.1', mission, repoRoot } = options;
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

    // Check if codex is available
    const check = await this.check();
    if (!check.ok) {
      // Fallback to manual mode
      return this._manualFallback(missionDir, prompt, outputsDir);
    }

    // Try to run codex
    try {
      const result = await this._runCodex(prompt, model, missionDir);
      return result;
    } catch (err) {
      console.error(`Codex execution failed: ${err.message}`);
      return this._manualFallback(missionDir, prompt, outputsDir);
    }
  }

  _buildPrompt(mission, context, constraints, outputsDir) {
    return `# Mission: ${mission.objective}

## Context
${context}

## Constraints
${constraints}

## Output Requirements
- Write your answer to: ${outputsDir}/answer.md
- Include any evidence/references in your response
- Be concise and actionable

## Task
${mission.objective}

Please complete this task and save your response.`;
  }

  async _runCodex(prompt, model, missionDir) {
    return new Promise((resolve, reject) => {
      const outputsDir = path.join(missionDir, 'outputs');

      // Build codex command with approval and sandbox flags
      const args = [
        '--model', model,
        '--approval-mode', 'on-request',
        prompt,
      ];

      console.log('\n🤖 Running Codex CLI...\n');
      console.log(`   Model: ${model}`);
      console.log(`   Approval: on-request`);
      console.log(`   Output: ${outputsDir}/answer.md\n`);

      const child = spawn('codex', args, {
        stdio: 'inherit',
        cwd: missionDir,
      });

      child.on('close', (code) => {
        if (code === 0) {
          const outputs = this._scanOutputs(outputsDir);
          resolve({
            status: outputs.length > 0 ? 'ok' : 'fail',
            outputs,
            evidence: [],
            notes: `Codex completed with code ${code}`,
          });
        } else {
          reject(new Error(`Codex exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  _manualFallback(missionDir, prompt, outputsDir) {
    console.log('\n📋 Codex Manual Mode\n');
    console.log('Codex CLI is not available or failed.');
    console.log('Please complete the task manually:\n');
    console.log('─'.repeat(60));
    console.log(prompt);
    console.log('─'.repeat(60));
    console.log(`\n📁 Save your answer to: ${outputsDir}/answer.md\n`);

    // Write prompt to a file for reference
    const promptPath = path.join(outputsDir, 'CODEX_PROMPT.md');
    fs.writeFileSync(promptPath, prompt);
    console.log(`📄 Prompt saved to: ${promptPath}\n`);

    // Create placeholder answer.md
    const answerPath = path.join(outputsDir, 'answer.md');
    if (!fs.existsSync(answerPath)) {
      fs.writeFileSync(answerPath, `# Answer\n\n<!-- Complete your answer here -->\n`);
    }

    return {
      status: 'ok',
      outputs: ['CODEX_PROMPT.md', 'answer.md'],
      evidence: [],
      notes: 'Manual fallback - please complete the task and save to outputs/answer.md',
    };
  }

  _scanOutputs(outputsDir) {
    if (!fs.existsSync(outputsDir)) return [];
    return fs.readdirSync(outputsDir);
  }
}

module.exports = { CodexBroker };
