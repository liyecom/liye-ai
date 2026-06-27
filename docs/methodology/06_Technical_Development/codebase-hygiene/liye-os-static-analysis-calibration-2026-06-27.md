# liye_os 精简——第一阶段只读校准报告

> **状态:READ-ONLY 校准产物,不删任何代码。** 本文档随一个 **foundation docs/tooling PR** 进入 repo(同 PR 仅新增 `knip.json` + 本报告 + scout evolution_log 记录,**零代码删除**)。目标是**测静态工具在 liye_os 这种 agent/脚本/治理混合架构里的信噪比**,并产出带证据链的候选分组,供后续(第 3 步 B)制定计划。
> 范围:liye_os 仓库(`src/` 为主 + `.claude/scripts/` + `_meta/` + `systems/` + `tools/`)。**未碰 AGE、未碰 storefronts。** 排除 `node_modules/dist/websites/.vercel/Artifacts`。
> 日期:2026-06-27(初版只读试跑)。**复审更正(同日):§3b 经核查拆分——drift_monitor 有活边,不可整组 retire,详见 §3b。** 并落地 `knip.json` 实测校准(§1)。
> 工具:knip / vulture / jscpd + 34-agent 只读取证 workflow + launchd/git 实证 + `knip.json` 配置前后对比。

---

## 0. 一句话结论

**liye_os 的核心(`src/`)并不乱——它干净。** 真正的"乱"高度集中在**两个早期(2026 Jan–Feb)搭好、后来被 heartbeat-v2 / GHL-v1 取代、却没清理的休眠子系统**,外加**一小撮没写完/没接线的 skill 脚手架**。可动的真候选 ≈ **21 个文件**,且**全部 `investigate`/`needs-human`,无一可无脑删**——因为它们和治理/外部调度/文档声明是弱连接。

> ⚠ **复审更正**:初版曾把 §3b(drift_monitor/tier_manager)称作"最干净一刀"。**错。** drift_monitor 有一条活的 enforcement 读链,§3b 是**治理性拆分**(partial-retire),不是删除刀。详见 §3b。

---

## 1. 工具信噪比校准(第 2 步 C 的真正产物)

| 工具 | 范围 | 原始命中 | 真信号 | 误报率 / 评价 |
|---|---|---|---|---|
| **knip** `unused files` | 全仓库 | **175**(裸跑) → **47**(配 `knip.json` 后,**全部落 `src/`**) | 深查后 ~21 可动 | 裸跑误报极高:大量是 hook/CI/launchd 调用的**入口脚本**(永不被 import)。**已写 `knip.json`(repo 根)把入口面列为 entry → 175→47(−73%),残留 100% 在 `src/`(import-graph 可信区)。** |
| **knip** `unused exports/types` | 全仓库 | 148 + 191 | 未深查 | JS 内部引用,比 unused-files 可信,但 re-export / 动态引用仍会 FP。配置后已值得逐条看(见 §9)。**本阶段未逐条验证**(诚实披露)。 |
| **vulture** | `src/` py | **13** | ~1–2 | min-confidence 80 下低信号低噪声;含明显 FP(`__exit__` 协议参数 `exc_type/exc_val`)。Python 侧本就干净。 |
| **jscpd** | `src/` | **39 克隆 / 1.14%** | 1 处真老vs新 | 重复率低。19 "真冗余" 多是"抽个 helper"级,**唯一真·老vs新** = v0 学习栈(§3b);但 jscpd **看不见 drift_monitor 的活边**(见 §3b)。 |

### ⚠ 关键方法论教训(比候选清单更重要)
1. **knip 裸跑 `unused files` 不可信**:入口脚本(被 git/Claude hook、CI yaml、launchd 调用)永远显示 "unused"。**已落地修复**:repo 根 `knip.json` 把 `.claude/scripts/**`、`_meta/contracts/scripts/**`、`tests/**`、`tools/**`、`examples/**`、`scripts/**`、`i18n/scripts/**` 及 CI 按名 `node` 调的 src 网关(mcp/gateway/audit-replay/reasoning-demo + 4 个 learning 门)列为 entry → **实测 175→47(−73%),残留全部在 `src/`**。
2. **"文件名 xref" 修正不可单独信**:它把**文档提及**当成"被引用"→ 反而把真死代码(如 `validate-cost-meter.mjs`,repo 自己的 SPEC 都标了死代码)误判为"live"。FP 核验实测:8 个"referenced" 里只有 5 个真入口,3 个是 doc-only。
3. **唯一可信的判据 = 四证合一**:① 导出符号是否被**按名**引用(抓 registry/barrel 接线)② 能否从真入口(CI/hook/launchd/package.json)到达 ③ git 活跃度 ④ 外部 launchd 实查。**本报告每条候选都过这四证。** §3b 的更正正是第①+②证推翻了 jscpd 的表面信号。
4. **静态工具天然看不见的接线**(=高误报区,见 §5):Claude/git hook、CI yaml `node x.mjs`、launchd plist、**YAML/字符串里的 skill-id 注册**、test runner 的 per-file `node --test`、**以及被 grandfather 保留的跨文件 enforcement 读边(§3b)**。

---

## 2. 候选死代码(高/中置信,**仍需人确认后才可动**)

> 全部 `complete`(能跑)但**零入站可达**(无 import、无 barrel、无 CI、无 hook、无 launchd、无 agent-md)。已实证不被外部 launchd 调度。

| 文件 | 置信 | 证据要点 | git |
|---|---|---|---|
| `.claude/scripts/proactive/scheduler.mjs` | **high · truly-dead** | 导出 schedule/loadState/saveState 全仓库零按名引用;同子系统的 playbook_runner 也不调它;无 plist | 1 commit, 2026-02-11 |
| `src/audit/index/append.ts` | **中 · truly-dead** | append-only JSONL 审计索引,实现完整;零 import / 零 barrel / 零 test / CI 只跑 sibling `replay.ts` | 1 commit, 2026-02-01 |
| `_meta/contracts/scripts/validate-cost-meter.mjs` | **high(repo 自证)** | EVO-A `SPEC.md` N-A4 明写"存在但死代码(.github/+package.json 零引用)";A2 任务就是"接线它" | — |
| `src/mission/ingest.js` | 中–high | 完整但零可达;它的 `liye mission ingest` CLI **根本不存在**(`cli/` 目录缺失) | 1 commit, 2026-01-02 |
| `.claude/scripts/dev_run_once.mjs` | 中 · **deprecate** | 治理内核手跑验证 demo;已被 CI 的 `run_golden_all.mjs`+`validate_governance_schemas.mjs` 取代;加一次没再动 | 1 commit, 2026-01-24 |

### ⚠ cut-2 对抗复核更正(2026-06-27)

> 本 §2 的 5 个候选经一轮**对抗式删除复核**(5-agent red-team,每个 agent 被要求**尽力反驳"可安全删除"**)后,**只有 1 个是真·可删的孤立死文件**,其余 4 个各自查出了成立的"别删"理由——再次印证 §8「无四证不删 + 弱连接优先于静态信号」:连本报告已经谨慎的 §2 清单,也需逐个对抗复核才能动。手跑/调试入口风险尤其只有读源码才能看见。

| 文件 | 复核裁决 | 去向 |
|---|---|---|
| `src/audit/index/append.ts` | **DELETE_WITH_NOTE**(手跑风险 none) | ✅ **cut-2 已删**。纯库、四证全死、无 CLI 面。注:其头部引用的契约 `docs/contracts/EVIDENCE_PACKAGE_V1.md` 本身不存在于 repo;活的 sibling `replay.ts` + `evidence/` 未动 |
| `_meta/contracts/scripts/validate-cost-meter.mjs` | **NEEDS_HUMAN** → 操作者裁:**保留** | 休眠 guardrail。EVO-A A2/D-2/D-4 计划把它**接进 CI 激活**(非退役),2 份 runbook 当它手跑命令,其校验对象 `cost_meter` 子系统是活的。报告原称"A2 已接线"经实测**不成立**(EVO-A=seed/IMPL 未解锁)。已加 `STATUS: dormant guardrail` 头防下轮误报 |
| `.claude/scripts/dev_run_once.mjs` | **NEEDS_HUMAN** → 操作者裁:**保留** | dev-only 手动调试工具。`--tamper`(篡改 events.ndjson→replay 抓出→打 diff)是替代 CI 脚本**不覆盖**的唯一交互式内核篡改检测走查,今天仍可直跑。已加 `STATUS: dev-only` 头防下轮误报 |
| `src/mission/ingest.js` | **DEFER_TO_GOVERNANCE** | 非孤儿:是 mission `new→run→ingest` 生命周期第三阶段,"不可达"与 sibling `new.js`/`run.js` 同因(`cli/` dispatcher 未建)。归 EVO-E broker 层 activate-or-retire **开放决策**整组处置 |
| `.claude/scripts/proactive/scheduler.mjs` | **DEFER_TO_GOVERNANCE** | §3a proactive 休眠组的触发入口;纯代码边耦合为零但裸跑会 mutate git-tracked 的 `state.json`。随 §3a 整组治理决策处置 |

**修正后 §2 真·可删 = 1 个(`append.ts`,cut-2 已删)。** 余 4:2 个保留(已加 STATUS 头固化保留理由)、2 个归治理组(§3a / EVO-E,对齐"治理退役绝不当孤立死文件单删")。

---

## 3. 候选休眠/被取代子系统(最大的一坨"乱",**整组治理决策**)

### 3a. 早期 Proactive + v0 学习管线(`.claude/scripts/proactive/*` + `learning/{bundle_build_on_change,learned_policy_loader}`)
- **画像**:2026 Jan–Feb 各 1 commit 搭好,之后**再没动过**(siblings 在 6 月被重写时它们没跟上)。
- **被取代证据**:heartbeat v2 重写(6-1 PR#153)**删掉了对它们的 execSync/spawn 调用**;`learning_pipeline_v0_runner.mjs:7-8` 明标 v0 链 **RETIRED(退役)**;state `heartbeat_learning_state.json → enabled:false`(last run 2026-02-14);ADR-Governed-Heuristic-Learning 标 pipeline 休眠。
- **外部调度**:实查 `~/Library/LaunchAgents` —— **零命中**,无 crontab。确认非外部调度。
- 成员:`scheduler`(§2 已列 truly-dead)、`drift_guard`、`notifier`、`playbook_runner`、`replay_run`、`seed_runs_bid_recommend_from_t1`、`bundle_build_on_change`。
- **治理判定**:整组 = "升级进 heartbeat-v2 控制面" vs "随 v0 链一起退役删除"。ADR-Learning-Stack-Generations 说"不要重建——升级即可",所以**这是人的治理选择,不是机器删除**。

### 3b. v0 学习栈的"老"那一半(jscpd 唯一真·老vs新)——⚠ 经复审拆分,**非整组 retire**

> **复审更正(2026-06-27):初版把 drift_monitor/tier_manager 当"最干净一刀"。错——drift_monitor 有活边。两者必须分开判。这正是 §5「静态工具必然误判」的实例:jscpd 看到两个 superseded 克隆,看不见其中一个还挂着活的 enforcement 读链。**

- **共同点**:`drift_monitor.mjs` ↔ `tier_manager.mjs` 5 处精确克隆(jscpd);两文件头都写 `STATUS: superseded-by-GHL (ADR-Learning-Stack-Generations §D-A2) — v0 week-3 stack`。新栈(`src/reasoning/policy_trial_evaluator.mjs` + heartbeat)是干净重写,所以**不显示为克隆**。

- **`drift_monitor.mjs` —— 有活边,`partial-retire`,不可整文件删:**
  - 文件头 `:9` 明标 `EXCEPTION: isDriftBlocked() (:421, 只读 existsSync/readFileSync) 是 D-A3 preserved read-only enforcement library`,且"no-NEW-references 不溯及该 live enforcement 读"。
  - `execution_gate.mjs:27` 静态 `import { isDriftBlocked } from './drift_monitor.mjs'`;`execution_gate.mjs:271` 在 `if (policyId && actionType === 'WRITE_LIMITED')` 内实际调用 `isDriftBlocked(policyId)`。
  - `execution_gate.mjs` 自身是**活的 enforcement 原语**(其文件头:`write_executor/index.mjs:23` 生产 preflight 依赖,§D-A1 RECLASSIFIED)。
  - ⇒ **这是两层活的 enforcement 链,不是死代码。** 正确动作 = **治理性拆分**:把 `isDriftBlocked()` 这个 D-A3 保留只读面**分离/上移为独立 enforcement primitive**,**再**退役 lifecycle/quarantine/CLI 面(`:233 writeFileSync` / `:236 unlinkSync` 状态变更 + CLI main)。**不是一刀删,且拆分本身要走 Hard Gate 1 字节级回归。**

- **`tier_manager.mjs` —— 无活边,`clean-retire` 候选:**
  - 文件头**无** preserved-exception 条款,反而明写"禁止任何新代码 import/invoke 本模块作 policy promotion/demotion 权威"。
  - src/ 内**零静态 import**;CI `validate-execution-tiers.mjs` 对它的两处提及(`:67`/`:315`)是**注释**,且 `:315` 恰恰是**防 superseded 模块的死配置 token 静默残留**的守卫——不是功能依赖。
  - ⇒ 无 live enforcement 面要保留。**仍是治理决策/needs-human**(带 superseded 头,删除时机是治理时点),但比 drift_monitor 干净得多。

- **修正后判定**:§3b ≠ "整组 retire/删"。= **drift_monitor `partial-retire`(先分离 isDriftBlocked 活面、走字节级回归,再退役 lifecycle/CLI)+ tier_manager `clean-retire` 候选(走治理时点)**。

### 3c. SFC 脚本(`sfc_skill_router` / `sfc_sweep_multi` / `sfc_drift_check_external_plugins`)
- 完整可跑的手调 CLI;唯一按名引用是 `.claude/skills/index.yaml`(其 `status: draft`,且**没有任何 loader 解析它来 dispatch**)。无 CI/hook/launchd。
- **判定:needs-human** —— 是"手动运维工具"还是"草稿弃案"?这取决于你是否还手跑它们。

---

## 4. 候选表面工程 / 不可运行入口(你说的"表面工作跑不通"——**确实存在**)

> 既**没写完**(占位实现)又**没接线**(registry 硬编码,不会动态拾取)。**配 `knip.json` 后这几个全部进了 47 残留(`src/skill/atomic/*` + `systematic_review.ts`),信号干净。**

| 文件 | 证据 |
|---|---|
| `src/skill/atomic/csv_summarizer.ts` | `loadCSV()` 是占位返回 `[]` → `execute()` 永远不可能成功;registry 只注册原 4 个 atomic skill,无 glob/动态导入会拾取它 |
| `src/skill/atomic/pdf_processor.ts` | 同上,未完成脚手架;符号零按名引用,registry 静态导入只含其他 4 个 |
| `src/skill/atomic/xlsx_processor.ts` | `readFile/writeFile` 占位返回空,**根本没 import xlsx 库**;即便被调也什么都不做 |
| `src/domain/medical-research/skills/composite/systematic_review.ts` | 导出 `systematic_review` 仅作为字符串 id 出现在 config.yaml/researcher.yaml,**无 loader 把字符串解析到本模块**;真 SkillRegistry 硬编码 4 个不相关 skill |

**判定:investigate** —— 要么**写完并接线**(若仍在路线图),要么**删**(若是弃案脚手架)。这是"做一半的活",不是历史死代码。**这是第一刀最安全的起点(见 §9),但前提是你拍板"这些能力不再做"。**

---

## 5. 高误报区(静态工具在本架构里**必然误判**的地方——校准的核心交付)

| 区域 | 为什么静态工具误判 | 正确判据 |
|---|---|---|
| `.claude/scripts/*.mjs` 入口脚本 | 被 **Claude/git hook**(`core.hooksPath=.claude/.githooks`,pre-commit 跑 guardrail+env_hygiene_gate)和 **CI `node x.mjs`** 调用,永不被 import → knip 全标 unused | 查 `.claude/.githooks/`、`.github/workflows/` run-step、`package.json` scripts(**已编入 `knip.json` entry**) |
| `_meta/contracts/scripts/*.mjs` | 被 contracts-gate/learning CI 直接 `node` 调 | 同上(已编入 entry) |
| `systems/information-radar/src/**`(generators/providers/storage) | 通过 **DI / 符号注册**接线(`gemini.ts`/`zhipu.ts`/`daily-digest` 等都 `symbol_wired=true`)→ 文件名 xref 看不到 | 抓**导出符号名**而非文件名 |
| skill-id in YAML | `evidence_grading` 等靠 config.yaml 的 **skill-id 字符串**接线 | 抓 skill-id 字符串(但要确认**真有 loader 解析**——见 §4 反例) |
| `tests/test_*.mjs`(前缀命名) | 不带 `.test.` 中缀 → vitest 默认 glob 不收;实际由 CI **per-file `node --test`** 跑 | 查各 CI workflow 的显式 test 命令(已编入 `knip.json` entry `tests/**`) |
| 跨文件 grandfather enforcement 读边 | `drift_monitor.isDriftBlocked` 被 `execution_gate` import 但带 superseded 头 → jscpd/文件头 单看会误判"可删" | 抓**导出符号的真实 import 边**,核 ADR 的 preserved/EXCEPTION 条款(§3b 教训) |
| 外部 launchd(`~/Library/LaunchAgents`) | 仓库内完全不可见 | **本报告已实查**:liye_os 仅 `manifest-reality-clock.py` 一个 |
| `.git/hooks/pre-push` | 被 `core.hooksPath` 覆盖 → **本身是死的**(顺带发现) | 查 `git config core.hooksPath` |

---

## 6. 需人工治理判定的对象(机器不该碰)
- §3a 整组休眠子系统:升级 vs 退役(ADR-Learning-Stack-Generations 管辖)。
- §3b drift_monitor:**partial-retire**(先分离 `isDriftBlocked` 活面再退役其余),走 Hard Gate 1 字节级回归;tier_manager:clean-retire 候选,但仍是治理时点决策。
- §3c SFC 脚本:是否仍是手动运维工具。
- `learned_policy_loader.mjs`:被 `keep`(可能是休眠管线的一部分,但实现完整),随 §3a 一起决策。
- 一切带 `STATUS: superseded` / `RETIRED` 头的文件:删除时机是治理时点,不是清理时点。

---

## 7. 保留 / 废弃 / 合并 / 迁移 分组(32 个深查候选)

**KEEP(11)——knip 误报,实为按符号接线的活代码,勿动:**
`src/brokers/interface.js`、`src/context/eventlog.js`、`src/domain/medical-research/skills/atomic/pubmed_search.ts`、`learning/learned_policy_loader.mjs`、`information-radar` 的 6 个(daily/weekly-digest、prompts、gemini、zhipu、wecom-app、signal-store)。

**cut-2 后分组(以 §2 cut-2 更正为准,此行已替换旧"DEPRECATE/候选删"口径):** `src/audit/index/append.ts` **已删**(cut-2,唯一真·孤立死文件);`validate-cost-meter.mjs`、`dev_run_once.mjs` **保留并加 STATUS 头**(休眠 guardrail / dev-only 手动调试,**非弃案**);`src/mission/ingest.js` 归 **EVO-E broker 层治理**(activate-or-retire 开放决策);`proactive/scheduler.mjs` 归 **§3a proactive 组治理**。⚠ 后两者绝不当孤立死文件单删。

**MERGE(低紧迫·抽 helper,非老vs新):** 抽共享 `jaccard()`(`control/registry.ts` ↔ `runtime/orchestrator/router.ts`);抽 pydantic field-builder(`crewai_adapter.py` ↔ `governed_tool_provider.py`);合并 `policy_trial_evaluator.mjs` 内 `buildPolicyTraceIndex`/`buildPolicyFileIndex`。brokers 4 adapter 的 boilerplate 是有意 Strategy 模式,低优先。

**RETIRE(治理决策,⚠ 非一刀):** §3a proactive+v0 管线(整组升级 vs 退役);§3b **拆分** —— drift_monitor = `partial-retire`(保留 `isDriftBlocked` 活面 + 字节级回归)、tier_manager = `clean-retire` 候选。

**FINISH-OR-DELETE(表面工程):** §4 的 csv/pdf/xlsx_processor、systematic_review —— **cut-1 已删**(PR #176;impl 弃案,capability 保留;config 里的 skill-id 意图声明保留)。

---

## 8. 证据链原则(贯穿全报告)
每个候选都带:**工具命中**(knip/jscpd/vulture)+ **符号 rg**(按名引用有无)+ **入口实查**(CI/hook/launchd/package.json)+ **git**(commit 数 + 最后触碰)+ **治理标记**(ADR/SPEC/STATUS 头)。**无四证不列为可删。** truly-dead 仅 2 个高/中置信,且仍标 investigate——因为弱连接(治理/外部)优先于静态信号。**§3b 的复审更正即由本原则的第①+②证产生:符号 import 边推翻了 jscpd 的表面克隆信号。**

---

## 9. 给第 3 步 B 的输入(不在本报告执行)
1. liye_os 的"乱"= 2 个休眠子系统 + 4 个表面 skill(**cut-1 已删**)+ 孤立死文件**仅 1 个真·可删**(`append.ts`,cut-2 已删;§2 原列 5 个经对抗复核改判 2 保留 + 2 归治理组),**不是系统性混乱**。`src/` 干净。
2. 真正的精简分四条线(**不混成一个大清理 PR**):① 孤立 dead candidates(§2)② finish-or-delete skills(§4)③ v0/GHL 治理性退役(§3,**含 §3b 拆分**,走 ADR)④ 低优先 helper 合并(§7 MERGE)。
3. **第一刀建议从 §4 起(未完成 skill 脚手架)**:registry 硬编码 4 个 skill、csv/pdf/xlsx/systematic_review 占位未接线,删除面最小、活边最少——**但须你先拍板"这些能力不再做"**。**第一批代码改动不要碰 §3b**(有活边,要先做 enforcement 面分离)。
4. **knip 已校准(本 PR 已落 `knip.json`)**:175→47(−73%),残留 100% 在 `src/`。下一步值得逐条看 `unused exports/types`(配置后可信度提升),并把 47 残留逐个过 §8 四证再决定。
5. **若要扩到其它 repo**:每个 repo 单独跑、单独定 `knip.json` entry,**别混跑整个系统**(信噪比会崩)。
