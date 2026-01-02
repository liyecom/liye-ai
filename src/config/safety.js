/**
 * Safety Runtime Guards
 * Implements hard-block for policy forbidden zones
 */

const { getSafetyPolicy } = require('./load');

// Forbidden action patterns (regex)
const FORBIDDEN_PATTERNS = {
  // Web history scraping
  WEB_HISTORY_SCRAPE: [
    /chatgpt\s+(web\s+)?history/i,
    /scrape\s+.*(chatgpt|claude|gemini)\s+(web|chat)/i,
    /sync\s+.*(chatgpt|claude|gemini)\s+conversations/i,
    /extract\s+.*(web\s+)?chat\s+history/i,
    /download\s+.*(chatgpt|claude|gemini)\s+logs/i,
  ],

  // Cookie/token exfiltration
  COOKIE_TOKEN_EXFILTRATION: [
    /cookie\s*(extract|exfil|steal|grab|scrape)/i,
    /(extract|exfil|steal|grab|scrape)\s*cookie/i,
    /session\s*token\s*(extract|exfil|steal|grab)/i,
    /(extract|exfil|steal|grab)\s*session\s*token/i,
    /localStorage\.getItem.*token/i,
    /document\.cookie/i,
    /bearer\s+token\s*(extract|exfil)/i,
    /api[_-]?key\s*(extract|exfil|steal)/i,
  ],
};

/**
 * Error code for forbidden actions
 */
const ForbiddenErrorCode = 'FORBIDDEN_ACTION';

/**
 * Check if action is forbidden by safety policy
 * Returns: { forbidden, reason, error_code, alternative }
 */
function checkForbiddenAction(action, repoRoot) {
  if (!action || typeof action !== 'string') {
    return { forbidden: false };
  }

  const policy = getSafetyPolicy(repoRoot);

  // Check web history scraping
  if (policy.forbid_web_history_scrape) {
    for (const pattern of FORBIDDEN_PATTERNS.WEB_HISTORY_SCRAPE) {
      if (pattern.test(action)) {
        return {
          forbidden: true,
          reason: 'Web chat history scraping is forbidden by policy',
          error_code: ForbiddenErrorCode,
          pattern: pattern.toString(),
          alternative: 'Use manual copy-paste from the web interface if needed. Create a mission with outputs/manual_paste.md for user to complete.',
        };
      }
    }
  }

  // Check cookie/token exfiltration
  if (policy.forbid_cookie_token_exfiltration) {
    for (const pattern of FORBIDDEN_PATTERNS.COOKIE_TOKEN_EXFILTRATION) {
      if (pattern.test(action)) {
        return {
          forbidden: true,
          reason: 'Cookie/token exfiltration is forbidden by policy',
          error_code: ForbiddenErrorCode,
          pattern: pattern.toString(),
          alternative: 'Request user to provide credentials via secure means (environment variable, .env file)',
        };
      }
    }
  }

  return { forbidden: false };
}

/**
 * Scan prompt for forbidden intents
 * Use this before sending prompt to broker
 */
function scanPromptForForbiddenIntents(prompt, repoRoot) {
  const result = checkForbiddenAction(prompt, repoRoot);

  if (result.forbidden) {
    return {
      safe: false,
      ...result,
    };
  }

  return { safe: true };
}

/**
 * Add forbidden patterns for testing/extension
 */
function addForbiddenPattern(category, pattern) {
  if (!FORBIDDEN_PATTERNS[category]) {
    FORBIDDEN_PATTERNS[category] = [];
  }
  FORBIDDEN_PATTERNS[category].push(pattern);
}

module.exports = {
  checkForbiddenAction,
  scanPromptForForbiddenIntents,
  addForbiddenPattern,
  ForbiddenErrorCode,
  FORBIDDEN_PATTERNS,
};
