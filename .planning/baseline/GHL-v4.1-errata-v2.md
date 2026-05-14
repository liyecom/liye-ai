# GHL v4.1 Errata v2 — Second Overlay (Audit Round 6 Corrections)

**Status**: REQUIRED BEFORE ADR ACCEPT
**Base**: `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` (frozen)
**Prior overlay**: `liye_os/.planning/baseline/GHL-v4.1-errata.md` (errata-v1, audit round 5)
**Source**: Codex 第 6 轮 ground-truth audit (2026-05-10) + user-mandated strengthenings
**Decision**: baseline / errata-v1 / readiness / ADR-intake 正文不回改；本 errata 作为第二层修订叠加层进入 ADR normative inputs

---

## 0. Status

- v4.1 baseline 正文：**frozen** (663 lines @ 2026-05-09 23:41)
- errata-v1 正文：**frozen** (635 lines @ 2026-05-10 00:29)
- readiness-report 正文：**frozen** (183 lines @ 2026-05-10 00:30)
- ADR-intake 正文：**frozen** (300 lines @ 2026-05-10 00:32)
- errata-v2 状态：**draft → committing**（本文件）
- Cooling period: ended 2026-05-11/12; this overlay drafted 2026-05-14
- ADR status: 尚未启动；errata-v2 commit 后启动 "writing phase only, no Accept"

## 1. Scope and Discipline

**This overlay is a read-only patch over errata-v1 + baseline + readiness + ADR-intake.**

允许：
- 在本文件内沉淀第 6 轮 audit 的 5 项修订（EV2-B-01 / EV2-I-01 / EV2-I-02 / EV2-I-03 / EV2-W-01）+ ADR normative-input 规则 (EV2-N-01)
- 引用 errata-v1 与 baseline 的具体行号/节号

禁止：
- 回改 baseline / errata-v1 / readiness / ADR-intake 正文
- 启动 ADR Accept（仅允许 ADR drafting 进入"写"阶段，写完停 24h）
- 修改 AGE / liye_os / loamwise 任何 runtime 代码
- 触碰 loamwise baseline-protected paths

## 2. Correction Summary

| ID | Type | 决议 |
|---|---|---|
| EV2-B-01 | Blocking | lint 目标改为 **裸 identifier**（变量名/函数名/类名），不再扫字符串/enum/路径/markdown；regex 改为 declaration patterns + fixture 重写 |
| EV2-I-01 | Important | AGE fact event log 路径锁定 **date-sharded**，日期来自 `emitted_at` 转 UTC 后的 date 部分；`<event_identity_key>.json` 术语改为 **event sidecar**（与 raw payload 概念解耦） |
| EV2-I-02 | Important | legacy fact path 事实修正为 `state/memory/facts/fact_run_outcomes.jsonl`（与 v4.1 canonical 新路径 `state/memory/facts/fact_run_outcome_records.jsonl` 同目录但文件名不同） |
| EV2-I-03 | Important | engine_manifest schema migration **唯一归属 Phase 0c**；Phase 0b 仅承载 learning schemas（9 个文件） |
| EV2-W-01 | Wording | readiness "零写入 AGE / loamwise" 修订为 "无 tracked diff" + 显式列出 pre-existing untracked paths |
| EV2-N-01 | Normative | ADR consumes 链区分 **normative inputs** (baseline + errata-v1 + errata-v2) vs **supporting references** (readiness + ADR-intake) |

## 3. EV2-B-01 — Identifier-level lint（不再"只扫源码文件"就结束）

### 3.1 用户强制修正

> "lint 目标：裸 identifier / 变量名 / 函数名，不是字符串、schema enum、路径、markdown"

errata-v1 §3 B-03 提出"diff-only + word-boundary regex + 仅扫源码扩展名"。Codex 实测发现仍有两类硬伤：

| 样本 | 现 regex 行为 (errata-v1) | 期望行为 (errata-v2) |
|---|---|---|
| `const status = "candidate"` | MATCH (BUG) | NOT MATCH（这是 enum string，不是 identifier） |
| `validation_status=candidate` (yaml) | MATCH (BUG) | NOT MATCH（不在源码文件，但若在 .py 注释里也应放过） |
| `path = "state/memory/.../candidate/"` | MATCH (BUG) | NOT MATCH（字符串字面量内容） |
| `const trial = createTrial()` | MATCH | MATCH ✓ |
| `def evaluator():` | MATCH | MATCH ✓ |
| `class TrustScore:` | NO MATCH | NOT MATCH（CamelCase 不在 snake_case lint 第一 pilot 范围） |

**根因**：仅 word-boundary regex 无法区分 identifier vs string literal vs path string vs enum value。

### 3.2 修订后 lint 设计

**lint 目标**：**snake_case 裸 identifier（变量名 / 函数名 / 类名 / 参数名）**

**lint 实现策略**：从"字符级 regex"升级为"declaration pattern regex"

```bash
# liye_os/.claude/scripts/learning/lint_forbidden_names.sh (errata-v2)
set -euo pipefail

ALLOWED_EXTENSIONS='\.(py|mjs|js|ts|tsx|jsx)$'

# Declaration patterns — 只匹配 identifier 出现在声明位置的情况
# Python:
PY_ASSIGN='^[[:space:]]*(trial|candidate|trust_score|trust_matrix|evaluator)[[:space:]]*='
PY_DEF='\b(def|async[[:space:]]+def)[[:space:]]+(trial|candidate|trust_score|trust_matrix|evaluator)[[:space:]]*\('
PY_CLASS='\bclass[[:space:]]+(trial|candidate|trust_score|trust_matrix|evaluator)\b'
PY_PARAM='\b(def|async[[:space:]]+def)[[:space:]]+\w+[[:space:]]*\([^)]*\b(trial|candidate|trust_score|trust_matrix|evaluator)[[:space:]]*[:=,)]'

# JavaScript/TypeScript:
JS_DECL='\b(const|let|var)[[:space:]]+(trial|candidate|trust_score|trust_matrix|evaluator)\b'
JS_FN='\bfunction[[:space:]]+(trial|candidate|trust_score|trust_matrix|evaluator)[[:space:]]*\('
JS_CLASS='\bclass[[:space:]]+(trial|candidate|trust_score|trust_matrix|evaluator)\b'
JS_ARROW='\b(const|let|var)[[:space:]]+(trial|candidate|trust_score|trust_matrix|evaluator)[[:space:]]*='

# Union regex
LINT_REGEX="(${PY_ASSIGN}|${PY_DEF}|${PY_CLASS}|${PY_PARAM}|${JS_DECL}|${JS_FN}|${JS_CLASS}|${JS_ARROW})"

# Self-test 必先跑
bash "$(dirname "$0")/lint_forbidden_names_self_test.sh" || exit 2

# Diff-only 模式
if [[ "${1:-}" == "--staged" ]]; then
  files=$(git diff --cached --name-only --diff-filter=ACM | grep -E "$ALLOWED_EXTENSIONS" || true)
else
  files=$(git diff --name-only --diff-filter=ACM HEAD | grep -E "$ALLOWED_EXTENSIONS" || true)
fi

# 排除 archive/, quarantine/
if [[ -z "$files" ]]; then exit 0; fi

violations=$(echo "$files" \
  | grep -vE '(^|/)(archive|quarantine)/' \
  | xargs -I{} grep -nE "$LINT_REGEX" {} 2>/dev/null || true)

if [[ -n "$violations" ]]; then
  echo "FORBIDDEN BARE IDENTIFIERS DETECTED:"
  echo "$violations"
  exit 1
fi
exit 0
```

### 3.3 修订后 fixture

**`must_pass.txt`**（必须全部不被 lint 标记）:

```
# String literals containing forbidden tokens (legitimate enum/path values)
const status = "candidate"
const path = "state/memory/learned/policies/candidate/"
const config = { validation_status: "candidate" }
const allowed_phases = ["trial", "candidate", "promoted"]
let example = `policy is in candidate stage`

# Compound identifiers containing forbidden tokens
const policy_trial = createPolicyTrial()
let candidate_write_enabled = false
const candidate_writing_sandbox = "phase-2c"
def get_policy_trial_evaluator():
    return None
class PolicyTrialEvaluator:
    pass
policy_trial_evaluator.mjs
PolicyTrialEvaluator
trial_write_enabled = false
candidate_write_target_status = "sandbox"

# Module / namespace references
import policy_trial from "./policy_trial"
import { CandidateStore } from "./candidate_store"
```

**`must_fail.txt`**（必须每行被 lint 标记）:

```
# Bare snake_case identifier as variable
const trial = createSomething()
let candidate = {}
var evaluator = function() { return null }
trust_score = 0.5
trust_matrix = []
const candidate = newCandidate()

# Bare snake_case identifier as function definition
def evaluator():
    pass
def trial(x):
    return x
function trial(x) {
    return x
}
async function candidate() {}

# Bare snake_case identifier as class
class evaluator:
    pass
class trust_matrix:
    pass

# Bare snake_case identifier as parameter
def process(candidate: dict):
    pass
def handle(trial):
    pass
```

**移除（vs errata-v1）**：
- must_pass 移除 `learned_policy.validation_status=candidate`（yaml 不在 lint 范围；改为 .py 内字符串 `const config = { validation_status: "candidate" }`）
- must_pass 移除 `state/memory/learned/policies/candidate/`（路径不在文件内容；改为 .py 字符串 `const path = "state/memory/learned/policies/candidate/"`）
- must_fail 移除 `class TrustScore:`（CamelCase 不在 snake_case lint 第一 pilot 范围；保留 `class evaluator:` snake_case 形式）

### 3.4 CamelCase 处理（deferred）

第一 pilot lint 仅扫 snake_case 裸 identifier。CamelCase（如 `TrustScore` / `TrialEvaluator`）以下情况需未来扩展：

- **Phase 0f-extended**（Phase 0f 结束后选做）：加 CamelCase 单独 regex pass
- **Phase 2**（candidate writing 启动后）：ast-grep / tree-sitter 升级为 AST-level lint

ADR Open Questions §OQ-08（new）：CamelCase 裸 identifier 是否进入 Phase 0f 第一 pilot？默认 deferred。

### 3.5 验收准则

errata-v2 落盘后，lint 设计满足：
- lint 目标声明为"snake_case 裸 identifier"（identifier-level，不再是 character-level）
- regex 仅匹配 declaration patterns
- fixture 覆盖 4 类 must_pass（string literals / compound identifiers / namespace refs / yaml-like config in code）+ 4 类 must_fail（variable / function / class / parameter declaration）
- self-test fail → CI red
- 跳过 yaml / json / md / 注释行（注释行第一 pilot 不区分；P2 加 ast-grep 后再做）

## 4. EV2-I-01 — Date-sharded log + UTC + event sidecar

### 4.1 用户强制修正

> "date-sharded log 的日期使用 emitted_at 的 UTC date"
> "`<event_identity_key>.json` 称为 event sidecar，不称 raw payload"

errata-v1 在两处对 AGE fact event log 路径表述不一致；同时 errata-v1 §6 path table 中将单事件 JSON 称为 "AGE fact JSON" / "raw payload" 混用。

### 4.2 锁定路径布局

**AGE fact emission 输出（D-14 emit_fact.py 写入）**:

| 内容 | 路径（D-14 锁定） |
|---|---|
| 每日 events log | `amazon-growth-engine/out/facts/<UTC_DATE_FROM_emitted_at>/fact_run_outcome_events.jsonl` |
| Event sidecar（每事件一份） | `amazon-growth-engine/out/facts/<UTC_DATE_FROM_emitted_at>/<event_identity_key>.json` |

**`<UTC_DATE_FROM_emitted_at>` 计算规则**:

```
1. emitted_at 必须是 ISO 8601 with timezone offset (e.g. "2026-05-09T23:30:00+08:00")
2. 转为 UTC: "2026-05-09T23:30:00+08:00" → "2026-05-09T15:30:00Z"
3. 取 UTC date 部分: "2026-05-09"
4. 路径片段: "2026-05-09"
```

例：北京时间 2026-05-10 00:30 emit → UTC 2026-05-09 16:30 → date `2026-05-09` → 落入 `out/facts/2026-05-09/`

**强制约束**：
- 同一 event 的 events.jsonl 行与 sidecar.json 必须落入**同一日期目录**
- emit_fact.py 取 UTC date 前必须 verify emitted_at 有 timezone offset；无 offset 一律 fail-closed（避免本地时区歧义）
- importer (`discover_new_runs.mjs`) 扫 `out/facts/*/*.jsonl` 时以目录名作为日期 partition key

### 4.3 术语区分（用户修正）

| 术语 | 含义 | 路径 |
|---|---|---|
| **event sidecar** | GHL fact emission 创建的 canonical JSON，符合 `fact_run_outcome_event_v1` schema 的完整字段 | `out/facts/<utc_date>/<event_identity_key>.json` |
| **raw payload** | AGE 内部 trace artifact（如 `verification.json`, `policy_suggestions.json`），是 AGE 业务产物，**不**由 GHL emit_fact 创建 | `out/{ASIN}/runs/{timestamp}/*.json` |
| **raw_payload_ref** (event field) | event sidecar 内字段，repo-relative path 指向 raw payload | e.g. `"out/B0XXX/runs/2026-05-09T14:30:00Z/verification.json"` |

**事件解析顺序**:

```
1. AGE 内部 run 完成 → 产生 raw payload at out/{ASIN}/runs/{timestamp}/...
2. emit_fact.py 读 raw payload + 业务上下文
3. 计算 event_identity_key (sha256 of identity fields)
4. 计算 event_content_hash (sha256 of canonical event payload excluding volatile)
5. 写 event sidecar: out/facts/<utc_date>/<event_identity_key>.json
6. 同目录 append: out/facts/<utc_date>/fact_run_outcome_events.jsonl (one line per event)
```

### 4.4 source registry 字段最终版

```yaml
# liye_os/.claude/config/learning_sources.yaml (errata-v2 锁定)
amazon-growth-engine:
  fact_emission_root: "out/facts"
  fact_emission_layout: "date_sharded_utc"
  daily_events_filename: "fact_run_outcome_events.jsonl"
  event_sidecar_filename_pattern: "<event_identity_key>.json"
  date_source_field: "emitted_at"
  date_extraction: "utc_date_of_emitted_at"
```

errata-v1 §6 path table 中 `out/facts/fact_run_outcome_events.jsonl` 与 `out/facts/<YYYY-MM-DD>/<event_identity_key>.json` 同时出现 → 以本节为准（date-sharded + UTC + sidecar 术语）。

## 5. EV2-I-02 — Legacy fact path 事实修正

### 5.1 事实核校

通过 `grep -n "FACTS_FILE" liye_os/.claude/scripts/learning/heartbeat_runner.mjs`:

```javascript
// heartbeat_runner.mjs:39
const FACTS_FILE = join(PROJECT_ROOT, 'state', 'memory', 'facts', 'fact_run_outcomes.jsonl');
```

**实际 legacy path** = `liye_os/state/memory/facts/fact_run_outcomes.jsonl`

errata-v1 §4 I-02 中所写的 `state/memory/learned/runs/fact_run_outcomes.jsonl` **目录层级错误**。

### 5.2 修订后路径表

| 文件 | Schema | Path | 状态 |
|---|---|---|---|
| Legacy v0.1 | (no canonical hash, no provenance block) | `liye_os/state/memory/facts/fact_run_outcomes.jsonl` (**单数 outcomes**) | **frozen on Phase 1b 启动**；可 rename 为 `fact_run_outcomes.v0.1.archived.jsonl` 或保留只读 |
| v4.1 canonical record | `fact_run_outcome_record_v1` | `liye_os/state/memory/facts/fact_run_outcome_records.jsonl` (**复数 records 后缀**) | 新建；Phase 1b importer 写入此路径 |

### 5.3 关键事实

Legacy 与 v4.1 在**同一目录** `state/memory/facts/`，仅文件名不同：

```
state/memory/facts/
├── fact_run_outcomes.jsonl              # v0.1 legacy (frozen on Phase 1b)
└── fact_run_outcome_records.jsonl       # v4.1 canonical (new)
```

防混写约束：
- Phase 1b 启动时显式 freeze legacy file（heartbeat_runner.mjs 改读新路径）
- importer 永不写 legacy filename
- v0.1 数据如需 backfill 重导，必须先转 v4.1 schema 再写入新路径
- legacy 文件可保留只读供历史 audit，但不允许任何工具向其 append

### 5.4 同步修订

readiness-report §"检查项 9" 中描述的 legacy path 同样应理解为 `state/memory/facts/fact_run_outcomes.jsonl`。readiness-v1 正文不回改，但 ADR 起草时引用本节为准。

## 6. EV2-I-03 — Engine manifest migration phase 归属

### 6.1 矛盾事实

| 来源 | 表述 |
|---|---|
| errata-v1 §3 B-02 | "Phase 0c deliverables 必须增加 engine_manifest.schema.v2.yaml" |
| errata-v1 §5 "Final Schema Deltas" | "Phase 0b 全部新增/扩展" |
| ADR-intake §8 "Contract Deltas" | 表中 `engine_manifest.schema.v2.yaml` 与 `learning_sources.yaml` 并列，未明确 phase 归属 |
| ADR-intake §9 Rollout Phases | "Phase 0b: 10 个 schema 文件" 与 "Phase 0c: ..." 内容重复 |

### 6.2 锁定边界

| Phase | 范围（错过这个边界即报错） |
|---|---|
| **Phase 0b — Learning schemas only** | 9 个 learning-domain schema 文件 + validate-contracts 扫描扩展（不含 engine_manifest schema） |
| **Phase 0c — Engine manifest reality** | `engine_manifest.schema.v2.yaml`（新增）+ `validate-contracts.mjs` 双 schema 路由 + AGE `engine_manifest.yaml` v2 migration + `validate_manifest_reality.py`（新建） |

**Phase 0b 9 文件**（明确归属）:

```
1. learned_policy_ghl_v1.schema.yaml
2. fact_run_outcome_event_v1.schema.yaml
3. fact_run_outcome_record_v1.schema.yaml      (with B-01 fix from errata-v1)
4. governance_event_v1.schema.yaml             (from errata-v1 B-04)
5. policy_trial_v1.schema.yaml                 (from errata-v1 B-05)
6. operator_feedback_v1.schema.yaml            (from errata-v1 B-05)
7. policy_lifecycle_event_v1.schema.yaml       (from baseline D-09)
8. confidence_formulas.yaml
9. heartbeat_state_v2.schema.yaml
```

**Phase 0c 4 文件**（明确归属）:

```
1. engine_manifest.schema.v2.yaml              (NEW)
2. validate-contracts.mjs                      (EXTEND: dual-schema router)
3. amazon-growth-engine/engine_manifest.yaml   (MIGRATE to v2.0; gated on Sprint 9 readout per D-14)
4. validate_manifest_reality.py                (NEW; depends on items 1-3)
```

### 6.3 Phase 0c 内部顺序（继承 errata-v1 B-02）

```
0c.1: 新增 engine_manifest.schema.v2.yaml
0c.2: 扩展 validate-contracts.mjs 支持双 schema 路由
0c.3: AGE 迁移 engine_manifest.yaml 到 v2.0 (gated on Sprint 9 readout)
0c.4: 新建 validate_manifest_reality.py
```

errata-v1 §5 "Final Schema Deltas" 的 "Phase 0b 全部新增/扩展" 表述与 §3 B-02 的 "Phase 0c deliverables" 冲突时，**以本节 §6.2 为准**。

### 6.4 跨文件 cross-reference 规则

ADR 起草时：
- ADR §"Rollout Phases" 必须按本节 §6.2 描述 Phase 0b/0c 边界
- ADR §"Contract Deltas" 必须按本节 §6.2 标记每个 schema 的 phase 归属
- 不允许把 engine_manifest schema 列入 Phase 0b

## 7. EV2-W-01 — Evidence 措辞精确化

### 7.1 用户修正

readiness-report §"全局判断" / §"loamwise baseline-protected paths" 中"零写入"用语过于绝对。

### 7.2 事实修正

| 原措辞 | 修订后表述（ADR 起草时引用） |
|---|---|
| "AGE 0 修改 / loamwise 0 修改" | "在 GHL planning session (2026-05-09 ~ 2026-05-14) 期间，AGE 与 loamwise 仓库 0 tracked diff" |
| "loamwise 仓库零写入" | "本 session 期间未在 loamwise 仓库写入任何 tracked 文件" |
| "AGE 0 改动" | "AGE 仓库无 GHL 相关 tracked diff" |

### 7.3 pre-existing untracked paths 显式列出

为消除"零写入"的解读模糊，ADR 起草时引用本节明确：

```
Pre-existing untracked paths (与 GHL session 无关，2026-05-14 观察):
  - amazon-growth-engine: .planning/, docs/campaign-blueprint-template-v1.example.zh.md, docs/listing-optimization-template-v1.example.zh.md
  - loamwise: .claude/, data/

These are historical artifacts from prior sessions; this errata does not touch them.
```

readiness-v1 §"loamwise baseline-protected paths 是否仍不触碰" 检查项答案保持 ✅ UNTOUCHED 不变（事实正确），但措辞从"零写入"改为"无 tracked diff in protected paths since baseline 3df1435"（已在 §3 检查表中按此措辞确认）。

## 8. EV2-N-01 — ADR normative inputs vs supporting references

### 8.1 用户强制规则

> "ADR normative inputs 只列 baseline + errata-v1 + errata-v2；readiness/intake 是 supporting refs"

ADR-intake §"ADR consumes" 列出 baseline + errata-v1 但未区分约束力。errata-v2 落盘后，明确：

### 8.2 ADR Input 分类规则

**ADR Normative Inputs**（ADR 必须 consume + 受其条款约束）:

| ID | 文件 | 角色 |
|---|---|---|
| N-1 | `liye_os/.planning/baseline/GHL-evolution-plan-v4.1.md` | 战略主干 / 13 项 Decision Log / 9 phase enum / Phase 结构 |
| N-2 | `liye_os/.planning/baseline/GHL-v4.1-errata.md` | 5 blocking + 4 important corrections; D-14 |
| N-3 | `liye_os/.planning/baseline/GHL-v4.1-errata-v2.md` (this) | 6 项第二轮修正 (EV2-B-01 ~ EV2-N-01) |

ADR 任何 §"Hard Gate" / §"Schema Delta" / §"Rollout Phase" / §"Decision Log" 内容**必须与 N-1/N-2/N-3 一致**；冲突时以最晚的 normative input 为准（N-3 > N-2 > N-1）。

**ADR Supporting References**（用于审计/审查/操作手册，不构成约束）:

| ID | 文件 | 角色 |
|---|---|---|
| S-1 | `liye_os/.planning/baseline/GHL-v4.1-readiness-report.md` | Audit checklist evidence at 2026-05-10 |
| S-2 | `liye_os/.planning/baseline/GHL-v4.1-to-ADR-intake.md` | ADR drafting checklist + Open Questions + Risk Register seed |

ADR §"References" 章节列出 S-1/S-2 时必须显式标注 "Supporting reference, not normative"。

### 8.3 冲突解决规则（ADR 起草时遵守）

```
若 normative input 与 supporting reference 描述冲突 → 以 normative input 为准
若 normative input 之间冲突 → 以最晚的 normative input 为准 (N-3 > N-2 > N-1)
若 ADR 自身与 normative input 冲突 → 修 ADR 草稿，不修 normative input
```

## 9. Required Corrections Before ADR Accept (扩展为 errata-v1 + errata-v2 全集)

errata-v1 §8 列出 9 项 (B-01~B-05 + I-01~I-04)，本 errata-v2 扩展为 15 项：

继承 errata-v1 §8 的 9 项 + 本 errata-v2 新增 6 项：

| ID | 验收点 | 来源 |
|---|---|---|
| 10 | EV2-B-01: identifier-level lint with declaration patterns + fixture 重写 | errata-v2 §3 |
| 11 | EV2-I-01: date-sharded UTC log + event sidecar 术语 | errata-v2 §4 |
| 12 | EV2-I-02: legacy path 修正为 `state/memory/facts/fact_run_outcomes.jsonl` | errata-v2 §5 |
| 13 | EV2-I-03: engine manifest schema migration 锁定 Phase 0c | errata-v2 §6 |
| 14 | EV2-W-01: evidence wording 精确化 | errata-v2 §7 |
| 15 | EV2-N-01: ADR normative inputs vs supporting references 规则 | errata-v2 §8 |

ADR 草稿 §"Required corrections before Accept" 章节必须引用本节 15 项全集。

## 10. Discipline Preserved

errata-v2 起草过程纪律 checklist:

- [x] v4.1 baseline 正文未回改 (mtime 2026-05-09 23:41 不变)
- [x] errata-v1 正文未回改 (mtime 2026-05-10 00:29 不变)
- [x] readiness-report 正文未回改 (mtime 2026-05-10 00:30 不变)
- [x] ADR-intake 正文未回改 (mtime 2026-05-10 00:32 不变)
- [x] AGE 仓库 0 tracked diff（本 session 期间）
- [x] loamwise 仓库 0 tracked diff（本 session 期间）
- [x] loamwise baseline `3df1435` 后 protected paths 0 diff（audit/ govern/ construct/candidates/）
- [x] 未启动 ADR 正文 drafting（本 errata 完成后才进入"写"阶段）
- [x] 未触碰任何 runtime 代码

## 11. Next Step

errata-v2 落盘后按用户执行顺序：

1. **本文件已写** — `liye_os/.planning/baseline/GHL-v4.1-errata-v2.md`
2. **只读验收**: 文件存在 + 覆盖 6 项 + baseline 4 文件 mtime 未动 + AGE/loamwise 无 tracked diff
3. **commit planning 批次到 liye_os**:
   - 文件清单: v4.1 baseline + archive v3 + errata-v1 + errata-v2 + readiness + ADR-intake
   - commit message: `plan(ghl): land v4.1 baseline and errata overlays`
4. **更新 memory**: 指向 errata-v2 + 记录 commit SHA
5. **启动 ADR draft（仅"写"阶段）**: `liye_os/_meta/adr/ADR-Governed-Heuristic-Learning.md`
   - 写完停 24h（沿用 P1 ADR Doctrine 节奏）
   - 不立即 Accept

---

**Authored**: 2026-05-14
**Audit chain**: cc primary drafter → ChatGPT v3→v4→v4.1→v4.1-final → Codex round 5 → cc errata-v1 → Codex round 6 → cc errata-v2
**Status**: errata-v2 落盘；ADR drafting 启动条件就绪（仅"写"，不 Accept）
