/**
 * Crew Matching Regression Tests
 *
 * [P0] Validates decomposer crew matching after includes() → exact token overlap fix.
 * Covers:
 *   - Single-char tokens do NOT trigger matches
 *   - Stopwords do NOT trigger matches
 *   - Business keywords correctly match crews
 *   - Multi-crew candidates scored by overlap count
 *   - No-match returns null (rule-based fallback task)
 *   - 15+ intent → crew assertions
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  RuleBasedDecomposer,
  tokenize,
  STOPWORDS,
  MIN_TOKEN_LENGTH,
} from '../../src/runtime/orchestrator/decomposer';
import type { Intent } from '../../src/runtime/orchestrator/types';

const CREWS_DIR = path.resolve(__dirname, '../../Crews');
const AGENTS_DIR = path.resolve(__dirname, '../../Agents');

function makeIntent(goal: string, domain?: string): Intent {
  return { id: `test_${Date.now()}`, goal, domain };
}

// ============================================================
// Unit: tokenize() function
// ============================================================

describe('tokenize()', () => {
  it('filters tokens shorter than MIN_TOKEN_LENGTH', () => {
    const result = tokenize('a an be to do it or');
    expect(result).toEqual([]);
  });

  it('filters stopwords regardless of length', () => {
    const result = tokenize('given using based about also');
    expect(result).toEqual([]);
  });

  it('retains meaningful business tokens', () => {
    const result = tokenize('research market analysis competitive landscape');
    expect(result).toContain('research');
    expect(result).toContain('market');
    expect(result).toContain('analysis');
    expect(result).toContain('competitive');
    expect(result).toContain('landscape');
  });

  it('splits on hyphens, underscores, punctuation', () => {
    const result = tokenize('data-driven market_research: done!');
    expect(result).toContain('data');
    expect(result).toContain('driven');
    expect(result).toContain('market');
    expect(result).toContain('research');
    expect(result).toContain('done');
  });

  it('lowercases all tokens', () => {
    const result = tokenize('Research MARKET Analysis');
    expect(result).toEqual(['research', 'market', 'analysis']);
  });
});

// ============================================================
// Unit: STOPWORDS completeness
// ============================================================

describe('STOPWORDS', () => {
  it('contains all single-letter English words', () => {
    expect(STOPWORDS.has('a')).toBe(true);
  });

  it('contains common prepositions', () => {
    for (const w of ['in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from']) {
      expect(STOPWORDS.has(w)).toBe(true);
    }
  });

  it('contains common articles', () => {
    for (const w of ['a', 'an', 'the']) {
      expect(STOPWORDS.has(w)).toBe(true);
    }
  });

  it('contains "given" (was the P0 wildcard trigger via crew goal "on a given topic")', () => {
    expect(STOPWORDS.has('given')).toBe(true);
  });
});

// ============================================================
// Integration: Crew Matching (15+ intent → crew assertions)
// ============================================================

describe('Crew Matching — P0 Regression', () => {
  const decomposer = new RuleBasedDecomposer([CREWS_DIR], [AGENTS_DIR]);

  // Helper: decompose and check source
  async function matchCrew(goal: string, domain?: string) {
    const intent = makeIntent(goal, domain);
    const plan = await decomposer.decompose(intent);
    return plan;
  }

  // --- Group 1: Single-char / stopword intents must NOT wildcard-match ---

  it('C01: "a" alone → no-match (rule fallback)', async () => {
    const plan = await matchCrew('a');
    expect(plan.source).toBe('rule');
  });

  it('C02: Only stopwords → no-match', async () => {
    const plan = await matchCrew('do it on a given topic');
    expect(plan.source).toBe('rule');
  });

  it('C03: Short nonsense → no-match', async () => {
    const plan = await matchCrew('go to bed');
    expect(plan.source).toBe('rule');
  });

  // --- Group 2: Research-related intents should match research-team ---

  it('C04: "Research competitive landscape" → research-team', async () => {
    const plan = await matchCrew('Research competitive landscape');
    expect(plan.source).toBe('crew_yaml');
    expect(plan.tasks.length).toBeGreaterThanOrEqual(2);
  });

  it('C05: "Gather verified information on market trends" → research-team', async () => {
    const plan = await matchCrew('Gather verified information on market trends');
    expect(plan.source).toBe('crew_yaml');
  });

  it('C06: "comprehensive research on outdoor products" → research-team', async () => {
    const plan = await matchCrew('comprehensive research on outdoor products');
    expect(plan.source).toBe('crew_yaml');
  });

  // --- Group 3: Analysis-related intents should match analysis-team ---

  it('C07: "Analyze market data patterns" → analysis-team', async () => {
    const plan = await matchCrew('Analyze market data patterns');
    expect(plan.source).toBe('crew_yaml');
  });

  it('C08: "Transform sales data into actionable insights" → analysis-team', async () => {
    const plan = await matchCrew('Transform sales data into actionable insights');
    expect(plan.source).toBe('crew_yaml');
  });

  it('C09: "data analysis for quarterly report" → analysis-team', async () => {
    const plan = await matchCrew('data analysis for quarterly report');
    expect(plan.source).toBe('crew_yaml');
  });

  // --- Group 4: Ambiguous intents ---

  it('C10: "research and analyze competitor pricing" → crew_yaml (either crew valid)', async () => {
    const plan = await matchCrew('research and analyze competitor pricing');
    expect(plan.source).toBe('crew_yaml');
  });

  // --- Group 5: Clearly no-match intents → rule fallback ---

  it('C11: "Deploy application to production" → no-match', async () => {
    const plan = await matchCrew('Deploy application to production');
    expect(plan.source).toBe('rule');
  });

  it('C12: "Send email notification to team" → no-match', async () => {
    const plan = await matchCrew('Send email notification to team');
    expect(plan.source).toBe('rule');
  });

  it('C13: "Fix broken CSS styling" → no-match', async () => {
    const plan = await matchCrew('Fix broken CSS styling');
    expect(plan.source).toBe('rule');
  });

  it('C14: "Update database schema" → no-match', async () => {
    const plan = await matchCrew('Update database schema');
    expect(plan.source).toBe('rule');
  });

  it('C15: "Configure CI/CD pipeline" → no-match', async () => {
    const plan = await matchCrew('Configure CI/CD pipeline');
    expect(plan.source).toBe('rule');
  });

  // --- Group 6: Edge cases ---

  it('C16: Empty goal → no-match', async () => {
    const plan = await matchCrew('');
    expect(plan.source).toBe('rule');
  });

  it('C17: Single meaningful word "research" → crew_yaml', async () => {
    const plan = await matchCrew('research');
    // "research" appears in research-team name/goals, should match
    expect(plan.source).toBe('crew_yaml');
  });

  it('C18: Domain filter excludes cross-domain crews', async () => {
    const plan = await matchCrew('research market trends', 'external');
    // Crews are domain=core, intent domain=external → no match
    expect(plan.source).toBe('rule');
  });
});

// ============================================================
// Metrics: crew_match_accuracy / false_positive / no_match_rate
// ============================================================

describe('Crew Matching Metrics', () => {
  const decomposer = new RuleBasedDecomposer([CREWS_DIR], [AGENTS_DIR]);

  // Test corpus with expected outcomes
  const corpus: Array<{ goal: string; expected: 'research-team' | 'analysis-team' | 'no-match' }> = [
    // Should match research-team
    { goal: 'Research competitive landscape for outdoor rugs', expected: 'research-team' },
    { goal: 'Gather comprehensive verified information', expected: 'research-team' },
    { goal: 'research emerging market trends', expected: 'research-team' },
    { goal: 'Investigate and verify research sources', expected: 'research-team' },
    // Should match analysis-team
    { goal: 'Analyze market data patterns for Q4', expected: 'analysis-team' },
    { goal: 'Transform raw data into actionable insights', expected: 'analysis-team' },
    { goal: 'statistical analysis of sales trends', expected: 'analysis-team' },
    { goal: 'data analysis and insight generation', expected: 'analysis-team' },
    // Should NOT match any crew
    { goal: 'Deploy to production', expected: 'no-match' },
    { goal: 'Send notification email', expected: 'no-match' },
    { goal: 'Fix login page bug', expected: 'no-match' },
    { goal: 'a given topic', expected: 'no-match' },
    { goal: 'do it now', expected: 'no-match' },
  ];

  it('computes crew match metrics', async () => {
    let correct = 0;
    let falsePositive = 0;
    let noMatchCount = 0;
    const total = corpus.length;

    for (const { goal, expected } of corpus) {
      const plan = await decomposer.decompose(makeIntent(goal));
      const isCrewMatch = plan.source === 'crew_yaml';
      const expectedNoMatch = expected === 'no-match';

      if (expectedNoMatch) {
        if (!isCrewMatch) {
          correct++;
          noMatchCount++;
        } else {
          falsePositive++;
        }
      } else {
        if (isCrewMatch) {
          correct++;
        }
        // Note: we don't verify which crew matched (would need to inspect task structure)
      }
    }

    const accuracy = correct / total;
    const fpRate = falsePositive / total;
    const noMatchRate = noMatchCount / total;

    console.log(`crew_match_accuracy: ${accuracy.toFixed(2)} (${correct}/${total})`);
    console.log(`crew_false_positive_rate: ${fpRate.toFixed(2)} (${falsePositive}/${total})`);
    console.log(`crew_no_match_rate: ${noMatchRate.toFixed(2)} (${noMatchCount}/${total})`);

    // Assertions
    expect(accuracy).toBeGreaterThanOrEqual(0.85);
    expect(fpRate).toBe(0);  // Zero false positives after P0 fix
    expect(noMatchRate).toBeGreaterThan(0);  // no-match is a legitimate outcome
  });
});
