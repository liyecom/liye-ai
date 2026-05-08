# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Domain-Centric Four-Layer Architecture with Governance Kernel

LiYe OS is a personal AI operating system that orchestrates multi-agent workflows through a layered architecture. The system separates knowledge (passive, for humans) from execution (active, for agents), enforced through governance contracts and append-only audit traces.

**Key Characteristics:**
- Four primary layers: Domain (WHERE), Method (WHY), Skill (WHAT), Runtime (HOW)
- Governance-first: every action passes through gate/enforce/verdict/replay cycle
- YAML-driven agent and crew definitions (SSOT in `Agents/` and `Crews/`)
- Multi-language codebase: TypeScript (orchestrator, gateway, control), JavaScript (mission, brokers, governance), Python (MCP, policy engine, kernel world model)
- Append-only trace architecture for auditability
- DAG-based task scheduling with approval protocol

## Layers

**Domain Layer (WHERE):**
- Purpose: Orchestrate Method, Skill, and Runtime layers for specific business domains
- Location: `src/domain/`
- Contains: Domain registrations (`registry.ts`), domain-specific implementations (medical-research, investment-os, skeleton)
- Depends on: Method, Skill, Runtime layers
- Used by: Entry points (gateway, CLI, MCP server)
- Key file: `src/domain/index.ts` - barrel export with DOMAINS manifest and helper functions
- Key file: `src/domain/registry.ts` - DomainRegistry class, scans `config.yaml` per domain

**Method Layer (WHY):**
- Purpose: Define reasoning methodology - personas (WHO) and workflows (HOW they collaborate)
- Location: `src/method/`
- Contains: Persona YAML definitions (`personas/`), workflow YAML definitions (`workflows/`)
- Depends on: Nothing (pure declarative YAML)
- Used by: Domain layer, Runtime orchestrator
- Personas: `src/method/personas/*.yaml` - 12 standard roles (analyst, architect, coordinator, designer, developer, devops, guardian, pm, qa, researcher, reviewer, writer)
- Workflows: `src/method/workflows/*.yaml` - workflow DSL with phases, tasks, transitions, guards

**Skill Layer (WHAT):**
- Purpose: Define atomic and composite skills with typed input/output schemas
- Location: `src/skill/`
- Contains: Type definitions (`types.ts`), atomic skills (`atomic/`), composite skills (`composite/`), loader (`loader/`), registry (`registry/`)
- Depends on: Nothing (self-contained)
- Used by: Domain layer loads skills and passes to Runtime via ExecutionContext
- Key file: `src/skill/types.ts` - Skill interface (id, name, version, input/output schema, execute, validate)
- Atomic skills: `src/skill/atomic/` - competitor_analysis, content_optimization, csv_summarizer, keyword_research, market_research, pdf_processor, xlsx_processor

**Runtime Layer (HOW):**
- Purpose: Execute tasks through orchestrator, scheduler, executor, and policy engine
- Location: `src/runtime/`
- Contains: Orchestrator, DAG scheduler, agent executor, MCP servers, policy engine, evidence writers, execution gates
- Depends on: Control plane (interfaces only), Domain layer (for skill loading)
- Used by: Domain layer, Gateway
- Architecture rule: Runtime does NOT import from Skill layer directly; Domain loads skills and passes via ExecutionContext

**Control Plane:**
- Purpose: Capability registry, trust scoring, discovery/execution policies
- Location: `src/control/`
- Contains: CapabilityContract (7-field frozen schema), AgentCard, TrustProfile, registry, policy implementations
- Depends on: Nothing (pure interfaces + implementations)
- Used by: Runtime orchestrator depends on interfaces (`ICapabilityRegistry`, `IDiscoveryPolicy`, `IExecutionPolicy`, `ITrustStore`)
- Key file: `src/control/types.ts` - frozen v1 types

**Governance Layer:**
- Purpose: Gate/enforce/verdict/replay cycle for auditable agent governance
- Location: `src/governance/`
- Contains: Four primitives (gate, enforce, trace, replay), verdict generation, hash-chain trace validation
- Depends on: Nothing (self-contained)
- Used by: MCP server, gateway, CI gates
- Key file: `src/governance/index.mjs` - barrel export + `runGovernanceCycle()` orchestration function

**Kernel Layer:**
- Purpose: World Model infrastructure (T1/T2/T3 tiers) - cognitive state descriptions, never predictions
- Location: `src/kernel/`
- Contains: T1 (always-on/contextual/deferred units), T2 (derived maps), T3 (dynamics), world model runner
- Depends on: Nothing
- Used by: Domain layer consumers
- Governance: `src/kernel/GOVERNANCE_RULES.yaml` - FROZEN rules preventing World Model from becoming a decision engine
- World Model Python implementation: `src/kernel/world_model/runner.py`, `src/kernel/world_model/types.py`

**Gateway Layer:**
- Purpose: External API surface (WebSocket + HTTP) for OpenClaw integration
- Location: `src/gateway/openclaw/`
- Contains: WS server, HTTP routes, HMAC auth, trace store, AGE job client
- Depends on: Governance, Runtime
- Used by: External clients (Slack proxy, OpenClaw)
- Entry point: `src/gateway/openclaw/server.ts` - dual-port server (WS :3210, HTTP :3211)

## Data Flow

**Intent-to-Execution Pipeline (6-step):**

1. Intent arrives (user goal + domain + constraints) via gateway or direct call
2. **Decompose**: `RuleBasedDecomposer` matches Intent.goal keywords to Crew YAML, parses agents + process type, produces `TaskPlan` with `PlanTask[]`
3. **Route**: `CapabilityRouter` queries `ICapabilityRegistry` for candidates, filters via `IDiscoveryPolicy`, scores with 3-factor model (tag overlap 0.5 + trust 0.3 + domain affinity 0.2), produces `ResolvedTask[]`
4. **Execution Policy Check**: Post-route check determines autonomy level (auto/approve/block) based on side effects and trust
5. **Build DAG**: `DAGScheduler.fromResolvedTasks()` builds dependency graph with cycle detection
6. **Execute Loop**: `OrchestrationEngine.executeLoop()` processes ready tasks, handles approval protocol (pending_approval as formal DAG state), fallback with per-agent trust recording, aggregates results

**Governance Cycle:**

1. `gate()` - Risk assessment: pattern-match proposed actions against dangerous patterns (delete, overwrite, transfer_funds, etc.)
2. `enforce()` - Contract compliance: evaluate actions against allow/deny rules
3. `generateVerdict()` - Produce human-readable verdict from gate report + enforce result
4. `replay()` - Deterministic verification: re-validate trace hash chain

**Mission Execution:**

1. `src/mission/new.js` - Create mission pack (mission.yaml, context.md, constraints.md)
2. `src/mission/run.js` - Route to broker (Codex/Claude/Gemini/Antigravity)
3. Broker executes via `BaseBroker.run()` interface
4. Results stored in `data/missions/` with evidence chain

**State Management:**
- Traces: Append-only JSONL events in `.liye/traces/` and `data/traces/`
- State: Runtime state in `state/` (artifacts, control, memory, runtime, traces)
- Memory: Experience index in `memory/experience_index/`, diff tracking in `memory/diff/`
- Verdicts: Human-readable decision explanations in `verdicts/`

## Key Abstractions

**CapabilityContract (Frozen v1):**
- Purpose: 7-field description of what an agent can do
- Location: `src/control/types.ts`
- Fields: id (format: `{agent_id}:{skill_id}`), kind, name, domain, tags, side_effect, source_path
- Pattern: Immutable schema, capability-level granularity

**AgentCard:**
- Purpose: Agent representation in the capability registry
- Location: `src/control/types.ts`
- Contains: agent_id, contracts[], trust profile, status
- Pattern: One card per agent, multiple capability contracts per card

**TrustProfile:**
- Purpose: 3-dimensional trust scoring for agent reliability
- Location: `src/control/types.ts`
- Fields: overall_score (ranking only), read_score, write_score (gating), total_executions
- Pattern: Write gating uses write_score, ranking uses overall_score

**DAGScheduler:**
- Purpose: Task dependency management with approval states
- Location: `src/runtime/scheduler/dag.ts`
- States: pending -> ready -> running -> completed/failed; pending_approval (formal state with timeout)
- Pattern: Cycle detection, cascading failure, approval queue with state conservation invariant

**Skill Interface:**
- Purpose: Typed execute/validate contract for atomic capabilities
- Location: `src/skill/types.ts`
- Pattern: Input/output schemas, registry + loader pattern
- CompositeSkill: Chain of atomic skills with input/output mapping

**Mission Pack:**
- Purpose: Self-contained task unit for multi-broker execution
- Location: `src/mission/types.js`
- Structure: mission.yaml + context.md + constraints.md + outputs/ + evidence/
- Brokers: Codex, Claude, Gemini, Antigravity (routed by command type)

## Entry Points

**Gateway Server:**
- Location: `src/gateway/openclaw/server.ts`
- Triggers: `npm run gateway:start` / `npx tsx src/gateway/openclaw/server.ts`
- Responsibilities: WebSocket + HTTP server, HMAC auth, governance tool call processing, AGE job integration
- Ports: WS :3210, HTTP :3211

**MCP Governance Server:**
- Location: `src/mcp/server.mjs`
- Triggers: `npm run mcp:governance` / `node src/mcp/server.mjs`
- Responsibilities: JSON-RPC 2.0 over stdio, exposes 4 governance tools (gate, enforce, verdict, replay)

**MCP Knowledge Server (Python):**
- Location: `src/runtime/mcp/` (Python)
- Triggers: `npm run mcp:knowledge` / `python3 -m src.runtime.mcp.server_main`
- Responsibilities: Knowledge retrieval MCP server

**Context Assembler:**
- Location: `.claude/scripts/assembler.mjs`
- Triggers: `node .claude/scripts/assembler.mjs --task "description"`
- Responsibilities: Auto-load relevant Packs based on task keywords, compile context for Claude sessions

**Mission CLI:**
- Location: `src/mission/new.js`, `src/mission/run.js`
- Triggers: Mission creation and execution
- Responsibilities: Create mission packs, route to brokers, manage execution lifecycle

**Recall Tool:**
- Location: `tools/recall/recall.js`
- Triggers: `npm run recall` / `liye-recall` (bin)
- Responsibilities: Memory recall and search

## Error Handling

**Strategy:** Multi-layered: governance gates block dangerous actions, execution uses fallback chains, trust scoring tracks reliability

**Patterns:**
- Governance gate returns ALLOW/BLOCK/DEGRADE decisions with rationale
- DAG scheduler cascades failures to dependents
- Orchestrator fallback: on primary agent failure, tries alternatives in ranked order with separate trust recording per agent
- Approval timeout: pending_approval tasks fail after 5-minute default
- Trace write failure is non-fatal (catch-and-continue in orchestrator)
- Broker execution wraps in try/catch, returns structured `TaskResult` with status/error

## Cross-Cutting Concerns

**Logging:** Console-based logging throughout; no structured logging framework. Trace events serve as the primary audit log via append-only JSONL.

**Validation:** AJV (JSON Schema) for contract validation (`src/mcp/validator.mjs`); YAML-based governance rules with pattern matching; input validation via `skill.validate()` before execution.

**Authentication:** HMAC-based auth for gateway WebSocket connections (`src/gateway/openclaw/hmac.ts`); environment-variable-based secrets (LIYE_HMAC_SECRET).

**Tracing:** Hash-chained append-only traces in `.liye/traces/` and `data/traces/`. Each trace has a unique ID, events are sequenced with SHA-256 hash chain for tamper detection. Replay verifies hash chain integrity.

**CI/CD Gates:** 36+ GitHub Actions workflows in `.github/workflows/` enforcing architecture boundaries, governance rules, security, memory health, and more.

---

*Architecture analysis: 2026-04-13*
