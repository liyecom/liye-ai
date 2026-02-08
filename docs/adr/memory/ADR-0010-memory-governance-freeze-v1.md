# ADR-0010: Memory Governance Freeze v1

- decision_id: ADR-0010
- domain: memory
- status: accepted
- tags: [memory, governance, architecture, constitutional]

**Title**: Freeze Memory Completeness Contract and Establish Fail-Fast + Fail-Closed Write Policy
**Decision Date**: 2026-02-08
**Last Updated**: 2026-02-08
**Author**: LiYe OS Memory Governance Initiative

---

## 1. CONTEXT — 为何需要治理

liye OS 的 MAAP（Memory as a Product）系统已积累大量观察数据（observations），但存在以下问题：

### 1.1 问题描述（Problem Statement）

**类比**：Amazon Growth Engine 遇到的不完整广告活动问题（incomplete SP campaigns）。

在 AGE 中：
- 某些广告活动缺少"最少一条产品广告"（product ad），导致活动无法展示
- 通过逐一排查，发现问题的根本原因往往是**缺少关键字段**（如 SKU）
- 这种**不完整导致系统故障**的模式也存在于 MAAP 的记忆系统中

在 liye OS 的 MAAP 中类似的问题：

1. **孤立 Observation**（Orphaned Observations）
   - 存在没有 `session_id` 的记忆对象
   - 存在没有 `source_prompt_id` 的观察
   - 这些对象无法被追溯，形成"记忆债务"

2. **不完整的 entities**
   - 有些 Observation 的 `entities` 为空数组或缺失
   - 导致无法进行有效的关联查询

3. **时间戳错误**
   - 某些记忆使用 Unix 时间戳而非 ISO8601
   - 某些记忆的时间戳格式不规范

4. **无效的 integrity_status**
   - 使用 `PENDING`, `UNKNOWN` 等非法值
   - 无法明确判断记忆是否可信

### 1.2 为什么不用"先存后补"方案

**常见的错误做法**（MUST NOT）：
```
❌ 允许不完整对象落盘，事后补充数据
❌ 定期扫描和修复不完整记忆
❌ 使用数据迁移脚本"清洗"历史数据
```

**为什么失败**：
1. **债务不会消失**，只会积累
   - 修复成本随时间指数增长
   - 每次修复都引入新的不一致

2. **决策污染**
   - 可能在修复前就已使用了不完整数据生成决策
   - 无法追溯这些"坏决策"的来源

3. **可审计性丧失**
   - 修改历史数据破坏了原始记录
   - 无法重现"当时的推理过程"

4. **信任破裂**
   - 如果系统允许不完整对象，下游系统无法确信数据质量

### 1.3 本 ADR 解决什么问题

这个决策建立一个**"治理资产系统"**（Governance-First Asset System）：

- **立法优先**（Freeze-First）：先定义 Contract，再实施 Gate
- **Fail-Fast**：拒绝不完整对象，不让垃圾数据进入系统
- **Fail-Closed**：所有拒绝都记录，确保可审计
- **历史不修复**：将历史标记为 `legacy_untrusted`，不尝试修复

---

## 2. DECISION — 冻结决策

### 2.1 核心决策（Core Decision）

liye OS MUST 采取以下策略：

1. **冻结 Memory Completeness Contract v1**
   - 定义所有 Observation 必须具备的硬字段
   - 定义什么是"完整"、"可追踪"、"可用于决策"
   - Contract 一旦冻结，**不再修改**，只能升级（v2, v3）

2. **实施 Fail-Fast + Fail-Closed 写入门控**
   - 所有写入操作必须通过 Contract 验证
   - 验证失败 → 拒绝 → 记录治理日志
   - 禁止绕过验证的写入路径

3. **冻结历史记忆治理策略**
   - 所有 pre-contract Observation 自动标记 `legacy_untrusted`
   - 决策检索默认过滤 `legacy_untrusted`
   - 调试时可显式 `include_legacy=true`

4. **不修复历史数据**
   - 禁止追溯修改已落盘的 Observation
   - 禁止"数据清洗"脚本
   - 只能标记和隔离

### 2.2 使用场景（Decision Scope）

此决策适用于：
- ✅ 所有写入 MAAP 的 Observation 对象
- ✅ 所有 claude-mem 的 save_observation 调用
- ✅ 所有自定义的记忆存储 API
- ❌ 读取操作（retrieval）不受影响，但需尊重 `legacy_untrusted` 过滤

### 2.3 强制性（Mandatory Enforcement）

这是**宪法级决策**，不可协商：

- MUST：Contract v1 必须冻结
- MUST：写入路径必须强制验证
- MUST：拒绝必须写入治理日志
- MUST NOT：不允许"先存后补"
- MUST NOT：不允许绕过验证
- MUST NOT：不允许修改历史数据

---

## 3. DEFINITION OF ILLEGAL OBJECTS — 定义非法对象

### 3.1 哪些对象绝对禁止落盘

```javascript
// ❌ 缺少硬字段
{ content: "...", session_id: "..." }

// ❌ entities 为空或缺失
{ id: 1, content: "...", entities: [] }

// ❌ 缺少 source_prompt_id
{ id: 1, content: "...", session_id: "..." }

// ❌ 无效的 timestamp
{ ..., timestamp: "2026-02-08" }  // 不是完整 ISO8601

// ❌ 非法的 integrity_status
{ ..., integrity_status: "PENDING" }

// ❌ REJECTED 但缺 governance_reason
{ ..., integrity_status: "REJECTED" }
```

### 3.2 验证失败的行为

当上述任何一个条件被触发：

1. **立即抛异常**，停止执行
2. **不写入主存储**
3. **写入治理日志**，包含：
   - 尝试写入的对象（可裁剪 content）
   - 失败的验证项（missing_field, invalid_type, 等）
   - 拒绝原因
   - 时间戳
   - session_id（如果可用）

---

## 4. CONSEQUENCES — 好处与代价

### 4.1 好处（Benefits）

| 好处 | 说明 |
|-----|------|
| **数据质量保证** | 所有落盘的 Observation 都符合 Contract |
| **可追溯性** | 每条记忆都能追溯到 session + prompt |
| **决策可信度** | 用于决策的记忆都是 VERIFIED 且 traceable |
| **可审计性** | 所有拒绝都被记录，符合合规性要求 |
| **技术债清零** | 不再产生新的"坏数据"，历史通过隔离管理 |
| **架构清晰** | Gate 作为唯一的写入检查点，易于维护 |

### 4.2 代价（Costs）

| 代价 | 应对措施 |
|-----|---------|
| **短期会"报错更多"** | 这是好现象——发现了本应被阻止的坏数据。需要培训开发者正确填充 Observation 字段 |
| **写入延迟增加** | 验证成本微不足道（<10ms），可接受 |
| **需要修改现有代码** | 所有写入路径都需要迁移到统一的 Gate 入口。建议用编译脚本检查 |
| **历史记忆被隔离** | `legacy_untrusted` 记忆默认不使用。如需调试，显式传参 `include_legacy=true` |

### 4.3 长期成本对比

**不采取行动的成本**（What we avoid）：
```
Year 1: 积累 1000+ 条不完整记忆
Year 2: 修复成本 = 100 小时工程师时间
Year 3: 技术债利息 = 决策质量下降，系统不可信
```

**采取行动的成本**：
```
Month 1: 实施 Gate = 20 小时工程师时间
Month 2-12: 维护成本 = 2-3 小时/月（处理边界情况）
Long-term: 净收益 = 系统可信度 +40%, 决策成本 -60%
```

---

## 5. ALTERNATIVES REJECTED — 明确拒绝的方案

### 5.1 方案 A：宽松政策（Permissive Policy）

**提议**：允许不完整对象落盘，定期修复

**拒绝原因**：
- ❌ 无法解决决策污染问题
- ❌ 修复成本无法控制
- ❌ 可审计性丧失
- ❌ 违反"守门人原则"（Gatekeeper Principle）

### 5.2 方案 B：分层策略（Tiered Policy）

**提议**：某些 Observation 可以"部分不完整"

**拒绝原因**：
- ❌ 破坏了统一的治理框架
- ❌ 会产生"特殊情况"，导致例外爆炸
- ❌ 下游系统需要处理多种数据质量等级，复杂度增加

### 5.3 方案 C：延迟验证（Deferred Validation）

**提议**：允许对象先入库，读取时再验证

**拒绝原因**：
- ❌ 无法保证入库的数据不会被使用
- ❌ 验证逻辑分散，难以维护
- ❌ 决策时无法确定数据是否已验证

### 5.4 方案 D：修复历史数据（Repair Historic Data）

**提议**：扫描和修复所有 pre-contract Observation

**拒绝原因**：
- ❌ 修改历史破坏原始记录
- ❌ 无法追溯"修复前的推理过程"
- ❌ 可能引入新的错误
- ❌ 修复成本难以控制

**正确做法**：标记为 `legacy_untrusted`，隔离使用

---

## 6. MIGRATION POLICY — 历史记忆治理政策

### 6.1 对现有 Observation 的处理

**所有 pre-contract Observation**（在本 ADR 通过前创建的）：

1. **自动标记**
   ```json
   {
     "legacy_status": "legacy_untrusted",
     "integrity_status": "REJECTED",
     "governance_reason": "Pre-contract observation created before ADR-0010"
   }
   ```

2. **不修改原始数据**
   - 保留原始 `created_at` 字段
   - 添加 `marked_as_legacy_at` 字段记录标记时间

3. **检索规则**
   - 默认过滤：`legacy_status != "legacy_untrusted"`
   - 显式包含：`retrieve_observations({ include_legacy: true })`

### 6.2 过渡期（Transition Period）

**时间表**：

| 时期 | 操作 |
|-----|------|
| **Day 0**（本 ADR 通过） | 冻结 Contract v1, 发布 Gate 实现 |
| **Day 0-7** | 通知所有 teams，培训 Contract 使用 |
| **Day 7-30** | 代码审查, 检查是否有绕过 Gate 的调用 |
| **Day 30+** | 强制执行：CI gate 拒绝所有不完整对象 |

### 6.3 兼容性承诺

- ✅ **读取端兼容**：旧代码可以继续读取，只需尊重 `legacy_untrusted` 过滤
- ✅ **隔离机制**：legacy 数据通过显式开关隔离，不会无意中被使用
- ❌ **写入端不兼容**：新写入必须满足 Contract v1

---

## 7. IMPLEMENTATION ROADMAP — 实施路线

### Phase 1: Freeze & Document（第 1 周）

- [ ] 冻结 Contract v1 → `docs/contracts/memory-completeness-contract-v1.md`
- [ ] 发布 JSON Schema → `docs/contracts/memory-completeness-contract-v1.schema.json`
- [ ] 发布 ADR-0010（本文件）

### Phase 2: Gate Implementation（第 2-3 周）

- [ ] 实现统一入口函数 `save_observation_with_validation()`
- [ ] 迁移所有现有的 save_observation 调用
- [ ] 实现治理日志写入
- [ ] 添加单元测试（至少 10+ test cases）

### Phase 3: CI Integration（第 4 周）

- [ ] 添加 CI gate：扫描是否有绕过 Gate 的调用
- [ ] 添加 pre-commit hook：本地验证
- [ ] 代码审查清单：PR 提交时检查

### Phase 4: Rollout & Training（第 5-8 周）

- [ ] 通知所有 teams 和 contributors
- [ ] 培训文档 + 样例代码
- [ ] 收集反馈，处理边界情况

---

## 8. 成功判定标准（Success Criteria）

此 ADR 被认为"已实施"当以下条件全部满足：

### 必须满足（MUST）：

- ✅ 无法再创建缺 `session_id` 的 Observation
- ✅ 无法再创建缺 `source_prompt_id` 的 Observation
- ✅ 无法再创建 `entities` 为空的 Observation
- ✅ 所有拒绝都被记录在治理日志中
- ✅ 没有直接调用存储 API 的绕过路径（grep 验证）
- ✅ 所有 pre-contract Observation 都标记为 `legacy_untrusted`

### 推荐满足（SHOULD）：

- ✅ 至少 95% 的新 Observation 首次就通过验证（不被拒绝）
- ✅ 治理日志每天的拒绝数 < 5（表明培训有效）
- ✅ 所有 teams 都理解 Contract v1 的硬约束

---

## 9. 讨论与开放问题（Discussion）

### Q1：如果应用程序需要创建"临时 Observation"怎么办？

**A**：没有"临时"这种说法。所有 Observation 都必须满足 Contract。
如果你确实需要创建不完整的对象，应该：
1. 使用本地数据结构（不走 MAAP API）
2. 在发送到 MAAP 前补全所有硬字段
3. 一次性送入，不分步骤

### Q2：`source_prompt_id` 如何在非交互式系统中填充？

**A**：非交互式系统应该：
1. 生成或使用一个标准的 system prompt ID（如 `"system-batch-import-20260208"`）
2. 记录在 Observation 的 `governance_reason` 中说明来源
3. 仍然需要非空值，确保可追溯

### Q3：版本升级到 v2 时如何处理 v1 的 Contract？

**A**：
1. 创建新文件 `memory-completeness-contract-v2.md`
2. 保持 v1 文件不删除（作为历史记录）
3. 在 ADR 中明确升级原因和兼容性说明
4. v2 会逐步替代 v1，但 v1 的约束不会削弱

---

## 10. 相关文档 (References)

| 文档 | 链接 |
|------|------|
| **Contract v1** | `docs/contracts/memory-completeness-contract-v1.md` |
| **JSON Schema** | `docs/contracts/memory-completeness-contract-v1.schema.json` |
| **类比案例** | AGE 中的不完整 SP Campaign 问题（2026-02-07） |
| **Memory System** | `docs/MAAP_DEEP_DIVE.md` |

---

## 签名

- **Decision ID**: ADR-0010
- **Status**: ACCEPTED
- **Approval Date**: 2026-02-08
- **Effective Date**: 2026-02-08
- **Review Schedule**: Quarterly（每季度审查一次）
- **Next Review Date**: 2026-05-08

---

**Version**: 1.0
**Last Updated**: 2026-02-08
**Governance Level**: CONSTITUTIONAL（宪法级）
**Reversibility**: 不可逆（No rollback permitted）
