# Sprint 7 Shadow 观测规格

**Owner**: LiYe
**Status**: Observation-window open
**ADR references**:
- `_meta/adr/ADR-Loamwise-Guard-Content-Security.md` (P1-d, Guard 升级口径)
- `_meta/adr/ADR-Hermes-Skill-Lifecycle.md` (P1-b, skill candidate submit 被保护路径)
- `_meta/adr/ADR-Hermes-Memory-Orchestration.md` (P1-c, memory write + assembly ingest 被保护路径)
- `_meta/adr/ADR-Architecture-Doctrine-BGHS-Separation.md`（Layer 0 / Layer 1 分工总则）

**Cross-repo references**（双向可追溯）:
- 执行侧 runbook：`loamwise/docs/P2-O-observation-runbook.md`
- 执行侧 SQL：`loamwise/docs/P2-O-observation-sql.md`
- 执行侧 memo / log：`loamwise/docs/P2-O-observation-memo.md` · `loamwise/docs/P2-O-observation-log.md`
- 执行侧 per-guard memo：`loamwise/docs/P2-A-shadow-observation-memo.md` · `P2-B-*` · `P2-C-*`
- 执行侧 scanner 实现：`loamwise/govern/guards/content_scan_guard.py` · `truth_write_guard.py` · `context_inject_guard.py`
- 执行侧 audit 后端：`loamwise/audit/backends/duckdb.py` → `loamwise/data/loamwise.duckdb`

---

## 0. Positioning / Layer Ownership（**最高优先级**）

**本文件是 Layer 0 contract authority，不是 operational readout authority。**

| 面向 | 归属 | 仓库 | 角色 |
|---|---|---|---|
| Shadow 观测的契约口径、边界语义、证据结构、评审前提 | Layer 0 contract | **liye_os**（本仓库） | **contract authority** |
| 真实 scanner 执行、pattern 命中统计、AuditRecord 写入、运行期 observation readout | Layer 1 execution | **loamwise** | **execution / readout authority** |

**不可混用的口径**：

- 本规格定义 Shadow Observation 的 Layer 0 契约口径、边界语义与证据结构。
- 真实扫描执行、pattern 命中统计、审计记录写入以及运行期 observation readout 由 loamwise 的 `docs/P2-O-observation-runbook.md` 与相关 observation artifacts 产出。
- 因此，本文件是 **contract authority**，不是 operational readout authority。

**2026-04-24 shadow → advisory 评审的单一口径**：

> 真实观测数据以 **loamwise** 产出为准；契约合法性、字段语义与边界解释以 **liye_os** 定义为准。

**与 liye_os Sprint 1–7 的关系**：

- liye_os Sprint 1–7 完成的是 **Layer 0 契约与 seam**（`src/runtime/governance/*`：session / wake / capability / guard 骨架 + 夹具 scanner / skill_lifecycle / memory + guard 接线），**不等于 P2 实施本体**。
- **P2 的真实实现与观测主体在 loamwise**（`govern/guards/*.py` + `P2-*` docs）。
- liye_os 的 `guard/shadow_runner.ts` + `NoopScanner` / `AlwaysDangerousScanner` 是 **契约骨架 + 测试夹具**，不产出真实 pattern 命中；运行期的扫描命中全部在 loamwise。

---

## 本规格的定位

Sprint 7 不是"实现新功能"，而是**数据驱动的 Guard 升级评审**。
本规格定义 Sprint 7 阶段 A（观测）与阶段 B（评审）的必备证据与硬门槛。
**没有证据，不升。没有完整 evidence 链，不升。没有 false positive 分析，不升。**

规格页本身是 **append-only 的观测协议**：窗口期内若需修改任何门槛，必须先追加 `Revision-*` 节（不改写已有门槛），并在 commit message 中写明 why。

---

## 1. 观测窗口

| 项 | 值 |
|---|---|
| 窗口起点 | **2026-04-17 00:00 UTC**（Sprint 6 封板日） |
| 最短连续窗口 | **7 日连续数据** |
| 窗口终点（最早） | **2026-04-24 00:00 UTC** |
| 数据断口处理 | 任何 `scanner_failed=true` 以外的证据丢失（sink 丢条 / trace_id 缺失 / append 失败）视为**断口**，窗口**重置**从下一个完整 24h 重新计数 |
| 窗口冻结 | 阶段 B 评审开始前一刻，窗口**显式冻结**（记录 `frozen_at`），之后产生的证据不进入该轮评审 |

窗口可延长。延长不需要 ADR；缩短或跳过需要。

---

## 2. 覆盖的被保护路径

阶段 A 观测三条已接线路径，**仅这三条**：

| 路径 | ProtectedPathKind | GuardKind | 代码入口 |
|---|---|---|---|
| skill candidate submit | `skill.candidate-submit` | `content-scan` | `src/runtime/governance/skill_lifecycle/candidate_submit.ts` → `guardedSubmitCandidate` |
| memory write (non-auth) | `memory.write.non-authoritative` | `content-scan` | `src/runtime/governance/memory/guard_wire.ts` → `guardedMemoryWrite` (tier ≠ AUTHORITATIVE) |
| memory write (authoritative) | `memory.write.authoritative` | `truth-write` | `src/runtime/governance/memory/guard_wire.ts` → `guardedMemoryWrite` (tier = AUTHORITATIVE) |
| assembly fragment ingest | `assembly.fragment-ingest` | `context-inject` | `src/runtime/governance/memory/guard_wire.ts` → `guardedAssemblyFragmentIngest` |

skill promotion、capability registration、retrieval、query orchestration、provider sync — **不在本轮观测范围**。它们还没接线，不能观测。

---

## 3. 统计口径（每路径 × 每窗口日）

每条路径在窗口内按 UTC 日聚合，报告以下字段。字段从 `GuardEvidence` 实体直接派生，不做主观判断。

| 字段 | 定义 | 数据来源 |
|---|---|---|
| `observations` | 该路径当日 `runner.run()` 调用次数 | `GuardEvidenceSink.list()` 过滤 `guard_kind` + `scanned_path.path_kind` |
| `verdict_safe` | 当日 `verdict === 'safe'` 次数 | evidence.verdict |
| `verdict_caution` | 当日 `verdict === 'caution'` 次数 | evidence.verdict |
| `verdict_dangerous` | 当日 `verdict === 'dangerous'` 次数 | evidence.verdict |
| `scanner_failures` | 当日 `scanner_failed === true` 次数 | evidence.scanner_failed |
| `missing_trace_id` | 当日 `evidence.trace_id === '' \|\| null` 次数 | evidence.trace_id |
| `missing_scanned_path` | 当日 `scanned_path.target_ref` 缺失次数 | evidence.scanned_path |
| `sink_gap_detected` | 当日 sink append 错误 / 顺序倒转 / 重复 evidence_id 次数 | 由独立巡检 job 扫 sink |
| `hit_pattern_count` | `verdict !== 'safe'` 条目的 `hits[].pattern_id` 直方图 | evidence.hits |

额外要求：每条 `caution` 或 `dangerous` 条目必须**手工标注** `fp_status ∈ {false_positive, true_positive, unclear}`。无标注的条目**不计入 FP 率分母**，但**计入 "unclassified" 池**；"unclassified" 池规模本身是一个升级门槛变量（见 §4）。

---

## 4. 升级门槛（阶段 B 评审时逐项勾选）

下列每条都是**必要条件**。任何一条不过，该路径**必须继续 SHADOW**。

### 4.1 观测窗口完整性

- [ ] 连续 7 日数据，无断口；若有断口，窗口已重置并重新达成 7 日。
- [ ] 窗口 `frozen_at` 已记录，冻结后无新数据污染。

### 4.2 证据完整性（每路径独立核对）

- [ ] `missing_trace_id` == 0（任何一条缺 trace = 不升）。
- [ ] `missing_scanned_path` == 0。
- [ ] `sink_gap_detected` == 0（任何一次 sink 异常 = 不升；sink 需先修再观测）。
- [ ] 窗口内所有 evidence 可通过 `sha256Hex` 校验自身 `scanned_at` + `evidence_id` 一致性。

### 4.3 Scanner 可靠性

- [ ] `scanner_failures / observations < 1%`。高于该阈值视为 scanner 未就绪。
- [ ] 所有 `scanner_failures` 有可读 `failure_reason` 非空字符串。

### 4.4 False positive 控制

- [ ] 标注覆盖率：所有 `caution` + `dangerous` 条目中，`fp_status != unclear` 的比例 ≥ 80%。
- [ ] FP 率：`false_positive / (true_positive + false_positive) < 10%`。
- [ ] 无单一 `pattern_id` 的 FP 占比 > 30%（防止 "一条规则拉高全体 FP"）。

### 4.5 规避样本

- [ ] 已手工构造至少 3 个典型 evasion payload 并跑过 shadow，确认扫描器会报 caution/dangerous。
- [ ] 若有任何已报告的 evasion 路径尚未复现，**不升**。

### 4.6 业务吞吐量下限

观测窗口内，该路径至少要有 **有意义的流量**，否则数据不足以支撑升级：

- skill candidate submit：窗口内 ≥ 20 次真实提交
- memory write (各 tier 分别统计)：窗口内 ≥ 50 次真实写入
- assembly fragment ingest：窗口内 ≥ 50 次真实 ingest

吞吐量不达标 = 继续 SHADOW，窗口延长。

---

## 5. 明确禁止事项（红线）

以下任何一条成立，**禁止**升级该路径：

1. **没有 1 周完整数据** → 不升。
2. **sink/evidence 有任何断口** → 不升；先修存储。
3. **scanner_failures 超 1%** → 不升；先修 scanner。
4. **FP 率超门槛 或 FP 标注覆盖率不足** → 不升；先做 FP 分析。
5. **存在未复现的已知规避模式** → 不升；先更新 pattern catalog。
6. **pattern catalog 在窗口内被修改** → 窗口重置；不得在窗口期间"边观察边改规则"。
7. **用感觉代替数据**（"这周看着还行" / "大概没什么问题"）→ 不升；规格页本身就是为了挡这条。

---

## 6. 阶段 A 交付物（观测期结束时必须存在）

窗口关闭时，提交到 `.planning/acceptance/sprint-7-shadow-readout.md`（另起文件，本页不塞数据）：

1. `frozen_at` 时间戳。
2. 每路径 × 每窗口日的 §3 字段表格。
3. 每路径的 §4 门槛勾选结果（勾 / 不勾 + 原因）。
4. 未标注条目清单（要求阶段 B 评审前清零或明确降级处理）。
5. 发现的 evasion pattern 列表与 pattern catalog 差异。

**交付物本身必须 append-only**：若发现错误，追加 Revision 节，不改写已有内容。

---

## 7. 阶段 B 评审输出

阶段 B 的产出**不是代码**，而是**决策工件**（类似 PromotionDecision 的形状）：

- 哪条路径批准 SHADOW → ADVISORY，哪条继续 SHADOW。
- 每条升级路径写入 `ADR-Loamwise-Guard-Content-Security` 的 `non_shadow_allowed_by` 引用（新增 escalation ADR 或复用现有）。
- 变更通过 `GuardChainRegistry.register` 走常规注册流程，**不会**绕开 Sprint 3 已建的校验链。

只有阶段 B 产出合格决策工件后，Sprint 7 才算"开工"。在此之前，代码层面**零变更**。

---

## 8. 本规格的修订纪律

- 窗口期内，本规格页仅可通过 `Revision-YYYY-MM-DD` 节追加修订。
- 降低门槛的修订需附带：触发事件 + 风险重评 + 至少一位 reviewer 签名（commit 附 `Reviewed-by:`）。
- 跳过规格强行评审阶段 B = 违反纪律，该轮评审作废，窗口重置。

---

**Version**: 1.0.0
**Last Updated**: 2026-04-17

---

## Revision-2026-04-17

Append-only refinements per §8 修订纪律. These are **non-blocking
clarifications** raised during规格页审核；they tighten existing rules,
do **not** lower any gate. No reviewer signature required (gate
unchanged).

### R1. "真实" 流量口径（补充 §4.6）

§4.6 吞吐量下限所指的"真实提交/写入/ingest"，在 readout 统计时必须
**排除**以下流量，以防 2026-04-24 readout 被掺水：

- 测试夹具（`vitest` / 任何 `tests/**` 产生的调用）
- Replay / synthetic fixture（包括 `src/audit/replay/` 相关调用）
- 手工重复灌样本（同一 `payload` + 相同 `scanned_path.target_ref` 在
  5 分钟内重复 ≥2 次的条目，保留第 1 次，其余不计入吞吐量；仍计入 FP
  标注总量，以便观察是否有人试图"刷门槛"）

实现口径：readout 生成器按 evidence 的 `trace_id` + `scanned_path` +
`scanned_at` 分桶，标记 `synthetic=true` 的条目从吞吐量分母中剔除；
`synthetic` 的判定依据 trace_id 前缀 / 调用栈 / 显式 fixture 标记，
由 readout 生成脚本落定。

### R2. FP 标注责任（补充 §3）

§3 要求对 `caution` / `dangerous` 条目手工标注 `fp_status`。为建立
审计链，readout 表格每个标注行必须携带：

- `reviewed_by`：标注者 `actor_id`（human user id 或 service id）
- `reviewed_at`：标注时间 ISO 8601

无 `reviewed_by` / `reviewed_at` 的标注视为 `unclear`，计入
"unclassified" 池（§3 原规则），不计入 FP 率分母。

### 对其他章节的影响

- §4.6（吞吐量下限）分母口径收紧；门槛值本身不变。
- §3（统计口径）标注字段扩展；无字段被删除。
- §4.4（FP 控制）不受影响，规则不变，只是数据更可审计。
- §5 红线禁止不受影响。

**Revision-2026-04-17 由规格页作者追加，非降门槛修订，无需 reviewer
签名；下一次修订若降低任何门槛，必须附 `Reviewed-by:`。**

---

## Revision-2026-04-18

Append-only clarification per §8 修订纪律. **非降门槛修订；纯定位声明 +
跨仓库 cross-ref，不改变任何评审门槛。**

**触发事件**：深度读码后发现 `loamwise/govern/guards/*.py` 已实现真实
scanner（55 patterns，142 tests）+ `loamwise/docs/P2-*.md` 观测 memo 齐全；
此前本规格页对 Layer 0 / Layer 1 分工描述不够显式，存在被误读为
"Sprint 1–7 = P2 本体"的风险。

**变更**：

1. 新增 §0 Positioning / Layer Ownership，把"liye_os = contract
   authority / loamwise = execution-readout authority"的分工钉死在最高
   优先级节。
2. 在文件首部的 ADR references 下新增 **Cross-repo references** 清单，
   指向 loamwise 的 `docs/P2-O-*` / `docs/P2-A/B/C-*` / `govern/guards/*.py`
   / `audit/backends/duckdb.py`。
3. 确立"2026-04-24 shadow → advisory 评审的单一口径"：**真实观测数据
   以 loamwise 产出为准；契约合法性、字段语义与边界解释以 liye_os 定义为准。**

**不变项**（再次确认）：

- §1 观测窗口：**2026-04-17 → 最早 2026-04-24**，口径不变。
- §4 六类升级门槛值不变；仅补充 cross-ref，无降门槛动作。
- §5 红线禁止项未变；pattern catalog 窗口期仍不得修改（适用于 loamwise
  侧的 55 patterns + 3 个 catalog version）。

**Cross-repo 对应修改**（同步落到 loamwise）：

- `loamwise/docs/P2-O-observation-runbook.md` 新增 "Contract Source of Truth" 节
- `loamwise/docs/P2-O-observation-memo.md` 新增 "Single Source of Truth Declaration" 节
- `loamwise/docs/P2-O-observation-log.md` 新增 "Single Source of Truth Declaration" 节

**Revision-2026-04-18 由规格页作者追加，非降门槛修订，无需 reviewer 签名。**
