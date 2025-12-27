/**
 * LiYe AI Domain Skill - TES Calculation
 * Location: src/domain/amazon-growth/skills/atomic/tes_calculation.ts
 *
 * TES (Traffic Efficiency Score) = (月搜索量 × 购买率) / (标题密度 + 1)
 */

import { Skill, SkillInput, SkillOutput } from '../../../../skill/types';

export const tes_calculation: Skill = {
  // === Metadata ===
  id: 'tes_calculation',
  name: 'TES Calculation',
  version: '1.0.0',
  description: 'Calculate Traffic Efficiency Score for keywords',
  category: 'amazon-optimization',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      keyword: { type: 'string', required: true, description: 'Keyword to calculate TES for' },
      monthly_search_volume: { type: 'number', required: true, description: 'Monthly search volume' },
      purchase_rate: { type: 'number', required: true, description: 'Purchase rate (0-1)' },
      title_density: { type: 'number', required: true, description: 'Number of titles containing keyword' }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      keyword: { type: 'string' },
      tes_score: { type: 'number', description: 'TES score' },
      tier: { type: 'string', enum: ['winner', 'potential', 'broad'], description: 'TES tier classification' },
      recommendation: { type: 'string', description: 'Action recommendation' }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const { keyword, monthly_search_volume, purchase_rate, title_density } = input;

    // TES Formula: (月搜索量 × 购买率) / (标题密度 + 1)
    const tes_score = (monthly_search_volume * purchase_rate) / (title_density + 1);

    // Tier classification
    let tier: string;
    let recommendation: string;

    if (tes_score > 100) {
      tier = 'winner';
      recommendation = '高优先级关键词，建议重点投放并埋入Listing';
    } else if (tes_score >= 10) {
      tier = 'potential';
      recommendation = '潜力关键词，建议测试后根据效果调整';
    } else {
      tier = 'broad';
      recommendation = '长尾关键词，适合广泛匹配或后台关键词';
    }

    return {
      keyword,
      tes_score: Math.round(tes_score * 100) / 100,
      tier,
      recommendation
    };
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    return (
      typeof input.keyword === 'string' &&
      typeof input.monthly_search_volume === 'number' &&
      typeof input.purchase_rate === 'number' &&
      typeof input.title_density === 'number' &&
      input.purchase_rate >= 0 &&
      input.purchase_rate <= 1
    );
  }
};

export default tes_calculation;
