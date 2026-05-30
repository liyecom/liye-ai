# Phase 1d SPEC v1.0 — liye_os `heartbeat_runner.mjs` v2（control-plane state manager）

**Status**: APPROVED-PENDING（user 6-fork 裁决 + Issue-1=R1 + ★1-4 confirm 2026-05-30；v0.1 → v1.0 incorporating OPEN-A/B/C/D/E/F + N 裁决 + 4-lens adversarial red-team（18 fix folded）+ ground-truth verification）
**Scope**: liye_os 单边 — 把 `.claude/scripts/learning/heartbeat_runner.mjs`（File A，learning 域）**整体重写**为 v2 **control-plane state manager**：消费 frozen 0b `heartbeat_state_v2.schema.yaml`，派生 9-phase `current_phase`、6 invalid-combo + Pilot-1 ceiling fail-closed、runtime-owned 校验、首启 `evaluating_metrics_only` posture（trial_write_enabled=false，Hard Gate 7）。**不 orchestrate pipeline、不调用 evaluator**（控制面 only）。observability-only（Hard Gate 8），单边（0 AGE / 0 loamwise / 0 frozen schema 修改 / 0 evaluator 调用）。
**Out of scope**: →`trialing` flip 执行 · `trial_history` 回写（F3）· confidence verdict（F2）· evaluator-side 二次门 · auto-rollback · pipeline orchestration · cost_meter 再接入 · pre-commit hook（全部 Phase 2a）· `metrics_daily.jsonl` 产出（Phase 1e）· flip `learning_sources.yaml` enabled（独立 0d 改动，R1 下非必需）· `scripts/heartbeat_runner.mjs`（File B / S1 execution-gate 域）
**Drafted**: 2026-05-30
**Anchor for implementation**: 本文件是 Phase 1d 实施指令包的 normative input；实施时 SPEC 锁版本（file blob SHA），禁止悄改。

---

## §0 Normative Anchors

| Tier | Source | 锁定内容 |
|---|---|---|
| N-1 | `GHL-evolution-plan-v4.1.md` §3（Phase 1d row, L135） | deliverable = heartbeat v2 升级 7 字段 + derived `current_phase` + invalid combination fail-closed + runtime-owned 校验；首启 `evaluator_enabled=true / trial_write_enabled=false / current_phase=evaluating_metrics_only` 7–14 天。前序 = 1c |
| N-1 | 同上 §7.3（9-phase 决策表 · invalid-combos） | 9-phase 优先级短路决策表 + 6 条 invalid combination（fail-closed exit≠0，**不**自动修正） |
| N-1 | 同上 §2 Hard Gate 7/8 + §8 D-05/D-06/D-07/P-03 | Gate 7 首启 dry_run；Gate 8 Pilot 1 无 production_write；D-05 evaluator+writer 先(1c)→heartbeat dry_run(1d)；D-06 7 旗；D-07 soft-fail→`paused_no_active_source`；P-03 runtime-owned 元字段来源 |
| N-2 | `GHL-v4.1-errata.md` I-04 | **phase enum = 9（非 8）**，binding 修正；统一表述 `current_phase: 9 phases enum` |
| N-2 | `GHL-v4.1-errata-v2.md` EV2-I-03 | `heartbeat_state_v2.schema.yaml` 是 **Phase 0b** artifact（file #9）→ 1d 消费 schema、**不** author/改 frozen schema |
| **契约 (INPUT, frozen 0b)** | `_meta/contracts/learning/heartbeat_state_v2.schema.yaml`（`additionalProperties:false`，16 required，6 `allOf` invalid-combo，`_runtime_owned_fields` const，9-enum `current_phase` property） | 1d 的**实施基线 SoT**；Hard NO 修改。所有 16-key / additionalProperties:false 约束为硬约束（引用按 property-name 锚，非脆性行号；lock 时按 blob SHA 复核） |
| **契约 (OUTPUT, NEW 1d)** | `_meta/contracts/learning/heartbeat_phase_transition_v1.schema.yaml`（1d 子交付，新建；须在 `validate-contracts.mjs` schemaFiles 注册才被 gate 校验，§0.1-9） | phase-transition log entry 形状；window-age 机器可读 forward contract（2a flip predicate 复用） |
| **registry (INPUT, 0d)** | `.claude/config/learning_sources.yaml`（AGE 唯一源，`enabled:false`；**L50 "registry presence-only check"**） | source presence 判据（§1.3 active count）；1d **不读不改**（R1 下用 template seed） |
| **CODE-SSOT (read-only, NOT wired)** | 1c `src/reasoning/policy_trial_evaluator.mjs` blob `257cc0fe` @ main `85c00c5` | evaluator 默认 dry_run、唯一写门 `ctx.mode==='live'`；1d **不调用**，仅作 advisory 鉴权链参照 |
| 现状 | `.claude/scripts/learning/heartbeat_runner.mjs`（File A，692 行） | docblock 自称 "v2.0.0" 但实现为**纯 v1**（`version:1` state、0/7 旗、无 phase 派生、无 schema 校验、无 runtime-owned guard）→ greenfield 重写 |

**冲突优先级**：CODE-SSOT（frozen schema）> N-2 > N-1 > 现状描述。

### §0.1 ⚠ CODE/SCHEMA-AUTHORITATIVE 关键前提（对抗分析 + 红队 + 裁决派生）

1. **phase enum = 9 不是 8**（errata-v1 I-04 binding）。baseline 散文 "8 phase"/P-03 "扩展到 8 种" 已被 I-04 覆盖。一律 9。
2. **"7 字段"≠ 16 required key**（D2）。"7 字段" = 7 控制旗（`enabled`/`evaluator_enabled`/`trial_write_enabled`/`candidate_write_enabled`/`promotion_enabled`/`production_write_enabled` 6 bool + `candidate_write_target_status` 1 enum）；schema `required` = **16 key = 7 旗 + 4 registry + `version` + `_runtime_owned_fields`（const-array meta-key 自身）+ 3 runtime-owned 字段（`current_phase`/`current_phase_derived_at`/`last_run_at`）**。SPEC 表述「7 控制旗序列化进 16-key required 对象」，禁写 "7 required fields"。
3. **v1 runner 实为 v1**（docblock "v2.0.0" 指 dual-switch+cost_meter 那代）。1d 是**整体重写 ≈ 350–400 行**（v1 692 行 − learning_pipeline orchestration − cost_meter 接入，二者 defer 2a）。
4. **frozen schema `additionalProperties:false` 是硬约束**（schema=0b，Hard NO 改）。⇒ 任何非 16-key 字段都不能进 live state file：v1 工作字段、window-anchor、`evaluator_invocation_mode_advisory` 全部只能落 sidecar（§1.2/§1.6）。不可松绑 schema。
5. **live-state 路径 `proactive/`→`learning/`**（裁决 A7）。frozen schema header `落点: proactive/...` 是**非 normative 注释**（校验 shape 不校验 path）。1d live state 落 `state/runtime/learning/`（与 1c `policy_trials.jsonl` 同目录，红队证实该目录已被 `.gitignore:330 state/runtime/learning/` **目录级全忽略**）。**派生收益**：新路径=fresh bootstrap，**绕开 in-place v1→v2 migration**——旧 `proactive/` v1 文件 dormant 留存不迁；cursor sidecar **seed 为 inert 默认值（无 v1 读）**。schema 注释 stale → 上游 0b doc-fix（§9-N1）。
6. **Pilot-1 ceiling 是 RUNNER-enforced，且 1d-era**（裁决 C 派生）。frozen schema 的 6 invalid-combo（`allOf` block）**允许** `trial_write_enabled=true`（那是 2a flip→trialing）。1d「4 escalation 旗锁 false」ceiling 是 runner 代码、**叠加**于 6 schema-combo，且 phase-versioned（2a 改 runner 放开 trial_write）。唯一 Pilot-1-**wide** 锁 = `production_write_enabled=false`（Hard Gate 8）。见 §1.5。
7. **"runtime-owned 校验" = runner-side enforcement，pre-commit hook defer 2a（裁决 E，偏离披露升级）**。⚠ "pre-commit hook MUST reject diff" 不仅是 P-03 字面，**frozen schema 自身**（header 注释 + `_runtime_owned_fields` property description）也 normative 写了此 MUST——而 frozen schema 在本 SPEC 冲突链 **top-tier**。本 SPEC 偏离的是**最高权威 artifact 的内嵌 MUST**，特此显式披露（非仅 P-03）。justify：(a) schema 的注释/description 是**非可执行散文**，ajv 只 enforce shape 不 enforce 注释（与 §9-N1 路径注释 carve-out 同基）；(b) live state **gitignored**（`.gitignore:330`），**无版本化 diff 面** → schema 的 "hook MUST reject diff" **vacuously 满足**。schema description staleness 并入 §9-N1 上游 0b doc-fix bucket。「runtime-owned 校验」由 runner enforce：3 个 runtime-owned 字段只由 runtime 计算、绝不从 template/config/env 读入。
8. **forbidden-name = 一行注解，非 whitelist 动作**（红队实测）。`lint_forbidden_names.sh` CORE 只在**声明/赋值/参数位的裸** `evaluator`/`trial`/`candidate`（TAIL 非词边界）触发；复合名 `LearningHeartbeatRunner` / `deriveCurrentPhase` / `evaluator_invocation_mode_advisory`（`evaluator` 后接 `_` 词字符，TAIL fail）/ `getPhaseWindowAge` 实测 **0 命中**。无需配置 whitelist；只需不写裸名。
9. **in-scope editable 非-File-A 文件（红队逼出，user 确认）**：1d IMPL **允许编辑** `.github/workflows/ci.yml`（移除/迁移 `heartbeat-switch-test` job，§1.7/§7）+ `_meta/contracts/scripts/validate-contracts.mjs`（注册新 transition schema 进 schemaFiles，§7）。二者**非** frozen / 非 Hard-NO；但**非** learning-域 File A，故在此显式 carve-in 防 IMPL 误判 out-of-scope。

---

## §1 9-Item Contract Surface

### 1) CLI / API Contract

**Module location** = `.claude/scripts/learning/heartbeat_runner.mjs`（File A 整体重写；learning 域，与 `import_facts.mjs`/`discover_new_runs.mjs` 同目录同风格）。

**导出**：`LearningHeartbeatRunner`（class）+ `runHeartbeat(options)` + `deriveCurrentPhase(flags)` + `validateHeartbeatState(state)` + `getPhaseWindowAge(transitionsPath)`。forbidden-name：用复合名（§0.1-8），禁裸 `evaluator`/`trial`/`candidate`。

```
node .claude/scripts/learning/heartbeat_runner.mjs \
    [--dry-run]      # control-plane rehearsal：derive+validate+report，0 落盘（≠ 系统 dry_run posture）
    [--fixtures DIR] # 测试 seam：注入 rootDir，隔离 state/sidecar/transitions/lock
    [--json]         # 打印 HeartbeatRunReport JSON
    [--help]
# env: LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1  首启确认门（state file 不存在时必需，否则 refuse + exit 2）
#      LIYE_HEARTBEAT_ENABLED={true,false}  保留的 ENV override（仅 enabled，紧急/operator 控制，ENV>state）
```

**⚠ 两个 "dry_run" 语义隔离**（裁决 N / D-05）：
- **系统 dry_run posture**（Hard Gate 7）= `trial_write_enabled=false` → `current_phase=evaluating_metrics_only`。1d 内**恒 false**，是 control-plane 状态、非 CLI flag。
- **`--dry-run` CLI flag** = runner 自身**不持久化**（derive+validate+report 但不写 state/transition/sidecar）的 rehearsal。默认（无 flag）= 正常运行 = 写 live state + append transition（runner 本职=管状态）。

**Exit code 语义**:

| Code | 名称 | 触发 |
|---|---|---|
| 0 | SUCCESS | 加载/派生/校验通过；state 已持久化（或 `--dry-run` 已 report） |
| 2 | FAIL_CLOSED | (a) live state schema-invalid; (b) 命中 6 invalid-combo; (c) 命中 Pilot-1 ceiling; (d) 首启缺 `LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1`。**不自动修正、不写半成品 state**。⚠ **exit 2 过载**：(d) bootstrap-unconfirmed 是良性"待确认"非危险态——consumer 须读 `report.fail_closed.kind` 区分 `bootstrap_unconfirmed` vs `schema`/`invalid_combo`/`ceiling`（§4 断言 kind） |
| 1 | UNEXPECTED | 其他异常（template 缺失/损坏、I/O、lock 争用超时） |

**Node API**:

```js
import { runHeartbeat } from "./heartbeat_runner.mjs";
const report = runHeartbeat({ dryRun: false, rootDir: undefined /* prod */, bootstrapConfirm: false });
```

**HeartbeatRunReport**（审计用；**非** live state——含 schema-外字段）:

```js
{
  mode: "persist" | "rehearse",            // ← --dry-run 决定；非系统 dry_run
  current_phase: "evaluating_metrics_only",
  current_phase_derived_at: "<iso8601+tz>",
  phase_window_age_seconds: 0,             // = now − 建立【当前 phase】首条连续 transition 的 transition_at（§1.8 单一定义）
  flags: { enabled, evaluator_enabled, trial_write_enabled, candidate_write_enabled,
           candidate_write_target_status, promotion_enabled, production_write_enabled },
  fail_closed: { kind: null | "schema" | "invalid_combo" | "ceiling" | "bootstrap_unconfirmed", detail },
  evaluator_invocation_mode_advisory: "dry_run",  // ← advisory only（落 cursor sidecar，非 live state；§1.6）
  transition_appended: false,
  last_run_at: "<iso8601+tz>"
}
```

### 2) State Source / Bootstrap — 三层模型（裁决 A）

| 层 | 路径 | git | 校验 | 内容 |
|---|---|---|---|---|
| **bootstrap template** | `_meta/contracts/learning/heartbeat_state_v2.bootstrap.json` | **committed**（immutable posture template） | runner-side required-key 检查（template = **11 config key**，缺 5 个 schema-required：`version`+`_runtime_owned_fields`+3 runtime-owned，故**不可**整体过 v2 schema；§9-N4）；红队 H：runner self-test 须加载**已提交** template 断言 posture（CI 内捕 drift） | 7 旗 + 4 registry（`source_allowlist:["amazon-growth-engine"]` / `max_trials_per_day` / `kill_switch_required:true` / `cooldown_minutes:30`） |
| **live state** | `state/runtime/learning/heartbeat_learning_state.json` | **gitignored**（`.gitignore:330 state/runtime/learning/` 目录级已覆盖；**无需加条目**） | **v2 schema（ajv，full 16-key + additionalProperties:false + 6 allOf）** | 完整 16-key v2 state |
| **cursor sidecar** | `state/runtime/learning/heartbeat_learning_runtime.json` | gitignored（同 L330） | 无（schema-外运行游标） | **seed 为 inert 默认值**：`notify_policy`(default) / `last_window_end:null` / `last_processed_run_id:null` / `bundle:<null-shape>`。**无 v1 读**（新路径 fresh bootstrap，旧 proactive/ 不迁）；1d inert（不跑 discover/pipeline/bundle） |
| **lock** | `state/runtime/learning/heartbeat.lock` | gitignored（同 L330） | — | O_EXCL 文件=锁（替代 v1 `lock:{}` 对象） |
| **phase-transition log** | `state/runtime/learning/heartbeat_phase_transitions.jsonl` | gitignored（同 L330） | `heartbeat_phase_transition_v1.schema.yaml`（逐行） | §1.8 |

**Bootstrap flow**（first boot，live state 不存在）：
1. 校验 `LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1`，缺则 stderr warning + exit 2（`fail_closed.kind="bootstrap_unconfirmed"`；裁决 N：env-gate 替代 paused 中间态）。
2. 读 bootstrap template（7 旗 + registry，含 `source_allowlist:["amazon-growth-engine"]`）。
3. `deriveCurrentPhase()` → **default seed 下 active count = `source_allowlist.length` = 1 ≥1**（presence-based，§1.3）→ row 4 → `evaluating_metrics_only`。
4. 组装完整 16-key state（template config + runtime-owned: `current_phase`=派生值 / `current_phase_derived_at`=now / `last_run_at`=now / `_runtime_owned_fields`=const / `version`=2）。
5. ajv 校验完整 state vs frozen v2 schema → 通过才写 live state。
6. append bootstrap transition entry，**`to` = 步骤 3 实际派生的 phase（非硬编码）**——default seed 下 = `{from:null, to:"evaluating_metrics_only", reason:"bootstrap", actor:"runtime"}` = 窗口起点；若 operator 给空 allowlist 则 = `to:"paused_no_active_source"`（此时 evaluating_metrics_only 窗口尚未建立，`getPhaseWindowAge()` 对该 phase 返回 null）。

**后续 run**：load → ajv 校验 → 6-combo + ceiling 检查 → `deriveCurrentPhase()` → 若 phase 变更则 append transition → 更新 runtime-owned 字段 → 写 live state。`--dry-run` 跳过"写/append"。

### 3) 7-Flag Specification — L1 五元组（裁决 L1）

| flag | source | default（first-boot posture） | owner | mutator |
|---|---|---|---|---|
| `enabled` | template → live state | `true` | operator | operator + ENV override `LIYE_HEARTBEAT_ENABLED`（紧急，ENV>state） |
| `evaluator_enabled` | template → live | `true` | operator | operator |
| `trial_write_enabled` | template → live | `false` | operator | operator（**2a** flip）；**1d ceiling 锁 false** |
| `candidate_write_enabled` | template → live | `false` | operator | **1d ceiling 锁 false**（2b/2c） |
| `candidate_write_target_status` | template → live | `sandbox` | operator | operator |
| `promotion_enabled` | template → live | `false` | operator | **1d ceiling 锁 false**（Phase 3） |
| `production_write_enabled` | template → live | `false` | operator | **Hard Gate 8 锁 false**（Phase 4，Pilot-1-wide） |

registry（required，非"旗"）：`source_allowlist`（template seed `["amazon-growth-engine"]`；**active count = `source_allowlist.length`**，presence-based per `learning_sources.yaml` L50 "registry presence-only check"——registry 的 `enabled:false` 是 AGE-emit/manifest gate，**与 heartbeat allowlist presence 正交**，1d 不读 registry）、`max_trials_per_day`（1d inert）、`kill_switch_required`=`true`、`cooldown_minutes`=`30`。

**first-boot posture**（baseline L135）：`enabled=true ∧ evaluator_enabled=true ∧ trial_write_enabled=false ∧ source_allowlist.length≥1 ∧ (escalation 旗 false)` → row 4 → `evaluating_metrics_only`，满足 Hard Gate 7（trial_write_enabled=false）。

### 4) Derived `current_phase` — 全 9-phase 决策表（裁决 C）

`current_phase` = **runtime-owned derived**（schema `current_phase` property；runner 每次启动重算，operator/config 不可直接写）。实现**完整 9 行**（数据映射、非逻辑分支）。优先级短路：

| # | 条件（顺序短路） | current_phase | 1d 可达? |
|---|---|---|---|
| 1 | `enabled=false` | `paused` | ✅（须同时清零 eval/write 旗，否则 combo#6，见 §1.8） |
| 2 | `source_allowlist.length = 0` | `paused_no_active_source` | ✅（仅 operator 清空 allowlist 才达；default seed≥1） |
| 3 | `evaluator_enabled=false` | `ingesting_only` | ✅ |
| 4 | `evaluator_enabled=true ∧ trial_write_enabled=false` | `evaluating_metrics_only` | ✅（首启 posture） |
| 5 | `trial_write_enabled=true ∧ candidate_write_enabled=false` | `trialing` | ⛔ ceiling-blocked（2a） |
| 6 | `candidate_write_enabled=true ∧ target=sandbox ∧ promotion=false` | `candidate_writing_sandbox` | ⛔（2b） |
| 7 | `candidate_write_enabled=true ∧ target=candidate ∧ promotion=false` | `candidate_writing` | ⛔（2c） |
| 8 | `promotion_enabled=true ∧ production_write_enabled=false` | `promoting` | ⛔（3） |
| 9 | `production_write_enabled=true` | `executing_limited` | ⛔（4，Hard Gate 8） |

`current_phase_derived_at`（runtime-owned）= 本次派生 ISO8601+tz。**1d-reachable 集** = {paused, paused_no_active_source, ingesting_only, evaluating_metrics_only}（row 5-9 被 §1.5 ceiling 在到达前 fail-closed）。

### 5) Invalid-Combination + Pilot-1 Ceiling — fail-closed（§0.1-6）

**两层正交、均 fail-closed exit 2、均不自动修正**：

**Layer-A — 6 schema invalid-combo（ajv，frozen schema `allOf` block）**：
1. `production_write=true ∧ promotion=false` → invalid
2. `promotion=true ∧ candidate_write=false` → invalid
3. `candidate_write=false ∧ candidate_write_target_status=candidate` → invalid
4. `trial_write=true ∧ evaluator_enabled=false` → invalid
5. `trial_write=false ∧ candidate_write=true` → invalid
6. `enabled=false ∧ (任一 write/eval 旗 true)` → invalid

**Layer-B — Pilot-1/1d ceiling（RUNNER 代码，叠加于 Layer-A；schema 允许 trial_write=true 故必须 code-side）**：
- **1d-era ceiling**：`trial_write_enabled` / `candidate_write_enabled` / `promotion_enabled` / `production_write_enabled` **任一 = true → fail-closed**（`kind="ceiling"`）。⚠ 2a 改 runner 放开 `trial_write_enabled`（phase-versioned）。
- **Pilot-1-wide 锁**（Hard Gate 8，永锁）：`production_write_enabled=true` → fail-closed。

fail-closed 行为：stderr `{kind, offending_flags, detail}`，exit 2，**不写 live state、不 append transition**（拒绝即冻结）。

### 6) Dry-run Guarantee + Auth Chain（L3，裁决 B = NOT wire）

**1d runner 不 spawn/import evaluator**（裁决 B）。runner = 纯 control-plane 状态管理器；evaluator 调用 + pipeline orchestration = 1e/2a。

**no-trial-write 保证链**（1d 内恒成立）：1d ceiling 锁 `trial_write_enabled=false` → 系统恒 `evaluating_metrics_only` → 无组件被授权写 `policy_trials.jsonl`。frozen 1c evaluator 默认 dry_run + 唯一写门 `ctx.mode==='live'`（blob `257cc0fe`）；1d **不递 'live'**（不调用），vacuously 成立。

**advisory seam（forward）**：runner 在 **cursor sidecar**（非 live state，additionalProperties:false 拒）写 `evaluator_invocation_mode_advisory: "dry_run"`。**advisory only，非契约**，为 1e/2a wiring 留 seam。

**二次门 = 2a**：evaluator-intrinsic gate（evaluator 读 heartbeat state）须解冻 evaluator → Phase 2a。1d 显式记残留风险：CLI `policy_trial_evaluator.mjs --mode live` 是 operator-authorized bypass，1d 不 fence（§6）。

### 7) v2/v1 兼容 + 测试存量（L4，裁决 A 派生）

- **无 in-place migration**（§0.1-5）：v2 走新路径 `learning/` + fresh bootstrap；旧 `proactive/` v1 文件 dormant 留存不读不迁；cursor sidecar **seed inert 默认值**（§1.2）。
- **cursor sidecar 字段 explicit enumerate**（裁决 A，禁无界扩展）：`notify_policy` / `last_window_end` / `last_processed_run_id` / `bundle` 四项；`lock` → 独立 `heartbeat.lock`。1d 内 inert。
- **v1 测试存量 retire + ci.yml 编辑（红队 H，必须）**：`tests/test_heartbeat_learning_runner.mjs`（5）+ `tests/test_dual_switch_heartbeat.mjs`（6）全 v1-shaped → v2 strict-load 全 invalid → **retire**。⚠ `.github/workflows/ci.yml` 的 `heartbeat-switch-test` job（L116/132/136）硬跑 `node tests/test_dual_switch_heartbeat.mjs` 并写 `state/runtime/proactive/heartbeat_learning_state.json`——retire 后该 job 找不到文件破 CI。**IMPL 必须编辑 `ci.yml` 移除/迁移该 job**（§0.1-9 in-scope；§7 C4）。保留语义（ENV override on `enabled` / kill-switch）在新套以 v2 fixture 重写。
- **新测试套** = `tests/test_heartbeat_v2_runner.mjs`（**prefix 命名、无 `.test.` infix** → vitest 默认 include `*.{test,spec}.mjs` 不收集，故**无需** vitest exclude；新 workflow 以显式 `node --test tests/test_heartbeat_v2_runner.mjs` 跑）。

### 8) Trigger Model + Phase-Transition Log（裁决 D + F）

- **Trigger** = manual / library only，**无 scheduler**。manual-trigger ⇒ 合并不触发写（裁决 N 安全根据）。
- **Phase-transition log**（裁决 D）：`state/runtime/learning/heartbeat_phase_transitions.jsonl`（append-only，gitignored）。schema = **`heartbeat_phase_transition_v1.schema.yaml`（1d 子交付）**。entry：
  ```
  {"transition_at":"<iso8601+tz>","from": null|"<phase>","to":"<phase>",
   "reason":"bootstrap|operator|operator_rollback|kill_switch","actor":"runtime|operator"}
  ```
  - **reason enum 恰 4 值**（§9-N3；§4 机器断言 `invalid_combo` 被 schema 拒）。
  - **窗口锚点 / `getPhaseWindowAge()` 单一定义**（红队 F）：返回 `now − transition_at(建立【当前 phase】的首条连续 entry)`。`evaluating_metrics_only` 窗口只是 1d-reachable 实例、**非**锚定义本身；若当前 phase 非该值（如 kill_switch→paused），返回 paused 窗口龄；当前 phase 无对应 entry 时返回 null。
  - **append 规则**：仅 phase 实际变更时 append（成功 transition）。**fail-closed（schema-invalid / invalid-combo / ceiling）不 append**（无 transition 发生，§9-N3）。
  - **rollback 必 append**（裁决 F）：graceful（trial_write true→false，**2a only，1d inert**）→ `reason:operator_rollback`；紧急 kill_switch → `reason:kill_switch`。**禁静默回滚**。⚠ **combo#6 约束（红队）**：达 `paused` / kill_switch rollback 须 `enabled=false` **且同时清零所有 eval/write 旗**，否则命中 invalid-combo #6 → exit 2 **吞掉**该 transition。kill_switch = operator 编辑 live state 后 runner 重跑（partial-flip 风险须 operator 知悉）。
- **query 契约**：`getPhaseWindowAge()` 仅 query 不 consume（flip predicate 消费 = 2a）。

### 9) Test Strategy → §4

---

## §2 Cross-Cutting Hard Constraints

| Gate | Phase 1d 应用 |
|---|---|
| **Gate 4**（Layer-2 不写 Layer-0） | ✅ 1d 全在 liye_os Layer-0 内部 |
| **Gate 6**（fact ingest 双 hash 幂等） | ✅ 不涉 |
| **Gate 7**（heartbeat 首启 dry_run） | ✅ 本质兑现：首启 posture `trial_write_enabled=false` → evaluating_metrics_only |
| **Gate 8**（Pilot 1 无 production_write） | ✅ ceiling Layer-B 锁 `production_write_enabled=false`（Pilot-1-wide） |
| **Pilot 1 invariant** | ✅ AGE `write_capability_effective: none` 全程不变 |

**禁触清单（frozen / Hard-NO）**：
- ❌ `scripts/heartbeat_runner.mjs`（**File B / S1 execution-gate**，basename 碰撞）
- ❌ `_meta/contracts/learning/heartbeat_state_v2.schema.yaml`（**frozen 0b**）
- ❌ 1a/1b/1c artifacts：`emit_fact.py` / `import_facts.mjs` / `canonical_json.mjs` / `policy_trial_evaluator.mjs` / vendored + canonical schemas / `records.jsonl` / `fact_conflicts/` / `policy_trials*`
- ❌ AGE / loamwise 任何文件
- ❌ 调用 / spawn / import `policy_trial_evaluator.mjs`（裁决 B）
- ❌ orchestrate learning_pipeline / discover_new_runs / cost_meter（defer 1e/2a）
- ❌ `trial_history` 回写 / candidate / promotion / production write / `trial_write_enabled` true flip
- ❌ launchd / cron / scheduler · flip engine_manifest enabled · amend / force-push / --no-verify / --admin / rebase

**in-scope editable（非 File-A 但非 frozen，§0.1-9）**：✅ `.github/workflows/ci.yml`（移除 heartbeat-switch-test job）· ✅ `_meta/contracts/scripts/validate-contracts.mjs`（注册新 transition schema）· ✅ 新建 `heartbeat_state_v2.bootstrap.json` + `heartbeat_phase_transition_v1.schema.yaml`。（`.gitignore` 无需改——L330 已覆盖。）

---

## §3 Phase 1d 验收标准 (DoD)

| # | Criterion | 验收方式 |
|---|---|---|
| 1 | `heartbeat_runner.mjs` v2 重写提交 | `git ls-files .claude/scripts/learning/heartbeat_runner.mjs` |
| 2 | CLI `--help` / `--json` 跑通 | `--help` exit 0；`--json` 输出 HeartbeatRunReport（§4 smoke） |
| 3 | 系统 dry_run posture 兑现（Gate 7） | 首启 → `current_phase=evaluating_metrics_only` **且** `trial_write_enabled=false`（Gate-7 真不变量是后者） |
| 4 | `--dry-run` rehearsal 0 落盘 | 不写 state/sidecar/transition/lock；幂等可重跑 |
| 5 | 全 9-phase 派生正确 | `deriveCurrentPhase()` 9 行单元（reachable e2e + future `@pilot2` unit） |
| 6 | 6 invalid-combo fail-closed | 每条 → exit 2 + 不写 state（ajv 矩阵） |
| 7 | Pilot-1 ceiling fail-closed | 4 escalation 旗任一 true → exit 2；production_write=true 必拒 |
| 8 | runtime-owned 校验 | 3 字段仅 runtime 写；template/env 注入这 3 字段被拒；**`_runtime_owned_fields` 缺失/≠const → ajv 拒** |
| 9 | live state 过 frozen v2 schema | 写前 ajv full-16-key + additionalProperties:false + 6 allOf 校验通过 |
| 10 | bootstrap 三层 + env-gate | 首启缺 `LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1` → exit 2 + `kind=bootstrap_unconfirmed`；有则写 |
| 11 | 已提交 template self-test | runner 加载**committed** `heartbeat_state_v2.bootstrap.json` → 断言 bootstrap 到 evaluating_metrics_only（catch template drift） |
| 12 | phase-transition log + 窗口锚 | bootstrap entry written（to=实际派生 phase）；`getPhaseWindowAge()` 单一定义 |
| 13 | 新 schema 提交 + **真过 contracts gate** | `git ls-files` + **在 `validate-contracts.mjs` schemaFiles 注册** + 负向测试（损坏 schema → gate 红，证非静默跳过） |
| 14 | `ci.yml` heartbeat-switch-test job 移除/迁移 | grep `ci.yml` 无 orphan 引用 retired v1 test / proactive 路径 |
| 15 | 1a/1b/1c artifacts + frozen v2 schema + File B 0 改动 | `git diff origin/main -- <列表>` 空 |
| 16 | liye_os CI green + heartbeat tests CI-wired（本 PR，A7） | GitHub PR checks（新 workflow node 18/20/22 path-trigger） |

## §4 Required Test Coverage

| 类别 | 覆盖 |
|---|---|
| 9-phase 派生（reachable） | paused / paused_no_active_source / ingesting_only / evaluating_metrics_only 端到端 |
| 9-phase 派生（future `@pilot2-reachable`） | trialing / candidate_writing_sandbox / candidate_writing / promoting / executing_limited 仅派生 unit |
| **bootstrap 空 allowlist** | `source_allowlist:[]` → `paused_no_active_source`；getPhaseWindowAge(evaluating_metrics_only)=null |
| 6 invalid-combo | 每条独立 → exit 2 + 0 state write |
| Pilot-1 ceiling | 4 escalation 旗逐一 true → exit 2；production_write 强断言 |
| runtime-owned guard | template/env 注入 3 字段 → 拒；`_runtime_owned_fields` 缺失/≠const → ajv 拒 |
| schema 校验 fail-closed | 缺 required / 多余 key / version≠2 → exit 2 |
| bootstrap env-gate | 缺/有 `LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM`；缺时 `report.fail_closed.kind==='bootstrap_unconfirmed'` |
| committed template posture | 加载已提交 `heartbeat_state_v2.bootstrap.json` → bootstrap evaluating_metrics_only |
| 窗口锚（单一定义） | bootstrap entry → getPhaseWindowAge 单调；多 run 不漂移；非 evaluating phase 返回该 phase 龄 |
| transition append/rollback | phase 变更 append；fail-closed 不 append；rollback `operator_rollback`/`kill_switch`；**reason schema enum 恰 4 值，`invalid_combo` 被拒** |
| `--dry-run` 0 落盘 | 无 state/sidecar/transition/lock 写 |
| CLI smoke | `--help` exit 0；`--json` 输出形状（背书 DoD#2） |
| 三层路径隔离 | `--fixtures` rootDir seam；live(16-key)/cursor/lock/transitions 各落各位 |
| advisory 落位断言 | `evaluator_invocation_mode_advisory` 在 sidecar、**不**在 live state（grep） |
| evaluator 零引用断言 | grep runner source：`policy_trial_evaluator` / `evaluatePolicyTrials` / spawn 0 出现 |
| contracts gate 负向 | 损坏 `heartbeat_phase_transition_v1.schema.yaml` → `validate-contracts.mjs` 红（证已注册非跳过） |

## §5 Resolved Decision Log

| ID | Decision | Rationale |
|---|---|---|
| A1 | **三层 state** + `lock` 独立 O_EXCL 文件 | 解耦 audit 与 runtime；复用 1c sealed-schema+side-car 范式；additionalProperties:false 强制 |
| A2 | **NOT wire evaluator** | "暴露 state"≠"调用 subprocess"；orchestration=1e/2a |
| A3 | **全 9-phase 派生 + Pilot-1 ceiling 在 runner 层**（正交） | enum 全列防死字段；ceiling code-side（schema 允许 trial_write=true）；2a 放开 |
| A4 | **phase-transition JSONL + `heartbeat_phase_transition_v1` schema** | 唯一非脆弱窗口锚；audit；1e 输入源；schema 化防散文漂移 |
| A5 | **不做 pre-commit hook，用 bootstrap template**（defer 2a） | 三层 git 模型闭合 audit；live gitignored 使 schema hook-MUST vacuously 满足（§0.1-7） |
| A6 | **bootstrap posture=evaluating_metrics_only + env-gate confirm** | manual-trigger only，合并不触发写；`LIYE_HEARTBEAT_BOOTSTRAP_CONFIRM=1` 替代 paused 中间态 |
| A7 | **live state 落 `state/runtime/learning/`** | 与 1c `policy_trials.jsonl` 同目录；绕开 in-place migration |
| A8 | **新测试套 prefix 命名 + 显式 `node --test`，无 vitest exclude** | prefix `test_*.mjs` 不被 vitest 默认 include 收集（红队实证）；C7 教训以命名约定替代 exclude |
| A9 | **Issue-1=R1：active count = `source_allowlist.length`（presence）** | `learning_sources.yaml` L50 "registry presence-only check"；registry `enabled` 是 AGE-emit gate、正交；honor baseline L135 首启 evaluating_metrics_only；1d 不读不改 registry |
| A10 | **ci.yml + validate-contracts.mjs in-scope editable** | retire v1 测试破 ci.yml heartbeat-switch-test job；新 schema 须注册进 validate-contracts schemaFiles 否则 gate 静默跳过（红队 H） |

## §6 Out-of-Scope（硬边界）

- `evaluating_metrics_only → trialing` flip（`trial_write_enabled` true）→ **Phase 2a**
- `trial_history` 回写（F3，`learned_policy_ghl_v1.yaml` "append-only by evaluator"）→ **Phase 2a**
- confidence verdict（F2）→ **Phase 2a** · evaluator-intrinsic 二次门 → **Phase 2a**（须解冻 evaluator）· auto-rollback → **Phase 2a**
- pipeline orchestration → **Phase 1e/2a** · cost_meter 再接入 → **Phase 2a** · pre-commit hook → **Phase 2a**
- `metrics_daily.jsonl` 产出 → **Phase 1e**
- flip `learning_sources.yaml` AGE `enabled:true`（两 gate 5-28/5-30 已met，但 R1 presence-based 下**非必需**）→ 独立 0d registry 改动
- `scripts/heartbeat_runner.mjs`（File B）→ 永不 · scheduler（launchd/cron）→ 永不在 1d
- FU-2 / F1 / errata-v3 → 不混入

## §7 Implementation Plan Skeleton（留给实施指令包 expand）

实施指令包至少覆盖（atomic commits，每个留绿 `node --test`）:
1. branch from liye_os `origin/main`（≥ `85c00c5`）
2. C1 `heartbeat_runner.mjs` v2 重写（load/bootstrap 三层 · `deriveCurrentPhase` 9 行 · ajv 校验 · 6-combo + ceiling fail-closed · runtime-owned enforce · transition append（实际派生 phase）· advisory sidecar · O_EXCL lock · getPhaseWindowAge）
3. C2 `heartbeat_state_v2.bootstrap.json`（committed template）+ `heartbeat_phase_transition_v1.schema.yaml`（新 schema）**+ 在 `_meta/contracts/scripts/validate-contracts.mjs` schemaFiles 注册新 schema**（否则 gate 静默跳过）
4. C3 `tests/test_heartbeat_v2_runner.mjs`（§4 矩阵；reachable/future 分组；committed-template self-test；contracts-gate 负向）+ **编辑 `.github/workflows/ci.yml` 移除/迁移 `heartbeat-switch-test` job**（retire v1 两套）
5. C4 CI workflow `.github/workflows/learning-heartbeat-runner-tests.yml`（A7；path-trigger runner + tests + 两 schema + validate-contracts；node 18/20/22；显式 `node --test tests/test_heartbeat_v2_runner.mjs`；node-only 零 cross-repo）
6. C5（optional）RUNBOOK §"heartbeat v2 inspect"（`--dry-run --json` 查 current_phase / window age）
7. CI 全绿 + 自检（`--help` exit 0；`--dry-run` 0 落盘；evaluator 零引用 grep；contracts-gate 负向证非跳过）
8. PR review：本 SPEC blob SHA reference + DoD checklist + Hard NO 自审
9. Merge: squash; 0 force-push; 0 admin（**user 在 GitHub UI 用 liyecom merge**，liye_os branch protection REVIEW_REQUIRED）

**禁触**：File B / frozen v2 schema / 1a-1c artifacts / AGE / loamwise / evaluator 调用 / scheduler。**in-scope editable**：ci.yml / validate-contracts.mjs（§0.1-9）。**forbidden-name**：复合名安全，禁裸 `evaluator`/`trial`/`candidate`（§0.1-8）。

## §8 SPEC Anchor / Version Control

- Phase 1d 实施指令包必须引用**本 SPEC 的 git blob SHA**（liye_os main 落盘后）；不引用 commit SHA。
- v1.0 → v1.1 任何修订须 user 显式 sign-off + version bump。
- SPEC blob 漂移 → 实施 PR review 必拒。
- 实施 PR description 必须 reference SPEC v1.0 blob SHA + 列举 DoD checkbox + Hard NO 自审。

## §9 Findings / Open Items（带入实施 / 上游 doc-fix）

| ID | Finding | Disposition |
|---|---|---|
| **F1** | 偏离「pre-commit hook reject diff」MUST——该 MUST 不仅 P-03 字面，**frozen schema 自身**（header 注释 + `_runtime_owned_fields` property description）亦 normative 写之，而 frozen schema 是冲突链 top-tier | **裁决 E** 接受偏离，**披露升级**（§0.1-7）：偏离的是最高权威 artifact 内嵌 MUST，justify = schema 注释/description 非可执行散文（ajv enforce shape 非注释）+ live state gitignored 无版本化 diff 面使 hook-MUST **vacuously 满足**；hook defer 2a；schema description staleness 并入 N1 doc-fix bucket |
| **N1** | frozen v2 schema header 注释 `落点: proactive/...` + `_runtime_owned_fields` 的 hook-MUST description 与裁决 A7/E divergence | schema 注释/description 非 normative（校验 shape 不校验 path/注释）；**裁决 A7/E** 用 learning/ + 无 hook。stale → 上游 0b doc-fix（deferred，1d 不改 frozen schema） |
| **N2** | `evaluator_invocation_mode_advisory` 不能进 live state（additionalProperties:false） | 落 cursor sidecar + report；advisory-only（§1.6） |
| **N3** | transition `reason` enum | 仅记成功 phase 变更（`{bootstrap, operator, operator_rollback, kill_switch}`）；invalid-combo/ceiling = fail-closed 非 transition；**§4 机器断言 `invalid_combo` 被 schema 拒**（防 5-enum 漂移） |
| **N4** | bootstrap template 非 v2-schema-valid | template = 11 config key，缺 5 schema-required（`version` + `_runtime_owned_fields` + 3 runtime-owned）；runner 组装完整 16-key 后才 ajv（§1.2） |
| **N5** | gitignore 覆盖（**红队纠正：原 SPEC C7 误判**） | `state/runtime/learning/` 已被 `.gitignore:330` **目录级全忽略**（git check-ignore 实证 4 文件全覆盖）；**无需加任何 `.gitignore` 条目** |
| **N6** | v2 是否保留 v1 ENV dual-switch | 仅留 `LIYE_HEARTBEAT_ENABLED` ENV override（紧急控制）；6 新旗 source=template→live，不引 ENV（避免膨胀） |
| **N7** | active count 定义 + registry enabled 关系 | `active = source_allowlist.length`（presence，per `learning_sources.yaml` L50 presence-only）；registry `enabled:false` 是 AGE-emit/manifest gate、正交；1d 不读 registry（§1.3，裁决 A9） |
| **N8** | retire v1 测试破 `ci.yml`；新 schema 不注册则 contracts-gate 静默跳过 | IMPL 编辑 ci.yml 移除 heartbeat-switch-test job + 在 validate-contracts.mjs 注册新 schema（§0.1-9 in-scope）；DoD#13/#14 + 负向测试守之 |

无 blocker。实施可在 user 批准 v1.0 PR 后开工（→trialing flip / F3 / 二次门 / pipeline 均为后续 phase 独立改动，与 1d 解耦）。

---

**END OF SPEC v1.0**
