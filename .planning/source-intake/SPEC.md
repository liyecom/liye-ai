# source-intake SPEC v1.0 — 受治理的 URL→产物轨道（github-scout × 官方 skill-creator 接缝）

**Status**: **v1.0 DRAFT**（operator 有条件通过整轨 2026-06-27：PR1 退役已合并 `432c198`；**本 SPEC = PR2，待 operator Accept**；PR3 impl / PR4 integration 只在本 SPEC 合并后启动）
**Date**: 2026-06-27（接 skill-forge 退役 PR1 #182；双评 [我 + Codex] 收敛 + 代码核验后成稿）
**输入基线**: liye_os main HEAD `432c198`（#182 skill-forge retire 已合并）
**上游权威**:
- `tools/github-scout/`（scout.py / declaration.yaml / license_policy.yaml SSOT）= 本轨上游探针，**不改一字节**
- `docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml`（license tier→ceiling→recommendation 的唯一机读 SSOT，本轨复用、不复制）
- `Skills/00_Core_Utilities/meta/skill-creator/`（官方 skill-creator = build 后端）+ 官方 `quick_validate.py`（allowed-keys 权威）
- `Skills/00_Core_Utilities/development-tools/mcp-builder/`（mcp-draft 的既存 delegate，非本轨新建）
- `_meta/skill-factory/retired-skills/skill-forge.yaml`（被替代的独门能力 provenance）
- BGHS Component Declaration form（`tools/github-scout/declaration.yaml` 为 portfolio 首个先例）

**证据权威序**: **Invariant/Interface 行为 > grep 实证 > 符号名 > 行号（行号仅当前 checkout 指针，承重锚用符号/机制）**

**核验接地**（本 SPEC 全部设计决策的事实基线，均在 main@`432c198` 实测）:
- scout 报告 candidate **不含 commit_sha**（`scout.py:304-311` metadata 仅 `repo/stars/pushed_at/description/url`）→ revision-pin 的 commit 必须由 source-intake 在 PLAN 阶段经 GitHub API 解析。
- scout `strong_copyleft` ceiling 已是 `metadata_license`（`license_policy.yaml:85`），obligations `[copyleft-veto, clean-room-reimplement-from-public-docs-only]`（:89）→ scout 本就不抓 GPL repo 的 readme/tree；本轨 correction #3 是其**自然延伸**（source-intake 也不得抓 GPL 源码 tarball）。
- 官方 `quick_validate.py:42-44` allowed-keys = `{name, description, license, allowed-tools, metadata, compatibility}` 且**明示「excluding nested keys under metadata」** → `metadata.sfc.*` provenance 合法、不触顶层键检查。
- `sfc_ci_gate.mjs:4,17` 只扫 **repo 内** SKILL.md、要求 8 顶层键、CI `--mode warn` 永不失败（:68-70）→ 装在 repo 外的 official-class 产物**永不被它扫到**；零改 gate（correction #4）。
- `Skills/00_Core_Utilities/development-tools/mcp-builder/SKILL.md` 存在 → mcp-draft delegate 现成。

---

## Goal

把 skill-forge 退役后**唯一值得保留的独门能力**——「从外部 GitHub repo / 文档 / llms.txt 的 URL ingest 源材料」——重新实现为 liye_os 受治理的 Layer-0 工具 `tools/source-intake/`，把 operator 设想的「从 URL 一键造 skill」落成一条**诚实形态的受控轨道**：

> **github-scout（发现，只读）→ 人选候选 + 声明意图（语义闸）→ source-intake（pin/license/acquire/represent，机器+沙箱）→ 官方 skill-creator / mcp-builder（build）→ 人审 promote（仪式）。**

**一句话**：保留独门 ingest 能力，但用三道正交闸 + 三类产物把「一键」改写为「人把关、可审计、终点由人拥有」的半自动轨；scout 不被污染，sfc_ci_gate 不被改动，第三方源码永不 vendor 进 repo。

**为什么「一键」字面必须死**（核心前置，非例行段落）：
自动 `scout → fetch → build` 在单一 agent session 内串起，正中 **lethal trifecta / OWASP LLM01**：①untrusted external content（任意 GitHub repo 的 README/源码可含 prompt-injection）+ ②private data（本机 repo 上下文）+ ③exfiltration/mutation capability（写文件、装 skill、改能力面）。且自动 scout→fetch 直接违反 github-scout 宪法 **I1**「zero external mutating side-effect: no fork/clone/vendor/PR」（`tools/github-scout/declaration.yaml:21`）与其 `explicit_non_goals`「candidates it surfaces are never auto-imported」（:51）。**license-tier ≠ trust-tier**：一个 MIT repo 完全合法却仍可在 README/代码注释里携带注入载荷。故「一键」诚实化为「一轨三闸」。

**非目标**（守 scope + 上游宪法）:
- **不改 github-scout 任何文件**（scout.py / declaration.yaml / license_policy.yaml）。本轨是 scout 的**下游消费者**，复用其 license SSOT，不 fork、不分叉其 license 表。
- **不改 `sfc_ci_gate.mjs` 一行**（correction #4：two-class packaging 已绕开，见 §4）。
- **不把第三方源码 vendor 进 liye_os**（照 PR1 纪律：repo 内只留小 manifest，源材料归档/暂存于 repo 外）。
- **不做真正的「一键」自动流水线**（无人值守 scout→build）。
- **不在本轨复活 fork/clone-as-dependency**（守 Fork 纪律 + scout I1）。
- **PR2 不创建 `tools/source-intake/`**（本 SPEC 仅设计；文件由 PR3 materialize，见 §8）。
- mcp-draft **不纳入 MVP**（PR4 full-vision；MVP = reference-pack + skill-draft）。

---

## 治理定位（⚠ 核心前置）

本轨是 scout「发现」与 skill-creator「建造」之间**此前不存在的受治理接缝**。scout 刻意止于「needs-human-review / skip」并把 reference-only/reimplement 留作 `allowed_recommendations[]` 的**人类仪式菜单**（`scout.py:286-299` + `license_policy.yaml:52/74/86`）——它**故意不**自动 acquire。skill-forge 旧能力恰恰跨越了这条线（URL→直接造）。本轨的治理本质 = **把这条被 scout 刻意留白的跨越，重新装进闸门**，而非取消留白。

三道正交闸（缺一不可、互不替代）:
1. **license 闸（机器）** — 复用 `license_policy.yaml` SSOT，在**pinned commit** 上 fail-closed（§3 S2）。
2. **语义/ADR 闸（人）** — 人声明 behavior-fit + 场景；reimplement/vendor 走 harvest-ADR 仪式（§2 request）。
3. **trust 沙箱闸（机器+人）** — 对**已获取的源材料**做注入/lethal-trifecta 审计，**无论 license tier 多宽松**（§3 S5）。

⇒ 本轨不是「便利封装」，是一次**给 scout↔build 接缝补装治理**的 scope 扩张，须 operator Accept（本 PR2）后方可 impl。

---

## 已裁默认（operator 2026-06-27 拍板；本 SPEC 据此，不再设开放 fork）

| # | 决策点 | 已裁默认 | 依据 |
|---|--------|----------|------|
| D1 | 默认产物 | **reference-pack**（只读卫星） | 最小能力面；对 scout 默认 `needs-human-review` 的诚实承接 |
| D2 | skill-draft 门槛 | 人选 **reimplement** + **≥3 个真实场景** | 避免「能造就造」；skill-draft = reimplement 的产物，非 vendor 上游 |
| D3 | 工具落点 | `tools/source-intake/`（Layer-0 Hands，带 declaration.yaml） | 与 github-scout 同层同形 |
| D4 | 认证 | **NO-SCOPE / read-only token only，禁 ambient gh token** | 复用 scout I2（`declaration.yaml:22`）token 纪律 |
| D5 | sfc_ci_gate | **零改动**（two-class + metadata.sfc） | `quick_validate.py:42-44` + `sfc_ci_gate.mjs:4` 实证 |
| D6 | acquisition | **GitHub pinned tarball 优先于 git clone**；repomix 仅可选压缩 | 避 git protocol 注入/credential helper/submodule/LFS/history |
| D7 | 旧脚本 | **clean rewrite，不 port**；skill-forge clone 归档 repo 外作参考 | trust-critical 路径全要替换 = 本质重写 |
| D8 | mcp-draft | **PR4 full-vision，不纳入 MVP**；delegate 既存 mcp-builder | MVP 收敛在 reference-pack + skill-draft |

---

## §1 — 七阶状态机（S0–S6）

> 状态机是本轨的承重骨架：每个 stage 有**单一职责 + 显式产物 + fail-closed 出口**；跨 stage 无静默自动化（S0→S1 与 S5→S6 之间各有一道**人类闸**，机器不得自越）。

```
            ┌─────────────── 人类闸 #2（语义/ADR）
            │
[github-scout report]        ┌──── 机器 ────┬──── 机器 ────┬──── 机器 ────┐   ┌─ 人类闸 #3（trust+promote）
       │                     │              │              │              │   │
       ▼                     ▼              ▼              ▼              ▼   ▼
  S0 INTAKE_REQUEST  →  S1 PIN/RESOLVE → S2 LICENSE_GATE → S3 ACQUIRE → S4 REPRESENT → S5 STAGE+AUDIT → S6 PROMOTE
  (人写 request.json)    (解析 commit)   (pinned 上复验)  (pinned tarball) (建产物草案)  (repo外暂存+审计)  (人审后落地)
                              │              │
                       fail→ skip       strong_copyleft→硬分支(仅 public-docs reimplement)
                                         unknown→skip(终止)
```

### S0 — INTAKE_REQUEST（人写，人类闸 #2）
人据一份 github-scout 报告**亲自**编写 `source_intake_request.json`（schema 见 §2.1）：引用 scout 报告 + 选定 candidate（按 `repo`+`url`）、声明意图与场景、声明目标产物类。**机器不得从 scout 报告自动生成 request**（守 scout I1/non-goal）。这是语义 behavior-fit 的人类断言点。

### S1 — PIN / RESOLVE（机器，PLAN 阶段）
- 经 GitHub API 解析 candidate 默认分支 **HEAD commit SHA**（scout 不产此值，见接地）。
- 产出 `source_manifest.json`（schema 见 §2.2）的 `upstream.pinned_commit`。
- **认证守 D4**：仅接受 NO-SCOPE/read-only token，存在 ambient gh token（带任何 classic scope）→ fail-closed（复用 scout `assert_readonly_or_die` 同语义，`scout.py:337` + `declaration.yaml:22`）。

### S2 — LICENSE_GATE（机器；⚠ correction #1 TOCTOU）
- **先锁 commit（S1 已锁）→ 再在该 pinned commit 上复验 license**，**不信 scout 当时看到的 floating 默认分支 tier**。复用 `license_policy.yaml` SSOT 做 tier 解析（不 hardcode、不复制该表）。
- 出口（fail-closed）：
  - `permissive` / `permissive_with_obligations` / `weak_copyleft` → `acquisition_allowed=true`（obligations 记入 manifest；weak_copyleft 带 `file-or-link-level-isolation-required`）。
  - `strong_copyleft` → **硬分支（correction #3）**：`acquisition_allowed=false`，**不抓 tarball、不抓 README、不抓 tree**；唯一前进路 = 人选 reimplement 后走**独立的 public-docs intake**（输入是文档 URL，**永不是 repo 源码**），对齐 `license_policy.yaml:89` obligations `[copyleft-veto, clean-room-reimplement-from-public-docs-only]`。
  - `unknown`（no_license / fetch_failed / 未识别 SPDX）→ `skip`，**终止**（`license_policy.yaml:95-104` 同纪律）。
- ⚠ **TOCTOU 关键**：若 pinned-commit 复验结果与 scout advisory tier **不一致**（如 scout 看到 permissive、HEAD 已换 GPL LICENSE），**以 pinned-commit 复验为权威**；降级到 strong_copyleft/unknown 即按上面 fail-closed，哪怕 scout 当时说 permissive。

### S3 — ACQUIRE（机器；correction D6）
- **仅当 `acquisition_allowed=true`**。方式 = **GitHub pinned tarball** `https://github.com/{owner}/{repo}/archive/{pinned_commit}.tar.gz`（避 git protocol 注入 `ext::`/`fd::`/`file://`、credential helper、submodule、LFS、history 膨胀）。**不用 git clone**。
- 下载后校验 tarball 内容 `tarball_sha256` 并记入 manifest；**重下载 hash 不一致 → fail-closed**。
- 落入 **repo 外 quarantine/staging 目录**，全程以**不可信内容**对待（沙箱）。
- repomix `--compress` 是**可选** representation 压缩（S4），**不是抓取方式**。

### S4 — REPRESENT / EXTRACT（机器）
据 request 的 `requested_product` 从已获取源材料构建**产物草案**（三产物边界见 §5）:
- reference-pack：只读蒸馏（摘要 / API 面 / 引用回 pinned_commit），**无可执行第三方代码、无 vendor 源码进 repo**。
- skill-draft：**仅当** product=skill-draft 且 §5 门槛满足，经**官方 skill-creator 语义**产出 skill **草案**（reimplement 产物，受 reference-pack 启发，**非 vendor 上游码**）。
- mcp-draft（非 MVP）：API 形态 repo → **delegate 既存 `Skills/00_Core_Utilities/development-tools/mcp-builder`**。

### S5 — STAGE + TRUST_AUDIT（机器+人，人类闸 #3 前置；correction #2 + trust 闸）
- **correction #2**：official-class 产物落 **staging（repo 外，如 `~/.claude/skills-staging/`）**，**绝不 active install**。
- **trust 沙箱闸**：对已获取源材料 + 生成草案做注入 / lethal-trifecta surface / secret-scan 审计，**无论 license tier 多宽松**（license≠trust）。verdict ∈ `{pass, flagged, blocked}` 记入 manifest。
- `blocked`/`flagged` → 阻断 promote（哪怕 permissive license）。

### S6 — PROMOTE（人类仪式）
人审 staged 产物 + trust 审计后决定落地。工具**永不自动 promote**（镜像 scout「needs-human-review」+ harvest-ADR）:
- reference-pack → 可经 **PR** 受治理引入 repo（liye-sfc-class，扛 8 顶层键，见 §4），或仅留作 doc。
- skill-draft → 人决定 active install（repo 外）after review。
- provenance 写入 `metadata.sfc`（two-class，§4）：upstream url + pinned_commit + license tier + scout 报告 ref + trust 审计 verdict。

---

## §2 — 新 schema（PR3 materialize；本节为契约设计）

> liye_os **无现成 Reference-Declaration 机读 schema**（只有 SYSTEMS.md Fork 纪律概念 + ADR `artifact_role`）。下列两个为 NEW schema，对齐 github-scout report 字段（同 `repo`/`url`、镜像 license tier/recommendation）+ BGHS Component Declaration form。

### §2.1 `source_intake_request.json`（人写的入场票）
```jsonc
{
  "schema": "liye-os/source-intake-request@1",
  "created_at_utc": "2026-06-27T12:00:00Z",
  "requested_by": "human-operator | agent-id",
  "intent": "free-text 需求/想法（WHY）",
  "scenarios": ["≥1；skill-draft 须 ≥3 个真实场景"],
  "source": {
    "from_scout_report": "path-or-sha256 of the github-scout report that surfaced this",
    "candidate_repo": "owner/name (== scout candidates[].metadata.repo)",
    "candidate_url": "https://github.com/owner/name (== scout metadata.url)",
    "scout_recommendation": "needs-human-review | reference-only | reimplement (镜像自 scout，供审计)",
    "scout_license_tier_advisory": "scout 当时所见 tier（仅 advisory；S2 在 pinned commit 复验为准）"
  },
  "requested_product": "reference-pack | skill-draft | mcp-draft",
  "human_attestations": {
    "semantic_fit_reviewed": true,        // 人类闸 #2：人断言 behavior-fit
    "harvest_adr_ref": null               // reimplement/vendor 仪式触发时必填
  }
}
```

### §2.2 `source_manifest.json`（工具产的 pinned + 审计记录）
```jsonc
{
  "schema": "liye-os/source-manifest@1",
  "generated_at_utc": "2026-06-27T12:00:05Z",
  "request_ref": "sha256(source_intake_request.json)",
  "upstream": {
    "repo": "owner/name",
    "url": "https://github.com/owner/name",
    "pinned_commit": "<40-hex>",                 // S1 解析（scout 无此值）
    "pinned_ref_kind": "default-branch-head-at-pin-time",
    "resolved_at_utc": "..."
  },
  "license": {                                   // ⚠ S2：在 pinned_commit 上复验（correction #1）
    "spdx": "...", "tier": "permissive|permissive_with_obligations|weak_copyleft|strong_copyleft|unknown",
    "confidence": "ok|no_license|fetch_failed",
    "verified_against_commit": "<== pinned_commit>",
    "scout_tier_advisory": "...",                // 留痕；与本值不一致即 TOCTOU 命中
    "obligations": ["...from license_policy.yaml..."],
    "policy_version": "1.0.0"
  },
  "gate_decision": {
    "license_gate": "proceed-acquire | reimplement-only-public-docs | skip",
    "acquisition_allowed": true,
    "rationale": "..."
  },
  "acquisition": {                               // 仅 acquisition_allowed 时填
    "method": "github-pinned-tarball",
    "url": "https://github.com/owner/name/archive/<commit>.tar.gz",
    "tarball_sha256": "...",
    "staged_path": "<repo 外 quarantine 目录>",
    "representation": "raw | repomix-compressed"
  },
  "trust_audit": {                               // 人类闸 #3
    "verdict": "pass | flagged | blocked",
    "checks": ["prompt-injection", "lethal-trifecta-surface", "secret-scan"],
    "notes": "license-tier != trust-tier；无论 permissive 与否一律审计"
  },
  "product": {
    "class": "reference-pack | skill-draft | mcp-draft",
    "packaging": "liye-sfc-class | official-class",
    "staged_only": true,                         // correction #2：永不自动 active-install
    "provenance_block": "metadata.sfc"
  }
}
```

### §2.3 `tools/source-intake/declaration.yaml`（BGHS Component Declaration，对齐 github-scout）
```yaml
artifact_scope: component
component_name: source-intake
layer: 0
primary_concern: Hands
secondary_concern: Session            # 产 advisory manifest/traces
model_contingent_items:
  - "product-class 建议（reference-pack vs skill-draft）的措辞"
  - "representation 压缩取舍（raw vs repomix）"
model_independent_invariants:
  - "I1 无自动跨越：永不从 scout 报告自动发起 intake；产物只落 staging，repo 内只写小 manifest（+人 promote 的 reference-pack），第三方源码绝不 vendor 进 repo"
  - "I2 read-only 获取：仅 NO-SCOPE/read-only token；ambient gh token 带任何 classic scope => fail-closed；acquisition 仅 HTTPS pinned tarball，禁 git protocol/credential helper/submodule/LFS"
  - "I3 pin-first-then-verify：S1 先锁 commit，S2 在该 commit 上复验 license（TOCTOU），再 license 闸定 acquisition；strong_copyleft/unknown 不抓任何源码"
  - "I4 license-tier != trust-tier：已获取内容一律过 trust 沙箱审计，无论 license 多宽松（lethal trifecta）"
  - "I5 two-class packaging：official-class 装 repo 外、过 quick_validate、provenance 走 metadata.sfc；liye-sfc-class 才扛 8 顶层 SFC 键；sfc_ci_gate 零改动"
credential_path: cred://liye-os/source-intake-readonly
explicit_non_goals:
  - "不是『一键』：无人值守 scout→fetch→build 不存在"
  - "不 fork/clone-as-dependency；不 vendor 第三方源码进 liye_os"
  - "不抓 strong_copyleft 源码（仅 public-docs reimplement 路径）"
  - "不改 github-scout / license_policy.yaml / sfc_ci_gate.mjs"
  - "不自动 active-install / 不自动 promote（人类仪式专属）"
  - "不是运行时依赖"
future_split_direction: >
  若未来需 agent 程序化发起 intake，把 dispatch 面提升为 src/skill/ 下的 Executable Skill，
  credential_bindings 接真 EnvCredentialBroker，并补 transitive license scan（对齐 scout Phase 1）。
```

---

## §3 — 负向测试清单（fail-closed 验收；PR3 须逐条覆盖为测试）

> 每条都是「**必须拒**」。绿 = 拒绝路径触发且留痕；红 = 任一条被放行。

| # | 注入场景 | 期望（fail-closed） | 锚 |
|---|----------|---------------------|----|
| N1 | strong_copyleft（GPL/AGPL）repo | 拒 acquire：无 tarball/README/tree；仅给 public-docs reimplement 路径 | correction #3 + `license_policy.yaml:81-93` |
| N2 | unknown / no_license / fetch_failed | skip，终止 | `license_policy.yaml:95-104` |
| N3 | pinned-commit 复验 tier 与 scout advisory 不一致（TOCTOU） | 以 pinned-commit 为权威；降级即 fail-closed（哪怕 scout 说 permissive） | correction #1 |
| N4 | 环境存在 ambient gh token（带任何 classic scope） | 拒；仅 NO-SCOPE/read-only token 放行 | D4 + scout I2 `declaration.yaml:22` |
| N5 | candidate_url 含 git-protocol 注入（`ext::`/`fd::`/`file://`） | 拒；仅 `https://github.com/...` tarball | D6 |
| N6 | requested_product=skill-draft 但场景 <3 或本应 reference-pack | 降级/拒（门槛闸） | D2 |
| N7 | 无 human_attestation 的自动 promote 尝试 | 阻断；staged-only | correction #2 + I1 |
| N8 | permissive-license repo 但 trust 审计 flagged/blocked | 仍阻断 promote（license≠trust） | I4 |
| N9 | 尝试把已获取源码 vendor 进 repo | 阻断；repo 内仅小 manifest + reference-pack 蒸馏 | PR1 纪律 + I1 |
| N10 | 重下载 tarball_sha256 与 manifest 不一致 | fail-closed | S3 |

---

## §4 — Two-class packaging（correction #4；sfc_ci_gate 零改动）

**实证矛盾的化解**：若一个只带 `{name, description, metadata}` 的官方风格 skill 落在 **repo 内**，`sfc_ci_gate.mjs` 会扫到它并报缺 8 键。但：
1. `sfc_ci_gate.mjs:68-70` 只扫 `--root .`（repo 内）；CI `--mode warn` 永不失败（:4,103）。
2. official-class 产物**落 repo 外 staging / active install（`~/.claude` | `~/.codex/skills`）** → sfc_ci_gate **永不扫到**。
3. provenance 骑在 `metadata.sfc.*` → 过官方 `quick_validate.py:42-44`（allowed `metadata` + 明示「excluding nested keys under metadata」）。

⇒ **两类包**:

| 类 | 落点 | 校验 | 携带 | 触 sfc_ci_gate？ |
|----|------|------|------|------------------|
| **official-class** | repo 外（staging→active install） | 仅 `quick_validate.py` | `{name, description, license?, allowed-tools?, metadata.sfc{provenance}}` | **否**（repo 外） |
| **liye-sfc-class** | repo 内（人 promote 的 reference-pack） | 8 顶层 SFC 键（已天然满足） | 8 键 + 正文 | 是（已 conform，warn-only） |

`metadata.sfc` provenance 块（official-class）建议字段：
```yaml
metadata:
  sfc:
    provenance: "source-intake"
    upstream_url: "https://github.com/owner/name"
    pinned_commit: "<40-hex>"
    license_tier: "permissive"
    scout_report_ref: "<sha256>"
    trust_audit_verdict: "pass"
    manifest_ref: "<sha256(source_manifest.json)>"
```
**`sfc_ci_gate.mjs` 改动 = 0 行。**

---

## §5 — 三产物边界

| 产物 | 触发 | 是什么 | 不是什么 | 落点 |
|------|------|--------|----------|------|
| **reference-pack**（默认 D1） | 任意 acquisition_allowed candidate | 只读蒸馏：摘要/API 面/引用回 pinned_commit | 无可执行第三方码；不 vendor 源码 | 人 promote→repo（liye-sfc-class）或留 doc |
| **skill-draft** | 人选 reimplement + ≥3 真实场景（D2） | 经官方 skill-creator 语义产的 **reimplement** skill 草案 | **非** vendor 上游码；非自动安装 | staging（official-class）→人审 active install |
| **mcp-draft**（非 MVP，PR4） | API 形态 repo | **delegate 既存 mcp-builder** | 本轨不自建 MCP 生成器 | full-vision |

---

## §6 — Hard Gates（执行约束，PR3/PR4 承）

1. **HG1 — github-scout 0-diff**：scout.py / declaration.yaml / license_policy.yaml 字节不变（本轨只读消费其 SSOT）。
2. **HG2 — sfc_ci_gate.mjs 0-diff**（correction #4；§4 实证零改）。
3. **HG3 — license 闸在 pinned commit 上复验**（correction #1 TOCTOU）：S2 `verified_against_commit == upstream.pinned_commit`，否则 PR 不合法。
4. **HG4 — 无源码 vendor 进 repo**：repo 内新增第三方源码文件 = 红（grep 实证；只许 manifest + reference-pack 蒸馏）。
5. **HG5 — strong_copyleft/unknown 不抓源**：N1/N2 负向测试绿（fail-closed）。
6. **HG6 — staged-only**：official-class 产物无自动 active-install 路径（N7 绿）。

---

## Definition of Done

**PR2（本 SPEC）DoD**:
- [ ] operator Accept 本 SPEC（含七阶状态机 + 2 schema + declaration.yaml + 负向清单 + 三产物边界 + 4 corrections）。
- [ ] 4 corrections 在 SPEC 内可逐条核对（S2 TOCTOU / staging-not-active / strong_copyleft 硬分支 / two-class 零改 gate）。
- [ ] 本 SPEC **不创建** `tools/source-intake/`（grep 实证 PR2 diff 仅 `.planning/source-intake/SPEC.md`）。

**PR3（impl）DoD（合并 PR2 后启动）**:
- [ ] materialize `tools/source-intake/{cli, declaration.yaml}` + 2 JSON Schema 文件（§2）。
- [ ] §3 负向清单 N1–N10 全部为 fail-closed 测试且绿。
- [ ] HG1–HG6 全过；scout / license_policy / sfc_ci_gate 三文件 0-diff 实证。
- [ ] clean rewrite（D7，不 port 旧 skill-forge 脚本）。

**PR4（integration，非 MVP）**:
- [ ] mcp-draft delegate mcp-builder 接线；full-vision 场景串联。

---

## 诚实披露

- **「一键」是营销话术，本轨是三闸半自动**。任何把它描述为「无人值守 URL→skill」的措辞都是谎标——状态机 S0→S1、S5→S6 之间各有不可逾越的人类闸。
- **license≠trust 是硬纪律不是装饰**：N8 专门防「permissive 就放行」的假绿。
- **本轨不解决 scout 的 transitive license 缺口**（scout `explicit_non_goals`「does not scan transitive/dependency licenses」`declaration.yaml:53`）——pinned commit 的 top-level license 复验之外，依赖树 license 仍是人审范畴，留 future_split。
- **skill-draft = reimplement，不是 vendor**：哪怕 permissive，本轨默认不把上游源码塞进产物；reference-pack 蒸馏 + reimplement 是默认姿态，守 Fork 纪律。

---

## Anchor

- 上游 scout：`tools/github-scout/{scout.py,declaration.yaml}` + `docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml`（SSOT，本轨复用不改）
- build 后端：`Skills/00_Core_Utilities/meta/skill-creator/` + 官方 `quick_validate.py`（allowed-keys 权威）
- mcp delegate：`Skills/00_Core_Utilities/development-tools/mcp-builder/SKILL.md`
- 被替代能力 provenance：`_meta/skill-factory/retired-skills/skill-forge.yaml`（PR1 #182 `432c198`）
- 体例范本：`.planning/agentic-evolution/EVO-D-drift-monitor-physical-split/SPEC.md`
- 记忆锚：memory `project_source_intake_track`
- **下一步**：operator Accept 本 SPEC（PR2）→ PR3 impl（materialize + N1–N10 测试 + HG1–6）→ PR4 integration（mcp-draft，非 MVP）
