#!/usr/bin/env node
/**
 * Learned Policy Loader v1.0.0
 * SSOT: scripts/learning/learned_policy_loader.mjs
 *
 * LiYe OS 侧的统一策略加载 API。
 * 从 learned bundle 或本地目录加载 policies，
 * 提供 domain/scope/keyword 过滤能力。
 *
 * API:
 *   - loadByDomain(domain) → 按领域过滤
 *   - matchByScope(tenant_id, brand_id?, marketplace?) → 按 scope 过滤
 *   - matchByKeywords(task_keywords) → 按关键词匹配
 *
 * 使用方式:
 *   import { PolicyLoader } from './learned_policy_loader.mjs';
 *
 *   const loader = new PolicyLoader();
 *   await loader.load();
 *
 *   const policies = loader.loadByDomain('amazon-advertising');
 *   const matched = loader.matchByScope({ tenant_id: 'default', marketplace: 'US' });
 */

import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, realpathSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');
const BUNDLES_DIR = join(PROJECT_ROOT, 'state', 'artifacts', 'learned-bundles');

// ===============================================================
// 常量
// ===============================================================

// Manifest 白名单字段（严格验证）
const MANIFEST_ALLOWED_FIELDS = new Set([
  'bundle_version', 'schema_version', 'created_at', 'sha256',
  'policies_index', 'skills_index'
]);

const POLICY_INDEX_ALLOWED_FIELDS = new Set([
  'policy_id', 'domain', 'file', 'sha256',
  'scope', 'risk_level', 'confidence'
]);

// ===============================================================
// 工具函数
// ===============================================================

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

// ===============================================================
// PolicyLoader 类
// ===============================================================

export class PolicyLoader {
  /**
   * @param {Object} options
   * @param {string} [options.bundlePath] - Bundle 文件路径（优先使用）
   * @param {string} [options.policiesDir] - 本地 policies 目录
   * @param {string[]} [options.stages] - 要加载的阶段（默认 ['production']）
   */
  constructor(options = {}) {
    this.bundlePath = options.bundlePath || process.env.LEARNED_BUNDLE_PATH;
    this.policiesDir = options.policiesDir || POLICIES_DIR;
    this.stages = options.stages || ['production'];

    this._policies = null;
    this._manifest = null;
    this._cacheDir = null;
  }

  /**
   * 加载所有 policies
   * @returns {Promise<Array>}
   */
  async load() {
    if (this._policies !== null) {
      return this._policies;
    }

    // 优先从 bundle 加载
    if (this.bundlePath && existsSync(this.bundlePath)) {
      await this._loadFromBundle();
    } else {
      // 从本地目录加载
      await this._loadFromDirectory();
    }

    return this._policies;
  }

  /**
   * 从 bundle 加载
   */
  async _loadFromBundle() {
    // 1. 创建临时目录并解压
    this._cacheDir = mkdtempSync(join(tmpdir(), 'policy-loader-'));

    try {
      execSync(`tar -xzf "${this.bundlePath}" -C "${this._cacheDir}"`, {
        stdio: 'pipe'
      });
    } catch (e) {
      this.cleanup();
      throw new Error(`Failed to extract bundle: ${e.message}`);
    }

    // 1.5 ZipSlip/路径穿越防护：验证所有解压文件的 realpath 在临时目录内
    const realCacheDir = realpathSync(this._cacheDir);
    const extractedFiles = execSync(`find "${this._cacheDir}" -type f`, { encoding: 'utf-8' })
      .trim().split('\n').filter(Boolean);

    for (const file of extractedFiles) {
      const realFilePath = realpathSync(file);
      if (!realFilePath.startsWith(realCacheDir)) {
        this.cleanup();
        throw new Error(`ZipSlip attack detected: ${file} resolves outside cache directory`);
      }
    }

    // 2. 读取并验证 manifest
    const manifestPath = join(this._cacheDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      this.cleanup();
      throw new Error('manifest.json not found in bundle');
    }

    this._manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    this._validateManifest();

    // 3. 验证并加载 policies
    this._policies = [];

    for (const entry of this._manifest.policies_index || []) {
      const filePath = join(this._cacheDir, entry.file);

      if (!existsSync(filePath)) {
        throw new Error(`Policy file not found: ${entry.file}`);
      }

      // 验证 SHA256
      const actualHash = sha256File(filePath);
      if (actualHash !== entry.sha256) {
        throw new Error(
          `Policy hash mismatch for ${entry.file}: ` +
          `expected ${entry.sha256}, got ${actualHash}`
        );
      }

      // 加载 policy
      const content = readFileSync(filePath, 'utf-8');
      const policy = parseYaml(content);
      this._policies.push(policy);
    }

    console.log(`✅ Loaded ${this._policies.length} policies from bundle ${this._manifest.bundle_version}`);
  }

  /**
   * 从本地目录加载
   */
  async _loadFromDirectory() {
    this._policies = [];

    for (const stage of this.stages) {
      const stageDir = join(this.policiesDir, stage);

      if (!existsSync(stageDir)) {
        continue;
      }

      const files = readdirSync(stageDir)
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .sort();

      for (const file of files) {
        const filePath = join(stageDir, file);
        const content = readFileSync(filePath, 'utf-8');

        try {
          const policy = parseYaml(content);
          policy._source = { stage, file };
          this._policies.push(policy);
        } catch (e) {
          console.warn(`Warning: Failed to parse ${file}: ${e.message}`);
        }
      }
    }

    console.log(`✅ Loaded ${this._policies.length} policies from ${this.stages.join(', ')}`);
  }

  /**
   * 验证 manifest 字段白名单
   */
  _validateManifest() {
    // 检查未知字段
    for (const key of Object.keys(this._manifest)) {
      if (!MANIFEST_ALLOWED_FIELDS.has(key)) {
        throw new Error(`Manifest contains unknown field: ${key}`);
      }
    }

    // 检查必需字段
    const required = ['bundle_version', 'schema_version', 'created_at', 'sha256', 'policies_index'];
    for (const field of required) {
      if (!(field in this._manifest)) {
        throw new Error(`Manifest missing required field: ${field}`);
      }
    }

    // 验证 policies_index 字段
    for (let i = 0; i < (this._manifest.policies_index || []).length; i++) {
      const entry = this._manifest.policies_index[i];
      for (const key of Object.keys(entry)) {
        if (!POLICY_INDEX_ALLOWED_FIELDS.has(key)) {
          throw new Error(`policies_index[${i}] contains unknown field: ${key}`);
        }
      }
    }
  }

  /**
   * 按 domain 过滤
   * @param {string} domain
   * @returns {Array}
   */
  loadByDomain(domain) {
    if (this._policies === null) {
      throw new Error('Must call load() first');
    }

    return this._policies.filter(p => p.domain === domain);
  }

  /**
   * 按 scope 过滤
   * @param {Object} scopeContext - { tenant_id, brand_id?, marketplace?, asin? }
   * @returns {Array}
   */
  matchByScope(scopeContext) {
    if (this._policies === null) {
      throw new Error('Must call load() first');
    }

    return this._policies.filter(p => {
      const policyKeys = p.scope?.keys || {};

      // 检查所有提供的 scope 键是否匹配
      for (const [key, value] of Object.entries(scopeContext)) {
        if (value !== undefined && policyKeys[key] !== value) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 按关键词匹配
   * @param {string[]} taskKeywords - 任务关键词列表
   * @returns {Array}
   */
  matchByKeywords(taskKeywords) {
    if (this._policies === null) {
      throw new Error('Must call load() first');
    }

    const keywords = taskKeywords.map(k => k.toLowerCase());

    return this._policies.filter(p => {
      // 从 policy_id、domain、actions 中提取关键词
      const policyText = [
        p.policy_id || '',
        p.domain || '',
        ...(p.actions || []).map(a => a.action_type || '')
      ].join(' ').toLowerCase();

      // 任一关键词匹配即可
      return keywords.some(k => policyText.includes(k));
    });
  }

  /**
   * 获取所有策略
   * @returns {Array}
   */
  getAll() {
    if (this._policies === null) {
      throw new Error('Must call load() first');
    }
    return this._policies;
  }

  /**
   * 获取 manifest（仅 bundle 模式）
   * @returns {Object|null}
   */
  get manifest() {
    return this._manifest;
  }

  /**
   * 获取 bundle 版本
   * @returns {string|null}
   */
  get version() {
    return this._manifest?.bundle_version || null;
  }

  /**
   * 清理临时目录
   */
  cleanup() {
    if (this._cacheDir && existsSync(this._cacheDir)) {
      rmSync(this._cacheDir, { recursive: true, force: true });
      this._cacheDir = null;
    }
  }
}

// ===============================================================
// CLI 入口
// ===============================================================

async function main() {
  const args = process.argv.slice(2);
  const bundlePath = args.find(a => a.endsWith('.tgz'));
  const domain = args.find(a => !a.endsWith('.tgz') && !a.startsWith('--'));
  const listAll = args.includes('--list');

  const loader = new PolicyLoader({
    bundlePath,
    stages: ['production', 'candidate']
  });

  try {
    await loader.load();

    console.log(`\nBundle Version: ${loader.version || 'N/A (directory mode)'}`);
    console.log(`Total Policies: ${loader.getAll().length}\n`);

    if (domain) {
      const matched = loader.loadByDomain(domain);
      console.log(`Policies for domain '${domain}': ${matched.length}`);
      for (const p of matched) {
        console.log(`  - ${p.policy_id}: ${p.risk_level} (confidence: ${p.confidence})`);
      }
    } else if (listAll) {
      for (const p of loader.getAll()) {
        console.log(`  - ${p.policy_id}: ${p.domain} (${p.risk_level})`);
      }
    }
  } finally {
    loader.cleanup();
  }
}

// 如果直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error(`❌ Error: ${e.message}`);
    process.exit(1);
  });
}
