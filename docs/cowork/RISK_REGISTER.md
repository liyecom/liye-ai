# 风险登记簿 (Risk Register)

> **Phase**: 1-B (Module Scorecard & Risk Register)
> **Author**: Claude Cowork
> **Created**: 2026-01-13
> **Status**: Draft

---

## 风险评级标准

| 级别 | 定义 |
|------|------|
| **High** | 可能导致系统不可用、治理失效、数据丢失 |
| **Medium** | 可能导致功能退化、维护成本增加、技术债务 |
| **Low** | 轻微不便、可快速恢复 |

---

## Top Risks

### RISK-001: Frozen 目录被无意修改

**风险描述**: `.github/workflows/*gate*`、`_meta/governance/` 等 Frozen 级别目录被"好心整理"或重构误伤

**触发条件**:
- 新贡献者不了解稳定性契约
- IDE 批量重命名/移动操作
- 自动化脚本误操作

**影响范围**:
- 治理层级: Constitution / Gates
- 模块: CI/CD 全部门禁

**风险级别**: **High**

**控制策略**:
- [ ] 在 worktree / sandbox 中进行任何重构操作
- [ ] PR 必须经过 architecture-gate 检查
- [ ] 对 Frozen 目录的修改需要 RFC + 30 天通知
- [ ] 考虑对 Frozen 目录设置 CODEOWNERS 强制审批

---

### RISK-002: Contracts 与 Verdicts 混淆误用

**风险描述**: `_meta/contracts/` (机器可执行约束) 与 `verdicts/` (人类可读语义) 职责混淆，导致治理规则失效或决策语义错误

**触发条件**:
- 在 verdicts/ 中定义约束规则
- 在 contracts/ 中添加解释性文本
- 新系统直接消费 verdicts/ 作为规则来源

**影响范围**:
- 治理层级: Contracts / Verdicts
- 模块: 所有消费契约的 Skills 和 Builders

**风险级别**: **Medium**

**控制策略**:
- [ ] 维护清晰的职责边界文档 (已有 README)
- [ ] CI 验证 contracts/ 符合 schema
- [ ] Code Review 时明确检查用途是否正确
- [ ] 考虑添加 linter 规则检测跨边界引用

---

### RISK-003: Track 生命周期管理失控

**风险描述**: `tracks/` 中的执行容器未正确冻结，导致已完成阶段被修改，破坏审计链

**触发条件**:
- 未生成 checkpoint.yaml
- 手动修改已冻结阶段的 spec.md 或 plan.md
- 术语表版本漂移

**影响范围**:
- 治理层级: Tracks
- 模块: 所有使用 governed 模式的任务

**风险级别**: **Medium**

**控制策略**:
- [ ] 确保 `verify_glossary_usage.sh` 在 CI 中运行
- [ ] 对 frozen 状态的 track 设置只读保护
- [ ] 在 governed 模式下强制生成 checkpoint

---

### RISK-004: 敏感信息泄露

**风险描述**: API Keys、Tokens 等敏感信息意外提交到版本控制

**触发条件**:
- 将 `.env` 文件提交到 Git
- 在文档中硬编码真实密钥
- 日志中输出敏感信息

**影响范围**:
- 治理层级: Security
- 模块: tools/notion-sync, systems/information-radar, systems/site-deployer

**风险级别**: **High**

**控制策略**:
- [ ] `.env` 已在 .gitignore 中（已确认）
- [ ] 只版本化 `.env.example` 文件（已确认）
- [ ] 启用 gitleaks 或类似工具扫描（amazon-leak-guard.yml 已存在）
- [ ] 定期审计日志输出

---

### RISK-005: CI Gates 误报导致开发阻塞

**风险描述**: 过于严格的 CI 门禁导致正常开发被阻塞，引发绕过门禁的冲动

**触发条件**:
- 门禁规则过于严格或有 bug
- 误报率高
- 修复门禁本身需要特殊权限

**影响范围**:
- 治理层级: Gates
- 模块: 所有开发工作流

**风险级别**: **Medium**

**控制策略**:
- [ ] 门禁规则应有 advisory 模式用于调试
- [ ] 记录所有门禁失败的 root cause
- [ ] 避免使用 `--no-verify` 等绕过手段
- [ ] 门禁规则变更需要测试覆盖

---

### RISK-006: 知识引擎 (Geo Pipeline) 数据质量退化

**风险描述**: `tools/geo-pipeline/` 处理的 Truth Sources 质量下降，导致下游应用系统输出错误

**触发条件**:
- T2 层数据未经 refinement 直接导出
- truth_delta_gate 被绕过
- 数据源格式变更未适配

**影响范围**:
- 治理层级: Core Infrastructure
- 模块: 所有消费 geo_units.json 的应用系统

**风险级别**: **High**

**控制策略**:
- [ ] 严格遵守 Tier Guard 规则 (T0/T1/T2)
- [ ] T2 → T1 提升必须经过 refinement pipeline
- [ ] 定期验证输出质量
- [ ] 保持回放测试用例 (replays/geo/) 更新

---

### RISK-007: Pack/Context 编译逻辑错误

**风险描述**: `.claude/scripts/assembler.mjs` 编译逻辑错误，导致 Claude 获得错误或不完整的上下文

**触发条件**:
- Pack 关键词匹配规则错误
- Pack 内容超过限制未被检测
- 编译输出格式错误

**影响范围**:
- 治理层级: Stable
- 模块: 所有 Claude Code 会话

**风险级别**: **Medium**

**控制策略**:
- [ ] 使用 guardrail.mjs 检查 Pack 大小限制
- [ ] 编译输出应可预览和验证
- [ ] 关键 Pack 变更需要人工 review

---

### RISK-008: 目录结构隐性依赖断裂

**风险描述**: 重命名或移动目录导致隐性路径引用断裂（硬编码路径、相对引用）

**触发条件**:
- 重命名一级目录
- 移动子目录到不同父目录
- 批量文件操作

**影响范围**:
- 治理层级: 全局
- 模块: 所有存在路径引用的模块

**风险级别**: **Medium**

**控制策略**:
- [ ] 在 worktree / sandbox 中测试重命名影响
- [ ] 使用 grep 搜索所有路径引用
- [ ] 优先使用配置变量而非硬编码路径
- [ ] 变更后运行完整 CI 测试

---

### RISK-009: 多语言 (i18n) 内容漂移

**风险描述**: `i18n/` 与源文件内容不同步，导致用户获得过时或矛盾的信息

**触发条件**:
- 修改源文件未同步更新 i18n
- 翻译质量问题
- i18n gate 未覆盖所有文件

**影响范围**:
- 治理层级: Stable
- 模块: 所有支持 i18n 的文档

**风险级别**: **Low**

**控制策略**:
- [ ] i18n-gate.yml 已存在（已确认）
- [ ] 建立翻译更新 checklist
- [ ] 考虑自动化翻译同步提醒

---

### RISK-010: 外部依赖突然不可用

**风险描述**: Notion API、GitHub Actions、npm 包等外部依赖服务中断或 breaking change

**触发条件**:
- 第三方服务 API 变更
- 依赖包 major version 升级
- 服务不可用

**影响范围**:
- 治理层级: Experimental
- 模块: tools/notion-sync, CI workflows, 所有 npm 依赖

**风险级别**: **Medium**

**控制策略**:
- [ ] 锁定依赖版本 (package-lock.json)
- [ ] 记录外部 API 版本依赖
- [ ] 关键工作流应有离线降级方案
- [ ] 定期更新依赖并测试

---

### RISK-011: "好心整理" 误伤活跃模块

**风险描述**: 看起来"不活跃"或"冗余"的目录实际被隐性依赖，贸然清理导致系统故障

**特别关注目录**:
- `Glossaries/` - 可能有遗留引用
- `state/` - 可能被运行时依赖
- `memory/` - 可能有隐性消费者

**触发条件**:
- 仅根据 git log 活跃度判断
- 未搜索全局引用
- 未在隔离环境测试

**影响范围**:
- 治理层级: Experimental
- 模块: 任何看似不活跃的目录

**风险级别**: **Medium**

**控制策略**:
- [ ] 清理前必须 grep 全局引用
- [ ] 在 worktree 中测试删除影响
- [ ] 优先 Archive 而非 Delete
- [ ] 保留 30 天观察期

---

### RISK-012: 稳定性契约版本升级风险

**风险描述**: 从 `0.y.z` 进入 `1.0.0+` 稳定阶段时，现有 Experimental 模块突然受到更严格约束

**触发条件**:
- 发布 1.0.0 版本
- 采用者依赖了 Experimental 组件

**影响范围**:
- 治理层级: Architecture Contract
- 模块: 所有 Experimental 级别模块

**风险级别**: **Low** (目前仍在 0.y.z 阶段)

**控制策略**:
- [ ] 1.0.0 前评估所有 Experimental 模块
- [ ] 提前通知采用者
- [ ] 制定迁移指南

---

## 易被"好心整理"误伤的目录

| 目录 | 风险点 | 建议 |
|------|--------|------|
| `.github/workflows/` | Frozen 级别，改动破坏治理 | **绝对不动** |
| `_meta/governance/` | 宪法层 | **绝对不动** |
| `_meta/contracts/` | 新系统，还在演进 | 谨慎，不要"简化" |
| `.claude/` | 日常入口，改动影响所有会话 | 谨慎，测试后改 |
| `Glossaries/` | 可能有遗留引用 | 确认无引用再归档 |
| `state/` | 可能被运行时读取 | 确认无消费者再清理 |
| `replays/` | 被 CI 门禁依赖 | 不要删除测试用例 |
| `verdicts/` | 看似空但有职责定义 | 保留 |

---

## P0 结论（只读）

以下 5 条判断是**最明确、低争议**的：

### 1. `.github/workflows/` 和 `_meta/governance/` 绝对不应首先动刀

这两个目录是 **Frozen 级别**，是整个治理体系的基础。任何修改都需要 RFC + 30 天通知 + 迁移指南。贸然修改可能导致所有 CI 门禁失效，治理崩溃。

### 2. `tools/geo-pipeline/` 是最高优先级的核心资产

作为知识引擎，它是所有应用系统的上游。任何质量问题会级联影响全部下游。应该优先保护和投资，而非简化。

### 3. 任何重构操作必须在 worktree / sandbox 中进行

绝不在 main 分支或工作目录直接进行结构性改动。先在隔离环境验证影响，确认无破坏后再合并。

### 4. `websites/` 是 Constitution 明确的 Non-Goal，最安全的"减法"对象

Constitution 第 2 节明确列出 "Websites, blogs, landing pages" 为 Explicit Non-Goals。这是最无争议的拆分对象。

### 5. 优先 Archive 而非 Delete

对于低活跃度目录（如 `Crews/`, `Artifacts_Vault/`, `Extensions/`），正确的处理方式是先归档并保留 30 天观察期，而非直接删除。这样可以安全回滚。

---

*Phase 1-B RISK_REGISTER 完成*
