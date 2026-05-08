# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
liye_os/
├── .claude/               # Claude Code integration (packs, scripts, hooks)
├── .ci/                   # CI replay fixtures
├── .github/               # GitHub Actions workflows (36+ gates)
├── .liye/                 # Runtime trace storage (not versioned)
├── .planning/             # Planning documents
├── .security/             # Security configuration
├── _meta/                 # System metadata, governance, schemas, templates
├── Agents/                # Agent YAML definitions (SSOT)
├── artifacts/             # Build artifacts
├── Artifacts_Vault/       # Archived deliverables
├── builders/              # Build toolchain (Contract -> Artifacts)
├── config/                # Runtime configuration (brokers, policy)
├── contracts/             # Governance contracts
├── Crews/                 # Crew YAML definitions (multi-agent teams)
├── data/                  # Runtime data (missions, traces, stats)
├── dist/                  # TypeScript compiled output
├── docs/                  # User documentation (30+ subdirectories)
├── evidence/              # Execution evidence artifacts
├── examples/              # Integration examples (feishu, dify, wecom, etc.)
├── Extensions/            # Capability extensions (MCP servers, slack-proxy)
├── Glossaries/            # Domain terminology definitions
├── golden/                # Golden test fixtures
├── i18n/                  # Internationalization
├── knowledge/             # Knowledge base (design, glossary)
├── memory/                # Memory system (experience index, diffs)
├── Projects_Engine/       # Project management engine
├── replays/               # Replay test data
├── scripts/               # Operational scripts (CI, monitoring, canary)
├── Skills/                # Skill library (13 categories, passive knowledge)
├── src/                   # Source code (runtime implementations)
├── state/                 # Runtime state (artifacts, control, memory, traces)
├── systems/               # Deployable systems (information-radar, site-deployer)
├── tests/                 # Test suites
├── tools/                 # Development tools (notion-sync, recall, converters)
├── traces/                # Top-level trace storage
├── tracks/                # Long-lived project folders for governance
├── verdicts/              # Human-readable decision explanations
├── websites/              # Multi-site workspace (Astro projects)
├── CLAUDE.md              # Claude Code kernel config (startup router)
├── package.json           # Node.js manifest (liye-ai v6.3.0)
├── tsconfig.json          # TypeScript config (ES2022, NodeNext)
├── vitest.config.ts       # Test runner config
└── docker-compose.mcp.yml # MCP server Docker setup
```

## Source Code Layout (`src/`)

```
src/
├── adapters/              # External system adapters
│   ├── t1/                # Tier-1 external agent adapters
│   └── write_executor/    # Write execution adapter
├── analytics/             # Analytics (cost reporting)
├── audit/                 # Audit system (evidence, replay)
│   ├── evidence/          # Evidence collection
│   ├── index/             # Audit indexing
│   └── replay/            # Replay verification
├── brokers/               # LLM broker adapters (claude, codex, gemini, antigravity)
├── config/                # Configuration loading (approval, safety)
├── context/               # Mission context & event log
├── contracts/             # Contract implementations
│   └── phase1/            # Phase 1 contracts
├── control/               # Control plane (registry, trust, policies)
├── domain/                # Domain layer (WHERE)
│   ├── investment-os/     # Investment domain
│   ├── medical-os/        # Medical OS domain
│   ├── medical-research/  # Medical research domain
│   └── skeleton/          # Reference domain implementation
├── gateway/               # External API gateway
│   └── openclaw/          # OpenClaw integration (WS + HTTP)
├── governance/            # Governance kernel (gate/enforce/verdict/replay)
│   ├── learning/          # Governance learning
│   ├── trace/             # Trace reader/writer
│   └── utils/             # Hash utilities
├── kernel/                # World Model kernel
│   ├── t1/                # Tier 1 (always-on, contextual, deferred)
│   ├── t2/                # Tier 2 (derived maps)
│   ├── t3/                # Tier 3 (dynamics)
│   └── world_model/       # World model runner (Python)
├── mcp/                   # MCP governance server (JSON-RPC stdio)
├── memory/                # Memory schema definitions
├── method/                # Method layer (WHY)
│   ├── personas/          # 12 standard persona YAML files
│   └── workflows/         # Workflow DSL YAML files
├── mission/               # Mission pack system (create, run, index)
├── reasoning/             # Reasoning engine
│   ├── demo/              # Reasoning demos
│   ├── execution/         # Action execution (dry-run, real, gates)
│   ├── explanation/       # Explanation generation
│   ├── feedback/          # Feedback processing
│   └── replay/            # Reasoning replay
├── runtime/               # Runtime layer (HOW)
│   ├── dispatcher/        # Task dispatcher with policies
│   ├── evidence/          # Evidence writers (7 types)
│   ├── execution/         # Execution gates (write, quota, kill-switch, four-key)
│   ├── executor/          # Agent executor (types + implementation)
│   ├── governance/        # Governance bridge
│   ├── mcp/               # MCP knowledge server (Python)
│   ├── memory/            # Runtime memory (context, observation gateway)
│   ├── orchestrator/      # Orchestration engine (decompose, route, execute)
│   ├── policy/            # Policy engine (Python)
│   └── scheduler/         # DAG scheduler
└── skill/                 # Skill layer (WHAT)
    ├── atomic/            # 7 atomic skill implementations
    ├── composite/         # Composite skill chains
    ├── loader/            # Skill loader
    └── registry/          # Skill registry
```

## Directory Purposes

**`Agents/`:**
- Purpose: SSOT for all agent definitions
- Contains: YAML files defining agent id, name, domain, persona, skills
- Key files: `Agents/core/analyst.yaml`, `Agents/core/orchestrator.yaml`, `Agents/core/researcher.yaml`
- Subdirs: `core/` (built-in agents), `geo/` (geo-domain agents with JS implementations)
- Template: `Agents/_template.yaml`

**`Crews/`:**
- Purpose: SSOT for multi-agent team compositions
- Contains: YAML files defining crew id, agents, process type (sequential/parallel/hierarchical), goals
- Key files: `Crews/core/analysis-team.yaml`, `Crews/core/research-team.yaml`
- Template: `Crews/_template.yaml`

**`Skills/`:**
- Purpose: Passive knowledge library (methodology, SOPs, templates) organized in 13 numbered categories
- Contains: Markdown skill documentation (00-12 + 99_Incubator)
- Categories: Core Utilities, Research Intelligence, Operation Intelligence, Creative Production, Business Operations, Medical Intelligence, Technical Development, Data Science, Communication, Learning Growth, Health Wellness, Life Design, Meta Cognition

**`src/control/`:**
- Purpose: Control plane - capability registry, trust scoring, discovery/execution policies
- Key files:
  - `src/control/types.ts` - Frozen v1 types (CapabilityContract, AgentCard, TrustProfile, policy interfaces)
  - `src/control/registry.ts` - CapabilityRegistry implementation
  - `src/control/trust.ts` - TrustScoreStore
  - `src/control/discovery-policy.ts` - Pre-route filtering
  - `src/control/execution-policy.ts` - Post-route autonomy determination
  - `src/control/a3-write-policy.ts` - A3 write safety (whitelist, pre-flight, rollback, kill switch)
  - `src/control/a3-verifiers.ts` - A3 verification and rollback functions

**`src/runtime/orchestrator/`:**
- Purpose: 6-step orchestration pipeline (decompose -> route -> policy -> DAG -> execute -> aggregate)
- Key files:
  - `src/runtime/orchestrator/engine.ts` - OrchestrationEngine (main pipeline)
  - `src/runtime/orchestrator/decomposer.ts` - RuleBasedDecomposer (Intent + Crew YAML -> TaskPlan)
  - `src/runtime/orchestrator/router.ts` - CapabilityRouter (3-factor scoring: tags 0.5 + trust 0.3 + domain 0.2)
  - `src/runtime/orchestrator/types.ts` - Intent, PlanTask, ResolvedTask, OrchestrationResult

**`src/governance/`:**
- Purpose: Four governance primitives for auditable agent control
- Key files:
  - `src/governance/gate.mjs` - Risk assessment (dangerous pattern matching)
  - `src/governance/enforce.mjs` - Contract compliance checking
  - `src/governance/verdict.mjs` - Verdict generation
  - `src/governance/replay.mjs` - Deterministic replay verification
  - `src/governance/trace/` - Append-only trace reader/writer
  - `src/governance/types.mjs` - Protocol version, enums, ID generators

**`_meta/`:**
- Purpose: System metadata, governance documents, schemas, templates
- Key subdirs:
  - `_meta/docs/` - Architecture documents (`ARCHITECTURE_CONSTITUTION.md`, `FILE_SYSTEM_GOVERNANCE.md`)
  - `_meta/contracts/` - Machine-enforced governance constraints
  - `_meta/schemas/` - JSON schemas for validation
  - `_meta/templates/` - Templates (mission, trace, track, world_model)
  - `_meta/governance/` - Governance validator scripts
  - `_meta/adr/` - Architecture Decision Records

**`.claude/`:**
- Purpose: Claude Code integration layer
- Key files:
  - `.claude/packs/` - On-demand context packs (operations.md, research.md, infrastructure.md, protocols.md)
  - `.claude/scripts/assembler.mjs` - Context compiler (auto-loads packs by task keywords)
  - `.claude/scripts/guardrail.mjs` - File size guardrail checker
  - `.claude/scripts/pre_tool_check.mjs` - Pre-tool governance hook
  - `.claude/scripts/stop_gate.mjs` - Session completion gate

**`state/`:**
- Purpose: Runtime state storage
- Subdirs: `state/artifacts/`, `state/control/`, `state/memory/`, `state/runtime/`, `state/traces/`, `state/tmp/`
- Not all subdirs are versioned

**`data/`:**
- Purpose: Runtime data and mission storage
- Key files: `data/index.json` (mission index), `data/events.jsonl` (event log)
- Subdirs: `data/missions/`, `data/traces/`, `data/stats/`, `data/facts/`, `data/runs/`

## Key File Locations

**Entry Points:**
- `src/gateway/openclaw/server.ts`: Gateway server (WS + HTTP)
- `src/mcp/server.mjs`: MCP governance server (JSON-RPC stdio)
- `src/mission/new.js`: Mission creation CLI
- `src/mission/run.js`: Mission execution
- `.claude/scripts/assembler.mjs`: Context compiler for Claude sessions
- `tools/recall/recall.js`: Memory recall tool (also `bin.liye-recall`)

**Configuration:**
- `package.json`: Node.js manifest, scripts, dependencies
- `tsconfig.json`: TypeScript compiler settings (ES2022, NodeNext, strict)
- `vitest.config.ts`: Test runner configuration
- `config/brokers.yaml`: Broker routing configuration
- `config/policy.yaml`: Runtime policy configuration
- `CLAUDE.md`: Claude Code kernel routing config

**Core Logic:**
- `src/runtime/orchestrator/engine.ts`: Orchestration pipeline
- `src/runtime/scheduler/dag.ts`: DAG task scheduler
- `src/runtime/executor/agent.ts`: Agent executor
- `src/control/types.ts`: Control plane type definitions (frozen)
- `src/governance/index.mjs`: Governance cycle orchestration
- `src/domain/registry.ts`: Domain registry

**Testing:**
- `tests/control/`: Control plane tests
- `tests/orchestrator/`: Orchestrator tests
- `tests/gateway/`: Gateway tests
- `tests/governance/`: Governance tests
- `tests/runtime/`: Runtime tests
- `tests/reasoning/`: Reasoning engine tests
- `tests/smoke/`: Smoke tests

## Naming Conventions

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `discovery-policy.ts`, `a3-write-policy.ts`)
- JavaScript source: `snake_case.js` or `kebab-case.js` (mixed, older code)
- ESM JavaScript: `snake_case.mjs` (e.g., `gate.mjs`, `enforce.mjs`, `trace_writer.mjs`)
- YAML configs: `kebab-case.yaml` (e.g., `analysis-team.yaml`, `full-cycle.yaml`)
- Test files: `*.test.ts` or `*.test.mjs`
- Governance rules: `UPPER_SNAKE_CASE.yaml` (e.g., `GOVERNANCE_RULES.yaml`, `REGISTRY.yaml`)

**Directories:**
- Source layers: `kebab-case` (e.g., `write_executor/`, `medical-research/`)
- Top-level knowledge dirs: `PascalCase` (e.g., `Agents/`, `Crews/`, `Skills/`, `Extensions/`)
- Meta/infra dirs: `_prefix` for metadata (`_meta/`), `.prefix` for hidden (`.claude/`, `.liye/`)

**Exports:**
- TypeScript: PascalCase for classes/interfaces, camelCase for functions
- Barrel exports via `index.ts` or `index.mjs`
- Singleton pattern: `getXxxRegistry()` factory functions

**Agent/Crew IDs:**
- Format: `kebab-case` (e.g., `analyst`, `orchestrator`, `research-team`)
- Capability contract IDs: `{agent_id}:{skill_id}` format

## Where to Add New Code

**New Domain:**
- Create directory: `src/domain/{domain-name}/`
- Add `config.yaml` with domain manifest (id, name, version, description, agents, workflows, skills)
- Optionally add `agents/`, `skills/`, `workflows/` subdirectories
- Register will auto-discover via `DomainRegistry.scanDomains()`

**New Agent:**
- YAML definition: `Agents/{category}/{agent-id}.yaml` (SSOT location)
- Follow template: `Agents/_template.yaml`
- Runtime will discover via `src/control/extractor.ts` scanning

**New Crew:**
- YAML definition: `Crews/{category}/{crew-id}.yaml`
- Follow template: `Crews/_template.yaml`
- Decomposer discovers via keyword matching against intent goals

**New Atomic Skill:**
- Implementation: `src/skill/atomic/{skill_name}.ts`
- Implement `Skill` interface from `src/skill/types.ts`
- Register in skill registry

**New Runtime Component:**
- Executor: `src/runtime/executor/`
- Evidence writer: `src/runtime/evidence/`
- Execution gate: `src/runtime/execution/`
- Policy: `src/runtime/policy/policies/`

**New Control Plane Component:**
- Types go in `src/control/types.ts` (extend, do not modify frozen fields)
- Implementations: `src/control/{component-name}.ts`
- Export via `src/control/index.ts`

**New Governance Primitive:**
- Implementation: `src/governance/{primitive}.mjs`
- Export via `src/governance/index.mjs`
- Add MCP tool binding in `src/mcp/tools.mjs`

**New Test:**
- Location: `tests/{layer-name}/{component}.test.ts`
- Follow existing patterns in `tests/control/`, `tests/orchestrator/`, `tests/gateway/`

**New CI Gate:**
- Workflow: `.github/workflows/{gate-name}.yml`
- Script (if needed): `.claude/scripts/{script-name}.mjs` or `scripts/ci/`

**New Extension:**
- MCP server: `Extensions/mcp-servers/{server-name}/`
- Other: `Extensions/{extension-name}/`

**New Tool:**
- Location: `tools/{tool-name}/`
- Add npm script in `package.json` if appropriate

## Special Directories

**`.liye/`:**
- Purpose: Runtime trace storage and monitor cache
- Generated: Yes (at runtime)
- Committed: No (in .gitignore)

**`state/`:**
- Purpose: Runtime state persistence (control, memory, traces)
- Generated: Partially (some seeded, some runtime-generated)
- Committed: Partially

**`dist/`:**
- Purpose: TypeScript compilation output
- Generated: Yes
- Committed: No

**`.claude/.compiled/`:**
- Purpose: Compiled context output from assembler
- Generated: Yes
- Committed: No

**`websites/`:**
- Purpose: Multi-site Astro project workspace
- Generated: Build artifacts yes, source partially
- Committed: Partially (in .gitignore note)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes
- Committed: No

**`golden/`:**
- Purpose: Golden test fixtures for regression testing
- Generated: No (manually curated)
- Committed: Yes

**`evidence/`:**
- Purpose: Execution evidence artifacts for governance audit
- Generated: Yes (by evidence writers)
- Committed: Yes (selective)

---

*Structure analysis: 2026-04-13*
