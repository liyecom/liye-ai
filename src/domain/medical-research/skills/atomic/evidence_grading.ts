/**
 * LiYe AI Domain Skill - Evidence Grading
 * Location: src/domain/medical-research/skills/atomic/evidence_grading.ts
 *
 * Grade evidence quality using GRADE methodology
 */

import { Skill, SkillInput, SkillOutput } from '../../../../skill/types';

// GRADE Evidence Levels
type EvidenceLevel = 'high' | 'moderate' | 'low' | 'very_low';

interface GradeDomain {
  risk_of_bias: number;        // 0-2: none, serious, very serious
  inconsistency: number;       // 0-2
  indirectness: number;        // 0-2
  imprecision: number;         // 0-2
  publication_bias: number;    // 0-1: none, suspected
}

export const evidence_grading: Skill = {
  // === Metadata ===
  id: 'evidence_grading',
  name: 'GRADE Evidence Grading',
  version: '1.0.0',
  description: 'Grade evidence quality using GRADE (Grading of Recommendations Assessment, Development and Evaluation) methodology',
  category: 'medical-research',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      study_design: {
        type: 'string',
        required: true,
        enum: ['rct', 'observational', 'case_series', 'case_report', 'expert_opinion'],
        description: 'Type of study design'
      },
      domains: {
        type: 'object',
        required: true,
        properties: {
          risk_of_bias: {
            type: 'number',
            enum: [0, 1, 2],
            description: '0=no limitation, 1=serious, 2=very serious'
          },
          inconsistency: { type: 'number', enum: [0, 1, 2] },
          indirectness: { type: 'number', enum: [0, 1, 2] },
          imprecision: { type: 'number', enum: [0, 1, 2] },
          publication_bias: { type: 'number', enum: [0, 1] }
        }
      },
      upgrade_factors: {
        type: 'object',
        properties: {
          large_effect: { type: 'boolean', default: false },
          dose_response: { type: 'boolean', default: false },
          confounders_reduce_effect: { type: 'boolean', default: false }
        }
      }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      evidence_level: {
        type: 'string',
        enum: ['high', 'moderate', 'low', 'very_low']
      },
      starting_level: { type: 'string' },
      downgrades: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            domain: { type: 'string' },
            severity: { type: 'string' },
            reason: { type: 'string' }
          }
        }
      },
      upgrades: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            factor: { type: 'string' },
            reason: { type: 'string' }
          }
        }
      },
      summary: { type: 'string' },
      confidence_statement: { type: 'string' }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const { study_design, domains, upgrade_factors = {} } = input;

    // Starting level based on study design
    let level = study_design === 'rct' ? 4 : 2; // RCT starts at High(4), Observational at Low(2)
    const starting_level = study_design === 'rct' ? 'high' : 'low';

    const downgrades: any[] = [];
    const upgrades: any[] = [];

    // Apply downgrades for GRADE domains
    const domainNames = ['risk_of_bias', 'inconsistency', 'indirectness', 'imprecision', 'publication_bias'];
    for (const domain of domainNames) {
      const score = domains[domain] || 0;
      if (score > 0) {
        level -= score;
        downgrades.push({
          domain,
          severity: score === 2 ? 'very serious' : 'serious',
          reason: `${domain.replace('_', ' ')} concern detected`
        });
      }
    }

    // Apply upgrades (only for observational studies)
    if (study_design === 'observational') {
      if (upgrade_factors.large_effect) {
        level += 1;
        upgrades.push({ factor: 'large_effect', reason: 'Large magnitude of effect (RR > 2 or < 0.5)' });
      }
      if (upgrade_factors.dose_response) {
        level += 1;
        upgrades.push({ factor: 'dose_response', reason: 'Dose-response gradient present' });
      }
      if (upgrade_factors.confounders_reduce_effect) {
        level += 1;
        upgrades.push({ factor: 'confounders', reason: 'All plausible confounders would reduce effect' });
      }
    }

    // Clamp level to valid range
    level = Math.max(1, Math.min(4, level));

    // Map numeric level to evidence level
    const levelMap: { [key: number]: EvidenceLevel } = {
      4: 'high',
      3: 'moderate',
      2: 'low',
      1: 'very_low'
    };
    const evidence_level = levelMap[level];

    // Generate confidence statement
    const confidenceStatements: { [key: string]: string } = {
      high: '我们非常有信心，真实效果接近估计效果',
      moderate: '我们对效果估计有中等信心，真实效果可能接近估计效果，但也可能存在实质差异',
      low: '我们对效果估计的信心有限，真实效果可能与估计效果有实质差异',
      very_low: '我们对效果估计几乎没有信心，真实效果很可能与估计效果有实质差异'
    };

    return {
      evidence_level,
      starting_level,
      downgrades,
      upgrades,
      summary: `Evidence graded as ${evidence_level.toUpperCase()} based on ${study_design} with ${downgrades.length} downgrade(s) and ${upgrades.length} upgrade(s)`,
      confidence_statement: confidenceStatements[evidence_level]
    };
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    const validDesigns = ['rct', 'observational', 'case_series', 'case_report', 'expert_opinion'];
    return (
      validDesigns.includes(input.study_design) &&
      input.domains &&
      typeof input.domains === 'object'
    );
  }
};

export default evidence_grading;
