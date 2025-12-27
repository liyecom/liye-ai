# Amazon Keyword Analysis & Optimization - Evolution Log

**Skill Name**: amazon-keyword-analysis
**Current Version**: v3.0
**Last Updated**: 2025-12-26

---

## 📈 Version History

### v3.0 (2025-12-26) - Search Term Integration & Complete Lifecycle Management

**Major Upgrade**: 整合 Search Term 分析能力，形成完整的关键词全生命周期管理系统

**Changes**:
1. ✅ **扩展能力模型** (Module 02):
   - 新增 C. 实战验证 (Live Performance Analysis)
   - 新增 D. 关键词级别优化 (Keyword-Level Optimization)
   - 新增 E. 否定词管理 (Negative Keyword Management)

2. ✅ **新增思维模型** (Module 03):
   - 关键词5级分层模型 (S/A/B/C/D)
   - 关键词生命周期模型 (Discovery → Launch → Maturity → Decline)
   - 二八定律应用（5-10% 的词贡献 40-50% 销售）

3. ✅ **新增 SOP 2** (Module 04):
   - Search Term 关键词优化法
   - 4-Phase 完整流程（导出 → 分析 → 执行 → 复盘）
   - 预计耗时 30分钟

4. ✅ **新增工具**:
   - `tools/analyze_search_terms.py` (自动化5级分层分析脚本)
   - `tools/export_search_term_tutorial.md` (保姆级导出教程)

5. ✅ **新增模板**:
   - 关键词优化方案模板
   - 否定关键词清单模板

6. ✅ **首个验证案例**:
   - 项目: TIMO-US 关键词优化
   - 日期: 2025-12-25
   - 效果:
     - ACOS 降低: 7.36% (从 38.56% 降至 31.20%)
     - 否定词数量: 130 个 (C级85个 + D级45个)
     - 明星词数量: 12 个 (S级，需加码投入)
     - 预期销售增长: $336.84/月
     - 预期花费节省: $486.04/月
   - 状态: 待7天后复盘验证

**Breaking Changes**: None
**Migration Guide**: 无需迁移，新增功能向后兼容

---

### v2.0 (2025-12-13) - Timo Custom Edition

**Changes**:
- ✅ 升级为 Timo 店铺定制版
- ✅ 引入 TES 流量效能模型
- ✅ 整合卖家精灵 (SellersSprite) 工作流
- ✅ 新增 SOP 1: TES 关键词挖掘法

**First Artifacts**: None (未记录)

---

### v1.0 (2025-12-13) - Initial Version

**Changes**:
- ✅ 创建 Skill 基础结构
- ✅ 基于 Cerebro 工具的通用关键词分析方法
- ✅ 10-module 标准定义

---

## 🎯 Performance Tracking

### Case 1: TIMO-US 关键词优化（2025-12-25）

**Context**:
- 店铺: TIMO-US 站
- 主营类目: 地垫 (Door Mat)
- 问题: 广告活动 ACOS 38.56%，超过目标 30%
- 数据来源: Search Term Report (2025-11-26 至 2025-12-25，30天)

**Execution**:
- **Phase 1**: 导出 Search Term Report（用户手动完成）
- **Phase 2**: 运行 `analyze_search_terms.py`（3分钟）
- **Phase 3**: 生成优化方案报告（自动完成）
- **Phase 4**: 等待用户执行优化建议

**Results** (预期):
- ✅ 识别关键词总数: 237 个
- ✅ 5级分层分布:
  - S级-明星词: 12 个 (5.1%)
  - A级-优秀词: 28 个 (11.8%)
  - B级-观察词: 67 个 (28.3%)
  - C级-问题词: 85 个 (35.9%)
  - D级-垃圾词: 45 个 (19.0%)

- ✅ 优化建议:
  - 立即否定: 130 个词 (C级 + D级)
  - 竞价 +20%: 12 个词 (S级)
  - 竞价 -30%: 67 个词 (B级)

- ✅ 预期效果:
  - ACOS: 38.56% → 31.20% (降低 7.36%)
  - 月销售: +$336.84
  - 月花费节省: $486.04
  - ROI 提升: 23.6%

**Status**: ⏰ 待验证（需7天后复盘）

**Follow-up Actions**:
- [ ] 2025-01-02: 重新导出 Search Term Report
- [ ] 2025-01-02: 再次运行分析，对比优化前后
- [ ] 2025-01-02: 记录实际效果到 evolution_log.md
- [ ] 2025-01-02: 如效果达标，标记为 ✅ 成功案例

---

## 📚 Learnings & Insights

### Insight 1: 关键词级别优化 vs 广告活动级别优化

**发现**（来自专家研讨会 2025-12-25）:
> "有些广告活动虽然ACOS比较高，但是我手动查看数据之后发现他们的点击量和转化率还是不错的。有些关键词数据是很好的，但是有些关键词数据不好拖累了整个广告活动。"

**教训**:
- ❌ 错误做法: 粗暴暂停整个高ACOS活动
- ✅ 正确做法: 深入到关键词级别，否定垃圾词，保留明星词

**应用**:
- 这个洞察直接促成了 v3.0 的诞生
- 整合 Search Term 分析，使 Skill 具备关键词级别精细化优化能力

---

### Insight 2: 二八定律在关键词分析中的体现

**数据验证**（TIMO-US 案例）:
- 5.1% 的关键词（S级）贡献 45.2% 的销售
- 19.0% 的关键词（D级）浪费 $189.50，完全零销售
- 35.9% 的关键词（C级）ACOS > 60%，严重拖累整体 ACOS

**启示**:
- 找到并加码 5-10% 的明星词，比优化 100 个普通词更有效
- 否定 50-60% 的垃圾词/问题词，可立即节省 30-40% 预算

**应用**:
- 在 skill_definition.md 中将二八定律作为核心原则之一
- 在 SOP 中优先级设定为: P0 否定垃圾词 > P1 加码明星词 > P2 优化观察词

---

### Insight 3: TES 模型 vs 5级分层模型的互补关系

**TES 模型**:
- 适用场景: 新品上架前的市场洞察
- 数据来源: 卖家精灵（市场数据）
- 优势: 预测潜力，避免盲目选词
- 局限: 无法反映实际投放效果

**5级分层模型**:
- 适用场景: 广告上线后的持续优化
- 数据来源: Search Term Report（实际投放数据）
- 优势: 基于真实数据，直接指导优化
- 局限: 需要至少30天数据积累

**协作模式**:
```
新品上架
  ↓ TES 模型筛选关键词（卖家精灵）
广告上线
  ↓ 投放30天
Search Term Report
  ↓ 5级分层模型优化（实际数据）
持续迭代
  ↓ 每14天重新分层
动态调整
```

**应用**:
- 在 skill_definition.md 中明确两种模型的定位和协作关系
- 形成完整的关键词全生命周期管理体系

---

## 🚀 Future Evolution Plans

### Near-term (Next 30 days)

**1. 验证 TIMO-US 案例效果**:
- [ ] 2025-01-02: 7天后复盘
- [ ] 2025-01-16: 21天后深度复盘
- [ ] 记录实际 ACOS 变化、销售增长、ROI 提升

**2. 完善模板库**:
- [ ] 创建 `templates/optimization_plan_template.md`
- [ ] 创建 `templates/negative_keywords_template.md`
- [ ] 创建 `templates/tes_analysis_template.md`

**3. 更新 CLAUDE.md**:
- [ ] 在 "Skill Invocation Rules" 中更新 amazon-keyword-analysis 调用规则
- [ ] 说明如何选择 TES 分析 vs Search Term 优化

---

### Mid-term (Next 60 days)

**4. 整合 Amazon Growth OS**:
- [ ] 将 Skill 与 DuckDB 数据湖连接
- [ ] 自动读取历史关键词数据
- [ ] 实现跨月份趋势分析

**5. 开发可视化 Dashboard**:
- [ ] 使用 Streamlit 创建关键词表现仪表盘
- [ ] 实时显示 S/A/B/C/D 级关键词分布
- [ ] 自动生成优化建议

---

### Long-term (Next 90+ days)

**6. 自动化执行**:
- [ ] 调用 Amazon Ads API
- [ ] 自动批量添加否定词
- [ ] 自动调整关键词竞价
- [ ] 需要用户授权后才可启用

**7. 跨店铺复用**:
- [ ] 验证 Skill 在其他店铺（非TIMO）的适用性
- [ ] 识别需要定制化的部分（如 ACOS 目标、品类特征）
- [ ] 开发配置文件系统，支持多店铺管理

---

## 💡 Ideas & Experiments

### Idea 1: 关键词衰退期预警系统

**问题**: 某些关键词可能因季节性、竞争加剧等原因表现下降
**解决方案**: 开发趋势监控算法，对比近7天 vs 近30天数据
**预期收益**: 提前发现衰退关键词，及时调整策略

**Status**: 💡 Idea

---

### Idea 2: 竞品关键词拦截策略

**问题**: 竞品的品牌词、核心词可能流失到我们的广告
**解决方案**: 识别竞品关键词，评估是否值得投放（ACOS、转化率）
**预期收益**: 避免浪费预算在无法转化的竞品词上

**Status**: 💡 Idea（可能单独成为一个 Skill）

---

### Idea 3: 智能竞价建议系统

**问题**: 目前只有 +20%/-30% 的固定建议，缺乏个性化
**解决方案**: 基于历史数据，AI 学习每个关键词的最优竞价
**预期收益**: 更精准的竞价控制，ROI 提升 5-10%

**Status**: 💡 Idea（需要大量数据积累）

---

## 📊 Metrics Dashboard

### Overall Skill Health
- **Version**: v3.0
- **Status**: ✅ Active
- **Last Used**: 2025-12-25
- **Total Artifacts**: 1 (TIMO-US 关键词优化)
- **Success Rate**: ⏰ 待验证

### Performance Metrics (To be updated after validation)
- **Average ACOS Improvement**: TBD
- **Average Execution Time**: 30 minutes (target ✅ met)
- **Average ROI Increase**: TBD
- **User Satisfaction**: TBD

---

**Last Updated**: 2025-12-26
**Next Review**: 2025-01-02 (after TIMO-US 7-day validation)
