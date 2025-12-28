#!/usr/bin/env node
/**
 * LiYe OS Context Assembler
 * 根据任务描述自动加载相关 Packs，生成编译后的上下文
 *
 * v2.0: 新增远程技能按需加载（Direct Fetch 架构）
 * v3.0: 新增远程角色模板按需加载（Roles 层）
 *
 * 鸣谢:
 * - ComposioHQ/awesome-claude-skills 提供技能基础
 * - VoltAgent/awesome-claude-code-subagents 提供角色模板
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

// ============================================================
// 远程技能配置（来自 liyecom/skill-packs Fork）
// ============================================================
const REMOTE_BASE_URL = 'https://raw.githubusercontent.com/liyecom/skill-packs/master/';
const CACHE_DIR = path.join(os.homedir(), '.liye', 'skill-cache');
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天缓存

// === Context Priority Rules ===
// Role 冲突仲裁优先级：BMad > VoltAgent
const ROLE_PRIORITY = {
  'bmad-method': 2,   // BMad = 方法论沉淀的工程人格
  'voltagent': 1,     // VoltAgent = 泛化专家人格
};
const MAX_ROLES = 3;  // Role 总数上限

// 关键词 → 技能路径映射
const REMOTE_SKILL_INDEX = {
  // artifacts-builder (React/前端组件)
  'artifacts': 'artifacts-builder/SKILL.md',
  'react组件': 'artifacts-builder/SKILL.md',
  'shadcn': 'artifacts-builder/SKILL.md',

  // brand-guidelines (品牌设计)
  'brand': 'brand-guidelines/SKILL.md',
  '品牌': 'brand-guidelines/SKILL.md',
  'anthropic': 'brand-guidelines/SKILL.md',

  // canvas-design (视觉设计)
  'canvas': 'canvas-design/SKILL.md',
  'poster': 'canvas-design/SKILL.md',
  '海报': 'canvas-design/SKILL.md',
  '视觉设计': 'canvas-design/SKILL.md',

  // changelog-generator (更新日志)
  'changelog': 'changelog-generator/SKILL.md',
  '更新日志': 'changelog-generator/SKILL.md',
  'release notes': 'changelog-generator/SKILL.md',

  // competitive-ads-extractor (竞品广告)
  'competitive ads': 'competitive-ads-extractor/SKILL.md',
  '竞品广告': 'competitive-ads-extractor/SKILL.md',
  'ad extractor': 'competitive-ads-extractor/SKILL.md',

  // content-research-writer (内容研究)
  'content research': 'content-research-writer/SKILL.md',
  '内容研究': 'content-research-writer/SKILL.md',
  'blog post': 'content-research-writer/SKILL.md',
  '博客': 'content-research-writer/SKILL.md',

  // developer-growth-analysis (开发者增长)
  'developer growth': 'developer-growth-analysis/SKILL.md',
  '开发者增长': 'developer-growth-analysis/SKILL.md',
  'github stars': 'developer-growth-analysis/SKILL.md',

  // document-skills (文档处理)
  'docx': 'document-skills/SKILL.md',
  'word': 'document-skills/SKILL.md',
  'word文档': 'document-skills/SKILL.md',

  // domain-name-brainstormer (域名)
  'domain name': 'domain-name-brainstormer/SKILL.md',
  '域名': 'domain-name-brainstormer/SKILL.md',

  // file-organizer (文件整理)
  'file organizer': 'file-organizer/SKILL.md',
  '文件整理': 'file-organizer/SKILL.md',
  '整理文件': 'file-organizer/SKILL.md',

  // image-enhancer (图片增强)
  'image enhance': 'image-enhancer/SKILL.md',
  '图片增强': 'image-enhancer/SKILL.md',
  '图片优化': 'image-enhancer/SKILL.md',

  // internal-comms (内部沟通)
  'internal comms': 'internal-comms/SKILL.md',
  '内部沟通': 'internal-comms/SKILL.md',
  'status report': 'internal-comms/SKILL.md',
  '状态报告': 'internal-comms/SKILL.md',

  // invoice-organizer (发票整理)
  'invoice': 'invoice-organizer/SKILL.md',
  '发票': 'invoice-organizer/SKILL.md',

  // lead-research-assistant (线索研究)
  'lead research': 'lead-research-assistant/SKILL.md',
  '线索研究': 'lead-research-assistant/SKILL.md',
  'prospect': 'lead-research-assistant/SKILL.md',

  // mcp-builder (MCP 服务器)
  'mcp server': 'mcp-builder/SKILL.md',
  'mcp builder': 'mcp-builder/SKILL.md',

  // meeting-insights-analyzer (会议分析)
  'meeting': 'meeting-insights-analyzer/SKILL.md',
  '会议': 'meeting-insights-analyzer/SKILL.md',
  '会议纪要': 'meeting-insights-analyzer/SKILL.md',

  // raffle-winner-picker (抽奖)
  'raffle': 'raffle-winner-picker/SKILL.md',
  '抽奖': 'raffle-winner-picker/SKILL.md',

  // skill-creator (技能创建)
  'create skill': 'skill-creator/SKILL.md',
  '创建技能': 'skill-creator/SKILL.md',

  // slack-gif-creator (Slack GIF)
  'slack gif': 'slack-gif-creator/SKILL.md',
  'gif': 'slack-gif-creator/SKILL.md',
  '动图': 'slack-gif-creator/SKILL.md',

  // theme-factory (主题工厂)
  'theme': 'theme-factory/SKILL.md',
  '主题': 'theme-factory/SKILL.md',
  'styling': 'theme-factory/SKILL.md',

  // video-downloader (视频下载)
  'video download': 'video-downloader/SKILL.md',
  '视频下载': 'video-downloader/SKILL.md',
  'youtube': 'video-downloader/SKILL.md',

  // webapp-testing (Web 测试)
  'webapp test': 'webapp-testing/SKILL.md',
  'playwright': 'webapp-testing/SKILL.md',
  'e2e test': 'webapp-testing/SKILL.md',
  '端到端测试': 'webapp-testing/SKILL.md',
};

// ============================================================
// 远程角色配置（来自 liyecom/awesome-claude-code-subagents Fork）
// v3.0: Roles 层 - Claude 角色扮演增强
// ============================================================
const ROLE_BASE_URL = 'https://raw.githubusercontent.com/liyecom/awesome-claude-code-subagents/main/';
const ROLE_CACHE_DIR = path.join(os.homedir(), '.liye', 'role-cache');

// 关键词 → 角色路径映射
const REMOTE_ROLE_INDEX = {
  // 01-core-development (核心开发)
  '后端': 'categories/01-core-development/backend-developer.md',
  'backend': 'categories/01-core-development/backend-developer.md',
  'api': 'categories/01-core-development/api-designer.md',
  'api design': 'categories/01-core-development/api-designer.md',
  'rest': 'categories/01-core-development/api-designer.md',
  'restful': 'categories/01-core-development/api-designer.md',
  '前端': 'categories/01-core-development/frontend-developer.md',
  'frontend': 'categories/01-core-development/frontend-developer.md',
  '全栈': 'categories/01-core-development/fullstack-developer.md',
  'fullstack': 'categories/01-core-development/fullstack-developer.md',
  'api设计': 'categories/01-core-development/api-designer.md',
  'api designer': 'categories/01-core-development/api-designer.md',
  '微服务': 'categories/01-core-development/microservices-architect.md',
  'microservices': 'categories/01-core-development/microservices-architect.md',
  'graphql': 'categories/01-core-development/graphql-architect.md',
  'websocket': 'categories/01-core-development/websocket-engineer.md',
  'electron': 'categories/01-core-development/electron-pro.md',
  'ui设计': 'categories/01-core-development/ui-designer.md',

  // 02-language-specialists (语言专家)
  'python专家': 'categories/02-language-specialists/python-master.md',
  'python master': 'categories/02-language-specialists/python-master.md',
  'javascript专家': 'categories/02-language-specialists/javascript-master.md',
  'typescript专家': 'categories/02-language-specialists/typescript-master.md',
  'go专家': 'categories/02-language-specialists/go-master.md',
  'golang': 'categories/02-language-specialists/go-master.md',
  'rust专家': 'categories/02-language-specialists/rust-master.md',
  'java专家': 'categories/02-language-specialists/java-master.md',
  'nextjs': 'categories/02-language-specialists/nextjs-developer.md',
  'vue': 'categories/02-language-specialists/vue-developer.md',
  'angular': 'categories/02-language-specialists/angular-developer.md',
  'django': 'categories/02-language-specialists/django-developer.md',
  'flask': 'categories/02-language-specialists/flask-developer.md',
  'fastapi': 'categories/02-language-specialists/fastapi-developer.md',
  'spring boot': 'categories/02-language-specialists/spring-boot-developer.md',
  'laravel': 'categories/02-language-specialists/laravel-developer.md',
  'rails': 'categories/02-language-specialists/rails-developer.md',
  'flutter': 'categories/02-language-specialists/flutter-developer.md',
  'swift': 'categories/02-language-specialists/swift-developer.md',
  'kotlin': 'categories/02-language-specialists/kotlin-developer.md',

  // 03-infrastructure (基础设施)
  'devops': 'categories/03-infrastructure/devops-engineer.md',
  'kubernetes': 'categories/03-infrastructure/kubernetes-specialist.md',
  'k8s': 'categories/03-infrastructure/kubernetes-specialist.md',
  'terraform': 'categories/03-infrastructure/terraform-engineer.md',
  'docker': 'categories/03-infrastructure/docker-specialist.md',
  'aws': 'categories/03-infrastructure/aws-specialist.md',
  'azure': 'categories/03-infrastructure/azure-specialist.md',
  'gcp': 'categories/03-infrastructure/gcp-specialist.md',
  'linux': 'categories/03-infrastructure/linux-admin.md',
  'nginx': 'categories/03-infrastructure/nginx-expert.md',
  'ci/cd': 'categories/03-infrastructure/cicd-engineer.md',
  'cicd': 'categories/03-infrastructure/cicd-engineer.md',

  // 04-quality-security (质量与安全)
  'code review': 'categories/04-quality-security/code-reviewer.md',
  '代码审查': 'categories/04-quality-security/code-reviewer.md',
  'security': 'categories/04-quality-security/security-auditor.md',
  '安全审计': 'categories/04-quality-security/security-auditor.md',
  'qa': 'categories/04-quality-security/qa-expert.md',
  '质量保证': 'categories/04-quality-security/qa-expert.md',
  'test automation': 'categories/04-quality-security/test-automator.md',
  '自动化测试': 'categories/04-quality-security/test-automator.md',
  'penetration': 'categories/04-quality-security/penetration-tester.md',
  '渗透测试': 'categories/04-quality-security/penetration-tester.md',
  'performance': 'categories/04-quality-security/performance-engineer.md',
  '性能优化': 'categories/04-quality-security/performance-engineer.md',
  'debugger': 'categories/04-quality-security/debugger.md',
  '调试': 'categories/04-quality-security/debugger.md',
  'accessibility': 'categories/04-quality-security/accessibility-tester.md',

  // 05-data-ai (数据与AI)
  'ml engineer': 'categories/05-data-ai/ml-engineer.md',
  '机器学习': 'categories/05-data-ai/ml-engineer.md',
  'data scientist': 'categories/05-data-ai/data-scientist.md',
  '数据科学': 'categories/05-data-ai/data-scientist.md',
  'data engineer': 'categories/05-data-ai/data-engineer.md',
  '数据工程': 'categories/05-data-ai/data-engineer.md',
  'ai engineer': 'categories/05-data-ai/ai-engineer.md',
  'llm architect': 'categories/05-data-ai/llm-architect.md',
  'llm架构': 'categories/05-data-ai/llm-architect.md',
  'nlp': 'categories/05-data-ai/nlp-engineer.md',
  'prompt engineer': 'categories/05-data-ai/prompt-engineer.md',
  'mlops': 'categories/05-data-ai/mlops-engineer.md',
  'database optimizer': 'categories/05-data-ai/database-optimizer.md',
  '数据库优化': 'categories/05-data-ai/database-optimizer.md',

  // 06-developer-experience (开发者体验)
  'cli developer': 'categories/06-developer-experience/cli-developer.md',
  'cli开发': 'categories/06-developer-experience/cli-developer.md',
  'documentation': 'categories/06-developer-experience/documentation-engineer.md',
  '文档工程': 'categories/06-developer-experience/documentation-engineer.md',
  'refactoring': 'categories/06-developer-experience/refactoring-specialist.md',
  '重构': 'categories/06-developer-experience/refactoring-specialist.md',
  'legacy': 'categories/06-developer-experience/legacy-modernizer.md',
  'mcp developer': 'categories/06-developer-experience/mcp-developer.md',
  'git workflow': 'categories/06-developer-experience/git-workflow-manager.md',

  // 07-specialized-domains (专业领域)
  'blockchain': 'categories/07-specialized-domains/blockchain-developer.md',
  '区块链': 'categories/07-specialized-domains/blockchain-developer.md',
  'fintech': 'categories/07-specialized-domains/fintech-engineer.md',
  '金融科技': 'categories/07-specialized-domains/fintech-engineer.md',
  'game developer': 'categories/07-specialized-domains/game-developer.md',
  '游戏开发': 'categories/07-specialized-domains/game-developer.md',
  'iot': 'categories/07-specialized-domains/iot-engineer.md',
  '物联网': 'categories/07-specialized-domains/iot-engineer.md',
  'payment': 'categories/07-specialized-domains/payment-integration.md',
  '支付集成': 'categories/07-specialized-domains/payment-integration.md',
  'seo specialist': 'categories/07-specialized-domains/seo-specialist.md',
  'seo优化': 'categories/07-specialized-domains/seo-specialist.md',

  // 08-business-product (商业与产品)
  'product manager': 'categories/08-business-product/product-manager.md',
  '产品经理': 'categories/08-business-product/product-manager.md',
  'project manager': 'categories/08-business-product/project-manager.md',
  '项目经理': 'categories/08-business-product/project-manager.md',
  'scrum master': 'categories/08-business-product/scrum-master.md',
  'business analyst': 'categories/08-business-product/business-analyst.md',
  '业务分析': 'categories/08-business-product/business-analyst.md',
  'technical writer': 'categories/08-business-product/technical-writer.md',
  '技术写作': 'categories/08-business-product/technical-writer.md',
  'ux researcher': 'categories/08-business-product/ux-researcher.md',

  // 09-meta-orchestration (元编排)
  'multi-agent': 'categories/09-meta-orchestration/multi-agent-coordinator.md',
  '多代理': 'categories/09-meta-orchestration/multi-agent-coordinator.md',
  'context manager': 'categories/09-meta-orchestration/context-manager.md',
  'task distributor': 'categories/09-meta-orchestration/task-distributor.md',
  'workflow orchestrator': 'categories/09-meta-orchestration/workflow-orchestrator.md',
  '工作流编排': 'categories/09-meta-orchestration/workflow-orchestrator.md',

  // 10-research-analysis (研究分析)
  'competitive analyst': 'categories/10-research-analysis/competitive-analyst.md',
  '竞品分析': 'categories/10-research-analysis/competitive-analyst.md',
  'market researcher': 'categories/10-research-analysis/market-researcher.md',
  '市场研究': 'categories/10-research-analysis/market-researcher.md',
  'trend analyst': 'categories/10-research-analysis/trend-analyst.md',
  '趋势分析': 'categories/10-research-analysis/trend-analyst.md',
};

// ============================================================
// BMad Method Agents 配置（Roles Layer Only）
// ⚠️ 重要：BMad Agents 仅作为 Role Prompts，不进入 CrewAI Runtime
// v3.1: BMad Method 角色层整合
// ============================================================
const BMAD_BASE_URL = 'https://raw.githubusercontent.com/liyecom/BMAD-METHOD/main/';
const BMAD_CACHE_DIR = path.join(os.homedir(), '.liye', 'bmad-agent-cache');

// 关键词 → BMad Agent 路径映射
// 注：这些是 YAML Role Prompts，不是 LiYe OS Agents
const BMAD_AGENT_INDEX = {
  // BMM 核心开发角色
  'bmad developer': 'src/modules/bmm/agents/dev.agent.yaml',
  'bmad dev': 'src/modules/bmm/agents/dev.agent.yaml',
  'bmad实现': 'src/modules/bmm/agents/dev.agent.yaml',

  'bmad architect': 'src/modules/bmm/agents/architect.agent.yaml',
  'bmad架构': 'src/modules/bmm/agents/architect.agent.yaml',

  'bmad analyst': 'src/modules/bmm/agents/analyst.agent.yaml',
  'bmad分析': 'src/modules/bmm/agents/analyst.agent.yaml',

  'bmad pm': 'src/modules/bmm/agents/pm.agent.yaml',
  'bmad产品': 'src/modules/bmm/agents/pm.agent.yaml',

  'bmad scrum': 'src/modules/bmm/agents/sm.agent.yaml',
  'bmad sm': 'src/modules/bmm/agents/sm.agent.yaml',

  'bmad tester': 'src/modules/bmm/agents/tea.agent.yaml',
  'bmad qa': 'src/modules/bmm/agents/tea.agent.yaml',
  'bmad测试': 'src/modules/bmm/agents/tea.agent.yaml',

  'bmad ux': 'src/modules/bmm/agents/ux-designer.agent.yaml',
  'bmad设计': 'src/modules/bmm/agents/ux-designer.agent.yaml',

  'bmad tech writer': 'src/modules/bmm/agents/tech-writer.agent.yaml',
  'bmad文档': 'src/modules/bmm/agents/tech-writer.agent.yaml',

  'bmad solo': 'src/modules/bmm/agents/quick-flow-solo-dev.agent.yaml',

  // BMad Master (核心协调)
  'bmad master': 'src/core/agents/bmad-master.agent.yaml',

  // BMB 构建角色
  'bmad agent builder': 'src/modules/bmb/agents/agent-builder.agent.yaml',
  'bmad workflow builder': 'src/modules/bmb/agents/workflow-builder.agent.yaml',
  'bmad module builder': 'src/modules/bmb/agents/module-builder.agent.yaml',
};

/**
 * 从远程获取技能（带缓存）
 * 使用 curl 以支持系统代理配置
 */
function fetchRemoteSkill(skillPath) {
  const cachePath = path.join(CACHE_DIR, skillPath);

  // 1. 检查缓存（--refresh 跳过缓存）
  if (!FORCE_REFRESH && fs.existsSync(cachePath)) {
    try {
      const stat = fs.statSync(cachePath);
      const age = Date.now() - stat.mtimeMs;
      if (age < CACHE_MAX_AGE_MS) {
        const content = fs.readFileSync(cachePath, 'utf-8');
        console.log(`   📦 [Cache] ${skillPath}`);
        return content;
      }
    } catch (e) {
      // 缓存读取失败，继续获取远程
    }
  }

  // 2. 从远程获取（使用 curl 以支持代理）
  const url = REMOTE_BASE_URL + skillPath;
  console.log(`   🌐 [Fetch] ${skillPath}`);

  try {
    const data = execSync(`curl -sL "${url}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 1024 * 1024, // 1MB
    });

    if (!data || data.includes('404: Not Found')) {
      console.warn(`   ⚠️  Not found: ${skillPath}`);
      return null;
    }

    // 3. 写入缓存
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, data, 'utf-8');
      console.log(`   ✅ [Cached] ${skillPath}`);
    } catch (e) {
      console.warn(`   ⚠️  Cache write failed: ${e.message}`);
    }

    return data;
  } catch (e) {
    console.warn(`   ⚠️  Fetch error: ${e.message}`);
    return null;
  }
}

/**
 * 根据关键词匹配远程技能
 */
function matchRemoteSkills(taskDesc) {
  const matched = new Set();
  const s = (taskDesc || '').toLowerCase();

  for (const [keyword, skillPath] of Object.entries(REMOTE_SKILL_INDEX)) {
    if (s.includes(keyword.toLowerCase())) {
      matched.add(skillPath);
    }
  }

  return [...matched];
}

/**
 * 从远程获取角色模板（带缓存）
 * 使用 curl 以支持系统代理配置
 */
function fetchRemoteRole(rolePath) {
  const cachePath = path.join(ROLE_CACHE_DIR, rolePath);

  // 1. 检查缓存（--refresh 跳过缓存）
  if (!FORCE_REFRESH && fs.existsSync(cachePath)) {
    try {
      const stat = fs.statSync(cachePath);
      const age = Date.now() - stat.mtimeMs;
      if (age < CACHE_MAX_AGE_MS) {
        const content = fs.readFileSync(cachePath, 'utf-8');
        console.log(`   📦 [Cache] Role: ${rolePath}`);
        return content;
      }
    } catch (e) {
      // 缓存读取失败，继续获取远程
    }
  }

  // 2. 从远程获取（使用 curl 以支持代理）
  const url = ROLE_BASE_URL + rolePath;
  console.log(`   🌐 [Fetch] Role: ${rolePath}`);

  try {
    const data = execSync(`curl -sL "${url}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 1024 * 1024, // 1MB
    });

    if (!data || data.includes('404: Not Found')) {
      console.warn(`   ⚠️  Role not found: ${rolePath}`);
      return null;
    }

    // 3. 写入缓存
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, data, 'utf-8');
      console.log(`   ✅ [Cached] Role: ${rolePath}`);
    } catch (e) {
      console.warn(`   ⚠️  Role cache write failed: ${e.message}`);
    }

    return data;
  } catch (e) {
    console.warn(`   ⚠️  Role fetch error: ${e.message}`);
    return null;
  }
}

/**
 * 根据关键词匹配远程角色
 */
function matchRemoteRoles(taskDesc) {
  const matched = new Set();
  const s = (taskDesc || '').toLowerCase();

  for (const [keyword, rolePath] of Object.entries(REMOTE_ROLE_INDEX)) {
    if (s.includes(keyword.toLowerCase())) {
      matched.add(rolePath);
    }
  }

  return [...matched];
}

/**
 * 解析 Role Metadata（YAML frontmatter）
 * 预留接口：Role Ranking / 冲突裁决 / 权重 / 企业治理
 *
 * 约定格式：
 * ---
 * name: backend-developer
 * tags: [backend, api, database]
 * confidence: high | medium | low
 * source: VoltAgent | BMad | Custom
 * priority: 1-10 (可选，用于冲突裁决)
 * ---
 */
function parseRoleMetadata(content) {
  const metadata = {
    name: null,
    tags: [],
    confidence: 'medium',
    source: 'VoltAgent',
    priority: 5,
    raw: null,
  };

  if (!content) return metadata;

  // 检查是否有 YAML frontmatter (--- ... ---)
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return metadata;

  const frontmatter = frontmatterMatch[1];
  metadata.raw = frontmatter;

  // 简单解析 YAML（不引入依赖）
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    let value = line.slice(colonIdx + 1).trim();

    // 处理数组格式 [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim());
    }

    switch (key) {
      case 'name':
        metadata.name = value;
        break;
      case 'tags':
        metadata.tags = Array.isArray(value) ? value : [value];
        break;
      case 'confidence':
        metadata.confidence = value;
        break;
      case 'source':
        metadata.source = value;
        break;
      case 'priority':
        metadata.priority = parseInt(value, 10) || 5;
        break;
    }
  }

  return metadata;
}

/**
 * 从路径推断角色名（如果 metadata 中没有）
 */
function inferRoleName(rolePath) {
  return rolePath.split('/').pop().replace('.md', '');
}

/**
 * 从远程获取 BMad Agent YAML（带缓存）
 * ⚠️ 注意：BMad Agents 仅作为 Role Prompts，不进入 Runtime
 */
function fetchBmadAgent(agentPath) {
  // 使用 __ 替换 / 避免创建深层目录
  const cachePath = path.join(BMAD_CACHE_DIR, agentPath.replace(/\//g, '__'));

  // 1. 检查缓存（--refresh 跳过缓存）
  if (!FORCE_REFRESH && fs.existsSync(cachePath)) {
    try {
      const stat = fs.statSync(cachePath);
      const age = Date.now() - stat.mtimeMs;
      if (age < CACHE_MAX_AGE_MS) {
        const content = fs.readFileSync(cachePath, 'utf-8');
        console.log(`   📦 [Cache] BMad: ${agentPath}`);
        return content;
      }
    } catch (e) {
      // 缓存读取失败，继续获取远程
    }
  }

  // 2. 从远程获取（使用 curl 以支持代理）
  const url = BMAD_BASE_URL + agentPath;
  console.log(`   🌐 [Fetch] BMad: ${agentPath}`);

  try {
    const data = execSync(`curl -sL "${url}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 1024 * 1024, // 1MB
    });

    if (!data || data.includes('404: Not Found')) {
      console.warn(`   ⚠️  BMad Agent not found: ${agentPath}`);
      return null;
    }

    // 3. 写入缓存
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, data, 'utf-8');
      console.log(`   ✅ [Cached] BMad: ${agentPath}`);
    } catch (e) {
      console.warn(`   ⚠️  BMad cache write failed: ${e.message}`);
    }

    return data;
  } catch (e) {
    console.warn(`   ⚠️  BMad fetch error: ${e.message}`);
    return null;
  }
}

/**
 * 根据关键词匹配 BMad Agents
 * ⚠️ 返回的是 YAML Role Prompts，不是 CrewAI Agents
 */
function matchBmadAgents(taskDesc) {
  const matched = new Set();
  const s = (taskDesc || '').toLowerCase();

  for (const [keyword, agentPath] of Object.entries(BMAD_AGENT_INDEX)) {
    if (s.includes(keyword.toLowerCase())) {
      matched.add(agentPath);
    }
  }

  return [...matched];
}

/**
 * Role 冲突仲裁函数
 * 规则：BMad > VoltAgent（同类角色冲突时，高优先级覆盖低优先级）
 * @param {Array} roles - 角色数组，每个角色需有 { name, source, ... }
 * @returns {Array} - 仲裁后的角色数组
 */
function arbitrateRoles(roles) {
  const roleMap = new Map();

  for (const role of roles) {
    // roleKey 用于判断"同类角色"（基于名称去重）
    const roleKey = role.name || role.path || JSON.stringify(role).slice(0, 50);

    if (!roleMap.has(roleKey)) {
      roleMap.set(roleKey, role);
      continue;
    }

    const existing = roleMap.get(roleKey);
    const existingPriority = ROLE_PRIORITY[existing.source] || 0;
    const incomingPriority = ROLE_PRIORITY[role.source] || 0;

    // 优先级高的覆盖低的（BMad > VoltAgent）
    if (incomingPriority > existingPriority) {
      roleMap.set(roleKey, role);
    }
  }

  return Array.from(roleMap.values());
}

// ============================================================
// 原有代码
// ============================================================

const argv = process.argv.slice(2);
const taskIdx = argv.indexOf("--task");
const task = taskIdx >= 0 ? (argv[taskIdx + 1] || "").trim() : "";
const FORCE_REFRESH = argv.includes('--refresh');

if (!task) {
  console.error("Usage: node assembler.mjs --task \"your task description\" [--refresh]");
  console.error("Example: node assembler.mjs --task \"优化 Amazon Listing\"");
  console.error("Options:");
  console.error("  --refresh  Force refresh all cached skills/roles");
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

  // Infrastructure Pack 触发词（扩展：工程设计类）
  if (/(notion|para|架构|配置|命名|index|sync|同步|obsidian|vault|文件系统|目录|系统设计|architecture|system design|backend|frontend|devops|api|rest|microservice|微服务)/i.test(taskDesc)) {
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

// 匹配远程技能
const remoteSkills = matchRemoteSkills(task);

// 匹配远程角色
const remoteRoles = matchRemoteRoles(task);

// 匹配 BMad Agents（作为 Role Prompts，不是 Runtime Agents）
const bmadAgents = matchBmadAgents(task);

console.log(`📋 Task: ${task}`);
if (FORCE_REFRESH) {
  console.log(`🔄 Refresh mode: forcing cache refresh`);
}
console.log(`📦 Selected Packs: ${selected.join(", ")}`);
if (remoteSkills.length > 0) {
  console.log(`🌐 Remote Skills: ${remoteSkills.length} matched`);
}
if (remoteRoles.length > 0) {
  console.log(`🎭 Remote Roles: ${remoteRoles.length} matched`);
}
if (bmadAgents.length > 0) {
  console.log(`🧠 BMad Roles: ${bmadAgents.length} matched`);
}
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

// 加载远程技能
if (remoteSkills.length > 0) {
  console.log(`📥 Loading remote skills...`);
  for (const skillPath of remoteSkills) {
    const content = fetchRemoteSkill(skillPath);
    if (content) {
      const skillName = skillPath.split('/')[0];
      out += `## Remote Skill: ${skillName}\n\n`;
      out += `${content}\n\n`;
      out += `---\n\n`;
    }
  }
}

// ============================================================
// 加载 Roles（统一仲裁：BMad > VoltAgent）
// ============================================================
const allRoles = [];

// 1. 收集 VoltAgent 角色
if (remoteRoles.length > 0) {
  console.log(`🎭 Loading VoltAgent roles...`);
  for (const rolePath of remoteRoles) {
    const content = fetchRemoteRole(rolePath);
    if (content) {
      const metadata = parseRoleMetadata(content);
      const roleName = metadata.name || inferRoleName(rolePath);
      allRoles.push({
        name: roleName,
        path: rolePath,
        source: 'voltagent',
        content: content,
        metadata: metadata,
      });
    }
  }
}

// 2. 收集 BMad 角色
if (bmadAgents.length > 0) {
  console.log(`🧠 Loading BMad roles (YAML)...`);
  for (const agentPath of bmadAgents) {
    const content = fetchBmadAgent(agentPath);
    if (content) {
      const agentName = agentPath.split('/').pop().replace('.agent.yaml', '');
      allRoles.push({
        name: agentName,
        path: agentPath,
        source: 'bmad-method',
        content: content,
        metadata: { source: 'BMad-METHOD' },
      });
    }
  }
}

// 3. 仲裁 + 稳定排序 + 截断
const deduplicatedRoles = arbitrateRoles(allRoles);
// 稳定排序：priority 降序 → source 字典序 → name 字典序
const sortedRoles = deduplicatedRoles.sort((a, b) => {
  const pa = ROLE_PRIORITY[a.source] || 0;
  const pb = ROLE_PRIORITY[b.source] || 0;
  if (pb !== pa) return pb - pa; // 优先级降序
  if (a.source !== b.source) return a.source.localeCompare(b.source);
  return (a.name || '').localeCompare(b.name || '');
});

// 截断并记录丢弃原因
const arbitratedRoles = sortedRoles.slice(0, MAX_ROLES);
const droppedByConflict = allRoles.length - deduplicatedRoles.length;
const droppedByCap = deduplicatedRoles.length - arbitratedRoles.length;
const droppedList = sortedRoles.slice(MAX_ROLES).map(r => `${r.source}:${r.name}`).slice(0, 5);

// 4. 输出到 context
for (const role of arbitratedRoles) {
  if (role.source === 'voltagent') {
    out += `## Remote Role: ${role.name}\n\n`;
    out += `<!-- Role Metadata: confidence=${role.metadata.confidence}, source=${role.metadata.source}, priority=${role.metadata.priority} -->\n\n`;
    out += `${role.content}\n\n`;
    out += `---\n\n`;
  } else if (role.source === 'bmad-method') {
    out += `## BMad Role: ${role.name}\n\n`;
    out += `<!-- BMad Role (YAML): source=BMad-METHOD, layer=context-only, NOT runtime-executable -->\n\n`;
    out += `\`\`\`yaml\n${role.content}\n\`\`\`\n\n`;
    out += `---\n\n`;
  }
}

// 写入编译文件
fs.mkdirSync(".claude/.compiled", { recursive: true });
fs.writeFileSync(".claude/.compiled/context.md", out, "utf8");

console.log();
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

if (remoteSkills.length > 0) {
  console.log(`   - Remote Skills: ${remoteSkills.length} loaded`);
}

// Role 仲裁统计（可审计）
if (allRoles.length > 0) {
  console.log(`   - Roles total: ${allRoles.length}`);
  console.log(`   - Roles kept: ${arbitratedRoles.length}`);
  if (droppedByConflict > 0) {
    console.log(`   - Roles dropped (conflict): ${droppedByConflict}`);
  }
  if (droppedByCap > 0) {
    console.log(`   - Roles dropped (cap): ${droppedByCap}`);
    console.log(`   - Dropped list: ${droppedList.join(', ')}`);
  }
}

console.log(`   - Total: ${[...out].length} chars`);
console.log();
console.log(`💡 Next step: Ask Claude to read .claude/.compiled/context.md`);
