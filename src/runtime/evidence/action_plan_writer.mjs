/**
 * Action Plan Writer
 *
 * Generates action_plan.json and action_plan.md files
 * into trace directories for approval workflow.
 *
 * Week4: Creates frozen execution plans with GUARANTEE.no_real_write=true
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const TRACE_BASE_DIR = process.env.TRACE_BASE_DIR || '.liye/traces';

/**
 * Write Action Plan to trace directory
 *
 * @param {Object} params
 * @param {string} params.trace_id - Trace identifier
 * @param {string} params.tenant_id - Tenant identifier
 * @param {string} params.user_message - Original user message/task
 * @param {Object} params.verdict - Gateway verdict (optional)
 * @param {string} params.policy_version - Policy version
 * @param {string} params.baseDir - Base directory for traces (optional)
 * @returns {Object} { success, filePath, plan_id, error }
 */
export function writeActionPlan({ trace_id, tenant_id, user_message, verdict, policy_version, baseDir }) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const traceDir = join(traceBaseDir, trace_id);
  const plan_id = `plan-${trace_id}`;

  try {
    // Ensure trace directory exists
    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }

    // Generate action plan
    const plan = generateActionPlan({
      plan_id,
      trace_id,
      tenant_id,
      user_message,
      verdict,
      policy_version
    });

    // Write JSON
    const jsonPath = join(traceDir, 'action_plan.json');
    writeFileSync(jsonPath, JSON.stringify(plan, null, 2), 'utf-8');

    // Write Markdown
    const mdPath = join(traceDir, 'action_plan.md');
    const mdContent = generateActionPlanMd(plan);
    writeFileSync(mdPath, mdContent, 'utf-8');

    console.log(`[ActionPlanWriter] Generated action_plan at ${traceDir}`);
    return {
      success: true,
      filePath: jsonPath,
      mdPath,
      plan_id,
      plan
    };

  } catch (e) {
    console.error('[ActionPlanWriter] Failed to write:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Generate Action Plan object
 */
function generateActionPlan({ plan_id, trace_id, tenant_id, user_message, verdict, policy_version }) {
  const now = new Date().toISOString();
  const intent = extractIntent(user_message);

  // Week4: Generate minimal plan with 1-3 actions
  // Default: 1 read + 1 analyze + 1 write (dry_run_only)
  const actions = generateMinimalActions(user_message, verdict);

  return {
    plan_id,
    trace_id,
    tenant_id: tenant_id || 'default',
    created_at: now,
    policy_version: policy_version || 'phase1_v1',
    intent,
    actions,
    GUARANTEE: {
      no_real_write: true,
      write_calls_attempted: 0
    }
  };
}

/**
 * Extract intent from user message
 */
function extractIntent(user_message) {
  if (!user_message) return '(unknown intent)';

  // Simple intent extraction - just summarize the message
  const msg = user_message.trim();
  if (msg.length <= 100) return msg;
  return msg.substring(0, 97) + '...';
}

/**
 * Generate minimal actions for Week4
 * Always includes: read → analyze → (optional) write (dry_run_only)
 */
function generateMinimalActions(user_message, verdict) {
  const actions = [];
  let actionIndex = 1;

  // Action 1: Read (always)
  actions.push({
    action_id: `action-${actionIndex++}`,
    action_type: 'read',
    tool: 'get_campaign_metrics',
    arguments: {
      date_range: 'last_30_days',
      metrics: ['acos', 'spend', 'sales', 'clicks', 'impressions']
    },
    risk_level: 'low',
    requires_approval: false,
    dry_run_only: false
  });

  // Action 2: Analyze (always)
  actions.push({
    action_id: `action-${actionIndex++}`,
    action_type: 'analyze',
    tool: 'analyze_wasted_spend',
    arguments: {
      threshold_acos: 50,
      min_clicks: 10
    },
    risk_level: 'low',
    requires_approval: false,
    dry_run_only: false
  });

  // Action 3: Write (if intent suggests modification)
  // Week4: Always dry_run_only=true, requires_approval=true
  const hasWriteIntent = detectWriteIntent(user_message);
  if (hasWriteIntent) {
    actions.push({
      action_id: `action-${actionIndex++}`,
      action_type: 'write',
      tool: 'add_negative_keywords',
      arguments: {
        keywords: ['(to be determined from analysis)'],
        match_type: 'exact'
      },
      risk_level: 'medium',
      requires_approval: true,
      dry_run_only: true  // Week4 hard constraint
    });
  }

  return actions;
}

/**
 * Detect if user message implies write intent
 */
function detectWriteIntent(user_message) {
  if (!user_message) return false;

  const writeKeywords = [
    '添加', '删除', '修改', '更新', '创建', '执行', '否词', '出价',
    'add', 'delete', 'modify', 'update', 'create', 'execute', 'bid',
    '优化', 'optimize', '调整', 'adjust'
  ];

  const msgLower = user_message.toLowerCase();
  return writeKeywords.some(kw => msgLower.includes(kw));
}

/**
 * Generate Markdown representation of Action Plan
 */
function generateActionPlanMd(plan) {
  const actionRows = plan.actions.map((a, i) => {
    const approvalBadge = a.requires_approval ? '🔐 需审批' : '✅ 自动';
    const dryRunBadge = a.dry_run_only ? '🔒 Dry-run' : '';
    return `| ${i + 1} | ${a.action_type} | \`${a.tool}\` | ${a.risk_level} | ${approvalBadge} ${dryRunBadge} |`;
  }).join('\n');

  return `# Action Plan

**Plan ID**: \`${plan.plan_id}\`
**Generated**: ${plan.created_at}

---

## Intent

> ${plan.intent}

---

## Trace Information

| Field | Value |
|-------|-------|
| **Trace ID** | \`${plan.trace_id}\` |
| **Tenant ID** | \`${plan.tenant_id}\` |
| **Policy Version** | \`${plan.policy_version}\` |

---

## Planned Actions

| # | Type | Tool | Risk | Approval |
|---|------|------|------|----------|
${actionRows}

---

## Action Details

${plan.actions.map((a, i) => `### Step ${i + 1}: ${a.action_type.toUpperCase()} - ${a.tool}

- **Action ID**: \`${a.action_id}\`
- **Risk Level**: ${a.risk_level}
- **Requires Approval**: ${a.requires_approval ? 'Yes' : 'No'}
- **Dry-run Only**: ${a.dry_run_only ? 'Yes' : 'No'}

**Arguments**:
\`\`\`json
${JSON.stringify(a.arguments, null, 2)}
\`\`\`
`).join('\n')}

---

## Week4 Guarantees

| Guarantee | Value |
|-----------|-------|
| **No Real Write** | ${plan.GUARANTEE.no_real_write ? '✅ True' : '❌ False'} |
| **Write Calls Attempted** | ${plan.GUARANTEE.write_calls_attempted} |

> **Note**: This is a frozen execution plan. All write operations are dry-run only.
> Real execution requires separate authorization (WRITE_ENABLED=1) and is NOT available in Week4.

---

## Links

- **Trace Directory**: \`.liye/traces/${plan.trace_id}/\`
- **Events Log**: \`.liye/traces/${plan.trace_id}/events.ndjson\`
- **Approval Status**: \`.liye/traces/${plan.trace_id}/approval.json\`

---

*Generated by LiYe OS Action Plan Writer (Week4)*
`;
}

/**
 * Check if action plan exists for a trace
 */
export function actionPlanExists(traceId, baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const filePath = join(traceBaseDir, traceId, 'action_plan.json');
  return existsSync(filePath);
}

/**
 * Get action plan path
 */
export function getActionPlanPath(traceId, kind = 'json', baseDir) {
  const traceBaseDir = baseDir || TRACE_BASE_DIR;
  const fileName = kind === 'md' ? 'action_plan.md' : 'action_plan.json';
  return join(traceBaseDir, traceId, fileName);
}

export default { writeActionPlan, actionPlanExists, getActionPlanPath };
