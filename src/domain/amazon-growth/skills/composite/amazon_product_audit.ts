/**
 * LiYe AI Domain Composite Skill - Amazon Product Audit
 * Location: src/domain/amazon-growth/skills/composite/amazon_product_audit.ts
 *
 * Comprehensive product audit combining multiple analysis skills
 */

import { CompositeSkill } from '../../../../skill/types';

export const amazon_product_audit: CompositeSkill = {
  id: 'amazon_product_audit',
  name: 'Amazon Product Audit',
  version: '1.0.0',
  description: 'Comprehensive Amazon product audit combining ASIN research, review analysis, and competitive analysis',

  // === Skill Chain ===
  chain: [
    {
      skill: 'asin_research',
      input_mapping: {
        asin: 'input.asin',
        marketplace: 'input.marketplace'
      },
      output_alias: 'asin_data'
    },
    {
      skill: 'review_analysis',
      input_mapping: {
        reviews: 'asin_data.reviews',
        focus: 'input.review_focus'
      },
      output_alias: 'review_insights'
    },
    {
      skill: 'competitor_analysis',
      input_mapping: {
        market_data: 'asin_data',
        competitors: 'input.competitor_asins'
      },
      output_alias: 'competitive_data'
    },
    {
      skill: 'keyword_research',
      input_mapping: {
        seed_keywords: 'asin_data.main_keywords',
        market: 'input.marketplace'
      },
      output_alias: 'keyword_data'
    }
  ],

  // === Final Output Mapping ===
  output_mapping: {
    asin: 'asin_data.asin',
    product_info: 'asin_data',
    review_analysis: 'review_insights',
    competitive_position: 'competitive_data',
    keyword_opportunities: 'keyword_data',
    overall_score: 'calculated',
    recommendations: 'aggregated'
  }
};

export default amazon_product_audit;
