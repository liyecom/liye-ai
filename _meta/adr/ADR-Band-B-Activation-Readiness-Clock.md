---
artifact_scope: ghl-band-b
artifact_name: Band-B-Activation-Readiness-Clock
artifact_role: contract
target_layer: cross
is_bghs_doctrine: no
---

# ADR — Band B readiness clock public boundary notice

**Status**: Deprecated
**Date**: 2026-06-22

The original decision record contained domain-specific operational details.
It is preserved in a private evidence repository and is withdrawn from this
public branch. This notice does not certify a current clock, streak, or gate.

The reusable public rule is simple: a readiness window needs one genuine
record per UTC day, and missing or failed days cannot be backfilled. Runtime
state, raw records, paths, and activation decisions belong to the private
domain evidence and its separately authorized operator process.
