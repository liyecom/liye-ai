# LiYe OS static-zone consumer and enforcement inventory

**Status:** `INVENTORY_ONLY` · `NO_RETIREMENT_AUTHORITY` · `NO_RUNTIME_CHANGE`

**Snapshot:** `origin/main@01e563e2301d9d4086ac425cf26261cd4fa7b33a`

**Observed at:** `2026-07-11T09:26:06Z`
**Scope:** C10 — `src/`, `tools/notion-sync/`, `.claude/packs/`,
`assembler.mjs`, the Two-Speed hook files, and the two contracts workflows.

This inventory compiles the Q5 ruling: LiYe OS is a governance / contract
compiler plus narrow, named-consumer tools. It does not preserve a component
because it has code, tests, a package script, or a future-platform narrative.
It also does not delete a component merely because it would not be built
today. Retirement, contract harvesting, workflow consolidation, and archival
are separate small PRs after operator review.

## 1. Evidence language and stop line

| Term | Meaning |
|---|---|
| `RUNTIME_OBSERVED` | A live process, scheduler, or registered hook was observed consuming the component at this snapshot. |
| `CI_OBSERVED` | A GitHub Actions run executed the component or its validator. This proves automated detection, not necessarily merge blocking. |
| `DECLARED_ENTRYPOINT` | A package script, Docker command, README, or config can start the component. It does not prove current use. |
| `TEST_ONLY` | Tests or fixtures exercise the component, but no non-test runtime consumer was observed. |
| `NOT_OBSERVED` | The named searches found no consumer. It never means the consumer is impossible or that usage is zero. |
| `UNKNOWN` | The available evidence cannot decide the field. |

Current GitHub evidence must be stated narrowly:

- Both contracts workflows are active and have successful runs.
- Owner-scoped readback shows `main` branch protection requiring one approving
  review, stale-review dismissal, and conversation resolution. It does not
  require status checks, does not enforce protection for admins, and has no
  repository ruleset. Workflow results are therefore `CI_OBSERVED` evidence,
  not independently Q6-certified required merge gates.
- No `src/` server, mission runner, world-model runner, Notion sync process,
  pack assembler, or repository-local Two-Speed hook process was observed in
  the local process/launchd scan. Only the manifest reality clock was observed
  from this repository's declared unattended automation.

No row below authorizes deletion, movement, hook registration, service start,
secret installation, or workflow consolidation.

## 2. Decision summary

| Component | Consumer / enforcement evidence | Current classification | Next decision packet |
|---|---|---|---|
| `_meta/contracts/**` + `contracts-gate.yml` | `CI_OBSERVED`; latest observed PR/push runs on 2026-07-10; validates core, loop, execution, SSOT, and playbook I/O contracts | **Retain / strengthen honesty**. This is the contract spine, but its CI is not a required merge gate and admins are not covered by protection. | Keep the hyphen workflow. Any later fail-closed claim must separately prove required-check and admin-enforcement behavior. |
| `src/governance/learning/**` + `src/reasoning/**` | Multiple path-scoped workflows execute the policy-trial, execution-tier, replay, and reasoning validators; recent code history extends into 2026-06 | **Active enforcement slice; not static by assumption.** | Audit each workflow's fail-open commands separately; do not retire with the rest of `src/`. |
| `src/contracts/phase1/**` + gateway bundle | `CI_OBSERVED` most recently 2026-05-09 through `contracts_gate.yml`; `gateway:start` and tests are declared; no live process observed | **Dormant validated bundle**, not a proven resident consumer. | First decide whether any current adapter/customer workflow consumes Phase-1 request/response semantics. If yes, migrate schemas under the contract spine; if no, preservation-grade or reference-grade packet. |
| `src/mcp/**` + `src/runtime/mcp/**` | `DECLARED_ENTRYPOINT` in package/Docker files; `mcp-federation-ci` exists; no live service observed | **Runtime-shaped and demand evidence not proven.** | Consumer/SLA packet required before retention as runtime. Harvest only semantics that have a named engine consumer. |
| `src/mission/**` + `src/brokers/**` + `src/context/**` | Tests and old architecture docs; no current package service, process, hook, or scheduler observed | **`TEST_ONLY` / narrative-heavy**. | Small reference-grade freeze or retirement PR after import-graph proof. No directory-level delete. |
| `src/kernel/world_model/**` + skeleton entrypoint | Local skeleton imports the runner; no real engine call/import/receipt consumer proven | **Semantic candidate, consumer `NOT_PROVEN`.** | Do not create a new contract from assertion alone. Re-open harvesting only when an engine supplies a real call chain or equivalent runtime evidence. |
| Other `src/` support graph | Tests and several CI path filters exist; activity and reachability vary materially by subtree | **Mixed; no blanket verdict.** | Use the per-directory ledger in Appendix A to create narrow follow-up packets. |
| `.claude/packs/**` + `.claude/scripts/assembler.mjs` | Packs are checked by i18n CI; assembler is a manual README command; no session registration or runtime invocation observed | **Content validation exists; context consumption `NOT_OBSERVED`.** | Prefer pointer/content retirement over registering a new resident mechanism. Preserve only material with a named current consumer. |
| `.claude/scripts/pre_tool_check.mjs` + `stop_gate.mjs` | Files exist; issue #145 remains open; current global Claude hooks invoke different scripts | **Not registered; no enforcement claim.** | Resolve #145 by one explicit choice: register under a named risk-pull case and certify it, or retire code/docs. Leaving it suspended is forbidden. |
| `tools/notion-sync/**` | Manual package and extensive historical docs; last code change 2025-12-23; no workflow, process, scheduler, consumer, or SLA observed | **Tool-shaped, currently consumerless.** | Inventory any external Notion dependency. Absent one, classify reference/preservation grade and retire the resident tool surface in a separate PR. |
| `contracts_gate.yml` (underscore) | Active workflow; last observed run 2026-05-09; validates Phase-1 schemas and starts an example gateway E2E | **Tied to the dormant Phase-1 bundle.** | Do not keep as a second same-name gate. Merge its still-needed checks into the hyphen gate or retire it with the Phase-1 bundle. |

## 3. Dual contracts workflow audit

### 3.1 Hyphen workflow: contract spine

Path: `.github/workflows/contracts-gate.yml`

Observed consumers:

- `_meta/contracts/**`
- `state/memory/learned/**`
- `engine_manifest.yaml`
- proactive scripts and trace artifacts
- governed loop, governed execution, SSOT, and playbook I/O validators

Observed activity: successful pull-request and push runs on 2026-07-10.
This workflow directly consumes the C4 execution contract and is retained.

Honesty boundary: the job exits non-zero when a validator fails. Branch
protection enforces review/conversation rules, but no required status checks are
configured and admin enforcement is disabled. The accurate label is **active CI
validator**, not independently certified required check or merge gate.

### 3.2 Underscore workflow: Phase-1 bundle

Path: `.github/workflows/contracts_gate.yml`

Observed consumers:

- `src/contracts/phase1/*.json`
- `examples/dify/governed-tool-call-gateway/**`
- `examples/moltbot/scripts/validate_e2e.sh`
- `docs/contracts/PHASE1_CONTRACTS_FROZEN_V1.md`

Observed activity: successful pull-request and push runs, most recently on
2026-05-09. The workflow starts an example gateway and validates the Phase-1
schemas; it is not an empty workflow. Its inactivity since May is evidence of
low recent demand, not proof of zero consumers.

### 3.3 Required convergence rule

The two workflows share the display name `Contracts Gate`, which makes check
identity ambiguous. C10 does not rename or merge them. The follow-up must use
one of two bounded paths:

1. **Phase-1 semantics retained:** move the still-consumed schemas/checks under
   the contract spine, add uniquely named jobs, prove equivalent coverage, then
   retire the underscore workflow.
2. **Phase-1 bundle not retained:** seal its reference/preservation artifact,
   retire the example runtime and underscore workflow together.

The old workflow remains until equivalent coverage or retirement evidence is
merged. A same-name cosmetic rename alone does not resolve the duplicate
control surface.

## 4. `src/` findings

### 4.1 No directory-level verdict

`src/` contains 275 tracked files across 19 top-level directories. Recent
history ranges from 2026-01 to 2026-06. It is not one component, and the
repository's own "static zone" shorthand is too coarse for retirement.

Tests and path-scoped CI prove that parts of `src/` remain useful as validation
implementations. They do not prove that the gateway, MCP facade, mission
broker, scheduler, or world-model runner has a resident consumer.

### 4.2 World-model consumer hypothesis

The prior statement "AGE consumes the world-model semantics" was treated as a
hypothesis, not an input. An operator-local search covered all five registered
AGE checkouts and looked for the LiYe OS world-model module, pipeline, T1/T2/T3
call chain, and execution evidence.

Observed:

- AGE contains domain-specific T1/T2/T3 unit documents.
- A legacy AGE domain entrypoint imports `src.kernel.world_model` and calls
  `run_world_model` before its crew kickoff.
- None of the five checked AGE trees contains the imported module initializer
  or a `run_world_model` implementation.
- No cross-repository import, registered runtime, call record, or receipt was
  observed.

Verdict: **consumer not proven**. The legacy entrypoint is an unresolved import
plus a narrative call site, not a working consumer. Domain unit documents prove
semantic lineage only. This blocks both claims: "the central runner is needed"
and "the semantics already have a real engine consumer."

The Q5 doctrine still applies when evidence changes: a real engine consumer may
pull stable semantics into a contract while keeping implementation inside the
engine. This inventory does not prebuild that contract.

### 4.3 Runtime-shaped surfaces

The following satisfy the Q5 runtime smell (`resident + communication
intermediation + state`) or can be started in that shape:

- gateway and job runner under `src/gateway/`
- governance MCP facade and runtime MCP servers
- runtime orchestrator/scheduler/dispatcher subtrees
- mission and broker layers

At this snapshot they have declared/manual/test consumers but no observed live
process. Retention as resident code therefore requires a fresh demand-pull or
risk-pull packet. Tests may justify preservation-grade status; they cannot
manufacture demand.

### 4.4 Active validation implementations

Do not sweep these into a runtime retirement:

- `src/governance/learning/**` is invoked by execution-tier CI.
- `src/reasoning/**` is invoked by learning/reasoning/replay workflows.
- `src/control/**`, `src/runtime/**`, and `src/governance/**` have current test
  consumers and recent June maintenance; each needs a narrower import and
  workflow slice before disposition.

"Active validation implementation" means retain pending narrow audit. It does
not grant a standing strategic privilege to rebuild the old general runtime.

## 5. Non-`src/` findings

### 5.1 Packs and assembler

The four packs are non-empty and i18n CI checks their presence/content. The
assembler can be invoked manually and is documented in the README. No current
Claude hook, package lifecycle hook, launchd job, or process was observed
invoking it. Older documents that call it a dependency of every session are
therefore stale declarations.

Recommended follow-up default: shrink navigation to pointers and retire the
assembler/packs implementation unless a repeated operator workflow names them
as consumer with an SLA. Do not create a replacement assembler.

### 5.2 Two-Speed hooks

The repository files exist, but neither project-local settings nor the current
global hook configuration registers these exact scripts. Current global hooks
invoke other operator-local guard and lifecycle scripts; that does not activate
the repository's Two-Speed implementation. Issue #145 accurately remains open.

Recommended follow-up default: retire the suspended implementation and correct
its documentation. Registration is the conditional path only if a named hazard
packet justifies a new control and Q6 certification covers fail-closed behavior,
tamper evidence, and a controlled firing.

### 5.3 Notion sync

`tools/notion-sync/` is a bounded tool, not a resident runtime by shape. But its
repository references are declarations and migration-era documentation; no
current scheduled run, workflow, external caller, backup consumer, or SLA was
observed. A tool with no consumer does not receive maintenance privilege.

Before retirement, the follow-up must check for an external Notion database,
operator credential, or downstream sync dependency. Unknown is not zero.

## 6. Small-PR queue after this inventory

This is a dependency order, not implementation authorization:

1. **C10.1 — workflow identity/convergence SPEC:** choose retain-and-merge or
   retire-with-bundle for the underscore gate. No old gate removal until
   equivalent coverage or retirement evidence exists.
2. **C10.2 — Phase-1 gateway bundle disposition:** enumerate any current
   adapters/external users; then preservation/reference grade or contract
   migration. Do not start a service to manufacture evidence.
3. **C10.3 — issue #145 closure:** retire suspended repo-local Two-Speed hooks
   and stale claims by default; registration requires an operator-approved
   risk-pull packet.
4. **C10.4 — packs/assembler disposition:** pointer-not-copy cleanup, with no
   replacement generator/runtime.
5. **C10.5 — Notion sync disposition:** external-dependency check, then grade
   and retire or document the named consumer/SLA.
6. **C10.6 — runtime clusters:** one cluster per PR (MCP, mission/broker,
   gateway/runtime). Harvest only semantics with real consumers; never delete
   all of `src/` in one change.
7. **C10.7 — world-model semantics trigger:** no PR now. Re-open only on a real
   engine call chain/case; central runner remains a retirement candidate.

Every follow-up uses worktree → PR → operator merge. This inventory does not
make any follow-up agent-ready by itself.

## 7. Readback / reproduction

All commands are read-only and intended to be run from a clean checkout at the
snapshot commit.

```bash
git ls-files 'src/**' | wc -l
git log -1 --format='%H|%cI|%s' -- src tools/notion-sync .claude/packs
rg -n 'src/(gateway|mcp|mission|kernel|runtime|governance|reasoning)' \
  .github/workflows package.json docker-compose.mcp.yml Dockerfile.governance
rg -n 'assembler.mjs|pre_tool_check.mjs|stop_gate.mjs|tools/notion-sync' \
  CLAUDE.md README.md .github .claude docs tools _meta
gh run list --workflow contracts-gate.yml --limit 10
gh run list --workflow contracts_gate.yml --limit 10
gh api repos/liyecom/liye-ai/branches/main/protection
gh api repos/liyecom/liye-ai/rulesets
```

Expected owner-scoped readback: one approving review, stale-review dismissal,
and conversation resolution; `enforce_admins=false`; no required status checks;
empty ruleset list. A 404 under a non-owner identity is authorization-
indeterminate and must not be recorded as absent protection.

## Appendix A — complete `src/` top-level ledger

| Path | Tracked files | Last observed change | Inventory route |
|---|---:|---|---|
| `src/adapters/` | 4 | 2026-02-19 | Runtime support graph; audit with executor consumers. |
| `src/analytics/` | 1 | 2026-01-02 | World-model-era support; consumer not proven. |
| `src/audit/` | 5 | 2026-06-27 | Recent hygiene + tests; narrow audit before disposition. |
| `src/brokers/` | 6 | 2026-01-02 | Mission/runtime cluster. |
| `src/config/` | 3 | 2026-01-02 | Mission/runtime cluster. |
| `src/context/` | 2 | 2026-01-02 | Mission/runtime cluster. |
| `src/contracts/` | 7 | 2026-05-09 | Phase-1 bundle; tied to underscore gate. |
| `src/control/` | 10 | 2026-06-27 | Recent tests/maintenance; narrow enforcement audit. |
| `src/domain/` | 37 | 2026-06-27 | Mixed docs/skeleton/domain assets; no directory verdict. |
| `src/gateway/` | 9 | 2026-03-10 | Declared gateway + tests; live consumer not observed. |
| `src/governance/` | 15 | 2026-06-27 | Mixed active validators and dormant runtime support. |
| `src/kernel/` | 28 | 2026-01-04 | World-model semantics/runner; engine consumer not proven. |
| `src/mcp/` | 4 | 2026-01-24 | Runtime-shaped facade; live consumer not observed. |
| `src/memory/` | 1 | 2026-01-03 | Runtime support; do not confuse with C11 operator memory plane. |
| `src/method/` | 15 | 2026-01-03 | Contract/architecture support; narrow import audit. |
| `src/mission/` | 6 | 2026-01-02 | Mission/runtime cluster. |
| `src/reasoning/` | 12 | 2026-06-01 | Active workflow consumers; retain pending narrow audit. |
| `src/runtime/` | 102 | 2026-06-27 | Mixed runtime, validators, and tests; split by subsystem. |
| `src/skill/` | 8 | 2026-06-27 | Recent hygiene; audit declaration consumers. |
| **Total** | **275** | — | No bulk action. |

## Appendix B — privacy and authority readback

- No customer identifier, private repository link, private decision-artifact
  path, secret value, or local absolute checkout path is included.
- Local process and cross-repository searches are summarized without publishing
  operator-private topology.
- The document changes no workflow, source, settings, runtime, or registry.
- Operator merge is required before this inventory becomes repository evidence.
