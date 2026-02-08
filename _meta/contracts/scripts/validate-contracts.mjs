#!/usr/bin/env node
/**
 * Contracts Validator v1.0.0
 * SSOT: _meta/contracts/scripts/validate-contracts.mjs
 *
 * 校验 3 种类型：
 * 1. Schema 校验：字段类型、required 字段
 * 2. 目录分区校验：策略必须在正确的目录（sandbox/candidate/production/...）
 * 3. Lifecycle 校验：production 目录禁止 require_approval=false 且有写入动作
 *
 * 运行：node _meta/contracts/scripts/validate-contracts.mjs
 * 退出码：0 = 全部通过，1 = 有错误（fail-closed）
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const CONTRACTS_DIR = join(PROJECT_ROOT, '_meta', 'contracts');
const LEARNED_POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errorCount = 0;
let warningCount = 0;
let passCount = 0;

function logError(file, message) {
  console.error(`${RED}❌ ${file}${RESET}: ${message}`);
  errorCount++;
}

function logWarning(file, message) {
  console.warn(`${YELLOW}⚠️  ${file}${RESET}: ${message}`);
  warningCount++;
}

function logPass(file) {
  console.log(`${GREEN}✅ ${file}${RESET}`);
  passCount++;
}

/**
 * 加载 YAML schema
 */
function loadSchema(schemaPath) {
  try {
    const content = readFileSync(schemaPath, 'utf-8');
    return parseYaml(content);
  } catch (e) {
    console.error(`${RED}Failed to load schema: ${schemaPath}${RESET}`);
    console.error(e.message);
    process.exit(1);
  }
}

/**
 * 检查额外字段（additionalProperties: false 强制执行）
 * 递归检查嵌套对象
 */
function checkAdditionalProperties(data, schema, path = '') {
  const errors = [];

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return errors;
  }

  // 获取 schema 中定义的属性
  const schemaProperties = schema.properties || {};
  const allowedKeys = Object.keys(schemaProperties);

  // 检查 additionalProperties 约束
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(data)) {
      if (!allowedKeys.includes(key)) {
        const fieldPath = path ? `${path}.${key}` : key;
        errors.push(`Unknown field '${fieldPath}' not allowed (additionalProperties: false)`);
      }
    }
  }

  // 递归检查嵌套对象
  for (const [key, value] of Object.entries(data)) {
    if (schemaProperties[key] && typeof value === 'object' && value !== null) {
      const nestedSchema = schemaProperties[key];
      const nestedPath = path ? `${path}.${key}` : key;

      if (Array.isArray(value) && nestedSchema.items) {
        // 数组项校验
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            errors.push(...checkAdditionalProperties(item, nestedSchema.items, `${nestedPath}[${index}]`));
          }
        });
      } else if (!Array.isArray(value)) {
        // 对象校验
        errors.push(...checkAdditionalProperties(value, nestedSchema, nestedPath));
      }
    }
  }

  return errors;
}

/**
 * 简单 schema 校验（检查 required 字段 + additionalProperties）
 */
function validateAgainstSchema(data, schema, filePath) {
  const errors = [];
  const requiredFields = schema.required || [];

  for (const field of requiredFields) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 检查额外字段（additionalProperties: false）
  const additionalErrors = checkAdditionalProperties(data, schema);
  errors.push(...additionalErrors);

  // 特殊校验：confidence 必须是数值
  if ('confidence' in data) {
    if (typeof data.confidence !== 'number') {
      errors.push(`Field 'confidence' must be a number (0~1), got: ${typeof data.confidence}`);
    } else if (data.confidence < 0 || data.confidence > 1) {
      errors.push(`Field 'confidence' must be between 0 and 1, got: ${data.confidence}`);
    }
  }

  // 特殊校验：schema_version 必须是 SemVer 格式
  if ('schema_version' in data) {
    if (!/^\d+\.\d+\.\d+$/.test(data.schema_version)) {
      errors.push(`Field 'schema_version' must be SemVer format (x.y.z), got: ${data.schema_version}`);
    }
  }

  // 特殊校验：scope 必须有 type 和 keys
  if ('scope' in data) {
    if (!data.scope.type) {
      errors.push(`Field 'scope.type' is required`);
    }
    if (!data.scope.keys) {
      errors.push(`Field 'scope.keys' is required`);
    }
  }

  // 特殊校验：success_signals 必须有 exec/operator/business
  if ('success_signals' in data) {
    const signals = data.success_signals;
    if (!signals.exec) {
      errors.push(`Field 'success_signals.exec' is required`);
    }
    if (!signals.operator) {
      errors.push(`Field 'success_signals.operator' is required`);
    }
    if (!signals.business) {
      errors.push(`Field 'success_signals.business' is required`);
    }
  }

  return errors;
}

/**
 * 校验目录分区：策略必须在正确的目录
 */
function validateDirectoryPartition(data, filePath) {
  const errors = [];
  const dirName = basename(dirname(filePath));
  const validDirs = ['sandbox', 'candidate', 'production', 'disabled', 'quarantine'];

  if (!validDirs.includes(dirName)) {
    errors.push(`Policy must be in one of: ${validDirs.join(', ')}, found in: ${dirName}`);
    return errors;
  }

  // 校验 validation_status 与目录匹配
  if (data.validation_status && data.validation_status !== dirName) {
    errors.push(
      `Directory mismatch: file in '${dirName}/' but validation_status is '${data.validation_status}'`
    );
  }

  return errors;
}

/**
 * 校验 Lifecycle：production 目录的约束
 */
function validateLifecycle(data, filePath) {
  const errors = [];
  const dirName = basename(dirname(filePath));

  // production 目录特殊规则
  if (dirName === 'production') {
    // 规则 1：如果有写入动作，require_approval 不能为 false
    // 写入动作定义：bid_adjustment, keyword_negation, budget_reallocation
    // 非写入动作（alert, investigate）不受此约束，可 require_approval=false
    const WRITE_ACTIONS = ['bid_adjustment', 'keyword_negation', 'budget_reallocation'];
    const NON_WRITE_ACTIONS = ['alert', 'investigate']; // 仅用于文档，不参与校验

    const writeActionsFound = (data.actions || [])
      .filter((action) => WRITE_ACTIONS.includes(action.action_type))
      .map((action) => action.action_type);

    const hasWriteAction = writeActionsFound.length > 0;

    if (hasWriteAction && data.constraints?.require_approval === false) {
      errors.push(
        `Production policy with write actions (${writeActionsFound.join(', ')}) MUST have 'constraints.require_approval: true'`
      );
    }

    // 规则 2：production 必须有 business success signal
    if (
      data.success_signals?.business?.improvement_pct === null ||
      data.success_signals?.business?.improvement_pct === undefined
    ) {
      // 允许 null（尚未测量），但发出警告
      logWarning(filePath, `Production policy should have measured 'business.improvement_pct'`);
    }

    // 规则 3：production 必须有 evidence
    if (!data.evidence || data.evidence.length === 0) {
      errors.push(`Production policy MUST have at least one evidence item`);
    }
  }

  // sandbox 目录特殊规则
  if (dirName === 'sandbox') {
    // sandbox 策略不应该有 operator approval
    if (data.success_signals?.operator?.approval_count > 0) {
      logWarning(filePath, `Sandbox policy has operator approvals - should be in 'candidate/'`);
    }
  }

  return errors;
}

/**
 * 校验所有 learned policies
 */
function validateLearnedPolicies() {
  console.log('\n📋 Validating Learned Policies...\n');

  const policySchema = loadSchema(join(CONTRACTS_DIR, 'learning', 'learned_policy.schema.yaml'));

  if (!existsSync(LEARNED_POLICIES_DIR)) {
    console.log(`${YELLOW}⚠️  Policies directory not found: ${LEARNED_POLICIES_DIR}${RESET}`);
    return;
  }

  const subdirs = ['sandbox', 'candidate', 'production', 'disabled', 'quarantine'];

  for (const subdir of subdirs) {
    const subdirPath = join(LEARNED_POLICIES_DIR, subdir);

    if (!existsSync(subdirPath)) {
      continue;
    }

    const files = readdirSync(subdirPath).filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml')
    );

    for (const file of files) {
      const filePath = join(subdirPath, file);

      try {
        const content = readFileSync(filePath, 'utf-8');
        const data = parseYaml(content);

        // 1. Schema 校验
        const schemaErrors = validateAgainstSchema(data, policySchema, filePath);

        // 2. 目录分区校验
        const partitionErrors = validateDirectoryPartition(data, filePath);

        // 3. Lifecycle 校验
        const lifecycleErrors = validateLifecycle(data, filePath);

        const allErrors = [...schemaErrors, ...partitionErrors, ...lifecycleErrors];

        if (allErrors.length > 0) {
          for (const error of allErrors) {
            logError(filePath, error);
          }
        } else {
          logPass(filePath);
        }
      } catch (e) {
        logError(filePath, `Failed to parse YAML: ${e.message}`);
      }
    }
  }
}

/**
 * 校验所有 engine manifests
 */
function validateEngineManifests() {
  console.log('\n📋 Validating Engine Manifests...\n');

  const manifestSchema = loadSchema(join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.yaml'));

  // 在当前项目和 AGE 仓库中查找 engine_manifest.yaml
  const searchPaths = [
    PROJECT_ROOT,
    join(PROJECT_ROOT, '..', 'amazon-growth-engine'),
  ];

  for (const searchPath of searchPaths) {
    if (!existsSync(searchPath)) {
      continue;
    }

    const manifestPath = join(searchPath, 'engine_manifest.yaml');

    if (existsSync(manifestPath)) {
      try {
        const content = readFileSync(manifestPath, 'utf-8');
        const data = parseYaml(content);

        const schemaErrors = validateAgainstSchema(data, manifestSchema, manifestPath);

        if (schemaErrors.length > 0) {
          for (const error of schemaErrors) {
            logError(manifestPath, error);
          }
        } else {
          logPass(manifestPath);
        }
      } catch (e) {
        logError(manifestPath, `Failed to parse YAML: ${e.message}`);
      }
    }
  }
}

/**
 * 校验 contracts schemas 自身
 */
function validateContractSchemas() {
  console.log('\n📋 Validating Contract Schemas...\n');

  const schemaFiles = [
    join(CONTRACTS_DIR, 'learning', 'learned_policy.schema.yaml'),
    join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.yaml'),
    join(CONTRACTS_DIR, 'playbook', 'playbook_io.schema.yaml'),
  ];

  for (const schemaFile of schemaFiles) {
    if (!existsSync(schemaFile)) {
      logError(schemaFile, 'Schema file not found');
      continue;
    }

    try {
      const content = readFileSync(schemaFile, 'utf-8');
      const schema = parseYaml(content);

      // 基本结构检查
      if (!schema.$schema) {
        logWarning(schemaFile, 'Missing $schema declaration');
      }
      if (!schema.$id) {
        logWarning(schemaFile, 'Missing $id declaration');
      }
      if (!schema.required || schema.required.length === 0) {
        logWarning(schemaFile, 'No required fields defined');
      }

      logPass(schemaFile);
    } catch (e) {
      logError(schemaFile, `Failed to parse YAML: ${e.message}`);
    }
  }
}

/**
 * 检查 SSOT：确保 learned_policy.schema 只有一个位置
 */
function checkSSOT() {
  console.log('\n📋 Checking SSOT (Single Source of Truth)...\n');

  // 搜索所有 learned_policy.schema 文件
  const findSchemas = (dir, results = []) => {
    if (!existsSync(dir)) return results;

    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          findSchemas(fullPath, results);
        } else if (item.includes('learned_policy') && item.includes('schema')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // 忽略权限错误
    }

    return results;
  };

  const schemaFiles = findSchemas(PROJECT_ROOT);

  if (schemaFiles.length === 0) {
    logError('SSOT', 'No learned_policy.schema found');
  } else if (schemaFiles.length === 1) {
    logPass(`SSOT: learned_policy.schema at ${schemaFiles[0]}`);
  } else {
    logError('SSOT', `Multiple learned_policy.schema files found: ${schemaFiles.join(', ')}`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Contracts Validator v1.0.0');
  console.log('           SSOT: _meta/contracts/**');
  console.log('═══════════════════════════════════════════════════════════');

  // 1. 检查 SSOT
  checkSSOT();

  // 2. 校验 contracts schemas 自身
  validateContractSchemas();

  // 3. 校验 learned policies
  validateLearnedPolicies();

  // 4. 校验 engine manifests
  validateEngineManifests();

  // 汇总
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`           Summary`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ${GREEN}✅ Passed: ${passCount}${RESET}`);
  console.log(`  ${YELLOW}⚠️  Warnings: ${warningCount}${RESET}`);
  console.log(`  ${RED}❌ Errors: ${errorCount}${RESET}`);
  console.log('═══════════════════════════════════════════════════════════');

  // fail-closed: 任何错误都返回 exit 1
  if (errorCount > 0) {
    console.log(`\n${RED}FAILED: ${errorCount} error(s) found. Fix before merge.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}PASSED: All contracts valid.${RESET}\n`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(`${RED}Fatal error: ${e.message}${RESET}`);
  process.exit(1);
});
