import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  checkCompliance,
  parseFrontmatter,
} from "../.claude/scripts/sfc_frontmatter.mjs";

test("accepts v0.2 metadata.liye shape", () => {
  const md = readFileSync("tests/fixtures/sfc/v0_2_sample/SKILL.md", "utf8");
  const result = checkCompliance(parseFrontmatter(md));

  assert.equal(result.compliant, true);
  assert.equal(result.shape, "v0.2");
  assert.equal(result.skeleton, "reference");
  assert.equal(result.skeletonValid, true);
});

test("accepts legacy v0.1 top-level shape", () => {
  const md = `---
name: legacy-fixture
description: "Use when testing SFC v0.1 compatibility."
skeleton: workflow
triggers:
  commands: ["/legacy-fixture"]
  patterns: ["legacy fixture"]
inputs:
  required: []
  optional: []
outputs:
  artifacts: ["SKILL.md"]
failure_modes:
  - symptom: "Fixture parsing fails"
    recovery: "Fix the parser or fixture"
verification:
  evidence_required: true
  how_to_verify: ["node --test tests/sfc_frontmatter.characterization.mjs"]
---

# Legacy Fixture
`;

  const result = checkCompliance(parseFrontmatter(md));

  assert.equal(result.compliant, true);
  assert.equal(result.shape, "v0.1");
  assert.equal(result.skeleton, "workflow");
  assert.equal(result.skeletonValid, true);
});

test("flags version misplaced under metadata.liye", () => {
  const md = `---
name: misplaced-version-fixture
description: "Use when testing version placement."
metadata:
  liye:
    version: "1.0.0"
    sfc_version: "0.2"
    skeleton: reference
    triggers:
      commands: []
      patterns: []
    inputs:
      required: []
      optional: []
    outputs:
      artifacts: []
    failure_modes: []
    verification:
      evidence_required: true
      how_to_verify: []
---

# Misplaced Version Fixture
`;

  const result = checkCompliance(parseFrontmatter(md));

  assert.equal(result.versionMisplaced, true);
});
