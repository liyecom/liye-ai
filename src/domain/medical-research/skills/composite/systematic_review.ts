/**
 * LiYe AI Domain Composite Skill - Systematic Review
 * Location: src/domain/medical-research/skills/composite/systematic_review.ts
 *
 * Conduct systematic literature review following PRISMA guidelines
 */

import { CompositeSkill } from '../../../../skill/types';

export const systematic_review: CompositeSkill = {
  id: 'systematic_review',
  name: 'Systematic Literature Review',
  version: '1.0.0',
  description: 'Conduct systematic review following PRISMA guidelines: search, screen, extract, grade, synthesize',

  // === Skill Chain ===
  chain: [
    {
      skill: 'pubmed_search',
      input_mapping: {
        query: 'input.search_query',
        filters: 'input.search_filters'
      },
      output_alias: 'search_results'
    },
    {
      skill: 'abstract_screening',
      input_mapping: {
        articles: 'search_results.articles',
        inclusion_criteria: 'input.inclusion_criteria',
        exclusion_criteria: 'input.exclusion_criteria'
      },
      output_alias: 'screened_articles'
    },
    {
      skill: 'data_extraction',
      input_mapping: {
        articles: 'screened_articles.included',
        extraction_template: 'input.extraction_template'
      },
      output_alias: 'extracted_data'
    },
    {
      skill: 'evidence_grading',
      input_mapping: {
        studies: 'extracted_data.studies'
      },
      output_alias: 'graded_evidence'
    },
    {
      skill: 'evidence_synthesis',
      input_mapping: {
        graded_studies: 'graded_evidence',
        synthesis_method: 'input.synthesis_method'
      },
      output_alias: 'synthesis'
    }
  ],

  // === Final Output Mapping ===
  output_mapping: {
    // PRISMA Flow Diagram Data
    prisma_flow: {
      identified: 'search_results.total_found',
      screened: 'screened_articles.total_screened',
      excluded_abstract: 'screened_articles.excluded_count',
      full_text_assessed: 'screened_articles.included.length',
      excluded_full_text: 'extracted_data.excluded_count',
      included_synthesis: 'extracted_data.studies.length'
    },

    // Evidence Summary
    evidence_summary: 'graded_evidence',

    // Synthesis Results
    synthesis_results: 'synthesis',

    // Recommendations
    recommendations: 'calculated',

    // Quality Assessment
    overall_evidence_level: 'aggregated'
  }
};

export default systematic_review;
