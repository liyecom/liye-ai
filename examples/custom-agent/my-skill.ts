/**
 * Custom Skill Example
 *
 * Demonstrates how to create an atomic skill
 */

import { Skill, SkillInput, SkillOutput } from '../../src/skill/types';

export const data_validation: Skill = {
  // === Metadata ===
  id: 'data_validation',
  name: 'Data Validation',
  version: '1.0.0',
  description: 'Validate data quality and completeness',
  category: 'data-processing',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        required: true,
        description: 'Array of data records to validate'
      },
      rules: {
        type: 'object',
        description: 'Validation rules to apply',
        properties: {
          required_fields: { type: 'array', items: { type: 'string' } },
          min_records: { type: 'number', default: 1 },
          max_null_ratio: { type: 'number', default: 0.1 }
        }
      }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      total_records: { type: 'number' },
      valid_records: { type: 'number' },
      invalid_records: { type: 'number' },
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            issue: { type: 'string' },
            count: { type: 'number' }
          }
        }
      },
      quality_score: { type: 'number' }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const { data, rules = {} } = input;
    const {
      required_fields = [],
      min_records = 1,
      max_null_ratio = 0.1
    } = rules;

    const issues: any[] = [];
    let validCount = 0;
    let invalidCount = 0;

    // Check minimum records
    if (data.length < min_records) {
      issues.push({
        field: '_records',
        issue: `Insufficient records: ${data.length} < ${min_records}`,
        count: 1
      });
    }

    // Validate each record
    for (const record of data) {
      let isValid = true;

      // Check required fields
      for (const field of required_fields) {
        if (record[field] === undefined || record[field] === null) {
          isValid = false;
          const existing = issues.find(i => i.field === field);
          if (existing) {
            existing.count++;
          } else {
            issues.push({
              field,
              issue: 'Missing required field',
              count: 1
            });
          }
        }
      }

      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    // Calculate quality score
    const qualityScore = data.length > 0
      ? (validCount / data.length) * 100
      : 0;

    return {
      valid: invalidCount === 0 && issues.length === 0,
      total_records: data.length,
      valid_records: validCount,
      invalid_records: invalidCount,
      issues,
      quality_score: Math.round(qualityScore * 100) / 100
    };
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    return Array.isArray(input.data);
  }
};

export default data_validation;
