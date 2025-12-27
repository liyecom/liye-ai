/**
 * LiYe AI Domain Skill - Review Analysis
 * Location: src/domain/amazon-growth/skills/atomic/review_analysis.ts
 *
 * Analyze Amazon product reviews for insights
 */

import { Skill, SkillInput, SkillOutput } from '../../../../skill/types';

export const review_analysis: Skill = {
  // === Metadata ===
  id: 'review_analysis',
  name: 'Review Analysis',
  version: '1.0.0',
  description: 'Analyze Amazon product reviews for customer insights',
  category: 'amazon-research',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      reviews: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          properties: {
            rating: { type: 'number' },
            title: { type: 'string' },
            body: { type: 'string' },
            date: { type: 'string' }
          }
        }
      },
      focus: { type: 'string', enum: ['negative', 'positive', 'all'], default: 'all' }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      total_reviews: { type: 'number' },
      average_rating: { type: 'number' },
      sentiment_breakdown: {
        type: 'object',
        properties: {
          positive: { type: 'number' },
          neutral: { type: 'number' },
          negative: { type: 'number' }
        }
      },
      themes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
            count: { type: 'number' },
            sentiment: { type: 'string' }
          }
        }
      },
      conversion_blockers: { type: 'array', items: { type: 'string' } },
      selling_points: { type: 'array', items: { type: 'string' } },
      recommendations: { type: 'array', items: { type: 'string' } }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const reviews = input.reviews || [];
    const totalReviews = reviews.length;

    // Calculate average rating
    const avgRating = totalReviews > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / totalReviews
      : 0;

    // Sentiment breakdown
    const positive = reviews.filter((r: any) => r.rating >= 4).length;
    const negative = reviews.filter((r: any) => r.rating <= 2).length;
    const neutral = totalReviews - positive - negative;

    return {
      total_reviews: totalReviews,
      average_rating: Math.round(avgRating * 100) / 100,
      sentiment_breakdown: {
        positive,
        neutral,
        negative
      },
      themes: [],
      conversion_blockers: [],
      selling_points: [],
      recommendations: []
    };
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    return Array.isArray(input.reviews);
  }
};

export default review_analysis;
