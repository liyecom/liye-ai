#!/usr/bin/env node
/**
 * Governance Protocol v1 Schema Validator (Zero-Dep)
 *
 * Validates that all 4 frozen schemas are:
 * 1. Valid JSON
 * 2. Have correct JSON Schema 2020-12 declaration
 * 3. Have additionalProperties: false (drift prevention)
 * 4. Have reasonable required fields
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, '..', '..', 'contracts', 'governance', 'v1');

const SCHEMAS = [
  'gate-report.schema.json',
  'contract.schema.json',
  'trace-event.schema.json',
  'verdict.schema.json'
];

let exitCode = 0;

console.log('='.repeat(50));
console.log('Governance Protocol v1 Schema Validation');
console.log('='.repeat(50));
console.log();

for (const schemaFile of SCHEMAS) {
  const schemaPath = join(SCHEMA_DIR, schemaFile);
  const errors = [];

  // Check 1: File exists
  if (!existsSync(schemaPath)) {
    console.log(`✗ ${schemaFile}: File not found`);
    exitCode = 1;
    continue;
  }

  // Check 2: Valid JSON
  let schema;
  try {
    const content = readFileSync(schemaPath, 'utf-8');
    schema = JSON.parse(content);
  } catch (err) {
    console.log(`✗ ${schemaFile}: Invalid JSON - ${err.message}`);
    exitCode = 1;
    continue;
  }

  // Check 3: Has $schema declaration (JSON Schema 2020-12)
  if (!schema.$schema?.includes('2020-12')) {
    errors.push(`$schema should be 2020-12, got: ${schema.$schema}`);
  }

  // Check 4: Has $id
  if (!schema.$id) {
    errors.push('Missing $id');
  }

  // Check 5: Has title
  if (!schema.title) {
    errors.push('Missing title');
  }

  // Check 6: additionalProperties: false (drift prevention)
  if (schema.additionalProperties !== false) {
    errors.push('additionalProperties must be false (drift prevention)');
  }

  // Check 7: Has required fields
  if (!Array.isArray(schema.required) || schema.required.length === 0) {
    errors.push('Missing or empty required array');
  }

  // Check 8: type is object
  if (schema.type !== 'object') {
    errors.push(`type should be "object", got: ${schema.type}`);
  }

  // Check 9: Has properties
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    errors.push('Missing or empty properties');
  }

  // Print result
  if (errors.length === 0) {
    console.log(`✓ ${schemaFile}`);
    console.log(`  - title: ${schema.title}`);
    console.log(`  - required: [${schema.required.join(', ')}]`);
    console.log(`  - properties: ${Object.keys(schema.properties).length} fields`);
  } else {
    console.log(`✗ ${schemaFile}`);
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
    exitCode = 1;
  }
  console.log();
}

// Summary
console.log('='.repeat(50));
console.log(`Result: ${exitCode === 0 ? '4/4' : 'FAIL'} schemas valid`);

if (exitCode === 0) {
  console.log('\n✓ All schemas frozen and valid. Protocol v1 ready.');
} else {
  console.log('\n✗ Schema validation failed.');
}

process.exit(exitCode);
