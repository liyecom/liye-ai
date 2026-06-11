# EVO-B Ceremony Record — ADR-Learning-Stack-Generations 裁决红队

**Ceremony 日期**: 2026-06-11
**标的**: `_meta/adr/ADR-Learning-Stack-Generations.md`（Proposed，Option A 分拆-取代）
**Review surface**: liye_os PR `liyecom/liye-ai#165`（Draft）
**红队**: 4-lens 对抗 + per-finding 独立机制验证（Workflow `wf_b90f4c8c`，25 agents / 1.56M tok / 287 tool uses / 484s）
**证据权威序（强制）**: Invariant/Interface 行为 > grep 实证 > line number
**Scope 约束（operator）**: 只审【决策】面（Option A）；EVO-A/C/E 实现细节一律 DEFER

> **本 record 是 ceremony 产物，不是 Accept。** ADR 仍 `Status: Proposed`。是否「ceremony 通过」由 operator 裁定；通过后才走 Proposed→Accepted（+ Accepted-Date 落盘）+ 24h post-Accept cooling，cooling 过后才 merge #165。

---

## 裁决：DECISION_HOLDS（Option A 成立）+ 6 处 doc-only fold

Option A 三支柱在机制层经独立验证全部成立（B-06）：
1. **enforcement/lifecycle 分界由真实 import 边支撑**——N-5 `write_executor/index.mjs:23` 是 execution_gate 全仓唯一生产 import，且该边是 preflight 授权（enforcement primitive）非 lifecycle 晋升/降级。
2. **lifecycle 让位 GHL 由 SSOT 依据支撑**——confidence SSOT（N-6 4 权重 sum=1.0）+ lifecycle 事件契约 SSOT（N-4 sealed）；crystallizer_v0:78 的 3 权重与 SSOT 分叉。
3. **4 模块 superseded 由三层零交叉引用 + 规范相左支撑**——双向 import 图不相交；v0/v0.1 破坏性文件移动 vs GHL append-only。

被否选项（B retrofit / C status quo）理由成立。**决策不至风险**，无任何 lens 给出 DECISION_AT_RISK。

---

## 4-lens verdict

| Lens | Verdict | findings | fold | defer | refute/note |
|------|---------|----------|------|-------|-------------|
| 依赖完整性 | DECISION_HOLDS_WITH_FOLDS | 6 | 1 (DEP-02) | 1 (DEP-03) | 4 |
| 审计连续性 | DECISION_HOLDS_WITH_FOLDS | 4 | 1 (AC-01) | 1 (AC-04) | 2 |
| GHL 边界 | **DECISION_HOLDS（零 fold）** | 5 | 0 | 0 | 5 |
| ADR-mechanics | DECISION_HOLDS_WITH_FOLDS | 6 | 4 (B-01/02/03/04) | 0 | 2 |
| **合计** | — | **18** | **6** | **3** | **9** (含 1 micro) |

9 refute/note = proof-of-coverage（红队尝试证伪决策依赖事实，机制成立无法推翻）。

---

## Findings 全表（finder disposition → 独立验证 → 终裁）

### Lens 1 — 依赖完整性
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| DEP-01 | LOW | N-5 唯一生产 import 精确（execution_gate ← write_executor:23，全仓恰 1 import 边） | REFUTE | refuted=false, CONFIRMED | **REFUTE_NO_ACTION** |
| DEP-02 | MED | **kill_switch 实为三实现非双**——漏 `src/runtime/execution/kill_switch.mjs`（ENV `KILL_SWITCH`，活 write_gate→real_executor→feishu 链，PR #90） | FOLD | refuted=false, CONFIRMED | **FOLD_INTO_ADR** |
| DEP-03 | LOW | tier_manager 第 4 处 grep 命中 = `policy_lifecycle_event_v1.schema.yaml:70` prose「e.g.」示例，非 load-bearing 消费者 | NOTE | DEFER（记入 EVO-C reverse-dep） | **DEFER_TO_EVO_C** |
| DEP-04 | LOW | superseded 标记不断裂任何隐藏调用方（4 模块活跃耦合面全由 D-A1/D-A3 覆盖） | REFUTE | refuted=false, anchor WRONG_BUT_MECHANISM_HOLDS（execSync 非 import，更强化安全论证） | **REFUTE_NO_ACTION** |
| DEP-05 | LOW | D-A3 isDriftBlocked 依赖边刻画准确（只读、policyId∧WRITE_LIMITED 触发、默认 null 短路） | REFUTE | refuted=false, off-by-one（:266 guard/:267 call）机制成立 | **REFUTE_NO_ACTION** |
| DEP-06 | LOW | GHL sealed chain 零 import v0/v0.1（双向不相交 + 动态加载扫净） | REFUTE | refuted=false, NOT_LINE_BASED（已在 Context #1） | **REFUTE_NO_ACTION** |

### Lens 2 — 审计连续性
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| AC-01 | HIGH | **D-A4「审计空窗」忧虑被证伪**——三破坏性路径即便 live 仍各落 append-only JSONL（fact_tier_decisions/fact_drift_events/promotion_log）；真差异=schema 碎片化非黑洞 | FOLD（澄清） | refuted=true（前提 FALSE），FOLD | **FOLD_INTO_ADR**（D-A4 澄清） |
| AC-02 | MED | 破坏性路径实际休眠——零活跃自动触发器到达 live 分支（全 dry-run+`||true`，runner 零调用者无 cron/heartbeat） | REFUTE | refuted=true, CONFIRMED | **REFUTE_NO_ACTION** |
| AC-03 | LOW | isDriftBlocked 纯只读（existsSync/readFileSync，零写/移动），preflight 仅 append-only gate facts | REFUTE | refuted=true, off-by-one（:325）机制成立 | **REFUTE_NO_ACTION** |
| AC-04 | LOW | 残留 manual 触发面——runbook live 命令（`week3-tier-drift-kill.md:49/70`）不被 comment-only 标记 disable | DEFER | refuted=false, DEFER | **DEFER_TO_EVO_C**（runbook 弃用） |

> AC-01 子缺陷（验证额外发现）：`promotion_v0.mjs` 的 logPromotion 与 movePolicy 非 co-located + error-swallowing try/catch（best-effort logging gap）→ EVO-C cleanup 记。

### Lens 3 — GHL 边界（零 fold，全 coverage proof）
| id | sev | finding | 终裁 |
|----|-----|---------|------|
| GB-01 | LOW | 决策边界纪律干净——只裁权威+superseded+backlog 指针，所有 HOW 显式 defer GHL ceremony；零 implementation creep（8 处「2b/2c」逐句核） | REFUTE_NO_ACTION |
| GB-02 | LOW | D-A5 SSOT 权重 0.2/0.3/0.4/0.1 + loader sum=1.0 + crystallizer_v0:78 三权重分叉归因，与文件 ground-truth 逐位一致 | REFUTE_NO_ACTION |
| GB-03 | LOW | 无虚构 GHL scope——2b shadow→2c cutover（ADR-GHL D-04）/ sandbox→candidate（L80/L188）/ policy_lifecycle（D-09）逐字有锚 | REFUTE_NO_ACTION |
| GB-04 | LOW | GHL v1 sealed 栈 NOT own 自动降级（其 drift 全是 schema-version 完整性，正交 v0 confidence-drift）→ D-A2 移交非冗余非矛盾，反填 GHL gap | NOTE_ONLY |
| GB-05 | LOW | N-4 + D-A4 与现状一致：schema 真 sealed（5651B）+ registered（validate-contracts:523）+ 零 producer + GHL 域 | NOTE_ONLY |

> GB-02 验证披露：「loader-enforced sum=1.0」是非可执行 yaml 内的声明性契约意图，非 runtime 强制——不改 disposition（finding 仅称文件「陈述」该约束，属实）。

### Lens 4 — ADR-mechanics
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| B-01 | HIGH→**降级** | commit-anchor 时序：frontmatter「待 Accept 时按 post-squash SHA 锚定」而 Accept 在 merge 前→SHA 尚不存在 | FOLD(HIGH) | **refuted=true → NOTE_ONLY**（house ADR-GHL L33 本就概念锚定、不落 SHA 值、已 Accepted 在跑；L28 已引同款教条，非真悖论） | **FOLD_INTO_ADR（clarity，operator 显式要求）** |
| B-02 | LOW | Accept 落盘点半覆盖——validator 只管 frontmatter Accepted-Date，文末 Lifecycle 块在扫描域外→静默不一致风险 | FOLD | refuted=false, CONFIRMED | **FOLD_INTO_ADR**（三锚点 checklist） |
| B-03 | LOW | draft cooling 起点未定义（house 锚 draft 日，ADR-008 未照搬） | FOLD | refuted=false, CONFIRMED | **FOLD_INTO_ADR**（起点=2026-06-10） |
| B-04 | LOW | ADR 未显式声明「Accept 时 #165 仍 open、merge 在 cooling 后」=B-01 结构根因 | FOLD | refuted=false, CONFIRMED（合并 B-01） | **FOLD_INTO_ADR**（与 B-01 同根合并） |
| B-05 | LOW | Required-Corrections/Checkpoints 自洽：D-03..D-06 已 fold、EVO-C D-1(4)/D-2 清单一致、BGHS 11/11 | NOTE | refuted=false, NOTE（micro: D-06 :88 措辞「注释行」实为 allowlist 条目） | **NOTE_ONLY**（+ micro 措辞修正已 fold） |
| B-06 | LOW | Option A 决策三支柱机制层成立，无内部矛盾 | NOTE | refuted=false, CONFIRMED | **NOTE_ONLY**（DECISION_HOLDS） |

---

## ⭐ B-01 finder↔verifier 分歧（诚实记录，对抗验证价值兑现点）

- **finder**: HIGH，「Accept-blocking 悖论」，FOLD。
- **独立验证**: **refuted=true，降为 NOTE_ONLY**。理由（Interface 行为 > grep > line）：house 先例 ADR-GHL L33 锚定到**概念**「the post-squash merge commit becomes the durable anchor; no pre-squash SHA is normative」——frontmatter 从不落 SHA 值、零回填 commit、且已 Accepted 在跑。ADR-008 L28 引的就是同款教条，排除了「Accept 瞬间须落一个 SHA 值」的唯一读法 → 非真悖论，残留只是相对 house 措辞的散文松度。
- **终裁（我）**: **FOLD，但诚实降级为 clarity fold**。验证机制正确（这不是 Accept-blocking 缺陷）；但 operator 在决策中**显式要求**把回填路径写明（"不要假装预先知道 squash SHA"），且 fold 成本极低、消除真实歧义。**operator 指令 > finder/verifier 机制之争** → fold 保留，severity 如实从 HIGH 降为 clarity。

这与 R2 的 :88 教训同源：机制判断（验证 refute HIGH）优先于 finder 的初判，但最终处置服从 operator 的显式意图。

---

## Cooling 计时点（ceremony 产物）

| 窗 | 语义 | 计时锚 | 状态 |
|----|------|--------|------|
| **draft cooling** | pre-Accept 反思窗（可改） | 起点 = ADR draft 落盘日 **2026-06-10**（B-03 校准，对齐 ADR-GHL first-cooling 锚 draft 日） | **已实质流逝**（draft→今 2026-06-11 + ceremony 红队 round 完成）；operator 可直接判定满足 |
| **post-Accept cooling** | 撤回窗（可撤，期内 EVO-C 不动工、#165 不 merge） | 起点 = **Accepted-Date**（待落）；EVO-C 解锁 = Accepted-Date + 24h | **未起算**（Status 仍 Proposed，Accepted-Date 待 operator 落盘） |

> 与 ADR-GHL house（两窗均 pre-Accept）的差异已在 ADR Cooling 模型注显式声明：本 ADR 第二窗移至 post-Accept 作撤回窗。

---

## Accept 条件状态（EVO-B SPEC §Accept 条件）

- [x] 红队 findings 全 fold 或显式驳回（记 Decision Log D-07 + 本 record）— **本 ceremony 完成**
- [ ] operator 签字 + Accepted-Date 落盘 + 24h cooling — **待 operator**
- [ ] commit anchor 按 post-squash SHA 锚定（merge 后回填，B-01 已澄清回填路径）— **待 merge**

三源 gate 复跑（fold 后实测）：见 PR #165 描述 / 下方。

## DEFER_TO_EVO_C（3 项，已写入 EVO-C SPEC Entry criteria 3）

1. **DEP-03** — reverse-dep 重扫标注 `policy_lifecycle_event_v1.schema.yaml:70` prose 为已知非消费者。
2. **AC-04** — `docs/runbooks/week3-tier-drift-kill.md:49/70` live 命令 runbook 弃用/警示。
3. **AC-01 子缺陷** — `promotion_v0.mjs` logPromotion best-effort logging gap cleanup。

---

## 下一步

operator 判定「ceremony 通过」→ ADR Proposed→Accepted（三锚点同步，B-02）+ Accepted-Date 落盘 → 24h post-Accept cooling（#165 保持 open、EVO-C 不动工）→ cooling 过后 merge #165 + 回填 commit anchor。EVO-C 解锁 = Accepted-Date + 24h。
