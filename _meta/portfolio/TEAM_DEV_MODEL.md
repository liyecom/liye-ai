# Team Dev Model（治理原生的多人开发模型）v0.3

> 状态：v0.3，随 [[ICONEXPERT_ONBOARDING]] 维护第 2 位开发者 iconexpert 的受治理入场边界。
> v0.3 更新：2026-07-10 将 2026-07-08 的 AGE Full Operator / Human-D3 owner directive 重述为具名、限期、可撤销的 operator envelope；Human-D3 只表示能力资格，不再表示 standing authority。本次只纠正文档，不改变 GitHub 权限、凭证、live gate 或 runtime。
> 定位：本文件定义「**人类开发者如何作为受治理 actor 加入这套系统**」的总原则。
> 权威序：本文件服从 `_meta/portfolio/SYSTEMS.md`（架构 SSOT）与各 repo 的 contracts/CLAUDE.md；冲突以后者为准。

## 0. 核心立场

加一个人 **不是**「再搭一套团队平台」，而是**在现有治理 fabric 里注册一个新的受治理 actor**。
能力按**人数触发**渐进解锁，不按日历提前建设（镜像本系统既有的 gate / 触发 / fail-closed 心智）。

主权根保持 bus factor = 1：信封定义、开门/扩权、doctrine、control-plane 变更、继承安排只属于 owner/operator。运营连续性不得是 1；第二受限 operator 只能在已有具名信封内执行、review、ack 与恢复。

## 1. 设计原则（spine）

1. **代码走 GitHub，不走机器拷贝。** 唯一同步层 = GitHub：feature branch → PR → review → merge。
2. **每人本机独立开发。** Mac Studio 不作为多人共用主力工作树；它是数据/生产/兜底节点，默认只由 owner 操作。
3. **同步策略，不同步身份。** 可共享：配置模板、hooks、commands、agents、MCP 模板、bootstrap。**不可共享**：auth/登录态、session/history、个人 memory、任何 token/API key/生产凭证、machineID。
4. **能力资格不等于授权。** Human-Dn 表示 actor 能做什么；operator envelope 表示此刻允许在什么范围、期限与刹车内做；per-action approval 表示一次动作是否开门。三者不得互相继承。
5. **自动化不能自授权。** 写信封的定义、开门、扩权永远由 operator 翻牌；信封内动作才可按既有阶梯毕业为自动，且刹车须在被调用方，并有 receipt + readback。
6. **禁止再委托。** 受限 operator 不得把权限、凭证、会话或操作席位委托给第三人、agent 或其他 runtime；需要新 actor 时必须由 owner 定义新信封。
7. **数据集中挂载或快照，不随意复制。** 例外见 §5：单写者 DuckDB warehouse 不可共享挂载。
8. **三个 gate 互相独立**：① PR-merge（人审）② readiness（rehearsal 证据）③ production/live（当次 approval + 现有 fail-closed 锁）。合并 ≠ 上线。
9. **真边界看有效 enforcement，不看配置自述。** 本地 hook、warning、detection-only、未享有当前 plan entitlement 的 server 配置都不是 fail-closed 边界。机器门须有 fail-closed 语义、相对被治理者的篡改证据、真实拦截或受控演习记录，三项缺一即未认证。

## 2. Human-Dn 成熟度阶梯

对人复用 AGE 自身的 `write_capability` declared/effective + D0→D3 模式；该阶梯只授予**资格**，不授予 standing authority：

| 等级 | 能力资格 | 晋升证据 | 默认权限边界 |
|---|---|---|---|
| **D0**（入职默认） | 只读数据、fixture/synthetic dry-run、测试、开 PR | — | 不发任何生产 env + 不设 `AGE_WRITE_ENABLED`（凭证缺失即结构性阻断，见 [[ICONEXPERT_ONBOARDING]] §1） |
| **D1** | staging/sandbox 写、独立修低风险模块 | 3–5 个 PR 通过，无 secret/data/live 边界事故 | 仅具名 sandbox/只读凭证；仍无 live 信封 |
| **D2** | 备 readiness packet、跑受控 rehearsal | 多次完成端到端闭环 | 受限 env + owner 监督；仍无 live 信封 |
| **D3** | 有资格在受治理执行面承接 production 操作 | 极少数核心 operator；owner explicit directive + 实弹证据 | 只有 active named mutation envelope 覆盖的动作可做；信封内按既有 per-action policy 执行，绝不从资格继承 |

Human-D3 是资格记录，不是角色特权。资格可保留而信封到期、冻结或撤销；信封存在也不能绕过其内部 action gate。

## 3. 权限模型（轻量；person #3 才正式化为矩阵）

| 角色 | GitHub | Secrets | Data | AGE Live | 说明 |
|---|---|---|---|---|---|
| Owner / Sovereignty Root | Admin | Prod + Dev | Full | 定义/开门/扩权 | 只有 owner 可改 doctrine/control-plane、定义信封、作例外裁决与继承安排 |
| Restricted Operator | Write（当前 API readback；有效约束见 §4） | 不由角色授予；实际分发不在 public SSOT 声明 | Read；DB mutation 另授权 | 仅执行已授权 action | iconexpert 当前是 Human-D3-qualified，并持有 §3.1 的限期基础信封；不是 admin，也无 standing live cell |
| Core Dev | Write/Maintain | Dev + 选定 staging | Read | 不可直接 live | 可独立开发核心模块 |
| Contributor | Write（feature 分支） | 仅 Dev | Read scoped | 否 | iconexpert 初期在此 = Human-D0；2026-07-08 的资格升级已 supersede 此历史状态 |
| Analyst / FDE | Triage/Read | 客户专属 | Read scoped | 否 / 仅 approval | 看报表、跑部署/诊断 |
| Automation Bot | 最小 app 权限 | OIDC/service acct | None/scoped | 否（除非 gated） | CI、release（**触发后才建**） |

### 3.1 当前具名 operator envelope

| 字段 | 值 |
|---|---|
| Envelope ID | `AGE-OPS-ICONEXPERT-2026Q3` |
| Actor | iconexpert |
| Capability record | Human-D3-qualified（2026-07-08 owner directive；历史上破格跳过 D1/D2，按 standing appointment 使用的表述由本版终止） |
| Effective from | 2026-07-08 |
| Valid through | **2026-10-06 23:59 Asia/Shanghai**（90 天；不自动续期） |
| Base scope | AGE canonical worktree preflight；docs/PR；read-only report；fixture/synthetic dry-run；rehearsal；Operator Workbench；review/ack；已授权动作的 recovery prep |
| Mutation scope | **无 standing mutation authority。** SP-API/Ads/listing live write、rollback、canonical DB mutation/repair、truth-layer/receipt repair 均须另有 operator 定义的 mutation envelope |
| Status | Active；可由 owner 随时撤销；到期后授权层面为零 privileged action，未完成动作必须 freeze |
| Expiry enforcement | 当前是 trust+detection：文档到期不等于 envelope-bound 凭证/角色自动消失；owner 必须在到期/撤销时完成撤销或降级并留 receipt，机器自动失效在演习认证前不得宣称 |

每个 mutation envelope 至少须定义：具名 client/cell、操作类别、范围/额度、有效窗口、信封刹车、被调用方 fail-closed gate、per-action approval policy 与 rollback/recovery policy；其内每次执行仍须绑定 commit/request hash、receipt 与 readback。信封内 per-action 可按既有 Band/Rung/D0-D3 阶梯毕业为自动，不要求永久逐次人工翻牌；但定义、开门、扩权 mutation envelope 仍只属于 owner。一个 client/cell 的授权不得推导出另一个 client/cell 的权限；cross-account mutation 必须是显式新信封。

`AGE-OPS-ICONEXPERT-2026Q3` 明确**不授予**：

- 定义、开启、扩大或续期任何信封；提高额度或延长 action window。
- 修改 doctrine、control-plane、GitHub rule/admin/bypass、credential scope 或 kill switch。
- 将权限、凭证、session、review 席位或执行工作再委托给任何人或 agent。
- 从历史 Phase、Human-D3、PR merge、readiness packet 或其他 client/cell 继承 live authority。
- 在 shared runtime 上自行切分权限薄片，或把一次 action approval / mutation envelope 解释成范围外的 standing production access。

续期必须由 owner 在到期前显式翻牌，并复核本期 receipt、incident、bypass 与撤权演练证据；沉默不构成续期。到期即没有任何合法 privileged action；若技术 access 尚存，它只代表待撤销暴露面，不代表授权。以下任一事件立即触发 freeze + owner review，并可撤销本信封：越界动作；无 recorded review 的 bypass；receipt/readback 缺失；凭证 provenance 事故；擅自委托；unsafe DB concurrency / WAL；篡改或绕过 gate；到期仍继续操作。

## 4. 人类信封 enforcement 现状（2026-07-10 readback）

“配置存在”“actor 受纪律约束”“机器 fail-closed”是三种不同事实：

| 面 | 已核事实 | 2026-07-10 认证口径 |
|---|---|---|
| AGE GitHub role | GitHub API 返回 iconexpert = `write`，非 admin | 权限范围是服务端事实；不等于 review gate 已认证 |
| AGE main branch rule | API 仍返回 `protected=true`、PR + 1 review、禁 force-push/delete、`required_status_checks=null`、`enforce_admins=false` 的配置对象 | AGE 是个人 User 的 private repo，operator 确认当前为 GitHub Free；该 plan 不提供 private protected branches。故**配置存在不计作有效机器门**，在 plan 升级/组织迁移并完成实弹前按 trust+detection 记账 |
| Human review history | 2026-07-08 至 07-10 的 AGE merge 历史含 owner 无 recorded review 合并；既有 UGE 治理历史也出现过自审自合 | 证明当前人类 provenance 可被绕过；review 纪律是活跃风险输入，不得写成“branch protection 仍生效” |
| Governed AGE write paths | 部分 listing/offer 路径有 request hash、approval、receipt/readback 等被调用方 gate；legacy ad 写仍非全覆盖 | 只按 action/path 逐项认证；不能上升为“Human-D3 已被机器约束” |
| Envelope/expiry/no-redelegation/doctrine 边界 | 本文件与 onboarding 可审计；未发现统一 machine policy | **trust+detection**；以 violation → freeze/revoke 作为撤销触发器；到期后的技术撤权仍需 owner receipt，不与机器 enforcement 混称 |
| Secrets | 凭证缺失/作用域可形成结构性阻断；实际向 actor 分发状态不在 public SSOT 声明 | 未提供凭证时可 machine-block；一旦下发，只按具名 action scope 记账，禁止推导 standing access |

要把任一行升级为“机器已覆盖”，必须同时补齐：fail-closed 语义、相对 actor 的防篡改/留痕证据、真实拦截或受控注入演习记录。升级模型能力、存在 resolver/code path、存在 GitHub 配置对象都不够。

## 5. 数据策略（按「他做什么」分流）

- **做 AGE 开发**：D0 阶段**不需要**大数据；warehouse `data/amazon_growth.duckdb`（≈2.7GB）是**单写者 + 跨 worktree 硬链 + 禁并发写**（AGE `CLAUDE.md`），**绝不可用 SMB 共享 live 文件**。需分析时给**带日期的只读快照副本**。
- **Restricted Operator 例外**：只有在独立 mutation envelope 明列 DB mutation/repair 时，才可在 canonical clean worktree + exclusive-access window 内读写 live warehouse；必须先确认 no-WAL / no-concurrent-writer，并在 decision log 或 receipt 中记录 postcheck。Human-D3 或基础信封本身不授予此例外。
- **碰 silkbay / 少宁服饰数据（≈20GB）**：那是 silkbay 产品线数据，**AGE 代码零引用**；仅当涉及 silkbay 时才走 **NAS/SMB 只读挂载、不拷贝**。

## 6. Secrets 策略（与现有 ADR 一致）

- 凭证统一走代码层 `CredentialBroker` seam（默认读 `process.env`，AGE 用 `python-dotenv` 从 gitignored `.env.local`）。
- **不引入外部 secret manager**：`_meta/adr/ADR-Credential-Mediation.md` 明确「不立项 vault」，显式拒绝 Vault/AWS Secrets Manager/**1Password**。→ **1Password 不进 Day-1**；若团队规模/轮换痛点出现，须**重开该 ADR** 再议。
- 本地 pre-commit 钩子（secret 正则、`.env` 阻断、forbidden-name lint）是**辅助**：可 `--no-verify` 绕、且 fresh clone 默认不装。当前服务端 branch-rule 配置未获 plan + 实弹认证，不能充当秘密治理的 machine backstop；现有 backstop 只按具体 CI leak-guard 与凭证缺失/作用域逐项声明。

## 7. 触发器表（到点才做，禁提前建设）

| 触发条件 | 才启用 |
|---|---|
| 本信封续期或 actor scope 变化 | owner 显式 review receipt/incident/bypass 证据后，签发新期限/新信封；不得原地静默延长 |
| 需要宣称人类 review fail-closed | GitHub Pro 或组织迁移成本翻牌 → 配置无 bypass 的 required review → 受控绕过演习 → 记录实弹；此前保持 trust+detection 标签 |
| 第 3 人加入 | 正式角色矩阵 + 扩展（非新建）CODEOWNERS；每人独立 envelope，禁止链式委托 |
| 30 天无人连续性成为对外/运营承诺 | 先做 continuity inventory + dead-man protocol，再做 hands-off 演习；未经演习不得认证 |
| 频繁需要 AGE 分析数据 | 定期 DuckDB/Parquet 只读快照管线 |
| 多 agent 反复撞 session | `age-workon` worktree allocator + lock 文件（user/host/branch/pid/started_at） |
| 客户现场部署启动 | **独立** FDE / runtime-not-source 交付轨道（与本模型解耦） |

## 8. 验收标准（可证伪）

1. 新开发者只需 GitHub invite + 数据挂载权限（+ 进入 D1 才需 sandbox 凭证），即可跑通 onboarding，无需 owner 手工复制环境。
2. `dev_doctor.sh` 明确输出 pass/fail（含「无生产 env / hooks 已装 / dry-run 可跑」），不靠口头排查。
3. 任意 PR 可回答：谁改、影响什么、谁 review、跑了什么验证；无 recorded review 的 merge 显式标成 bypass，不伪装成 reviewed。
4. 任意 AGE live/DB/truth mutation 可回答：哪个 envelope、谁批准、哪个 client/cell、哪个 commit/request hash、哪个 receipt/readback、如何 rollback。
5. 任意 human operator 可回答：当前 envelope ID、到期时间、禁止项、撤销触发器；到期后零合法 privileged action，且 owner 能出示技术撤权 receipt。机器自动关门在演习前保持未认证。
6. 撤权演练：operator envelope 到期/撤销时，30 分钟内撤销或降级其 envelope-bound role/token；完整 offboarding 才撤全部 GitHub/机器 access。未经至少一次 hands-off 演习，运营连续性视为未认证。

链：[[SYSTEMS]] · [[ICONEXPERT_ONBOARDING]] · `_meta/adr/ADR-Credential-Mediation.md`
