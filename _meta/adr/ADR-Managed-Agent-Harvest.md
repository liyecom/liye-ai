---
artifact_scope: meta
artifact_name: Managed-Agent-Harvest
artifact_role: harvest
target_layer: cross
is_bghs_doctrine: no
---

# ADR — Managed Agent Harvest

**Status**: Proposed
**Date**: 2026-05-10
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Managed-Agent-Harvest.md`
**References**:
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`
- `_meta/adr/ADR-Hermes-Skill-Lifecycle.md`
- `_meta/adr/ADR-Loamwise-Guard-Content-Security.md`
- `_meta/adr/ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md`
- `_meta/adr/ADR-Credential-Mediation.md`
**Source**: `/Users/liye/github/financial-services/` (Anthropic financial-services reference repo, read-only)

---

## Context

LiYe Systems already uses Anthropic Managed Agents as an architectural reference for BGHS. The cloned `financial-services` repo adds a more concrete pattern: a high-trust vertical system where named agents, skills, MCP connectors, managed wrappers, subagents, handoffs, and validation harnesses are all represented as files.

This ADR harvests the transferable architecture patterns. It does not import the financial-services repo, install its plugins, execute its scripts, or adopt Anthropic product assumptions as LiYe doctrine.

The relevant LiYe question is:

> How should LiYe represent and govern agent-shaped domain workflows so they can run under multiple runtime surfaces without losing trust boundaries, evidence, or human signoff discipline?

---

## Upstream Core Practices

### M1. One canonical source, multiple runtime surfaces

Each named agent ships as both:

- a Cowork / Claude Code plugin under `plugins/agent-plugins/<slug>/`
- a Managed Agent cookbook under `managed-agent-cookbooks/<slug>/`

The cookbook references the same agent prompt and skills. Runtime wrappers adapt the same source to a different execution surface.

### M2. Plugin package is self-contained, but skills have a source of truth

Vertical plugins own source skills. Agent plugins vendor copies of those skills so each agent package is installable by itself. `scripts/check.py` detects drift, and `scripts/sync-agent-skills.py` propagates source changes.

### M3. Managed wrapper resolves references before deployment

`agent.yaml` is a manifest-like wrapper. The deploy harness resolves file references, uploads skills, creates subagents, and posts the final payload.

Important field behavior:

| Field pattern | Resolution |
|---|---|
| `system.file` | inline canonical agent prompt |
| `skills.from_plugin` | upload all bundled skills |
| `skills.path` | upload one skill |
| `callable_agents.manifest` | create leaf worker first |
| `output_schema` | validate harness-side; not posted as API field |

### M4. Depth-1 subagents encode permission topology

The most important subagent role split is not "more agents"; it is permission separation:

- reader: touches untrusted input, no write, no bash, often no MCP
- critic: re-verifies against trusted sources, read-only
- writer / resolver / publisher: only worker with Write, does not read raw untrusted input
- orchestrator: coordinates, but does not hold write in high-risk flows

### M5. Untrusted input is defanged before context merge

Reader workers return schema-validated JSON only. Schemas use:

- `additionalProperties: false`
- max lengths
- character-class regexes
- item caps

This prevents raw adversarial document text from surviving intact into the orchestrator context.

### M6. Handoff is outside direct agent calls

Named agents do not call one another directly. They emit a handoff request, and an external event loop routes it after target allowlist and payload schema validation.

The reference implementation parses text, but explicitly recommends typed tool calls or typed SSE events for production.

### M7. High-stakes actions are staged for human signoff

Financial workflows produce drafts, reports, workbooks, exception lists, or signoff packages. They do not:

- publish research
- email clients
- post to a ledger
- approve KYC
- execute trades
- make final investment, tax, legal, or accounting decisions

---

## Absorb

| ID | Pattern | LiYe absorption |
|---|---|---|
| A1 | One source, many runtime wrappers | Agent source and runtime surface must be separate contract fields |
| A2 | Agent prompt + skills as canonical source | Agent unit declares canonical system prompt and skill sources |
| A3 | Worker topology as permission model | Worker manifests must declare tools, connectors, write, shell, untrusted-input exposure |
| A4 | Single-writer leaf | High-risk flows must have at most one write-capable worker by default |
| A5 | Untrusted-reader isolation | Workers touching untrusted input cannot hold Write, Bash, or privileged connectors |
| A6 | Schema-validated worker outputs | Reader output schema validation is Governance, not a best-effort prompt instruction |
| A7 | Independent critic pattern | Material facts from untrusted input should be re-verified against trusted sources before write |
| A8 | Externalized handoff | Cross-agent routing belongs to Session / Loamwise event bus, not direct agent-to-agent calls |
| A9 | Staged outputs and human signoff | System-of-record writes and external distribution require explicit approval outside the agent |
| A10 | Drift check for bundled skills | Vendored skill copies require source hash, provenance, and drift gate |

---

## Do Not Absorb

| ID | Upstream pattern | Reason |
|---|---|---|
| R1 | Claude-specific model names in contracts | Model choice is Brain / runtime policy, not Layer 0 invariant |
| R2 | Marketplace listing as trust | Marketplace is discovery only; LiYe requires lifecycle admission |
| R3 | Regex extraction of handoff JSON from model text | Acceptable reference script; production should use typed Session events |
| R4 | Markdown guardrails as sole enforcement | Guardrails must compile into Loamwise / contract checks where safety matters |
| R5 | Vendored skills without explicit source hash in manifest | LiYe needs provenance and drift receipts |
| R6 | API preview depth limit as doctrine | One-level delegation is current vendor capability, not LiYe architecture |
| R7 | Direct upload/deploy script as source of truth | Harness behavior must be generated from contract, not define the contract |
| R8 | Financial product worldview | Only architecture patterns transfer; financial workflows remain reference examples |

---

## BGHS Mapping

| Anthropic artifact | LiYe concern | Notes |
|---|---|---|
| Agent prompt | Brain | Model-contingent workflow identity |
| Skill body | Brain, secondary Hands | Professional method; executable only after lifecycle admission |
| Plugin manifest | Governance | Ownership and package boundary |
| MCP connector | Hands | Credential-mediated tool surface |
| `output_schema` | Governance | Validation gate outside model discretion |
| Worker tool config | Governance, secondary Hands | Permissions are enforceable topology |
| Steering event | Session | Wake/resume input |
| Handoff request | Session, secondary Governance | Must be typed and allowlisted |
| Human signoff rule | Governance | Model-independent invariant |
| `./out/` artifact writing | Hands | Staged output surface |

---

## Decision

LiYe Systems will define a first-class **Agent Unit Contract** for agent-shaped domain workflows.

This contract will:

1. separate canonical source from runtime wrapper
2. declare runtime surfaces without binding to a vendor
3. declare worker topology and permission profiles
4. represent untrusted-input exposure explicitly
5. require schema validation for reader / extractor outputs
6. route cross-agent handoffs through typed Session events
7. require human signoff declarations for high-stakes actions
8. connect every agent unit to BGHS Component Declaration fields

Initial schema sketch:

- `_meta/contracts/agent/liye_agent_contract.schema.yaml`

This is a cross-layer contract:

- Layer 0 defines the schema and invariants.
- Layer 1 Loamwise enforces dispatch, GuardChain, output validation, Session writes, and WriteGate.
- Layer 2 Domain Engines publish concrete agent units or playbooks that conform.
- Layer 3 products may consume staged outputs but do not own the governance rules.

---

## Boundary Rules

### MA1. Runtime surface cannot be the source of truth

A Cowork plugin, Managed Agent wrapper, CLI command, or product embed is only a surface. The canonical source must be declared separately:

- agent prompt source
- skill source list
- connector declarations
- worker topology
- output and handoff schemas

### MA2. Worker topology must be explicit

Every worker must declare:

- role
- whether it touches untrusted input
- allowed tools
- connector access
- write capability
- shell capability
- output schema, if its output enters another agent's context

### MA3. Untrusted-input workers are least-privilege by default

If `touches_untrusted_input = true`, default policy is:

- no Write
- no Bash / shell
- no privileged MCP connector
- no external send
- structured output only

Exceptions require a separate policy ADR.

### MA4. Writer cannot consume raw untrusted content

The write-capable worker receives only validated, bounded, and preferably critic-checked summaries or references. It must not open raw external documents directly in high-risk workflows.

### MA5. Orchestrator handoff is typed Session, not free text

Cross-agent handoff must be represented as a typed Session event:

```
AgentHandoffRequested
  source_agent_id
  target_agent_id
  event_schema_ref
  payload
  context_ref
  guard_evidence_ref
```

The target must be allowlisted and the payload must validate before dispatch.

### MA6. High-stakes outputs are staged

Any action that can externally bind the business or alter a system of record must be staged for human signoff:

- ledger posting
- client / investor / regulator distribution
- KYC approval
- trade / bid / budget execution
- legal, tax, accounting, or investment recommendation publication

### MA7. Vendored skill copies require provenance

If an agent package includes copied skills, each copy must carry:

- source path or URI
- source hash
- copied_at
- lifecycle state
- drift check receipt

---

## Consequences

Positive:

- LiYe can model agent workflows without binding itself to one vendor runtime.
- Loamwise gets a concrete shape for WriteGate, GuardChain, and Session routing.
- Domain Engines can expose agent-shaped work without bypassing engine manifests.
- High-risk workflows gain auditable least-privilege decomposition.

Costs:

- More manifest fields before an agent can be dispatchable.
- Vendored skill copies require provenance tooling.
- Loamwise must enforce topology, not just read prompts.
- Existing D0 engines need migration work before D2/D3.

---

## Adoption Plan

1. Add `_meta/contracts/agent/liye_agent_contract.schema.yaml` as schema sketch.
2. Create one non-runtime example for AGE or Chaming using read-only workers.
3. Add Loamwise validator for single-writer and untrusted-reader invariants.
4. Add typed `AgentHandoffRequested` Session event under the P1-e taxonomy.
5. Extend engine manifest integration so Domain Engines can publish agent units alongside playbooks.

---

## Non-Goals

- Do not import Anthropic financial-services code.
- Do not adopt a vendor-specific Managed Agents API as LiYe's contract.
- Do not make BGHS a runtime directory structure.
- Do not treat marketplace installation as trust.
- Do not turn Layer 3 product workflows into Layer 0 governance logic.

