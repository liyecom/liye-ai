/**
 * Configuration Loader
 * Loads and merges brokers.yaml and policy.yaml with built-in defaults
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Built-in defaults (fallback when config files are missing)
const BUILTIN_DEFAULTS = {
  brokers: {
    version: 1,
    defaults: {
      broker: 'codex',
      model: 'gpt-5.2-thinking',
      approval: 'semi-auto',
      sandbox: 'read-only',
      budget: {
        max_steps: 30,
        max_runtime_sec: 900,
        max_tokens: 100000,
      },
    },
    routes: {
      ask: { broker: 'codex', model: 'gpt-5.2-thinking', approval: 'semi-auto', sandbox: 'read-only' },
      build: { broker: 'claude', approval: 'semi-auto', sandbox: 'read-only' },
      ship: { broker: 'claude', approval: 'semi-auto', sandbox: 'read-only' },
      refactor: { broker: 'claude', approval: 'semi-auto', sandbox: 'read-only' },
      batch: { broker: 'gemini', approval: 'semi-auto', sandbox: 'read-only' },
      outline: { broker: 'gemini', approval: 'semi-auto', sandbox: 'read-only' },
      summarize: { broker: 'gemini', approval: 'semi-auto', sandbox: 'read-only' },
      research: { broker: 'antigravity', approval: 'manual', sandbox: 'none' },
      browser: { broker: 'antigravity', approval: 'manual', sandbox: 'none' },
    },
    brokers: {
      codex: {
        binary: 'codex',
        model_alias: { 'gpt-5.2-thinking': 'gpt-5.2' },
      },
      gemini: { binary: 'gemini', fallback_binary: 'gemini-cli' },
      claude: { binary: 'claude' },
      antigravity: { type: 'manual' },
    },
  },
  policy: {
    version: 1,
    approval: {
      mode_default: 'semi-auto',
      semi_auto: {
        allow_until_mission_end: true,
        grace_period_sec: 0,
        reapprove_patterns: [
          'rm -rf', 'sudo', 'chmod', 'chown',
          'curl .*\\|.*sh', 'git push', 'gh auth',
        ],
      },
    },
    sandbox: {
      default: 'read-only',
      allowlist_paths: ['missions/**', 'tmp/**', 'outputs/**', 'evidence/**'],
      denylist_paths: ['/etc/**', '/usr/**', '~/.ssh/**', '**/.env'],
    },
    safety: {
      forbid_web_history_scrape: true,
      forbid_cookie_token_exfiltration: true,
      immutable_audit_trail: true,
      require_fallback_on_failure: true,
    },
    error_codes: {
      BROKER_NOT_INSTALLED: 'Broker CLI not found in PATH',
      AUTH_REQUIRED: 'Broker requires authentication',
      QUOTA_EXCEEDED: 'API quota or rate limit exceeded',
      BUDGET_EXCEEDED: 'Mission budget limit reached',
      APPROVAL_DENIED: 'User denied approval',
      SANDBOX_VIOLATION: 'Action blocked by sandbox policy',
      TIMEOUT: 'Execution timeout',
      NETWORK_ERROR: 'Network connectivity issue',
      UNKNOWN: 'Unknown error',
    },
  },
};

// Cached config
let _brokersConfig = null;
let _policyConfig = null;

/**
 * Find config file path
 * Priority: ENV var > repo config/ > built-in
 */
function findConfigPath(filename, envVar, repoRoot) {
  // Check environment variable
  const envPath = process.env[envVar];
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  // Check repo config directory
  const repoConfigPath = path.join(repoRoot, 'config', filename);
  if (fs.existsSync(repoConfigPath)) {
    return repoConfigPath;
  }

  return null;
}

/**
 * Load YAML config with fallback
 */
function loadYamlConfig(filePath, defaults) {
  if (!filePath) {
    return { ...defaults };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const config = yaml.load(content);
    return deepMerge(defaults, config);
  } catch (err) {
    console.warn(`Warning: Failed to load ${filePath}: ${err.message}`);
    return { ...defaults };
  }
}

/**
 * Deep merge two objects
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Load brokers configuration
 */
function loadBrokersConfig(repoRoot) {
  if (_brokersConfig) return _brokersConfig;

  const configPath = findConfigPath('brokers.yaml', 'LIYE_BROKERS_CONFIG', repoRoot);
  _brokersConfig = loadYamlConfig(configPath, BUILTIN_DEFAULTS.brokers);
  return _brokersConfig;
}

/**
 * Load policy configuration
 */
function loadPolicyConfig(repoRoot) {
  if (_policyConfig) return _policyConfig;

  const configPath = findConfigPath('policy.yaml', 'LIYE_POLICY_CONFIG', repoRoot);
  _policyConfig = loadYamlConfig(configPath, BUILTIN_DEFAULTS.policy);
  return _policyConfig;
}

/**
 * Get route configuration
 * Priority: routeOverride > routes[routeType] > defaults
 */
function getRouteConfig(repoRoot, routeType, routeOverride = {}) {
  const config = loadBrokersConfig(repoRoot);
  const defaults = config.defaults || {};
  const routeConfig = config.routes?.[routeType] || {};

  return {
    broker: routeOverride.broker || routeConfig.broker || defaults.broker,
    model: routeOverride.model || routeConfig.model || defaults.model,
    approval: routeOverride.approval || routeConfig.approval || defaults.approval,
    sandbox: routeOverride.sandbox || routeConfig.sandbox || defaults.sandbox,
    budget: deepMerge(defaults.budget || {}, routeConfig.budget || {}),
  };
}

/**
 * Get model alias (map user-intent model to actual CLI model)
 */
function getModelAlias(repoRoot, brokerType, model) {
  const config = loadBrokersConfig(repoRoot);
  const brokerConfig = config.brokers?.[brokerType] || {};
  const aliasMap = brokerConfig.model_alias || {};

  return aliasMap[model] || model;
}

/**
 * Get approval policy
 */
function getApprovalPolicy(repoRoot) {
  const config = loadPolicyConfig(repoRoot);
  return config.approval || BUILTIN_DEFAULTS.policy.approval;
}

/**
 * Get reapprove patterns for semi-auto mode
 */
function getReapprovePatterns(repoRoot) {
  const policy = getApprovalPolicy(repoRoot);
  return policy.semi_auto?.reapprove_patterns || [];
}

/**
 * Check if action matches any reapprove pattern
 */
function matchesReapprovePattern(action, repoRoot) {
  const patterns = getReapprovePatterns(repoRoot);

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(action)) {
        return { matches: true, pattern };
      }
    } catch {
      // Fallback to simple string match
      if (action.toLowerCase().includes(pattern.toLowerCase())) {
        return { matches: true, pattern };
      }
    }
  }

  return { matches: false, pattern: null };
}

/**
 * Get safety policy
 */
function getSafetyPolicy(repoRoot) {
  const config = loadPolicyConfig(repoRoot);
  return config.safety || BUILTIN_DEFAULTS.policy.safety;
}

/**
 * Get error code description
 */
function getErrorDescription(repoRoot, errorCode) {
  const config = loadPolicyConfig(repoRoot);
  return config.error_codes?.[errorCode] || 'Unknown error';
}

/**
 * Get all routes (for display)
 */
function getAllRoutes(repoRoot) {
  const config = loadBrokersConfig(repoRoot);
  return config.routes || {};
}

/**
 * Get defaults
 */
function getDefaults(repoRoot) {
  const config = loadBrokersConfig(repoRoot);
  return config.defaults || {};
}

/**
 * Clear cached config (for testing)
 */
function clearCache() {
  _brokersConfig = null;
  _policyConfig = null;
}

module.exports = {
  loadBrokersConfig,
  loadPolicyConfig,
  getRouteConfig,
  getModelAlias,
  getApprovalPolicy,
  getReapprovePatterns,
  matchesReapprovePattern,
  getSafetyPolicy,
  getErrorDescription,
  getAllRoutes,
  getDefaults,
  clearCache,
  BUILTIN_DEFAULTS,
};
