---
artifact_scope: meta
artifact_name: Architecture-Doctrine-BGHS-Separation
artifact_role: doctrine
target_layer: cross
is_bghs_doctrine: yes
---

# ADR — Architecture Doctrine · BGHS Separation

**Status**: Accepted
**Date**: 2026-04-16
**Accepted-Date**: 2026-04-17
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`
**Supersedes**: —
**Referenced by**: P1-a, P1-b, P1-c, P1-d, P1-e, P1-f, P1-g（所有其他 P1 ADR）

---

## Context

LiYe Systems 的四层架构（Layer 0/1/2/3，见 `_meta/portfolio/SYSTEMS.md`）回答了"**组件住在哪里**"的问题（制度底座 / 编排中间层 / 域引擎 / 产品线）。

但四层架构没有回答另一个维度的问题：

> 一个组件**在本质上是什么**？
> 它是随模型代际更替的 harness？
> 还是跨模型代际不得放松的治理不变量？
> 还是执行动作的桥梁？
> 还是外部化的事件日志？

没有这个正交维度，会出现三类退化：

1. **Governance 被隐式折进 Brain**：治理规则写进 prompt，下次换模型就丢了
2. **Session 被看作 Brain 的内存**：会话上下文泄漏到决策逻辑，replay 不可行
3. **Hands 吃掉 Governance**：tool wrapper 里塞风控判断，调用方以为自己在调工具，实则绕过了治理

Managed Agents（Anthropic，见 `_meta/portfolio/SYSTEMS.md` Architecture References 区块）提出 **Brain / Hands / Session** 三分法，是一个有效的起点。但它把 Governance 隐式交给 Brain 或 Hands，对于 LiYe Systems 这种治理驱动的系统不适用——治理必须**显式可见、不得随模型升级而放松**。

本 Doctrine 将三分法升级为 **BGHS 四分法**，作为整个生态的裁判手册。

---

## 三问

### 1. 上游核心做法

**Managed Agents 三分法**（来源：`anthropic.com/engineering/managed-agents`）：

| Concern | 上游定义 |
|---------|---------|
| **Brain** | 模型 + prompt + reasoning harness。随模型能力变化，开发者控制 |
| **Hands** | 工具 / executor / adapter。与外部世界交互 |
| **Session** | 对话上下文、事件序列。外部化、可持久化 |

核心原则（上游贡献）：
- **Session externalization**：会话状态不住在模型的上下文窗口里，必须外部化为可持久化的事件日志
- **Harness replaceability**：当模型能力升级时，harness 应可替换而不改变系统契约
- **Tool isolation**：tools 是可替换的桥梁，不承载决策逻辑

### 2. 吸收什么，不吸收什么

**吸收**：
- Session 必须外部化（不住模型上下文）
- Brain（harness）随模型代际可替换
- Hands 与 Brain 解耦，不承载决策逻辑
- 正交于 runtime 分层的"组件本质"视角

**不吸收**：
- **三分法本身**：三分法把 Governance 隐式塞进 Brain 或 Hands，LiYe Systems 拒绝这种隐式
- **"Brain 即一切"的倾向**：不把治理退化为 prompt 工程
- **单一 Session 存储假设**：authoritative session event streams 可多源并存（如 `data/traces/...` / `state_transitions.jsonl`）；**receipts 不是 session 本体，而是 session-adjacent**（见 P1-e 的 taxonomy 定义），多源聚合由 P1-e Federated Query 负责

### 3. 最小落地 contract

**四分类 + 三模板 + 裁决规则**，见下文 Contract Sketch。

---

## Decision

### D1. 四种 Concern（BGHS）

LiYe Systems 所有 **component**（codebase 条目 / Skill / Agent / Crew / 可运行模块）归属以下四种 concern 之一：

| 代号 | 名称 | 一句话定义 | 更替信号 |
|------|------|----------|---------|
| **B** | Brain | 当前模型能力下的 harness 逻辑（prompt / reasoning pattern / decomposition strategy） | 模型代际升级 → 应可替换 |
| **G** | Governance | 跨模型代际不得放松的治理不变量（contracts / policies / kill switch / audit schema） | 任何时候 → 不得因模型升级而弱化 |
| **H** | Hands | 执行动作的 tools / executors / adapters（与外部世界交互） | 外部 API / 协议变化 → 更新实现 |
| **S** | Session | 外部化、可 replay 的事件日志与 resume contract | session semantics / replay guarantees 变化 → Doctrine 或 contract 审查；具体格式 / schema 演进 → 对应 contract ADR（如 P1-e / P1-g） |

### D2. BGHS 是视角，不是层级

- BGHS **正交**于 Layer 0/1/2/3，不替换、不平行
- 不得据 BGHS 创建目录（**禁止** `brain/`, `governance/`, `hands/`, `session/` 作为 runtime 目录名）
- 不得据 BGHS 创建 runtime 层级
- BGHS 只出现在**声明**（yaml frontmatter / declaration）里

### D3. 每种 artifact 用对应 Declaration

- **Component**（可运行）→ Component Declaration（含 primary_concern）
- **Meta**（Doctrine / Contract / Harvest ADR）→ Meta Declaration（**不参与 BGHS 分类**）
- **Reference**（外部概念 / fork / 论文 / 供应商文档）→ Reference Declaration（不参与 BGHS 分类）

### D4. 混合组件允许，但必须声明拆分方向

一个 component 可以同时承担 primary + secondary concern（例如：一个 Skill 主要是 Hands，但嵌入了小部分 Governance 检查）。但必须：

- 在 Component Declaration 里声明 `secondary_concern`
- 声明 `future_split_direction`（何时、按什么信号拆分）
- 不得永久混合超过两种 concern

### D5. Governance 修订的分层规则

Doctrine 负责**元规则**，不做所有具体治理参数变更的瓶颈。修订按层级分流：

| 修订类型 | 修订通道 | 例 |
|---------|---------|----|
| **Doctrine-level**：BGHS 分类本身、Declaration 模板字段、分类裁决规则、本 ADR 禁止事项 | 修本 Doctrine ADR（新 ADR supersede 旧条款） | 新增第 5 种 concern；`primary_concern` 改为多选 |
| **具体 policy / contract / guard 的不变量**：单条 policy 门限、单个 contract schema 字段、单个 guard 判定级别 | 修其所属的 **contract ADR / policy ADR**（不碰本 Doctrine） | 修改 A3 写白名单条目；GuardChain 新增一个扫描规则 |

**共同硬约束**（不分层级，永远成立）：
- 不得**仅因模型升级**而放松 Governance invariant
- 不得通过 prompt 或 harness 绕过已声明的 Governance
- 任何 Governance 放松都必须 **显式 ADR 记录**（而不是静默删除）

---

## Contract Sketch

### §1. 四种 Concern 的裁决规则（裁判手册）

判定一个 component 的 primary_concern 时，按顺序问以下 5 个问题：

```
Q1: 如果模型代际从 Claude 4 升级到 Claude 5，这个组件是否"应该"被替换或重写？
    YES → 候选 Brain
    NO  → 进入 Q2

Q2: 这个组件是否定义了"系统在任何模型下都不允许做某事"的规则？
    YES → 候选 Governance
    NO  → 进入 Q3

Q3: 这个组件是否与外部世界（API / 文件系统 / 数据库 / 工具）交互？
    YES → 候选 Hands
    NO  → 进入 Q4

Q4: 这个组件是否产出/消费"事件日志"或"状态快照"或"replay 契约"？
    YES → 候选 Session
    NO  → 混合组件（回到 Q1 重新判断 primary）

Q5: 上述候选中，哪个是此组件的"存在理由"？
    → primary_concern
    其余 → secondary_concern 或不声明
```

**反例速查**（常见错判）：

| 常见错误 | 正确判法 |
|---------|---------|
| 把 orchestrator prompt 判为 Governance | Prompt 随模型代际变化 → Brain |
| 把 kill switch 规则判为 Hands（因为"会调 API 关停"） | 规则本身不变 → Governance；停机动作执行 → Hands |
| 把 session retrieval 判为 Brain | 事件日志的读取契约 → Session；ranking prompt → Brain |
| 把 HMAC 验证判为 Governance | 这是 Hands 内的实现细节；Governance 是"必须验证身份"这条规则本身 |

### §2. Component Declaration（完整 schema）

```yaml
# 放在 Component 根目录 README.md / CLAUDE.md 头部，或独立 declaration.yaml
artifact_scope: component        # 固定值
component_name: string           # e.g., "loamwise-guard-chain"
layer: 0 | 1 | 2 | 3             # LiYe Systems 分层
primary_concern: Brain | Governance | Hands | Session
secondary_concern: null | Brain | Governance | Hands | Session
model_contingent_items:          # 随模型代际可能变化的部分（列表）
  - string                       # e.g., "decomposer prompt template"
model_independent_invariants:    # 跨模型不得放松的部分（列表）
  - string                       # e.g., "kill switch must block within 100ms"
session_source_of_truth: null | string
  # 如果该 component 产出/消费 session，指向 SoT 路径
  # e.g., "data/traces/<engine>/*/events.ndjson"
credential_path: null | string
  # 如果需要凭据，指向 CredentialBroker seam（见 P1-f）
  # e.g., "cred://loamwise/age-executor"
wake_resume_entrypoint: null | string
  # 如果支持 wake/resume，指向恢复入口
  # e.g., "src/runtime/resume_from_state.ts"
explicit_non_goals:              # 显式不做的事
  - string
future_split_direction: null | string
  # 如果是混合组件，声明拆分方向
  # e.g., "secondary Governance checks will move to loamwise/govern/ in P2"
```

### §3. Meta Declaration（用于所有 ADR）

```yaml
artifact_scope: meta             # 固定值
artifact_name: string            # e.g., "Hermes-Skill-Lifecycle"
artifact_role: doctrine | contract | harvest
target_layer: 0 | 1 | 2 | 3 | cross | none
is_bghs_doctrine: yes | no       # 仅本 Doctrine = yes；其他 ADR = no
```

**artifact_role 语义**（当前枚举固定为三类）：

| Role | 含义 | 例子 |
|------|------|------|
| `doctrine` | 定义架构原则的基础 ADR | 本 ADR |
| `contract` | 定义机器可执行的接口/schema/状态机 | P1-e/f/g |
| `harvest` | 从参考仓萃取 pattern 的决议 | P1-a/b/c/d |

> 如未来出现既非原则、也非契约、也非萃取的单点决策需求，通过 Doctrine 修订扩展枚举；当前不预留占位。

**target_layer 语义**：

- `0|1|2|3`：ADR 主要约束某一层
- `cross`：跨层 ADR（如 Session taxonomy 跨 Layer 0/1）
- `none`：无 runtime 约束（罕见，一般是纯文档）

### §4. Reference Declaration（用于外部概念/fork/论文）

```yaml
artifact_scope: reference        # 固定值
artifact_name: string            # e.g., "Managed-Agents"
source_kind: concept | fork | paper | vendor_doc
source_uri: string               # URL 或本地路径
```

### §5. 禁止事项（硬约束，违反 = 架构违规）

1. **不得据 BGHS 创建目录**
   - ❌ `loamwise/brain/`, `loamwise/governance/`, `loamwise/hands/`, `loamwise/session/`
   - ✅ `loamwise/govern/`, `loamwise/construct/`, `loamwise/align/`, `loamwise/reason/`（既有目录，按功能而非 concern 命名）

2. **不得据 BGHS 创建 runtime 层级**
   - ❌ "BGHS 是 Layer 0-3 之上的第 5 层"
   - ✅ BGHS 是声明里的分类字段

3. **Meta artifact 不参与 BGHS 分类**
   - ❌ 给一份 ADR 写 `primary_concern: Governance`
   - ✅ ADR 用 Meta Declaration，无 primary_concern

4. **Governance 不得因模型升级放松**
   - ❌ "新模型更聪明了，这条 policy 可以删"
   - ✅ 要放松必须走显式 ADR（Doctrine-level 改本 Doctrine；具体 policy/contract/guard 改其所属 contract ADR，见 D5），并显式 supersede 旧条款

5. **Session 不是单一存储，且 session-adjacent 不是 session 本体**
   - ❌ "所有 session 必须写到一个中央 session store"
   - ❌ "receipts 就是 session 的一部分，一起查就行"
   - ✅ authoritative session event streams 可多源（如 `data/traces/<engine>/<trace-id>/events.ndjson`、AGE `state_transitions.jsonl`）
   - ✅ **receipts 是 session-adjacent**（由 P1-e 给出 taxonomy 区分），不得与 session 本体混为一谈
   - ✅ 多源聚合与跨类型联合检索由 P1-e Federated Query 负责

6. **混合组件不得无限混合**
   - ❌ `primary: Brain, secondary: Governance, tertiary: Hands`
   - ✅ 最多 primary + secondary，且必须声明 `future_split_direction`

### §6. 审查清单（新组件/新 ADR 入库检查项）

新 **Component** 入库前：
- [ ] Component Declaration 完整（所有必填字段）
- [ ] primary_concern 通过 §1 裁决规则验证
- [ ] 混合组件已声明 future_split_direction
- [ ] model_independent_invariants 明确列出
- [ ] 如果声称 Session，`session_source_of_truth` 指向 authoritative session event stream（不是 receipts / session-adjacent）

新 **ADR** 入库前：
- [ ] Meta Declaration 头部完整
- [ ] `artifact_role` 与内容匹配（doctrine / contract / harvest）
- [ ] 如果是 `doctrine`，`is_bghs_doctrine: yes`；其他所有 ADR `is_bghs_doctrine: no`
- [ ] 如果 supersede 旧 ADR / 旧条款，明确标注
- [ ] 不在 ADR 里创建新的 BGHS 派生概念（如 BGHS 子目录、BGHS 层）

---

## 与 LiYe Systems 四层的关系

```
              ┌─────────────────────────────────────────────┐
              │  BGHS（分类视角，正交于 Layer）               │
              │  Brain · Governance · Hands · Session        │
              └─────────────────────────────────────────────┘
                           ↕ 正交
┌──────────┬──────────┬──────────┬──────────┐
│ Layer 0  │ Layer 1  │ Layer 2  │ Layer 3  │
│ LiYe OS  │ Loamwise │ Engines  │ Products │
└──────────┴──────────┴──────────┴──────────┘
```

- Layer 回答"**住在哪里**"
- BGHS 回答"**本质是什么**"
- 两者正交、各自独立、不互相替换

**典型组合示例**：

| Component | Layer | Primary Concern | 说明 |
|-----------|-------|----------------|------|
| `_meta/contracts/` | 0 | Governance | 制度不变量 |
| `src/runtime/orchestrator/` | 0 | Brain | harness 逻辑，随模型可替换 |
| `data/traces/` | 0 | Session | 外部化事件日志 |
| `src/control/a3-write-policy.ts` | 0 | Governance | 跨模型不变的写白名单规则 |
| `src/adapters/t1/` | 0 | Hands | 外部 agent 适配器 |
| `loamwise/govern/guards/` | 1 | Governance | GuardChain（待建） |
| `loamwise/construct/` | 1 | Brain (secondary: Governance) | 学习 harness + quarantine 审核 |
| `AGE state_transitions.jsonl` | 2 | Session | 引擎事件日志 |

---

## 非目标

- **不定义 Brain/Governance/Hands/Session 的实现**（由各 component 各自实现）
- **不替换四层架构**（Layer 0-3 保持不变）
- **不规定技术栈**（TypeScript / Python / YAML 均可）
- **不规定目录命名**（除 §5 禁止项外，具体目录由各 repo 自定）
- **不规定 ADR 编号策略**（由 `_meta/adr/` 维护规则决定）
- **不处理具体 Engine/Skill/Guard 契约**（交给后续 contract ADRs）

---

## 后续实现入口

| 阶段 | ADR / 位置 | 作用 |
|------|-----------|------|
| P1-a | `ADR-OpenClaw-Capability-Boundary.md` | harvest：引用本 doctrine 为 Layer 0 能力边界分类 |
| P1-b | `ADR-Hermes-Skill-Lifecycle.md` | harvest：引用本 doctrine 的 Brain (candidate) vs Governance (quarantine) 分离 |
| P1-c | `ADR-Hermes-Memory-Orchestration.md` | harvest：引用本 doctrine 的 Session 概念定义 |
| P1-d | `ADR-Loamwise-Guard-Content-Security.md` | harvest：引用本 doctrine 的 Governance 不变量原则 |
| P1-e | `ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query.md` | contract：定义 session / session-adjacent taxonomy，落实本 doctrine §5.5（Session 多源 + receipts 作为 session-adjacent 的联合检索） |
| P1-f | `ADR-Credential-Mediation.md` | contract：实现 Component Declaration 的 `credential_path` |
| P1-g | `ADR-AGE-Wake-Resume.md` | contract：实现 Component Declaration 的 `wake_resume_entrypoint` |
| 入库纪律 | `_meta/portfolio/SYSTEMS.md` 运维纪律 | 新 Component 必附 Component Declaration；新 ADR 必附 Meta Declaration |

**本 ADR 不实施任何代码**。

---

## Appendix A: 修订协议

修改本 Doctrine 必须遵守：

1. 新 Doctrine ADR supersede 旧条款（显式标注 `Supersedes: ADR-...`）
2. 不得通过修改 `_meta/portfolio/SYSTEMS.md` 的 "架构原则" 章节来偷改 Doctrine——SYSTEMS.md 只复述，Doctrine 才是 SSOT
3. 修订触发：
   - BGHS 四分类扩展（如引入第 5 种 concern）
   - Declaration 模板字段变更（含 `artifact_role` 枚举扩展）
   - 禁止事项增删
   - 裁决规则修订
   - D5 修订分层规则的调整（Doctrine-level vs contract/policy 层的分工边界）

---

**Version**: 1.0.0
**Last Updated**: 2026-04-16
