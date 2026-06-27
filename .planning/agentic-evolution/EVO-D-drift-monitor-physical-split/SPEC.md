# EVO-D SPEC v1.2 — drift_monitor 物理拆分（isDriftBlocked enforcement 抽取 + 死面退役）

**Status**: **v1.2**（operator 已 Accept + 裁 F1-F8 + 3 findings amend 完成，2026-06-27；**EVO-D IMPL 未启动**，须 operator 明示「go」+ 确认 OQ-4 piggyback）
**Date**: 2026-06-27 seed → 6-lens 自红队 fold v1.1 → **operator Accept + 裁 F1-F8 + 3-findings amend v1.2（2026-06-27）**
**输入基线**: liye_os main HEAD `ed780b4`（#177 已合并；ADR-008 Accepted + EVO-C IMPL `ff271ec` 已 on main）
**上游权威**: `_meta/adr/ADR-Learning-Stack-Generations.md`（ADR-008，Accepted 2026-06-12）；本 SPEC = 其 R-2 之后、Non-goals L145 显式 deferred 的「物理搬迁」首次解冻
**Pattern 来源**: Ch9 Learning（lifecycle 单一权威）· Ch8 Memory（append-only 审计连续性）
**证据权威序**: **Invariant/Interface 行为 > grep 实证 > 符号名 > 行号（行号仅指针，ADR/header 旧行号 :421/:266 已漂，承重锚一律用符号）**
**Ground-truth recon**: `wf_d9f4735f-d54`（6-agent，全 high-confidence）
**Red-team fold**: `wf_2e56e9b0-e9c`（6-lens：byte-equiv / retirement-completeness / governance / honesty / hardgate-dod / completeness）→ **1 HIGH + 9 MED + 7 LOW 全 fold；18 REFUTE = coverage proof**。fold 全为 disclosure/citation/test-design/governance-precision 外科修正，**未动核心技术方案**（字节级抽取 + import 重定向 + 死面整删 + ADR 授权均 verdict-SOUND）。

---

## Goal

把 `drift_monitor.mjs` 的**唯一活面** `isDriftBlocked()`（D-A3 保留的 read-only enforcement 读）**字节级**抽取为独立 enforcement primitive 文件，让活的 `execution_gate.mjs` 不再 import 一个 superseded 文件；随后**物理退役** `drift_monitor.mjs` 的全部死面（主动降级/quarantine/CLI），并同步处置其下游引用。

**一句话**：enforcement 读面独立留任，superseded 死面物理消失，`execution_gate` 不再背着一具 95% 死代码的躯壳。

**非目标**（守 ADR-008 Non-goals + 本 SPEC scope）：
- **不修 isDriftBlocked 的写侧**（quarantine/drift_triggered 产生逻辑）——写侧重生归 GHL 2b/2c（GHL-BACKLOG C-1/C-2），按 ADR **D-A4**「按 GHL 规范重生」（= 新 location/schema，见诚实披露章）。③ 只搬迁读面 + 退役死面。
- **不撤销 D-A3 读边**（即不连 isDriftBlocked 一起删、不去掉 execution_gate 的 drift 检查）——见 **F8**。③ 忠实执行 D-A3「读边留任」+ 物理拆分；是否撤销读边是另一个 enforcement-surface 治理决策。
- **不动 `tier_manager.mjs`**——独立 clean-retire 候选（无活边），另一治理时点决策，不在 ③ scope。
- **不改 isDriftBlocked 的行为一个字节**——逐字搬迁，Hard Gate 1 字节级回归。
- 不引入新 schema、不碰任何 GHL frozen 锚点、不重写 GHL。

---

## 治理定位（⚠ 核心前置，非例行段落）

**③ 是该 learning stack 的 FIRST physical source removal，无先例可援引。** recon 实证（`wf_d9f4735f-d54` agent-3，git `show --stat ff271ec`）：EVO-C（PR #169 / `ff271ec`）对全部 6 个 superseded 文件 **100% 纯注释插入、零删除零搬迁**，6 文件至今全在 main；EVO-C 全 PR 唯一删除是一个 config YAML token（`tier_manager_approval`），且那一个 token 删除都靠专门追加 Decision Log **D-09** 授权。

**授权触发器（fold F-GOV-1：PRIMARY vs supporting 已厘清）**：
1. **PRIMARY = ADR-008 Hard Gate 4（L88，unambiguous）**：「全部改动 = 注释/文档/测试标记级（surgical scope）；任何超出（如**物理搬迁**）须回本 ADR 增补 Decision Log」。③ 创建新文件 + 物理删 drift_monitor.mjs = 无疑的物理搬迁 → **必须回 ADR 授权**。这条与 grandfather 论据无关、独立成立。
2. **supporting（非 load-bearing）= 治理图状态改变**：拆分后新边指向一个 fresh、非-superseded 的 `drift_enforcement.mjs`（原文件的 superseded/grandfather 头随删除消失），把「superseded 模块的既存边」变成「干净 enforcement 原语的边」。
3. **⚠ citation 更正**：「既存边 grandfathered，no-NEW-references 不溯及」**不是 ADR D-A3 的措辞**（D-A3 L75 只说「依赖保留，drift_monitor 降格为只读库」）——该 gloss 的 canonical home 是 **EVO-C 写入的文件头 `drift_monitor.mjs:11` + EVO-C SPEC §D-1**（D-A3 的下游 operationalization）。本 SPEC 不以 file-header gloss 冒充 ADR 决议；且 grandfather 单读**不充分**（搬迁不新增消费者，execution_gate 仍唯一边），故授权理由以 PRIMARY（HG4 物理搬迁）为准。

⇒ **③ 不是 cleanup，是一次需正式治理授权的 scope-unfreeze**（反转 ADR-008 Non-goals L145 的显式 deferred 项）→ 见 **F1**。

---

## Fork 裁决（operator 已裁 2026-06-27；全部采纳 SPEC recommendation）

> **operator 裁决记录（2026-06-27，权威）**：
> - **F1 = (a)** ADR-008 增补 Decision Log **D-11** append-supersede；**D-01..D-10 保持 append-only、不回写历史段**；不新起 ADR-009。
> - **F2 = `drift_enforcement.mjs`**。
> - **F3 = (a)** 留 `src/governance/learning/` 同目录（PROJECT_ROOT 路径等价硬约束，非审美）。
> - **F4 = (a)** 整删 `drift_monitor.mjs`，**不留 re-export shim**。
> - **F5 = (a)** 删 week3 Test7/8，**不改写为只读断言**；新 `test_drift_enforcement.mjs` 承接读面覆盖。
> - **F6 = (a)** 删 `drift_monitor_integration` 块；概念转登真实 backlog 文件（OQ-3）。
> - **F7 = (a)** 冻结快照不回填。
> - **F8 = (a) 不撤销 D-A3 读边**。isDriftBlocked 当前恒 `{blocked:false}` 不是足够理由；删读边会改 execution_gate 行为面 + `denied_by='drift_monitor'` 契约链 = 另一个治理决策（不在 ③ scope）。
>
> 下表 Recommendation 列即被采纳项，保留作裁决依据/rationale。

| # | Fork | 选项 | Recommendation（= 已采纳裁决） |
|---|------|------|----------------|
| **F1** | ADR 授权落点 + 机制 | (a) ADR-008 增补 Decision Log **D-11** + 就地修订 Non-goals L145 / D-A1 L73 的 deferred 语句 ；(b) 新起 **ADR-009** | **(a)** — ⚠ **fold F-GOV-2/COMP-03 修正**：③ 反转的是 Non-goals L145 **显式 deferred 项**（非「R-2 计划内既定 phase」，此前措辞过度）。真先例 = **D-10**（经 Decision Log 条目授权后**就地纠正** ADR 规范文字 Context/D-A1/HG1 + append-only 记录），**非** D-09（D-09 删的是外部 config token、未反转任何 Non-goal）。③ 是**规范性决策反转**（deferred→unfrozen），比 D-10 的事实纠正更强。**机制建议 append-supersede**：D-A1 L73/Non-goals L145 原文保留 + 加 `superseded-by-D-11` 指针（而非静默 in-place 改写），使解冻轨迹可审。新 ADR-009 会割裂 stack-generations 叙事。⇒ 见 **OQ-4**（Non-goal 反转的 cooling/re-ceremony 适用性）。 |
| **F2** | 新文件命名 | `drift_enforcement.mjs` / `drift_freeze_check.mjs` / `drift_block_check.mjs` | **`drift_enforcement.mjs`** — 呼应 D-A1「enforcement primitive, not learning lifecycle」；三者皆 lint-safe。 |
| **F3** | 新文件落点 | (a) `src/governance/learning/`（同目录）；(b) `src/governance/enforcement/` | **(a) 同目录** — ⚠ **硬技术约束（red-team BYTE-R2 实证）**：`PROJECT_ROOT=join(__dirname,'..','..','..')` 三级上跳依赖同目录深度（learning→governance→src→root 恰 3 级）；移出会改 `POLICIES_DIR`/`DRIFT_FACTS_FILE` 绝对路径 → 破坏字节级等价（HG1 红），且须改 path 推导式 = 不再「逐字搬迁」。语义由文件名（F2）+ header 承载，落点 ≠ 语义分类。 |
| **F4** | drift_monitor 死面处置 | (a) 整文件物理删 ；(b) 保留薄 re-export shim | **(a) 整删** — EVO-C 已给「软」标记层；③ 是「硬」退役本意。shim 留半死躯壳且仍需清理同样下游引用。 |
| **F5** | week3 Test7/8 处置 | (a) 整删两 LEGACY 用例 + section-4 调用 ；(b) 改写为只读断言 | **(a) 整删** — Test7/8 execSync 跑的正是被退役的死 CLI（active-demotion path），改写无对象；已标 LEGACY。isDriftBlocked 覆盖由 D-4 新单测承接（更强：补当前零覆盖的 2 分支）。 |
| **F6** | `execution_tiers.yaml` `drift_monitor_integration` 死配置 | (a) 删块 + 3 处 stale 注释 ；(b) 留 documented-dead-config | **(a) 删** — red-team RT-11/COMP-R4 实证：该顶层块**唯一读者 = 被 D-3 删除的 drift_monitor.mjs**（`:59`/`:66`），删块后 0 剩余消费者（不止「validator 不解析」），与 EVO-C 删 `tier_manager_approval` 同纪律；概念随写侧归 GHL 2c（OQ-3）。 |
| **F7** | 冻结快照类引用 | (a) 保持原样（历史快照不可变）；(b) 加 errata | **(a) 原样** — `evidence/*.json`（knip-ignored，red-team F-RT-4 实证无 CI 校验其路径）+ 见 D-5 白名单扩充。 |
| **F8** | 是否同时撤销 D-A3 读边（连 isDriftBlocked 一起删 + execution_gate 去 drift 检查） | (a) **否，保留读边**（③ 守 D-A3）；(b) 是，一并撤销 | **(a) 否** — ⚠ **fold RT-01/honesty 引出的诚实选项，须 operator 知情**：isDriftBlocked 当前恒 `{blocked:false}` 且写侧将被 GHL 2c 孤儿化（见诚实披露章），「连读边一起删」是逻辑上存在的更激进选项。但撤销 D-A3（Accepted 决策的读边留任）= 另一个 enforcement-surface 治理决策，**超出 ③「物理拆分」scope**；且保留读边有独立稳健理由（defense-in-depth + `denied_by='drift_monitor'` 契约链）。③ 默认 (a)。若 operator 选 (b)，SPEC 须重写为「enforcement-surface 撤销」而非「拆分」，另起治理。 |

---

## Deliverables（v1.2，单一 surgical PR）

> 代码改动面 = **1 新文件 + 1 行 import 改 + 删 1 文件 + 新测试 + 下游同步点 + ADR 增补**。

### D-1 — 字节级抽取 isDriftBlocked → 新 enforcement primitive 文件
新建 `src/governance/learning/drift_enforcement.mjs`（命名待 F2），**逐字符照搬**：
- `isDriftBlocked()` 函数体（drift_monitor.mjs，三分支：① `policy_in_quarantine` ② `recent_drift_triggered`（<24h）③ `{blocked:false}`）；
- 依赖闭包 4 常量：`__dirname` / `PROJECT_ROOT = join(__dirname,'..','..','..')` / `POLICIES_DIR` / `DRIFT_FACTS_FILE`；
- 5 import：`existsSync, readFileSync`（fs）+ `join, dirname`（path）+ `fileURLToPath`（url）——**不多不少**（red-team BYTE-R1 实证闭包自包含，不调任何 module-local helper、不 parse yaml）。
- 文件头 header：标明本文件是 D-A3 保留的 read-only enforcement 读（接 execution_gate preflight），行为冻结/字节级回归 under HG1；**忠实披露当前休眠语义**（见诚实披露章）。
- **纯库**：只 `export function isDriftBlocked`，**无 CLI / 无 isMain / 无可执行入口**。

**字节级等价充要条件清单（DoD 逐条验收）**：①新文件同目录（F3=a）；②`__dirname`/`PROJECT_ROOT` 推导式逐字符照搬；③`POLICIES_DIR`/`DRIFT_FACTS_FILE` 常量定义逐字符照搬；④import 集合 = 上述 5 个不多不少；⑤函数体逐字符照搬（含 `sort by new Date` / 24h 阈值 / `JSON.parse` try-catch）。

### D-2 — execution_gate import 重定向（唯一代码消费点）
`execution_gate.mjs` import 行 `'./drift_monitor.mjs'` → `'./drift_enforcement.mjs'`（同目录，`'./'` 前缀不变，**只改文件名**）。
- **调用点与下游不变**：`isDriftBlocked(policyId)` 调用、`denied_by`/`check` 名 **字符串字面量 `'drift_monitor'` 冻结绝不跟改**（red-team BYTE-R3 实证：该串是写死常量非由 basename 派生，是 write_executor 回执 + hardhook 断言 + `evidence_s1_phaseb_execution_gate.json` 的公开契约，与文件名解耦）。
- 全库 isDriftBlocked 的 import 只此一处（其余均 .md 文档），无 barrel/re-export。

### D-3 — drift_monitor.mjs 死面物理退役（F4=a 整删）
删除 `src/governance/learning/drift_monitor.mjs` 整文件。退役死面 = isDriftBlocked 外的全部：`evaluateDrift` / `executeDemotion` / `appendDriftFact` / `analyzeBusinessSignals` / `loadMonitoredPolicies` / `loadFacts` / `loadTiersConfig` / CLI。recon 实证零外部消费者（evaluateDrift 仅 main 自调，executeDemotion 仅 evaluateDrift 自调）。

### D-4 — 新增测试锁 isDriftBlocked 字节等价（⚠ 必做，补当前覆盖缺口 + fold 后机制重定）
recon 实证：**isDriftBlocked 当前测试覆盖 = 1/3 分支且间接**（仅 hardhook `test_quarantine_policy_blocks_write` 经全栈覆盖分支①；分支② recent_drift_triggered + 分支③ clean→false **零覆盖**）。**必须先补测试再拆**（HG5）。新增 `tests/governance/test_drift_enforcement.mjs`：

1. **三分支直接单测**（承重守门体）：① 构造 quarantine yaml → `policy_in_quarantine`；② 构造 <24h `drift_triggered` fact → `recent_drift_triggered`（+ >24h 边界 → false）；③ 无 quarantine/无近期 drift → `{blocked:false}`。
2. **路径同一性 = 行为式断言**（⚠ fold RT-04/hardgate）：**不**直接断言绝对路径字符串（那须 export 内部常量、破 D-1 逐字搬迁），改为「在期望绝对路径构造 fixture → blocked=true；构造于错误路径 → false」的行为反差守护（防常量改名静默转 allow=假绿）。
3. **golden byte-equivalence（⚠ operator 已裁 Finding-2：可选本地证据，非 CI 必需 — 消解 v1.1 内 point3/DoD 矛盾）**：
   - **承重 CI 闸 = point1 三分支直测 + point2 行为式路径断言（二者 BLOCKING）**；golden 与三分支直测在「逐字符照搬」前提下**冗余**（三分支直测已 pin 精确输出，即原 (ii) 分支），故 golden **不作 CI 必需项**，仅作 PR 本地一次性证据/可选补充。HG1/D-7 承重锚定 point1+point2。
   - 若仍采集 golden（可选、非必需）：因 D-3 同 PR 物理删旧实现、**无运行时 A/B live diff 可做**，须在删除前同一进程内对同组 fixture 调旧 `drift_monitor.isDriftBlocked` 采期望、内嵌为冻结字面量；**绝不在默认空盘态采集**（空盘态三 policyId 全 `{blocked:false}` → 平凡相等、完全不触分支①/②，是假绿通路；诚实披露章实证当前真实磁盘恒 false）。
   - 分支② 的 `drift_event` 回显内嵌 fixture `timestamp` + `hoursSince<24` 依赖 `new Date()` 实时钟 → fixture 用 **now-相对时间戳**；断言对 `drift_event.timestamp` 做归一化/排除后只断言 `{blocked, reason}`（否则持久化 golden 会随时间腐烂/分支翻转）。
4. **fixture 落地策略**（⚠ fold RT-02/hardgate，cut-2/1e 教训）：分支①/② fixture **必须运行时在硬编码生产路径 materialize + `finally` cleanup + 若预存则 backup/restore + 每分支唯一 policyId 隔离**（照 hardhook `test_quarantine_policy_blocks_write` 的 materialize+unlink 模式）。**禁止提交式 fixture 落 `state/memory/facts/`**（`.gitignore` 整目录吞噬，`git add -f` 是反模式不用）；测试自行 `mkdirSync` facts 目录（module 只读不建）。
5. **CI-wire** 进 `execution-tiers-gate.yml` governance-tests job（与 hardhook 同处），**BLOCKING（step 无 `|| true`，红即阻断 job）**。

### D-5 — 死面下游同步点处置（recon + red-team 穷举）
| # | 点 | 处置 | 性质 |
|---|----|------|------|
| 1 | `test_week3_tier_drift_kill.mjs` Test7/8（drift/false_positive）+ section('4. Drift Monitor Tests') 调用 | **删**（F5=a） | 🔴 **BLOCKING**：execSync 死 CLI，删文件→exit 1→catch fail→governance-tests job（无 `\|\| true`）红（red-team RT-09 实证） |
| 2 | `execution-tiers-gate.yml` 'Drift Monitor Dry Run' step（`\|\| true`） | **删该 step** | 非阻断悬挂死步 |
| 3 | `execution_tiers.yaml` `drift_monitor_integration` 块 + 3 处 stale 注释 | **删**（F6=a） | 唯一读者=待删文件，删 0 风险 |
| 4 | `knip.json` `drift_monitor.mjs` entry | **仅删旧 entry，不加 drift_enforcement.mjs entry**（⚠ fold 多 lens 一致） | drift_enforcement 是纯库、经 execution_gate（已是 entry）import 即可达；加 entry 会抑制其 unused-export 检测、与 D-1 纯库角色矛盾。knip 无 CI 接线，非阻断 |
| 5 | `docs/runbooks/week3-tier-drift-kill.md` 死指针 | **改/删 + 落 EVO-C DEFER 的 AC-04 banner** | doc-only |
| 6 | `execution-tiers-gate.yml` coverage-grep `expected_tests` 的 `drift`/`false_positive` token（WARNING-only） | **更新数组 或 接受非阻断 WARNING** | 卫生（red-team RT-06 实证只 echo 不 exit） |
| 7 | `.planning/agentic-evolution/EVO-C-stack-reconciliation/GHL-BACKLOG.md` 的 drift_monitor.mjs `file:line` 设计教训指针（C-1 :226-229 / 缺陷 :174-177/:135 / C-2） | **改 commit-pinned git ref 或内联 buggy 代码片段**（⚠ fold RT-03/honesty） | 它是 GHL 2b/2c 重生的**功能性 forward-reference，非冻结快照**，文件删除后指针失效；须使设计教训可追 |

**确认非同步点（白名单，⚠ fold 扩充）**：`package.json`（0 引用）、`evidence/*.json`（冻结历史快照，knip-ignored，无 CI 路径校验）、`.planning/baseline/archive/GHL-evolution-plan-v3-superseded.md`（冻结 superseded 归档）、`docs/methodology/.../liye-os-static-analysis-calibration-2026-06-27.md`（self-declared READ-ONLY + dated 校准产物，同 evidence 冻结性质）。这四类按「历史快照不可变」原则**不回填**。

### D-6 — ADR 治理授权（HG4 前置；F1=a，⚠ reconcile 清单重写 + append-only 围栏）
在 `_meta/adr/ADR-Learning-Stack-Generations.md` **append Decision Log D-11**（append-only，**D-01..D-10 字节不变**），授权本次物理搬迁，机制承 **D-10**（就地纠正规范文字 + append 记录的真先例，非 D-09）。

**就地修订范围 = 仅 live 段**（⚠ fold F-GOV-4：append-only 围栏）：
- **D-A1 L73 / Non-goals L145**：append-supersede 标注「drift_monitor 这一支物理搬迁已由 D-11/EVO-D 解冻」（原文保留 + 指针；其余 superseded 文件仍 deferred）。
- **Context 表行（含 drift_monitor.mjs 文件名 + 旧行号 :226-229/:421-453/:19）+ Risk Register（:168-170/:128 设计教训指针）**：这才是真正 stale 的 drift_monitor 行号所在（⚠ fold F-GOV-3：原 SPEC 误列 N-5/D-A2 + 漏这两处）。reconcile 按拆分后实态。
- **D-A2**：从「行号 reconcile」改为**superseded-list 语义更新**（drift_monitor.mjs 已删 / isDriftBlocked 迁 drift_enforcement.mjs 非 superseded）——D-A2 本无行号。
- **D-A3**：聚焦边/文件名（execution_gate → drift_enforcement）。
- **N-5 不动**（实测零 drift_monitor 引用，是 write_executor→execution_gate，③ 不改 execution_gate 身份）。
- **两类区分**：isDriftBlocked → drift_enforcement.mjs 是 **reconcile**；死面行号（:226-229/:168-170）无「新位置」可 reconcile → 标 **retired/git-history**。
- **append-only 段不动**：Decision Log **D-01..D-10**（含 D-02「execution_gate→drift_monitor 边」、D-08 多处引用）按 append-only **保留对已删 drift_monitor.mjs 的历史引用**（写当时该文件存在，是历史记录非 live 索引）→ 故 DoD「无死指针」**限定为「live 段无死指针」**（与证据权威序 L8 行号-漂移容忍一致）。
- **ADR 自洽**：顺手勾上 stale 的 EVO-C Adoption Checkpoint（#169 `ff271ec` 已 merged）+ Rollout Phases 表补一行（R-4/EVO-D：物理搬迁，授权=D-11）。
- **保 BGHS 格式**：编辑须保 frontmatter 5 键 + `# ADR` H1 + `**Status**: Accepted` + `**Accepted-Date**:` 不变（adr-bghs-gate 是 BLOCKING，见 DoD）。

### D-7 — 字节级回归证据（Hard Gate 1）
hardhook 7 例全绿（承重 = `test_quarantine_policy_blocks_write`，⚠ **符号锚非序号**——它在文件标 `// Test 3`/section 3、run-order 第 5，唯一断言 `denied_by==='drift_monitor'`；原 SPEC「Test5」是误指，文件字面 `// Test 5` 是 policyId=null 的正例放行无 drift 断言，fold RT-03/hardgate）+ D-4 三分支直测 + 行为式路径断言绿（golden = 可选本地证据，非闸，Finding-2）。证据表随 IMPL PR。

---

## Hard Gates（执行约束）

1. **HG1 — write_executor → execution_gate → isDriftBlocked 字节级回归 0 变化**。真守门体 = `test_execution_gate_hardhook.mjs`（7 例，BLOCKING）尤 `test_quarantine_policy_blocks_write`（quarantine→`denied_by==='drift_monitor'`）+ D-4 三分支直测。isDriftBlocked 逐字搬迁、execution_gate 仅改 import specifier 一行、契约串 `'drift_monitor'` 字节不变。
2. **HG2 — GHL frozen 锚点 0-diff**。7 blob（`e63cf86c`/`54944884`/`5057fc5a`/`96285406`/`3f9ad911`/`39f02581`/`42b05d04`）全在 `scripts/`+`.claude/scripts/learning/`+`src/reasoning/`，与 ③ 的 `src/governance/learning/` **零路径交集**（ceremony LD-06/RF-02 证无 frozen importer），平凡满足。
3. **HG3 — validate-contracts gate 维持 21**。③ 零 schema 增删。⚠ **21 = 16 schemaFiles + 5 其他 pass，21 ≠ schemaFiles 长度（=16）**（red-team RT-08 实证，比上游 ADR loose 措辞更精确），禁为「对齐数字」动 schemaFiles。三源实测 before==after。
4. **HG4 — ADR Decision Log 增补授权物理搬迁（治理前置，PRIMARY）**。无 D-6 的 ADR 授权，本 PR 越过 ADR-008 自身 Hard Gate 4，治理上不合法。**D-6 必须与代码改动同 PR。**
5. **HG5（③ 特有）— isDriftBlocked 逐字搬迁，禁顺手简化/重构**。搬迁过程任何「清理」未覆盖分支（②/③）= 行为漂移；唯一闸 = D-4 三分支直测（**先补再拆**）+ 行为式路径断言（现有 hardhook 仅覆盖分支①）；golden 为可选本地证据、非闸（Finding-2）。

---

## Definition of Done

- [ ] hardhook 7 例全绿（HG1，尤 `test_quarantine_policy_blocks_write` → `denied_by='drift_monitor'`）。
- [ ] D-4 新测试绿且 **CI-wired 为 BLOCKING（step 无 `|| true`）**：三分支直接单测 + 行为式路径同一性（**二者为 CI 必需闸**）；golden = 可选 PR 本地证据，**非 CI 必需**（operator 裁 Finding-2）。
- [ ] `validate-contracts` Passed: **21** before==after（三源实测，HG3）。
- [ ] 7 GHL frozen blob 0-diff（HG2）。
- [ ] **CI 全绿清单**：`execution-tiers-gate.yml`（governance-tests / validate-execution-tiers / integration-check）+ **`adr-bghs-gate.yml`（BLOCKING，D-6 编辑 ADR 触发，⚠ fold F-RT-1）** + 旁触发 `mcp-federation-ci` / `replay-ci-gate` / `layer-dependency-gate` 绿。
- [ ] **`node .claude/scripts/validate_adr_bghs.mjs` 通过**（ADR 编辑后，⚠ fold F-GOV-5）。
- [ ] D-5 七同步点全处置：无悬挂 CLI 引用 / 无死配置 / live 段无死指针 / knip 仅删旧 entry / `.planning/agentic-evolution/EVO-C-stack-reconciliation/GHL-BACKLOG.md` 指针 git-pinned。
- [ ] **grep 证零残留代码 import `'./drift_monitor.mjs'`**（仅 evidence/docs F7 残留，⚠ fold RT-05/hardgate）。
- [ ] 契约串 `'drift_monitor'`（execution_gate denied_by/check 名）grep 实证字节不变。
- [ ] ADR-008 Decision Log **D-11** 增补 + D-A1/Non-goals append-supersede 标注 + Context/Risk live 段 source-reconcile + EVO-C checkpoint 勾选 + Rollout 表补 EVO-D 行（HG4）。
- [ ] `drift_monitor.mjs` 物理消失（F4=a）；新 `drift_enforcement.mjs` 存在且纯库无 CLI。
- [ ] **合并前置（非 CI）**：编辑 `.github/workflows/` 触发 CODEOWNERS `@liyecom/governance-team` 必审（⚠ fold F-RT-3/COMP-01），需 operator 协调（EVO-C 已走过同门）。

---

## 诚实披露（⚠ 反「谎标 enforcement」纪律，EVO-C CEREMONY LD-02/EB-01 教训 + 本次 RT-01 自纠）

recon disk 实证（agent-4）：**isDriftBlocked 当前对合法 policyId / 当前数据下恒返回 `{blocked:false}`**——quarantine 目录仅含 0 字节 `.gitkeep`（分支① existsSync 永 false）；`fact_drift_events.jsonl` **文件 ABSENT** 且被 `.gitignore` 忽略（分支② 跳过）。其两条 blocked 分支的**写入者（executeDemotion/evaluateDrift 死面）已于 D-A2 冻结，更强——从未在任何 scheduler 上 non-dry-run 跑过**（唯一运行态全是 `--dry-run`，零落盘）。

⇒ **SPEC/header 绝不可把 isDriftBlocked 描述成「活跃 24h freeze enforcement」。** 正确表述 = **「数据驱动的休眠 enforcement 读：每次 WRITE_LIMITED preflight 真被执行（live edge），但因写侧空数据恒 `{blocked:false}`（dormant effect）」**——live edge 与 dormant effect 并存，不矛盾。

**为何保留（不删）这条读边（⚠ RT-01 HIGH fold：理由诚实化，决策不变）**：
- ❌ **原 SPEC 的理由「接生产即生效 / GHL 2c 重生时既存读边自动拾取同一 disk 位置 / 无需再碰 execution_gate」不成立**——它被自身引证否证：GHL-BACKLOG **C-1** 明令 GHL 2c demotion = 「**append-only lifecycle event，非破坏性文件移动**」，**C-2** = 「冻结触发逻辑 lifecycle 化」，现行 GHL frozen evaluator 把 quarantine 视为 **read-only SKIP、从不写该 YAML**，ADR **D-A4**「按 GHL 规范重生」implies 新 location/schema。故 GHL 2c 会写**自己的 schema/位置**，isDriftBlocked 读的两条 v0 legacy 路径将被**孤儿化而非自动拾取**；要「接生产即生效」反需 GHL 2c 复活 ADR 明令退役的破坏性移动 anti-pattern。
- ❌ **「接生产即生效」也不属 D-A3**——D-A3（L75）只说「读边保留为只读库」；该短语在 ADR 仅出现一次（:55），属 `runtime/execution/kill_switch.mjs` 的 **P6C supervised-write gate 语境**（D-10 更正），与 drift 无关。SPEC 停止以 D-A3 背书该短语。
- ✅ **真正稳健的保留理由**：(1) **③ scope 守 D-A3 既定**（读边留任是 Accepted 决策，撤销它是另一个 enforcement-surface 治理决策，见 F8）；(2) 删 drift check 会**改 execution_gate 行为面**、破坏 `denied_by='drift_monitor'` **契约链**（write_executor receipt + hardhook + evidence）、移除 **defense-in-depth**；(3) **重激活是条件式**——当且仅当未来 GHL 2c 选择回写 legacy 路径，**或** `drift_enforcement` 读侧届时改读 GHL lifecycle event 流（按 C-1 charter 预计**届时需再触代码**，非「自动」）。

**③ 只搬迁读面 + 退役死面，绝不在本 PR 修写侧。** 新文件常量仍指向同一 `state/` 路径（保 D-A3 读边形状不变）。

---

## Risk Register

| 风险 | 等级 | 缓解 |
|------|------|------|
| 新文件落点偏移 → PROJECT_ROOT 漂移 → isDriftBlocked 静默读错路径（不报错，恒 false 或读错） | **H** | F3=a 同目录硬约束 + D-4 行为式路径同一性断言 + hardhook quarantine 用例（路径错则转 allow=假绿被捕获） |
| 删 drift_monitor 忘删 week3 Test7/8 → governance-tests BLOCKING job 红 | **H** | D-5 点1 列为显式交付；CI 真闸（无 `\|\| true`，red-team RT-09 实证），非软失败 |
| D-4 golden 在空盘态 trivially-pass / fixture 被 gitignore 吞噬 → 假绿 | **M** | D-4 point3/4 重定：三 fixture 态采集 + 运行时 materialize+cleanup + now-相对时间戳，禁提交式 fixture |
| 工程师把 `denied_by='drift_monitor'` 改成 'drift_enforcement' 求一致 → 破 hardhook + evidence | **M** | D-2 明确契约串与文件名解耦 + DoD grep 实证 |
| 越过 ADR Hard Gate 4（无 Decision Log 授权直接物理删）/ adr-bghs-gate 红 | **M** | HG4 + D-6 同 PR + DoD 含 adr-bghs-gate 绿 + validate_adr_bghs 通过 |
| 编辑 `.github/workflows/` → CODEOWNERS `@liyecom/governance-team` 必审卡合并 | **M** | DoD 合并前置项 + operator 协调（EVO-C 先例） |
| 把 isDriftBlocked 谎标「活跃 enforcement」/ 用 false 理由（接生产即生效）污染自我认知 | **L** | 诚实披露章 RT-01 自纠 + header 忠实措辞（休眠读，写侧将被 GHL 2c 孤儿化） |

---

## Open Questions（IMPL 前若 fork 未尽则补裁）

- OQ-1 — **DECIDED: independent**（`tests/governance/test_drift_enforcement.mjs`，与 D-4 一致；operator 裁 Finding-3，IMPL 不再摇摆）。
- OQ-2：D-6 的 live 段 source-reconcile 是 EVO-D 同 PR 全做还是部分留 errata？（建议同 PR 全做 live 段，append-only 段按围栏保留历史引用）
- OQ-3：`drift_monitor_integration` 概念（on_drift_triggered/demote_to）删除时是否转登 `.planning/agentic-evolution/EVO-C-stack-reconciliation/GHL-BACKLOG.md`（同 C-1/C-2）？（建议转登）
- OQ-4（⚠ fold F-GOV-2；**仍待 operator 显式一句确认 = IMPL-go 前置**）：**反转 Accepted ADR 的 Non-goal（deferred→unfrozen）的 cooling/re-ceremony 适用性**。**部分隐含已裁**：operator 选 **F1=(a) in-ADR D-11 append-supersede**（非新 ADR-009、非全 ADR-008 re-Accept），强烈隐含「6-lens 自红队 + operator-Accept = 等价 re-ceremony、无需独立 cooling」的治理立场。**但 operator 未逐字确认 piggyback 合法**——故 IMPL 启动前需 operator 一句明示「OQ-4 piggyback OK / 直接 go」；若 operator 反而要求 ADR 层 re-Accept 或 cooling，则 IMPL 前补该 ceremony。

---

## Anchor

- 上游 ADR：`_meta/adr/ADR-Learning-Stack-Generations.md`（D-A1/D-A2/D-A3/D-A4/Hard Gate 1-4/Non-goals/Decision Log D-09/D-10）
- 前序 EVO-C：`.planning/agentic-evolution/EVO-C-stack-reconciliation/SPEC.md`（注释标记层 + grandfather gloss canonical home）+ `.planning/agentic-evolution/EVO-C-stack-reconciliation/GHL-BACKLOG.md`（C-1/C-2 写侧归属 + 设计教训指针 = D-5 点7 同步点）
- 方法论佐证：`docs/methodology/06_Technical_Development/codebase-hygiene/liye-os-static-analysis-calibration-2026-06-27.md` §3b（drift_monitor = partial-retire，非一刀删；冻结白名单）
- recon：`wf_d9f4735f-d54`（6-agent ground-truth）；red-team：`wf_2e56e9b0-e9c`（6-lens，1 HIGH+9 MED+7 LOW 全 fold）
- **下一步**：✅ operator 已 Accept + 裁 F1-F8（2026-06-27）+ 3 findings amend 完成 → **待 operator 一句「go」+ 确认 OQ-4 piggyback** → EVO-D IMPL（单 surgical PR，守 F1-F8 裁决 + HG1-5）
