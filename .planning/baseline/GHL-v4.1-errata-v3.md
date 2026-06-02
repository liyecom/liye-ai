# GHL v4.1 Errata v3 — Third Overlay (Post-Accept · Pilot-1 Clock Correction)

**Status**: POST-ADR-ACCEPT FACTUAL ERRATA — **no decision change · no cooling reopen · no runtime touch**
**Base**: `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` (frozen)
**Prior overlays**: `GHL-v4.1-errata.md` (errata-v1) · `GHL-v4.1-errata-v2.md` (errata-v2) — **both immutable, 0 回改**
**Corrects**: `_meta/adr/ADR-Governed-Heuristic-Learning.md` L86 (derived-value arithmetic slip) + cross-source anchor ambiguity surfaced during Phase-4 SPEC drafting (PR #162, SPEC blob `a3ea7a8`)
**Source**: Phase-4 SPEC red-team `wf_b30ecd36` finding SA1-ADR-CONTRADICTION (ground-truthed ADR L86 verbatim) + orchestrator adjudication
**Decision**: ADR body / baseline / errata-v1 / errata-v2 正文**不回改**；本 errata 作为第三层只读修订叠加层进入 ADR normative inputs（per EV2-N-01 链，本文件 = N-4，冲突时最晚 normative input 为准）

---

## 0. Status & Discipline Boundary

- ADR status: **Accepted (2026-05-19)**; cooling 已过。**本 errata 不重开 ADR 决策、不重置 cooling** —— 它只更正一个派生算术值 + 澄清跨源锚语义。errata-class（更正记录，不改决策）。
- 本 overlay 是对 ADR body + baseline + errata-v1/v2 的 **read-only patch**，**不编辑任何已 frozen/Accepted 正文**（沿用 EV2-I-02 更正 frozen 路径的范式：错误在叠加层更正，源文件不动）。
- 范围严格限于 **Pilot-1 ≥90 天时钟**这一点；不触其他 ADR 条款、不触任何 schema/runtime。

## 1. Scope and Discipline

**允许**：
- 在本文件内沉淀 2 项更正（EV3-C-01 算术 slip / EV3-X-01 跨源锚澄清）
- 引用 ADR / baseline / errata-v2 / Phase-4 SPEC 的具体行号/blob

**禁止（user-mandated，见 §5 显式列死）**：
- 不把 ADR 改成 commit-merge (2026-05-28) anchor
- 不把「撤回 commit-anchor 误引」写进 ADR body（那是 Phase-4 SPEC 起草/裁决期的 orchestrator 误引，不是 ADR 本体错误；已在 SPEC SA-1 内收回）
- 不重开 cooling、不做大红队
- 不回改 ADR / baseline / errata-v1 / errata-v2 / readiness / ADR-intake 正文
- 不触 AGE / liye_os / loamwise 任何 runtime 代码或 schema

## 2. Correction Summary

| ID | Type | 决议 |
|---|---|---|
| EV3-C-01 | Correction (arithmetic) | ADR L86 派生值 `≥ 2026-08-09` 是算术 slip；`2026-05-09 + 90d = 2026-08-07`。Pilot-1 ≥90 天时钟正确下界 = **2026-08-07**（锚 2026-05-09 不变）|
| EV3-X-01 | Clarification (cross-source) | plan §6 #11「v4.1-final 落盘」在 ADR clock 语义下交叉引用为 **baseline 2026-05-09**（**非** merge commit 2026-05-28，**非** commit-anchor doctrine）；Phase-4 SPEC 的 **2026-08-26** 是**更严 operator floor**（dominance over 落盘语义之争），**非** ADR 原义、**非**派生值 |

## 3. EV3-C-01 — ADR L86 派生算术 slip

### 3.1 事实（ground-truth）

ADR `_meta/adr/ADR-Governed-Heuristic-Learning.md` **L86** 逐字：

> - **Pilot 1 = negative learning only**（time-bounded ≥ 90 天 from baseline 2026-05-09，即 ≥ 2026-08-09）

锚 = `2026-05-09`（content baseline）。派生下界写作 `≥ 2026-08-09`。

### 3.2 更正

`2026-05-09 + 90 天 = 2026-08-07`（May 9 +90d：May 余 22d → Jun 30d → Jul 31d → +7d = Aug 7）。
ADR 写的 `2026-08-09` 多算 2 天（= 92 天），是**派生算术 slip**。

**正确下界 = `2026-08-07`。锚日期 `2026-05-09` 本身正确、不变。**

### 3.3 生效方式（不编辑 frozen ADR body）

- ADR L86 正文保持 frozen（Accepted ADR 不就地改）。
- 本 errata = 该派生值的 authoritative 更正；任何读 Pilot-1 ≥90 天时钟下界者**以 `2026-08-07` 为准**。
- per EV2-N-01 normative-input 链：本 errata-v3 = **N-4**，「冲突时最晚 normative input 为准」→ `2026-08-07` supersede ADR body 的 `2026-08-09`（仅此一点）。
- 同范式先例：EV2-I-02 在叠加层更正 errata-v1 的 frozen 路径错误，不改 errata-v1 正文。

## 4. EV3-X-01 — plan #11「落盘」跨源锚澄清 + SPEC 08-26 floor 定性

### 4.1 跨源歧义（Phase-4 SPEC 起草时浮现）

| 源 | 文本 | 锚语义 |
|---|---|---|
| ADR L86 | 「from baseline **2026-05-09**」 | content baseline（明确）|
| plan §6 #11 | 「自 v4.1-final **落盘**起 ≥ 90 天」 | 「落盘」可被误读为 merge 持久化（→ 2026-05-28）|

「落盘」措辞与 ADR 的 `2026-05-09` content-baseline 锚存在解读张力。

### 4.2 澄清裁定

- **plan #11「v4.1-final 落盘」在 ADR clock 语义下 = baseline `2026-05-09`**（与 ADR L86 锚一致）。
- **明确不是** merge commit `2026-05-28`（PR #138）。
- **明确不是** commit-anchor doctrine 的适用对象 —— commit-anchor doctrine 治理的是**合约 blob 锚定**，**不**治理 Pilot-1 复审时钟。（Phase-4 SPEC 起草期 orchestrator 曾误把此 doctrine 套到 Pilot-1 时钟上，已在 Phase-4 SPEC SA-1 内收回；此误引**不**进 ADR body。）

### 4.3 Phase-4 SPEC `2026-08-26` floor 定性

Phase-4 SPEC（`.planning/phase-4/SPEC.md`，blob `a3ea7a8`，SA-1）将前置 #11 的 operator floor 设为 **`2026-08-26`**。本 errata 定性：

- `2026-08-26` 是 **Phase-4 SPEC 选取的更严 operator floor**，**非** ADR 原义、**非**派生值。
- 取值依据 = **dominance over 落盘语义之争**：`2026-08-26 ≥ {08-07 (修正派生), 08-09 (ADR 字面), 08-26 (落盘=merge 读法)}` → 无论锚之争如何裁，08-26 floor 一律满足，对不可逆 production-unlock 稳健。
- 与 ADR **不冲突**：ADR 设的是「**≥** 90 天」下界；`2026-08-26`（距 05-09 = 109 天）满足且超过该下界 → **ADR-compliant-with-margin，非 override**。
- production-unlock 实际门槛仍叠加 operator 背书 + activation + 30d γ 非-unavailable 真值（Phase-4 SPEC §3）；date floor 只是必要条件之一。

## 5. Explicit Non-Changes（user-mandated，列死防漂移）

本 errata **明确不做**以下事，未来读者勿据本文件推断：

1. **不**把 ADR Pilot-1 锚改成 `2026-05-28` / commit-merge / commit-anchor doctrine。锚仍是 content baseline `2026-05-09`。
2. **不**把「撤回 commit-anchor 误引」写进 ADR body —— 那是 Phase-4 SPEC 起草/裁决期的 orchestrator 错误，**不是** ADR 本体错误；已在 Phase-4 SPEC SA-1 收回，与 ADR 无关。
3. **不**重开 ADR cooling、**不**重启 ADR Accept 流程、**不**做大红队。
4. **不**回改 ADR / baseline / errata-v1 / errata-v2 任何 frozen 正文。
5. **不**改 Phase-4 SPEC 的 `2026-08-26` floor（本 errata 只**定性**其为 stricter-operator-floor，不动其值）。

## 6. Discipline Preserved

- [x] ADR body 正文未回改（L86 frozen 保留 `2026-08-09`，更正在本叠加层）
- [x] baseline / errata-v1 / errata-v2 正文未回改
- [x] Phase-4 SPEC blob `a3ea7a8` 未动
- [x] 0 schema / 0 runtime / 0 validate-contracts 影响（doc-only；gate 仍 20）
- [x] AGE / loamwise 0 tracked diff
- [x] cooling 未重开；ADR 仍 Accepted (2026-05-19)
- [x] 范围严格限于 Pilot-1 ≥90 天时钟两点更正

## 7. Next Step

1. **本文件已写** — `liye_os/.planning/baseline/GHL-v4.1-errata-v3.md`
2. **只读验收**：文件存在 + 覆盖 2 项 + ADR/baseline/errata-v1/v2 正文 mtime 未动 + validate-contracts 仍 20 + AGE/loamwise 无 tracked diff
3. **doc-only PR**；operator UI merge（不自 merge）
4. merge 后更新 memory：指向 errata-v3 + 记 post-squash commit/blob

---

**Authored**: 2026-06-02
**Audit chain**: Phase-4 SPEC red-team `wf_b30ecd36` (SA1-ADR-CONTRADICTION ground-truthed ADR L86) → orchestrator adjudication (commit-anchor 误引收回) → errata-v3 (factual correction, post-Accept)
**Status**: errata-v3 落盘；ADR Pilot-1 ≥90 天时钟下界 = **2026-08-07**（锚 2026-05-09）；Phase-4 operator floor = **2026-08-26**（stricter, dominance）
