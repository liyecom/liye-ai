# Iconexpert Onboarding v0.3

> 目标：记录 iconexpert 从 Human-D0 onboarding 到 **AGE Full Operator / Human-D3** 的治理边界。
> 上位文件：[[TEAM_DEV_MODEL]]（总原则 + Human-Dn + 触发表）。本文件保留 Day-1 SOP，并记录当前 operator status。
> 范围：仅 AGE。明确排除：liye_os installer 阻塞、1Password、OIDC bot、CODEOWNERS 重构、中央数据服务、FDE/客户交付。

## 0. 当前状态（2026-07-08）

Owner directive: iconexpert 从初始 Human-D0 升级为 **AGE Full Operator / Human-D3**。

Full Operator 允许：

- 操作 AGE canonical worktree preflight、docs/PR、read-only report、dry-run/rehearsal、Operator Workbench。
- 在 exclusive-access window 内执行 canonical DB migration / repair，并记录 no-WAL / no-concurrent-writer guard。
- 对 truth-layer / receipt 做带证据链的 repair，但必须记录原始 artifact、变更 SQL/脚本、postcheck。
- 在明确 scope + commit/request hash + rollback path + 人工批准点齐备时，作为 runner 执行 SP-API / Ads / listing live write。

Full Operator 不代表：

- 不代表 GitHub admin 或 branch protection bypass。
- 不代表共享 owner auth、session、Keychain、Studio shell 或任何不可审计凭证。
- 不代表长期打开 `AGE_WRITE_ENABLED`；该开关只能在单次已授权 live run 中临时启用。
- 不代表 Phase 3/4 或任意历史授权自动继承到后续 live write、rollback、DB mutation 或 truth sync。
- 不代表可跳过双人 approval；当 AGE policy 要求双人 approval 时，Full Operator 只能作为其中一个受治理 actor。

## 1. D0 边界契约（历史基线；2026-07-08 已 superseded）

iconexpert 入场时为 **Human-D0**。以下 D0 禁止项保留为回滚/审计基线；当前实际权限以 §0 的 Full Operator 任命为准：

| # | 禁止 | 为什么（已核实的机制） |
|---|---|---|
| D0-1 | **不下发任何生产 env** | AGE 凭证从 `os.environ` 经 repo-root `.env.local`（`python-dotenv`，gitignored）注入。fresh clone **零凭证**=任何写路径（含 chokepoint 范围外的 legacy ad 写）都拿不到 Amazon 凭证。变量名：`SPAPI_LWA_CLIENT_ID/SECRET`、`SPAPI_REFRESH_TOKEN`、`ADS_CLIENT_ID/SECRET/REFRESH_TOKEN/PROFILE_ID`、以及各店铺态前缀 `<STORE>_*`（真实店名单见私有仓，不写进 public 仓） |
| D0-2 | **不设 `AGE_WRITE_ENABLED`**（及任何 `AGE_*_WRITE_ENABLED` 通道保险丝） | **governed listing / `execute_request` 路径**的三重 fail-closed 锁：`AGE_WRITE_ENABLED=1`（默认 0）+ `AGE_EXECUTION_MODE=live`（默认 `dry_run`）+ clean-main 前置（防 `GIT_DIR`/`GIT_WORK_TREE` 伪造、无 `--allow-dirty` 旁路）。⚠️ 此锁**不覆盖** legacy ad 写（见 D0-3）；那条路径的兜底 = D0-1 凭证缺失 |
| D0-3 | **不跑 legacy ad write 脚本** | `live_chokepoint.py` 只覆盖 `live + listing review kinds`；`ad-only live → return None`（flagged follow-up, spec §7）。故 chokepoint **不是** ad 写的全覆盖闸，D0 安全靠「凭证缺失 + 不跑这类脚本」 |
| D0-4 | **不共享 live DuckDB** | `data/amazon_growth.duckdb`（≈2.7GB）单写者、跨 worktree 硬链、禁并发写（AGE `CLAUDE.md`）。D0 用 fixture/synthetic，不碰 live warehouse |
| D0-5 | **不进 Mac Studio shell** | Studio 上的 `.env.local`（chmod 600）含多店真生产凭证；给 shell = 绕过 D0-1。Studio 仅 owner 操作 |

**D0 允许**：只读代码、`uv run pytest`（无凭证）、fixture/synthetic dry-run、开 feature 分支 PR。

## 2. Day-1 执行（历史 D0 onboarding；AGE，他的 Mac mini）

前提：他自己的 GitHub 账号、自己的 Claude/Codex 登录、SSH key 已加到 GitHub。

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

**Day-1 完成标志（本 PR 阶段）**：`uv sync` 通过 + hooks 装上 + `pytest` 绿——全程无 prod creds、无 Studio shell。

**dry-run 里程碑（待 PR-2 解锁）**：`execute_request --mode dry_run` 需要一个 `EXECUTION_REQUEST_PATH` synthetic fixture。本 PR（契约先落）**不提供** fixture，故此步暂不可跑，勿假装可跑。PR-2 的 `dev_doctor.sh` 落地并附带最小 synthetic request 后，D0 里程碑才升级为「dry-run 产出 `DRY_RUN_APPLIED` receipt（默认 `dry_run` + `AGE_WRITE_ENABLED` 未设）」。

## 3. 服务端边界（D0 baseline + current non-bypass rules）

- AGE main：✅ branch protection 已配（PR + 1 review、禁 force-push/删除、`required_status_checks=null`、admin 保留 bypass）。iconexpert 升级为 Full Operator 后仍不默认获得 admin bypass；改 main 必须走 PR + review。
- AGE secret scanning：❌ 私有仓不可用（需 GHAS）。→ 密钥防线 = 本地 hooks（必装）+ CI leak-guard（`koi-leakage-lint`/`bare-ads-write-lint`/`amazon-leak-guard`）+ D0-1 凭证缺失。
- AGE CI：**暂不作 required check**（`ci.yml` 仅 guard-rail + best-effort；重测试在 post-merge；曾因计费/runner `steps:[]` 失败）。合并门 = **PR 人审 + 本地验证记录**，等 CI 连续绿再加 required。
- liye_os：本次 Full Operator scope 是 AGE production/operator lane；liye_os SSOT 修改仍走 PR + owner review，不因 AGE operator 身份自动获得 control-plane admin。

## 4. 权限发放

- 当前状态：iconexpert → AGE **Full Operator / Human-D3**（见 [[TEAM_DEV_MODEL]] §3.1）。
- GitHub 权限建议为 Write/Maintain；branch protection 继续生效，不授予默认 admin bypass。
- 生产凭证可按 Full Operator scope 经安全信道受控分发；不得提交、同步、截图或写入任何 repo / memory / artifact。
- `AGE_WRITE_ENABLED` 不作为常驻环境变量分发；仅在单次已授权 live run 命令环境中临时设置。
- 若任意生产凭证、DB write、truth-layer repair、rollback 或 live write 超出当次授权 scope，必须停下重新取得明确授权。

## 5. 配套 PR 路线（历史 D0 route；契约先落，工具后补）

| PR | 交付 | 目的 |
|---|---|---|
| **PR-0** | 本文件 + [[TEAM_DEV_MODEL]] | 冻结 D0 边界契约 |
| PR-1 | AGE 准确 `.env.local.example.dev` | 现有 `.env.example` 失真（Docker 时代变量名）；进入 D1 前的前置（变量名取自 `config/store_pulse/*_instance.yaml` + `src/integrations/amazon_{spapi,ads}_credentials.py`） |
| PR-2 | `dev_doctor.sh` | 强制校验：repo 内无 `.env.local`；shell 无 `SPAPI_*/ADS_*/<STORE>_*` 等生产变量；`AGE_WRITE_ENABLED` 未设；hooks 已装；dry-run/test 可跑 |
| PR-3 | `liye_os/bin/install-hooks.sh` | liye_os 当前缺 installer（靠手敲 `git config core.hooksPath .claude/.githooks`），补上对齐 AGE |
| PR-4 | `dev-dotfiles` 私有仓 + `bootstrap.sh` | 装可共享配置模板（去密钥）、自动设两仓 hooksPath、提示登录/填密钥 |

## 6. 撤权（offboarding 预案）

30 分钟内可撤：GitHub org 权限 + 任何分发的 sandbox/prod token + （若曾给）Studio 独立账号。撤权后必须 rotation/revoke 所有曾向 iconexpert 分发的 production secrets，并记录最后一次 AGE live/DB/truth-layer 操作的 receipt 或 decision log。

---

承接审查：本文件可直接交 Codex 跑 BLOCKER/WARNING/INFO，重点核：secret 泄漏面、Studio 越权、CI required 误阻塞、pre-commit 误当边界、dotfiles 同步身份态、D0 五条边界是否齐全可执行。
