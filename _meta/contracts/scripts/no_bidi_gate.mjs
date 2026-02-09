#!/usr/bin/env node
/**
 * No-Bidi Gate v1.0.0
 * SSOT: _meta/contracts/scripts/no_bidi_gate.mjs
 *
 * CI Gate: 检测并拒绝危险的 Unicode 字符：
 * - Bidi controls (RTL/LTR override)
 * - Zero-width characters
 * - 混淆空白字符
 *
 * 用法：
 *   node no_bidi_gate.mjs [--all | --staged | --diff <base>]
 *
 * 返回值：
 *   0 = 通过（无危险字符）
 *   1 = 失败（发现危险字符）
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

// 颜色输出
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ═══════════════════════════════════════════════════════════
// 危险字符定义
// ═══════════════════════════════════════════════════════════

const DANGEROUS_CHARS = {
  // Bidi controls - can hide malicious code
  bidi: [
    { code: 0x202A, name: 'LEFT-TO-RIGHT EMBEDDING', char: '\u202A' },
    { code: 0x202B, name: 'RIGHT-TO-LEFT EMBEDDING', char: '\u202B' },
    { code: 0x202C, name: 'POP DIRECTIONAL FORMATTING', char: '\u202C' },
    { code: 0x202D, name: 'LEFT-TO-RIGHT OVERRIDE', char: '\u202D' },
    { code: 0x202E, name: 'RIGHT-TO-LEFT OVERRIDE', char: '\u202E' },
    { code: 0x2066, name: 'LEFT-TO-RIGHT ISOLATE', char: '\u2066' },
    { code: 0x2067, name: 'RIGHT-TO-LEFT ISOLATE', char: '\u2067' },
    { code: 0x2068, name: 'FIRST STRONG ISOLATE', char: '\u2068' },
    { code: 0x2069, name: 'POP DIRECTIONAL ISOLATE', char: '\u2069' },
  ],

  // Zero-width characters - can hide content
  zeroWidth: [
    { code: 0x200B, name: 'ZERO WIDTH SPACE', char: '\u200B' },
    { code: 0x200C, name: 'ZERO WIDTH NON-JOINER', char: '\u200C' },
    { code: 0x200D, name: 'ZERO WIDTH JOINER', char: '\u200D' },
    { code: 0x2060, name: 'WORD JOINER', char: '\u2060' },
    { code: 0xFEFF, name: 'ZERO WIDTH NO-BREAK SPACE (BOM)', char: '\uFEFF' },
  ],

  // Confusing whitespace - can cause subtle bugs
  confusingWhitespace: [
    { code: 0x00A0, name: 'NO-BREAK SPACE', char: '\u00A0' },
    { code: 0x2000, name: 'EN QUAD', char: '\u2000' },
    { code: 0x2001, name: 'EM QUAD', char: '\u2001' },
    { code: 0x2002, name: 'EN SPACE', char: '\u2002' },
    { code: 0x2003, name: 'EM SPACE', char: '\u2003' },
    { code: 0x2004, name: 'THREE-PER-EM SPACE', char: '\u2004' },
    { code: 0x2005, name: 'FOUR-PER-EM SPACE', char: '\u2005' },
    { code: 0x2006, name: 'SIX-PER-EM SPACE', char: '\u2006' },
    { code: 0x2007, name: 'FIGURE SPACE', char: '\u2007' },
    { code: 0x2008, name: 'PUNCTUATION SPACE', char: '\u2008' },
    { code: 0x2009, name: 'THIN SPACE', char: '\u2009' },
    { code: 0x200A, name: 'HAIR SPACE', char: '\u200A' },
    { code: 0x2028, name: 'LINE SEPARATOR', char: '\u2028' },
    { code: 0x2029, name: 'PARAGRAPH SEPARATOR', char: '\u2029' },
    { code: 0x205F, name: 'MEDIUM MATHEMATICAL SPACE', char: '\u205F' },
    { code: 0x3000, name: 'IDEOGRAPHIC SPACE', char: '\u3000' },
  ],

  // Other problematic characters
  other: [
    { code: 0x2028, name: 'LINE SEPARATOR', char: '\u2028' },
    { code: 0x2029, name: 'PARAGRAPH SEPARATOR', char: '\u2029' },
  ]
};

// 构建正则表达式
function buildDangerousRegex() {
  const allChars = [
    ...DANGEROUS_CHARS.bidi,
    ...DANGEROUS_CHARS.zeroWidth,
    ...DANGEROUS_CHARS.confusingWhitespace,
    ...DANGEROUS_CHARS.other
  ];

  const pattern = allChars.map(c => c.char).join('|');
  return new RegExp(`(${pattern})`, 'g');
}

const DANGEROUS_REGEX = buildDangerousRegex();

// 需要扫描的文件扩展名
const SCANNABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.yaml', '.yml', '.json', '.md',
  '.sh', '.bash', '.zsh',
  '.sql', '.html', '.css', '.scss'
]);

// 需要扫描的目录
const SCAN_DIRECTORIES = [
  '.claude/scripts',
  'src',
  '_meta/contracts',
  '_meta/adr',
  'tests'
];

// ═══════════════════════════════════════════════════════════
// 扫描函数
// ═══════════════════════════════════════════════════════════

/**
 * 查找危险字符
 */
function findDangerousChars(content, filename) {
  const findings = [];
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;

    DANGEROUS_REGEX.lastIndex = 0;
    while ((match = DANGEROUS_REGEX.exec(line)) !== null) {
      const char = match[0];
      const codePoint = char.codePointAt(0);
      const charInfo = [
        ...DANGEROUS_CHARS.bidi,
        ...DANGEROUS_CHARS.zeroWidth,
        ...DANGEROUS_CHARS.confusingWhitespace,
        ...DANGEROUS_CHARS.other
      ].find(c => c.code === codePoint);

      findings.push({
        file: filename,
        line: lineNum + 1,
        column: match.index + 1,
        codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
        name: charInfo?.name || 'UNKNOWN',
        category: getDangerCategory(codePoint),
        context: line.substring(Math.max(0, match.index - 20), match.index + 20)
      });
    }
  }

  return findings;
}

/**
 * 获取危险类别
 */
function getDangerCategory(codePoint) {
  if (DANGEROUS_CHARS.bidi.some(c => c.code === codePoint)) return 'BIDI_CONTROL';
  if (DANGEROUS_CHARS.zeroWidth.some(c => c.code === codePoint)) return 'ZERO_WIDTH';
  if (DANGEROUS_CHARS.confusingWhitespace.some(c => c.code === codePoint)) return 'CONFUSING_WHITESPACE';
  return 'OTHER';
}

/**
 * 获取要扫描的文件列表
 */
function getFilesToScan(mode, base) {
  let files = [];

  if (mode === 'staged') {
    try {
      const output = execSync('git diff --cached --name-only', {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8'
      }).trim();
      files = output.split('\n').filter(f => f);
    } catch (e) {
      console.error(`${RED}Failed to get staged files: ${e.message}${RESET}`);
      return [];
    }
  } else if (mode === 'diff' && base) {
    try {
      const output = execSync(`git diff --name-only ${base}`, {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8'
      }).trim();
      files = output.split('\n').filter(f => f);
    } catch (e) {
      console.error(`${RED}Failed to get diff files: ${e.message}${RESET}`);
      return [];
    }
  } else {
    // 扫描所有关键目录
    for (const dir of SCAN_DIRECTORIES) {
      try {
        const fullDir = join(PROJECT_ROOT, dir);
        if (!existsSync(fullDir)) continue;

        const output = execSync(`find "${fullDir}" -type f`, {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8'
        }).trim();
        files.push(...output.split('\n').filter(f => f));
      } catch (e) {
        // 目录可能不存在，跳过
      }
    }
  }

  // 过滤可扫描的文件类型
  return files.filter(f => {
    const ext = extname(f);
    return SCANNABLE_EXTENSIONS.has(ext);
  });
}

/**
 * 扫描文件
 */
function scanFile(filepath) {
  const fullPath = filepath.startsWith('/') ? filepath : join(PROJECT_ROOT, filepath);

  if (!existsSync(fullPath)) {
    return [];
  }

  try {
    const content = readFileSync(fullPath, 'utf-8');
    return findDangerousChars(content, filepath);
  } catch (e) {
    console.error(`${YELLOW}Warning: Cannot read ${filepath}: ${e.message}${RESET}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  let mode = 'all';
  let base = 'main';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--staged') mode = 'staged';
    if (args[i] === '--all') mode = 'all';
    if (args[i] === '--diff' && args[i + 1]) {
      mode = 'diff';
      base = args[++i];
    }
  }

  return { mode, base };
}

function main() {
  const { mode, base } = parseArgs();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           No-Bidi Security Gate v1.0.0');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Mode: ${mode}${mode === 'diff' ? ` (base: ${base})` : ''}`);
  console.log('');

  const files = getFilesToScan(mode, base);

  if (files.length === 0) {
    console.log(`${GREEN}No files to scan.${RESET}`);
    process.exit(0);
  }

  console.log(`Scanning ${files.length} files...`);
  console.log('');

  const allFindings = [];

  for (const file of files) {
    const findings = scanFile(file);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    console.log(`${GREEN}✓ No dangerous Unicode characters found${RESET}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    process.exit(0);
  }

  // 报告发现的问题
  console.log(`${RED}${BOLD}✗ Found ${allFindings.length} dangerous character(s)${RESET}`);
  console.log('');

  // 按文件分组
  const byFile = new Map();
  for (const finding of allFindings) {
    if (!byFile.has(finding.file)) {
      byFile.set(finding.file, []);
    }
    byFile.get(finding.file).push(finding);
  }

  for (const [file, findings] of byFile) {
    console.log(`${CYAN}${file}${RESET}`);
    for (const f of findings) {
      console.log(`  ${RED}Line ${f.line}:${f.column}${RESET} ${f.codePoint} ${f.name}`);
      console.log(`    ${DIM}Category: ${f.category}${RESET}`);
      console.log(`    ${DIM}Context: ...${f.context.replace(/[\u0000-\u001f]/g, '?')}...${RESET}`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`${RED}GATE FAILED: Remove dangerous Unicode characters before merge${RESET}`);
  console.log('');
  console.log('Common fixes:');
  console.log('  - Delete and retype the affected lines');
  console.log('  - Use a hex editor to inspect the file');
  console.log('  - Run: cat -v <file> to see hidden characters');
  console.log('═══════════════════════════════════════════════════════════');

  process.exit(1);
}

main();
