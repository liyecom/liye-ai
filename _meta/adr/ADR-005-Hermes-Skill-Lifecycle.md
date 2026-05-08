# ADR-005: Hermes Skill Lifecycle — candidate-first 技能生命周期

**Status**: Superseded
**Date**: 2026-04-14
**Superseded-Date**: 2026-04-17
**Superseded-By**: `_meta/adr/ADR-Hermes-Skill-Lifecycle.md`
**Decision Makers**: LiYe
**SSOT**: `_meta/adr/ADR-005-Hermes-Skill-Lifecycle.md`

> Historical draft. Superseded by `ADR-Hermes-Skill-Lifecycle.md` on 2026-04-17. Retained for audit/history only.

## Context

SYSTEMS.md 进化路线 P1 要求产出 4 份 Capability Harvest ADR（含 contract sketch）。
本 ADR 聚焦 **P3 (A1) — Governed Learning Loop candidate-only** 的设计决策：
从 Hermes Agent 的 skill 生命周期实现中吸收可复用的治理模式，
同时严守 quarantine-first 原则——**candidate 不是 skill，不得自动激活。**

Fork 纪律（SYSTEMS.md §参考与卫星项目）：hermes-agent 只做只读参考，
需要的能力通过本 ADR 决议后在 Loamwise 独立实现，不直接搬模块。

## 上游核心做法

Hermes Agent 的 skill 系统由三个核心文件和一个 Hub 库组成：

### 1. Skill 创建（skill_manager_tool.py）

**文件**: `/Users/liye/github/hermes-agent/tools/skill_manager_tool.py`

- Agent 可在运行时通过 `skill_manage(action="create")` 直接创建 skill
- 新 skill 写入 `~/.hermes/skills/` 目录，**立即可用**
- 支持 6 种 action: `create`, `edit`, `patch`, `delete`, `write_file`, `remove_file`
- 每个 skill 是一个目录，包含 `SKILL.md`（YAML frontmatter + Markdown body）和可选的 `references/`, `templates/`, `scripts/`, `assets/` 子目录
- 创建后立即触发安全扫描；若扫描 blocked，回滚删除整个 skill 目录
- **关键特征：创建即激活，没有 review/quarantine 中间态**

### 2. 安全扫描（skills_guard.py）

**文件**: `/Users/liye/github/hermes-agent/tools/skills_guard.py`

- 基于正则的静态分析：~80 条 threat patterns，覆盖 exfiltration、injection、destructive、persistence、obfuscation、privilege escalation、supply chain 等类别
- 结构检查：文件数上限 50、总大小 1MB、单文件 256KB、二进制文件检测、symlink 逃逸检测
- 不可见 Unicode 字符检测（零宽空格、方向覆盖等注入手段）
- Trust levels:
  - `builtin`: 随 Hermes 发布，不扫描
  - `trusted`: openai/skills + anthropics/skills，caution 允许通过
  - `community`: 任何 finding = blocked（除非 `--force`）
  - `agent-created`: safe/caution 允许，dangerous 需用户确认（`ask`）
- 三级 verdict: `safe` → `caution` → `dangerous`
- Install policy 矩阵决定 `allow` / `ask` / `block`

### 3. Skill 使用与发现（skills_tool.py）

**文件**: `/Users/liye/github/hermes-agent/tools/skills_tool.py`

- Progressive disclosure 3 层架构：
  - Tier 0: `skills_categories()` — 分类浏览
  - Tier 1: `skills_list()` — name + description（低 token）
  - Tier 2/3: `skill_view(name)` — 加载完整内容
- Platform 过滤（`platforms` frontmatter 字段）
- 支持 disabled skill 管理
- 运行时注入检测（加载时再检一遍 prompt injection patterns）

### 4. Hub 安装流水线（skills_hub.py）

**文件**: `/Users/liye/github/hermes-agent/tools/skills_hub.py`

- 外部 skill 有 quarantine 流程：download → `quarantine_bundle()` → `scan_skill()` → `install_from_quarantine()`
- quarantine 目录: `~/.hermes/skills/.hub/quarantine/`
- 安装后记录 provenance: `lock.json`（source, trust_level, scan_verdict, content_hash）
- 审计日志: `audit.log`（时间戳 + action + verdict）
- **但 agent-created skill 绕过 quarantine，直接写入 skills 目录**

### Hermes 生命周期总结

```
外部 skill (Hub):  download → quarantine → scan → install → 可用
Agent-created:     create → scan → 可用（无 quarantine）
使用:              skills_list → skill_view → agent 消费
修改:              edit / patch → re-scan
删除:              delete → rmtree
```

## 吸收项

| # | Hermes Pattern | 吸收理由 |
|---|---------------|---------|
| A1 | **安全扫描三级 verdict** (`safe` / `caution` / `dangerous`) | 简洁有效的分级机制，直接映射到 review 优先级 |
| A2 | **Trust level 矩阵决定 install policy** | 信任源 × 扫描结果的矩阵决策比单维判断更精确 |
| A3 | **SKILL.md frontmatter 元数据** | name/description/version/platforms 结构已被验证，可作为 candidate metadata 基础 |
| A4 | **Quarantine 目录隔离**（Hub 流程） | 外部 skill 进 quarantine 再安装的思路正确，我们将其推广到**所有来源** |
| A5 | **Provenance 记录** (lock.json + audit.log) | source + trust_level + scan_verdict + content_hash 完整追溯链 |
| A6 | **Progressive disclosure 加载** | 按需加载降低 token 消耗，复用其分层思路 |
| A7 | **原子写入 + 扫描失败回滚** | `_atomic_write_text()` + 扫描 blocked 则 rollback，保证一致性 |

## 不吸收项

| # | Hermes Pattern | 不吸收理由 |
|---|---------------|-----------|
| R1 | **Agent-created skill 无 quarantine** | Hermes 允许 agent 创建后直接可用。我们要求**所有来源（含 agent）的 candidate 必须经过 quarantine + human review** |
| R2 | **Auto skill repair** | SYSTEMS.md 明确排除：不引入 auto skill repair |
| R3 | **Smart routing** | SYSTEMS.md 明确排除：不引入 smart routing |
| R4 | **Honcho 用户建模** | SYSTEMS.md 明确排除：不引入重用户建模 |
| R5 | **扫描通过即信任** | Hermes 的 `safe` verdict 直接 allow。我们要求 `safe` 仍需 human review 才能 promote |
| R6 | **`--force` 覆盖 blocked** | Hermes 允许用户 force install。我们不提供绕过 quarantine 的快捷方式 |
| R7 | **Skill 即时可编辑/可删** | Hermes agent 可随时 edit/patch/delete 任何 skill。我们只允许对 candidate 进行 edit，production skill 变更需要走 change review |

## 与 LiYe Systems 分层关系

```
Layer 0: LiYe OS (制度底座)
  ├── 定义 skill candidate 的 metadata schema (本 ADR Contract Sketch)
  ├── 定义 review_status / trust_level 枚举
  └── 定义 promotion 合约（晋升守卫条件）

Layer 1: Loamwise (编排中间层)   ← skill lifecycle runtime 在这里
  ├── loamwise/construct/candidates/  — candidate 提交、review queue
  ├── loamwise/govern/               — 安全扫描 guard chain
  └── loamwise/construct/            — quarantine → promotion 状态机

Layer 2: Domain Engines (专业执行器)
  └── 产出 skill candidate 的 raw material（例如 AGE 发现的广告优化模式）

Layer 3: Product Lines
  └── 不涉及 skill lifecycle
```

**关键边界：Skill lifecycle runtime 属于 `/Users/liye/github/loamwise/`，不属于 `/Users/liye/github/liye_os/`。**
LiYe OS 只定义 schema 和合约，Loamwise 执行生命周期管理。
这与 SYSTEMS.md 的依赖方向一致：`liye_os → loamwise`（合约定义 → 中间层执行）。

## Decision

**Core decision: candidate-only, quarantine-first.**

1. **所有 skill candidate 无论来源（agent-generated、domain engine 产出、手动创建）一律进入 quarantine，不直接激活。** 这是与 Hermes 最大的分歧点。
2. Candidate 不是 skill。Candidate 是一个带有完整溯源信息的提案，必须经过 review 才能晋升为可执行 skill。
3. Review 过程要求 human reviewer 明确标记 `ACCEPTED`，系统才执行 materialize。
4. 晋升路径沿用 ADR-001 的分区思路：`quarantine/ → candidate/ → production/`。
5. 安全扫描机制吸收 Hermes 的 verdict 分级（A1），但扫描通过不等于信任（R5）。
6. Provenance 全链路追溯：每个 candidate 必须携带 `source_trace_id`、`generated_by`、`risk_class`。

## Contract Sketch

### 1. SkillCandidate Metadata

```typescript
/**
 * Skill Candidate 元数据 — LiYe OS 合约定义
 * Runtime implementation: loamwise/construct/candidates/
 *
 * 每个 candidate 必须包含以下字段，无论来源。
 */
interface SkillCandidateMetadata {
  // === 身份 ===
  candidate_id: string;           // UUID v4, 全局唯一
  name: string;                   // 技能名称, lowercase, [a-z0-9._-], max 64 chars
  description: string;            // 技能描述, max 1024 chars
  version: string;                // SemVer, e.g. "0.1.0"

  // === 溯源 (Provenance) ===
  source_trace_id: string;        // 产生此 candidate 的 trace ID（关联到具体执行记录）
  source_domain: string;          // 来源领域, e.g. "amazon-advertising", "domain-analysis"
  generated_by: string;           // 生成者标识, e.g. "agent:claude-opus-4", "human:liye", "engine:age"
  generated_at: string;           // ISO 8601 时间戳

  // === 安全与信任 ===
  risk_class: "low" | "medium" | "high" | "critical";
  trust_level: "untrusted" | "scanned" | "reviewed" | "trusted";
  scan_verdict: "pending" | "safe" | "caution" | "dangerous";
  scan_findings_count: number;    // 扫描发现的问题数

  // === 生命周期 ===
  review_status: ReviewStatus;
  reviewer: string | null;        // human reviewer ID
  reviewed_at: string | null;     // ISO 8601
  expires_at: string;             // ISO 8601, candidate 过期时间（默认 30 天）

  // === 内容摘要 ===
  content_hash: string;           // sha256:<hex>, 内容完整性校验
  content_size_bytes: number;
  file_count: number;

  // === 作用域 ===
  target_domain: string;          // 目标 domain engine
  scope: Record<string, string>;  // 作用范围键值对
}
```

### 2. ReviewStatus 枚举与状态机

```typescript
/**
 * Review status 枚举
 * 对齐 loamwise/construct/__init__.py 的 ReviewState
 */
type ReviewStatus =
  | "QUARANTINED"      // 初始态：已提交，待扫描
  | "SCANNED"          // 已通过安全扫描，待 human review
  | "UNDER_REVIEW"     // Human reviewer 已认领
  | "ACCEPTED"         // 通过 review，可 promote
  | "REJECTED"         // 被拒绝，附 reason
  | "EXPIRED"          // 超过 expires_at 未 review，自动归档
  | "PROMOTED"         // 已晋升为 production skill
  | "REVOKED";         // 已晋升后被撤回
```

### 3. 状态转换与守卫

```
                          ┌─────────────────────────────────┐
                          │                                 │
  [any source] ──submit──▶│  QUARANTINED                    │
                          │  guard: must have source_trace_id, │
                          │         generated_by, expires_at │
                          └──────────┬──────────────────────┘
                                     │
                             scan_skill()
                                     │
                          ┌──────────▼──────────────────────┐
                          │  SCANNED                        │
                          │  guard: scan_verdict != "dangerous" │
                          │  (dangerous → auto REJECTED)    │
                          └──────────┬──────────────────────┘
                                     │
                           human claims review
                                     │
                          ┌──────────▼──────────────────────┐
                          │  UNDER_REVIEW                   │
                          │  guard: reviewer != null        │
                          └───┬──────────────────┬──────────┘
                              │                  │
                         accept()           reject(reason)
                              │                  │
                  ┌───────────▼───┐    ┌─────────▼─────────┐
                  │  ACCEPTED     │    │  REJECTED          │
                  │  guard:       │    │  requires: reason  │
                  │   reviewer != │    └────────────────────┘
                  │   generated_by│
                  └───────┬───────┘
                          │
                   promote() (manual trigger)
                          │
                  ┌───────▼───────────────────────┐
                  │  PROMOTED                      │
                  │  guard: content_hash unchanged │
                  │  guard: risk_class <= "medium"  │
                  │  (high/critical 需要额外审批)   │
                  └───────┬───────────────────────┘
                          │
                    revoke(reason) (if drift/issue detected)
                          │
                  ┌───────▼───────┐
                  │  REVOKED      │
                  └───────────────┘

  ─── 超时守卫 ───
  QUARANTINED/SCANNED/UNDER_REVIEW:
    if now > expires_at → auto transition to EXPIRED
```

### 4. 状态转换守卫汇总

| Transition | Guard Conditions |
|-----------|-----------------|
| `→ QUARANTINED` | `source_trace_id` 非空; `generated_by` 非空; `expires_at` 在 1-90 天内; `content_hash` 已计算 |
| `QUARANTINED → SCANNED` | 安全扫描完成; `scan_verdict` in (`safe`, `caution`); findings 已记录 |
| `QUARANTINED → REJECTED` | `scan_verdict` == `dangerous`; auto-reject, reason = scan report |
| `SCANNED → UNDER_REVIEW` | `reviewer` 已赋值; reviewer != `generated_by`（不可自审） |
| `UNDER_REVIEW → ACCEPTED` | Human reviewer 明确批准; reviewer 签名记录 |
| `UNDER_REVIEW → REJECTED` | Human reviewer 提供 `reason`; reason 非空 |
| `ACCEPTED → PROMOTED` | `content_hash` 未变（防止 promote 前被篡改）; `risk_class` <= `medium`（high/critical 需二级审批） |
| `PROMOTED → REVOKED` | 提供 `revoke_reason`; 自动从 production 移回 quarantine |
| `* → EXPIRED` | `now > expires_at`; 定时任务检查; 不可从 PROMOTED/REVOKED 过期 |

### 5. 目录布局（Loamwise 侧）

```
loamwise/construct/candidates/
├── quarantine/          # QUARANTINED + SCANNED 状态的 candidate
│   └── <candidate_id>/
│       ├── metadata.yaml
│       └── content/
│           ├── SKILL.md
│           └── references/
├── accepted/            # ACCEPTED 状态，待 promote
│   └── <candidate_id>/
├── promoted/            # PROMOTED — 已激活为 production skill
│   └── <candidate_id>/
└── rejected/            # REJECTED + EXPIRED 的归档
    └── <candidate_id>/
```

## 非目标

本 ADR **不决定**以下内容：

1. **具体扫描规则**：threat pattern 清单由 P2 (B1 Content Threat Detection) 决定，不在本 ADR 范围
2. **Skill 的运行时加载机制**：progressive disclosure 的具体实现属于 Loamwise runtime
3. **Domain Engine 如何产出 candidate**：各 engine 的 candidate 产出协议由各自的 ADR 决定
4. **自动化测试**：candidate 的 automated testing framework 是后续工作
5. **P2 / P4 / P5 的实现**：本 ADR 仅覆盖 P3 (A1)，不展开其他阶段

## 后续实现入口

**P3 (A1) — Governed Learning Loop candidate-only**

实现位置: `/Users/liye/github/loamwise/construct/`

现有基础:
- `loamwise/construct/__init__.py` 已定义 `ReviewState` 枚举（SUGGESTED / REVIEWED / ACCEPTED / REJECTED）
- `loamwise/construct/candidates/review_queue.py` 已实现 `ReviewQueue`（submit → review → accept/reject → materialize）

待实现（本 ADR 不实现，仅标记入口）:
- [ ] 扩展 `ReviewState` 为本 ADR 定义的 `ReviewStatus`（增加 QUARANTINED, SCANNED, UNDER_REVIEW, PROMOTED, REVOKED, EXPIRED）
- [ ] 实现 `SkillCandidateMetadata` schema 验证
- [ ] 实现 quarantine 目录管理
- [ ] 实现 scan → review → promote 状态机守卫
- [ ] 实现 expires_at 超时自动归档
- [ ] 实现 content_hash 完整性校验
- [ ] 连接 liye_os 合约（`_meta/contracts/` 中发布 schema）

---

**Version**: 1.0.0
**Last Updated**: 2026-04-14
