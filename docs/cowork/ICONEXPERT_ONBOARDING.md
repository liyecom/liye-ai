# Iconexpert Onboarding v0.2

> 目标：1–2 天内让 iconexpert 在自己的 **Mac mini** 上，**无生产凭证、不污染主仓、按 Human-D0 边界**参与 **AGE** 开发。
> 上位文件：[[TEAM_DEV_MODEL]]（总原则 + Human-Dn + 触发表）。本文件是 Day-1 可执行 SOP。
> 范围：仅 AGE。明确排除：liye_os installer 阻塞、1Password、OIDC bot、CODEOWNERS 重构、中央数据服务、FDE/客户交付、生产写权下放。

## 1. D0 边界契约（**先冻结这几条，工具后补**）

iconexpert 入场即 **Human-D0**。D0 **禁止**以下，且由 `dev_doctor.sh`（PR-2 交付）强制校验：

| # | 禁止 | 为什么（已核实的机制） |
|---|---|---|
| D0-1 | **不下发任何生产 env** | AGE 凭证从 `os.environ` 经 repo-root `.env.local`（`python-dotenv`，gitignored）注入。fresh clone **零凭证**=任何写路径（含 chokepoint 范围外的 legacy ad 写）都拿不到 Amazon 凭证。变量名：`SPAPI_LWA_CLIENT_ID/SECRET`、`SPAPI_REFRESH_TOKEN`、`ADS_CLIENT_ID/SECRET/REFRESH_TOKEN/PROFILE_ID`、店铺态 `XMEDEN_*`/`TIMO_*`/`MRMIAN_*`/`FONEYI_*` |
| D0-2 | **不设 `AGE_WRITE_ENABLED`**（及任何 `AGE_*_WRITE_ENABLED` 通道保险丝） | live 写三重 fail-closed 锁：`AGE_WRITE_ENABLED=1`（默认 0）+ `AGE_EXECUTION_MODE=live`（默认 `dry_run`）+ clean-main 前置（防 `GIT_DIR`/`GIT_WORK_TREE` 伪造、无 `--allow-dirty` 旁路） |
| D0-3 | **不跑 legacy ad write 脚本** | `live_chokepoint.py` 只覆盖 `live + listing review kinds`；`ad-only live → return None`（flagged follow-up, spec §7）。故 chokepoint **不是** ad 写的全覆盖闸，D0 安全靠「凭证缺失 + 不跑这类脚本」 |
| D0-4 | **不共享 live DuckDB** | `data/amazon_growth.duckdb`（≈2.7GB）单写者、跨 worktree 硬链、禁并发写（AGE `CLAUDE.md`）。D0 用 fixture/synthetic，不碰 live warehouse |
| D0-5 | **不进 Mac Studio shell** | Studio 上的 `.env.local`（chmod 600）含多店真生产凭证；给 shell = 绕过 D0-1。Studio 仅 owner 操作 |

**允许**：只读代码、`uv run pytest`（无凭证）、fixture/synthetic dry-run、开 feature 分支 PR。

## 2. Day-1 执行（AGE，他的 Mac mini）

前提：他自己的 GitHub 账号、自己的 Claude/Codex 登录、SSH key 已加到 GitHub。

```bash
# 1) clone（不带 .env.local ⇒ 零凭证 ⇒ 结构上无法 live 写）
git clone git@github.com:loudmirror/amazon-growth-engine.git
cd amazon-growth-engine
git submodule update --init          # vendor/liye-ai；compat 检查需要

# 2) Python 环境（uv.lock 为准，requires-python >=3.10）
uv sync

# 3) 装本地辅助钩子（KOI-leak + doc-contract + push-main 阻断）—— 非安全边界，但必装
./bin/install-hooks.sh

# 4) 无凭证核心测试（semantic-live / integration 默认跳过，无需 key）
uv run pytest

# 5) D0 里程碑：fixture / synthetic dry-run（默认 dry_run + AGE_WRITE_ENABLED 未设）
EXECUTION_REQUEST_PATH=<synthetic_request.json> \
  uv run python -m src.execution.execute_request --mode dry_run
```

**D0 完成标志**：`uv sync` 通过 + hooks 装上 + `pytest` 绿 + dry-run 产出 `DRY_RUN_APPLIED` receipt——全程无 prod creds、无 Studio shell。

## 3. 服务端边界（已就位 / 待办）

- AGE main：✅ branch protection 已配（PR + 1 review、禁 force-push/删除、`required_status_checks=null`、admin 保留 bypass）。iconexpert（write、非 admin）改 main 必须走 PR + owner 审。
- AGE secret scanning：❌ 私有仓不可用（需 GHAS）。→ 密钥防线 = 本地 hooks（必装）+ CI leak-guard（`koi-leakage-lint`/`bare-ads-write-lint`/`amazon-leak-guard`）+ D0-1 凭证缺失。
- AGE CI：**暂不作 required check**（`ci.yml` 仅 guard-rail + best-effort；重测试在 post-merge；曾因计费/runner `steps:[]` 失败）。合并门 = **PR 人审 + 本地验证记录**，等 CI 连续绿再加 required。
- liye_os：iconexpert 首战不碰；其 branch protection 由 liyecom owner 单独开（见 [[TEAM_DEV_MODEL]] §4/§7）。

## 4. 权限发放

- org 邀请 iconexpert → AGE **Write（feature 分支）**；初期不动既有 CODEOWNERS。
- 不发任何生产凭证（D0-1）。进入 D1/sandbox 或只读 API 时，才按 [[TEAM_DEV_MODEL]] §2 发 sandbox 凭证，且经安全信道、可撤权。

## 5. 配套 PR 路线（本文件 = PR-0；契约先落，工具后补）

| PR | 交付 | 目的 |
|---|---|---|
| **PR-0** | 本文件 + [[TEAM_DEV_MODEL]] | 冻结 D0 边界契约 |
| PR-1 | AGE 准确 `.env.local.example.dev` | 现有 `.env.example` 失真（Docker 时代变量名）；进入 D1 前的前置（变量名取自 `config/store_pulse/*_instance.yaml` + `src/integrations/amazon_{spapi,ads}_credentials.py`） |
| PR-2 | `dev_doctor.sh` | 强制校验：repo 内无 `.env.local`；shell 无 `SPAPI_*/ADS_*/XMEDEN_*` 等生产变量；`AGE_WRITE_ENABLED` 未设；hooks 已装；dry-run/test 可跑 |
| PR-3 | `liye_os/bin/install-hooks.sh` | liye_os 当前缺 installer（靠手敲 `git config core.hooksPath .claude/.githooks`），补上对齐 AGE |
| PR-4 | `dev-dotfiles` 私有仓 + `bootstrap.sh` | 装可共享配置模板（去密钥）、自动设两仓 hooksPath、提示登录/填密钥 |

## 6. 撤权（offboarding 预案）

30 分钟内可撤：GitHub org 权限 + 任何分发的 sandbox token + （若曾给）Studio 独立账号。

---

承接审查：本文件可直接交 Codex 跑 BLOCKER/WARNING/INFO，重点核：secret 泄漏面、Studio 越权、CI required 误阻塞、pre-commit 误当边界、dotfiles 同步身份态、D0 五条边界是否齐全可执行。
