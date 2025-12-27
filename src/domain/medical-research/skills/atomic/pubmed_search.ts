/**
 * LiYe AI Domain Skill - PubMed Search
 * Location: src/domain/medical-research/skills/atomic/pubmed_search.ts
 *
 * Search PubMed/MEDLINE for medical literature
 */

import { Skill, SkillInput, SkillOutput } from '../../../../skill/types';

export const pubmed_search: Skill = {
  // === Metadata ===
  id: 'pubmed_search',
  name: 'PubMed Literature Search',
  version: '1.0.0',
  description: 'Search PubMed/MEDLINE database for medical literature using structured queries',
  category: 'medical-research',

  // === Input Schema ===
  input: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        required: true,
        description: 'Search query (supports MeSH terms and Boolean operators)'
      },
      filters: {
        type: 'object',
        properties: {
          publication_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Filter by publication type (RCT, Meta-Analysis, Review, etc.)'
          },
          date_range: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' }
            }
          },
          languages: {
            type: 'array',
            items: { type: 'string' },
            default: ['eng']
          },
          humans_only: { type: 'boolean', default: true }
        }
      },
      max_results: { type: 'number', default: 50 },
      sort_by: {
        type: 'string',
        enum: ['relevance', 'date', 'citation_count'],
        default: 'relevance'
      }
    }
  },

  // === Output Schema ===
  output: {
    type: 'object',
    properties: {
      total_found: { type: 'number' },
      articles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pmid: { type: 'string' },
            title: { type: 'string' },
            authors: { type: 'array', items: { type: 'string' } },
            journal: { type: 'string' },
            publication_date: { type: 'string' },
            abstract: { type: 'string' },
            doi: { type: 'string' },
            publication_type: { type: 'string' },
            mesh_terms: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      search_strategy: { type: 'string' },
      executed_query: { type: 'string' }
    }
  },

  // === Execution ===
  async execute(input: SkillInput): Promise<SkillOutput> {
    const { query, filters = {}, max_results = 50, sort_by = 'relevance' } = input;

    // Build PubMed query with filters
    let executed_query = query;
    if (filters.humans_only) {
      executed_query += ' AND "humans"[MeSH Terms]';
    }
    if (filters.publication_types?.length) {
      const ptFilter = filters.publication_types
        .map((pt: string) => `"${pt}"[Publication Type]`)
        .join(' OR ');
      executed_query += ` AND (${ptFilter})`;
    }

    // Note: Actual PubMed API integration would go here
    // This is a scaffold for the skill structure

    return {
      total_found: 0,
      articles: [],
      search_strategy: 'Systematic search with MeSH terms and filters',
      executed_query
    };
  },

  // === Validation ===
  validate(input: SkillInput): boolean {
    return typeof input.query === 'string' && input.query.length > 0;
  }
};

export default pubmed_search;
