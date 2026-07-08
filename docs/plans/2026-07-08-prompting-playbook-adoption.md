# Prompting Playbook × LiYe Systems 落地方案

- **日期**: 2026-07-08
- **状态**: APPROVED（operator 已批准，进入执行）
- **范围**: portfolio 级（liye_os L0 协议 / AGE / UGE）
- **理论来源**: Margot van Laar (Anthropic Applied AI, London), "The Prompting Playbook",
  Code w/ Claude 2026 London (2026-05-19)
  - 官方页: <https://claude.com/code-with-claude/session/ldn-the-prompting-playbook>
  - 视频: <https://youtu.be/G2B0YWuJUgI>
  - 演讲全文字幕存档: `docs/reference/2026-05-19-prompting-playbook-transcript.md`

---

## 一、理论内核（演讲全文提炼，9 条）

1. **提示词工程 = 调试生产提示词，而非从零编写。** 生产提示词是多人协作、
   无明确 owner、混杂历史补丁的活代码，要用调试代码的方式对待它。

2. **Eval 用例三分类法**（suite 合格标准）：
   - **Control（控制组）**: 无歧义、永远应通过——回归的金丝雀；
   - **Edge（边缘组）**: 模型曾失败过的用例——提示词里每条防御指令应对应一个 edge case；
   - **Boundary（能力边界组）**: 模型应转交人类或直接拒绝的用例。

3. **模型迁移退化的二分诊断**: 要么"新模型有能力但行为不同"（可用提示词修复），
   要么"新模型能力不足"（任何提示词都修不了）。Eval suite 的第一作用是区分两者。

4. **卫生清理先于失败模式定位**: 删虚假角色设定、删复制粘贴残渣、用结构化标签
   分区 role / guidelines / policy / tone / data。判断标准原话:
   *"如果你读提示词时分不清哪是指导原则、哪是政策、哪是数据，模型大概率也分不清。"*

5. **修复不一定在提示词里——harness 同样是修复面**: stop sequence、structured
   outputs、max_tokens 等 API 层手段与提示词同等重要。

6. **指令不增加能力（Instructions don't add capability）**: "CRITICAL: 务必正确
   计算 X" 无用；给模型一个工具。让模型推理难题，让工具可靠执行。

7. **模型会隐瞒它拥有的信息（幻觉的反面）**: 旧模型时代的"绝不给错误信息，让用户
   自己查"类补丁，会让新模型明明拿着数据却拒绝回答——禁止列表过拟合的精确机制。
   对策: 每条防御性变更记录引入原因（patches 档案 + 版本控制）。

8. **单边激励指令会被过拟合**: 只讲成本不讲收益（"转人工成本 $8"）→ 模型优化成
   永不转人工。对策: 陈述权衡的两面。*"模型越智能，越要陈述权衡的双方。"*

9. **生成→评估→修复（G-E-R）循环**: 三个独立小提示词（生成初稿 → LLM 逐条规则
   检查并给出违规证据 → 定向修复）胜过单体大提示词——通过率更高、token 更少、
   延迟更低。隐藏红利: **软约束可运行时注入评估提示词**，无需改确定性评分后端。
   评分器选择: 有硬规则 → 程序化评分器；软质量 → LLM judge。
   新建 agent 权衡三变量: **prompt × model × harness**，以通过率/token/延迟决策。

---

## 二、现状诊断

### 已有优势（不要重复建设）

`amazon-growth-engine/eval/autoresearch/` 是这套理论的教科书级实现：

- `runner_prompt_v1.yaml` 冻结不可变宪法块（CR-1 证据先行 / CR-3 变更前查上下文 /
  CR-6 禁模糊词 / CR-V0-1 不确定时降级），唯一可变异目标是 `section_source.md`；
- 三层评分器（parse / hard gates / soft score）+ regression/train/holdout 分集
  + promotion gate；
- closed-book 规则 + 8 字段输出契约。

进度: Phase B baseline runner 已落地（AGE PR #55、#68）；**Phase C（train/holdout
场景）、D（mutation lint）、E（变异循环）未完成**。

其他资产: liye_os `golden/10-cases`（治理内核确定性回放）；AGE guardrail-governor
（PASS/BLOCK/ESCALATE 确定性硬门）；AGE 数学已工具化（KOI、compile、bid 计算全在
Python）；UGE 双钥 fail-closed + 不变式测试文化（程序化评分的极致）。

### 五个缺口

| # | 缺口 | 证据 |
|---|------|------|
| 1 | **禁止列表无生命周期管理** | AGE `CLAUDE.md`/`AGENTS.md` 各 15 条禁止性指令；`product-selection/SKILL.md` 15 条、`marketplace-growth` 11 条。部分有事故背景叙述，但无一条标注针对的模型版本、复审触发条件，无一条被 Eval 证明"仍在承重" |
| 2 | **Eval 覆盖率 ≈ 1 个决策点** | autoresearch 只覆盖 `keyword_kill`。asin-growth Step 8 Blueprint 判断、Step 12 verdict、marketplace-growth RCA、product-selection opportunity_thesis 全部无 Eval |
| 3 | **提示词变更无门禁** | 改 `SKILL.md`、`negative_keyword_policy_v2.yaml` 不触发任何 Eval。写路径 fail-closed，提示词路径 fail-open |
| 4 | **G-E-R 只有前两步** | Step 8 生成 + Step 9-10/guardrail-governor 评估已具备，但评估全是确定性规则，LLM 判断质量无人评估，BLOCK 后无结构化修复回路 |
| 5 | **L0 协议缺 Eval 契约** | `engine_manifest.schema.yaml` 无任何 eval 字段；golden/ 只回放治理内核，不覆盖引擎域 LLM 决策 |

### 对照理论的补充诊断

| 演讲要点 | 代码库对照 | 动作 |
|---|---|---|
| ② 三分类法 | autoresearch 4 cluster 无显式分类，boundary 仅 1 个隐性覆盖（CR-3 降级 escalate） | eval-kit 场景 schema 加 `case_type` 必填 |
| ④ 卫生标准 | `product-selection` 821 行、`marketplace-growth` 561 行政策/流程/语气/数据混排；Agent YAML "Master of 66+ advertising strategies" 类虚构资历人设 | Phase 0 卫生清理 + 人设审计 |
| ⑥ 指令不增能力 | 13 个 Agent YAML 大量 `status: planned` 工具，其职责靠提示词硬扛 | 优先做工具或删职责，而非打磨提示词 |
| ⑧ 单边激励 | guardrail-governor "when in doubt, ESCALATE" / CR-V0-1 是**故意单边且文档化了动机**（正确姿势）；风险在 skills 转交指令（product-selection §13.2、marketplace-growth 收敛处置）未必写了两面 | Phase 0 审计加"单边激励扫描"维度 |
| ⑨ G-E-R 软约束 | guardrail-governor 全是硬门；每店 `decision_log.md` 的店铺特异偏好无法进入评估环 | Phase 2 双层评估器（见下） |

---

## 三、执行方案（五阶段）

### Phase 0 — 提示词资产台账 + 补丁档案 + 卫生审计（1–2 周）

- 建 `liye_os/_meta/prompts/PROMPT_LEDGER.md`: 盘点所有提示词面（AGE 5 个
  SKILL.md、13 个 Agent YAML、CLAUDE.md/AGENTS.md、runner_prompt、
  section_source、liye_os Skills 各目录），登记 owner / 最后修改 / Eval 背书状态。
- Patches 注记规范并回填存量，每条禁止性/防御性指令加:
  `<!-- patch: reason=<事故或动机> date=<日期> model=<当时模型> review=<下次模型迁移|条件> -->`
- 跑一次 Claude 审计，每条指令 7 维分类:
  1. 承重（有对应 edge case 证明）
  2. 冗余
  3. 模型时代产物（旧补丁）
  4. 相互矛盾
  5. 虚假人设/资历（删除或改写为真实能力描述）
  6. "指令不增能力"型（转为工具需求清单）
  7. 单边激励型（补另一面，或注明"故意单边 + 原因"）
- 结构卫生: 5 个 SKILL.md 统一分区标签分开 政策/流程/语气/数据。
- **纪律: Phase 0 只审计不动刀。删补丁必须等对应 Eval 兜底之后。**

### Phase 1 — autoresearch 收尾 + eval-kit 提炼（2–4 周）

- 完成 keyword_kill Phase C/D/E: 8 train + 4 holdout 场景（按三分类配比设计）、
  mutation lint、变异循环跑通第一轮闭环。
- 抽 harness 为可复用模板 **eval-kit**（协议冻结 + 三层评分器 + 分集 +
  promotion gate + 结果目录规范），落位 `kits` 仓库或 liye_os `contracts/`。
- eval-kit 硬性要求:
  - 场景 schema 增加 `case_type: control | edge | boundary` 必填字段，三类齐备
    才算合格 suite；
  - 附评分器选择指南: 硬规则 → 程序化评分器（默认）；软质量 → LLM judge
    （必须输出证据字段）。
- 回归场景素材来源: 每店 `decision_log.md`、`out/{ASIN}/runs/`、`trace/`、`replays/`。

### Phase 2 — Eval 覆盖扩展 + 双层评估修复回路（4–8 周）

决策点优先级（按风险×频率）:

1. **asin-growth Step 8**（Campaign Blueprint 判断质量）——直通 Step 11 真金白银写操作；
2. **Step 12 verdict** 质量（学习闭环可信度决定自动化推进速度）;
3. **marketplace-growth** 事故 RCA 分类；
4. **product-selection** opportunity_thesis（judge rubric；821 行巨型提示词最需拆解）。

每个决策点: 4–8 个真实事故 regression 场景起步，硬门 + 软分。

**双层评估修复回路设计**:

```
生成:  Step 8 Blueprint 起草（LLM）
评估:  L1 确定性硬门 —— guardrail-governor 现有规则不动（幅度/批量/冻结/假设）
       L2 LLM 软评估器 —— 逐条规则检查 + 违规证据输出
          ← 运行时注入店铺软约束（来源: decision_log.md 运营偏好）
修复:  接收 L2 结构化违规证据，定向修补 Blueprint，bounded retry（≤2 轮）
       L1 硬门失败直接 BLOCK/ESCALATE，不进修复回路（保持 fail-closed）
```

收益: 软约束变更不再改代码/硬门配置；化解巨型提示词膨胀路径；token 与延迟低于
单体方案（演讲实测结论）。

### Phase 3 — 治理接入 + 模型迁移 playbook（与 Phase 2 并行）

- `engine_manifest.schema.yaml` 升 v2.1: 新增 `eval_suites` 声明（suite id、
  覆盖决策点、分集规模、promotion gate 阈值、最近绿灯 run id）。
  引擎无 Eval 声明 = 协议不完整。
- **CI 门禁（核心）**: diff 触及提示词面（`SKILL.md`、`section_source.md`、
  `config/governance/*.yaml`、Agent YAML）→ 对应 eval suite 必须绿，否则
  fail-closed。
- **模型迁移 playbook**（roll forward with evals）:
  1. 新模型跑全套 suite；
  2. 看 control cases: control 挂 → 能力/接入问题，先修 harness；control 全绿
     只挂 edge → 行为差异，进提示词调试；
  3. 逐条审计 patches 档案，删候选补丁 → 重跑对应 edge case 验证
     （补丁-用例一一配对由 Phase 0 建立）；
  4. 检查 harness 面: stop sequence、structured outputs、max_tokens；
  5. promotion gate 通过才切换。

### Phase 4 — UGE: eval-first 契约 + 三变量探索矩阵

- 把"LLM rung 晋升 DoD 必须包含 eval suite + regression 场景 + promotion gate"
  写进 UGE rung 晋升契约（参照 `docs/plans/rung2-fact-emit.md` 写法，新增
  `rungN-llm-eval-first.md`）。
- 未来 LLM rung 设计文档必须包含 **prompt × model × harness 探索矩阵**:
  小模型简单提示词 → 大模型 → 思考模式 → G-E-R 循环，以通过率/token/延迟
  三指标选型，结果作为 rung 晋升证据落盘。
- 评分器天然用程序化（复用不变式测试文化）；`content_fanout` 的
  `human_gate`/`compliance_label_required` 字段是现成 boundary case 素材。
- UGE 因此成为组合里第一个提示词零债务引擎——禁止列表从第一天起带补丁档案。

---

## 四、度量与验收

| 指标 | 现状 | 目标 |
|---|---|---|
| 有 Eval suite 背书的提示词面占比 | ≈ 1/20+ | Phase 2 末 ≥ 5 个决策点 |
| 提示词 diff 被 CI 门禁覆盖的占比 | 0% | Phase 3 末 100%（声明面内） |
| suite 三分类齐备率（control/edge/boundary） | 0 | eval-kit 上线后 100% |
| 带完整 patch 元数据的禁止性指令占比 | 0% | Phase 0 末 100% |
| 补丁-用例配对率 | 0% | Phase 2 末 100%（删补丁从赌博变回归测试） |
| keyword_kill false-kill 硬门失败率 | 基线待 Phase C 建立 | 变异循环逐轮下降 |
| Step 8 Blueprint 一次通过率 | 无度量 | Phase 2 建立基线后提升 |
| 下次模型迁移安全删除的补丁条数 | — | 迁移后统计（清理过拟合的直接度量） |

## 五、边界与风险

- 不给 13 个 Agent YAML 全建 Eval——多数 tools 是 `status: planned` 的愿景文档，
  按"真实在跑的决策点"排序。
- 删补丁永远在 Eval 兜底之后，顺序不能反。
- autoresearch 的协议冻结纪律（改 immutable 块必须 bump 版本开新目录）原样带入
  eval-kit，防止 Eval 自身成为漂移源。
- G-E-R 修复回路 bounded retry ≤2 轮，L1 硬门失败不进回路——不以修复之名
  绕过 fail-closed。

## 六、立即行动（顺序）

1. **autoresearch Phase C 场景编写**，按三分类配比设计（有设计文档、只欠执行，
   做完即拥有完整闭环样板）；
2. **product-selection SKILL.md 卫生重构**（821 行、15 条禁止、混排最严重，
   是演讲 Meridian Mobile 案例的最佳库内对应物；重构前后跑同组场景可直接复刻
   演讲的对比实验）；
3. **起草 PROMPT_LEDGER.md + 7 维审计规范**（Phase 0 交付物）。
