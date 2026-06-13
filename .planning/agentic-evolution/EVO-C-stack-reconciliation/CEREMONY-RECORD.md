# EVO-C Ceremony Record — stack-reconciliation 执行裁决红队

**Ceremony 日期**: 2026-06-13
**标的**: `.planning/agentic-evolution/EVO-C-stack-reconciliation/SPEC.md`（seed → v1.0）
**输入基线**: liye_os main HEAD `7b3a7f7`（ADR-Learning-Stack-Generations **Accepted** + D-08 已落 main，#167 merged）
**红队**: 5-lens 对抗 + completeness critic（Workflow `wf_87d90bd2`，6 agents / 549K tok / 121 tool uses / 552s）
**证据权威序（强制）**: Invariant/Interface 行为 > grep 实证 > line number
**Scope 约束（operator）**: 本 ceremony 只产【决策面】——SPEC v1.0 + 本 record，**doc-only**。**不启动 EVO-C IMPL**；不碰 #443（AGE EVO-D）。

> **本 record 是 ceremony 产物，不是 IMPL。** SPEC 升 v1.0 后由 operator 判定「v1.0 通过」；通过后才开 EVO-C IMPL PR（单一 surgical PR：标记 / 重分类 / gate 硬化 / 对应测试；不删文件除 token、不重写 GHL、不引入 agent framework）。

---

## 裁决：READY_FOR_V1（5 lens 全 READY_WITH_FOLDS）+ 1 个 D-09 授权（延至 IMPL）

5 个 lens 全部 **READY_WITH_FOLDS**——Option A 的执行边界（标记/重分类/gate 硬化）在机制层全部成立，无任何 lens 判 AT_RISK。completeness critic 初判 **NEEDS_MORE_FOLDS**，捕获 5 个 lens 漏掉的 4 个开放决策（D-3 / D-4 / AC-04 / D-A3 一致性）+ 1 处跨-lens 锚点/重复标记和解——**全部已在本 record fold**，且 critic 实证「除 Lens-3 已正确点名的那一个 D-09 外，无新的未授权 Hard Gate 4 越界」。

**唯一超出 Hard Gate 4 的动作 = D-5 Option 2（扩 validator + 删 token）**，须 ADR Decision Log append **D-09** 授权（非新 ADR，同 D-03..D-08 机制）。本 ceremony **不**触碰 Accepted ADR；D-09 的最终文本在此锁定（见下），**随 EVO-C IMPL PR 与其授权的 code+config 改动同 PR append**——授权与执行同处审阅，provenance 最干净。

---

## 5-lens verdict

| Lens | Verdict | findings | FOLD_INTO_SPEC | FOLD_INTO_ADR(D-09) | DEFER | NOTE/REFUTE |
|------|---------|----------|----------------|---------------------|-------|-------------|
| 1 lifecycle disposition | READY_WITH_FOLDS | 6 | 3 (LD-02/03/05) | 0 | 1 (LD-04→AC-01) | 2 |
| 2 enforcement boundary | READY_WITH_FOLDS | 4 | 3 (EB-01/02/03) | 0 | 0 | 1 |
| 3 gate truthfulness | READY_WITH_FOLDS | 6 | 5 (GT-01/02/04/05/06) | 1 (GT-03) | 0 | 0 |
| 4 audit / provenance | READY_WITH_FOLDS | 6 | 2 (L4-02/03) | 1 (L4-01) | 0 | 3 |
| 5 reverse-dep freshness | READY_WITH_FOLDS | 7 | 0 | 0 | 0 | 7 (criterion-2 SATISFIED) |
| **completeness critic** | NEEDS_MORE_FOLDS→**resolved** | 5 gaps | 4 (D-3/D-4/AC-04/D-A3) | 0 | 0 | 1 (anchor 和解) |

---

## Findings 全表（finder → 独立对抗验证 → 终裁）

### Lens 1 — lifecycle disposition
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| LD-01 | MED | 7th-module 扫除：`discover_new_runs.mjs` 是唯一触「tier」词汇的未列模块，但是 ingestion/discovery（AGE run-tier 过滤），**非** lifecycle 权威（零 promotion/demotion/confidence/renameSync；module body 零调用；仅 `@2.0.0` version token schema-pinned 存活）→ 正确 OUT。6 文件清单 **完整、同栈** | NOTE | refuted=true（试图把它扩入失败，proof-of-coverage） | **NOTE_ONLY** |
| LD-02 | HIGH | drift_monitor straddle 是真语义矛盾面但**可不撒谎地解**：两表面——(a) 破坏性主动降级路径（writeFileSync/unlinkSync :226-229 + CLI main）= D-A2 冻结的 lifecycle 权威；(b) `isDriftBlocked()`（:421 只读）= execution_gate 消费的 enforcement 读。blanket「禁止新代码引用」会撒谎 | FOLD | refuted=false（marker 须 surface-scoped；"no NEW references" 不溯及既存 execution_gate 边） | **FOLD_INTO_SPEC**（merge EB-01） |
| LD-03 | HIGH | half-dead residue 真实：runner `export function runLearningPipeline`（L68）独立于 main() CLI guard；只标内层 2 件会留可调用的假 Interface。标全 4 件才闭合 D-08 担忧。pattern_detector_v0 零外部 import（seed_runs `getBucketId` 是本地同名 def 非 import，D-08 collision 确认） | FOLD | refuted=true（试图论证 main() guard 足够 → 被 export 推翻；finding 成立） | **FOLD_INTO_SPEC** |
| LD-04 | MED | AC-01 best-effort logging gap 在 call-site 确认：movePolicy（renameSync）先于 logPromotion（appendFileSync，独立 try/catch 仅 console.error）→ move 已 commit 而 audit append 可被吞 | DEFER | refuted=false | **DEFER**（→ L4-02 fold 进 DoD，annotate-only） |
| LD-05 | MED | OQ-3 promotion_log.jsonl = **gitignored 未跟踪** runtime artifact（2 行/704B，week-6 测试策略晋升）→ 无版本历史可迁移；EVO-C doc-only | FOLD | refuted=false | **FOLD_INTO_SPEC**（LEAVE-IN-PLACE-WITH-NOTE，merge L4-03） |
| LD-06 | LOW | 同栈/clean-baseline 确认：零 GHL-frozen 文件 import 6 标的；唯一非 intra-stack importer = execution_gate→isDriftBlocked（LD-02 straddle）；10 文件零预存 marker | NOTE | refuted=true（coverage proof） | **NOTE_ONLY** |

### Lens 2 — enforcement boundary
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| EB-01 | HIGH | drift_monitor blanket header 会向未来读者谎称整模块死掉，掩盖 isDriftBlocked 是 live enforcement 依赖。须 carve-out + isDriftBlocked 上方一行 ENFORCEMENT-READ marker | FOLD | refuted=false | **FOLD_INTO_SPEC**（与 LD-02 合并为单一 header） |
| EB-02 | MED | ⚠ runtime kill_switch「活生产链/最高风险」措辞**不精确**：`checkKillSwitch` 仅经 `write_gate.mjs:384 checkWriteGateP6C` 调用，而 checkWriteGateP6C 唯一消费者 = `test_write_gate_p6c.mjs`（CI-wired）；真实 feishu 链（`feishu_actions.mjs:39 → real_executor.mjs:166`）用 plain `checkWriteGate`，**不**调 runtime kill_switch | FOLD | refuted=false | **FOLD_INTO_SPEC**（D-7 attestation 精确化，措辞改「P6C supervised-write gate path, not default feishu path」） |
| EB-03 | MED | Hard Gate 1 三 kill_switch 证据不对称、SPEC 未点名 per-impl 回归证据 | FOLD | refuted=false | **FOLD_INTO_SPEC**（per-impl 证据表） |
| EB-04 | LOW | D-A1 reclassify-only 机制干净：4 enforcement 文件零预存 marker（governance kill_switch :82 `state_legacy` 是运行时返回值非 marker）；ENV 纯函数态，JSDoc header 不碰任何执行分支 | NOTE | refuted=true | **NOTE_ONLY** |

### Lens 3 — gate truthfulness
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| GT-01 | HIGH | no-op **实证确认**：validate() 6 段零解析 transitions/.requires；活跑 token 在/双删/半删/注入垃圾 token **全 EXIT 0** | FOLD | refuted=false | **FOLD_INTO_SPEC**（D-5 no-op 锚定，禁用 inert validator 作处置门） |
| GT-02 | HIGH | Option 2 设计：扩 `validateTransitionTokens()` walk + fail-closed on orphan；live-token allowlist = {criteria_met, operator_explicit_approval, drift_detected, operator_request, consecutive_failures, kill_switch_active, drift_critical}（真 yaml 枚举）；tier_manager_approval 是唯一 orphan；**扩 validator + 删 token 必须同 PR 耦合**（留 token+walk→EXIT 1 破门；删+walk→EXIT 0 过门，实测） | FOLD | refuted=false | **FOLD_INTO_SPEC** |
| GT-03 | HIGH | **Hard Gate 4 reconciliation**：Option 2 = code（扩 validator）+ config（删 token）改动，超「注释级」；Hard Gate 4 + Risk Register 显式点名「token 删除影响 config 校验」须 Decision Log 增补 → 须 **D-09**（非新 ADR） | FOLD | refuted=false | **FOLD_INTO_ADR_D09**（延至 IMPL PR append） |
| GT-04 | MED | live-path safety：execution_gate 读 `tiers[currentTier]`（:173）非 transitions；tier_manager（休眠）读 `tiers[].promotion_criteria`（:366）非 transitions/requires → 删 token 各路径行为 inert，Hard Gate 1 不受影响 | FOLD | refuted=false | **FOLD_INTO_SPEC** |
| GT-05 | MED | gate-count 独立：validate-contracts schemaFiles 计数 = **21**（活实测），独立 validator/workflow；扩 execution-tiers validator 零 schemaFiles entry → 21 不变。**不同于** 2a-γ/Phase-4 的 schema 注册 +1 | FOLD | refuted=false | **FOLD_INTO_SPEC** |
| GT-06 | LOW | 无其它 orphan token：5 transitions / 8 distinct token，7 live + 1 orphan（tier_manager_approval）；删后 walk 零残留 orphan，不破 CI | FOLD | refuted=false | **FOLD_INTO_SPEC** |

### Lens 4 — audit / provenance
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| L4-01 | HIGH | append-only 不变量字节级成立：D-01..D-07 在 `e3b692b`/`0a4f7e7`/`7b3a7f7` 三 commit 字节一致，D-08 纯 append；#166 anchor-backfill 只碰 frontmatter 零 Decision Log → D-09 须 append 在 D-08 后，绝不改写 | NOTE | refuted=false | **FOLD_INTO_ADR_D09**（precondition 锚定） |
| L4-02 | HIGH | AC-01 结构性 gap 源码确认：movePolicy（renameSync :114）在 checkPromotions :250 commit，logPromotion（appendFileSync :101）在 main :291 后置且 try/catch 吞错（:290-294）→ move 可成而无 ledger row | FOLD | refuted=false | **FOLD_INTO_SPEC**（DoD：**annotate-only**；禁 re-order/去 swallow——皆 behavior change 且 D-A4 禁镀金 superseded code；真修延 GHL 2b/2c） |
| L4-03 | MED | OQ-3：supersede 不得静默孤儿化 append-only ledger，但该 ledger gitignored（.gitignore:330）未跟踪→无 committed replay 历史可孤儿化 → leave-in-place-annotated | FOLD | refuted=false | **FOLD_INTO_SPEC**（与 LD-05 合并） |
| L4-04 | MED | seed→v1.0 必须保全 D-1..D-7 + 4 Hard Gate，只 ADD 不 silently drop | NOTE | refuted=false | **NOTE_ONLY**（v1.0 已逐项保全，见下） |
| L4-05 | LOW | 3 DEFER fold 全 comment/doc 级。schema:70 是 description 块内 prose 非 :66 pattern；本 ceremony **未**应用该 annotation（DEP-03 延 IMPL）。⚠ **operator 复核更正**：IMPL 应用 DEP-03 时改 description prose = **validation-neutral**（`pattern`/`required`/`enum` 不变 + gate count 维持 21），但**文件 hash 必变，不声称 sealed hash 不变**；红队原报「sealed sha256 仍 `aaf635a1…`」= 幻觉锚（main `7b3a7f7` 实测 schema blob = `2d4f50f9…`，无 `aaf635a1`） | NOTE | refuted=false（修正措辞） | **NOTE_ONLY** |
| L4-06 | LOW | CEREMONY-RECORD.md 须新文件、镜像 EVO-B 格式、置于 EVO-C 目录、不覆盖 EVO-B record | NOTE | refuted=false | **NOTE_ONLY**（本文件即是） |

### Lens 5 — reverse-dep freshness（criterion-2 复confirm @ 7b3a7f7）
| id | sev | finding | finder | verify | 终裁 |
|----|-----|---------|--------|--------|------|
| RF-01 | HIGH | delta `0a4f7e7..7b3a7f7` = doc-only #167（2 .md，+9/-8，零 code/schema/CI）→ D-08 reverse-dep 拓扑结构不变 | NOTE | refuted=false | **NOTE_ONLY** |
| RF-02 | HIGH | 6 superseded 模块 @7b3a7f7 零新外部 importer；唯一 superseded-importer = execution_gate:23→isDriftBlocked（D-A3 straddle）；3 pipeline 模块仅 runner execSync 子进程引用 | NOTE | refuted=false | **NOTE_ONLY** |
| RF-03 | LOW | 非-importer 引用（不可误判为消费者）：execution-tiers-gate.yml:149-155 `--dry-run \|\| true` CI 面（#117 pre-existing 非新）；execution_tiers.yaml comment+token；evidence/*.json + schema:70 prose | NOTE | refuted=false | **NOTE_ONLY** |
| RF-04 | MED | GHL frozen 锚 0-diff @7b3a7f7，三层零交叉成立：blob 实测 import_facts `39f02581`/d11 `96285406`/metrics_daily `5057fc5a`/canonical `42b05d04`/heartbeat File-A `54944884`/evaluator `3f9ad911` | NOTE | refuted=false | **NOTE_ONLY** |
| RF-05 | MED | ⚠ stale path-pointer：evaluator 在 `src/reasoning/policy_trial_evaluator.mjs`，**非** ADR/memory 写的 `src/governance/learning/`；blob `3f9ad911` 正确唯一 → freshness 不受影响，但 EVO-C IMPL grep 若用 governance 路径串会 miss | NOTE | refuted=false | **NOTE_ONLY**（doc-path hygiene，IMPL 知会） |
| RF-06 | LOW | 3 个 D-08 non-module-edge 旁注 @7b3a7f7 仍准确（heartbeat_runner.mjs:33 + s15_production_canary.mjs:57 内联 LIYE_KILL_SWITCH ENV 读；reasoning-assets-gate.yml:62 跑 baseline test）= ENV-name reuse / CI 面，非 importer | NOTE | refuted=false | **NOTE_ONLY** |
| RF-07 | HIGH | **criterion-2 SATISFIED @7b3a7f7**：delta doc-only + 零新 importer + GHL 0-diff + 旁注复confirm + inert token 无 live-path reverse-dep | NOTE | refuted=false | **NOTE_ONLY** |

---

## completeness critic — 4 gap fold（5 lens 漏项，已补）

| gap | critic 裁定 | fold |
|-----|-----------|------|
| **D-3** test_week3 legacy 粒度（OQ-1） | 5 lens 零 fold；substantively 须 **PER-CASE**——suite 混 D-A1 staying（Test 1 validator / Test 3 kill_switch）与 D-A2 superseded（Test 4/5/6 tier_manager / Test 7/8 drift_monitor）。whole-suite 会把 enforcement 测试谎标 legacy，违 D-A1 | **FOLD_INTO_SPEC D-3**（per-case + 机制锚） |
| **D-4** hardhook CI-wire scope | 5 lens 未定 host + blocking-vs-smoke。smoke wire（\|\| true）= 零回归保护 → Hard Gate 1 变 theater | **FOLD_INTO_SPEC D-4**（BLOCKING + host pinned） |
| **AC-04** runbook 弃用 | 3 binding DEFER 之一，只被旁提无 concrete fold_text。comment-only marker 不能 disable 人类 copy-paste runbook live 命令触发破坏性路径 | **FOLD_INTO_SPEC DoD**（concrete banner） |
| **D-A3** token remove-vs-mark 一致性 | Lens 3 单方选 DELETE 未对照 mark 备选 / 6-file mark 哲学；Lens1(no-D-09)/Lens3(yes-D-09) split 须显式声明 scope-disjoint | **FOLD_INTO_SPEC D-5**（DELETE 规则 + split 澄清） |
| **跨-lens 锚点/重复标记** | promotion_v0 锚（LD-04 vs L4-02 行号异）+ drift_monitor 双 header（LD-02 + EB-01 会双标） | **本 record 锚点和解**（见下） |

### 锚点和解（IMPL 须遵，机制 binding，行号仅指针）
- **promotion_v0 AC-01**：权威 = `movePolicy` def L107（renameSync L114）+ `logPromotion` def L93（appendFileSync L101）；call-site move L250 先于 swallowed logPromotion call L291（try/catch L290-294）。header 注释引 **def-site L114/L101**。
- **drift_monitor straddle**：LD-02 与 EB-01 substantively **同一**——应用**单一合并 header**（LD-02 wording 为 base：file-level superseded 限于 active demotion 表面 + isDriftBlocked carve-out 为 D-A3 preserved read edge，execution_gate.mjs:23/:267 消费）+ EB-01 的 `isDriftBlocked` export（:421）上方一行 inline `// ENFORCEMENT-READ (D-A3)` marker。**不得双标**。

---

## D-09（最终文本锁定；随 EVO-C IMPL PR append，本 ceremony 不触 ADR）

> append-only precondition 已 L4-01 字节核验：D-01..D-07 三 commit 一致、D-08 纯 append。下文是 D-09 的成稿，EVO-C IMPL PR 在 Decision Log D-08 之后**追加**：

```
- D-09 (2026-06-13，EVO-C gate-truthfulness ceremony fold，`wf_87d90bd2` Lens-3 机制实证)：授权 D-5 采 Option 2
  （扩 validator + 删 token），作为 in-EVO-C-scope 的有据偏离 Hard Gate 4。依据：validate-execution-tiers.mjs
  validate() 实测零解析 config.transitions/.requires（token 在/删/半删/注入垃圾恒 EXIT 0，no-op 门已 D-06(c)
  锚定）。Option 2 = (a) 扩 validateTransitionTokens() walk transitions[].requires，对不在 live-token allowlist
  {criteria_met, operator_explicit_approval, drift_detected, operator_request, consecutive_failures,
  kill_switch_active, drift_critical} 的孤儿 token fail-closed（exit 1）+ (b) 删 execution_tiers.yaml:95/:102 的
  tier_manager_approval（唯一孤儿）。二者必须同 PR 耦合（实测：留 token+walk→errorCount=2/EXIT 1 破门；删 token+walk
  →0/EXIT 0 过门）。Hard Gate 4 / Risk Register 显式点名「token 删除影响 config 校验」须 Decision Log 增补——本条即
  增补，非新 ADR。LIVE-PATH 0 影响（execution_gate 读 tiers 非 transitions，write_executor:23→preflightCheck 链
  字节级回归；tier_manager 休眠且仅读 promotion_criteria 不读 transitions，token 无任何运行时执行者）。gate 计数 0
  变化（validate-contracts schemaFiles 仍 21，独立 validator/workflow）。0 schema 增删。
```

**D-09 split 澄清（critic 要求显式）**：本 ceremony 唯一须 D-09 的动作 = token-delete + validator-extend（code+config，超 Hard Gate 4）。6-file 标记 + DEP-03 + AC-04 + AC-01 annotate 全在 Hard Gate 4 内，**零 D-09**。Lens-1「no-D-09」对 marking scope 正确，Lens-3「yes-D-09」对 token scope 正确，二者 scope-disjoint，**恰一个 D-09**。

---

## 开放决策裁定（v1.0 锁定）

| 决策 | seed 状态 | v1.0 裁定 | D-09? |
|------|-----------|-----------|-------|
| **D-3**（OQ-1 test_week3 粒度） | 「ceremony 裁」 | **PER-CASE**——legacy marker 只加 Test 4/5/6（tier_manager）+ Test 7/8（drift_monitor active）上方；**Test 1（validator）/ Test 3（kill_switch）禁标**（D-A1 staying）。comment-ABOVE-case，**test-name 串冻结**（守 execution-tiers-gate.yml:100-114 grep-token presence check）。whole-suite 禁用 | 否 |
| **D-4**（hardhook CI-wire scope） | 「EVO-C 期 CI-wire」 | **BLOCKING** step 进 execution-tiers-gate.yml governance-tests job（:95，与 week3 同处），`node tests/governance/test_execution_gate_hardhook.mjs` **无 `\|\| true`**——红即 fail job。smoke wire 会 void Hard Gate 1 | 否 |
| **D-5**（token 处置机制） | Option 1/2 待裁 | **Option 2**（operator-preferred）——扩 validateTransitionTokens() + 删 token，同 PR 耦合 | **是** |
| **D-A3**（token remove-vs-mark 一致性） | 「删/标记」 | **DELETE**——规则「MARK 有 live surface 的，DELETE 纯 dead data」；token inert 无执行者，DEAD-CONFIG 注释反会触发新 fail-closed walk | （随 D-5） |
| **OQ-3**（promotion_log 历史处置） | 「EVO-C 裁」 | **LEAVE-IN-PLACE-WITH-NOTE**——gitignored 未跟踪 runtime artifact，无 committed 历史可迁移；promotion_v0 superseded header 注「legacy best-effort trail，未迁移 per D-A4，GHL append-only JSONL 是 live SoT」 | 否 |

---

## DEFER_TO_EVO_C fold 状态（3/3 入 v1.0 DoD）

| DEFER | 来源 | v1.0 fold |
|-------|------|-----------|
| DEP-03 schema:70 prose 标 known non-consumer | EVO-B | DoD 项；annotate description-块 prose（非 :66 pattern）；**validation-neutral**（`pattern`/`required`/`enum` 不变 + gate count 维持 21），但文件 hash 会变，**不声称 sealed hash 不变** |
| AC-04 runbook live 命令弃用警示 | EVO-B | DoD 项 + concrete banner（critic 补，见 SPEC D-1/DoD） |
| AC-01 promotion_v0 best-effort logging cleanup | EVO-B | DoD 项；**annotate-only**（禁 re-order / 去 swallow——behavior change + D-A4 禁镀金；真修延 GHL 2b/2c） |

---

## 三源 gate（ceremony 产物落盘后实测）

见 PR 描述。本 ceremony doc-only（2 文件：本 record + SPEC v1.0）；零 code/schema/config 改动 → BGHS / contracts(21) / execution-tiers 全绿，GHL frozen 0-diff。

## 下一步

operator 判定「v1.0 通过」→ 开 EVO-C IMPL PR（单一 surgical PR）：6-file superseded 标记（drift_monitor surface-scoped + runner export 标记）+ 4-file enforcement 重分类（D-7 attestation 用 EB-02 精确措辞）+ D-3 per-case 测试标记 + D-4 hardhook BLOCKING wire + **D-5 Option 2（同 PR append D-09 + 扩 validator + 删 token）** + D-6 GHL backlog 落档 + 3 DEFER fold + Hard Gate 1-4 实证（含 EB-03 per-impl kill_switch 证据表）。IMPL 仍须 operator 明示 go。
