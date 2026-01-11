/**
 * Information OS - Type Definitions
 * V2.0 Schema (with Score Calibration & Digest Support)
 */

export type Source = "hacker_news" | "product_hunt";

export type ValueScore = 1 | 2 | 3 | 4 | 5;

/**
 * Raw item from data source (before processing)
 */
export interface RawItem {
  id: string;
  title: string;
  link: string;
  source: Source;
  points?: number;
  comments?: number;
  pubDate?: string;
}

/**
 * Score breakdown by dimension (v2.0)
 * 5 维度评分，每个维度 1-5 分
 */
export interface ScoreBreakdown {
  innovation: number;      // 创新性 (25%)
  relevance: number;       // 相关性 (25%)
  actionability: number;   // 可行动性 (20%)
  signal_strength: number; // 信号强度 (15%)
  timeliness: number;      // 时效性 (15%)
}

/**
 * Processed signal ready for output
 * V2.0: Added score calibration fields (补丁 1)
 */
export interface Signal {
  // V0 fields (保持兼容)
  source: Source;
  title: string;
  summary_zh: string;
  value_score: ValueScore;
  link: string;
  detected_at: string; // ISO-8601

  // V2.0 新增字段 (补丁 1: 评分可进化性)
  score_confidence: number;       // LLM 自评把握度 (0.0-1.0)
  score_breakdown: ScoreBreakdown; // 各维度分数
  score_reasoning?: string;       // 评分理由
  uncertainty_reason?: string;    // 不确定原因

  // 反馈机制
  feedback_count: number;         // 反馈次数
  adjusted_score?: ValueScore;    // 校准后分数 (可选)
}

/**
 * Stored signal in KV (includes metadata)
 */
export interface StoredSignal extends Signal {
  id: string;                     // signal_id: {source}_{original_id}
  stored_at: string;              // ISO-8601
  key_points: string[];           // LLM 提取的要点
  target_audience: string;        // 目标受众
}

/**
 * Risk tag for World Model Gate (v2.5, 补丁 3)
 */
export interface RiskTag {
  type: "hype" | "duplicate" | "low_signal" | "overreaction" | "outdated";
  confidence: number;             // 0.0-1.0
  reason: string;                 // 一句话解释
}

/**
 * Signal with risk analysis (v2.5)
 */
export interface SignalWithRisk extends StoredSignal {
  risk_tags?: RiskTag[];
  risk_analysis?: {
    failure_modes: string[];      // 可能的失败模式
    blind_spots: string[];        // 盲点警告
  };
}

/**
 * Digest record for structured storage (补丁 2)
 */
export interface DigestRecord {
  digest_id: string;              // 唯一标识
  type: "daily" | "weekly";
  date: string;                   // ISO-8601 日期

  // 结构化锚点
  signals: {
    signal_id: string;
    rank: number;                 // 在 Digest 中的排名
    section: "full" | "brief" | "title_only";
  }[];
  themes: string[];               // AI 提取的主题标签

  // 生成溯源
  generated_by: string;           // "zhipu-glm4" | "gemini-1.5"
  prompt_version: string;         // Prompt 版本号
  prompt_hash: string;            // Prompt 哈希
  generation_time_ms: number;     // 生成耗时

  // 输出
  content_markdown: string;       // Markdown 内容
  content_length: number;         // 字符数
  created_at: string;             // ISO-8601
}

/**
 * Gemini API response structure
 */
export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

/**
 * Zhipu GLM API response structure (OpenAI compatible)
 */
export interface ZhipuResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Summarizer output (v2.0 with score breakdown)
 */
export interface SummaryResult {
  summary_zh: string;
  value_score: ValueScore;
  key_points: string[];
  target_audience: string;

  // V2.0 新增字段 (补丁 1)
  score_breakdown: ScoreBreakdown;
  score_confidence: number;       // 0.0-1.0
  score_reasoning: string;        // 评分理由
  uncertainty_reason?: string;    // 不确定原因
}

/**
 * Environment bindings for Cloudflare Workers
 * V2.0: Added SIGNAL_STORE and DIGEST_HISTORY
 */
export interface Env {
  // KV namespaces
  SEEN_ITEMS: KVNamespace;        // Deduplication
  SIGNAL_STORE?: KVNamespace;     // V2.0: Signal storage (optional until created)
  DIGEST_HISTORY?: KVNamespace;   // V2.0: Digest history (optional until created)

  // Secrets (required)
  PH_ACCESS_TOKEN: string;

  // LLM API keys (at least one required)
  GLM_API_KEY?: string;           // Zhipu GLM-4 (recommended)
  GEMINI_API_KEY?: string;        // Google Gemini (backup)

  // Push channel secrets (at least one required)
  PUSHPLUS_TOKEN?: string;
  WECHAT_APPID?: string;
  WECHAT_SECRET?: string;
  WECHAT_TEMPLATE_ID?: string;
  WECOM_WEBHOOK_URL?: string;

  // Enterprise WeChat App (v2.0)
  WECOM_CORPID?: string;          // 企业ID
  WECOM_AGENT_ID?: string;        // 应用AgentId
  WECOM_SECRET?: string;          // 应用Secret
  WECOM_APP_TOUSER?: string;      // 接收用户, 默认@all

  // Config vars
  HN_RSS_URL: string;
  PUSH_THRESHOLD: string;
  MAX_ITEMS_PER_PUSH: string;
  MERGE_WINDOW_MINUTES: string;

  // V2.0 Config
  ENABLE_REALTIME_PUSH?: string;  // 是否保留实时推送, 默认false
  DAILY_DIGEST_ENABLED?: string;  // 启用每日摘要, 默认true
  WEEKLY_DIGEST_ENABLED?: string; // 启用每周摘要, 默认true
}
