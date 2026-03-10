# LiYe 技术生态全景文档

> **版本**: 1.1
> **日期**: 2026-02-25
> **用途**: 与 AI 助手对齐项目认知的上下文文件
> **覆盖范围**: ~/github/ 下所有相关代码库
> **变更记录**: v1.1 — 补充 T1_TRUTH 数据源、修正 write_capability 声明、增加归因边界声明、增加安全章节、清理 deprecated 引用

---

## 一、生态全景

整个技术体系由三个核心系统和若干支撑项目组成：

```
┌─────────────────────────────────────────────────────────────────┐
│                    LiYe OS (治理层 / 控制平面)                    │
│                                                                   │
│  World Model Kernel (T1/T2/T3)    Reasoning Contracts             │
│  engine_manifest.schema            Skills Library                  │
│  Learned Bundle Pipeline           Tracks (执行容器)              │
│  Builders (构建工具链)             GDP (基准数据平台)              │
├─────────────────────────────────────────────────────────────────┤
│                 ↕ engine_manifest 协议                             │
├────────────────────────┬────────────────────────────────────────┤
│   Amazon Growth Engine │              SilkBay                     │
│   (AGE — 广告数据平面) │     (多品牌 DTC 商务中枢)               │
│                        │                                          │
│  PPC Changeset Pipeline│  Medusa v2 Backend                       │
│  Ads API Client        │  PDP 五层决策架构                        │
│  Guardrails + Executor │  品牌隔离 (Store/Channel/Key)            │
│  Verification Loop     │  Storefront Kit                          │
│  Experience Aggregation│  Attribution Kit                          │
└────────────────────────┴────────────────────────────────────────┘
         ↑                              ↑
    Amazon Ads API                 Brand Storefronts
    Amazon SP-API (待打通)          Growth Hub (SEO 内容站)
                                    Link Router (归因路由)
```

### 各系统定位

| 系统 | 代码库 | 一句话定位 |
|------|--------|-----------|
| **LiYe OS** | `liye_os/` | 跨域治理框架：拥有调度、学习、策略晋升、世界模型 |
| **AGE** | `amazon-growth-engine/` | Amazon 广告领域引擎：纯数据平面，输入→裁决→建议 |
| **SilkBay** | `silkbay/` | 多品牌 DTC 电商中枢：订单、库存、品牌隔离 |
| **GDP** | 定义于 `liye_os/` evidence 层 | 基准数据平台：类目均值、关键词量级、跨渠道归因 |
| **Growth Hub** | `growth-hub/` | SEO 内容站群：Astro 驱动，向 storefronts 导流 |
| **Storefronts** | `storefronts/` | 品牌独立站 + Link Router + Attribution Kit |
| **Themes** | `themes/` | 品牌主题资产 + 站点注册表 (SSOT) |
| **Kits** | `kits/` | 共享 npm 包（当前: attribution-kit） |

---

## 二、LiYe OS — 控制平面

### 2.1 世界模型内核 (T1/T2/T3)

核心哲学：**"让盲目自信在结构上不可能发生。"**

| 层 | 问题 | 输出 |
|----|------|------|
| **T1 因果骨架** | 世界在压力下会在哪里失败？ | 警告原语（如 liquidity_illusion） |
| **T2 世界状态** | 当前世界处于什么危险状态？ | 5 维状态向量（流动性/相关性/预期/杠杆/不确定性） |
| **T3 世界动力学** | 压力下状态如何演化？ | 加速/放大/相变形态描述 |

**关键规则**：
- T1 已跨 3 个领域验证（电商/投资/医疗），54% reasoning lift
- T3 **永远不预测、永远不推荐**，只描述状态演化形态
- 每个领域执行必须先通过 World Model Gate，代码中出现 `skip_world_model` 会被 CI 阻断

### 2.2 Reasoning Contracts（推理契约）

这是让 AGE 的决策**可审计、可回放、可约束**的关键基础设施。

```
concepts.yaml          ← 语义字典：消除多义性（AD_CVR ≠ LISTING_CVR）
     ↓
observation playbooks  ← 诊断层：ACOS_TOO_HIGH → 原因候选 → 证据需求
     ↓
evidence_fetch_map     ← 数据桥接：证据字段 → 具体查询（GDP/ENGINE/T1_TRUTH/MANUAL）
     ↓
action playbooks       ← 执行层：ADD_NEGATIVE_KEYWORDS → 资格/安全限制/回滚
     ↓
execution_flags        ← 总开关：global readonly / auto_execution whitelist
```

**四大数据源**：

| Source | 含义 | 数据举例 |
|--------|------|---------|
| **GDP** | Growth Data Platform — 基准/归因数据 | category_avg_cpc, keyword_search_volume, 跨渠道 UTM 归因 |
| **ENGINE** | AGE 内部运营数据 | acos, ctr, unit_session_pct, days_since_launch |
| **T1_TRUTH** | 统一事实层 — 经口径对齐的权威数据 | 广告搜索词日报、广告活动日报、ASIN 日报（35+ 字段） |
| **MANUAL** | 人工输入 | 运营判断、标注 |

> **GDP vs T1_TRUTH 的区别**：GDP 提供外部基准（类目均值、搜索量），T1_TRUTH 提供内部事实（广告/订单/转化的权威记录）。两者 schema 均受保护，不可随意修改。

### 2.3 Engine Manifest 协议

LiYe OS 通过 `engine_manifest.schema.yaml` 定义引擎插件协议。AGE 的 manifest 声明：

```yaml
engine_id: amazon-growth-engine
write_capability: ads_api_gated  # AGE 拥有执行能力，但受 approval ticket 门控
bundle_consumption:
  env_var: "LEARNED_BUNDLE_PATH"  # 通过环境变量接收学习后的策略包
```

> **注**：`engine_manifest.yaml` 原始声明为 `write_capability: none`，但实际实现中 AGE 的 `ChangesetExecutor` 可通过 Ads API 执行写操作（需 approval ticket）。此处以实际架构为准，manifest 待同步更新。

**核心设计原则**（ADR-001）：
- AGE 是广告领域引擎 — 接受输入、运行 playbook、返回裁决+建议，并可在审批门控下执行写操作
- AGE **不做**调度、不做投递、不读写 OS 状态、不自我学习
- 策略晋升路径由 OS 控制：sandbox → candidate → production
- 所有写操作受 Guardrail + Approval Ticket + Idempotency Ledger 三重保护

### 2.4 三级执行权限

| 层级 | 权限 | 人工参与度 |
|------|------|-----------|
| `observe` | read:metrics, write:evidence_package | 无需人工（dry-run） |
| `recommend` | + write:feishu_message | 人工审阅通知 |
| `execute_limited` | + write:ads_api_limited（可回滚） | 人工审批后执行 |

### 2.5 策略晋升信号

| 信号层级 | 含义 |
|---------|------|
| `ExecSuccess` | 执行无错误 |
| `OperatorSuccess` | 运营采纳了建议 |
| `BusinessSuccess` | 业务指标实际改善（如 ACOS 下降） |

### 2.6 Tracks（执行容器）

Track 是长期项目容器，绑定到特定领域和术语表：

```
tracks/<track_id>/
├── spec.md          # 需求（必须用术语表定义的词）
├── plan.md          # 执行计划
├── state.yaml       # 当前状态
├── workflow.yaml    # 验证规则
├── checkpoint.yaml  # 阶段冻结记录
└── experience.yaml  # 复盘经验
```

### 2.7 Builders（构建工具链）

Builders 将设计契约编译为可部署的主题资产：

```
UI/UX Skill → site-design.contract.yaml → builders/ → theme.css + tokens.json → Astro/Next.js
```

### 2.8 Skills 技能库

Skills 是被动知识（SOP、方法论、模板），分为 13 个类目。关键特性：**人类可以不借助 AI 手动执行 Skill**。

---

## 三、Amazon Growth Engine (AGE) — 广告数据平面

### 3.1 已实现的核心能力

#### PPC Changeset Pipeline（PR-4 系列，A 到 K 全部完成）

这是 AGE 最核心的能力——一条带审计轨迹的广告操作流水线：

```
CasePack (plan.yaml + research.json)
    ↓
Bootstrap (生成 ChangesetArtifact)
    ↓  包含：actions[], decision_records[], guardrail_tags
Guardrail Validation
    ↓  cold_start_guard, max_bid_delta(20%), min/max_bid
Approval Ticket (人工审批门控，带过期时间)
    ↓
Executor (幂等执行)
    ↓  支持：canary模式、模拟执行、真实执行
    ↓  IdempotencyLedger (JSONL 去重)
    ↓  单次消费票据追踪
Verifier (48h/7d 验证窗口)
    ↓  从 Ads API 拉取真实指标对比
Experience Aggregator
    ↓  按 ASIN/action_kind 聚合历史经验
Policy Recommender
    ↓  基于经验数据建议策略调整
    ↓  Rule A: block_rate >= 30% → 建议提高 max_bid_delta
    ↓  Rule B: unknown_rate >= 50% → 建议调整 verify_window
```

#### 已实现的 Bootstrap 类型

| Bootstrap | 功能 |
|-----------|------|
| SP Manual Long-tail | 创建 SP 手动精确匹配广告 |
| SBV Bid Update | 调整 SBV 关键词出价 |
| SD Competitor | 创建 SD 竞品 ASIN 定向广告 |

#### Amazon Ads API Client

- 完整 OAuth2 生命周期（自动刷新，60s 提前量）
- 报告创建/轮询/下载（GZIP JSON 自动解压）
- 支持 NA/EU/FE 三个区域
- 代理支持

#### Amazon Ads Quirks Registry

10 个从真实 API 测试中发现并记录的 quirk，这是实战壁垒：

| Quirk | 说明 |
|-------|------|
| sd-content-type-json | SD API 拒绝 vendor media types |
| sd-payload-array-format | SD Campaign 要求 `[...]` 不是 `{"campaigns": [...]}` |
| sd-state-lowercase | SD 要求小写 state 值 |
| sb-keywords-put-json-no-accept | SB PUT 不能带 Accept header |
| sb-keywords-update-requires-adgroupid | SB 每个 keyword 必须包含 adGroupId |
| ... | 共 10 个 |

#### 其他已实现能力

| 能力 | 位置 | 说明 |
|------|------|------|
| Wasted Spend Detection | `src/capabilities/` | 端到端：创建报告→轮询→下载→分析 |
| Keyword Governance | `src/domain/.../strategy/` | TEST/GROW/HARVEST/DEFEND/KILL 五层分类 |
| ROI Calculator | `src/domain/.../attribution/` | 多渠道 ROI、预算重分配建议 |
| Bid Recommend Playbook | `src/playbooks/` | Card Contract v1 格式，策略匹配 |
| Job API | `src/job_api/` | FastAPI HTTP 服务，支持异步任务 |
| SBV Playwright Automation | `src/automation/sbv/` | Selenium Central 自动化，blind executor |
| Control Plane | `src/ppc/control_plane/` | status.json + runbook.md 生成 |
| MCP Server | `src/runtime/mcp/` | 分析/执行工具、SellerSprite 数据 |

#### DuckDB 数据仓库 DDL（已定义，待灌数据）

```
dim_marketplace, dim_asin, dim_keyword
fact_keyword_entry_daily     ← 粒度：日期+ASIN+关键词+入口类型+位置+匹配类型
fact_keyword_snapshot        ← 含 SellerSprite 指标（搜索量、SPR、供需比、PPC出价、ABA排名）
fact_asin_daily              ← sessions, page_views, buy_box_pct, unit_session_pct
fact_serp_top10              ← SERP Top10 快照
```

### 3.2 待打通

| 模块 | 现状 | 打通后 |
|------|------|--------|
| **SP-API** | stub（已审核通过） | 真实订单/收入/session/库存数据灌入 ENGINE |
| DuckDB 数据灌入 | DDL 已定义，无数据 | SP-API + Ads API 数据写入 fact 表 |
| ROI Calculator | 逻辑完整，无真实数据 | 可计算 revenue - ad_spend - COGS |
| Playbooks | 3 个均为 placeholder | 接入真实数据后可激活 |

#### SP-API 数据落地路径

- **v1（当前目标）**：SP-API 数据直接落入 AGE 的 DuckDB（作为 T1_TRUTH source），快速打通闭环
- **v2（多引擎阶段）**：如出现多个领域引擎（Amazon + DTC 等），T1_TRUTH 层抽离为独立事实服务，各引擎作为 Producer 写入、Consumer 读取

### 3.3 CasePack Runner CLI

统一入口，支持全部模式：

```bash
# 干跑
python scripts/age/casepack_runner.py --casepack <dir>

# 执行
python scripts/age/casepack_runner.py --casepack <dir> --apply

# 审批
python scripts/age/casepack_runner.py --casepack <dir> --emit-approval

# 真实执行（需审批票据）
python scripts/age/casepack_runner.py --casepack <dir> --real-exec --approval <ticket>

# 验证
python scripts/age/casepack_runner.py --casepack <dir> --verify --verify-window 48h

# 状态报告
python scripts/age/casepack_runner.py --casepack <dir> --status

# 经验聚合
python scripts/age/casepack_runner.py --casepack <dir> --summarize-experience

# 策略建议
python scripts/age/casepack_runner.py --casepack <dir> --suggest-policy
```

### 3.4 自动化等级路线图

| 等级 | 描述 | AGE 现状 |
|------|------|---------|
| **L0** | 全手动：人写 plan，人执行 | 已实现 |
| **L1** | 建议：系统输出建议，人决策 | 已实现（PolicyRecommender） |
| **L2** | 半自动：changeset 自动生成，人审批执行 | **当前位置** |
| **L3** | 有条件自动：guardrail 通过则自动执行 | 基础设施就绪，差策略开关 |
| **L4** | 全自动：AI 生成→执行→验证→调整 | 长期目标 |

**从 L2 到 L3 的差距**：guardrails + verification + experience feedback 均已实现，只需增加 `auto_approve_if_guardrails_pass` 策略开关。

**从 L3 到 L4 的差距**：需要 SP-API 数据打通（验证效果）+ playbook 从 placeholder 激活 + 学习管道接入。

---

## 四、SilkBay — 多品牌 DTC 商务中枢

### 4.1 架构

```
silkbay/ (Medusa v2 Backend)
    │
    ├── 3 个 Store: Timo Mats / Refetone / Foneyi Mats
    ├── 每个 Store 一个 Sales Channel + Publishable API Key（品牌隔离）
    ├── Docker: Postgres 16 + Redis 7 + Medusa
    │
    └── 被以下系统消费：
         ├── storefronts/sf-timomats/  (Next.js)
         ├── storefronts/sf-refetone/  (Next.js)
         └── storefronts/sf-foneyi/    (Next.js)
```

### 4.2 PDP 五层决策架构

SilkBay 的核心产品理念：**在独立站上复刻 Amazon PDP 的决策架构以最大化转化率**。

| 层 | 决策任务 | 组件 |
|----|---------|------|
| **L1** 价值锚定 | 第一眼值不值得看 | PDPHero + PDPImageGallery + PDPBullets |
| **L2** 信任建立 | 能不能信 | PDPTrustProof（Amazon 评分 badge + 精选评论） |
| **L3** 选择确认 | 选哪个 | PDPVariantSelector（按钮/色板/下拉模式） |
| **L4** 风险缓解 | 怕什么 | PDPFAQ（5 个问题，强制数量） |
| **L5** 行动闭合 | 买不买 | PDPBuyBox + PDPStickyBar |

**STEP F 优势层**（Feature Flag 控制）：
- F-1 决策助推：真实库存紧迫感（无虚假倒计时）
- F-2 变体解释器：每个变体的推荐场景
- F-3 风险逆转：退货政策 + 使用保证 + 人工客服

### 4.3 数据模型

SilkBay 使用 Medusa v2 内置数据模型，自定义数据通过 `product.metadata` 存储：

```typescript
product.metadata = {
  brand_name?: string,
  amazon_rating?: number,       // 从 Amazon 导入
  amazon_review_count?: number,
  bullets?: string[],           // 强制 5 条
  faq?: Array<{question, answer}>,  // 强制 5 条
  videos?: Array<{id, thumbnailUrl, videoUrl, title, duration}>
}
```

### 4.4 待实现

- Cart API 真实对接（当前 mock）
- Amazon 数据自动导入管道（当前手工填入 metadata）
- SP-API → SilkBay 库存同步

---

## 五、GDP — Growth Data Platform

GDP 不是一个独立代码库，而是定义在 LiYe OS reasoning contracts 中的**基准数据平台层**。

### 5.1 在证据体系中的角色

```yaml
# evidence_fetch_map.yaml
source: GDP (Growth Data Platform) | ENGINE | MANUAL | T1_TRUTH
```

### 5.2 GDP 提供的数据

| 数据 | 查询引用 | 用途 |
|------|---------|------|
| category_avg_cpc | benchmarks/category_cpc.sql | 类目平均 CPC 基准 |
| category_avg_price | benchmarks/category_price.sql | 类目平均售价 |
| keyword_search_volume_avg | keywords/search_volume.sql | 关键词月均搜索量 |
| category_avg_price_trend | benchmarks/category_price_trend.sql | 价格趋势 |
| keyword_purchase_rate | 来自 concepts.yaml | 关键词购买率 |

### 5.3 归因边界声明

**站内 vs 站外归因是两套体系**：
- **Amazon Sponsored Ads 站内归因**：以 Amazon attributed 指标为准（14 天归因窗口），AGE 通过 Ads API 报告获取，无法做到 click 级追踪
- **自有/站外链路归因**：通过 Link Router 生成 click_id，attribution-kit 捕获 UTM 参数，可做到 click 级归因

以下仅描述自有链路的 GDP 归因职责。

### 5.4 GDP 的跨渠道归因职责

GDP 通过 UTM 体系统一追踪：Content Hub → Link Router → Brand Storefront → 转化。

```
growth-hub (Astro SEO 站)
    │  utm_source=muddymatsfordogs
    │  utm_medium=organic
    │  utm_campaign=content_funnel
    ↓
storefronts/link-router (302 重定向 + click_id)
    ↓
storefronts/sf-timomats (attribution-kit 捕获 UTM → cart metadata)
    ↓
SilkBay API (metadata 随订单存储)
    ↓
GDP (GA4 跨域追踪 + 归因分析)
```

### 5.5 GDP Schema 的保护级别

开发文档反复标注 **"无 GDP/T1 Truth schema 变更"** 作为硬约束，说明 GDP 的 schema 被视为底层真相层，不可随意修改。

---

## 六、支撑项目

### 6.1 Growth Hub (`growth-hub/`)

SEO 内容站群，Astro 驱动。向 storefronts 导流。

**关键规则**：CTA 链接必须经过 `link-router`，不可直接链接到 storefront。

### 6.2 Storefronts (`storefronts/`)

| 子项目 | 功能 |
|--------|------|
| `sf-timomats/` | Timo Mats 品牌独立站 (Next.js) |
| `sf-refetone/` | Refetone 品牌独立站 |
| `sf-foneyi/` | Foneyi Mats 品牌独立站 |
| `link-router/` | 无状态重定向服务：校验目标 → 生成 click_id → 302 重定向 |
| `storefront-kit/` | 交易 SDK：Medusa v2 API 封装 + 归因捕获（`silkbay-store.ts`） |
| `silkbay-governance/` | 治理文档 |

> **storefront-kit 同名但不同包**：`storefronts/storefront-kit/` 是交易 SDK（Medusa API client + 归因捕获），`silkbay/packages/storefront-kit/` 是 PDP 组件库（L1-L5 + STEP F React 组件）。前者负责"怎么买"，后者负责"怎么展示"。

### 6.3 Themes (`themes/`)

品牌主题资产仓库。核心文件 `sites/_registry.yaml` 是**全站网络的 SSOT**：

```yaml
# 每个站点映射到：
store_id, sales_channel_id, publishable_key, storefront_id, theme_id
```

消费方：Builders、Astro 站、GDP（归因）、Medusa（Store 映射）。

### 6.4 Kits (`kits/`)

共享 npm 包。当前：
- `@loudmirror/attribution-kit` — 归因捕获库，追踪 utm_*、gclid、fbclid、click_id，存储到 localStorage，转化为 Medusa cart metadata。

---

## 七、数据流全景

### 7.1 广告运营闭环（AGE 主线）

```
                    ┌─────────────────────┐
                    │   Amazon Ads API     │
                    │   (CPC 授权已打通)    │
                    └──────────┬──────────┘
                               │ 报告数据
                               ↓
              ┌─────────────────────────────┐
              │     ENGINE 数据仓库          │
              │  (DuckDB: fact_keyword_*,   │
              │   fact_asin_daily)           │
              └──────────┬──────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ↓                    ↓                    ↓
 GDP 基准数据      ENGINE 运营数据      MANUAL 人工输入
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                         ↓
              ┌─────────────────────────────┐
              │  evidence_fetch_map.yaml     │
              │  统一证据层 (source + conf)   │
              └──────────┬──────────────────┘
                         │
                         ↓
              ┌─────────────────────────────┐
              │  Reasoning Playbooks         │
              │  ACOS_TOO_HIGH → 诊断       │
              │  → ADD_NEGATIVE_KEYWORDS     │
              └──────────┬──────────────────┘
                         │
                         ↓
              ┌─────────────────────────────┐
              │  Changeset Pipeline          │
              │  Bootstrap → Guardrail       │
              │  → Approval → Execute        │
              │  → Verify → Experience       │
              │  → Policy Recommend          │
              └──────────┬──────────────────┘
                         │
                         ↓
              ┌─────────────────────────────┐
              │  Amazon Ads API (写回)       │
              │  调整出价 / 加否定词 /       │
              │  暂停广告                    │
              └─────────────────────────────┘
```

### 7.2 SP-API 打通后补齐的数据

```
Amazon SP-API (审核已通过)
    │
    ├── 订单数据 → revenue, quantity, order_id
    ├── Session 数据 → sessions, page_views, unit_session_pct
    ├── 库存数据 → inventory levels, FBA inbound
    │
    ↓
ENGINE 数据仓库
    │
    ├── fact_asin_daily 表灌入真实数据
    ├── ROI Calculator 可计算: revenue - ad_spend - COGS
    ├── TACOS 计算: ad_spend / total_revenue
    └── Keyword Governance 验证: 自然排名 + 广告排名联动效果
```

### 7.3 DTC 流量闭环

```
Growth Hub (SEO 内容站)
    ↓ CTA + UTM
Link Router (click_id 生成 + 302)
    ↓
Brand Storefront (Next.js)
    ↓ attribution-kit 捕获
SilkBay (Medusa 订单)
    ↓ cart metadata 含归因数据
GDP (GA4 跨域 + 归因分析)
    ↓ 内容效果反馈
Growth Hub (优化内容策略)
```

---

## 八、关键架构决策

### 8.1 AGE 是门控执行的领域引擎

AGE 拥有 Ads API 写入能力，但所有写操作必须经过 approval ticket 门控。实际执行链路：

1. OS 层级 `execute_limited` 授权执行范围
2. AGE 内部 Guardrail 校验（bid delta、budget delta、cold start）
3. Approval Ticket 验证（过期检查 + 单次消费）
4. Executor 幂等执行（IdempotencyLedger 去重）

这保证了：
- 策略不会在未经审批的情况下生效
- 每个写入操作可审计、可回滚
- 策略晋升由 OS 控制，AGE 不能自我学习后自我执行

### 8.2 Changeset 而非直接 API 调用

AGE 不直接调 Ads API 改出价。而是：
1. 生成一个不可变的 `ChangesetArtifact`（含完整决策记录）
2. 通过 Guardrail 校验
3. 经过 Approval Ticket 审批
4. 由 Executor 幂等执行（支持 canary 模式）
5. 由 Verifier 在 48h/7d 后验证效果

这套机制借鉴的是**金融交易系统**的设计，而非推荐系统。

### 8.3 Quirks 是实战壁垒

Amazon Ads API 没有统一的接口风格。SP/SB/SD 三种广告类型的 API 行为各不相同（Content-Type 要求、payload 格式、大小写敏感性）。AGE 记录了 10 个 quirk 并在执行前自动修正。这些 quirk 无法从官方文档获得，只能从真实 API 调用的错误中积累。

### 8.4 concepts.yaml 消除多义性

"CVR"在广告场景下 = orders/clicks，在 listing 场景下 = units/sessions。AGE 通过 `concepts.yaml` 强制使用 `AD_CVR` / `LISTING_CVR`，杜绝因术语混用导致的决策错误。

### 8.5 Evidence 可降级

`evidence_fetch_map.yaml` 为每个证据字段定义了 `fallback` 策略：
- `none` — 缺失则阻断
- `approx` — 用近似值
- `manual` — 回退到人工输入
- `strict_degrade` — 强制降低置信度

这意味着即使某些数据暂时不可用（如 SP-API 未打通），系统仍能在降级模式下运行。

---

## 九、安全与合规基线

### 9.1 凭证管理

- API 凭证（Ads API / SP-API）存储于 `.env.local`，不入版本控制
- OAuth2 refresh token 自动轮换（Ads API Client 内置 60s 提前量刷新）

### 9.2 最小权限

- Ads API：仅申请 reporting + campaign management scope
- SP-API：按需申请（订单/库存/业务报告），不申请卖家账户管理权限

### 9.3 审计链路

全链路 JSON 审计，每次操作产生完整 trace：

```
changeset.json → apply_report.json → verification_report.json
                                    → experience_summary.json
                                    → policy_suggestions.json
```

- `IdempotencyLedger`：JSONL 格式记录已执行 action，防重复执行
- `approval_consumed.json`：票据单次消费记录，防重放
- `memory_index.jsonl`：全局操作记忆索引

### 9.4 执行安全

- Guardrail 校验在执行前强制运行（max_bid_delta 20%, cold_start 48h 等）
- Canary 模式：可选只执行前 N 个 action
- Approval Ticket：带过期时间 + constraint check + 单次消费
- 模拟执行模式：生成确定性 fake ID，不触及真实 API

### 9.5 多租户隔离（规划中）

当前为单租户架构。多租户阶段需补充：
- 数据隔离（per-tenant DuckDB 或 schema 级隔离）
- 执行权限隔离（per-tenant approval ticket scope）
- 凭证隔离（per-tenant credential vault）

---

## 十、与常见认知的纠偏

### "这是一个数据闭环平台"

**不完全准确**。AGE 的核心不是 ETL 数据管道，而是一条**带审计轨迹的操作流水线**。数据仓库（DuckDB）是基础设施之一，但 changeset pipeline + guardrails + 幂等执行才是核心。

### "SP-API + Ads API = 增长 OS"

**少了一个支柱**。完整的三角是：
- **Ads API** — 广告操作数据（已打通）
- **SP-API** — 业务效果数据（待打通）
- **GDP** — 基准+归因数据（架构已定义）

### "ACOS 优化 → TACOS 优化 → 自然流量放大"

**方向正确**，AGE 已实现对应机制：
- ACOS 优化 → Wasted Spend Detection + Bid Recommend
- TACOS 优化 → 需要 SP-API total revenue 数据
- 自然流量放大 → Keyword Governance 的 HARVEST/DEFEND 层

### "算法自动化是终极目标"

**是的，但有安全层**。AGE 走的路线是：
> 有安全保障的渐进式自动化（L0→L1→L2→L3→L4），而非无保护的直接自动化。

当前处于 L2（半自动），L3 的基础设施已就绪。

---

## 十一、代码库实现状态总表

### 完全实现（有测试，可生产使用）

| 模块 | 位置 |
|------|------|
| PPC Changeset Pipeline (PR-4A~4K) | `src/ppc/` |
| Amazon Ads API Client | `src/integrations/amazon_ads/` |
| Wasted Spend Detection | `src/capabilities/amazon/strategy/` |
| 3 种 Campaign Bootstrap | `src/ppc/bootstrap/` |
| Ads Quirks Registry (10 quirks) | `src/ppc/amazon_ads/quirks/` |
| CasePack Runner CLI | `scripts/age/casepack_runner.py` |
| Job API (FastAPI) | `src/job_api/` |
| SBV Playwright Automation | `src/automation/sbv/` |
| DuckDB DDL (13 tables) | `src/domain/.../data_lake/` |
| Keyword Governance | `src/domain/.../strategy/` |
| ROI Calculator | `src/domain/.../attribution/` |
| Bid Recommend Playbook | `src/playbooks/bid_recommend.py` |
| Control Plane (status/runbook) | `src/ppc/control_plane/` |
| Experience Aggregation | `src/ppc/experience/` |
| Policy Recommender | `src/ppc/policy/` |
| MCP Server Layer | `src/runtime/mcp/` |
| PDP 五层组件库 | `silkbay/packages/storefront-kit/` |
| 多品牌 Store 隔离 | `silkbay/src/scripts/` |
| 交易 SDK (storefront-kit) | `storefronts/storefront-kit/` |
| Link Router | `storefronts/link-router/` |
| Attribution Kit | `kits/attribution-kit/` |

### 框架/Stub（结构存在，逻辑待填）

| 模块 | 说明 |
|------|------|
| SP-API Client | stub，待替换为真实客户端 |
| anomaly_detect playbook | placeholder |
| alert_score playbook | placeholder |
| CVR Predictor | config 存在，模型待实现 |
| 竞品监控 | 目录结构存在 |
| 品牌健康评分 | 目录结构存在 |
| Amazon → SilkBay 数据导入 | 无实现 |
| Cart API 对接 | mock |

### 规划中（只有配置/文档）

| 模块 | 说明 |
|------|------|
| GDP 查询层 | SQL 文件引用定义完毕，查询实现待写 |
| 学习管道 (Learned Bundle) | 架构设计完毕，管道待实现 |
