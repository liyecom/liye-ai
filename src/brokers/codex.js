/**
 * Codex Broker
 * Integrates with OpenAI Codex CLI for GPT-powered tasks
 * Default model: gpt-5.2-thinking (mapped to gpt-5.2 for CLI)
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BaseBroker } = require('./interface');
const { BrokerKind, MissionStatus, ErrorCode } = require('../mission/types');
const { getModelAlias, getRouteConfig } = require('../config/load');
const { scanPromptForForbiddenIntents, ForbiddenErrorCode } = require('../config/safety');

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
      return { ok: true, detail: 'Codex CLI found', errorCode: null };
    } catch {
      return {
        ok: false,
        detail: 'Codex CLI not found. Install: npm install -g @openai/codex',
        errorCode: ErrorCode.BROKER_NOT_INSTALLED,
      };
    }
  }

  /**
   * Run mission with Codex
   */
  async run(missionDir, options = {}) {
    const { mission, repoRoot } = options;
    const outputsDir = path.join(missionDir, 'outputs');
    const evidenceDir = path.join(missionDir, 'evidence');

    // Get route config for 'ask' route
    const routeConfig = getRouteConfig(repoRoot, 'ask', {
      model: options.model,
    });

    // Get model (user-intent model may need aliasing)
    const userModel = options.model || routeConfig.model || 'gpt-5.2-thinking';
    const actualModel = getModelAlias(repoRoot, 'codex', userModel);
    const modelMapped = userModel !== actualModel;

    // Ensure output directories exist
    if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
    if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

    // Read context
    const contextPath = path.join(missionDir, 'context.md');
    const constraintsPath = path.join(missionDir, 'constraints.md');
    const context = fs.existsSync(contextPath) ? fs.readFileSync(contextPath, 'utf8') : '';
    const constraints = fs.existsSync(constraintsPath) ? fs.readFileSync(constraintsPath, 'utf8') : '';

    // Build prompt
    const prompt = this._buildPrompt(mission, context, constraints, outputsDir, routeConfig);

    // Safety check: scan for forbidden intents
    const safetyCheck = scanPromptForForbiddenIntents(
      `${mission.objective}\n${context}\n${prompt}`,
      repoRoot
    );
    if (!safetyCheck.safe) {
      console.log(`\n🚫 FORBIDDEN ACTION BLOCKED`);
      console.log(`   Reason: ${safetyCheck.reason}`);
      console.log(`   Alternative: ${safetyCheck.alternative}`);
      console.log('');
      return {
        status: 'fail',
        outputs: [],
        evidence: [],
        notes: safetyCheck.reason,
        error_code: ForbiddenErrorCode,
        model_requested: userModel,
        model_actual: actualModel,
        model_mapped: modelMapped,
      };
    }

    // Check if codex is available
    const check = await this.check();
    if (!check.ok) {
      // Fallback to manual mode
      return this._manualFallback(missionDir, prompt, outputsDir, userModel, actualModel, check.errorCode);
    }

    // Try to run codex
    try {
      const result = await this._runCodex(prompt, actualModel, missionDir, routeConfig);
      result.model_requested = userModel;
      result.model_actual = actualModel;
      result.model_mapped = modelMapped;
      return result;
    } catch (err) {
      console.error(`Codex execution failed: ${err.message}`);
      return this._manualFallback(missionDir, prompt, outputsDir, userModel, actualModel, ErrorCode.UNKNOWN);
    }
  }

  _buildPrompt(mission, context, constraints, outputsDir, routeConfig) {
    const approval = routeConfig.approval || 'semi-auto';
    const sandbox = routeConfig.sandbox || 'read-only';

    return `# Mission: ${mission.objective}

## Context
${context}

## Constraints
${constraints}

## Governance
- Approval Mode: ${approval}
- Sandbox: ${sandbox}

## Output Requirements
- Write your answer to: ${outputsDir}/answer.md
- Include any evidence/references in your response
- Be concise and actionable

## Task
${mission.objective}

Please complete this task and save your response.`;
  }

  async _runCodex(prompt, model, missionDir, routeConfig) {
    return new Promise((resolve, reject) => {
      const outputsDir = path.join(missionDir, 'outputs');
      const approval = routeConfig.approval || 'semi-auto';

      // Build codex command
      // Note: Actual codex CLI may have different args, adjust as needed
      const args = [
        '-m', model,
        prompt,
      ];

      console.log('\n🤖 Running Codex CLI...\n');
      console.log(`   Model: ${model}`);
      console.log(`   Approval: ${approval}`);
      console.log(`   Output: ${outputsDir}/answer.md\n`);

      const startTime = Date.now();

      const child = spawn('codex', args, {
        stdio: 'inherit',
        cwd: missionDir,
      });

      child.on('close', (code) => {
        const runtimeSec = Math.round((Date.now() - startTime) / 1000);

        if (code === 0) {
          const outputs = this._scanOutputs(outputsDir);
          resolve({
            status: 'ok',
            outputs,
            evidence: [],
            notes: `Codex completed with code ${code}`,
            runtime_sec: runtimeSec,
            error_code: null,
          });
        } else {
          // Execution failed but not fatal - return needs_manual
          resolve({
            status: 'needs_manual',
            outputs: [],
            evidence: [],
            notes: `Codex exited with code ${code}`,
            runtime_sec: runtimeSec,
            error_code: ErrorCode.UNKNOWN,
          });
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  _manualFallback(missionDir, prompt, outputsDir, userModel, actualModel, errorCode) {
    console.log('\n📋 Codex Manual Fallback Mode\n');
    console.log('Codex CLI is not available or failed.');
    console.log('Generating manual prompt for completion...\n');

    // Build manual prompt with model info
    const manualPrompt = `${prompt}

---
## Model Information
- Requested: ${userModel}
- Mapped to: ${actualModel}
- Reason: ${userModel !== actualModel ? 'Model alias mapping (see config/brokers.yaml)' : 'Direct model'}

## Instructions
1. Complete the task above
2. Save your answer to: outputs/answer.md
3. Run: liye mission ingest <mission-dir>
`;

    // Write prompt to file
    const promptPath = path.join(outputsDir, 'MANUAL_PROMPT.md');
    fs.writeFileSync(promptPath, manualPrompt);
    console.log(`📄 Manual prompt saved to: ${promptPath}`);
    console.log(`📁 Save your answer to: ${outputsDir}/answer.md`);
    console.log('');

    // Create placeholder answer.md
    const answerPath = path.join(outputsDir, 'answer.md');
    if (!fs.existsSync(answerPath)) {
      fs.writeFileSync(answerPath, `# Answer\n\n<!-- Complete your answer here -->\n<!-- Model: ${userModel} → ${actualModel} -->\n`);
    }

    return {
      status: 'needs_manual',
      outputs: ['MANUAL_PROMPT.md', 'answer.md'],
      evidence: [],
      notes: 'Manual fallback - broker unavailable. Complete the task and run ingest.',
      model_requested: userModel,
      model_actual: actualModel,
      model_mapped: userModel !== actualModel,
      error_code: errorCode,
    };
  }

  _scanOutputs(outputsDir) {
    if (!fs.existsSync(outputsDir)) return [];
    return fs.readdirSync(outputsDir);
  }
}

module.exports = { CodexBroker };
