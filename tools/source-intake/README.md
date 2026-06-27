# source-intake — governed URL→artifact rail (MVP)

The governed re-homing of retired **skill-forge**'s only distinctive capability —
*ingest an external GitHub repo into skill materials* — as a Layer-0 Hands tool.

This is **not** a one-click pipeline. It is a seven-stage state machine with two human
gates the machine may never cross. It is the downstream consumer of
[`tools/github-scout`](../github-scout/) (discovery) and the upstream of the official
`skill-creator` (build). Full design: [`.planning/source-intake/SPEC.md`](../../.planning/source-intake/SPEC.md).

```
[github-scout report] → S0 INTAKE_REQUEST → S1 PIN → S2 LICENSE_GATE → S3 ACQUIRE → S4 REPRESENT → S5 STAGE+AUDIT → S6 PROMOTE
   (discovery, read-only)   (human gate #2)    (pin SHA)   (verify on pin)   (pinned tarball)  (draft)      (repo-external)     (human gate #3)
```

## Why "one-click" is dead (on purpose)

A fully automatic `scout → fetch → build` chain hits the **lethal trifecta / OWASP LLM01**
(untrusted external content + private repo context + write/mutate capability) and violates
github-scout invariant I1 ("candidates are never auto-imported"). So the capability survives
as a **three-gate, human-in-the-loop, auditable** rail:

1. **license gate (machine)** — reuses the github-scout `license_policy.yaml` SSOT, re-verified
   **on the pinned commit** (TOCTOU-safe). `strong_copyleft` → no source fetch; `unknown` → skip.
2. **semantic/ADR gate (human)** — a person writes the intake request, picks the leaf from
   scout's allowed menu, and attests behavior-fit. skill-draft needs reimplement + ≥3 scenarios + a harvest-ADR.
3. **trust sandbox gate (machine + human)** — acquired content is audited for injection /
   secrets **regardless of license tier** (license-tier ≠ trust-tier). The machine never grants
   a `pass`; only a human does at promote time.

## Usage

```bash
# S0 — validate a hand-written intake ticket
python3 tools/source-intake/source_intake.py validate-request --request my_request.json

# S1..S5 — pin → license-gate (on pin) → acquire pinned tarball → audit → write manifest
python3 tools/source-intake/source_intake.py intake --request my_request.json --out run.json
#   --staging-root DIR   repo-EXTERNAL staging (default ~/.liye-os/source-intake-staging)
#   --dry-run            do not write the staged tarball to disk
#   --token-env VAR      env var holding a NO-SCOPE/read-only token (default unauthenticated)

# S6 — promote ceremony guard (refuses unless human-approved + audit pass + repo-external staging)
python3 tools/source-intake/source_intake.py promote --manifest run.json --approved-by you
```

Authentication follows scout's token discipline: **NO-SCOPE / read-only token only**; an ambient
token carrying any classic scope fails closed. Default is unauthenticated public read.

## Contracts

- [`schemas/source_intake_request.json`](schemas/source_intake_request.json) — the human-written ticket (§2.1)
- [`schemas/source_manifest.json`](schemas/source_manifest.json) — the tool-produced pin + audit record (§2.2)
- [`declaration.yaml`](declaration.yaml) — BGHS Component Declaration (invariants I1–I5)

## Hard gates / non-goals

- **0-diff** on `github-scout` (`scout.py` / `declaration.yaml` / `license_policy.yaml`) and on
  `.claude/scripts/sfc_ci_gate.mjs` — this rail only *consumes* the scout SSOT.
- **No third-party source vendored into the repo**: the repo gets only the small manifest (and a
  human-promoted reference-pack distillation). Source material is staged repo-external.
- **No auto-promote / no auto-active-install**: S6 is a human ceremony.
- mcp-draft is **PR4** (delegates to `Skills/00_Core_Utilities/development-tools/mcp-builder`); the
  MVP is reference-pack + skill-draft.

## Tests

```bash
python3 tools/source-intake/test_source_intake.py   # offline; covers SPEC §3 N1–N11 + HG3/HG4
```
