# Iconexpert Onboarding v0.4

> 目标：记录 iconexpert 从 Human-D0 onboarding 到 Human-D3-qualified，并把当前 AGE operator authority 固化为具名、限期、可撤销的信封。
> 上位文件：[[TEAM_DEV_MODEL]]（总原则 + Human-Dn + envelope 规则）。本文件保留 Day-1 SOP，并记录当前 operator status。
> v0.4 更新：2026-07-10 将 2026-07-08 的 Full Operator standing appointment 重述为 `AGE-OPS-ICONEXPERT-2026Q3`；不改变 GitHub 权限、凭证、live gate 或 runtime。
> 范围：仅 AGE。明确排除：liye_os installer 阻塞、1Password、OIDC bot、CODEOWNERS 重构、中央数据服务、FDE/客户交付。

## 0. 当前状态：Human-D3-qualified + 限期基础信封

2026-07-08 owner directive 证明 iconexpert 具备 **Human-D3 qualification**；它曾以“AGE Full Operator / Human-D3”表述，并破格跳过 D1/D2。本版终止把资格当 standing authority 的解释，将该 directive 重述如下：

| 字段 | 当前记录 |
|---|---|
| Envelope ID | `AGE-OPS-ICONEXPERT-2026Q3` |
| Actor | iconexpert |
| Effective from | 2026-07-08 |
| Valid through | **2026-10-06T15:59:00Z**（90 天；UTC；不自动续期） |
| Base scope | canonical worktree preflight、docs/PR、read-only report、fixture/synthetic dry-run、rehearsal、Operator Workbench、review/ack、已授权动作的 recovery prep |
| Standing mutation authority | **None** |
| Revocation authority | owner 可随时 freeze/revoke；到期后授权层面为零 privileged action |
| Expiry enforcement | 当前是 trust+detection：文档到期不自动删除 envelope-bound 凭证/角色；owner 须完成撤销或降级并留 receipt，机器自动失效在演习前不得宣称 |

基础信封允许：

- 操作 AGE canonical worktree preflight、docs/PR、read-only report、fixture/synthetic dry-run、rehearsal、Operator Workbench。
- review/ack 已有 evidence packet；准备 recovery / rollback 方案，但不因准备工作获得执行权。
- 作为 runner 候选承接一个**由 owner 另行定义**、仍在有效窗口内的 mutation envelope；该信封内部按其既有 per-action policy 执行。

以下动作不在基础信封内，必须落入 owner 另行定义的 mutation envelope：

- SP-API / Ads / listing live write 或 rollback。
- canonical DB migration / mutation / repair。
- truth-layer / receipt manual repair。
- 任何 credential scope 扩大、client/cell 变化、额度提高或时间窗延长。

每个 mutation envelope 至少须写明：client/cell、操作类别、范围/额度、有效窗口、信封刹车、被调用方 fail-closed gate、per-action approval policy 与 rollback/recovery policy；其内每次执行仍须绑定 commit/request hash、receipt、readback。per-action 可按既有 Band/Rung/D0-D3 阶梯毕业为自动，不要求永久逐次人工翻牌；但 envelope 的定义、开门、扩权仍只属于 owner。一个 client/cell 的授权不外溢到另一个 client/cell；cross-account mutation 必须新开信封。

本信封明确禁止：

- 获得或使用 GitHub admin、branch-rule bypass、control-plane/doctrine 修改权、kill-switch 修改权。
- 定义、开门、扩大、续期信封，或把 per-action approval / mutation envelope 变成范围外的 standing access。
- 共享 owner auth、session、Keychain、Studio shell 或任何不可审计凭证。
- 把权限、凭证、执行席位或 review 职责再委托给任何人或 agent。
- 从 Human-D3、历史 Phase、PR merge、readiness packet 或别的 client/cell 继承 live 权限。
- 长期打开 `AGE_WRITE_ENABLED`，或跳过 policy 要求的 approval、receipt、readback。

续期只能由 owner 在复核本期 receipt、incident、bypass 与撤权证据后显式签发；沉默不续期。到期即没有任何合法 privileged action；若技术 access 尚存，它是待撤销暴露面，不是授权。越界动作、无 recorded review 的 bypass、receipt/readback 缺失、凭证 provenance 事故、擅自委托、unsafe DB concurrency/WAL、gate 绕过或到期继续操作，均触发立即 freeze + owner review。

## 1. D0 边界契约（历史基线）

iconexpert 入场时为 **Human-D0**。以下 D0 禁止项保留为回滚/审计基线；资格记录与当前有效信封见 §0：

| # | 禁止 | 为什么（已核实的机制） |
|---|---|---|
| D0-1 | **不下发任何生产 env** | AGE 凭证从 `os.environ` 经 repo-root `.env.local`（`python-dotenv`，gitignored）注入。fresh clone **零凭证**=任何写路径（含 chokepoint 范围外的 legacy ad 写）都拿不到 Amazon 凭证。变量名：`SPAPI_LWA_CLIENT_ID/SECRET`、`SPAPI_REFRESH_TOKEN`、`ADS_CLIENT_ID/SECRET/REFRESH_TOKEN/PROFILE_ID`、以及各店铺态前缀 `<STORE>_*`（真实店名单见私有仓，不写进 public 仓） |
| D0-2 | **不设 `AGE_WRITE_ENABLED`**（及任何 `AGE_*_WRITE_ENABLED` 通道保险丝） | **governed listing / `execute_request` 路径**的三重 fail-closed 锁：`AGE_WRITE_ENABLED=1`（默认 0）+ `AGE_EXECUTION_MODE=live`（默认 `dry_run`）+ clean-main 前置（防 `GIT_DIR`/`GIT_WORK_TREE` 伪造、无 `--allow-dirty` 旁路）。⚠️ 此锁**不覆盖** legacy ad 写（见 D0-3）；那条路径的兜底 = D0-1 凭证缺失 |
| D0-3 | **不跑 legacy ad write 脚本** | `live_chokepoint.py` 只覆盖 `live + listing review kinds`；`ad-only live → return None`（flagged follow-up, spec §7）。故 chokepoint **不是** ad 写的全覆盖闸，D0 安全靠「凭证缺失 + 不跑这类脚本」 |
| D0-4 | **不共享 live DuckDB** | `data/amazon_growth.duckdb`（≈2.7GB）单写者、跨 worktree 硬链、禁并发写（AGE `CLAUDE.md`）。D0 用 fixture/synthetic，不碰 live warehouse |
| D0-5 | **不进 Mac Studio shell** | Studio 上的 `.env.local`（chmod 600）含多店真生产凭证；给 shell = 绕过 D0-1。Studio 仅 owner 操作 |

**D0 允许**：只读代码、`uv run pytest`（无凭证）、fixture/synthetic dry-run、开 feature 分支 PR。

## 2. Day-1 执行（历史 D0 onboarding；actor 自有机器）

前提：actor 自己的 GitHub 账号、自己的 Claude/Codex 登录、SSH key 已加到 GitHub。

```bash
# 1) clone（不带 .env.local ⇒ 零凭证）
git clone <AGE_REPO_SSH_URL>         # 精确 clone URL 由 owner 经受控渠道下发，不写进 public 仓
cd amazon-growth-engine
git submodule update --init          # vendor/liye-ai；compat 检查需要

# 2) Python 环境（uv.lock 为准，requires-python >=3.10）
uv sync

# 3) 装本地辅助钩子（KOI-leak + doc-contract + push-main 阻断）—— 非安全边界，但必装
./bin/install-hooks.sh

# 4) 无凭证核心测试（semantic-live / integration 默认跳过，无需 key）
uv run pytest
```

**Day-1 完成标志**：`uv sync` 通过 + hooks 装上 + `pytest` 绿——全程无 prod creds、无 Studio shell。

**dry-run 里程碑**：`execute_request --mode dry_run` 需要 synthetic `EXECUTION_REQUEST_PATH` fixture；只有 fixture 存在且 `dev_doctor.sh` readback 通过时才可宣称完成，不以文档计划替代实跑。

## 3. 服务端边界：配置、有效 enforcement 与纪律分开记账

- AGE 是个人 User 下的 private repo；GitHub API 于 2026-07-10 返回 iconexpert = `write`，非 admin。
- API 同时返回一份 main branch-rule 配置对象：`protected=true`、PR + 1 review、禁 force-push/delete、`required_status_checks=null`、`enforce_admins=false`。但 operator 确认当前是 GitHub Free，而 private protected branches 不在该 plan entitlement 内；故此配置**不计作已认证的机器 review gate**。
- 2026-07-08 至 07-10 的实际 AGE merge history 含 owner 无 recorded review 合并，证明 admin/bypass provenance 风险已经发生；“配置存在”不得写成“branch protection 仍生效”。
- 当前人类 review/no-redelegation/envelope 边界按 **trust+detection** 记账；违反即 freeze/revoke。只有升级 plan 或迁移组织、启用无 bypass 的 required review、并通过真实拦截/受控绕过演习后，才可升级为 machine-enforced。
- AGE secret scanning：private repo 当前不声明为可用。密钥防线只按本地 hooks（可绕、非边界）、具体 CI leak-guard、凭证缺失/作用域逐项记账。
- AGE write gate 只按具体 action/path 认证；部分 governed listing/offer 路径的 fail-closed 不能覆盖 legacy ad 写，也不能推导出整个人类信封已机器化。
- liye_os 修改仍走 PR + owner review；AGE operator envelope 不授予 liye_os control-plane authority。

## 4. 权限与凭证发放

- 当前 GitHub readback：iconexpert = `write`；本 PR 不更改该权限。
- Human-D3 qualification 不自动发放任何生产凭证。生产凭证只有在有效 mutation envelope 需要时，才可按 client/cell + 最小 scope 经安全信道临时/受控分发。
- 不得提交、同步、截图或写入任何 repo / memory / artifact；不得把凭证、session 或操作任务再委托。
- `AGE_WRITE_ENABLED` 不作为常驻环境变量分发；仅在仍有效的 mutation envelope 内、按该次执行的 hash binding 临时设置。
- 任意 live write、rollback、DB mutation/repair、truth-layer repair 超出 scope/额度/窗口/client/cell，必须 fail-closed 停下，由 owner 决定是否开新信封。

## 5. 配套 PR 路线（历史 D0 route；按真实 demand 才实施）

| PR | 交付 | 目的 |
|---|---|---|
| **PR-0** | 本文件 + [[TEAM_DEV_MODEL]] | 冻结 D0 边界契约 |
| PR-1 | AGE 准确 `.env.local.example.dev` | 现有 `.env.example` 失真时，作为进入 D1 的 demand-pull 前置 |
| PR-2 | `dev_doctor.sh` | 校验 repo/shell 无生产 env、write flag 未设、hooks 已装、dry-run/test 可跑 |
| PR-3 | `liye_os/bin/install-hooks.sh` | 仅当 fresh-clone 反复形成 incurred manual 时立项，不因 onboarding 清单预建 |
| PR-4 | 共享配置模板/bootstrap | 仅共享无密钥配置；有具名 consumer + SLA 后才立项，不同步身份态 |

## 6. 到期、撤权与连续性

到期或撤权后立即停止新 privileged action；安全默认是 freeze + read-only/dry-run，不是继续完成。文档到期本身不是技术撤权：owner 须在 30 分钟内撤销或降级 envelope-bound credential/role，并为动作留 receipt。普通开发用 GitHub access 只有在另有角色依据时才可保留，且不携带 production authority；完整 offboarding 才撤全部 GitHub/机器 access。随后 rotate/revoke 所有曾分发的 production secrets，并记录最后一次 AGE live/DB/truth-layer 操作的 envelope + receipt/readback。

计划内缺席只能使用仍有效的具名信封；意外失能走 dead-man protocol，不允许第二 operator 自行扩权。任何 30 天 hands-off 连续性宣称，在实弹演习通过前均为未认证。

---

承接审查：重点核 Human-D3 是否被误读为 standing authority、mutation envelope 是否定义 client/cell + policy 且每次执行绑定 hash + receipt/readback、信封是否到期/可撤销/禁再委托、GitHub 配置是否被误称为 machine enforcement，以及本文件是否意外改变了真实权限或 runtime。
