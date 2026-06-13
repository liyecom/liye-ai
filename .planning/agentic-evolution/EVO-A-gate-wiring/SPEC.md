# EVO-A SPEC-seed v0.1 — 休眠门禁通电（pre-ceremony intake）

**Status**: seed（须经 SPEC ceremony + 红队升 v1.0 后方可 IMPL）
**Date**: 2026-06-10（2026-06-11 operator-review fold：F1 N-A8 + D-1 python toolchain（jsonschema 须显式装）；F3 N-A9 + D-4 确定性 CI 模式（gitignored facts 漂移））
**Pattern 来源**: Ch15 A2A（manifest↔reality parity）· Ch16 Resource-Aware（budget contract 入禁）· Ch18 Guardrails（blocking 契约纳入确定性校验）

---

## Goal

三件"已建好、零通电"的确定性防线接入 CI：
1. **A1**: `validate_manifest_reality.py` 接入 CI（= ADR-GHL **Phase 0c.4 的收口**，非新决策）。
2. **A2**: `cost_meter.schema.yaml` 注册进 validate-contracts schemaFiles[]（gate +1 carve-out）+ 接活死代码 `validate-cost-meter.mjs`。
3. **A3**: 3 个治理 DSL 契约（corrigibility_negotiation / min_continuity_kernel / co_exploration_loop）获得专用结构校验器。

## Normative anchors（2026-06-10 实测）

| ID | 锚点 | 实测状态 |
|----|------|---------|
| N-A1 | `_meta/contracts/scripts/validate_manifest_reality.py` | 存在（335 行，mtime 2026-05-29 11:20，带 `--self-test`）；`.github/` 与 validate-contracts.mjs 中**零引用**。SPEC v1.0 须把裸日期换成 commit-pin（`git log --diff-filter=A --format='%h %ad' -- <path>`）以机械可复检 |
| N-A2 | `_meta/adr/ADR-Governed-Heuristic-Learning.md` L170/L183/L281/L334 | 0c.4 = "validate_manifest_reality.py 实施 + CI 接入"，**gated on Sprint 9 readout (Checkpoint B2)**，标记未完成 |
| N-A3 | `_meta/contracts/proactive/cost_meter.schema.yaml` | 真 JSON Schema（`$schema` draft-07 + `$id` + definitions，L9-13）；**不在** schemaFiles[]（16 项，validate-contracts L511-536 实读） |
| N-A4 | `_meta/contracts/scripts/validate-cost-meter.mjs` | 存在但死代码（`.github/` + package.json 零引用） |
| N-A5 | `_meta/contracts/governance/{corrigibility_negotiation,min_continuity_kernel,co_exploration_loop}.schema.yaml` | **自定义 DSL 非 JSON Schema**（顶层 `kind/scope/enforcement` 字段，无 `$schema/$id`）；前两者 `enforcement: blocking`，第三者 advisory；**当前零机器校验** |
| N-A6 | `_meta/contracts/scripts/validate-contracts.mjs` `validateContractSchemas()`（~L508-564） | 机制 = YAML parse + `$schema`/`$id`/required 标记结构检查，**非 ajv compile**——故 DSL 文件即便注册进 schemaFiles[] 也**只会空过 +1 gate 而零强制力**（缺 `$schema/$id` 仅触发 logWarning，文件仍 logPass，绝不 fail）。这正是 A3 须用**专用校验器**（N-A7 路线）而非塞进 schemaFiles[] 的理由 |
| N-A7 | `_meta/contracts/scripts/validate-contracts.mjs` `validateFormulaInstances()`（~L345+） | **house 先例**：非-JSON-Schema 契约实例的专用手写校验器（YAML parse + 逐字段断言 + weights sum=1.0 容差 1e-9）——A3 的机制模板 |
| N-A8 | `validate_manifest_reality.py:38-39`（`import yaml` + `from jsonschema import Draft7Validator`）vs `.github/workflows/contracts-gate.yml:44`（仅 `npm install yaml`，**0 python dep**） | A1 的 CI 必须先建 Python runtime，否则 fresh Node-only runner 必 `ModuleNotFoundError: jsonschema`。⚠ 当前**无任一 workflow 引用该 validator**（见 N-A1：`.github/` 零引用）→ 红是**条件性**（D-1 接线后才触发），非现役坏 CI。⚠ **本地误报陷阱**：本机已装 jsonschema 4.26.0，`--self-test` 本地 exit 0 会**掩盖**该缺口，须以 fresh-checkout CI 实跑为准。house 先例 `architecture-gate.yml:51-56` / `lift-regression-gate.yml:39-45` = `setup-python@v5 + pip install pyyaml`，但**均不装 jsonschema**——fold 须显式 `pip install pyyaml jsonschema` |
| N-A9 | `validate-cost-meter.mjs`（FACTS_FILE :25 → readFileSync :223 → 抽样 first min(10,N) :234-239）；`--facts`/`--help` 外**无** CI flag（:291-313）；facts 路径 `data/facts/*.jsonl` 被 `.gitignore:337` 排除（`.gitkeep` 例外 :338，`git ls-files` 实证 untracked） | A2/D-4 的 local/CI 漂移源：文件缺席→`logWarning`(:218) 非 error→**fresh CI warn+pass**；本地有 runtime facts→18 schema error + exit 1。门禁**不得**依赖 gitignored runtime state 是否存在 |

## Scope / Out of scope

**In**: CI workflow 新增/编辑；validate-contracts.mjs 的 schemaFiles[] 注册与新校验函数（编辑 validator = 脚本，非 sealed contract，先例允许）；gate-count carve-out ceremony 文书。
**Out**: 4 个契约文件本体 0 修改（sealed 语义不动）；validate_manifest_reality.py 本体 0 修改（只接线；若 self-test 暴露缺陷另案披露）；cost_meter.mjs 实现 0 修改；**不做**这些契约的运行时行为强制（blocking 语义的 runtime enforcement 是更大的独立题，本 phase 只做结构防腐层）。

## Deliverables（草案，ceremony 裁定拆分粒度）

- D-1: `contracts-gate` CI job（或既有 workflow 扩展）跑 `validate_manifest_reality.py`，对 AGE manifest 校验 effective≤declared；fail-closed 非零退出。**必含 Python toolchain step**（`actions/setup-python@v5` + `pip install pyyaml jsonschema` 或受控 requirements）——现有 `contracts-gate.yml` 是 Node-only（:44 `npm install yaml`），**不可照抄**；house 先例 `architecture-gate.yml:51-56`/`lift-regression-gate.yml:39-45` 装 pyyaml 但**不装 jsonschema**，须额外补（N-A8）。
- D-2: cost_meter 注册 schemaFiles[]（gate 21→22 预期；**入场三源实测 before，落地实测 after**）。
- D-3: `validateGovernanceContracts()` 新函数（仿 N-A7 机制）：对 3 个 DSL 校验 version/kind/scope/enforcement-enum/关键段存在性；gate 计数增量由 ceremony 裁定（单函数 1 pass vs 每文件 1 pass）。
- D-4: validate-cost-meter.mjs 接入 CI（独立 step 或并入 contracts-gate）。**必含确定性 CI 模式**——加 `--schema-only`/`--skip-runtime-facts` flag 跳过抽样 gitignored `data/facts/fact_cost_events.jsonl`，**或**提交 tracked golden fixture（`git add -f` 强制跟踪过 `.gitignore:337`，仿 1e `**/*_state.json` 先例）令门禁校验固定语料而非 runtime state（N-A9）。已存 `--facts <path>` flag（:296）可复用指向 fixture。

## Entry criteria（⚠ 必须先清）

1. **0c.4 的 B2 前置**：ADR-GHL 将 0c.3+0c.4 gated on "Sprint 9 readout (Checkpoint B2)"（L183/L334）。入场前 operator 须确认该前置已清**或**书面豁免（记入 SPEC v1.0 Decision Log）。**已知候选指针（operator 确认即可清门）**：S9 readout SIGNED `cb4d4b0`（2026-05-28）+ Checkpoint B2 CLOSED（`437e3e1`+`4a93092`+`069a818`，2026-05-28）；且 GHL Phase 1a-1e（gated on Checkpoint C ⊇ B2）已全 merged。
2. **0c.3 实测已完成**：`amazon-growth-engine/engine_manifest.yaml` 已 `schema_version: "2.0"`（:15）+ header L7-9 "Migrated … in Phase 0c.3 of Checkpoint B2 (per … Sprint 9 readout signed 2026-05-28)"——0c.3 verifiably COMPLETE；ADR L280 checkbox 为**陈旧标记**（文档落后于现实，非真未完成）。入场复核该指针即可。
3. gate 当前计数三源实测（预期 21 @ local working tree；**fresh-checkout CI 可能为 20**——candidate/BID_RECOMMEND_*.yaml 被 .gitignore L350 排除，须先 `git ls-files` 实证其 track 状态）。carve-out 文书须注明测量环境。

## DoD 草案

- [ ] CI 绿：validate_manifest_reality 对 AGE manifest PASS（或暴露真实 violation 并披露）
- [ ] D-1 CI job 含 Python toolchain step（setup-python + `pip install pyyaml jsonschema` 或 requirements），**fresh-checkout** runner 实跑 validate_manifest_reality.py 绿（非仅本地——本地装 jsonschema 会掩盖缺口，N-A8）
- [ ] D-4 cost-meter 门禁 fresh-checkout（无 gitignored facts）与本地（有 runtime facts）产**字节一致** PASS/FAIL，不因 ignored runtime state 存否而漂移（N-A9）
- [ ] gate before/after 三源实测差值 == 注册增量，carve-out 文书齐
- [ ] 4 个契约文件 + validate_manifest_reality.py 本体 0-diff（sha256 实证）
- [ ] GHL frozen 锚点全清单 0-diff
- [ ] 全量既有测试绿（含 GHL 各 phase suite）

## Open questions（ceremony 裁）

- OQ-1: D-1 落点——新 workflow vs 并入既有 ci.yml？（1d 先例：ci.yml in-scope 编辑允许）
- OQ-2: D-3 的 gate 计数语义（单 pass vs per-file pass）与 schemaFiles 注释区的台账格式。
- OQ-3: validate_manifest_reality 须 AGE manifest 的访问方式（checkout 双仓 vs 提交 fixture）——cross-repo CI 的 house 先例核查（FU-2 教训：golden_harness --check 曾因 cross-repo 依赖 defer 到 AGE CI）。**既有先例陷阱**：`contracts-gate.yml` L87-128 已有 cross-repo checkout（`vars.EXTERNAL_ENGINE_REPO` + `ENGINE_REPO_TOKEN`）但 `continue-on-error: true` **非 fail-closed**——D-1 不得照抄该容错语义（fail-closed 是本 phase 硬要求）。
- OQ-4: D-1 python 依赖声明落点——inline `pip install` vs 提交 requirements.txt（house 先例 `phase-0b-parser-ci.yml:47` `pip install -e .[dev]` 走 pyproject extras）（N-A8）。
