# Team Dev Model (治理原生的多人开发模型) v0.2

> 状态：v0.2，随 [[ICONEXPERT_ONBOARDING]] 一同首次落地（第 2 位开发者 iconexpert 入场）。
> v0.2 更新：2026-07-08 owner directive 将 iconexpert 从 Human-D0 升级为 AGE Full Operator / Human-D3。
> 定位：本文件定义「**人类开发者如何作为受治理 actor 加入这套系统**」的总原则。
> 权威序：本文件服从 `_meta/portfolio/SYSTEMS.md`（架构 SSOT）与各 repo 的 contracts/CLAUDE.md；冲突以后者为准。

## 0. 核心立场

加一个人 **不是**「再搭一套团队平台」，而是**在现有治理 fabric 里注册一个新的受治理 actor**。
能力按**人数触发**渐进解锁，不按日历提前建设（镜像本系统既有的 gate / 触发 / fail-closed 心智）。

## 1. 设计原则（spine）

1. **代码走 GitHub，不走机器拷贝。** 唯一同步层 = GitHub：feature branch → PR → review → merge。
2. **每人本机独立开发。** Mac Studio 不作为多人共用主力工作树；它是数据/生产/兜底节点，默认只由 owner 操作。
3. **同步策略，不同步身份。** 可共享：配置模板、hooks、commands、agents、MCP 模板、bootstrap。**不可共享**：auth/登录态、session/history、个人 memory、任何 token/API key/生产凭证、machineID。
4. **AGE 默认本地 dry-run；生产写集中授权。** 真实 SP-API/Ads 写继续集中在受控环境，由 owner 监督。
5. **数据集中挂载或快照，不随意复制。** 例外见 §5：单写者 DuckDB warehouse 不可共享挂载。
6. **三个 gate 互相独立**：① PR-merge（人审）② readiness（rehearsal 证据）③ production/live（双人 approval + 现有 fail-closed 锁）。合并 ≠ 上线。
7. **真边界在服务端，不在本地钩子。** 本地 pre-commit 是辅助（可被 `--no-verify` 绕、且 fresh clone 默认不生效），不是安全边界。见 §6。

## 2. Human-Dn 成熟度阶梯

对人复用 AGE 自身的 `write_capability` declared/effective + D0→D3 模式：

| 等级 | 能力 | 晋升条件 | 落地机制 |
|---|---|---|---|
| **D0**（入职默认） | 只读数据、fixture/synthetic dry-run、测试、开 PR | — | 不发任何生产 env + 不设 `AGE_WRITE_ENABLED`（凭证缺失即结构性阻断，见 [[ICONEXPERT_ONBOARDING]] §2） |
| **D1** | staging/sandbox 写、独立修低风险模块 | 3–5 个 PR 通过，无 secret/data/live 边界事故 | 发 sandbox/只读 API 凭证；仍不设 live 保险丝 |
| **D2** | 备 readiness packet、跑受控 rehearsal | 多次完成端到端闭环 | 受限 env + owner 监督 |
| **D3** | 可执行 production live | 极少数核心 operator；owner explicit directive | 现有三重 fail-closed 锁 + 双人 approval；per-action 授权不继承 |

晋升 = owner 卸下审批负担的明确通道，避免 owner 永久成为瓶颈。

## 3. 权限模型（轻量；person #3 才正式化为矩阵）

| 角色 | GitHub | Secrets | Data | AGE Live | 说明 |
|---|---|---|---|---|---|
| Owner | Admin | Prod + Dev | Full | 可批准 | 你 / 核心负责人 |
| Full Operator | Write/Maintain（branch protection 仍生效） | Prod + Dev（受控分发，不入库） | Full / DB exclusive-window write | 可执行已授权 live | **iconexpert 当前状态 = Human-D3**；可作为 production runner/operator，但不等于绕过 fail-closed gate |
| Core Dev | Write/Maintain | Dev + 选定 staging | Read | 不可直接 live | 可独立开发核心模块 |
| Contributor | Write（feature 分支） | 仅 Dev | Read scoped | 否 | iconexpert 初期在此 = Human-D0；2026-07-08 已 superseded |
| Analyst / FDE | Triage/Read | 客户专属 | Read scoped | 否 / 仅 approval | 看报表、跑部署/诊断 |
| Automation Bot | 最小 app 权限 | OIDC/service acct | None/scoped | 否（除非 gated） | CI、release（**触发后才建**） |

### 3.1 当前 operator 任命

| Actor | Effective from | Level | Scope | Non-bypass gates |
|---|---|---|---|---|
| iconexpert | 2026-07-08 | Human-D3 / AGE Full Operator | AGE canonical worktree preflight；docs/PR；read-only reports；dry-run/rehearsal；Operator Workbench；canonical DB migration/repair in exclusive-access windows；truth-layer/receipt repair with evidence；SP-API/Ads/listing live execution when separately approved | No shared auth/session；no committed secrets；no dirty-main live；no blanket `AGE_WRITE_ENABLED`；no Phase authorization inheritance；dual approval remains when policy requires it |

Full Operator 是受治理 production operator，不是 unrestricted admin。它授予「可承接生产操作流程」的资格；每次 live write、rollback、canonical DB mutation、truth-layer manual repair 仍必须绑定明确 scope、commit/request hash、receipt/readback、rollback path 和当次授权。

## 4. 真边界 = 服务端 gate（现状，2026-06-30 核实）

| repo | 可见性 | branch protection | secret scanning / push protection |
|---|---|---|---|
| AGE（`amazon-growth-engine`，私有仓；精确 owner/URL 见受控渠道，不落 public 仓） | 私有 | ✅ 已配（PR + 1 review、禁 force-push/删除、`required_status_checks=null`=人审闸非 CI 硬闸、admin 保留 bypass） | ❌ 不可用（私有仓需 GitHub Advanced Security，个人 Pro 不含）→ 密钥防线靠本地 hooks + CI leak-guard + 凭证缺失 |
| `liyecom/liye-ai`（liye_os） | 公开 | ⏳ 待配（公开仓免费；需 liyecom owner 操作，见触发表/onboarding） | ⏳ 待开（公开仓免费） |

CI 暂**不**作 required check：AGE `ci.yml` 仅 guard-rail + best-effort verify，重测试在 post-merge path-scoped workflow；且 Actions 计费/runner 曾致 `steps:[]` 形态失败。等连续绿再启用。

## 5. 数据策略（按「他做什么」分流）

- **做 AGE 开发**：D0 阶段**不需要**大数据；warehouse `data/amazon_growth.duckdb`（≈2.7GB）是**单写者 + 跨 worktree 硬链 + 禁并发写**（AGE `CLAUDE.md`），**绝不可用 SMB 共享 live 文件**。需分析时给**带日期的只读快照副本**。
- **AGE Full Operator / D3 例外**：可在 canonical clean worktree + exclusive-access window 内读写 live warehouse，但必须先确认 no-WAL / no-concurrent-writer，并在 decision log 或 receipt 中记录 postcheck。该例外不适用于 D0-D2。
- **碰 silkbay / 少宁服饰数据（≈20GB）**：那是 silkbay 产品线数据，**AGE 代码零引用**；仅当涉及 silkbay 时才走 **NAS/SMB 只读挂载、不拷贝**。

## 6. Secrets 策略（与现有 ADR 一致）

- 凭证统一走代码层 `CredentialBroker` seam（默认读 `process.env`，AGE 用 `python-dotenv` 从 gitignored `.env.local`）。
- **不引入外部 secret manager**：`_meta/adr/ADR-Credential-Mediation.md` 明确「不立项 vault」，显式拒绝 Vault/AWS Secrets Manager/**1Password**。→ **1Password 不进 Day-1**；若团队规模/轮换痛点出现，须**重开该 ADR** 再议。
- 本地 pre-commit 钩子（secret 正则、`.env` 阻断、forbidden-name lint）是**辅助**：可 `--no-verify` 绕、且 fresh clone 默认不装。真 backstop = 服务端（branch protection + 可用处的 secret scanning）+ CI leak-guard + 凭证缺失（不下发即写不了）。

## 7. 触发器表（到点才做，禁提前建设）

| 触发条件 | 才启用 |
|---|---|
| 第 3 人加入 | 正式角色矩阵 + 扩展（非新建）CODEOWNERS + 收紧 branch protection |
| CI 稳定 load-bearing 且计费稳 | required status checks + OIDC service bot |
| 频繁需要 AGE 分析数据 | 定期 DuckDB/Parquet 只读快照管线 |
| 多 agent 反复撞 session | `age-workon` worktree allocator + lock 文件（user/host/branch/pid/started_at） |
| 客户现场部署启动 | **独立** FDE / runtime-not-source 交付轨道（与本模型解耦） |

## 8. 验收标准（可证伪）

1. 新开发者只需 GitHub invite + 数据挂载权限（+ 进入 D1 才需 sandbox 凭证），即可跑通 onboarding，无需 owner 手工复制环境。
2. `dev_doctor.sh` 明确输出 pass/fail（含「无生产 env / hooks 已装 / dry-run 可跑」），不靠口头排查。
3. 任意 PR 可回答：谁改、影响什么、谁 review、跑了什么验证。
4. 任意 AGE live 写可回答：谁批准、哪个 commit、哪个 request hash、哪个 receipt、如何 rollback。
5. 撤权演练：30 分钟内撤 GitHub + 任何分发的 sandbox token。

链：[[SYSTEMS]] · [[ICONEXPERT_ONBOARDING]] · `_meta/adr/ADR-Credential-Mediation.md`
