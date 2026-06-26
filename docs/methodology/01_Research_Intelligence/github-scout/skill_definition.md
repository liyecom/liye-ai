# 🔭 GitHub Prior-Art Scout Skill

**Version**: 1.0
**Created**: 2026-06-26
**Last Updated**: 2026-06-26
**Status**: Active (Phase 0)
**Layer**: L1 Methodology (Brain) · consumed by `tools/github-scout/` (Hands) + `.claude/skills/github-scout.md` (L3)

---

## 🔹01. Skill Identity（技能身份）

**Skill Name**: GitHub Prior-Art Scout / GitHub 先验技术侦察

**Core Mission**:
在动手构建一个新能力之前，对 GitHub 上的既有开源实现做**只读、合规、可审计**的侦察，
把"是否已有人实现过这个想法、能否复用、以何种纪律复用"这个判断，从凭感觉拍脑袋
变成一条 fail-closed 的、有许可证门禁的、把结论交还给人的流程。

**Capability Domain**: Research Intelligence（先验技术 / 竞品 / 开源生态侦察）

**What it is NOT**: 它**不做决定**。它产出一份 advisory 报告。任何复用结论都要走
harvest-ADR / Reference Declaration 仪式（SYSTEMS.md Fork 纪律）。它也不是 runtime
依赖、不 fork、不 clone、不 vendor、不开 PR。

**Target Scenarios**:
- 新能力立项前的"是否重复造轮子"检查
- 评估某个想法的开源成熟度与许可证可复用性
- 为 harvest-ADR / Reference Declaration 准备候选清单

---

## 🔹02. Capability Model（能力模型）

| 维度 | 内容 |
|------|------|
| **输入** | 一句话想法（idea sentence） |
| **派生** | 词法抽取检索词（去停用词，取最强 3 个；GitHub search 默认 AND） |
| **搜索** | 一次只读 repo 搜索（按 stars 排序，cap N） |
| **侦察** | 对每个候选按 §03 的**许可证门状态机**做分级 inspect |
| **打分** | 仅用词法/元数据信号的相关性（M-4：禁止呈现唯一信号是描述子串匹配的候选） |
| **输出** | 每候选一个 4 叶建议 + 强制 `recall_notice` + `hard_non_goals` |

**核心原则**：召回优先、精度其次（先把候选找全，再用许可证门 + 人审过滤）；
对**许可证**与**写权限**绝对保守（fail-closed）。

---

## 🔹03. The License-Gated Inspect Method（核心方法：许可证门状态机）

这是本技能的方法论内核，也是 clean-room 纪律的真实闸门。

> **SSOT**：`license tier → inspect 上限 → 允许建议` 的权威映射定义在本目录的
> [`license_policy.yaml`](./license_policy.yaml)。本文是**关于**它的散文；
> `tools/github-scout/scout.py` **运行时加载**它、绝不复刻。两者漂移即测试失败。

**严格时序（不可乱序）**：

1. 只取 **metadata + 权威许可证**（`/repos/{repo}/license` 的 SPDX，不是搜索结果里的 hint）。
2. **评 tier**（按 `license_policy.yaml`）。
3. **仅当** tier 的 inspect 上限允许，才取 README / tree 形状；否则**立即停**。

**Fail-closed**：无 LICENSE 文件（404）⇒ `confidence = no_license`；任何其它取用失败
（5xx / NOASSERTION / "other" / timeout）⇒ `confidence = fetch_failed`；**两者都** ⇒
`tier = unknown` ⇒ 仅 metadata。**绝不**在许可证未决时读源码。

**许可证档 × inspect 上限**（权威在 `license_policy.yaml`；下表为非权威示例）：

| 许可证档 | inspect 上限 | 默认建议 |
|---|---|---|
| permissive（MIT/BSD/ISC…） | metadata + LICENSE + README + tree 形状 | needs-human-review |
| permissive + obligations（Apache-2.0） | 同上 + 标 NOTICE / 专利义务 | needs-human-review |
| weak copyleft（MPL/LGPL…） | 同上 + 标隔离风险 | needs-human-review（sub: license-isolation） |
| strong copyleft（GPL/AGPL/SSPL） | **metadata + LICENSE only** | skip（唯一非 skip 路径 = clean-room 重写） |
| unknown / fetch_failed | **metadata only** | skip |

---

## 🔹04. Recommendation Taxonomy（建议分类，4 叶）

`reference-only` / `reimplement` / `needs-human-review` / `skip`。

- **砍掉** `fork` / `vendor-as-kit` 叶（满足 Fork 纪律）；vendor 候选性只作为
  `needs-human-review` 的 **sub_reason** 存活：
  `vendor-as-kit-candidate | behavior-fit-unclear | license-isolation | transitive-unscanned`。
- **保守默认**：在允许 `needs-human-review` 的档，默认就给 `needs-human-review`
  ——因为**语义能力契合不可机器判定**，必须交还给人；scout 永不自动得出"去复用"。
- 每个候选都带 `caveats`（至少 `transitive-unscanned`，因为 Phase 0 不扫传递依赖）。

---

## 🔹05. What Claude Must Be Able to Do（能力边界 / 诚实表达）

- 明确区分"许可证允许" vs "行为契合" vs "值得复用"——前者机器可判，后两者交人。
- 对空/弱召回**大声报**（派生词 < 2、零候选都要在 `notices` 里显式说）。
- 永远复述 `recall_notice`：这是 advisory，不是决定。
- 知识边界：Phase 0 不扫传递许可证、不做供应链信任评估、未认证时有 rate 限。

---

## 🔹06. Governance Integration（治理接线）

- **Fork 纪律（SYSTEMS.md）**：任何复用结论 → harvest-ADR / Reference Declaration
  仪式；`reference-only` = 只读 reference satellite，不是 runtime 依赖。
- **Clean-room**：strong copyleft 只允许从**公开文档**重写（源码不被 fetch，I3 保证）。
- **Reference Declaration（BGHS-ADR §4）**：scout 的 `reference-only` 输出可直接喂给
  `artifact_scope: reference`（`source_kind: fork|concept`）声明。

---

## 🔹07. Relationship to Hands & L3（与执行层的关系）

| 层 | 件 | 职责 |
|---|---|---|
| **L1（本档）** | `skill_definition.md` + `license_policy.yaml` + `methods.md` | 方法论 SSOT |
| **Hands** | `tools/github-scout/scout.py` + `declaration.yaml` | 执行；运行时加载本层 |
| **L3** | `.claude/skills/github-scout.md` | 约束 Claude 何时/如何调用，只引用本层 |

权威自上而下：方法论只在 L1 定义；Hands 与 L3 只加载/引用，绝不各自重定义
（SKILL_CONSTITUTION §3）。
