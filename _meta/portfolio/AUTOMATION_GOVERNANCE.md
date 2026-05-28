# AUTOMATION_GOVERNANCE — Portfolio Automation Trust Boundary

> 本文件是 SYSTEMS.md 在"自动化主体（automation subject）"维度的延伸。
> 任何自动化行为（hook / skill / subagent / MCP / Claude 直接 tool call）必须符合本文。
> 与 SYSTEMS.md 冲突时以 SYSTEMS.md 为准。

**Schema version**: 4
**Effective**: 2026-05-19
**Status**: Phase 0A-v2.2 (静态资产；parser/self-test/hook 见 Phase 0B/0C)

---

## 0. 设计原则

1. **治理先于工具** — 不引入未被 governance 覆盖的自动化
2. **静默 fail-closed** — 解析器故障 / 配置缺失 / unknown 路径 → block write
3. **单点决策** — 所有 hook 通过 `automation-context.sh` 单脚本判定
4. **可回滚** — 任何 artifact 可独立 git revert
5. **paste-only self-modification** — Claude 不得直接写入控制自身权限的文件
6. **hard constraints 不可绕过** — 见 §10

### 0.1 Phase 0A 的 transitional 限制

Phase 0A 仅完成 secret redaction + 静态资产 paste + audit chain 起点。
**Phase 0A 不完成**：blanket allow 收敛（curl/python3/pip3 install/docker exec/git reset/open/osascript 等）— 列入 "Phase X · permission tightening"；hook 安装（0C）；parser / sealed-registry / self-test（0B）。
0A 完成 = 文档态，secret 已清除，但 blanket allow 仍是高风险，**不是安全硬化态**。

---

## 1. 自动化分级（layer）

| Layer | 名义 | 例 | 默认 |
|---|---|---|---|
| **L0** | read-only / advisory | grep, read, schema validate, portfolio-route 查询 | always-on |
| **L1** | 局部建议 + dry-run mutation | prettier --check, contract fix suggestion | session active 时启用 |
| **L2** | 实际写入业务代码/数据 | prettier --write, contract migrate, DB write | session + branch + class 三重满足 |
| **L3** | 修改 Claude 自身配置 | .claude/**, hooks, MCP 安装, governance 文件 | **永远 paste-only**；hard constraint |

---

## 2. 目标类（target_class）与决策矩阵

路径 → target_class 由 `target-classes.yaml` 提供（deny_first → first-match-wins → unmapped）。

### 2.1 决策矩阵

| target_class | read | write (no session) | write (session L1) | write (session L2) |
|---|---|---|---|---|
| `automation_config` | ALLOW | BLOCK | BLOCK | BLOCK (hard) |
| `sealed_artifact` | ALLOW | BLOCK | BLOCK | BLOCK (hard) |
| `governance_documentation` | ALLOW | BLOCK | BLOCK | ALLOW (L2 + non-main) |
| `contract_artifact` | ALLOW | BLOCK | BLOCK (validate=L0) | ALLOW |
| `planning_artifact` | ALLOW | BLOCK | ALLOW | ALLOW |
| `product_code` | ALLOW | BLOCK | BLOCK (suggest) | ALLOW |
| `test_artifact` | ALLOW | BLOCK | ALLOW | ALLOW |
| `ordinary_documentation` | ALLOW | BLOCK | ALLOW | ALLOW |
| `meta_file` | ALLOW | BLOCK | ALLOW | ALLOW |
| `unmapped` | ALLOW | BLOCK + glob-suggest | BLOCK + glob-suggest | BLOCK + glob-suggest |

### 2.2 横向 gate

矩阵允许后仍需通过以下 gate（任一失败 → block）：

- **Main/master/sealed-* branch policy**（hard）：
  - automation_config / sealed_artifact / governance_documentation / contract_artifact / product_code / test_artifact → 一律 BLOCK
  - planning_artifact → 最多 L1（advisory/dry-run）；L2 写入 BLOCK
  - ordinary_documentation / meta_file → 最多 L1
  - 任何 L2+ write 必须在 feature/fix branch
- target 命中 `sealed-registry.json` → BLOCK (hard)
- 全局 session（~/.claude/automation-session.yaml）只能解锁 L0/L1
- 数据查询命中含 `prod` substring 的 host / file path → 走 §4.6 enum 判定

### 2.3 Credential Risk Taxonomy & Rating

phase-0a-2 与 phase-0a-3 batch 1 的实证发现要求 credential 风险评级超越单一维度（磁盘 plaintext 不等同 active leak）。本节正式纳入三分类法与三维风险公式。

**Credential 三分类**（取代单一 "ghost" 概念）：

| 类别 | 定义 | 处置 |
|---|---|---|
| **Ghost reference** | disk plaintext 存在，但 server-side（DB / provider）已删除 | 磁盘清理；实际风险 = 0 |
| **Orphan DB credential** | server-side active，但 portfolio 内 zero consumer reference | revoke |
| **Live credential** | server-side active，且 has consumer reference | rotate + consumer sync |

适用 `sk_` / `pk_` / JWT / OAuth token / DB password 等任何 long-lived credential。

**风险公式**：

risk = f(disk_plaintext, db_validity, consumer_reachable)

具体打分函数实现在 Phase 0B parser 中定义。本节仅定义 input 维度与必须输出的分类标签。

三维度合并判定，**单一维度不充分**：
- `disk_plaintext` 单维 → false-positive active-leak（phase-0a-2 sk_de44 ghost finding 证伪）
- `db_validity` 单维 → 遗漏 disk-only dormant references
- `consumer_reachable` 单维 → 无法区分 Orphan vs Live，导致误 rotate 增加 onboard window 风险

**实证依据**：
- phase-0a-2 (2026-05-19)：`sk_de44 (bdf6544565a0)` 磁盘 plaintext 存在 → 调研发现 Medusa DB 中已不存在 → 判定 Ghost，磁盘清理后实际风险 = 0
- phase-0a-3 batch 1 (2026-05-19)：`sk_4ec***86c` / `sk_69c***f98` 在 Medusa DB active → grep portfolio 无 consumer reference → 判定 Orphan → revoked 2026-05-19T11:42:29Z

**Phase 0B parser 必须实现**：
- disk fingerprint ↔ server-side credential registry ↔ consumer reference 三向 cross-check
- 输出 Ghost / Orphan / Live 分类报告
- 禁止 disk-only-scan 单维风评作为处置决策依据


---

## 3. Session（automation-session.yaml）

见 `automation-session.schema.md`。**关键**：session 文件本身 target_class = automation_config，**Claude 不得 Edit/Write**；仅可输出字符串供用户 paste。文件存在 = 用户亲自 paste = 隐式授权。

---

## 4. 信任注册表（trust_registry）

### 4.1 `automation-trust.yaml`（提交进 repo）

每个 entry：tool_patterns / purpose / data_scope / write_capability / production_access / install_layer / use_layer / requires_local_binding / requires_session / approved_by / approved_at / notes。
**安装 = L3 paste-only**。Claude 只能输出 `claude mcp add ...` 字符串。

### 4.2 `automation-trust.local.yaml`（gitignored）

声明本机绑定。secret 必须通过 env var 名引用，不入文件值。

### 4.3 同一 server 的 read/write 分离

read 和 write 必须登记为不同 entry。未来若新增 write tool，单独 entry，不能 grandfather 到 read entry。

### 4.4 MCP Tool-Name Match Contract（Phase 0B parser 必须实现）

任何 MCP tool call 按顺序判定：
1. 收集 trust.yaml 全部 entry 的 tool_patterns
2. 当前 tool name 命中任一 entry → 取该 entry 的 use_layer / requires_local_binding / requires_session
3. 不命中任何 entry → **hard block**
4. entry tool_patterns: [] → 永远不命中 → 走 (3)
5. entry approved_at: null/PENDING → **hard block**

未匹配 MCP tool = 未注册 = 永不放行。

### 4.5 Parser 路径处理约定（Phase 0B 必须实现）

- `~` / `$HOME` 前缀：先扩展为 `$HOME` 绝对路径
- 相对路径：先 realpath 到绝对
- 仅 POSIX `/`；Windows path 不在 0 阶段范围
- `**` 跨目录递归；单 `*` 仅段内匹配

### 4.6 `production_access` enum

只允许：`forbidden` / `not_applicable` / `requires_explicit_flag` / `allowed_readonly`。
parser 校验 trust.yaml 拒绝其他值。

### 4.7 Activation Checklist（PENDING → Approved）

任何 approved_at: null 或 approved_by: PENDING entry 必须按序激活：
1. 安装动作（L3 paste-only）：terminal 跑 `claude mcp add ...`
2. 回填实际 tool 名称：`claude mcp list` → paste 到 tool_patterns
3. 本机绑定（若 requires_local_binding）：trust.local.yaml 加 binding，secret 仅 env var 名
4. 手动审计：data_scope / production_access 与实际匹配
5. 填 approved_by / approved_at（ISO 时间戳）
6. append `kind: trust-registry-activation` record 到 automation-log.jsonl

未完成 1–6 全部步骤前，该 entry 走 §4.4 (5) → hard block。

---

## 5. Sealed Artifact 政策

**SOT**：`sealed-registry.json`（编译产物）。判定（OR）：
1. 路径命中 rules.path_globs
2. `git hash-object <path>` 命中 frozen_blobs[].sha
3. 文件 root-level frontmatter 含 `status: sealed` 或 `frozen: true`

嵌套 `frozen: true`：仅 advisory。

**允许动作**：仅 read。任何 write 一律 block。**hard constraint**。Phase 0 不实现 unseal flow。

---

## 6. Break-Glass

**位置**：`~/.local/state/liye-automation/break-glass.jsonl`（不入 repo）

**约束**：
- TTL 默认 30 min，硬上限 2h
- scope.path_globs 必填；禁止 `["**"]` 或 `["**/*"]`
- sealed_unseal: true 永远拒绝
- 不能解锁 automation_config（hard constraint）
- `break-glass-check.sh` 独立于 parser

**降级路径**：parser 失败 + write → 调 break-glass-check.sh → 仍 fail → block。

---

## 7. Hook 失败语义

| 操作 | parser 失败行为 |
|---|---|
| read | fail-open + WARN |
| write to non-automation_config | fail-closed → 降级 break-glass-check → 仍 fail → block |
| write to automation_config | **永远 block**（hard） |

Parser timeout: 30s。

---

## 8. Observability

**位置**：`~/.local/state/liye-automation/automation-log.jsonl`（不入 repo）

**Schema**：`automation-log.schema.json`

**Redaction**：写入前对 `eyJ*` / `sk_*` / `pk_*` / `Bearer\s+\S+` / `*_TOKEN=\S+` / `*_KEY=\S+` 模式替换为 `<redacted:sha256_12=XXXX>`。

---

## 9. Claude Self-Modification Rule

**Claude 禁止 Edit/Write 路径**（hard）：
- ~/.claude/settings*.json
- <any-repo>/.claude/settings*.json
- ~/.claude/**/*.hooks.json
- <any-repo>/.claude/**/*.hooks.json
- ~/.claude/**/*.mcp.json
- <any-repo>/.claude/**/*.mcp.json
- ~/.claude/skills/**
- <any-repo>/.claude/skills/**
- ~/.claude/agents/**
- <any-repo>/.claude/agents/**
- ~/.claude/plugins/**
- <any-repo>/.claude/plugins/**
- ~/.claude/commands/**
- <any-repo>/.claude/commands/**
- liye_os/_meta/portfolio/PHASE-0B-SPEC.md
- **EXCLUDED（允许写）**：~/.claude/projects/*/memory/** — memory designer 路径是 Claude-system exception zone（agent auto-memory 写入既定语义；phase-0a-3 batch1/2/3 已实证使用此例外）
- liye_os/_meta/portfolio/AUTOMATION_GOVERNANCE.md
- liye_os/_meta/portfolio/target-classes.yaml
- liye_os/_meta/portfolio/automation-trust.yaml
- **/automation-trust.local.yaml
- **/.automation-session.yaml
- 任何 *.hooks.json, *.mcp.json

**允许**：生成 patch / yaml / json 文本供用户 paste。

---

## 10. Decision Order（hard-constraint-first；first match wins）

### Step 1 · Hard Constraints（永不可绕过）

任一命中 → BLOCK：
- write to automation_config（.claude/** 及登记 governance 文件）
- write to sealed_artifact
- call to MCP server 未在 trust.yaml 注册 (§4.4)
- call to MCP tool 不命中任何 tool_patterns (§4.4)
- call to MCP entry approved_at: null/PENDING (§4.4)
- 任何 L3 操作（非 paste 形式）
- session 文件 max_layer: L3
- write to `~/.local/state/liye-automation/**`（automation_audit_state target_class）；必须经 helper CLI（Phase 0C `liye-audit-append` 待建）。phase-0a-2 一次性 agent-direct append 是 user 明示授权下的例外，不构成 precedent。

### Step 2 · Active Break-Glass

break-glass-check.sh 返回 0：record 未过期 + 路径命中 scope + 不触发 Step 1 → ALLOW within scope。

### Step 3 · Active Automation-Session

automation-context.sh 返回 session_active=true + scope/branch/class 全部匹配 → 按 §2.1 + §2.2。

### Step 4 · Governance Default（无 session）

→ 按 §2.1 矩阵 "write (no session)" 列。

### Step 5 · Skill/Agent 默认行为

superpowers / GSD / claude-mem 等只能在 Step 1–4 允许范围内执行。

### 关于"用户直接指令"

**用户指令不是决策层级**。用户指令是触发动作的来源；动作是否被允许，由 Step 1–5 决定。
- 用户指令可在 governance 允许范围内选择动作
- 用户指令不能扩大权限边界
- 想突破 hard constraint：必须走 break-glass 流程（写本机 jsonl）；不接受 chat 授权
- 想突破 sealed：必须走单独 unseal flow（Phase 0 范围内不存在）

---

## 11. 豁免清单

- ~/.claude/projects/-Users-liye-github/memory/** — claude-mem user memory；非配置
- ~/.claude/projects/-Users-liye-github/2*/tool-results/** — Claude tool 输出
- ~/.claude/plugins/cache/** — plugin manager 写入路径

每条新增豁免需 paste-only 修改本文。

---

## 12. Phase 0 落地状态

- [x] Phase 0A-v2.2 — 静态资产 + cleanup
- [ ] Phase 0B — parser + sealed-registry + 15-fixture self-test
- [ ] Phase 0C — hooks + helper CLI + 重跑 fixture
- [ ] Phase 2 — context7 安装（首次走 §4.7 Activation Checklist 验证 L3 流程闭环）

未到 0C 之前，hook 未启用，governance 是文档态。

---

## 13. 版本

| Schema | Date | Change |
|---|---|---|
| 1 | 2026-05-19 | Initial 0A-v1 (rejected) |
| 2 | 2026-05-19 | 0A-v2: hard-constraint-first §10; transitional §0.1; trust read/write 拆分 §4.3 |
| 3 | 2026-05-19 | 0A-v2.1: §4.4 MCP tool_patterns hard-block; §4.5 path normalization; §2.2 main-branch tightened |
| 4 | 2026-05-19 | 0A-v2.2: §4.6 production_access enum; §4.7 Activation Checklist; §12 Phase 2 linked |

修改本文件：(1) 提升 schema_version；(2) Date 加新行；(3) Change 一句话；(4) paste-only。
