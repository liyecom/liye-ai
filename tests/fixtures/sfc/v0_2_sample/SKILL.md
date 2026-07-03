---
name: v0-2-sfc-fixture
description: "Use when testing SFC v0.2 frontmatter compatibility."
version: "0.0.1"
metadata:
  liye:
    sfc_version: "0.2"
    skeleton: reference
    triggers:
      commands: ["/v0-2-sfc-fixture"]
      patterns: ["SFC v0.2 fixture"]
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
    governance:
      constitution: "_meta/governance/SKILL_CONSTITUTION_v0.1.md"
      policy: "_meta/policies/DEFAULT_SKILL_POLICY.md"
---

# SFC v0.2 Fixture

This is only a test fixture, not a real skill.
