/**
 * Digest Generator Prompts
 * V2.0: LLM prompts for intelligent digest generation
 */

/**
 * Prompt for generating daily digest
 * V2.1: 移动端优化 - 精品模式（少而精）
 */
export const DAILY_DIGEST_PROMPT = `你是一个技术情报分析师，负责生成适合移动端阅读的每日技术简报。

## 输入数据
你会收到今日收录的技术信号列表，每个信号包含：
- title: 标题
- source: 来源 (hacker_news / product_hunt)
- summary_zh: 中文摘要
- value_score: 价值评分 (1-5)
- link: 原文链接

## 输出要求（重要：移动端优化）

### 1. 今日 TOP 10 精选 (fullSummary)
- **必须选取恰好 10 条**高价值信号（不多不少）
- 每条摘要 **150-200 字**，必须包含：
  - 这是什么产品/技术
  - 核心价值/创新点
  - 为什么值得关注
- 摘要要有深度，不要泛泛而谈
- 用中文撰写，保持专业但易读
- **重要：fullSummary 数组必须包含 10 个元素**

### 2. 更多值得关注 (briefList)
- 第 11-20 名信号（如果有的话）
- 每条只需：标题 + 评分
- 不需要摘要

### 3. 今日关键词 (themes)
- 3-5 个主题标签
- 反映今日技术趋势

### 4. 今日趋势洞察 (insights)
- **100-150字**的趋势分析
- 总结今日信号的共性和趋势
- 点明最值得关注的方向

## JSON 响应格式
{
  "title": "Information OS 每日简报",
  "date": "2026-01-10 (周五)",
  "totalCount": 23,
  "fullSummary": [
    {
      "rank": 1,
      "signal_id": "hacker_news_123",
      "title": "标题",
      "source": "hacker_news",
      "score": 5,
      "summary": "这是一款...(150-200字详细摘要)...",
      "link": "https://..."
    }
  ],
  "briefList": [
    {
      "rank": 11,
      "signal_id": "product_hunt_456",
      "title": "标题",
      "score": 4,
      "link": "https://..."
    }
  ],
  "themes": ["#AI编程", "#开发者工具", "#开源"],
  "insights": "今日技术圈的核心趋势是...(100-150字趋势分析)..."
}`;

/**
 * Prompt for generating weekly digest
 */
export const WEEKLY_DIGEST_PROMPT = `你是一个技术情报分析师，负责生成每周技术周报。

## 输入数据
你会收到本周收录的技术信号列表，每个信号包含：
- title: 标题
- source: 来源
- summary_zh: 中文摘要
- value_score: 价值评分 (1-5)
- score_breakdown: 五维度评分
- link: 原文链接
- detected_at: 检测时间

## 输出要求

### 1. 本周概览 (overview)
- 100-150 字的周度总结
- 提炼本周最重要的趋势

### 2. 本周 TOP 10 (topSignals)
- 选取本周 TOP 10 高分信号
- 每条信号提供完整摘要展示
- 标注发生日期（周几）

### 3. 趋势深度分析 (trendAnalysis)
- 2-3 个深度趋势分析
- 每个趋势 100-150 字
- 跨信号的共性分析

### 4. 其他精选 (otherPicks)
- 第 11-30 名信号
- 简要列表格式

### 5. 下周关注 (weekAhead)
- 2-3 个下周值得关注的事件预告
- 基于当前趋势的预判

### 6. 本周关键词 (themes)
- 5-8 个主题标签
- 反映本周技术趋势

## JSON 响应格式
{
  "title": "Information OS 周报",
  "weekInfo": "2026年第2周 (1/6 - 1/12)",
  "totalCount": 89,
  "overview": "本周技术圈最大看点是...",
  "topSignals": [
    {
      "rank": 1,
      "signal_id": "hacker_news_123",
      "title": "标题",
      "source": "hacker_news",
      "score": 5,
      "summary": "完整摘要...",
      "link": "https://...",
      "dayOfWeek": "周三"
    }
  ],
  "trendAnalysis": [
    {
      "trend": "AI Coding 工具混战",
      "analysis": "本周三大 AI 编程工具同时发力..."
    }
  ],
  "otherPicks": [
    {
      "rank": 11,
      "signal_id": "product_hunt_456",
      "title": "标题",
      "score": 4
    }
  ],
  "weekAhead": [
    "CES 2026 即将召开，关注 AI 硬件新品",
    "Apple Vision Pro 2 传闻发布"
  ],
  "themes": ["#LLM", "#AI编程", "#开发者工具", "#开源", "#云计算"]
}`;

/**
 * User prompt template for daily digest
 */
export const DAILY_DIGEST_USER_PROMPT = `请为以下 {{count}} 条信号生成每日简报:

{{signals}}

请按照系统提示的 JSON 格式返回每日简报。`;

/**
 * User prompt template for weekly digest
 */
export const WEEKLY_DIGEST_USER_PROMPT = `请为以下 {{count}} 条信号生成每周周报:

{{signals}}

请按照系统提示的 JSON 格式返回每周周报。`;

/**
 * Format signals for LLM input
 */
export function formatSignalsForPrompt(
  signals: Array<{
    id?: string;
    title: string;
    source: string;
    summary_zh: string;
    value_score: number;
    score_breakdown?: {
      innovation: number;
      relevance: number;
      actionability: number;
      signal_strength: number;
      timeliness: number;
    };
    link: string;
    detected_at?: string;
  }>
): string {
  // 精简格式，减少 token 消耗
  return signals
    .map((s, i) => {
      // 截断摘要，最多 100 字
      const shortSummary = s.summary_zh.length > 100
        ? s.summary_zh.slice(0, 100) + "..."
        : s.summary_zh;
      const src = s.source === "hacker_news" ? "HN" : "PH";
      return `[${i + 1}] ${s.title} | ${src} | ★${s.value_score} | ${shortSummary} | ${s.link}`;
    })
    .join("\n");
}

/**
 * Hash a string for versioning
 */
export function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

/**
 * Get current prompt version
 */
export const PROMPT_VERSION = "2.0.0";
