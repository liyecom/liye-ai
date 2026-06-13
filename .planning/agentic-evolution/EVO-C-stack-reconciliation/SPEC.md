# EVO-C SPEC v1.0 — 执行 ADR-Learning-Stack-Generations 裁决（stack reconciliation）

**Status**: **v1.0**（ceremony 通过 pending operator「v1.0 通过」判定；EVO-C IMPL **未启动**）
**Date**: 2026-06-10 seed → **2026-06-13 ceremony fold v1.0**（5-lens 红队 + completeness critic `wf_87d90bd2`；裁定见同目录 `CEREMONY-RECORD.md`）
**输入基线**: liye_os main HEAD `7b3a7f7`（ADR **Accepted** + D-08 已 on main）
**Pattern 来源**: Ch9 Learning（lifecycle 单一权威）· Ch8 Memory（append-only 审计连续性）
**证据权威序**: Invariant/Interface 行为 > grep 实证 > line number（行号仅指针）

---

## Goal

落地 ADR-Learning-Stack-Generations 的 R-2/R-3a：v0+v0.1 学习栈分拆-取代的全部**注释/文档/测试标记 + gate 硬化 + token 处置**改动，**单一 surgical PR**。不删文件（token 除外）、不重写 GHL、不引入 agent framework。

> ADR 权威源 = `_meta/adr/ADR-Learning-Stack-Generations.md`（Accepted；非数字前缀 D-05 重命名）。

## 这是 IMPL phase（决策已由本 ceremony + ADR 锁定）

ceremony 已锁全部开放决策（D-3 / D-4 / D-5 / D-A3 / OQ-3，见下表）。EVO-C IMPL 只执行，不再起争论。**唯一超 Hard Gate 4 的动作 = D-5 Option 2，须同 PR append ADR Decision Log D-09**（成稿见 `CEREMONY-RECORD.md`，非新 ADR）。

| 开放决策 | v1.0 裁定 |
|----------|-----------|
| D-3 test_week3 legacy 粒度（ADR OQ-1） | **PER-CASE**（仅标 superseded 用例；enforcement 用例禁标） |
| D-4 hardhook CI-wire scope | **BLOCKING** step，host = execution-tiers-gate.yml |
| D-5 token 处置机制 | **Option 2**（扩 validator + 删 token，耦合，须 D-09） |
| D-A3 token remove-vs-mark | **DELETE**（规则：MARK 有 live surface 的，DELETE 纯 dead data） |
| OQ-3 promotion_log 历史 | **LEAVE-IN-PLACE-WITH-NOTE**（gitignored 未跟踪） |

---

## Deliverables（v1.0）

### D-1 — 6 文件 superseded 标记（注释级，diff 仅注释行）
`src/governance/learning/tier_manager.mjs` + `src/governance/learning/drift_monitor.mjs`（v0）+ 整个休眠 v0.1 pipeline 4 件：`policy_crystallizer_v0.mjs` + `promotion_v0.mjs` + `pattern_detector_v0.mjs` + `learning_pipeline_v0_runner.mjs`。统一三行头注释（Status: superseded-by-GHL / 权威源指针 ADR-Learning-Stack-Generations + ADR-GHL / 禁止新代码引用），**但下列 2 件须 surface-scoped 例外，禁 blanket 措辞**：

- **`drift_monitor.mjs`（surface-scoped，LD-02 + EB-01 合并为单一 header，禁双标）**：header 限定 superseded 于**主动降级/quarantine 路径**（writeFileSync/unlinkSync 状态变更 + CLI main = RETIRED，no NEW code 作 demotion/lifecycle 权威）；**EXCEPTION**：`isDriftBlocked()`（只读 existsSync/readFileSync）是 **D-A3 preserved read-only enforcement library**，被 STAYING enforcement primitive `execution_gate.mjs:23/:267` 消费（仅 policyId 非空 ∧ actionType=WRITE_LIMITED 触发），既存边 grandfathered，"no-NEW-references" 不溯及。另在 `isDriftBlocked` export（≈:421）上方加一行 `// ENFORCEMENT-READ (D-A3): consumed by execution_gate preflight; behavior frozen, byte-level regression under Hard Gate 1`。
- **`learning_pipeline_v0_runner.mjs`（false-Interface 闭合，LD-03）**：header 须显式声明其 **exported Interface `runLearningPipeline()`（L68，非仅 CLI main）** 属退役面——"no NEW code 可 import 或 invoke runLearningPipeline；它 execSync 串接退役的 pattern_detector_v0 → policy_crystallizer_v0 → promotion_v0，不得当作 live learning Interface"。标全 4 件（非 2 件）才闭合 D-08 false-Interface residue；半标态（内层标、runner export 不标）**禁用**。
- **`promotion_v0.mjs`（OQ-3 + AC-01 注释，annotate-only）**：superseded header 另注两点——(a) OQ-3：legacy best-effort trail `state/runtime/learning/promotion_log.jsonl`（gitignored 未跟踪）**留在原处作历史证据，未迁移 per D-A4**，live policy-lifecycle SoT = GHL append-only JSONL 链；(b) AC-01：`logPromotion`（def L93 / appendFileSync L101）与 `movePolicy`（def L107 / renameSync L114）**非 co-located**，move（call L250）先于后置且 try/catch 吞错的 logPromotion（call L291，catch L290-294）→ best-effort logging gap。**仅注释记录此 gap，禁 re-order / 禁去 swallow**（皆 behavior change + D-A4 禁镀金 superseded code；真修延 GHL 2b/2c）。

### D-2 — 4 文件 enforcement 重分类注释（enforcement primitive, not learning lifecycle）
`src/governance/learning/execution_gate.mjs` + 三处 kill_switch：`src/governance/learning/kill_switch.mjs`（ENV `LIYE_KILL_SWITCH`）+ `.claude/scripts/proactive/kill_switch.mjs`（ENV `EXECUTE_LIMITED_ENABLED`，消费者 execute_limited_gate/generate_pr_evidence）+ `src/runtime/execution/kill_switch.mjs`（ENV `KILL_SWITCH`）。文件头 JSDoc 重分类注释，零执行分支触碰（EB-04：4 文件零预存 marker，机制干净）。

- **runtime kill_switch attestation 精确化（EB-02，修正过往「活生产链/最高风险」措辞）**：`checkKillSwitch` 仅经 `write_gate.mjs:384 checkWriteGateP6C` 调用，checkWriteGateP6C 当前唯一消费者 = `test_write_gate_p6c.mjs`（CI-wired reasoning-assets-gate.yml:65）；真实 feishu 链（`feishu_actions.mjs:39 → real_executor.mjs:166`）用 plain `checkWriteGate`，**不**调 runtime kill_switch。措辞改 **「P6C supervised-write gate path（当前 test-exercised），not default feishu path」**；reclassify-only header 无法改其 ENV-driven 纯函数行为。

### D-3 — test_week3_tier_drift_kill.mjs legacy 标记（**PER-CASE**）
`tests/governance/test_week3_tier_drift_kill.mjs` 是**混合套件**。legacy marker（`// [LEGACY — superseded lifecycle authority per ADR D-A6/D-A2]`）**只加在 superseded 用例上方**：Test 4（deterministic）/ Test 5（promotion）/ Test 6（no_promotion）= tier_manager；Test 7（drift）/ Test 8（false_positive）= drift_monitor active path。**Test 1（validator fail-closed）/ Test 3（kill_switch WRITE_LIMITED deny）禁标**——它们验 D-A1 STAYING enforcement primitive，whole-suite 标记会谎标 enforcement、违 D-A1、重引本 ceremony 要消除的 authority-blur。机制 = **comment-ABOVE-case only，test-name 串冻结**（守 `execution-tiers-gate.yml:100-114` 的 8-token grep presence check，改 test-name 串会丢 grep token 触发 CI WARNING）。**whole-suite 标记禁用**。

### D-4 — hardhook CI-wire（**BLOCKING**，D-A6）
`tests/governance/test_execution_gate_hardhook.mjs` 当前 manual-only（.github/ + package.json 零引用实证），它保护 write_executor→execution_gate 边（Hard Gate 1 所依赖）。wire 为 **BLOCKING** step 进 `execution-tiers-gate.yml` governance-tests job（:95，与 week3 同处）：`node tests/governance/test_execution_gate_hardhook.mjs`，**无 `|| true`**——红即 fail job。smoke wire（`|| true`，如 :145-155 的 integration smoke）会令 Hard Gate 1 字节回归证据变 theater，**禁用**。

### D-5 — `tier_manager_approval` token 处置（**Option 2 = 扩 validator + 删 token，须 D-09**）
no-op 实证（GT-01，活跑 token 在/双删/半删/注入垃圾恒 EXIT 0）：`validate-execution-tiers.mjs` validate() 6 段（version/required-tiers/tier-fields/execute-limited-safety+no-write/default-tier/kill-switch-integration）**零解析 `config.transitions`/`.requires`**，token inert。**禁以该 inert validator 作处置门**。

**Option 2（operator-preferred，coupled，同 PR）**：
1. **扩** `validate-execution-tiers.mjs` 加 `validateTransitionTokens()`：walk 每个 `transitions[].requires` entry，对不在 **live-token allowlist** `{criteria_met, operator_explicit_approval, drift_detected, operator_request, consecutive_failures, kill_switch_active, drift_critical}`（真 yaml 全枚举，GT-02）的 orphan token **fail-closed（errorCount++ → exit 1）**。
2. **删** `execution_tiers.yaml:95/:102` 的 `tier_manager_approval`（唯一 orphan，GT-06：8 token 7 live + 1 orphan）。
3. **耦合不可分**（实测 GT-02）：留 token + walk → errorCount=2/EXIT 1 破门；删 token + walk → 0/EXIT 0 过门。`execution-tiers-gate.yml` 已 path-trigger 两文件 → 单 PR CI 实跑该耦合。
4. **LIVE-PATH 0 影响**（GT-04）：execution_gate 读 `tiers[currentTier]`（:173）非 transitions；tier_manager（休眠）读 `tiers[].promotion_criteria`（:366）非 transitions/requires → token 无任何运行时执行者，删它各路径 inert，Hard Gate 1（preflightCheck 字节回归）不受影响。
5. **gate 计数 0 变化**（GT-05）：validate-contracts schemaFiles 计数 = **21**（独立 validator/workflow），扩 execution-tiers validator 零 schemaFiles entry。
6. **D-09 授权**（GT-03 + L4-01）：步骤 1-2 = code+config 改动超 Hard Gate 4，ADR Hard Gate 4 + Risk Register 显式点名「token 删除影响 config 校验」须 Decision Log 增补 → 同 PR 在 D-08 后 **append D-09**（成稿见 `CEREMONY-RECORD.md`；append-only，D-01..D-08 字节不变，**非新 ADR**）。

> **D-A3 = DELETE 规则澄清（critic）**：「MARK 有 live surface 的，DELETE 纯 dead data」。token inert 无执行者，DEAD-CONFIG 注释反会令 orphan 触发新 fail-closed walk。**唯一 D-09** = token-delete + validator-extend；6-file 标记 + DEP-03/AC-04/AC-01 全在 Hard Gate 4 内零 D-09（Lens1 no-D-09 / Lens3 yes-D-09 scope-disjoint）。

### D-6 — GHL backlog 条目落档（R-3a，单 PR 内）
自动降级 + 漂移冻结 + sandbox→candidate 概念 → GHL 2b/2c 候选条目，附 v0/v0.1 file:line 指针 + 已知缺陷清单：drift_monitor 降级方向硬编码 ACOS-shaped（:168-170）；run_id 含 policy_id 子串松匹配 `f.run_id?.includes(policyId)`（:127-128）+ 同模式 tier_manager.mjs:139；crystallizer_v0:78 三权重 0.2/0.3/0.5 与 GHL SSOT 4 权重分叉；promotion_v0 best-effort logging gap（AC-01）。消费/重生（R-3b）归 GHL 2b/2c 各自 ceremony，**不在本 PR**。

### D-7 — 字节级回归证据（Hard Gate 1）+ 三 kill_switch per-impl 证据表（EB-03）
write_executor → execution_gate `preflightCheck` 字节级回归 + 三处 kill_switch 消费者行为不变。**per-impl 证据表**（消除 Hard Gate 1 三 leg 不对称）：

| enforcement primitive | Hard Gate 1 证据 | CI 状态 |
|-----------------------|------------------|---------|
| execution_gate preflight + governance kill_switch | `test_execution_gate_hardhook.mjs`（executeWithGate→preflightCheck，断 kill_switch/tier/quarantine deny + receipts）绿 | 本 PR D-4 CI-wire（原 manual-only） |
| runtime kill_switch（KILL_SWITCH） | `test_kill_switch.mjs` + `test_write_gate_p6c.mjs` 绿 | 已 CI-wired（reasoning-assets-gate.yml:62/65），无需新 wire |
| proactive kill_switch（EXECUTE_LIMITED_ENABLED） | 点名具体断言：ENV-precedence-over-config + default-disabled（`isExecuteLimitedEnabled`）；若选 generate_pr_evidence self-check 作证须确认 CI-run，否则加最小命名回归测试（comment/test-marking scope，Hard Gate 4 内） | 本 PR 确认/补 |

Hard Gate 1 PASS = 三命名测试全绿 + write_executor preflight diff = 注释级。

---

## Hard Gates（继承 ADR，EVO-C 期生效）
1. write_executor preflight 行为 **0 变化**（字节回归）；**三处 kill_switch 消费者行为 0 变化**（含 runtime/execution 经 P6C gate 路径，EB-02 精确措辞）。
2. GHL frozen 锚点全清单 **0-diff**（File-B `.claude/scripts/learning/heartbeat_runner.mjs` `54944884` 等；RF-04 实测 6 锚 0-diff）。
3. gate 计数 **0 变化**（contracts schemaFiles 维持 **21**；D-5 扩 execution-tiers validator 是 validator-logic 非 schema 注册，GT-05）。
4. 改动面 = 注释/文档/测试标记 + CI-wire（hardhook BLOCKING）+ **D-5 Option 2（validator-extend + token-delete，已 D-09 授权）**；其余超出须回 ADR 增补 Decision Log。

## Entry criteria（全部满足）
1. **✅ ADR Status == Accepted + cooling 已过**（Accepted-Date 2026-06-12；post-Accept cooling 2026-06-13 16:31:39 CST 已流逝；#165/#166/#167 全 merged，main `7b3a7f7`）。
2. **✅ reverse-dep 重扫 SATISFIED**（D-08 @0a4f7e7 + 本 ceremony Lens-5 @7b3a7f7 复confirm：delta `0a4f7e7..7b3a7f7` = doc-only #167，6 superseded 模块零新外部 importer，GHL frozen 0-diff，三层零交叉成立，criterion-2 SATISFIED）。
3. **✅ 3 DEFER_TO_EVO_C 已 fold 入本 v1.0 DoD**（见下）。

## DoD（v1.0）
- [ ] **D-1 6 文件** superseded 标记落地，diff 仅注释行；drift_monitor surface-scoped 单一 header + isDriftBlocked ENFORCEMENT-READ 行；runner `runLearningPipeline` export 标记；promotion_v0 OQ-3 + AC-01 注释（annotate-only）
- [ ] **D-2 4 文件** enforcement 重分类注释；runtime kill_switch attestation 用 EB-02 精确措辞
- [ ] **D-3 PER-CASE**：Test 4/5/6 + 7/8 标 legacy，Test 1/3 禁标，test-name 串冻结（grep-token check 绿）
- [ ] **D-4** hardhook wire 为 **BLOCKING** step（execution-tiers-gate.yml :95，无 `|| true`）
- [ ] **D-5 Option 2**：扩 `validateTransitionTokens()` + 删 token（:95/:102）同 PR 耦合；**append D-09**；活跑 walk-no-token EXIT 0 / 留 token EXIT 1 实证；contracts gate 维持 21
- [ ] **D-6** GHL backlog 条目可被 GHL 2b/2c SPEC ceremony 直接引用（含 file:line + 缺陷清单）
- [ ] **D-7** write_executor + 三 kill_switch 字节级回归（per-impl 证据表三 leg 全绿）
- [ ] **DEP-03**（DEFER）：`policy_lifecycle_event_v1.schema.yaml:70` prose「(e.g. system:tier_manager)」标 known non-consumer（description 块内 prose，非 :66 pattern，validation-neutral，sealed sha256 不变）
- [ ] **AC-04**（DEFER）：`docs/runbooks/week3-tier-drift-kill.md` live（非 `--dry-run`）命令（≈:49 tier_manager / ≈:70 drift_monitor）上方加弃用 banner：
  > ⚠️ SUPERSEDED (ADR-Learning-Stack-Generations D-A2/D-A6): tier_manager / drift_monitor 不再是 policy promotion/demotion 权威。这些 live 命令执行**破坏性** artifact 移动且**无** policy_lifecycle_event 审计。生产环境**禁运**；GHL（ADR-GHL 2b/2c）是唯一 policy-lifecycle 权威。
- [ ] **AC-01**（DEFER）：promotion_v0 best-effort logging gap 注释（D-1 内，annotate-only）
- [ ] 全量测试绿 + GHL frozen 0-diff 清单 + 三源 gate（BGHS / contracts-21 / execution-tiers）实证
- [ ] **D-09** 已 append 在 ADR Decision Log D-08 之后（D-01..D-08 字节不变核验）

## IMPL 注意（hygiene）
- **RF-05 stale path**：evaluator 真实路径 = `src/reasoning/policy_trial_evaluator.mjs`（**非** `src/governance/learning/`），blob `3f9ad911`；任何 grep/锚定用真实路径，勿用 governance 路径串。
- 锚点和解（行号仅指针，机制 binding）：promotion_v0 引 def-site L114/L101；drift_monitor 单一合并 header（LD-02 base + EB-01 inline marker），**禁双标**。
