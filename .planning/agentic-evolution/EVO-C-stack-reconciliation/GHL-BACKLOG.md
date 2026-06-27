# EVO-C D-6 — GHL 2b/2c Backlog 条目落档（R-3a）

**来源**: ADR-Learning-Stack-Generations R-3a / EVO-C SPEC v1.0 D-6
**性质**: **条目落档**（R-3a）。这些条目的**消费/重生**（R-3b）归 GHL 2b/2c 各自 ceremony，**不在本 EVO-C PR**。
**证据权威序**: Invariant/Interface 行为 > grep 实证 > line number（行号为 EVO-C IMPL 分支当前指针，grep token 为稳定锚）。

> v0/v0.1 学习栈随 ADR §D-A2 标记 superseded。其**未完成的概念价值**转登此 backlog，由 GHL（v1 sealed 栈）按 append-only + sealed-schema + 确定性门禁规范**重生**（非 retrofit 进退役码，§D-A4）。

> ⚠️ **EVO-D / ADR §D-11 后指针校准**：`src/governance/learning/drift_monitor.mjs` 已**物理退役**（isDriftBlocked 读面迁 `drift_enforcement.mjs`）。下列对 **`drift_monitor.mjs:line`** 的设计教训指针（C-1 :226-229 / C-2 :421 / 缺陷1 :174-177 / 缺陷2 :135）pin 到 git **`4179ef1`**（退役前最后 commit，该文件在此 commit 仍完整且为后续历史祖先）；各 grep token（如 `这里假设更高的值是更差的` / `f.run_id?.includes(policyId)`）跨历史稳定，是首选锚。**`tier_manager.mjs` 未退役**，其指针（缺陷2 :143）仍 live。

---

## 概念候选（自动降级 / 漂移冻结 / sandbox→candidate 晋升）

| # | 概念 | v0/v0.1 出处 | GHL 重生落点（候选） |
|---|------|--------------|----------------------|
| C-1 | **自动降级**（drift→demote/quarantine） | `drift_monitor.mjs` active demotion 路径（writeFileSync/unlinkSync :226-229） | GHL 2c（demotion lifecycle event + append-only，非破坏性文件移动） |
| C-2 | **漂移冻结**（24h freeze execute_limited） | `drift_monitor.isDriftBlocked()`（:421，只读，**已作 enforcement 保留** §D-A3） | enforcement 读已留任；冻结**触发**逻辑的 lifecycle 化归 GHL 2c |
| C-3 | **sandbox→candidate 晋升** | `promotion_v0.mjs`（sandbox→candidate，renameSync）+ `tier_manager.mjs`（observe→recommend→execute_limited 物理移动 YAML 工件 unlinkSync） | GHL 2b shadow → 2c cutover，promotion 经 `policy_lifecycle_event_v1` append-only |

---

## 已知缺陷清单（GHL 重生时须修正，勿原样移植）

> 这些是 v0/v0.1 实现的**已验证设计教训**——重生时是反面教材（Risk Register「GHL 2b/2c 重生时遗漏已验证教训」的缓解）。

1. **drift 降级方向硬编码 ACOS-shaped**
   `src/governance/learning/drift_monitor.mjs:174-177`（grep token：`这里假设更高的值是更差的`）：
   `performanceDegradationPct = ((recentAvg - olderAvg) / |olderAvg|) * 100`，**硬编码假设「更高=更差」（ACOS 场景）**。
   对 ROAS/CVR 类「更高=更好」指标，该方向**反向**，会把改善误判为漂移。GHL 重生须把 metric 方向（higher-is-worse vs higher-is-better）做成 **per-metric 声明**，不得硬编码。

2. **run_id 含 policy_id 子串松匹配（false-positive 关联）**
   `src/governance/learning/drift_monitor.mjs:135`（`f.run_id?.includes(policyId)`）+ **同模式** `src/governance/learning/tier_manager.mjs:143`（同串 `f.run_id?.includes(policyId)`）：
   用 **子串 includes** 把 fact 关联到 policy，policy_id 互为子串时会**错关**（如 `bid_x` 命中 `bid_x_v2` 的 run）。GHL 重生须用**精确 join key**（结构化 policy_id 字段，非 run_id 子串）。

3. **confidence 公式三权重与 GHL SSOT 四权重分叉**
   `.claude/scripts/learning/policy_crystallizer_v0.mjs:82`（`0.2 * execRate + 0.3 * operatorRate + 0.5 * businessRate`）：
   三权重 `0.2/0.3/0.5`，**与 GHL SSOT `_meta/contracts/learning/confidence_formulas.yaml` 的四权重 `0.2/0.3/0.4/0.1`（loader 强制 sum=1.0）分叉**（ADR N-6 / §D-A5）。GHL 是 confidence 唯一 SSOT；crystallizer 公式作废，勿移植。

4. **promotion best-effort logging gap（审计 append 可被静默吞）**（AC-01）
   `.claude/scripts/learning/promotion_v0.mjs`：`movePolicy`（def :116 / renameSync :123）在 `checkPromotions` :259 **先** commit 文件移动，`logPromotion`（def :102 / appendFileSync :110）在 main :300 **后置且 try/catch 吞错**（catch :301-303，仅 console.error）→ **move 已 commit 而 audit row 可丢**。
   GHL 重生须 **audit-before-commit**（lifecycle event append 成功后再做不可逆移动，或事务化），杜绝「状态已变但无记录」。EVO-C 仅注释记录此 gap（§D-A4 禁镀金 superseded code），真修在 GHL 2b/2c。

---

## 移交边界（R-3a vs R-3b）

- **本 PR（R-3a）**：上述条目**落档**——GHL 2b/2c SPEC ceremony 可直接引用本文件的 file:line + 缺陷清单。
- **不在本 PR（R-3b）**：条目的**消费/重生**（写 demotion lifecycle event、per-metric 方向声明、精确 join key、audit-before-commit 事务）由 GHL 2b/2c 各自 ceremony 设计 + 红队 + 落地。
- **Hard-NO（继承）**：本落档**零** GHL frozen 锚点触碰、**零** write-path 解锁、**零** superseded 码行为改动。
