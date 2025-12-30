/**
 * Gemini Broker
 * Integrates with Google Gemini CLI for low-cost, high-frequency tasks
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BaseBroker } = require('./interface');
const { BrokerKind } = require('../mission/types');

class GeminiBroker extends BaseBroker {
  id() {
    return 'gemini';
  }

  kind() {
    return BrokerKind.CLI;
  }

  /**
   * Check if gemini CLI is available
   */
  async check() {
    // Try different possible command names
    const commands = ['gemini', 'gemini-cli'];

    for (const cmd of commands) {
      try {
        execSync(`which ${cmd}`, { stdio: 'pipe' });
        this._cliCommand = cmd;
        return { ok: true, detail: `${cmd} CLI found` };
      } catch {
        continue;
      }
    }

    return {
      ok: false,
      detail: 'Gemini CLI not found. Install: npm install -g @anthropics/gemini-cli or pip install gemini-cli',
    };
  }

  /**
   * Run mission with Gemini
   */
  async run(missionDir, options = {}) {
    const { model = 'gemini-2.5-pro', mission, repoRoot } = options;
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

    // Check if gemini is available
    const check = await this.check();
    if (!check.ok) {
      // Fallback to manual mode
      return this._manualFallback(missionDir, prompt, outputsDir);
    }

    // Try to run gemini
    try {
      const result = await this._runGemini(prompt, model, missionDir);
      return result;
    } catch (err) {
      console.error(`Gemini execution failed: ${err.message}`);
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
- Provide a structured, actionable response
- Include references/links in evidence/links.txt if applicable
- Be concise and efficient (this is a cost-optimized broker)

## Task
${mission.objective}

Please complete this task.`;
  }

  async _runGemini(prompt, model, missionDir) {
    return new Promise((resolve, reject) => {
      const outputsDir = path.join(missionDir, 'outputs');
      const answerPath = path.join(outputsDir, 'answer.md');

      console.log('\n🔷 Running Gemini CLI...\n');
      console.log(`   Model: ${model}`);
      console.log(`   Output: ${outputsDir}/answer.md\n`);

      // Gemini CLI command (adjust based on actual CLI interface)
      const child = spawn(this._cliCommand || 'gemini', [
        '--model', model,
        prompt,
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: missionDir,
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code === 0 || output.length > 0) {
          // Save output to answer.md
          fs.writeFileSync(answerPath, `# Answer\n\n${output}`);

          resolve({
            status: 'ok',
            outputs: ['answer.md'],
            evidence: [],
            notes: `Gemini completed with code ${code}`,
          });
        } else {
          reject(new Error(`Gemini exited with code ${code}: ${error}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  _manualFallback(missionDir, prompt, outputsDir) {
    console.log('\n📋 Gemini Manual Mode\n');
    console.log('Gemini CLI is not available or failed.');
    console.log('Please complete the task manually:\n');
    console.log('─'.repeat(60));
    console.log(prompt);
    console.log('─'.repeat(60));
    console.log(`\n📁 Save your answer to: ${outputsDir}/answer.md\n`);

    // Write prompt to a file for reference
    const promptPath = path.join(outputsDir, 'GEMINI_PROMPT.md');
    fs.writeFileSync(promptPath, prompt);
    console.log(`📄 Prompt saved to: ${promptPath}\n`);

    // Create placeholder answer.md
    const answerPath = path.join(outputsDir, 'answer.md');
    if (!fs.existsSync(answerPath)) {
      fs.writeFileSync(answerPath, `# Answer\n\n<!-- Complete your answer here -->\n`);
    }

    return {
      status: 'ok',
      outputs: ['GEMINI_PROMPT.md', 'answer.md'],
      evidence: [],
      notes: 'Manual fallback - please complete the task and save to outputs/answer.md',
    };
  }
}

module.exports = { GeminiBroker };
