/**
 * LiYe AI Domain Skill - PPC Analysis
 * Location: src/domain/amazon-growth/skills/atomic/ppc_analysis.ts
 *
 * Analyze Amazon PPC campaign performance
 */

import { Skill, SkillInput, SkillOutput } from '../../../../skill/types';

export const ppc_analysis: Skill = {
  // === Metadata ===
  id: 'ppc_analysis',
  name: 'PPC Analysis',
  version: '1.0.0',
  description: 'Analyze Amazon PPC campaign performance and optimization opportunities',
  category: 'amazon-advertising',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      campaign_data: {
        type: 'object',
        required: true,
        properties: {
          impressions: { type: 'number' },
          clicks: { type: 'number' },
          spend: { type: 'number' },
          sales: { type: 'number' },
          orders: { type: 'number' }
        }
      },
      target_acos: { type: 'number', default: 0.25, description: 'Target ACOS (0-1)' },
      period: { type: 'string', default: '7d', description: 'Analysis period' }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      metrics: {
        type: 'object',
        properties: {
          acos: { type: 'number' },
          roas: { type: 'number' },
          ctr: { type: 'number' },
          cvr: { type: 'number' },
          cpc: { type: 'number' }
        }
      },
      performance: { type: 'string', enum: ['excellent', 'good', 'needs_attention', 'poor'] },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            reason: { type: 'string' },
            priority: { type: 'string' }
          }
        }
      },
      bid_adjustments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            target: { type: 'string' },
            current_bid: { type: 'number' },
            suggested_bid: { type: 'number' },
            change_pct: { type: 'number' }
          }
        }
      }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const { campaign_data, target_acos } = input;
    const { impressions, clicks, spend, sales, orders } = campaign_data;

    // Calculate metrics
    const acos = sales > 0 ? spend / sales : 0;
    const roas = spend > 0 ? sales / spend : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? orders / clicks : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;

    // Determine performance level
    let performance: string;
    if (acos < target_acos * 0.8) {
      performance = 'excellent';
    } else if (acos < target_acos) {
      performance = 'good';
    } else if (acos < target_acos * 1.5) {
      performance = 'needs_attention';
    } else {
      performance = 'poor';
    }

    // Generate recommendations based on ACOS分层竞价策略
    const recommendations = [];
    if (acos < 0.15) {
      recommendations.push({
        action: '提价10-20%',
        reason: 'ACOS < 15%，有提高曝光空间',
        priority: 'high'
      });
    } else if (acos > 0.35) {
      recommendations.push({
        action: '降价20%或暂停',
        reason: 'ACOS > 35%，ROI过低',
        priority: 'urgent'
      });
    } else if (acos > 0.25) {
      recommendations.push({
        action: '降价10-15%',
        reason: 'ACOS 25-35%，需要优化',
        priority: 'medium'
      });
    }

    return {
      metrics: {
        acos: Math.round(acos * 10000) / 100,
        roas: Math.round(roas * 100) / 100,
        ctr: Math.round(ctr * 10000) / 100,
        cvr: Math.round(cvr * 10000) / 100,
        cpc: Math.round(cpc * 100) / 100
      },
      performance,
      recommendations,
      bid_adjustments: []
    };
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    return (
      input.campaign_data &&
      typeof input.campaign_data.impressions === 'number' &&
      typeof input.campaign_data.clicks === 'number' &&
      typeof input.campaign_data.spend === 'number' &&
      typeof input.campaign_data.sales === 'number'
    );
  }
};

export default ppc_analysis;
