# 文件级裁决 (File Verdicts)

> **Phase**: 1-C (File-Level Analysis)
> **Author**: Claude Cowork
> **Created**: 2026-01-13
> **Status**: Draft

---

## 裁决标准

| 裁决 | 定义 | 行动 |
|------|------|------|
| **Freeze** | 不可修改，是治理基础 | 保护，任何修改需 RFC |
| **Keep** | 核心资产，持续维护 | 投资，优先保护 |
| **Review** | 需要评估是否保留 | 分析后决定 |
| **Archive** | 低活跃，可归档 | 移至 archive/ 观察 30 天 |
| **Delete** | 确认无用 | 确认后删除 |

---

## 1. Top 20 最核心文件

以下文件是 LiYe OS 的核心资产，**任何修改都需要谨慎评估**：

| 排名 | 文件路径 | 裁决 | 核心原因 |
|------|----------|------|----------|
| 1 | `_meta/governance/ARCHITECTURE_CONTRACT.md` | **Freeze** | 架构宪法，治理基础 |
| 2 | `_meta/governance/CONSTITUTIONAL_LOCK.md` | **Freeze** | 宪法锁，不可变 |
| 3 | `.github/workflows/architecture-gate.yml` | **Freeze** | 架构门禁，CI 核心 |
| 4 | `CLAUDE.md` | **Freeze** | Claude 主入口 |
| 5 | `.claude/scripts/assembler.mjs` | **Keep** | Pack 编译器，所有会话依赖 |
| 6 | `tools/geo-pipeline/config.yaml` | **Keep** | 知识引擎配置 |
| 7 | `src/mission/types.js` | **Keep** | 类型定义，15+ 引用 |
| 8 | `src/mission/utils.js` | **Keep** | 工具函数，12+ 引用 |
| 9 | `_meta/contracts/decision_contract.yaml` | **Keep** | 决策契约 |
| 10 | `_meta/contracts/stability_contract.yaml` | **Keep** | 稳定性契约 |
| 11 | `.claude/scripts/guardrail.mjs` | **Keep** | 护栏检查 |
| 12 | `.github/workflows/domain-replay-gate.yml` | **Freeze** | 回放测试门禁 |
| 13 | `tools/geo-pipeline/refinement/truth_delta_gate.py` | **Keep** | T2→T1 门控 |
| 14 | `src/kernel/state/index.js` | **Keep** | 状态管理核心 |
| 15 | `docs/architecture/CONSTITUTION.md` | **Keep** | 宪法文档 |
| 16 | `docs/architecture/WORLD_MODEL_GATE.md` | **Keep** | 世界模型门文档 |
| 17 | `.claude/scripts/pre_tool_check.mjs` | **Keep** | 工具预检 |
| 18 | `.claude/scripts/stop_gate.mjs` | **Keep** | 停止门控 |
| 19 | `src/brokers/llm/client.js` | **Keep** | LLM 客户端，8+ 引用 |
| 20 | `replays/geo/README.md` | **Keep** | 回放测试说明 |

---

## 2. Top 20 最可能的包袱候选

以下文件/目录可能是历史遗留或低价值资产，**建议优先评估是否归档**：

| 排名 | 文件/目录 | 当前裁决 | 包袱理由 | 建议行动 |
|------|-----------|----------|----------|----------|
| 1 | `Crews/` | **Archive** | CrewAI 框架遗留，无引用 | 归档 |
| 2 | `websites/` | **Extract** | Constitution 明确的 Non-Goal | 拆分到独立仓库 |
| 3 | `.claude/scripts/smoke_route_geo_alias.mjs` | **Review** | 无入口引用，疑似孤立 | 确认后归档 |
| 4 | `.claude/scripts/audit_redirect_usage.mjs` | **Review** | 无入口引用，疑似孤立 | 确认后归档 |
| 5 | `.claude/scripts/report_prefix_debt.mjs` | **Review** | 无入口引用，疑似孤立 | 确认后归档 |
| 6 | `Artifacts_Vault/` (如存在) | **Archive** | 低活跃，产物存储 | 归档 |
| 7 | `Extensions/` (如存在) | **Archive** | 实验性扩展 | 归档 |
| 8 | `Glossaries/` (如存在) | **Review** | 可能有遗留引用 | grep 确认后处理 |
| 9 | `tools/web-publisher/` | **Review** | 低使用频率 | 评估后决定 |
| 10 | `systems/site-deployer/` | **Review** | 与 websites 关联 | 随 websites 拆分 |
| 11 | `builders/` | **Review** | 模板目录，使用率低 | 评估后决定 |
| 12 | `i18n/` (部分) | **Review** | 可能与源文件不同步 | 同步或归档 |
| 13 | `docs/legacy/` (如存在) | **Archive** | 历史文档 | 归档 |
| 14 | `memory/` (如存在) | **Review** | 可能有隐性消费者 | 确认后处理 |
| 15 | `state/` (如存在) | **Review** | 可能被运行时依赖 | 确认后处理 |
| 16 | `Skills/` (部分) | **Review** | 部分技能可能过时 | 逐个评估 |
| 17 | `Agents/` (部分) | **Review** | 部分 Agent 可能未使用 | 逐个评估 |
| 18 | `tools/notion-sync/` | **Review** | 外部依赖，稳定性风险 | 评估 ROI |
| 19 | `config/deprecated/` (如存在) | **Delete** | 废弃配置 | 确认后删除 |
| 20 | `*.backup` 文件 (如存在) | **Delete** | 备份文件 | 删除 |

---

## 3. Hotspots 清单 (需深度分析)

以下区域是"高风险 + 高价值"的热点，**值得投入时间做逐行分析**：

### 3.1 治理热点

| 热点 | 文件/目录 | 分析价值 | 风险等级 |
|------|-----------|----------|----------|
| **Constitution** | `_meta/governance/` | 理解治理规则 | Critical |
| **Contracts** | `_meta/contracts/` | 理解机器契约 | High |
| **Gates** | `.github/workflows/*gate*.yml` | 理解 CI 门禁 | Critical |

### 3.2 知识引擎热点

| 热点 | 文件/目录 | 分析价值 | 风险等级 |
|------|-----------|----------|----------|
| **Geo Config** | `tools/geo-pipeline/config.yaml` | 理解数据流 | Critical |
| **Tier Guard** | `tools/geo-pipeline/refinement/` | 理解 T2→T1 提升 | High |
| **Replays** | `replays/geo/cases/` | 理解决策行为 | High |

### 3.3 运行时热点

| 热点 | 文件/目录 | 分析价值 | 风险等级 |
|------|-----------|----------|----------|
| **Mission Core** | `src/mission/` | 理解任务系统 | High |
| **Assembler** | `.claude/scripts/assembler.mjs` | 理解 Pack 编译 | High |
| **State** | `src/kernel/state/` | 理解状态管理 | Medium |

### 3.4 建议分析顺序

1. `_meta/governance/ARCHITECTURE_CONTRACT.md` — 理解治理基础
2. `tools/geo-pipeline/config.yaml` — 理解知识引擎
3. `.claude/scripts/assembler.mjs` — 理解会话上下文
4. `_meta/contracts/decision_contract.yaml` — 理解决策规则
5. `src/mission/types.js` + `utils.js` — 理解核心抽象

---

## 4. 绝对不值得逐行分析的区域

以下区域**投入产出比极低**，不建议做逐行分析：

### 4.1 明确不值得

| 区域 | 原因 | 建议 |
|------|------|------|
| `node_modules/` | 第三方依赖，有 package-lock.json | 跳过 |
| `.venv/` | Python 虚拟环境 | 跳过 |
| `.claude/.compiled/` | 编译输出，自动生成 | 跳过 |
| `websites/` | Constitution Non-Goal | 拆分后跳过 |
| `Crews/` | 遗留代码，无引用 | 归档后跳过 |
| `*.log` 文件 | 日志文件 | 跳过 |
| `*.backup` 文件 | 备份文件 | 删除 |

### 4.2 低 ROI 区域

| 区域 | 原因 | 建议 |
|------|------|------|
| `docs/` (纯文档) | 无代码逻辑 | 快速浏览即可 |
| `builders/templates/` | 模板文件 | 按需查看 |
| `i18n/` | 翻译文件 | 自动化检查即可 |
| `config/` (非核心) | 配置文件 | 按需查看 |
| `tests/fixtures/` | 测试数据 | 跳过 |

### 4.3 可延迟分析

| 区域 | 原因 | 建议 |
|------|------|------|
| `systems/information-radar/` | 应用层，非核心 | Phase 2+ |
| `systems/site-deployer/` | 应用层，可能拆分 | Phase 2+ |
| `tools/notion-sync/` | 工具层，外部依赖 | Phase 2+ |
| `Skills/` 大部分 | 按需加载 | Phase 2+ |
| `Agents/` 大部分 | 按需使用 | Phase 2+ |

---

## 5. 文件级裁决汇总

### 5.1 按裁决统计

| 裁决 | 文件/目录数 | 占比 |
|------|-------------|------|
| **Freeze** | ~30 | ~4% |
| **Keep** | ~200 | ~29% |
| **Review** | ~150 | ~21% |
| **Archive** | ~50 | ~7% |
| **Delete-candidate** | ~20 | ~3% |
| **跳过 (依赖/生成)** | ~250 | ~36% |

### 5.2 按目录裁决

| 目录 | 主裁决 | 行动建议 |
|------|--------|----------|
| `_meta/governance/` | **Freeze** | 保护 |
| `.github/workflows/*gate*` | **Freeze** | 保护 |
| `CLAUDE.md` | **Freeze** | 保护 |
| `.claude/scripts/` | **Keep** | 维护 |
| `src/mission/` | **Keep** | 维护 |
| `src/kernel/` | **Keep** | 维护 |
| `tools/geo-pipeline/` | **Keep** | 投资 |
| `_meta/contracts/` | **Keep** | 维护 |
| `docs/architecture/` | **Keep** | 维护 |
| `replays/geo/` | **Keep** | 维护 |
| `tracks/` | **Keep** | 维护 |
| `verdicts/` | **Keep** | 维护 |
| `systems/` | **Review** | 评估 |
| `tools/notion-sync/` | **Review** | 评估 |
| `builders/` | **Review** | 评估 |
| `Skills/` | **Review** | 逐个评估 |
| `Agents/` | **Review** | 逐个评估 |
| `websites/` | **Extract** | 拆分 |
| `Crews/` | **Archive** | 归档 |

---

## 6. 结论性清单

### 6.1 P0 行动项 (立即执行)

1. **保护 Frozen 资产**: 确保 `_meta/governance/`, `.github/workflows/*gate*`, `CLAUDE.md` 不被意外修改
2. **归档 Crews/**: 创建 `archive/crews/` 并移动，保留 30 天观察期
3. **记录 websites/ 拆分计划**: 创建 RFC 文档，规划独立仓库迁移

### 6.2 P1 行动项 (本周内)

1. **确认孤立脚本**: grep 验证 `smoke_route_geo_alias.mjs`, `audit_redirect_usage.mjs`, `report_prefix_debt.mjs` 是否真正孤立
2. **评估 builders/**: 确定模板是否仍在使用
3. **同步 i18n/**: 运行 i18n-gate 检查，修复不同步文件

### 6.3 P2 行动项 (本月内)

1. **深度分析 Hotspots**: 按 Section 3.4 顺序逐一分析
2. **清理 Delete-candidate**: 确认后执行删除
3. **建立 CODEOWNERS**: 对 Frozen 目录设置强制审批

---

## 7. 世界模型门 (World Model Gate) 应用

### 7.1 T1 层 (因果推理)

**问题**: 为什么这些文件是核心资产？

**答案**:
- `_meta/governance/` 定义了治理规则，所有决策必须遵守
- `tools/geo-pipeline/` 是知识来源，所有应用系统依赖其输出
- `.claude/scripts/assembler.mjs` 编译会话上下文，每个会话都依赖它

### 7.2 T2 层 (状态评估)

**问题**: 当前仓库的健康状态如何？

**答案**:
- **治理层**: 完整，有 Constitution + Contracts + Gates
- **核心层**: 稳定，高频文件引用关系清晰
- **工具层**: 需要清理，有孤立脚本和遗留目录
- **应用层**: 需要评估，部分可能拆分

### 7.3 T3 层 (动态预测)

**问题**: 如果不做任何清理，会发生什么？

**答案**:
- 短期: 无明显影响
- 中期: 技术债务累积，新贡献者困惑
- 长期: 维护成本上升，"好心整理"风险增加

---

*Phase 1-C FILE_VERDICTS 完成*

---

## 附录: 快速参考卡

### 绝对保护 (Frozen)
```
_meta/governance/
.github/workflows/*gate*.yml
CLAUDE.md
```

### 核心投资 (Keep + High Priority)
```
tools/geo-pipeline/
src/mission/
.claude/scripts/
_meta/contracts/
```

### 安全清理 (Archive/Delete)
```
Crews/                    → Archive
websites/                 → Extract to separate repo
*.backup                  → Delete
node_modules/, .venv/     → Skip (regenerable)
```

### 深度分析 (Hotspots)
```
1. _meta/governance/ARCHITECTURE_CONTRACT.md
2. tools/geo-pipeline/config.yaml
3. .claude/scripts/assembler.mjs
4. _meta/contracts/decision_contract.yaml
5. src/mission/types.js + utils.js
```
