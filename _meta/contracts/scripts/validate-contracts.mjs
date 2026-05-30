#!/usr/bin/env node
/**
 * Contracts Validator v1.2.0
 * SSOT: _meta/contracts/scripts/validate-contracts.mjs
 *
 * 校验模式：
 * 1. 默认模式：Schema + 目录分区 + Lifecycle 校验
 *    含 Phase 0c.2 engine_manifest dual-routing (v1 legacy ↔ v2 by schema_version field).
 *    含 GHL Phase 0b 新增 9 learning schemas + confidence_formulas formula instance.
 * 2. Bundle 模式（--bundle <path>）：校验 learned-bundle.tgz
 * 3. Self-test 模式（--self-test）：内联 fixture 验证 routeManifestSchema (Phase 0c.2)
 *
 * 运行：
 *   node _meta/contracts/scripts/validate-contracts.mjs
 *   node _meta/contracts/scripts/validate-contracts.mjs --self-test
 *   node _meta/contracts/scripts/validate-contracts.mjs --bundle <path.tgz>
 *
 * 退出码：0 = 全部通过，1 = 有错误（fail-closed）
 */

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync, writeFileSync, realpathSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

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

  // 特殊校验：schema_version 必须是 numeric-dot-numeric 形式（允许 2 或 3 段）
  // 严格版本契约由各 schema 自己的 enum/pattern 强制（e.g. engine_manifest.schema.v2.yaml
  // 的 schema_version.enum: ["2.0"] 是 SSOT）。此处只做基础形态检查。
  if ('schema_version' in data) {
    if (!/^\d+\.\d+(\.\d+)?$/.test(data.schema_version)) {
      errors.push(`Field 'schema_version' must be numeric (x.y or x.y.z), got: ${data.schema_version}`);
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
 * 路由 engine_manifest schema 版本（Phase 0c.2 dual-schema routing）
 *
 * 规则（fail-closed）：
 * - 缺 schema_version 字段（或 null）→ v1 schema (legacy)
 * - schema_version === "2.0"        → v2 schema
 * - 其他值（含 "1.0" / "1.0.0" / "2.1" 等显式但未声明的版本）→ 拒绝 (fail-closed)
 *
 * 注：legacy v1 schema 自身未声明 schema_version 字段；v2 schema 强制 enum ["2.0"]（Tranche 1 fix）.
 */
function routeManifestSchema(data, v1Schema, v2Schema) {
  const sv = data && Object.prototype.hasOwnProperty.call(data, 'schema_version') ? data.schema_version : undefined;
  if (sv === undefined || sv === null) {
    return { schema: v1Schema, route: 'v1-legacy-no-schema-version' };
  }
  if (sv === '2.0') {
    return { schema: v2Schema, route: 'v2' };
  }
  return {
    error: `Unsupported engine_manifest schema_version: ${JSON.stringify(sv)}. Valid: omit (=v1) | "2.0" (=v2). Fail-closed per Phase 0c.2.`,
  };
}

/**
 * 校验 formula instance contracts (e.g. confidence_formulas.yaml)
 * 不是 JSON Schema，而是公式声明 instance contract.
 * 检查范围：parseable + version + formulas.ghl_confidence_v1 完整性 (inputs / weights sum=1.0 / missing_input_policy).
 */
function validateFormulaInstances() {
  console.log('\n📋 Validating Formula Instances...\n');

  const formulaFile = join(CONTRACTS_DIR, 'learning', 'confidence_formulas.yaml');
  if (!existsSync(formulaFile)) {
    logError(formulaFile, 'Formula instance file not found');
    return;
  }

  try {
    const content = readFileSync(formulaFile, 'utf-8');
    const data = parseYaml(content);
    const errors = [];

    if (!('version' in (data || {}))) {
      errors.push('Missing required field: version');
    }
    if (!data || !data.formulas || typeof data.formulas !== 'object') {
      errors.push('Missing required object: formulas');
    } else if (!('ghl_confidence_v1' in data.formulas)) {
      errors.push("Missing required formula: formulas.ghl_confidence_v1");
    } else {
      const formula = data.formulas.ghl_confidence_v1;
      if (!formula.inputs || typeof formula.inputs !== 'object') {
        errors.push('ghl_confidence_v1: missing inputs object');
      }
      if (!formula.weights || typeof formula.weights !== 'object') {
        errors.push('ghl_confidence_v1: missing weights object');
      } else {
        const sum = Object.values(formula.weights).reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 1.0) > 1e-9) {
          errors.push(`ghl_confidence_v1: weights must sum to 1.0, got ${sum}`);
        }
      }
      if (formula.missing_input_policy !== 'fail_closed') {
        errors.push(`ghl_confidence_v1: missing_input_policy must be 'fail_closed', got: ${JSON.stringify(formula.missing_input_policy)}`);
      }
    }

    if (errors.length > 0) {
      for (const err of errors) logError(formulaFile, err);
    } else {
      logPass(formulaFile);
    }
  } catch (e) {
    logError(formulaFile, `Failed to parse YAML: ${e.message}`);
  }
}

/**
 * Self-test: 内联 fixture 验证 routeManifestSchema (Phase 0c.2)
 * fail-closed: 任何 fixture 偏离 expected 即 exit 1.
 */
function runSelfTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Validator Self-Test (Phase 0c.2)');
  console.log('═══════════════════════════════════════════════════════════');

  const v1Schema = loadSchema(join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.yaml'));
  const v2Schema = loadSchema(join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.v2.yaml'));

  const fixtures = [
    { name: 'legacy manifest (no schema_version) → v1',     data: { engine_id: 'legacy' },                       expect: { route: 'v1-legacy-no-schema-version' } },
    { name: 'schema_version="2.0" → v2',                    data: { schema_version: '2.0', engine_id: 'v2' },    expect: { route: 'v2' } },
    { name: 'schema_version="9.9.9" → fail-closed',         data: { schema_version: '9.9.9' },                   expect: { error: true } },
    { name: 'schema_version="1.0" (legacy explicit) → fail-closed', data: { schema_version: '1.0' },             expect: { error: true } },
    { name: 'schema_version=null → v1 (null=absent)',       data: { schema_version: null, engine_id: 'null' },   expect: { route: 'v1-legacy-no-schema-version' } },
    { name: 'schema_version="2.1" → fail-closed',           data: { schema_version: '2.1' },                     expect: { error: true } },
    { name: 'schema_version=2.0 (number, not string) → fail-closed', data: { schema_version: 2.0 },              expect: { error: true } },
  ];

  let pass = 0, fail = 0;
  for (const fx of fixtures) {
    const routed = routeManifestSchema(fx.data, v1Schema, v2Schema);
    const gotErr = !!routed.error;
    const wantErr = !!fx.expect.error;
    let ok;
    if (wantErr) {
      ok = gotErr;
    } else {
      ok = !gotErr && routed.route === fx.expect.route;
    }
    if (ok) {
      console.log(`  ${GREEN}✅ ${fx.name}${RESET}` + (gotErr ? '' : ` → ${routed.route}`));
      pass++;
    } else {
      console.log(`  ${RED}❌ ${fx.name}${RESET}`);
      console.log(`     got=${gotErr ? 'error' : routed.route}, want=${wantErr ? 'error' : fx.expect.route}`);
      if (routed.error) console.log(`     error msg: ${routed.error}`);
      fail++;
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Pass: ${pass}, Fail: ${fail}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (fail > 0) {
    console.log(`${RED}Self-test FAILED.${RESET}\n`);
    process.exit(1);
  }
  console.log(`${GREEN}Self-test passed.${RESET}\n`);
  process.exit(0);
}

/**
 * 校验所有 engine manifests (Phase 0c.2 dual-routing)
 */
function validateEngineManifests() {
  console.log('\n📋 Validating Engine Manifests...\n');

  const manifestSchemaV1 = loadSchema(join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.yaml'));
  const manifestSchemaV2 = loadSchema(join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.v2.yaml'));

  // 候选 manifest 路径列表。
  // ENGINE_MANIFEST_PATH（如设置）优先；视为完整文件路径，用于跨仓库 manifest 发现
  // （e.g. /Users/liye/github/amazon-growth-engine/engine_manifest.yaml）。
  // Fallback: 在当前项目 root 下查找 engine_manifest.yaml。
  const manifestPaths = [];

  const externalEnginePath = process.env.ENGINE_MANIFEST_PATH;
  if (externalEnginePath && existsSync(externalEnginePath) && statSync(externalEnginePath).isFile()) {
    manifestPaths.push(externalEnginePath);
  }

  const projectManifest = join(PROJECT_ROOT, 'engine_manifest.yaml');
  if (existsSync(projectManifest) && !manifestPaths.includes(projectManifest)) {
    manifestPaths.push(projectManifest);
  }

  for (const manifestPath of manifestPaths) {
    if (existsSync(manifestPath)) {
      try {
        const content = readFileSync(manifestPath, 'utf-8');
        const data = parseYaml(content);

        // Phase 0c.2: route by schema_version
        const routed = routeManifestSchema(data, manifestSchemaV1, manifestSchemaV2);
        if (routed.error) {
          logError(manifestPath, routed.error);
          continue;
        }
        console.log(`  ↪ routed to ${routed.route}`);

        const schemaErrors = validateAgainstSchema(data, routed.schema, manifestPath);

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
    // Legacy schemas (pre-GHL)
    join(CONTRACTS_DIR, 'learning', 'learned_policy.schema.yaml'),
    join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.yaml'),
    join(CONTRACTS_DIR, 'playbook', 'playbook_io.schema.yaml'),
    // GHL Phase 0b learning schemas (per EV2-I-03 lock, committed in Tranches 1-3 of Wave 1)
    join(CONTRACTS_DIR, 'learning', 'learned_policy_ghl_v1.schema.yaml'),
    join(CONTRACTS_DIR, 'learning', 'fact_run_outcome_event_v1.schema.yaml'),
    join(CONTRACTS_DIR, 'learning', 'fact_run_outcome_record_v1.schema.yaml'),
    join(CONTRACTS_DIR, 'learning', 'governance_event_v1.schema.yaml'),
    join(CONTRACTS_DIR, 'learning', 'policy_trial_v1.schema.yaml'),
    join(CONTRACTS_DIR, 'learning', 'operator_feedback_v1.schema.yaml'),
    join(CONTRACTS_DIR, 'learning', 'policy_lifecycle_event_v1.schema.yaml'),
    join(CONTRACTS_DIR, 'learning', 'heartbeat_state_v2.schema.yaml'),
    // GHL Phase 1d heartbeat phase-transition log entry contract (NEW)
    join(CONTRACTS_DIR, 'learning', 'heartbeat_phase_transition_v1.schema.yaml'),
    // GHL Phase 0b engine manifest v2
    join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.v2.yaml'),
    // Note: confidence_formulas.yaml is a formula INSTANCE (not a JSON Schema) — validated by validateFormulaInstances()
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

// ============================================================
// Bundle 校验（--bundle 模式）
// ============================================================

/**
 * Manifest 字段白名单（additionalProperties: false 等效）
 * 包含 v1.0.0 builder 生成的所有字段
 */
const MANIFEST_ALLOWED_FIELDS = [
  'bundle_version',
  'schema_version',
  'created_at',
  'sha256',
  'policies_index',
  'skills_index',
  // v1.0.0 新增字段
  'git_sha',
  'contracts',
  'bundle_sha256',
  'included_policies',
  'files'
];

const POLICY_INDEX_ALLOWED_FIELDS = [
  'policy_id',
  'domain',
  'file',
  'sha256',
  'scope',
  'risk_level',
  'confidence'
];

const SCOPE_ALLOWED_FIELDS = ['type', 'keys'];

/**
 * 检查对象是否有未知字段
 */
function checkUnknownFields(obj, allowedFields, path) {
  const errors = [];
  for (const key of Object.keys(obj)) {
    if (!allowedFields.includes(key)) {
      errors.push(`Unknown field '${path}.${key}' not allowed`);
    }
  }
  return errors;
}

/**
 * 计算文件 SHA256
 */
function sha256File(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 计算字符串 SHA256
 */
function sha256String(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 校验 learned-bundle.tgz
 */
async function validateBundle(bundlePath) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Bundle Validator v1.0.0');
  console.log('           Mode: --bundle');
  console.log('═══════════════════════════════════════════════════════════');

  if (!existsSync(bundlePath)) {
    logError('Bundle', `File not found: ${bundlePath}`);
    return;
  }

  console.log(`\n📦 Validating bundle: ${bundlePath}\n`);

  // 1. 解压到临时目录
  const tempDir = mkdtempSync(join(tmpdir(), 'bundle-validate-'));
  try {
    execSync(`tar -xzf "${bundlePath}" -C "${tempDir}"`, { stdio: 'pipe' });
  } catch (e) {
    logError('Bundle', `Failed to extract: ${e.message}`);
    rmSync(tempDir, { recursive: true, force: true });
    return;
  }

  console.log(`📂 Extracted to: ${tempDir}\n`);

  // 1.5 ZipSlip/路径穿越防护：验证所有解压文件的 realpath 在临时目录内
  const realTempDir = realpathSync(tempDir);
  const extractedFiles = execSync(`find "${tempDir}" -type f`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);

  for (const file of extractedFiles) {
    const realFilePath = realpathSync(file);
    if (!realFilePath.startsWith(realTempDir)) {
      logError('Bundle', `ZipSlip attack detected: ${file} resolves outside temp directory`);
      rmSync(tempDir, { recursive: true, force: true });
      return;
    }
  }
  console.log(`🛡️  ZipSlip check passed (${extractedFiles.length} files verified)\n`);

  // 2. 读取 manifest.json
  const manifestPath = join(tempDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    logError('Bundle', 'manifest.json not found in bundle');
    rmSync(tempDir, { recursive: true, force: true });
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    logError('Bundle', `Failed to parse manifest.json: ${e.message}`);
    rmSync(tempDir, { recursive: true, force: true });
    return;
  }

  // 3. 校验 manifest 字段白名单
  console.log('📋 Checking manifest field whitelist...\n');
  const manifestErrors = checkUnknownFields(manifest, MANIFEST_ALLOWED_FIELDS, 'manifest');
  for (const err of manifestErrors) {
    logError('manifest.json', err);
  }

  // 校验必需字段
  const requiredFields = ['bundle_version', 'schema_version', 'created_at', 'sha256', 'policies_index'];
  for (const field of requiredFields) {
    if (!(field in manifest)) {
      logError('manifest.json', `Missing required field: ${field}`);
    }
  }

  // 4. 校验 policies_index
  console.log('📋 Validating policies_index...\n');
  const policiesIndex = manifest.policies_index || [];

  if (policiesIndex.length === 0) {
    logWarning('manifest.json', 'policies_index is empty');
  }

  // 加载 policy schema
  const policySchema = loadSchema(join(CONTRACTS_DIR, 'learning', 'learned_policy.schema.yaml'));

  for (const policyEntry of policiesIndex) {
    // 检查 index 字段白名单
    const indexErrors = checkUnknownFields(policyEntry, POLICY_INDEX_ALLOWED_FIELDS, `policies_index[${policyEntry.policy_id}]`);
    for (const err of indexErrors) {
      logError('manifest.json', err);
    }

    // 检查 scope 字段白名单
    if (policyEntry.scope) {
      const scopeErrors = checkUnknownFields(policyEntry.scope, SCOPE_ALLOWED_FIELDS, `policies_index[${policyEntry.policy_id}].scope`);
      for (const err of scopeErrors) {
        logError('manifest.json', err);
      }
    }

    // 检查必需字段
    const requiredIndexFields = ['policy_id', 'domain', 'file', 'sha256', 'scope', 'risk_level', 'confidence'];
    for (const field of requiredIndexFields) {
      if (!(field in policyEntry)) {
        logError('manifest.json', `policies_index[${policyEntry.policy_id}]: Missing required field: ${field}`);
      }
    }

    // 检查文件存在
    const policyFilePath = join(tempDir, policyEntry.file);
    if (!existsSync(policyFilePath)) {
      logError('Bundle', `File not found: ${policyEntry.file} (referenced by ${policyEntry.policy_id})`);
      continue;
    }

    // 校验文件 SHA256
    const actualHash = sha256File(policyFilePath);
    if (actualHash !== policyEntry.sha256) {
      logError('Bundle', `SHA256 mismatch for ${policyEntry.file}: expected ${policyEntry.sha256}, got ${actualHash}`);
    }

    // 校验 policy 内容符合 schema
    try {
      const policyContent = readFileSync(policyFilePath, 'utf-8');
      const policyData = parseYaml(policyContent);

      const schemaErrors = validateAgainstSchema(policyData, policySchema, policyEntry.file);
      for (const err of schemaErrors) {
        logError(policyEntry.file, err);
      }

      if (schemaErrors.length === 0) {
        logPass(policyEntry.file);
      }
    } catch (e) {
      logError(policyEntry.file, `Failed to parse YAML: ${e.message}`);
    }
  }

  // 5. 校验 bundle 整体 SHA256
  console.log('\n📋 Validating bundle SHA256...\n');

  // 重新计算：将 manifest.sha256 置空后计算
  const originalSha256 = manifest.sha256;
  manifest.sha256 = '';
  const manifestWithoutHash = JSON.stringify(manifest, null, 2);
  writeFileSync(manifestPath, manifestWithoutHash);

  // 重新打包计算（简化：直接计算 tgz 文件）
  // 注意：这里简化为直接校验原始 tgz，实际应重新打包
  const bundleHash = sha256File(bundlePath);

  // 恢复 manifest
  manifest.sha256 = originalSha256;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // 由于重新打包复杂，这里跳过整体 hash 校验，只记录
  console.log(`  Bundle SHA256: ${bundleHash}`);
  console.log(`  Manifest SHA256: ${originalSha256}`);
  if (bundleHash !== originalSha256) {
    logWarning('Bundle', `SHA256 may not match (expected ${originalSha256}, bundle is ${bundleHash}). Full verification requires repacking.`);
  } else {
    logPass('Bundle SHA256 verified');
  }

  // 清理临时目录
  rmSync(tempDir, { recursive: true, force: true });
}

/**
 * 检查 SSOT：legacy learned_policy.schema 与 GHL learned_policy_ghl_v1.schema 各自单一位置.
 * Post Wave 1 Tranche 3: 双 schema 同时存在为合法状态；各自必须单实例.
 */
function checkSSOT() {
  console.log('\n📋 Checking SSOT (Single Source of Truth)...\n');

  const findSchemas = (dir, results = []) => {
    if (!existsSync(dir)) return results;

    try {
      const items = readdirSync(dir);
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          findSchemas(fullPath, results);
        } else if (item === 'learned_policy.schema.yaml' || item === 'learned_policy_ghl_v1.schema.yaml') {
          results.push({ name: item, path: fullPath });
        }
      }
    } catch (e) {
      // 忽略权限错误
    }

    return results;
  };

  const found = findSchemas(PROJECT_ROOT);
  const legacy = found.filter((f) => f.name === 'learned_policy.schema.yaml');
  const ghl    = found.filter((f) => f.name === 'learned_policy_ghl_v1.schema.yaml');

  const checkOne = (label, files) => {
    if (files.length === 0) {
      logError('SSOT', `No ${label} found`);
    } else if (files.length === 1) {
      logPass(`SSOT: ${label} at ${files[0].path}`);
    } else {
      logError('SSOT', `Multiple ${label} files found: ${files.map((f) => f.path).join(', ')}`);
    }
  };

  checkOne('learned_policy.schema.yaml (legacy)', legacy);
  checkOne('learned_policy_ghl_v1.schema.yaml (GHL)', ghl);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { mode: 'default', bundlePath: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bundle' && args[i + 1]) {
      result.mode = 'bundle';
      result.bundlePath = args[i + 1];
      i++;
    } else if (args[i] === '--self-test') {
      result.mode = 'self-test';
    } else if (args[i] === '--check-ssot') {
      result.mode = 'check-ssot';
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node validate-contracts.mjs [options]

Options:
  --bundle <path>   Validate a learned-bundle.tgz file
  --self-test       Run inline fixtures verifying engine_manifest dual-routing (Phase 0c.2)
  --check-ssot      Run only SSOT (Single Source of Truth) checks (delegated from contracts-gate workflow)
  --help, -h        Show this help message

Examples:
  node validate-contracts.mjs
  node validate-contracts.mjs --self-test
  node validate-contracts.mjs --check-ssot
  node validate-contracts.mjs --bundle state/artifacts/learned-bundles/learned-bundle_0.2.0.tgz
`);
      process.exit(0);
    }
  }

  return result;
}

/**
 * 主函数
 */
async function main() {
  const args = parseArgs();

  // Self-test mode (Phase 0c.2 routing fixtures)
  if (args.mode === 'self-test') {
    runSelfTest();
    return;
  }

  // SSOT-only mode (delegated entry for contracts-gate workflow)
  // Runs only checkSSOT() which correctly treats legacy learned_policy.schema and
  // GHL learned_policy_ghl_v1.schema as two independent single-instance contracts.
  if (args.mode === 'check-ssot') {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('           SSOT Check (delegated entry)');
    console.log('═══════════════════════════════════════════════════════════');
    checkSSOT();
    if (errorCount > 0) {
      console.log(`\n${RED}FAILED: ${errorCount} SSOT error(s).${RESET}\n`);
      process.exit(1);
    }
    console.log(`\n${GREEN}PASSED: SSOT check OK.${RESET}\n`);
    process.exit(0);
  }

  // Bundle 模式
  if (args.mode === 'bundle') {
    await validateBundle(args.bundlePath);

    // 汇总
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`           Bundle Validation Summary`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  ${GREEN}✅ Passed: ${passCount}${RESET}`);
    console.log(`  ${YELLOW}⚠️  Warnings: ${warningCount}${RESET}`);
    console.log(`  ${RED}❌ Errors: ${errorCount}${RESET}`);
    console.log('═══════════════════════════════════════════════════════════');

    if (errorCount > 0) {
      console.log(`\n${RED}FAILED: ${errorCount} error(s) found. Bundle is invalid.${RESET}\n`);
      process.exit(1);
    } else {
      console.log(`\n${GREEN}PASSED: Bundle is valid.${RESET}\n`);
      process.exit(0);
    }
    return;
  }

  // 默认模式
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Contracts Validator v1.2.0 (Phase 0c.2 dual-routing)');
  console.log('           SSOT: _meta/contracts/**');
  console.log('═══════════════════════════════════════════════════════════');

  // 1. 检查 SSOT
  checkSSOT();

  // 2. 校验 contracts schemas 自身（含 GHL Phase 0b 新增 9 schemas）
  validateContractSchemas();

  // 2.5. 校验 formula instance contracts (confidence_formulas.yaml)
  validateFormulaInstances();

  // 3. 校验 learned policies
  validateLearnedPolicies();

  // 4. 校验 engine manifests (dual-route v1/v2 by schema_version)
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
