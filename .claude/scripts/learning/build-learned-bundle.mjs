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

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, cpSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const POLICIES_DIR = join(PROJECT_ROOT, 'state', 'memory', 'learned', 'policies');
const OUTPUT_DIR = join(PROJECT_ROOT, 'state', 'artifacts', 'learned-bundles');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

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
 * 获取所有 production policies
 */
function getProductionPolicies() {
  const productionDir = join(POLICIES_DIR, 'production');

  if (!existsSync(productionDir)) {
    console.log(`${YELLOW}⚠️  Production directory not found: ${productionDir}${RESET}`);
    return [];
  }

  const files = readdirSync(productionDir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort(); // 按字母序排序，确保可复现

  return files.map(f => ({
    filename: f,
    fullPath: join(productionDir, f),
    relativePath: `policies/production/${f}`
  }));
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
  mkdirSync(join(buildDir, 'skills', 'production'), { recursive: true });

  console.log(`📂 Build directory: ${buildDir}\n`);

  // 3. 获取 production policies
  const policies = getProductionPolicies();
  console.log(`📋 Found ${policies.length} production policies\n`);

  if (policies.length === 0) {
    console.log(`${YELLOW}⚠️  No production policies found. Creating empty bundle.${RESET}\n`);
  }

  // 4. 复制 policies 到构建目录
  const policiesIndex = [];

  for (const policy of policies) {
    const destPath = join(buildDir, policy.relativePath);
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

  // 6. 生成 manifest.json（第一阶段：sha256 为空）
  const manifest = {
    bundle_version: bundleVersion,
    schema_version: '1.0.0',
    created_at: new Date().toISOString(),
    sha256: '', // 第一阶段为空
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
  manifest.sha256 = bundleHash;

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
