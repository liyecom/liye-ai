# Anthropic FSI Architecture Map

**Status**: Research map
**Date**: 2026-05-10
**Source**: `/Users/liye/github/financial-services/`
**Use**: Reference only. No plugin registration, script execution, or runtime dependency.

---

## 研究结论

Anthropic `financial-services` repo 的核心价值不是金融模型本身，而是把高信任领域工作流产品化成一组边界清晰的 artifacts：

```
marketplace
  -> plugin package
    -> canonical agent prompt
    -> skills / commands / MCP connectors
  -> managed-agent cookbook
    -> agent.yaml wrapper
    -> depth-1 subagents
    -> steering events
    -> harness-side schema validation
```

对 LiYe Systems 最有价值的迁移点是：

1. 同一份 agent / skill source 可以被不同 runtime surface 包装。
2. agent orchestrator、reader、critic、writer 的权限分离是治理结构，不是 prompt 风格。
3. 不可信输入经过只读 reader 和 schema validation 后才能进入调度上下文。
4. 写能力集中到唯一 leaf worker，且高风险动作只 staged，不发布、不入账、不审批。
5. agent 之间不直接互调，handoff 由外部 orchestrator allowlist + schema validate。

---

## Artifact Graph

| Artifact | Source | Anthropic 用法 | LiYe 解释 |
|---|---|---|---|
| Marketplace manifest | `.claude-plugin/marketplace.json` | 注册可安装插件列表和 source path | 外部 capability index，不等于 trust |
| Plugin manifest | `plugins/**/.claude-plugin/plugin.json` | 插件最小元数据 | Ownership boundary |
| Agent prompt | `plugins/agent-plugins/<slug>/agents/<slug>.md` | workflow identity + guardrails | Brain artifact with Governance hints |
| Vertical skill | `plugins/vertical-plugins/<vertical>/skills/*/SKILL.md` | skill source of truth | Professional operating procedure |
| Bundled skill copy | `plugins/agent-plugins/<slug>/skills/*` | self-contained agent package | Vendored dependency requiring drift check |
| Command | `plugins/vertical-plugins/*/commands/*.md` | explicit slash workflow | Manual dispatch surface |
| MCP config | `plugins/vertical-plugins/*/.mcp.json` | data connector registry | Hands, credential-mediated |
| Managed wrapper | `managed-agent-cookbooks/<slug>/agent.yaml` | `POST /v1/agents` deploy manifest | Runtime surface adapter |
| Subagent manifest | `managed-agent-cookbooks/<slug>/subagents/*.yaml` | leaf worker definitions | Worker topology + permission profile |
| Steering examples | `managed-agent-cookbooks/<slug>/steering-examples.json` | event examples | Session entrypoints |
| Deploy script | `scripts/deploy-managed-agent.sh` | resolves refs, uploads skills, creates agents | Harness behavior, not contract source |
| Orchestrator script | `scripts/orchestrate.py` | routes `handoff_request` | External Session router pattern |
| Validator script | `scripts/validate.py` | validates worker output schema | Governance gate outside model text |

---

## Representative Workflows

### Pitch Agent

Files:

- `plugins/agent-plugins/pitch-agent/agents/pitch-agent.md`
- `managed-agent-cookbooks/pitch-agent/agent.yaml`
- `managed-agent-cookbooks/pitch-agent/subagents/researcher.yaml`
- `managed-agent-cookbooks/pitch-agent/subagents/modeler.yaml`
- `managed-agent-cookbooks/pitch-agent/subagents/deck-writer.yaml`

Pattern:

```
orchestrator: read/grep/glob + market data MCPs
  -> researcher: read-only + market data MCPs -> structured comps / precedents
  -> modeler: read + bash + market data MCPs -> calculations
  -> deck-writer: only worker with Write/Edit -> ./out/model.xlsx + ./out/pitch.pptx
```

LiYe takeaway:

- This is primarily task decomposition and artifact isolation.
- Trusted data connectors can exist upstream, but final artifact writing remains isolated.
- The writer owns file production but does not own data-source access.

### GL Reconciler

Files:

- `plugins/agent-plugins/gl-reconciler/agents/gl-reconciler.md`
- `plugins/agent-plugins/gl-reconciler/skills/gl-recon/SKILL.md`
- `managed-agent-cookbooks/gl-reconciler/agent.yaml`
- `managed-agent-cookbooks/gl-reconciler/subagents/reader.yaml`
- `managed-agent-cookbooks/gl-reconciler/subagents/critic.yaml`
- `managed-agent-cookbooks/gl-reconciler/subagents/resolver.yaml`

Pattern:

```
untrusted counterparty/custodian docs
  -> reader: Read/Grep only, no MCP, no bash, no Write
  -> schema validation: length caps + character class restrictions
  -> critic: trusted GL/subledger MCPs, read-only re-verification
  -> resolver: only worker with Write/Edit, no external docs, writes ./out/
```

LiYe takeaway:

- This is the strongest pattern for Loamwise GuardChain evolution.
- The untrusted reader is deliberately deprived of tools that could cause side effects.
- The writer never sees raw outsider content; it receives validated, critic-checked facts.
- Ledger adjustment remains outside the agent and requires human approval.

---

## Security Pattern

### P1. Marketplace does not grant trust

The marketplace lists plugin sources. Trust still needs lifecycle validation, provenance, and policy admission. For LiYe, marketplace import must map to the Hermes-inspired quarantine lifecycle, not direct activation.

### P2. Source of truth and bundle are separate

Anthropic keeps vertical skills as source and copies them into agent bundles. `scripts/check.py` detects drift and `scripts/sync-agent-skills.py` propagates source changes.

LiYe should not copy this blindly. If vendoring is needed, every bundled skill copy must carry source hash / provenance / lifecycle state.

### P3. Wrapper manifests are runtime adapters

`agent.yaml` files reference canonical prompts and skills, then the deploy harness resolves:

| Manifest convention | Runtime resolution |
|---|---|
| `system.file` | inline prompt text |
| `skills.from_plugin` | upload every bundled skill |
| `skills.path` | upload one custom skill |
| `callable_agents.manifest` | create subagent and reference id |
| `output_schema` | harness-side validation, removed before API POST |

For LiYe, wrapper manifests belong to Hands / Session runtime surfaces. The contract must live above the wrapper.

### P4. Depth-1 delegation is a runtime limit, not doctrine

Anthropic states callable agents support one delegation level in this preview. LiYe should absorb the topology declaration and isolation discipline, not the depth limit as a permanent architectural rule.

### P5. Handoff is externalized

Named agents do not call each other directly. They emit a handoff request, and `scripts/orchestrate.py` routes it with:

- target allowlist
- payload schema validation
- new steering event to target session

The reference script parses text; its own comment says production should prefer typed tool calls or typed SSE events. LiYe should implement handoff as typed Session events, not regex over model text.

---

## BGHS Mapping

| Anthropic FSI item | BGHS concern | LiYe placement |
|---|---|---|
| Agent prompt | Brain | Loamwise / Engine harness prompt artifact |
| Skill instructions | Brain, secondary Hands | Skill lifecycle artifact, dispatchable only after Governance admission |
| Plugin manifest | Governance | Capability ownership declaration |
| MCP connector config | Hands | Credential-mediated connector declaration |
| Output schema | Governance | GuardChain / validation contract |
| Deploy script resolution | Hands | Runtime adapter behavior |
| Steering event | Session | Wake / resume entrypoint |
| Handoff routing | Session, secondary Governance | Loamwise event bus with allowlist |
| Human signoff rule | Governance | Policy invariant |
| Writer-only leaf | Governance, secondary Hands | WriteGate worker topology |

---

## LiYe Evolution Implications

### Layer 0: LiYe OS

Define a contract for agent units that separates:

- canonical source artifacts
- runtime wrappers
- worker topology
- trust boundaries
- output schemas
- handoff schemas
- human signoff rules

Candidate contract: `_meta/contracts/agent/liye_agent_contract.schema.yaml`.

### Layer 1: Loamwise

Loamwise should become the execution authority for:

- dispatching agent units
- enforcing single-writer topology
- validating reader outputs before context merge
- writing handoff events to Session
- attaching GuardEvidence to every worker transition

### Layer 2: Domain Engines

Domain Engines should expose playbooks and agent units through manifest contracts, not bespoke prompts. AGE and Chaming can start with read-only or staged-write agent units before D2 dispatch.

### Layer 3: Product Lines

Product systems may consume staged artifacts, but should not directly host Loamwise governance rules. UI can show signoff queues; policy remains Layer 0/1.

---

## Immediate Research Verdict

Absorb the pattern, not the product:

- Absorb: one source / multiple runtime wrappers, single-writer leaf, untrusted-reader isolation, schema-validated worker output, external typed handoff, staged high-risk actions.
- Do not absorb: Claude-specific model pinning, marketplace-as-trust, regex text handoff as production, markdown guardrails as sole enforcement, unmanaged vendored skill drift.

