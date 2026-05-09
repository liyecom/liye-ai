/**
 * Layer Dependency Guard — regex behavior fixture.
 *
 * Pins the anchored regex used by `.github/workflows/layer-dependency-gate.yml`.
 * The previous loose patterns (`from.*X|import.*X`) matched any line with
 * those keywords, including JSDoc continuations and prose. The new
 * patterns require the keyword at line start (whitespace allowed) so
 * that comments and string literals don't trip the gate.
 *
 * Three cases asserted:
 *   1. NEW regex still flags real imports (positive cases)
 *   2. NEW regex does not flag prose-with-keywords (negative cases)
 *   3. OLD regex would have wrongly flagged every negative case (this
 *      documents the bug class the new regex closes — useful when the
 *      gate is reviewed in the future)
 */

import { describe, expect, it } from 'vitest';

// Mirror the patterns shipped to the constitution-gate action. Keep these
// in lockstep with the workflow YAML.
const NEW_PATTERN = /^[ \t]*(import|from|export)[ \t].*runtime/;
const OLD_PATTERN = /from.*runtime|import.*runtime/;

const POSITIVE_CASES: string[] = [
  `import { x } from "src/runtime/foo";`,
  `from src.runtime import x`,
  `  import { y } from './runtime';`,
  `\t  export { z } from "../runtime/bar";`,
  `import * as rt from '../runtime';`,
  `from src.runtime.executor import Executor`,
];

// Prose / comment / string lines that contain the dangerous keywords
// ("from"/"import" + a layer name). These are the lines the OLD loose
// regex wrongly matched and that the NEW anchored regex must reject.
const NEGATIVE_CASES_OLD_BUG: string[] = [
  ` * boundary rule: never imports from src/runtime/`,
  ` *   - skill_lifecycle never imports from src/runtime/`,
  `// see comment about imports from runtime`,
  `# python style: imports from src.runtime`,
  `boundary rule: skill_lifecycle never imports from src/runtime/`,
  `const description = "this orchestrator imports from runtime";`,
  `/* prose: do not import from runtime */`,
];

// Generic prose lines with no keyword overlap. NEW regex should reject
// these too, but OLD regex never matched them in the first place.
const NEGATIVE_CASES_GENERIC: string[] = [
  ` * Mirrors ADR. This file is NOT runtime.`,
  `// runtime.ts is a peer module`,
];

describe('Layer Dependency Guard — anchored regex (workflow .github/workflows/layer-dependency-gate.yml)', () => {
  it('NEW regex matches every positive case (real imports/exports/from clauses)', () => {
    for (const line of POSITIVE_CASES) {
      expect(NEW_PATTERN.test(line), `should match: ${line}`).toBe(true);
    }
  });

  it('NEW regex rejects bug-class negatives (prose/comments/strings that tripped OLD)', () => {
    for (const line of NEGATIVE_CASES_OLD_BUG) {
      expect(NEW_PATTERN.test(line), `should NOT match: ${line}`).toBe(false);
    }
  });

  it('NEW regex rejects generic negatives (prose without import keywords)', () => {
    for (const line of NEGATIVE_CASES_GENERIC) {
      expect(NEW_PATTERN.test(line), `should NOT match: ${line}`).toBe(false);
    }
  });

  it('OLD regex matched bug-class negatives (documents the bug NEW closes)', () => {
    for (const line of NEGATIVE_CASES_OLD_BUG) {
      expect(
        OLD_PATTERN.test(line),
        `old regex matched this prose (the PR-3 / PR-6 trip class): ${line}`,
      ).toBe(true);
    }
  });

  it('OLD regex matched positive cases (so behavior on real imports is preserved by NEW)', () => {
    for (const line of POSITIVE_CASES) {
      expect(OLD_PATTERN.test(line)).toBe(true);
    }
  });
});
