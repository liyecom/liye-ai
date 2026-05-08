# Uncommitted Code Triage — Baseline Before Sprint 1

**Purpose**: 盘点 Sprint 0 进入点时的未提交/已修改文件，为每块给出明确处置与是否阻塞 Sprint 1 的判定。

**Date**: 2026-04-17
**Owner**: liye
**Git Head at Triage**: `af0300e` (docs(adr): mark legacy P1 drafts as superseded by accepted ADRs)

---

## 处置分类

- **keep**：保留在本地工作区，暂不提交（待后续明确归属）
- **discard**：从 working tree 删除（或 gitignore）
- **commit-as-baseline**：作为 baseline 一并提交（通常在 Sprint 0 收口时）
- **needs-review**：处置待定，需要 owner 做判断

---

## 逐块清单

### A. Src 层（实质代码）

#### A1. `src/control/`（9 files · 1 438 LOC · untracked）

| 属性 | 值 |
|---|---|
| 内容 | AI Agent Capability Control Plane：`registry.ts` (CapabilityRegistry class), `types.ts` (7-field CapabilityContract + AgentCard), `extractor.ts`, `trust.ts`, `a3-*.ts`, `execution-policy.ts`, `discovery-policy.ts`, `index.ts` |
| 被依赖 | `src/runtime/orchestrator/router.ts` 等（orchestrator 构建在其之上） |
| 与 Sprint 4 关系 | **F2 核心：这是 AI agent 层的 CapabilityRegistry，不是 BGHS 层的 capability runtime**。Sprint 4 会在 `src/runtime/governance/capability/` 新建独立 BGHS registry，与本目录划清边界（README + 硬纪律「不得跨 import」） |
| 处置 | **commit-as-baseline** |
| 阻塞 Sprint 1？ | **否**（Sprint 1 工作在 `src/runtime/governance/session/` 与 `src/runtime/governance/wake/`，与本目录并排） |
| 备注 | 提交前建议：head 注释补一行「AI Agent Capability layer — see Sprint 4 README for boundary vs `src/runtime/governance/capability/`」 |

#### A2. `src/runtime/orchestrator/`（5 files · 1 076 LOC · untracked）

| 属性 | 值 |
|---|---|
| 内容 | Runtime orchestrator：`decomposer.ts` (RuleBasedDecomposer), `router.ts` (CapabilityRouter), `engine.ts` (OrchestrationEngine), `types.ts`, `index.ts` |
| 依赖 | `src/control/` |
| 与 Sprint 4+ 关系 | 这是 execution 面 orchestrator，不是 governance 面；与 Sprint 4 BGHS capability 正交 |
| 处置 | **commit-as-baseline** |
| 阻塞 Sprint 1？ | **否** |

#### A3. `src/runtime/scheduler/dag.ts`（**M** modified · +255/-9 lines）

| 属性 | 值 |
|---|---|
| 改动规模 | 264 行变更（基线是 `b715779 release v3.1.0`） |
| 与本会话关系 | 未知——改动早于本会话 |
| 风险 | 改动规模很大，**不建议盲提交** |
| 处置 | **needs-review**（在 commit-as-baseline 之前，由 owner 审 `git diff src/runtime/scheduler/dag.ts`，确认是有意改动后再提） |
| 阻塞 Sprint 1？ | **否**（Sprint 1 不碰 scheduler） |

---

### B. Tests（配套测试）

#### B1. `tests/control/control-plane.test.ts`
#### B2. `tests/orchestrator/{approval-workflow,crew-matching,orchestrator}.test.ts`
#### B3. `tests/trial-run/{v1-*,v2-*}.test.ts`（5 files）

| 属性 | 值 |
|---|---|
| 内容 | A1/A2 的配套测试 |
| 处置 | **commit-as-baseline**（与 A1/A2 同一批，保证测试覆盖随代码落盘） |
| 阻塞 Sprint 1？ | **否** |

---

### C. Runtime 生成数据（应 gitignore）

#### C1. `data/traces/`（15 目录）

| 属性 | 值 |
|---|---|
| 内容 | `a3/`, `a3-batch1/`, `a3-batch1-tmp/`, `age-anomaly_detect-*`, `d7/`, `epiplexity/`, `investment/`, `kernel/`, `medical/`, `orchestrator/`, `revalidation/`, `run-20260208-*`, `world_model/` 等——全部是运行生成的 trace 数据 |
| .gitignore 状态 | **当前未忽略** |
| 处置 | **discard**（从 working tree 清理）+ **新增 `.gitignore` 规则 `data/traces/`**（与 `evidence/*.tgz` 同级纪律） |
| 阻塞 Sprint 1？ | **否** |
| 备注 | 若某个 trace 有审计价值，单独 copy 到 `.planning/` 或 `evidence/`（非泛 `data/traces/` 归属），不污染 runtime 目录 |

#### C2. `state/traces/`（2 trace-UUID 目录）

| 属性 | 值 |
|---|---|
| 内容 | `trace-21010724-89da-48b2-9b6c-a91ca4d79849/`, `trace-46926c23-fe72-45e2-aa04-7de702a2b33c/` |
| 处置 | **discard** + **gitignore `state/traces/`** |
| 阻塞 Sprint 1？ | **否** |

---

### D. 一次性 evidence

#### D1. `evidence/remote_branches_to_delete_20260311.txt`（489 字节）

| 属性 | 值 |
|---|---|
| 内容 | 2026-03-11 列出「待删远端分支」清单 |
| 时效 | 一次性作业凭据；已过 5 周 |
| 处置 | **discard**（删除文件；若要留证，存到 `.planning/archive/2026-03/`） |
| 阻塞 Sprint 1？ | **否** |

---

### E. 本 Sprint 0 产物（待 commit）

#### E1. `_meta/EVOLUTION_ROADMAP_2025.md`（**M**）— Sprint 0.1 新增 BGHS Track
#### E2. `.claude/scripts/validate_adr_bghs.mjs`（untracked）— Sprint 0.2 新 validator
#### E3. `.github/workflows/adr-bghs-gate.yml`（untracked）— Sprint 0.2 CI gate
#### E4. `.planning/baseline/uncommitted-code-triage.md`（untracked）— 本文件

| 处置 | **commit-as-baseline**（Sprint 0 收口时统一提交） |
| 阻塞 Sprint 1？ | **否**（本身就是 Sprint 0 产物） |

---

## 汇总表

| 块 | 处置 | 阻塞 Sprint 1 | 备注 |
|---|---|---|---|
| A1 `src/control/` | commit-as-baseline | 否 | 提交前加边界注释 |
| A2 `src/runtime/orchestrator/` | commit-as-baseline | 否 | — |
| A3 `src/runtime/scheduler/dag.ts` (M) | **needs-review** | 否 | owner 审 diff 后再定 |
| B1-B3 tests/ | commit-as-baseline | 否 | 与 A1/A2 同批 |
| C1 `data/traces/` | discard + gitignore | 否 | 规则加 `data/traces/` |
| C2 `state/traces/` | discard + gitignore | 否 | 规则加 `state/traces/` |
| D1 `evidence/remote_branches_...txt` | discard | 否 | 可归档到 `.planning/archive/2026-03/` |
| E1-E4 Sprint 0 产物 | commit-as-baseline | 否 | Sprint 0 收口 commit |

---

## 建议执行顺序（Sprint 0 收口时）

1. **Owner 审 A3 diff** → 决定 keep / commit / revert
2. **discard C1/C2/D1**（按 Appendix · Cleanup Discipline 模板）：先 `git ls-files <dir>` + `git status --short <dir>` 枚举，仅按 untracked 子项精确删；混居目录禁用目录级 `rm -rf`。`evidence/remote_branches_to_delete_20260311.txt` 是单文件，可直接 `rm`。
3. **补 `.gitignore`**：加 `data/traces/` + `state/traces/`
4. **Commit #1（A1 + A2 + B1-B3）**：`feat(runtime): add control plane + orchestrator baseline with tests`
5. **Commit #2（E1-E4 + 本文件）**：`docs(roadmap): add BGHS track + BGHS ADR validator + Sprint 0 triage`
6. **（可选）Commit #3（A3）**：若 owner 审过确认保留，单独提交，避免与 baseline 混

---

## 退出条件（Sprint 0.3 closure）

- [ ] A3 dag.ts 归属明确
- [ ] C1/C2/D1 已 discard 或归档
- [ ] .gitignore 更新（如选 discard 路径）
- [ ] A1/A2/B1-B3 + E1-E4 已提交（或明确延后理由）
- [ ] `git status` 干净至仅剩 owner 认可的未提交项

满足 → 进入 Sprint 1。

---

## Appendix · Cleanup Discipline（2026-04-17 立规）

**背景**：本 Sprint 0.3 执行中，原 triage 第 2 步写的是 `rm -rf data/traces/ state/traces/ evidence/...`。实际执行时发现 `data/traces/` 有 29 个 **tracked** 文件与 6 个 untracked 子目录**混居**。目录级 `rm -rf` 把 tracked 文件一并删除（所幸 working-tree 级别可恢复，通过 `git restore --source=HEAD --staged --worktree -- data/traces/`）。

**规则（强制）**：

> Future destructive cleanup 必须先 `git ls-files <dir>` + `git status --short <dir>` 枚举；只允许按文件/子目录精确删，**禁止目录级 `rm -rf`**（除非该目录本身在 `.gitignore` 下且 `git ls-files <dir>` 返回空）。

**执行模板**：

```bash
# Step 1: 盘点
git ls-files <dir>          # tracked 清单（精确到文件）
git status --short <dir>    # untracked 子项（?? 开头的才能删）

# Step 2: 只删 untracked 项（精确到子目录或文件）
rm -rf <dir>/<untracked-subdir-1>
rm -rf <dir>/<untracked-subdir-2>
# …

# Step 3: 验证
git status --short <dir>    # 应无 D 行（无意外误删 tracked）
```

**适用范围**：任何对 `data/` / `state/` / `evidence/` / `artifacts/` 或其他历史性/混居目录的清理动作。纯工作区 ignored artifact（build output 等）不受此约束。
