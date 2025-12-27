# Amazon 搜索词报告导出教程（Search Term Report）

**目的**: 获取广告活动的关键词级别数据，用于精细化优化

**适用账号**: TIMO-US站

**导出时间**: 约3-5分钟

---

## 📋 为什么需要搜索词报告？

**当前问题**:
- 广告活动层面的ACOS只是平均值，无法区分好词和坏词
- 一个ACOS 55%的活动可能包含：
  - 20%的优秀关键词（ACOS 25%，出单）
  - 80%的垃圾关键词（ACOS 80%，烧钱不出单）

**搜索词报告能告诉我们**:
- 哪些具体搜索词带来了点击和订单
- 每个搜索词的花费、销售额、ACOS
- 哪些词需要立即否定（花钱不出单）
- 哪些词需要加大投入（低ACOS高转化）

---

## 🎯 导出步骤（分步图文教程）

### 步骤 1: 登录Amazon Seller Central

1. 访问 https://sellercentral.amazon.com
2. 使用TIMO账号登录
3. 确认右上角显示 **United States** 站点

---

### 步骤 2: 进入广告报告页面

**路径**:
```
顶部菜单栏 → Advertising → Campaign Manager
```

或者直接访问:
```
https://advertising.amazon.com/cm/campaigns
```

**检查点**: 页面应该显示所有广告活动列表

---

### 步骤 3: 打开报告下载中心

**方法1** (推荐):
```
左侧菜单 → Measurement & Reporting → Reports
```

**方法2**:
```
顶部菜单栏 → Reports → Advertising Reports
```

**检查点**: 进入报告页面，看到 "Create report" 按钮

---

### 步骤 4: 创建搜索词报告

1. 点击 **"Create report"** 按钮

2. **Report type** 选择:
   ```
   ✅ Sponsored Products → Search term report
   ```
   或者
   ```
   ✅ Sponsored Brands → Search term report (如果有SB广告)
   ```

3. **Report period** 选择:
   ```
   ⚠️ Custom date range
   开始日期: 2025-11-26
   结束日期: 2025-12-25
   ```

   **为什么选这个日期？**
   - 与现有的广告活动数据时间范围一致
   - 近30天数据，既能看到最新趋势，又有足够样本量

4. **Delivery method** 选择:
   ```
   ✅ Download now (立即下载)
   ```

5. **File format** 选择:
   ```
   ✅ CSV (.csv)  ← 推荐，方便分析
   或
   ✅ Excel (.xlsx)  ← 也可以，但文件稍大
   ```

6. 点击 **"Create report"**

---

### 步骤 5: 下载文件

**选项A - 立即下载** (如果选了 "Download now"):
1. 报告生成需要 10-30 秒
2. 生成后，浏览器会自动开始下载
3. 文件名类似: `Sponsored-Products-Search-term-report-20251126-20251225.csv`

**选项B - 稍后下载** (如果选了 "Email"):
1. 等待邮件通知（通常2-5分钟）
2. 打开邮件，点击下载链接
3. 下载文件

---

### 步骤 6: 重命名并移动文件

**重命名**:
```bash
原文件名: Sponsored-Products-Search-term-report-20251126-20251225.csv
建议新名: SearchTermReport-US-SP-20251126-20251225.csv
```

**移动到指定目录**:
```bash
目标路径:
/Users/liye/Documents/amazon-runtime/uploads/Timo-US/

完整路径:
/Users/liye/Documents/amazon-runtime/uploads/Timo-US/SearchTermReport-US-SP-20251126-20251225.csv
```

**如果有SB广告，再导出一份SB的搜索词报告**:
```
重复步骤4，但在 Report type 选择 "Sponsored Brands → Search term report"
文件名: SearchTermReport-US-SB-20251126-20251225.csv
```

---

## 📊 文件内容预览（你会看到什么）

**CSV文件应包含以下列**:

| 列名 | 含义 | 示例 |
|------|------|------|
| Customer Search Term | 用户搜索的关键词 | "washable door mat" |
| Campaign Name | 所属广告活动 | "9.28-7810-视频-精准" |
| Ad Group Name | 广告组（SP有，SB可能没有） | "地垫主推" |
| Match Type | 匹配类型 | Broad / Phrase / Exact |
| Impressions | 曝光量 | 1,523 |
| Clicks | 点击量 | 45 |
| Click-Thru Rate (CTR) | 点击率 | 2.95% |
| Cost Per Click (CPC) | 单次点击成本 | $0.52 |
| Spend | 花费 | $23.40 |
| 7 Day Total Sales | 7天归因销售额 | $67.80 |
| Total Advertising Cost of Sales (ACoS) | 广告成本占比 | 34.51% |
| 7 Day Total Orders (#) | 7天归因订单数 | 3 |
| 7 Day Conversion Rate | 7天转化率 | 6.67% |

**文件大小预估**:
- 如果有100个关键词 → 约50KB
- 如果有1000个关键词 → 约500KB

---

## ⚠️ 常见问题 & 解决方案

### Q1: 找不到 "Search term report" 选项
**可能原因**:
- 账号权限不足
- 广告活动类型选错了（SP vs SB vs SD）

**解决方案**:
1. 确认你有广告管理权限
2. 尝试切换 Report type: Sponsored Products / Sponsored Brands
3. 如果还是没有，联系账号管理员

---

### Q2: 报告显示 "No data available"
**可能原因**:
- 日期范围内没有搜索词数据
- 广告活动没有获得展示

**解决方案**:
1. 检查日期范围是否正确
2. 确认该时间段有广告投放
3. 尝试扩大日期范围（如改为近60天）

---

### Q3: 文件太大，导出失败
**可能原因**:
- 搜索词数量太多（>10万条）

**解决方案**:
1. 缩小日期范围（如改为近7天）
2. 按广告活动单独导出（见下方"高级技巧"）
3. 联系Amazon支持

---

## 🔥 高级技巧：按广告活动单独导出

**适用场景**:
- 只想分析特定几个高花费活动
- 全量数据太大

**操作步骤**:

1. 在 Campaign Manager 页面
2. 选中目标广告活动（如 "9.28-7810-视频-精准"）
3. 点击活动名称，进入活动详情页
4. 顶部菜单 → **Download** → **Search term report**
5. 选择日期范围和格式
6. 下载

**优点**:
- 文件小，处理快
- 针对性强

**文件命名建议**:
```
SearchTermReport-US-SP-{活动名简写}-20251126-20251225.csv

示例:
SearchTermReport-US-SP-7810视频精准-20251126-20251225.csv
```

---

## 📁 完成后的文件清单

**导出完成后，你应该有以下文件**:

```
/Users/liye/Documents/amazon-runtime/uploads/Timo-US/
├── SearchTermReport-US-SP-20251126-20251225.csv         ← 全量SP搜索词
├── SearchTermReport-US-SB-20251126-20251225.csv         ← 全量SB搜索词（如有）
├── SearchTermReport-US-SP-7810视频精准-20251126-20251225.csv  ← 单活动（可选）
└── SearchTermReport-US-SP-地垫5080视频-20251126-20251225.csv  ← 单活动（可选）
```

---

## 🎯 导出后，下一步做什么？

**上传文件后，我会自动进行**:

### 1️⃣ 关键词分层分析
- S级明星词（ACOS < 30%，高销售）
- A级优秀词（ACOS 30-40%）
- B级观察词（ACOS 40-60%）
- C级问题词（ACOS > 60%）
- D级垃圾词（有花费无销售）

### 2️⃣ 生成否定关键词列表
- 精准否定（Negative Exact）
- 词组否定（Negative Phrase）
- 广泛否定（Negative Broad）

### 3️⃣ 优化建议
- 哪些词提高竞价20%
- 哪些词降低竞价30%
- 哪些词立即暂停
- 哪些词单独开Exact活动

### 4️⃣ 预期效果
- 优化后ACOS预估
- 预计节省花费
- 预计增加销售

---

## 📞 需要帮助？

**如果遇到问题**:
1. 截图报错信息
2. 告诉我具体在哪一步卡住
3. 我会提供针对性解决方案

**快速检查清单** ✅:
- [ ] 已登录Amazon Seller Central
- [ ] 确认是US站点
- [ ] 进入Advertising → Reports
- [ ] 创建Search term report
- [ ] 日期范围: 2025-11-26 至 2025-12-25
- [ ] 文件格式: CSV
- [ ] 下载完成
- [ ] 重命名并移动到 uploads/Timo-US/ 目录

---

**预计完成时间**: 3-5分钟
**难度**: ⭐⭐☆☆☆ (简单)
**优先级**: 🔴 P0 - 关键（必需完成）

导出完成后，告诉我文件路径，我立即开始关键词级别的深度分析！
