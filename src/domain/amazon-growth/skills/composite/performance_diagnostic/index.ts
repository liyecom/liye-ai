/**
 * Composite Skill: performance_diagnostic
 * Domain: amazon-growth
 * Version: 1.0.0
 *
 * SKILL_SPEC.md v5.0 compliant
 *
 * IMPORTANT: Composite Skills ONLY orchestrate other Skills.
 * They do NOT implement Atomic logic (SKILL_SPEC §4).
 */

import { CompositeSkill, SkillLoader } from '@liye-ai/skill';

// Import skill specs for type checking
import type { DiagnosticOutput } from '../atomic/diagnostic_analysis';
import type { RootCauseOutput } from '../atomic/root_cause_detection';

interface PerformanceDiagnosticInput {
  asin: string;
  metrics: string[];
  time_range: {
    start: string;
    end: string;
  };
}

interface DiagnosticReport {
  anomalies: unknown[];
  root_causes: unknown[];
  recommendations: string[];
  severity_summary: string;
}

interface PerformanceDiagnosticOutput {
  diagnostic_report: DiagnosticReport;
}

export const performance_diagnostic: CompositeSkill<
  PerformanceDiagnosticInput,
  PerformanceDiagnosticOutput
> = {
  id: 'performance_diagnostic',
  type: 'composite',
  domain: 'amazon-growth',

  // Composite Skills define skill chain, NOT implementation
  skills: ['diagnostic_analysis', 'root_cause_detection'],

  async execute(
    input: PerformanceDiagnosticInput,
    loader: SkillLoader
  ): Promise<PerformanceDiagnosticOutput> {
    // Load atomic skills via registry (SKILL_SPEC §5)
    const diagnosticSkill = await loader.load('diagnostic_analysis');
    const rootCauseSkill = await loader.load('root_cause_detection');

    // Step 1: Run diagnostic analysis
    const diagnosticResult = await diagnosticSkill.execute({
      asin: input.asin,
      metrics: input.metrics,
      time_range: input.time_range,
    });

    // Step 2: Run root cause detection for each anomaly
    const rootCauseResults = await Promise.all(
      diagnosticResult.anomalies.map((anomaly) =>
        rootCauseSkill.execute({
          anomaly: {
            metric: anomaly.metric,
            description: `${anomaly.metric} deviation: ${anomaly.deviation}`,
          },
          max_depth: 5,
        })
      )
    );

    // Aggregate results
    const allRootCauses = rootCauseResults.flatMap((r) => r.root_causes);
    const allInsights = rootCauseResults.flatMap((r) => r.actionable_insights);

    return {
      diagnostic_report: {
        anomalies: diagnosticResult.anomalies,
        root_causes: allRootCauses,
        recommendations: allInsights,
        severity_summary: diagnosticResult.summary,
      },
    };
  },
};

export default performance_diagnostic;
