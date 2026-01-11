/**
 * LLM Summarizer v2.0
 * Generates Chinese summaries with 5-dimension scoring and confidence calibration
 * 补丁 1: 评分可进化性 - 结构化量化评分体系
 */

import type {
  RawItem,
  Signal,
  SummaryResult,
  ValueScore,
  ScoreBreakdown,
  GeminiResponse,
  ZhipuResponse,
  Env,
} from "../types";
import { getConfig } from "../config";

/**
 * V2.0 System Prompt with 5-dimension scoring
 * 补丁 1: 每个维度独立打分，加权计算最终分数
 */
const SYSTEM_PROMPT = `你是一个技术情报分析师。你的任务是分析技术新闻/产品，提供结构化评估。

## 输出要求

### 1. 中文摘要 (summary_zh)
- 字数: 150-250 个中文字符
- 内容覆盖:
  - 这是什么 (产品/技术是什么)
  - 为什么重要 (核心价值)
  - 关键洞察 (独特见解)
- 要求: 详细具体，让读者无需点击原文就能了解核心内容

### 2. 五维度评分 (score_breakdown)
对每个维度独立评分 1-5 分:

| 维度 | 1分 | 3分 | 5分 |
|------|-----|-----|-----|
| innovation (创新性) | 已知技术/产品 | 有新意的改进 | 颠覆性创新 |
| relevance (相关性) | 与技术/商业无关 | 间接相关 | 直接影响决策 |
| actionability (可行动性) | 纯资讯 | 可参考借鉴 | 可立即应用 |
| signal_strength (信号强度) | 无数据支撑 | 有初步验证 | 强数据/社区验证 |
| timeliness (时效性) | 旧闻 | 近期发布 | 首发/独家 |

### 3. 综合评分 (value_score)
根据五维度加权计算 (系统自动计算，你只需提供各维度分数):
- innovation × 25%
- relevance × 25%
- actionability × 20%
- signal_strength × 15%
- timeliness × 15%

### 4. 置信度评估 (score_confidence)
评估你对这个评分的把握度 (0.0-1.0):
- 0.9-1.0: 非常确定，信息充分
- 0.7-0.9: 比较确定，信息基本充分
- 0.5-0.7: 一般确定，信息有限
- < 0.5: 不太确定，需要更多信息

### 5. 其他字段
- key_points: 2-3 个中文要点
- target_audience: 目标受众描述
- score_reasoning: 一句话解释评分理由
- uncertainty_reason: 如果置信度 < 0.8，说明原因

## JSON 响应格式
严格按此格式返回:
{
  "summary_zh": "中文摘要...",
  "score_breakdown": {
    "innovation": 4,
    "relevance": 5,
    "actionability": 3,
    "signal_strength": 4,
    "timeliness": 5
  },
  "score_confidence": 0.85,
  "score_reasoning": "一句话评分理由",
  "uncertainty_reason": "如果置信度低，说明原因",
  "key_points": ["要点1", "要点2"],
  "target_audience": "目标受众"
}`;

const USER_PROMPT_TEMPLATE = `分析以下内容:

标题: {{title}}
来源: {{source}}
链接: {{link}}

请按照系统提示的 JSON 格式返回分析结果。`;

/**
 * Calculate weighted value_score from score_breakdown
 * Formula: innovation×25% + relevance×25% + actionability×20% + signal_strength×15% + timeliness×15%
 */
function calculateWeightedScore(breakdown: ScoreBreakdown): ValueScore {
  const weighted =
    breakdown.innovation * 0.25 +
    breakdown.relevance * 0.25 +
    breakdown.actionability * 0.20 +
    breakdown.signal_strength * 0.15 +
    breakdown.timeliness * 0.15;

  // Round to nearest integer and clamp to 1-5
  return Math.max(1, Math.min(5, Math.round(weighted))) as ValueScore;
}

/**
 * Validate and normalize score_breakdown
 */
function normalizeScoreBreakdown(raw: Partial<ScoreBreakdown>): ScoreBreakdown {
  const clamp = (v: number | undefined) => Math.max(1, Math.min(5, v || 3));
  return {
    innovation: clamp(raw.innovation),
    relevance: clamp(raw.relevance),
    actionability: clamp(raw.actionability),
    signal_strength: clamp(raw.signal_strength),
    timeliness: clamp(raw.timeliness),
  };
}

/**
 * Call Zhipu GLM-4 API
 */
async function callZhipuAPI(
  userPrompt: string,
  env: Env,
  config: ReturnType<typeof getConfig>
): Promise<string> {
  const response = await fetch(config.llm.zhipu.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.llm.zhipu.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zhipu API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as ZhipuResponse;
  const text = result.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Empty response from Zhipu");
  }

  return text;
}

/**
 * Call Gemini API
 */
async function callGeminiAPI(
  userPrompt: string,
  env: Env,
  config: ReturnType<typeof getConfig>
): Promise<string> {
  const url = `${config.llm.gemini.apiUrl}/${config.llm.gemini.model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as GeminiResponse;
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}

/**
 * Generate summary and score for a single item
 */
export async function summarizeItem(
  item: RawItem,
  env: Env
): Promise<SummaryResult> {
  const config = getConfig(env);

  const userPrompt = USER_PROMPT_TEMPLATE.replace("{{title}}", item.title)
    .replace("{{source}}", item.source)
    .replace("{{link}}", item.link);

  let text: string;

  // Try Zhipu first (if configured), then fall back to Gemini
  if (env.GLM_API_KEY) {
    text = await callZhipuAPI(userPrompt, env, config);
  } else if (env.GEMINI_API_KEY) {
    text = await callGeminiAPI(userPrompt, env, config);
  } else {
    throw new Error("No LLM API key configured (GLM_API_KEY or GEMINI_API_KEY)");
  }

  try {
    // Clean up the response - remove markdown code blocks if present
    const cleanText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const raw = JSON.parse(cleanText);

    // Normalize score_breakdown
    const score_breakdown = normalizeScoreBreakdown(raw.score_breakdown || {});

    // Calculate weighted score from breakdown (v2.0)
    const value_score = calculateWeightedScore(score_breakdown);

    // Build v2.0 SummaryResult
    const result: SummaryResult = {
      summary_zh: raw.summary_zh || "无法生成摘要",
      value_score,
      key_points: Array.isArray(raw.key_points) ? raw.key_points : [],
      target_audience: raw.target_audience || "未知",
      // V2.0 fields (Patch 1: Score Calibration)
      score_breakdown,
      score_confidence: Math.max(0, Math.min(1, raw.score_confidence || 0.5)),
      score_reasoning: raw.score_reasoning || "",
      uncertainty_reason: raw.uncertainty_reason,
    };

    return result;
  } catch {
    // Fallback if JSON parsing fails
    const fallbackBreakdown: ScoreBreakdown = {
      innovation: 2,
      relevance: 2,
      actionability: 2,
      signal_strength: 2,
      timeliness: 2,
    };
    return {
      summary_zh: "无法生成摘要",
      value_score: 2 as ValueScore,
      key_points: [],
      target_audience: "未知",
      score_breakdown: fallbackBreakdown,
      score_confidence: 0.3,
      score_reasoning: "JSON解析失败，使用默认值",
    };
  }
}

/**
 * Extended signal result with item metadata for storage
 */
export interface ProcessedSignal {
  signal: Signal;
  itemId: string;
  keyPoints: string[];
  targetAudience: string;
}

/**
 * Process multiple items and generate signals
 * V2.0: Populates full Signal with score_breakdown and confidence
 * Filters by threshold before returning
 * Returns extended data for storage
 */
export async function processItems(
  items: RawItem[],
  env: Env
): Promise<ProcessedSignal[]> {
  const config = getConfig(env);
  const results: ProcessedSignal[] = [];

  for (const item of items) {
    try {
      const summary = await summarizeItem(item, env);

      // Only include items meeting threshold
      if (summary.value_score >= config.pushThreshold) {
        // V2.0 Signal with full calibration data (Patch 1)
        const signal: Signal = {
          // V0 fields (backward compatible)
          source: item.source,
          title: item.title,
          summary_zh: summary.summary_zh,
          value_score: summary.value_score,
          link: item.link,
          detected_at: new Date().toISOString(),

          // V2.0 fields (Patch 1: Score Calibration)
          score_confidence: summary.score_confidence,
          score_breakdown: summary.score_breakdown,
          score_reasoning: summary.score_reasoning,
          uncertainty_reason: summary.uncertainty_reason,
          feedback_count: 0, // Initial, no feedback yet
        };

        results.push({
          signal,
          itemId: item.id,
          keyPoints: summary.key_points,
          targetAudience: summary.target_audience,
        });
      }
    } catch (error) {
      console.error(`Failed to summarize item ${item.id}:`, error);
      // Continue with other items
    }
  }

  return results;
}
