/**
 * Agent v5.0 Validator
 * Validates agents against AGENT_SPEC.md v5.0
 */

const REQUIRED_FIELDS = {
  agent: {
    required: ['id', 'name', 'version', 'domain'],
    rules: {
      id: { type: 'string', pattern: /^[a-z][a-z0-9-]*$/ },
      name: { type: 'string' },
      version: { type: 'string', pattern: /^\d+\.\d+\.\d+$/ },
      domain: { type: 'string' },
    }
  },
  persona: {
    required: ['role', 'goal', 'backstory', 'communication_style'],
    rules: {
      role: { type: 'string' },
      goal: { type: 'string' },
      backstory: { type: 'string' },
      communication_style: { type: 'string' },
    }
  },
  skills: {
    required: [],
    rules: {
      atomic: { type: 'array' },
      composite: { type: 'array' },
    }
  },
  runtime: {
    required: ['process', 'memory', 'delegation', 'max_iterations'],
    rules: {
      process: { type: 'string', enum: ['sequential', 'hierarchical', 'parallel'] },
      memory: { type: 'boolean' },
      delegation: { type: 'boolean' },
      max_iterations: { type: 'number' },
    }
  },
  liyedata: {
    required: [],
    rules: {
      workflow_stage: { type: 'string' },
      acceptance_criteria: { type: 'array' },
      guardrails: { type: 'object' },
    }
  },
  evolution: {
    required: ['enabled'],
    rules: {
      enabled: { type: 'boolean' },
    }
  }
};

// Red line violations (AGENT_SPEC §7)
const RED_LINES = [
  {
    id: 'skill-implementation',
    description: 'Agent must not implement Skills',
    check: (yaml) => !yaml.tools || yaml.tools.length === 0,
    message: 'Found "tools" field - use "skills" referencing src/skill/'
  },
  {
    id: 'workflow-definition',
    description: 'Agent must not define Workflow',
    check: (yaml) => !yaml.workflow && !yaml.phases,
    message: 'Found workflow/phases - belongs to Method layer'
  },
  {
    id: 'bmaddata-deprecated',
    description: 'bmaddata deprecated, use liyedata',
    check: (yaml) => !yaml.bmaddata,
    message: 'Found "bmaddata" - rename to "liyedata"'
  },
  {
    id: 'evolution-simple',
    description: 'Evolution only enabled/disabled',
    check: (yaml) => {
      if (!yaml.evolution) return true;
      const keys = Object.keys(yaml.evolution);
      return keys.length === 1 && keys[0] === 'enabled';
    },
    message: 'Evolution has extra fields - only "enabled" allowed'
  }
];

function getType(val) {
  if (Array.isArray(val)) return 'array';
  return val === null ? 'null' : (val === undefined ? 'undefined' : val.constructor.name.toLowerCase());
}

function validateAgentV5(yaml, agentName) {
  const errors = [];
  const warnings = [];
  const passed = [];

  // Check required sections
  const sections = ['agent', 'persona', 'skills', 'runtime', 'evolution'];
  for (const section of sections) {
    if (!yaml[section]) {
      errors.push({
        field: section,
        message: 'Missing required section: ' + section,
        spec: 'AGENT_SPEC.md §3'
      });
    }
  }

  // Validate each section
  for (const [section, spec] of Object.entries(REQUIRED_FIELDS)) {
    if (!yaml[section]) continue;

    for (const field of spec.required) {
      if (yaml[section][field] === undefined) {
        errors.push({
          field: section + '.' + field,
          message: 'Missing required field',
          spec: 'AGENT_SPEC.md §4'
        });
      } else {
        passed.push(section + '.' + field);
      }
    }

    for (const [field, rule] of Object.entries(spec.rules)) {
      const value = yaml[section][field];
      if (value === undefined) continue;

      const actualType = getType(value);
      if (rule.type && actualType !== rule.type) {
        errors.push({
          field: section + '.' + field,
          message: 'Expected ' + rule.type + ', got ' + actualType,
          spec: 'AGENT_SPEC.md §4'
        });
      }

      if (rule.pattern && actualType === 'string' && !rule.pattern.test(value)) {
        errors.push({
          field: section + '.' + field,
          message: 'Value does not match pattern',
          spec: 'AGENT_SPEC.md §4'
        });
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({
          field: section + '.' + field,
          message: 'Value not in: ' + rule.enum.join(', '),
          spec: 'AGENT_SPEC.md §4'
        });
      }
    }
  }

  // Check red lines
  for (const redLine of RED_LINES) {
    if (!redLine.check(yaml)) {
      errors.push({
        field: redLine.id,
        message: redLine.message,
        spec: 'AGENT_SPEC.md §7',
        severity: 'critical'
      });
    }
  }

  // Warnings
  if (!yaml.liyedata) {
    warnings.push({
      field: 'liyedata',
      message: 'Missing optional liyedata section',
      spec: 'AGENT_SPEC.md §5'
    });
  }

  return { errors, warnings, passed };
}

module.exports = { validateAgentV5, REQUIRED_FIELDS, RED_LINES };
