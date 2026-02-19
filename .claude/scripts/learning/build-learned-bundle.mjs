#!/usr/bin/env node
/**
 * Build Learned Bundle v1.0.0
 * SSOT: scripts/learning/build-learned-bundle.mjs
 *
 * 构建 learned-bundle.tgz：
 * - 打包 production policies
 * - 生成 manifest.json
 * - 计算 SHA256
 * - 确保可复现（文件排序稳定、Index 排序稳定）
 *
 * 运行：node scripts/learning/build-learned-bundle.mjs [version]
 * 输出：state/artifacts/learned-bundles/learned-bundle_<version>.tgz
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, cpSync, rmSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');
const OUTPUT_DIR = join(PROJECT_ROOT, 'dist', 'bundles');
const CONTRACTS_DIR = join(PROJECT_ROOT, '_meta', 'contracts');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

/**
 * 获取当前 git SHA
 */
function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim();
  } catch (e) {
    return 'unknown';
  }
}

/**
 * 获取 contracts 版本信息
 */
function getContractsVersions() {
  const contracts = {};
  const schemaFiles = [
    { name: 'learned_policy', path: join(CONTRACTS_DIR, 'learning', 'learned_policy.schema.yaml') },
    { name: 'engine_manifest', path: join(CONTRACTS_DIR, 'engine', 'engine_manifest.schema.yaml') },
    { name: 'playbook_io', path: join(CONTRACTS_DIR, 'playbook', 'playbook_io.schema.yaml') }
  ];

  for (const schema of schemaFiles) {
    if (existsSync(schema.path)) {
      try {
        const content = readFileSync(schema.path, 'utf-8');
        const data = parseYaml(content);
        contracts[schema.name] = data.version || '1.0.0';
      } catch (e) {
        contracts[schema.name] = 'unknown';
      }
    }
  }
  return contracts;
}

/**
 * 获取文件大小
 */
function getFileSize(filePath) {
  return statSync(filePath).size;
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
 * 获取指定 tier 的 policies
 */
function getPoliciesByTier(tier) {
  const tierDir = join(POLICIES_DIR, tier);

  if (!existsSync(tierDir)) {
    return [];
  }

  const files = readdirSync(tierDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort(); // 按字母序排序，确保可复现

  return files.map(f => ({
    filename: f,
    fullPath: join(tierDir, f),
    relativePath: `policies/${tier}/${f}`,
    tier
  }));
}

/**
 * 获取所有 production policies
 */
function getProductionPolicies() {
  const policies = getPoliciesByTier('production');
  if (policies.length === 0) {
    console.log(`${YELLOW}⚠️  Production directory empty or not found${RESET}`);
  }
  return policies;
}

/**
 * 获取所有 candidate policies (Week 6: included in bundle for recommend-only)
 */
function getCandidatePolicies() {
  return getPoliciesByTier('candidate');
}

/**
 * 解析 policy 文件并提取索引信息
 */
function extractPolicyIndex(policy) {
  const content = readFileSync(policy.fullPath, 'utf-8');
  const data = parseYaml(content);
  const hash = sha256String(content);

  return {
    policy_id: data.policy_id,
    domain: data.domain,
    file: policy.relativePath,
    sha256: hash,
    scope: {
      type: data.scope?.type,
      keys: data.scope?.keys || {}
    },
    risk_level: data.risk_level,
    confidence: data.confidence
  };
}

/**
 * 构建 Bundle
 */
async function buildBundle(version) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Learned Bundle Builder v1.0.0');
  console.log('═══════════════════════════════════════════════════════════');

  const bundleVersion = version || `0.2.${Date.now()}`;
  const bundleName = `learned-bundle_${bundleVersion}`;
  const outputPath = join(OUTPUT_DIR, `${bundleName}.tgz`);

  console.log(`\n${CYAN}📦 Building bundle: ${bundleName}${RESET}\n`);

  // 1. 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 2. 创建临时构建目录
  const buildDir = join(tmpdir(), `bundle-build-${Date.now()}`);
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(join(buildDir, 'policies', 'production'), { recursive: true });
  mkdirSync(join(buildDir, 'policies', 'candidate'), { recursive: true });
  mkdirSync(join(buildDir, 'skills', 'production'), { recursive: true });

  console.log(`📂 Build directory: ${buildDir}\n`);

  // 3. 获取 production + candidate policies (Week 6: candidate for recommend-only)
  const productionPolicies = getProductionPolicies();
  const candidatePolicies = getCandidatePolicies();
  const policies = [...productionPolicies, ...candidatePolicies].sort((a, b) =>
    a.filename.localeCompare(b.filename)
  );

  console.log(`📋 Found ${productionPolicies.length} production policies`);
  console.log(`📋 Found ${candidatePolicies.length} candidate policies\n`);

  if (policies.length === 0) {
    console.log(`${YELLOW}⚠️  No policies found. Creating empty bundle.${RESET}\n`);
  }

  // 4. 复制 policies 到构建目录
  const policiesIndex = [];

  for (const policy of policies) {
    const destPath = join(buildDir, policy.relativePath);
    // Ensure parent directory exists (for candidate tier)
    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(policy.fullPath, destPath);

    try {
      const indexEntry = extractPolicyIndex({
        ...policy,
        fullPath: destPath
      });
      policiesIndex.push(indexEntry);
      console.log(`  ${GREEN}✅${RESET} ${policy.filename} → ${indexEntry.policy_id}`);
    } catch (e) {
      console.log(`  ${RED}❌${RESET} ${policy.filename}: ${e.message}`);
    }
  }

  // 5. 按 policy_id 排序 index（确保可复现）
  policiesIndex.sort((a, b) => a.policy_id.localeCompare(b.policy_id));

  // 5.5. 构建 files 列表（所有打包文件的 path, sha256, size）
  const files = [];
  for (const policy of policies) {
    const destPath = join(buildDir, policy.relativePath);
    if (existsSync(destPath)) {
      const content = readFileSync(destPath);
      files.push({
        path: policy.relativePath,
        sha256: createHash('sha256').update(content).digest('hex'),
        size: content.length
      });
    }
  }
  // 按 path 排序确保可复现
  files.sort((a, b) => a.path.localeCompare(b.path));

  // 6. 生成 manifest.json（第一阶段：bundle_sha256 为空）
  const manifest = {
    bundle_version: bundleVersion,
    schema_version: '1.0.0',
    created_at: new Date().toISOString(),
    git_sha: getGitSha(),
    contracts: getContractsVersions(),
    bundle_sha256: '', // 第一阶段为空，打包后填充
    included_policies: policiesIndex.map(p => ({
      name: p.policy_id,
      scope: p.scope,
      policy_hash: p.sha256
    })),
    files: files,
    // Legacy fields for backward compatibility
    sha256: '',
    policies_index: policiesIndex,
    skills_index: []
  };

  const manifestPath = join(buildDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\n📄 Generated manifest.json with ${policiesIndex.length} policies\n`);

  // 7. 打包（第一阶段）
  // 注意：macOS BSD tar 不支持 --sort=name，使用 find + sort 确保可复现
  const tempTgzPath = join(tmpdir(), `${bundleName}-temp.tgz`);
  execSync(
    `cd "${buildDir}" && find . -type f | LC_ALL=C sort | tar -cf - -T - | gzip > "${tempTgzPath}"`,
    { stdio: 'pipe', shell: '/bin/bash' }
  );

  // 8. 计算整体 SHA256
  const bundleHash = sha256File(tempTgzPath);
  manifest.bundle_sha256 = bundleHash;
  manifest.sha256 = bundleHash; // Legacy compatibility

  // 9. 更新 manifest 并重新打包
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  execSync(
    `cd "${buildDir}" && find . -type f | LC_ALL=C sort | tar -cf - -T - | gzip > "${outputPath}"`,
    { stdio: 'pipe', shell: '/bin/bash' }
  );

  // 10. 验证最终 hash
  const finalHash = sha256File(outputPath);

  console.log(`${CYAN}📊 Bundle Statistics:${RESET}`);
  console.log(`  Version: ${bundleVersion}`);
  console.log(`  Policies: ${policiesIndex.length}`);
  console.log(`  SHA256: ${finalHash}`);
  console.log(`  Output: ${outputPath}\n`);

  // 11. 清理
  rmSync(buildDir, { recursive: true, force: true });
  rmSync(tempTgzPath, { force: true });

  // 12. 同时输出 manifest.json（便于调试）
  const manifestOutputPath = join(OUTPUT_DIR, `${bundleName}.manifest.json`);
  writeFileSync(manifestOutputPath, JSON.stringify(manifest, null, 2));

  console.log(`${GREEN}✅ Bundle built successfully!${RESET}`);
  console.log(`   ${outputPath}`);
  console.log(`   ${manifestOutputPath}\n`);

  return { outputPath, manifest };
}

/**
 * 主函数
 */
async function main() {
  const version = process.argv[2];

  try {
    await buildBundle(version);
    process.exit(0);
  } catch (e) {
    console.error(`${RED}❌ Build failed: ${e.message}${RESET}`);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
