#!/usr/bin/env node
/**
 * LiYe OS Context Assembler
 * 根据任务描述自动加载相关 Packs，生成编译后的上下文
 */

import fs from "node:fs";

const argv = process.argv.slice(2);
const taskIdx = argv.indexOf("--task");
const task = taskIdx >= 0 ? (argv[taskIdx + 1] || "").trim() : "";

if (!task) {
  console.error("Usage: node assembler.mjs --task \"your task description\"");
  console.error("Example: node assembler.mjs --task \"优化 Amazon Listing\"");
  process.exit(1);
}

const kernel = fs.readFileSync("CLAUDE.md", "utf8");

const packs = [
  ["operations", ".claude/packs/operations.md"],
  ["research", ".claude/packs/research.md"],
  ["infrastructure", ".claude/packs/infrastructure.md"],
  ["protocols", ".claude/packs/protocols.md"],
];

/**
 * 智能选择需要加载的 Packs
 */
function pickPacks(taskDesc) {
  const picks = new Set();
  const s = (taskDesc || "").toLowerCase();

  // Operations Pack 触发词
  if (/(amazon|asin|ppc|listing|timo|跨境|亚马逊|关键词|广告|运营|keyword|campaign)/i.test(taskDesc)) {
    picks.add("operations");
  }

  // Research Pack 触发词
  if (/(医疗|治疗|药物|临床|evidence|pico|grade|crew|研究|文献|论文|循证|患者)/i.test(taskDesc)) {
    picks.add("research");
  }

  // Infrastructure Pack 触发词
  if (/(notion|para|架构|配置|命名|index|sync|同步|obsidian|vault|文件系统|目录)/i.test(taskDesc)) {
    picks.add("infrastructure");
  }

  // Protocols Pack 触发词
  if (/(multi-agent|协作|协议|gemini|交付|复盘|质量|gate|门禁|回滚)/i.test(taskDesc)) {
    picks.add("protocols");
  }

  // 默认兜底：如果没有匹配，加载 infrastructure（最通用）
  if (picks.size === 0) {
    console.log("⚠️  No specific Pack matched, loading infrastructure as default");
    picks.add("infrastructure");
  }

  return [...picks];
}

const selected = pickPacks(task);

console.log(`📋 Task: ${task}`);
console.log(`📦 Selected Packs: ${selected.join(", ")}`);
console.log();

// 拼接上下文
let out = `# Compiled Context for LiYe OS\n\n`;
out += `> Generated: ${new Date().toISOString()}\n`;
out += `> Task: ${task}\n\n`;
out += `---\n\n`;

out += `## Kernel (CLAUDE.md)\n\n`;
out += `${kernel}\n\n`;
out += `---\n\n`;

for (const id of selected) {
  const p = packs.find(x => x[0] === id)?.[1];
  if (p && fs.existsSync(p)) {
    const content = fs.readFileSync(p, "utf8");
    out += `## Pack: ${id}\n\n`;
    out += `${content}\n\n`;
    out += `---\n\n`;
  } else {
    console.warn(`⚠️  Pack "${id}" not found at ${p}`);
  }
}

// 写入编译文件
fs.mkdirSync(".claude/.compiled", { recursive: true });
fs.writeFileSync(".claude/.compiled/context.md", out, "utf8");

console.log(`✅ Compiled context written to: .claude/.compiled/context.md`);
console.log(`📊 Stats:`);
console.log(`   - Kernel: ${[...kernel].length} chars`);

for (const id of selected) {
  const p = packs.find(x => x[0] === id)?.[1];
  if (p && fs.existsSync(p)) {
    const content = fs.readFileSync(p, "utf8");
    console.log(`   - Pack (${id}): ${[...content].length} chars`);
  }
}

console.log(`   - Total: ${[...out].length} chars`);
console.log();
console.log(`💡 Next step: Ask Claude to read .claude/.compiled/context.md`);
