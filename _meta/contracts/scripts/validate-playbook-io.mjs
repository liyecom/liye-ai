#!/usr/bin/env node
/**
 * Validate Playbook I/O Output
 * SSOT: _meta/contracts/scripts/validate-playbook-io.mjs
 *
 * 校验 playbook 输出是否符合 playbook_io.schema.yaml
 * 用于 CI 和运行时校验
 *
 * 用法:
 *   node validate-playbook-io.mjs --input playbook_io.json
 *   echo '{"playbook_id":"test",...}' | node validate-playbook-io.mjs
 *   node validate-playbook-io.mjs --scan data/traces/
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = join(__dirname, '..');
const SCHEMA_PATH = join(CONTRACTS_DIR, 'playbook', 'playbook_io.schema.yaml');

// ===============================================================
// Schema 加载
// ===============================================================

function loadSchema() {
  if (!existsSync(SCHEMA_PATH)) {
    console.error(`[FATAL] Schema not found: ${SCHEMA_PATH}`);
    process.exit(1);
  }
  return parseYaml(readFileSync(SCHEMA_PATH, 'utf-8'));
}

// ===============================================================
// 校验函数
// ===============================================================

/**
 * 校验 playbook_io 输出
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePlaybookIO(data, schema) {
  const errors = [];

  // 1. 检查必需顶层字段
  const requiredFields = schema.required || ['playbook_id', 'run_id', 'inputs', 'outputs'];
  for (const field of requiredFields) {
    if (!(field in data)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 2. 检查 playbook_id 格式
  if (data.playbook_id && typeof data.playbook_id !== 'string') {
    errors.push(`playbook_id must be a string, got ${typeof data.playbook_id}`);
  }

  // 3. 检查 run_id 格式
  if (data.run_id && typeof data.run_id !== 'string') {
    errors.push(`run_id must be a string, got ${typeof data.run_id}`);
  }

  // 4. 检查 inputs
  if (data.inputs) {
    if (typeof data.inputs !== 'object') {
      errors.push(`inputs must be an object, got ${typeof data.inputs}`);
    } else if (!('hash' in data.inputs)) {
      errors.push(`inputs.hash is required`);
    }
  }

  // 5. 检查 outputs
  if (data.outputs) {
    if (typeof data.outputs !== 'object') {
      errors.push(`outputs must be an object, got ${typeof data.outputs}`);
    } else {
      // 5a. verdict 校验
      const validVerdicts = ['OK', 'WARN', 'CRIT'];
      if (!validVerdicts.includes(data.outputs.verdict)) {
        errors.push(`outputs.verdict must be one of [${validVerdicts.join(', ')}], got '${data.outputs.verdict}'`);
      }

      // 5b. recommendations 校验
      if (!Array.isArray(data.outputs.recommendations)) {
        errors.push(`outputs.recommendations must be an array`);
      } else {
        // 校验每个 recommendation
        for (let i = 0; i < data.outputs.recommendations.length; i++) {
          const rec = data.outputs.recommendations[i];
          const recPrefix = `outputs.recommendations[${i}]`;

          if (!rec.action_type) {
            errors.push(`${recPrefix}.action_type is required`);
          }
          if (typeof rec.confidence !== 'number' || rec.confidence < 0 || rec.confidence > 1) {
            errors.push(`${recPrefix}.confidence must be a number between 0 and 1`);
          }
          if (!rec.dry_run_result || typeof rec.dry_run_result !== 'object') {
            errors.push(`${recPrefix}.dry_run_result is required and must be an object`);
          }

          // 检查 requires_tier
          const validTiers = ['observe', 'recommend', 'execute_limited'];
          if (rec.requires_tier && !validTiers.includes(rec.requires_tier)) {
            errors.push(`${recPrefix}.requires_tier must be one of [${validTiers.join(', ')}]`);
          }
        }
      }

      // 5c. evidence_package_ref 校验
      if (data.outputs.evidence_package_ref && typeof data.outputs.evidence_package_ref !== 'string') {
        errors.push(`outputs.evidence_package_ref must be a string`);
      }
    }
  }

  // 6. 检查 status（如果存在）
  if (data.status) {
    const validStatuses = ['success', 'failed'];
    if (!validStatuses.includes(data.status)) {
      errors.push(`status must be one of [${validStatuses.join(', ')}], got '${data.status}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ===============================================================
// 扫描目录
// ===============================================================

function scanDirectory(dir, schema) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  function scan(currentDir) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (entry === 'playbook_io.json') {
        results.total++;

        try {
          const content = readFileSync(fullPath, 'utf-8');
          const data = JSON.parse(content);
          const validation = validatePlaybookIO(data, schema);

          if (validation.valid) {
            results.passed++;
            console.log(`✅ ${fullPath}`);
          } else {
            results.failed++;
            console.error(`❌ ${fullPath}`);
            for (const error of validation.errors) {
              console.error(`   - ${error}`);
            }
            results.errors.push({ file: fullPath, errors: validation.errors });
          }
        } catch (e) {
          results.failed++;
          console.error(`❌ ${fullPath}: ${e.message}`);
          results.errors.push({ file: fullPath, errors: [e.message] });
        }
      }
    }
  }

  scan(dir);
  return results;
}

// ===============================================================
// CLI
// ===============================================================

function parseArgs(args) {
  const result = {
    inputPath: null,
    scanDir: null
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
      case '-i':
        result.inputPath = args[++i];
        break;
      case '--scan':
      case '-s':
        result.scanDir = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Validate Playbook I/O Output

Usage:
  node validate-playbook-io.mjs [options]

Options:
  --input, -i   Path to playbook_io.json file
  --scan, -s    Directory to scan for playbook_io.json files
  --help, -h    Show this help

Examples:
  node validate-playbook-io.mjs -i output.json
  echo '{"playbook_id":"test",...}' | node validate-playbook-io.mjs
  node validate-playbook-io.mjs --scan data/traces/
`);
        process.exit(0);
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  const schema = loadSchema();

  // 扫描目录模式
  if (options.scanDir) {
    if (!existsSync(options.scanDir)) {
      console.error(`Directory not found: ${options.scanDir}`);
      process.exit(1);
    }

    console.log(`Scanning ${options.scanDir} for playbook_io.json files...`);
    const results = scanDirectory(options.scanDir, schema);

    console.log('');
    console.log('=== Summary ===');
    console.log(`Total: ${results.total}`);
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);

    process.exit(results.failed > 0 ? 1 : 0);
  }

  // 单文件模式
  let inputJson;

  if (options.inputPath) {
    if (!existsSync(options.inputPath)) {
      console.error(`File not found: ${options.inputPath}`);
      process.exit(1);
    }
    inputJson = readFileSync(options.inputPath, 'utf-8');
  } else if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    inputJson = Buffer.concat(chunks).toString('utf-8');
  } else {
    console.error('Error: No input provided. Use --input or pipe JSON to stdin.');
    process.exit(1);
  }

  try {
    const data = JSON.parse(inputJson);
    const result = validatePlaybookIO(data, schema);

    if (result.valid) {
      console.log('✅ Validation passed');
      process.exit(0);
    } else {
      console.error('❌ Validation failed:');
      for (const error of result.errors) {
        console.error(`   - ${error}`);
      }
      process.exit(1);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

// 导出
export { validatePlaybookIO, loadSchema };

// 直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
