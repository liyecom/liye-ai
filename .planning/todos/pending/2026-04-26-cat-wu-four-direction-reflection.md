---
created: 2026-04-26T14:35:00+0800
title: Cat Wu Four-Direction Reflection — Synthesis Design Doc
area: portfolio-reflection
status: design-approved-by-brainstorm-2026-04-26
related:
  - .planning/todos/pending/2026-04-26-cat-wu-five-brainstorm-entrances.md  # sibling — 5 future 延伸 entrances, separate scope
  - <AGE>/docs/superpowers/specs/2026-04-26-asin-growth-evals-bootstrap-v4.1.md  # direction 2 实施 (branch feat/eval-b0-bootstrap-20260426)
  - <AGE>/deliverables/openclaw-port-2026-04-26/  # direction 2 后续实施 (branch openclaw-port-pack-x1-x2-20260426)
  - ~/.claude/projects/-Users-liye-github/7b2573c7-a082-4094-9257-0e74b076f930.jsonl  # full brainstorm trail
---

# Cat Wu 4 方向反思 · 综合设计文档

> **本 doc 性质**：严格 mirror brainstorm session 中 user 真实选答；不掺 Claude 假设的"洞察 / 张力 / 行动优先级"。所有结论都有 jsonl line 号可追溯。

## 0. Source 与 Brainstorm 节奏

- **文章**：Cat Wu / Anthropic 产品方法论文章（20 页全文 + 信息图）
- **Brainstorm session**：`7b2573c7-a082-4094-9257-0e74b076f930` (2026-04-25/26)
- **4 方向选自 line 33** 提出的延伸主题
- **格式**：brainstorming skill「一次一题、multiple choice」严格走完
- **总题数**：方向 1 = 4 + 2 拓展 = 6；方向 2 = 10；方向 3 = 6；方向 4 = 6 → **共 28 题**

---

## 方向 1：投射 Cat Wu 观点到 liye_os / loamwise / AGE 工作方式

### Brainstorm trail

| # | jsonl line | 题目 | user 选答 |
|---|-----------|------|----------|
| 1 | 116 | 过去 30 天重复用过的 GSD-* skill 哪几个？ | (用户澄清排除 GSD，聚焦自写 skill) |
| 2 | 125 | A 组业务 skill / B 组 Session OS 哪组值？ | (ii) "B 组虚 / A 组值" |
| 3 | 148 | Session OS 三系统对比后，有 unique 能力吗？ | (a) 想不到 |
| 4 | 166-176 | Decision-1 锁定 (α 全部 retire)；P/Q/R 选 | (P) + (Q) |
| (P) | 202 | A 组 skill 体检 | → Decision-2 / 3 / 4 |
| (Q) | 210 | 跨 repo 摩擦诊断 | → Decision-5 / 6 / 7 |

### 8 Decisions（line 261 锁定）

| # | Decision | 状态（截至 2026-04-26）|
|---|----------|-----------------------|
| 1 | Retire Session OS（删 6 slash command + 归档 snapshots/history） | 未执行（13 天未用，零风险）|
| 2 | asin-growth SKILL.md 1600 → ~800 行拆解（契约层 vs MVP 脚手架）| 未执行（独立 3-4h session）|
| 3 | loamwise-ops v0.5 观察窗 2026-04-26 到期处置（升级 / 收窄 / 退役）| 2026-04-27 user 拍板 **(D) 再观察 2 周**，新到期 2026-05-10；理由：3 周 0 friction batch + 1 meta observation 反 Phase C 证据，按 design 字面"<10 batch 延长 2 周"；exit-review.md 物化推到 Sprint 8 frozen 之后 (2026-05-03+) 且不晚于 2026-05-10 第二次 exit gate |
| 4 | 自写 skill 砍 frontmatter（`version` / `triggers`）| 未执行（与 #1 合做）|
| 5 | liye_os 24 commits push 卸载认知挂账 | 2026-04-27 **部分卸载**：本地 ahead 25（24 + 反思 doc commit `525ee76`）push 到 `archive/liye-os-local-batch-20260427`，remote SHA match local，消除 SSD 失败丢失风险；**main land 推迟**——main 是 protected (PR + 6 status checks)，25 commits = 111 files / 24983 insertions / 10 deletions，需 topic PR decomposition 独立 session 处理 |
| 6 | Sprint 8 期间禁开 loamwise（read-only 到 2026-05-03T12:00Z）| 部分执行（纪律性）|
| 7 | 每周 AGE-only 时间块 | 节奏层 |
| 8 | 三系统 memory SSOT（Session OS retire 后 claude-mem + auto-memory）| 文档性，与 #1 同根 |

---

## 方向 2：PM 方法论重构发布节奏与评测体系

### Brainstorm trail（10 题）

| # | line | 题目 | user 选答 |
|---|------|------|----------|
| 1 | 261 | 1 人团队 PRD 必要性 | 双阶段产物（先驱 + 交接，PRD 是真实交接物）|
| 2 | 271 | SKILL.md 是契约还是脚手架（同事接手实际读啥）| (f) 多个混合 |
| 3 | 283 | "评测集 = 定义未来"的实践有没有 | (d) 自己也搞不清 G-1..G-6 的来源和性质 |
| 4 | 本次 | B0 + OpenClaw 让 evals 更清楚了吗 | (b) 部分清楚，要 case 真跑 |
| 5 | 本次 | 跑哪个 case | (α) B0C5Q8L7FP（hero / DOG_MAT_TIMO / TRAFFIC_DRIVER）|
| 6 | 本次 | 先跑还是先 rubric | (1) 先跑 17 步，rubric 后建（case-driven）|
| 7 | 本次 | 真实度 | (A) 全真跑（含 step 17 live_write）|
| 8 | 本次 | 验收标准 | (1+2+3+4) 完整性 + 质量 + 学习 + 业务 全 grounded |
| 9 | 本次 | branch / playbook 版本 | (β) 先 review + merge `feat/eval-b0-bootstrap-20260426` 再跑 |
| 10 | 本次 | execution timing | (r) 先完成方向 3/4 brainstorm 再启动跑 |

### B0C5Q8L7FP 完整跑 spec — Q9 user 给的 6 条 hard gate

1. 不在当前混杂 local main 上直接跑 live_write
2. 先 review `feat/eval-b0-bootstrap-20260426`
3. 通过后合并到 clean main
4. 确认 main clean、allowlist / scope / receipt / rollback plan 就绪
5. 再跑 B0C5Q8L7FP 完整 17 步
6. 如果 clean main 或 write gate 不满足，**自动降级为跑到 step 16 停**，不允许绕过 hard gate

### 验收标准（Q8 user 选 1+2+3+4 全 grounded）

| 标准 | 内容 |
|------|------|
| **1 完整性** | 17 步全 emit `step_evaluations/*.json`，框架不崩 |
| **2 质量** | (1) + L1/L2 verdict 全 PASS（Phase 4A-2/5a 现状下大概率部分 FAIL，反映 real gap，不是坏事）|
| **3 学习** | (1) + 跑完 user 自己能写出 R1-R5 rubric 草案 |
| **4 业务** | (1) + measurement_verdict D+0 baseline 抓到 + D+7 follow-up 计划成形 |

---

## 方向 3：日常决策 100% 自动化盘点

### Brainstorm trail（6 题）

| # | 题目 | user 选答 |
|---|------|----------|
| 1 | 切入角度 | (d) 大数据驱动 30 天盘点（不预设分类）|
| 2 | "决策"的边界 | **全选 5 种**：思考 ≥ 30s + git history 改变 + Claude 协作判断 + 重复感 + governance gate 触发 |
| 3 | 谁来盘 + 模式 | (a) Claude 全自动跑 |
| 4 | 输出形态 | (β) topic 聚合 + 频次降序 |
| 5 | 分类 | (1) Cat Wu 4 类：✅ 已 100% / 🟢 应做未做 / 🟡 半自动 / 🔴 保留人工 |
| 6 | 4 类的 default action | (p) 4 类都需要明确 action plan |

### 盘点 Protocol

| 维度 | 决议 |
|------|------|
| Scope | 30 天 |
| 数据来源 | git log + session jsonl + memory（claude-mem + auto-memory）+ hook log |
| 执行 | Claude 全自动跑 |
| 输出 | topic 聚合 + 频次降序 |
| 分类 | Cat Wu 4 类 |
| 每类 default action | ✅ audit / 🟢 ROI 排序逐项实施 / 🟡 推到两端 / 🔴 写进 ~/.claude/CLAUDE.md "人工保留区" |

### 执行时机

未明确 timing；按方向 2 Q10 的 (r) 决策默认 deferred 到 4 方向 brainstorm 完成后启动。

---

## 方向 4：.planning/ 体系是否在"为流程而流程"

### Brainstorm trail（6 题）

| # | 题目 | user 选答 |
|---|------|----------|
| 1 | scope | (d) 整个 LiYe system；找到就消 |
| 2 | surfacing 方式 | (4) Claude 提名嫌疑，user 判断 |
| 3 | 5 嫌疑提名表态 | 全 (M) 进一步盘 |
| 4 | 深盘方式 | (a) 5 个全盘 |
| 5 | 盘点结果表态 | **全 (S) skip — 等运行更久再决策** |
| 6 | deferred trigger | (a) 时间 trigger **2026-05-24（4 周后）回头 review** |

### 5 嫌疑及深盘结果（截至 2026-04-26）

| # | 嫌疑 | 路径 | 深盘结论 |
|---|------|------|---------|
| 1 | loamwise sprint-7 raw_snapshot 19 JSON | `loamwise/.planning/acceptance/sprint-7-raw-snapshot/` | sprint-7-shadow-readout.md 引用 9/19；**10/19 (53%) 未被引用**：A3 / B2 / C2 / D1 / D2 / D3 / D4 / E1 / E2 / Z1 |
| 2 | AGE asin-growth-v4.3 4 份文档 | `<AGE>/docs/asin-growth-v4.3-{handover, runbook, artifacts-and-data-dictionary, open-gaps-and-next-steps}.md` | 半活：3 份 2026-04-09 修改（17 天前）；1 份 2026-03-21（36 天前）；当前 playbook + 2 份 superpowers specs 仍 reference v4.3 |
| 3 | AGE SKILL.md 1600 行 + playbook 1039 行 | `<AGE>/.claude/skills/asin-growth/{SKILL.md, asin-growth-playbook.yaml}` | Step 2 (Auto Discovery + Variant + HCC) 占 32% (519 行)；Decision-2 已识别拆到 ~800 行未执行 |
| 4 | liye_os ADR 重复对 | `_meta/adr/`：ADR-006-Hermes-Memory (297 行) ↔ ADR-Hermes-Memory (521 行)；ADR-007-Loamwise-Guard (362 行) ↔ ADR-Loamwise-Guard (478 行) | 双 SSOT，**内容不同**（不是简单复制，是 evolution：早期编号版 + 后期重写命名版）|
| 5 | loamwise phase memo 13 份 | `loamwise/docs/P2-A/B/C/P2-O/P3-O-*.md` | P3-O 6 份活跃（2026-04-24 修改）；P2-O 4 份已被 P3-O 取代；P2-A/B/C 3 份 phase 已结束 |

### deferred 决策

- 当前判定：**5 嫌疑全 (S) skip**
- trigger：**2026-05-24**（4 周后）回头 review
- trigger 触发前：5 嫌疑保持原状；不做任何 retire / 归档 / 重写动作
- 用户语境：`等整个体系再跑一段时间再决策`

---

## 与既有产物的关系

| 产物 | 路径 | 关系 |
|------|------|------|
| 5 entrances todo | `.planning/todos/pending/2026-04-26-cat-wu-five-brainstorm-entrances.md` | **兄弟**（5 个延伸入口 = 待挖；本 doc 不替代它，scope 不重叠：4 directions ≠ 5 entrances）|
| B0 design doc v4.1 | `<AGE>/docs/superpowers/specs/2026-04-26-asin-growth-evals-bootstrap-v4.1.md` (576 行) | **方向 2 实施物证**（branch `feat/eval-b0-bootstrap-20260426`，未合并 main；按方向 2 Q9 决议要 review + merge）|
| OpenClaw port pack | `<AGE>/deliverables/openclaw-port-2026-04-26/` X1a-X2b | **方向 2 后续实施**（branch `openclaw-port-pack-x1-x2-20260426` 已 push origin review branch）|
| Brainstorm jsonl trail | `~/.claude/projects/-Users-liye-github/7b2573c7-a082-4094-9257-0e74b076f930.jsonl` | 全部 28 题 brainstorm + user 真实选答的原始记录（line 33-2498 + 本次延续）|
| 15 份 ADR | `_meta/adr/` | 治理 ADR；与本反思不同语义（含方向 4 嫌疑 #4 重复对）|
| 8 份 _meta/docs constitution | `_meta/docs/*_CONSTITUTION.md` | 制度宪法；与本反思不同层 |

---

## Status & Next

- **Status**：design approved by brainstorm 2026-04-26（28 题全部 user 选答）
- **本 doc 不含**：行动优先级建议、跨方向"洞察"、Cat Wu "张力"提炼 — 这些都在 brainstorm jsonl 内但未被 user 明确认领作 conclusion，故不写入本 doc

### 接下来的执行序列（按 brainstorm 决议）

1. ✅ 4 方向 brainstorm 完成
2. ✅ 写本 design doc
3. ⏳ user review 本 doc
4. ⏳ 启动方向 2 B0C5Q8L7FP 完整跑（按 Q9 6 条 hard gate）
   - 4.1 review `feat/eval-b0-bootstrap-20260426` branch
   - 4.2 merge → clean main
   - 4.3 确认 main clean + allowlist/scope/receipt/rollback ready
   - 4.4 跑 17 步 → 全真跑含 step 17 live_write
   - 4.5 验收按 Q8 1+2+3+4 全 grounded
   - 4.6 Hard gate 不满足 → 自动降级 step 16 停

### Deferred actions（明确 timing 标注）

| Action | 来源 | 触发时机 |
|--------|------|---------|
| 方向 1 Decision-3 loamwise-ops 处置 | 方向 1 | 2026-04-27 user 拍板 (D) 再观察 2 周 → 新窗口结束 **2026-05-10**；exit-review.md 物化时机 = Sprint 8 frozen (2026-05-03T12:00Z) 之后且不晚于 2026-05-10 |
| 方向 1 Decision-1+4 Retire Session OS + 砍 frontmatter | 方向 1 | 待启动（30 min 可做完）|
| 方向 1 Decision-5 liye_os 24 commits push | 方向 1 | 2026-04-27 archive preservation done (`archive/liye-os-local-batch-20260427`, SHA `525ee76`)；main land deferred — requires topic PR decomposition (~5-6 PR：BGHS feat / sprint-7 docs / ADR seal / runtime baseline / .planning roll / 反思 doc)，独立 session |
| 方向 1 Decision-2 SKILL.md 拆解 | 方向 1 | 独立 3-4h session（低优先）|
| 方向 3 30 天决策盘点 | 方向 3 | brainstorm 完成后任意时刻；按 Q10 (r) 应在方向 2 跑完后 |
| 方向 4 5 嫌疑 review | 方向 4 | **2026-05-24**（4 周后）|

---

*生成：Claude Opus 4.7 (1M context)，from brainstorm session `7b2573c7` (2026-04-25/26)，严格 mirror user 28 题真实选答，无 Claude 自行假设*
