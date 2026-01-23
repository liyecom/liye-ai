/**
 * Schema Validator for MCP Tools
 *
 * Validates output against frozen v1 schemas using Ajv.
 * Ensures all MCP tool outputs are schema-compliant.
 */

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', '..', 'contracts', 'governance', 'v1');

// Initialize Ajv with JSON Schema 2020-12 support
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true
});
addFormats(ajv);

// Load and compile schemas
let gateReportSchema;
let verdictSchema;
let traceEventSchema;
let contractSchema;

try {
  gateReportSchema = JSON.parse(readFileSync(join(SCHEMA_DIR, 'gate-report.schema.json'), 'utf-8'));
  verdictSchema = JSON.parse(readFileSync(join(SCHEMA_DIR, 'verdict.schema.json'), 'utf-8'));
  traceEventSchema = JSON.parse(readFileSync(join(SCHEMA_DIR, 'trace-event.schema.json'), 'utf-8'));
  contractSchema = JSON.parse(readFileSync(join(SCHEMA_DIR, 'contract.schema.json'), 'utf-8'));
} catch (err) {
  console.error('Failed to load governance schemas:', err.message);
}

// Compile validators (lazy)
let validateGateReportFn;
let validateVerdictFn;
let validateTraceEventFn;
let validateContractFn;

/**
 * Get compiled validator for GateReport
 */
function getGateReportValidator() {
  if (!validateGateReportFn && gateReportSchema) {
    validateGateReportFn = ajv.compile(gateReportSchema);
  }
  return validateGateReportFn;
}

/**
 * Get compiled validator for Verdict
 */
function getVerdictValidator() {
  if (!validateVerdictFn && verdictSchema) {
    validateVerdictFn = ajv.compile(verdictSchema);
  }
  return validateVerdictFn;
}

/**
 * Get compiled validator for TraceEvent
 */
function getTraceEventValidator() {
  if (!validateTraceEventFn && traceEventSchema) {
    validateTraceEventFn = ajv.compile(traceEventSchema);
  }
  return validateTraceEventFn;
}

/**
 * Get compiled validator for Contract
 */
function getContractValidator() {
  if (!validateContractFn && contractSchema) {
    validateContractFn = ajv.compile(contractSchema);
  }
  return validateContractFn;
}

/**
 * Format Ajv errors for output
 *
 * @param {Array} errors - Ajv errors array
 * @returns {Array<string>}
 */
function formatErrors(errors) {
  if (!errors) return [];

  return errors.map(err => {
    const path = err.instancePath || '/';
    const message = err.message || 'Unknown error';
    return `${path}: ${message}`;
  });
}

/**
 * Validate GateReport against schema
 *
 * @param {Object} gateReport
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateGateReport(gateReport) {
  const validator = getGateReportValidator();

  if (!validator) {
    return {
      valid: false,
      errors: ['GateReport schema not loaded']
    };
  }

  const valid = validator(gateReport);

  return {
    valid,
    errors: valid ? [] : formatErrors(validator.errors)
  };
}

/**
 * Validate Verdict against schema
 *
 * @param {Object} verdict
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateVerdict(verdict) {
  const validator = getVerdictValidator();

  if (!validator) {
    return {
      valid: false,
      errors: ['Verdict schema not loaded']
    };
  }

  const valid = validator(verdict);

  return {
    valid,
    errors: valid ? [] : formatErrors(validator.errors)
  };
}

/**
 * Validate TraceEvent against schema
 *
 * @param {Object} traceEvent
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateTraceEvent(traceEvent) {
  const validator = getTraceEventValidator();

  if (!validator) {
    return {
      valid: false,
      errors: ['TraceEvent schema not loaded']
    };
  }

  const valid = validator(traceEvent);

  return {
    valid,
    errors: valid ? [] : formatErrors(validator.errors)
  };
}

/**
 * Validate Contract against schema
 *
 * @param {Object} contract
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateContractSchema(contract) {
  const validator = getContractValidator();

  if (!validator) {
    return {
      valid: false,
      errors: ['Contract schema not loaded']
    };
  }

  const valid = validator(contract);

  return {
    valid,
    errors: valid ? [] : formatErrors(validator.errors)
  };
}

/**
 * Get loaded schema names for debugging
 *
 * @returns {Object}
 */
export function getSchemaStatus() {
  return {
    gate_report: !!gateReportSchema,
    verdict: !!verdictSchema,
    trace_event: !!traceEventSchema,
    contract: !!contractSchema
  };
}
