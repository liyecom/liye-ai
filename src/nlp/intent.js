/**
 * Intent Recognition Module
 *
 * Parses natural language input and extracts structured intent:
 * - domain: amazon | medical | code | general
 * - action: analyze | search | optimize | research | ask
 * - entity: ASIN, keyword, file path, etc.
 * - broker: inferred broker for routing
 */

// ASIN pattern: B0 followed by 8-9 alphanumeric chars
const ASIN_PATTERN = /\b(B0[A-Z0-9]{8,9})\b/i;

// Domain detection patterns
const DOMAIN_PATTERNS = {
  amazon: [
    /amazon/i,
    /亚马逊/,
    /asin/i,
    ASIN_PATTERN,
    /关键词.*(?:分析|搜索|优化)/,
    /(?:分析|搜索|优化).*关键词/,
    /listing/i,
    /ppc/i,
    /广告/,
    /产品.*(?:分析|优化)/,
    /(?:分析|优化).*产品/,
    /卖家/,
    /运营/,
    /跨境/,
  ],
  investment: [
    /财报/,
    /股票/,
    /投资/,
    /金融/,
    /基金/,
    /市值/,
    /估值/,
    /财务/,
    /收益/,
    /利润/,
    /营收/,
    /stock/i,
    /finance/i,
    /investment/i,
    /earnings/i,
    /revenue/i,
    /公司.*分析/,
    /分析.*公司/,
  ],
  medical: [
    /医疗/,
    /医学/,
    /治疗/,
    /药物/,
    /临床/,
    /症状/,
    /诊断/,
    /病/,
    /患者/,
  ],
  code: [
    /代码/,
    /code/i,
    /性能问题/,
    /bug/i,
    /错误/,
    /优化.*代码/,
    /代码.*优化/,
    /重构/,
    /refactor/i,
    /function/i,
    /函数/,
    /\.js\b/i,
    /\.ts\b/i,
    /\.py\b/i,
  ],
};

// Action detection patterns
const ACTION_PATTERNS = {
  analyze: [/分析/, /analyze/i, /检查/, /查看/, /评估/],
  search: [/搜索/, /search/i, /找/, /查/, /look.*for/i],
  optimize: [/优化/, /optimize/i, /改进/, /提升/, /improve/i],
  research: [/研究/, /调研/, /research/i, /探索/, /investigate/i],
};

// Broker hints based on action type
const ACTION_BROKER_MAP = {
  analyze: 'codex',
  search: 'antigravity',  // Browser-based search
  optimize: 'claude',
  research: 'antigravity',
  ask: 'codex',
};

/**
 * Recognize intent from natural language input
 * @param {string} input - Raw user input
 * @returns {Object} Intent object with domain, action, entity, broker
 */
function recognizeIntent(input) {
  const intent = {
    raw: input,
    domain: 'general',
    action: 'ask',
    entity: null,
    entities: {},
    broker: 'codex',
    confidence: 0,
  };

  // Extract ASIN if present
  const asinMatch = input.match(ASIN_PATTERN);
  if (asinMatch) {
    intent.entities.asin = asinMatch[1].toUpperCase();
    intent.entity = intent.entities.asin;
  }

  // Detect domain
  for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        intent.domain = domain;
        intent.confidence += 0.3;
        break;
      }
    }
    if (intent.domain !== 'general') break;
  }

  // Detect action
  for (const [action, patterns] of Object.entries(ACTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        intent.action = action;
        intent.confidence += 0.2;
        break;
      }
    }
    if (intent.action !== 'ask') break;
  }

  // Extract keywords for Amazon domain
  if (intent.domain === 'amazon' && !intent.entities.asin) {
    // Try to extract keyword phrase
    const keywordMatch = input.match(/(?:关键词|keyword)[：:\s]*([^\s,，。]+)/i);
    if (keywordMatch) {
      intent.entities.keyword = keywordMatch[1];
      intent.entity = intent.entities.keyword;
    } else {
      // Try to extract English product term
      const productMatch = input.match(/\b([a-z]+(?:\s+[a-z]+){0,4})\b.*(?:关键词|keyword|产品|product)/i);
      if (productMatch) {
        intent.entities.keyword = productMatch[1].trim();
        intent.entity = intent.entities.keyword;
      }
    }
  }

  // Determine broker based on domain and action
  if (intent.domain === 'amazon') {
    if (intent.action === 'search' || intent.action === 'research') {
      intent.broker = 'antigravity';  // Browser research
    } else {
      intent.broker = 'codex';  // Analysis
    }
  } else if (intent.domain === 'code') {
    intent.broker = 'claude';  // Code tasks prefer Claude
  } else if (intent.domain === 'medical') {
    intent.broker = 'codex';  // High-stakes reasoning
  } else {
    intent.broker = ACTION_BROKER_MAP[intent.action] || 'codex';
  }

  // Cap confidence
  intent.confidence = Math.min(intent.confidence, 1);

  return intent;
}

/**
 * Generate descriptive slug from intent
 * @param {Object} intent - Recognized intent
 * @returns {string} URL-safe slug
 */
function generateSlug(intent) {
  let base = '';

  if (intent.entity) {
    base = intent.entity;
  } else {
    base = intent.raw;
  }

  return base
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Determine project name based on domain
 * @param {Object} intent - Recognized intent
 * @returns {string} Project name
 */
function getProject(intent) {
  const projectMap = {
    amazon: 'amazon-growth',
    investment: 'investment-os',
    medical: 'medical-research',
    code: 'code-task',
    general: 'quick-ask',
  };
  return projectMap[intent.domain] || 'quick-ask';
}

module.exports = {
  recognizeIntent,
  generateSlug,
  getProject,
  ASIN_PATTERN,
};
