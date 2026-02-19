#!/usr/bin/env node
/**
 * Cost Meter Validator v1.0.0
 * SSOT: _meta/contracts/scripts/validate-cost-meter.mjs
 *
 * Validates cost_meter configuration and events against schema.
 *
 * Usage:
 *   node _meta/contracts/scripts/validate-cost-meter.mjs
 *   node _meta/contracts/scripts/validate-cost-meter.mjs --facts <path.jsonl>
 *
 * Exit codes: 0 = passed, 1 = errors (fail-closed)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const SCHEMA_FILE = join(__dirname, '..', 'proactive', 'cost_meter.schema.yaml');
const CONFIG_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'cost_meter.json');
const STATE_FILE = join(PROJECT_ROOT, 'state', 'runtime', 'proactive', 'cost_meter_state.json');
const FACTS_FILE = join(PROJECT_ROOT, 'data', 'facts', 'fact_cost_events.jsonl');

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let errorCount = 0;
let warningCount = 0;
let passCount = 0;

function logError(file, message) {
  console.error(`${RED}❌ ${file}${RESET}: ${message}`);
  errorCount++;
}

function logWarning(file, message) {
  console.warn(`${YELLOW}⚠️  ${file}${RESET}: ${message}`);
  warningCount++;
}

function logPass(file) {
  console.log(`${GREEN}✅ ${file}${RESET}`);
  passCount++;
}

/**
 * Load schema YAML
 */
function loadSchema() {
  if (!existsSync(SCHEMA_FILE)) {
    console.error(`${RED}Schema file not found: ${SCHEMA_FILE}${RESET}`);
    process.exit(1);
  }
  try {
    const content = readFileSync(SCHEMA_FILE, 'utf-8');
    return parseYaml(content);
  } catch (e) {
    console.error(`${RED}Failed to parse schema: ${e.message}${RESET}`);
    process.exit(1);
  }
}

/**
 * Validate object against schema definition
 */
function validateObject(data, schemaDef, filePath) {
  const errors = [];
  const required = schemaDef.required || [];
  const properties = schemaDef.properties || {};

  // Check required fields
  for (const field of required) {
    const fieldSchema = properties[field];
    const isNullable = fieldSchema?.nullable === true;

    if (!(field in data) || data[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    } else if (data[field] === null && !isNullable) {
      errors.push(`Field '${field}' cannot be null`);
    }
  }

  // Check additionalProperties
  if (schemaDef.additionalProperties === false) {
    const allowedKeys = Object.keys(properties);
    for (const key of Object.keys(data)) {
      if (!allowedKeys.includes(key)) {
        errors.push(`Unknown field '${key}' not allowed (additionalProperties: false)`);
      }
    }
  }

  // Check field types and constraints
  for (const [key, value] of Object.entries(data)) {
    const fieldSchema = properties[key];
    if (!fieldSchema) continue;

    // Skip type check for nullable fields with null value
    const isNullable = fieldSchema.nullable === true;
    if (value === null && isNullable) continue;

    // Type check
    if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`Field '${key}' must be boolean, got ${typeof value}`);
    }
    if (fieldSchema.type === 'integer' && !Number.isInteger(value)) {
      errors.push(`Field '${key}' must be integer, got ${typeof value}`);
    }
    if (fieldSchema.type === 'number' && typeof value !== 'number') {
      errors.push(`Field '${key}' must be number, got ${typeof value}`);
    }
    if (fieldSchema.type === 'string' && typeof value !== 'string') {
      errors.push(`Field '${key}' must be string, got ${typeof value}`);
    }

    // Enum check
    if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
      errors.push(`Field '${key}' must be one of [${fieldSchema.enum.join(', ')}], got ${value}`);
    }

    // Range check
    if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
      errors.push(`Field '${key}' must be >= ${fieldSchema.minimum}, got ${value}`);
    }
    if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
      errors.push(`Field '${key}' must be <= ${fieldSchema.maximum}, got ${value}`);
    }

    // Pattern check
    if (fieldSchema.pattern && typeof value === 'string') {
      const regex = new RegExp(fieldSchema.pattern);
      if (!regex.test(value)) {
        errors.push(`Field '${key}' does not match pattern ${fieldSchema.pattern}`);
      }
    }

    // Nested object
    if (fieldSchema.type === 'object' && typeof value === 'object' && value !== null) {
      const nestedErrors = validateObject(value, fieldSchema, `${filePath}.${key}`);
      errors.push(...nestedErrors.map(e => `${key}.${e}`));
    }
  }

  return errors;
}

/**
 * Validate cost_meter.json (configuration)
 */
function validateConfig(schema) {
  console.log('\n📋 Validating cost_meter.json (configuration)...\n');

  if (!existsSync(CONFIG_FILE)) {
    logWarning(CONFIG_FILE, 'Config file not found (will use defaults)');
    return;
  }

  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    const configSchema = schema.definitions.cost_meter_config;
    const errors = validateObject(data, configSchema, 'cost_meter.json');

    if (errors.length > 0) {
      for (const err of errors) {
        logError('cost_meter.json', err);
      }
    } else {
      logPass('cost_meter.json');
    }
  } catch (e) {
    logError(CONFIG_FILE, `Failed to parse JSON: ${e.message}`);
  }
}

/**
 * Validate cost_meter_state.json
 */
function validateState(schema) {
  console.log('\n📋 Validating cost_meter_state.json...\n');

  if (!existsSync(STATE_FILE)) {
    logWarning(STATE_FILE, 'State file not found (will be created on first run)');
    return;
  }

  try {
    const data = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    const stateSchema = schema.definitions.cost_meter_state;
    const errors = validateObject(data, stateSchema, 'cost_meter_state.json');

    if (errors.length > 0) {
      for (const err of errors) {
        logError('cost_meter_state.json', err);
      }
    } else {
      logPass('cost_meter_state.json');
    }
  } catch (e) {
    logError(STATE_FILE, `Failed to parse JSON: ${e.message}`);
  }
}

/**
 * Validate fact_cost_events.jsonl (sample validation)
 */
function validateFacts(schema, factsPath = null) {
  console.log('\n📋 Validating cost events facts...\n');

  const filePath = factsPath || FACTS_FILE;

  if (!existsSync(filePath)) {
    logWarning(filePath, 'Facts file not found (will be created on first run)');
    return;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      logWarning(filePath, 'Facts file is empty');
      return;
    }

    const eventSchema = schema.definitions.cost_event;
    let validCount = 0;

    // Validate first 10 lines (sample)
    const sampleSize = Math.min(10, lines.length);
    for (let i = 0; i < sampleSize; i++) {
      try {
        const event = JSON.parse(lines[i]);
        const errors = validateObject(event, eventSchema, `line ${i + 1}`);

        if (errors.length > 0) {
          for (const err of errors) {
            logError(`${filePath}:${i + 1}`, err);
          }
        } else {
          validCount++;
        }
      } catch (e) {
        logError(`${filePath}:${i + 1}`, `Invalid JSON: ${e.message}`);
      }
    }

    if (validCount === sampleSize) {
      logPass(`${filePath} (sampled ${sampleSize}/${lines.length} lines)`);
    }
  } catch (e) {
    logError(filePath, `Failed to read: ${e.message}`);
  }
}

/**
 * Validate schema itself
 */
function validateSchemaStructure(schema) {
  console.log('\n📋 Validating cost_meter.schema.yaml...\n');

  const requiredDefs = ['cost_meter_config', 'cost_meter_state', 'cost_event'];

  for (const def of requiredDefs) {
    if (!schema.definitions?.[def]) {
      logError('cost_meter.schema.yaml', `Missing definition: ${def}`);
    }
  }

  if (!schema.$schema) {
    logWarning('cost_meter.schema.yaml', 'Missing $schema declaration');
  }

  if (!schema.$id) {
    logWarning('cost_meter.schema.yaml', 'Missing $id declaration');
  }

  if (errorCount === 0) {
    logPass('cost_meter.schema.yaml');
  }
}

/**
 * Parse CLI args
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { factsPath: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--facts' && args[i + 1]) {
      result.factsPath = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node validate-cost-meter.mjs [options]

Options:
  --facts <path>   Validate a specific facts JSONL file
  --help, -h       Show this help message

Examples:
  node validate-cost-meter.mjs
  node validate-cost-meter.mjs --facts data/facts/fact_cost_events.jsonl
`);
      process.exit(0);
    }
  }

  return result;
}

/**
 * Main
 */
async function main() {
  const args = parseArgs();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('           Cost Meter Validator v1.0.0');
  console.log('           SSOT: _meta/contracts/proactive/');
  console.log('═══════════════════════════════════════════════════════════');

  const schema = loadSchema();

  // 1. Validate schema itself
  validateSchemaStructure(schema);

  // 2. Validate config
  validateConfig(schema);

  // 3. Validate state
  validateState(schema);

  // 4. Validate facts
  validateFacts(schema, args.factsPath);

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('           Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ${GREEN}✅ Passed: ${passCount}${RESET}`);
  console.log(`  ${YELLOW}⚠️  Warnings: ${warningCount}${RESET}`);
  console.log(`  ${RED}❌ Errors: ${errorCount}${RESET}`);
  console.log('═══════════════════════════════════════════════════════════');

  if (errorCount > 0) {
    console.log(`\n${RED}FAILED: ${errorCount} error(s) found.${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`\n${GREEN}PASSED: Cost meter contracts valid.${RESET}\n`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(`${RED}Fatal error: ${e.message}${RESET}`);
  process.exit(1);
});
