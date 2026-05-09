# Env Hygiene Audit — Baseline

**Sprint**: 2 (CredentialBroker seam + env hygiene gate)
**Wave**: 2.2 (gate installation)
**Date**: 2026-04-17
**ADR**: `_meta/adr/ADR-Credential-Mediation.md` (P1-f)

This file records the existing direct environment-variable reads in the
repository at the moment the env hygiene gate is installed. The gate
itself only blocks NEW additions in the gated scope; existing readers
stay until they are migrated component-by-component to the
`CredentialBroker` seam (`src/runtime/credential/`).

---

## Scope rules (frozen at Sprint 2 seal)

| Bucket | Paths | Enforcement |
|---|---|---|
| **Gated** | `src/**`, `builders/**`, `systems/**` | New additions → **BLOCK** (pre-commit Check 7 + CI) |
| **Whitelist** | `src/runtime/credential/**` | Broker bootstrap — `process.env.*` allowed (ADR-Credential-Mediation M7) |
| **Exempt** | `.claude/scripts/**`, `scripts/**`, `examples/**`, `tools/notion-sync/**` | No enforcement (local tooling / one-shot) |
| **Other** | anything else (e.g. `tools/<other>/`) | No enforcement currently; revisit when migrating those trees |

Scanners intentionally skip `node_modules/` and `vendor/` (third-party code).

---

## Baseline counts (2026-04-17)

Run via `node .claude/scripts/env_hygiene_gate.mjs --all`:

| Bucket | Lines found |
|---|---|
| Gated (migration target) | **45** |
| Whitelist | 0 |
| Exempt | 101 |
| Other | 112 |
| **Total scanned** | 258 |

---

## Gated baseline — files to migrate

The 45 gated-scope env reads live across these files. Each one is a
candidate for broker migration (replace `process.env.X` with
`broker.resolve('cred://<owner>/<name>', ctx)`). **No deadline** is
imposed here; migration happens when the owning component otherwise
touches the file.

| File | Notes |
|---|---|
| `src/config/load.js` | Config loader — touches many env vars at startup |
| `src/gateway/openclaw/server.ts` | Gateway init (5 reads) |
| `src/gateway/openclaw/age_job_client.ts` | AGE job client (4 reads) |
| `src/runtime/evidence/evidence_writer.mjs` | Evidence writer |
| `src/runtime/evidence/action_plan_writer.mjs` | Same family |
| `src/runtime/evidence/approval_writer.mjs` | Same family |
| `src/runtime/evidence/execution_result_writer.mjs` | Same family |
| `src/runtime/evidence/live_run_report_writer.mjs` | Same family |
| `src/runtime/evidence/live_run_spec_writer.mjs` | Same family |
| `src/runtime/execution/real_executor.mjs` | Real-run executor |
| `src/runtime/execution/dry_run_executor.mjs` | Dry-run executor |
| `src/runtime/execution/write_gate.mjs` | Write gate |
| `src/runtime/execution/four_key_gate.mjs` | Four-key gate |
| `src/runtime/execution/kill_switch.mjs` | Kill switch |
| `src/runtime/mcp/security/vault.py` | Vault glue |
| `src/runtime/mcp/registry.py` | MCP registry |
| `src/runtime/mcp/adapters/governed_tool_provider.py` | Governed tool provider |
| `src/runtime/mcp/servers/knowledge/qdrant_server.py` | Qdrant server |
| `src/reasoning/execution/build_action_proposal.mjs` | Action proposal builder |
| `src/reasoning/execution/execute_action.mjs` | Action executor |
| `src/reasoning/replay/run_readonly_pilot.mjs` | Readonly pilot runner |
| `src/mission/utils.js` | Mission utils |
| `src/governance/learning/kill_switch.mjs` | Governance kill switch |
| `builders/theme-factory/builder.ts` | Theme factory builder |
| `systems/site-deployer/deployers/vercel.py` | Vercel deployer |
| `systems/site-deployer/integrations/umami.py` | Umami integration |

(Re-run `node .claude/scripts/env_hygiene_gate.mjs --report` for full
line-level listings when migrating a particular file.)

---

## Non-goals of this audit

- **No deadline on migration.** Sprint 2 blocks new additions only.
- **No automatic rewriting.** Each migration needs a broker setup
  decision (which broker instance, which env_map entry, what
  CredentialReference string).
- **No effect on already-committed code.** Files in the table above
  can be edited without a broker as long as the edit does not add
  another env read.

---

## How the gate decides

- Pre-commit (`.claude/.githooks/pre-commit` Check 7) and CI
  (`.github/workflows/env-hygiene-gate.yml`) both call
  `.claude/scripts/env_hygiene_gate.mjs`.
- The gate reads `git diff --cached --unified=0 --diff-filter=AM`
  (or the PR diff in CI), looks at lines prefixed with `+`, matches
  env-read patterns, classifies each file by the scope rules above,
  and blocks if any match falls in the Gated bucket.
- False positives (e.g. a comment that mentions `process.env.FOO`
  verbatim) should be rare but can be suppressed by rewording the
  comment. The gate does not parse an AST.

---

## Future tightening (not in Sprint 2)

- Promote `tools/**` (minus the notion-sync exemption) into the Gated
  bucket once those tools acquire a broker owner.
- Add SecretValue-roundtrip check: PR diff that introduces a broker
  resolve call should also assert that the result is consumed through
  `.reveal()` and not JSON-serialized whole.
- Auto-generate `env-audit.md` from the gate's `--report` JSON so it
  never drifts from reality.
