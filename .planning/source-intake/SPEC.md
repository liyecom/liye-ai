# source-intake SPEC v1.2 — 受治理的 URL→产物轨道（github-scout × 官方 skill-creator 接缝）

**Status**: **v1.2**（v1.0 双评 → v1.1 Codex 2 blocker amend → **PR2 #183 MERGED** → **PR3 impl #185 MERGED** `3b5165c` → v1.2 = PR4 未来执行锚纠偏）。MVP（reference-pack + skill-draft）已实现；**PR4 仍 parked**，下一步优先真实 reference-pack pilot。
**Date**: 2026-06-27（v1.0 双评成稿 → v1.1 Codex 复审 amend → v1.2 PR4 锚纠偏）
**v1.1 amend（Codex #183 复审 2 blocker，均已落地）**:
- **B1 quick_validate 事实锚更正**：原写「6 键含 `compatibility` + 明示 nested 注释」错；权威 Codex 系统版 `.codex/skills/.system/skill-creator/scripts/quick_validate.py:40` 实为 **5 键无注释**。承重机制改锚为「键检查只比顶层、不下钻 metadata」（§核验接地 + §4，机制成立不靠注释；披露磁盘 5/6 键版本漂移）。
- **B2 request schema 解耦 scout-emit vs 人类选择**：原 `scout_recommendation` 误把 reference-only/reimplement 当 scout emit；实为 scout 默认 leaf + `allowed_recommendations[]` 菜单。§2.1 拆为 `source`（原样镜像 scout emit）+ `human_decision.chosen_leaf`（人从菜单亲选），并写清 `requested_product × chosen_leaf` 条件 + 新增 N11（chosen_leaf 须 ∈ scout allowed）。
**v1.2 amend（PR4 未来执行锚纠偏；范围极窄：仅本 §上游权威 + §核验接地 + Goal rail + D8 + S4 + §2.1 mcp 行 + §5 + PR4 DoD + Anchor；不碰 #185 代码、不碰 `Skills/.../mcp-builder`、不展开第三方 Skills 总清理）**:
- **错误锚**：v1.1 把 `Skills/00_Core_Utilities/development-tools/mcp-builder/` 当作 mcp-draft 的「既存 delegate」。实测该路径是一份**被 vendor 进 repo 的第三方社区镜像 skill**（`source: awesome-claude-skills` / `github.com/ComposioHQ/awesome-claude-skills`，Apache-2.0，最近改动 2026-01-16，5 个月未更新）；同源的 `Skills/.../meta/skill-creator` 亦然。让「禁 vendor / official-class 落 repo 外」的本轨去 delegate 一个 repo 内 vendored 社区 skill = 自相矛盾的未来地雷。
- **纠偏（PR4 路线，本 SPEC 仅改锚不启动 PR4）**：**A（新默认）** 取消 mcp-builder 特殊 delegate——mcp-draft 走与 skill-draft **同一条 clean-room/reimplement 轨**（差别只是产物类型 = MCP server 草案）。**B（降级为未来可选）** 仅当存在 **repo 外、来源明确、当前有效、可验证的官方 MCP builder skill/tool** 时，方可作为外部 official-class backend 接入（本机 `~/.codex/skills`、`~/.claude/skills` 现均无 mcp-builder，故不能写成默认）。**C（明确禁止）** 不得 delegate 到 in-repo `Skills/00_Core_Utilities/development-tools/mcp-builder/`。
- **设计教训**：schema enum 可保留 future value（mcp-draft 仍在 §2.1/§2.2 枚举），但 **runtime 必须对未实现的 value 显式 fail-closed**——已由 #185 的 mcp-draft S0 fail-closed 修复证明（schema 含某值 ≠ runtime 该执行它）。
**输入基线**: liye_os main HEAD `432c198`（#182 skill-forge retire 已合并）
**上游权威**:
- `tools/github-scout/`（scout.py / declaration.yaml / license_policy.yaml SSOT）= 本轨上游探针，**不改一字节**
- `docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml`（license tier→ceiling→recommendation 的唯一机读 SSOT，本轨复用、不复制）
- **权威 skill-creator = repo 外** `~/.codex/skills/.system/skill-creator/`（含 `scripts/quick_validate.py`，allowed-keys 权威，PR2 B1 事实锚即此份）。⚠ in-repo `Skills/00_Core_Utilities/meta/skill-creator/` 是一份 **legacy vendored / 社区镜像副本**（`source: awesome-claude-skills`，Apache-2.0，非权威）——本轨引用「官方 skill-creator 语义」指的是 repo 外这份，不是 in-repo vendored 副本。
- **无现成 mcp-builder delegate**（v1.2 纠偏）：in-repo `Skills/00_Core_Utilities/development-tools/mcp-builder/` 是 **legacy vendored 社区镜像 skill**（同 awesome-claude-skills，Apache-2.0，5 个月未更新），**禁** 作为本轨 delegate（Option C）；repo 外现无可验证的官方 mcp-builder。PR4 路线见 §v1.2 amend / D8。
- `_meta/skill-factory/retired-skills/skill-forge.yaml`（被替代的独门能力 provenance）
- BGHS Component Declaration form（`tools/github-scout/declaration.yaml` 为 portfolio 首个先例）

**证据权威序**: **Invariant/Interface 行为 > grep 实证 > 符号名 > 行号（行号仅当前 checkout 指针，承重锚用符号/机制）**

**核验接地**（本 SPEC 全部设计决策的事实基线，均在 main@`432c198` 实测）:
- scout 报告 candidate **不含 commit_sha**（`scout.py:304-311` metadata 仅 `repo/stars/pushed_at/description/url`）→ revision-pin 的 commit 必须由 source-intake 在 PLAN 阶段经 GitHub API 解析。
- scout `strong_copyleft` ceiling 已是 `metadata_license`（`license_policy.yaml:85`），obligations `[copyleft-veto, clean-room-reimplement-from-public-docs-only]`（:89）→ scout 本就不抓 GPL repo 的 readme/tree；本轨 correction #3 是其**自然延伸**（source-intake 也不得抓 GPL 源码 tarball）。
- 官方 `quick_validate.py` 顶层 allowed-keys（Codex 实际系统版 `.codex/skills/.system/skill-creator/scripts/quick_validate.py:40`）= `{name, description, license, allowed-tools, metadata}`（**5 键，无 `compatibility`、无「excluding nested keys under metadata」注释**）。⚠ 磁盘存在版本漂移：部分 `.claude` marketplace 副本为 6 键含 `compatibility`——本 SPEC 不依赖具体 allowed-set。**承重机制 = 键检查 `unexpected_keys = set(frontmatter.keys()) - allowed_properties`（`:42`）只枚举顶层键、从不下钻 `metadata`** → `metadata.sfc.*` 嵌套因此天然通过（与是否 5/6 键、是否有注释无关）。
- `sfc_ci_gate.mjs:4,17` 只扫 **repo 内** SKILL.md、要求 8 顶层键、CI `--mode warn` 永不失败（:68-70）→ 装在 repo 外的 official-class 产物**永不被它扫到**；零改 gate（correction #4）。
- ⚠ **v1.2 纠偏**：`Skills/00_Core_Utilities/development-tools/mcp-builder/SKILL.md` 虽存在，但它是 **repo 内 vendored 第三方社区镜像**（`source: awesome-claude-skills`，Apache-2.0，2026-01-16 后未更新），**不是**「现成的官方 delegate」。本机 `~/.codex/skills`、`~/.claude/skills` 均无 mcp-builder。故 mcp-draft **无现成可信 delegate**，PR4 必走 reimplement 轨或先引入 repo 外可验证官方 backend（D8）。

---

## Goal

把 skill-forge 退役后**唯一值得保留的独门能力**——「从外部 GitHub repo / 文档 / llms.txt 的 URL ingest 源材料」——重新实现为 liye_os 受治理的 Layer-0 工具 `tools/source-intake/`，把 operator 设想的「从 URL 一键造 skill」落成一条**诚实形态的受控轨道**：

> **github-scout（发现，只读，emit recommendation+allowed 菜单）→ 人选候选 + 从菜单亲选 leaf + 声明意图（语义闸）→ source-intake（pin/license/acquire/represent，机器+沙箱）→ 官方 skill-creator 语义（build；mcp-draft 见 D8，deferred）→ 人审 promote（仪式）。**

**一句话**：保留独门 ingest 能力，但用三道正交闸 + 三类产物把「一键」改写为「人把关、可审计、终点由人拥有」的半自动轨；scout 不被污染，sfc_ci_gate 不被改动，第三方源码永不 vendor 进 repo。

**为什么「一键」字面必须死**（核心前置，非例行段落）：
自动 `scout → fetch → build` 在单一 agent session 内串起，正中 **lethal trifecta / OWASP LLM01**：①untrusted external content（任意 GitHub repo 的 README/源码可含 prompt-injection）+ ②private data（本机 repo 上下文）+ ③exfiltration/mutation capability（写文件、装 skill、改能力面）。且自动 scout→fetch 直接违反 github-scout 宪法 **I1**「zero external mutating side-effect: no fork/clone/vendor/PR」（`tools/github-scout/declaration.yaml:21`）与其 `explicit_non_goals`「candidates it surfaces are never auto-imported」（:51）。**license-tier ≠ trust-tier**：一个 MIT repo 完全合法却仍可在 README/代码注释里携带注入载荷。故「一键」诚实化为「一轨三闸」。

**非目标**（守 scope + 上游宪法）:
- **不改 github-scout 任何文件**（scout.py / declaration.yaml / license_policy.yaml）。本轨是 scout 的**下游消费者**，复用其 license SSOT，不 fork、不分叉其 license 表。
- **不改 `sfc_ci_gate.mjs` 一行**（correction #4：two-class packaging 已绕开，见 §4）。
- **不把第三方源码 vendor 进 liye_os**（照 PR1 纪律：repo 内只留小 manifest，源材料归档/暂存于 repo 外）。
- **不做真正的「一键」自动流水线**（无人值守 scout→build）。
- **不在本轨复活 fork/clone-as-dependency**（守 Fork 纪律 + scout I1）。
- **PR2 不创建 `tools/source-intake/`**（本 SPEC 仅设计；文件由 PR3 materialize，见 Definition of Done）。
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
| D5 | sfc_ci_gate | **零改动**（two-class + metadata.sfc） | `quick_validate.py:40-42`（顶层键检查不下钻 metadata）+ `sfc_ci_gate.mjs:4`（repo-only）实证 |
| D6 | acquisition | **GitHub pinned tarball 优先于 git clone**；repomix 仅可选压缩 | 避 git protocol 注入/credential helper/submodule/LFS/history |
| D7 | 旧脚本 | **clean rewrite，不 port**；skill-forge clone 归档 repo 外作参考 | trust-critical 路径全要替换 = 本质重写 |
| D8 | mcp-draft | **PR4 full-vision，不纳入 MVP**。**A(默认)** 走与 skill-draft 同的 reimplement/skill-creator 轨（产物=MCP server 草案）；**B(未来可选)** 仅当有 repo 外、来源明确、可验证的官方 MCP backend 才接外部 official-class；**C(禁)** 不得 delegate in-repo vendored `Skills/.../mcp-builder` | v1.2 纠偏：旧「delegate 既存 mcp-builder」指向 repo 内 vendored 社区镜像，已撤 |

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
人据一份 github-scout 报告**亲自**编写 `source_intake_request.json`（schema 见 §2.1）：引用 scout 报告 + 选定 candidate（按 `repo`+`url`）、**原样镜像 scout emit 的 `recommendation` + `allowed_recommendations[]`（`source` 块）**、**再从该菜单亲选 `human_decision.chosen_leaf`（与 scout emit 解耦）**、声明意图与场景、声明目标产物类。**机器不得从 scout 报告自动生成 request、不得把人类选择伪装成 scout emit 字段**（守 scout I1/non-goal）。这是语义 behavior-fit 的人类断言点。`chosen_leaf` 必须 ∈ scout 该 candidate 的 `allowed_recommendations`（§2.1 约束）。

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
- mcp-draft（非 MVP，deferred）：API 形态 repo → PR4 路线 = **走 reimplement/skill-creator 轨产出 MCP server 草案（默认 A）**，或先引入 repo 外可验证官方 MCP backend（B）；**禁** delegate in-repo vendored `Skills/.../mcp-builder`（C）。本轨 runtime 对 mcp-draft 在 S0 fail-closed（见 #185）。

### S5 — STAGE + TRUST_AUDIT（机器+人，人类闸 #3 前置；correction #2 + trust 闸）
- **correction #2**：official-class 产物落 **staging（repo 外，如 `~/.claude/skills-staging/`）**，**绝不 active install**。
- **trust 沙箱闸**：对已获取源材料 + 生成草案做注入 / lethal-trifecta surface / secret-scan 审计，**无论 license tier 多宽松**（license≠trust）。verdict ∈ `{pass, flagged, blocked}` 记入 manifest。
- `blocked`/`flagged` → 阻断**自动** promote（哪怕 permissive license）；`flagged` 经 S6 人类仪式可被升级为 `pass`，`blocked` 须先 remediate（见下 taxonomy）。

#### S5 trust-audit taxonomy（v1；#188 裁决落定）
> **设计切口**：severity 是 **finding 类的属性**，verdict 是**派生**——不是「有 finding ⟹ blocked」的扁平 bit。这样良性 install 片段（README 的 `curl`、Makefile 的 `rm -rf`）不再被冒充成 prompt-injection，`flagged → 人在 S6 升 pass` 通道才真正可达。

| 类 | 是什么 | 成员 | 默认 severity |
|----|--------|------|----------------|
| **C1** prompt-injection (LLM01) | 劫持消费它的 LLM 的指令 | `ignore previous instructions` / `ignore all previous` / `disregard the above` / `disregard all prior` / `system prompt` / `you are now` / `exfiltrate` | **blocked** |
| **C2** secret-exposure | 真凭证**格式** | `AKIA…` / `ghp_…` / `xox[baprs]-…` / `-----BEGIN … PRIVATE KEY-----`（**不**加 placeholder allowlist） | **blocked** |
| **C3** archive-integrity | tarball 自身的结构红旗（非内容） | `__SUSPICIOUS_MEMBER_PATH__`（traversal/绝对路径）/ `__TARBALL_UNREADABLE__` | **blocked** |
| **C4** executable-instructions | docs/build 里**预期**的 shell/install 片段 | `curl http` / `wget http` / `base64 -d` / `rm -rf` | **info**（不 gate verdict） |
| **C4** supply-chain anti-pattern | 高风险供应链形态（C4 子类） | `curl … \| sh`（pipe-to-shell）/ `npx …@latest`（不锁版） | **flagged**（带 `risk=supply-chain-pattern`；**不** blocked） |
| **C5** web/markup | XSS 式标记 | `<script` / `data:text/html` | **flagged** |

**verdict 规则（写死，极简）：**
```
verdict = "blocked"  if any(finding.severity == "blocked")   # 仅 C1 / C2 / C3
        = "flagged"  otherwise                                # 含 repos 只命中 C4(info/flagged) / C5
machine_can_pass = False                                       # 机器永不 emit pass；只有 info 也仍是 flagged
```
manifest 的 `trust_audit` 逐条记录 `class` + `severity`（+ supply-chain 子类记 `risk`）+ 命中位置，外加 `verdict_rationale`（哪一类驱动了 verdict）。S6 人因此能看清每条命中及其 flagged/blocked 缘由。

**v1 scope 边界（明确不做）：** ❌ file-type 感知（Makefile/*.sh 里 C4=预期 vs 异常文件升级）→ **v2**；❌ 200-member cap 覆盖率字段（`audit_sampled_members`/`truncated`）→ **defer**，等第二个大 repo。v1 只按 **marker 身份**分桶——足以解除 KuudoAI 类误 block。
**invariant 不变：** I4（无论 license tier 一律审计）+ `machine_can_pass=False`（机器永不 grant pass）——本次只改 blocked↔flagged 切分，不动机器→pass 边界。

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
  "source": {                             // ⚠ scout 实际 emit 的值，原样镜像，不掺人类选择
    "from_scout_report": "path-or-sha256 of the github-scout report that surfaced this",
    "candidate_repo": "owner/name (== scout candidates[].metadata.repo)",
    "candidate_url": "https://github.com/owner/name (== scout metadata.url)",
    "scout_recommendation": "scout emit 的 default leaf（recommend() 的 recommendation 字段，通常 needs-human-review 或 skip）",
    "scout_allowed_recommendations": ["scout emit 的 allowed_recommendations[] 菜单，原样镜像"],
    "scout_license_tier_advisory": "scout 当时所见 tier（仅 advisory；S2 在 pinned commit 复验为准）"
  },
  "human_decision": {                     // ⚠ 人从 scout 的 allowed 菜单里**亲选**，与 scout emit 解耦
    "chosen_leaf": "reference-only | reimplement | needs-human-review | skip",
    "rationale": "人为何这样选（语义 behavior-fit 判断）"
  },
  "requested_product": "reference-pack | skill-draft | mcp-draft",
  "human_attestations": {
    "semantic_fit_reviewed": true,        // 人类闸 #2：人断言 behavior-fit
    "harvest_adr_ref": null               // reimplement/vendor 仪式触发时必填
  }
}
```

**`requested_product` × `human_decision.chosen_leaf` 条件关系（机器校验，PR3 强制）**：
- `requested_product=skill-draft` **要求** `chosen_leaf == reimplement` **且** `scenarios.length >= 3` **且** `human_attestations.harvest_adr_ref != null`；否则降级/拒（N6）。
- `requested_product=reference-pack`（默认）**要求** `chosen_leaf ∈ {reference-only, reimplement, needs-human-review}`（蒸馏不依赖最终复用裁决，但 `skip` 不可启动 intake）。
- `requested_product=mcp-draft`（非 MVP，deferred）：schema 保留为 future enum，但 **PR3 runtime 在 S0 fail-closed**（不执行；见 #185 + 设计教训）。PR4 路线见 D8（默认走 reimplement 轨，禁 in-repo vendored mcp-builder）。
- `chosen_leaf == skip` → 不应提交 request（人已自判不取）；若提交则 S2 之前即终止。
- ⚠ `chosen_leaf` 必须**∈ scout 该 candidate 的 `scout_allowed_recommendations`**（人不能选 scout 该 tier 不允许的 leaf，如对 strong_copyleft 选 reference-only）；越界 = 拒。

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
  "trust_audit": {                               // 人类闸 #3（v1 taxonomy，#188）
    "verdict": "pass | flagged | blocked",       // 机器只 emit flagged/blocked；人在 S6 升 flagged->pass
    "checks": ["prompt-injection", "secret-exposure", "archive-integrity", "executable-instructions", "web-markup"],
    "findings": [                                 // 逐条带 class + severity（+ supply-chain 子类 risk）
      { "class": "executable-instructions", "severity": "info", "marker": "curl http" },
      { "class": "executable-instructions", "severity": "flagged", "risk": "supply-chain-pattern", "pattern": "curl…|sh" },
      { "class": "web-markup", "severity": "flagged", "marker": "<script" }
    ],
    "verdict_rationale": "flagged: no blocking finding; machine never emits pass",
    "machine_can_pass": false,
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
| N6 | requested_product=skill-draft 但 `chosen_leaf != reimplement` / 场景 <3 / 无 harvest_adr_ref | 降级/拒（门槛闸） | D2 + §2.1 条件 |
| N11 | `human_decision.chosen_leaf` ∉ scout 该 candidate 的 `allowed_recommendations`（如对 strong_copyleft 选 reference-only） | 拒（人不能越 scout tier 菜单） | §2.1 约束 + `license_policy.yaml` allowed 表 |
| N7 | 无 human_attestation 的自动 promote 尝试 | 阻断；staged-only | correction #2 + I1 |
| N8 | permissive-license repo 但 trust 审计 flagged/blocked | 仍阻断**自动** promote（license≠trust）；机器永不 emit `pass`，唯 S6 人类仪式可将 `flagged` 升 `pass`（`blocked` 须先 remediate，见 S5 taxonomy） | I4 |
| N9 | 尝试把已获取源码 vendor 进 repo | 阻断；repo 内仅小 manifest + reference-pack 蒸馏 | PR1 纪律 + I1 |
| N10 | 重下载 tarball_sha256 与 manifest 不一致 | fail-closed | S3 |

---

## §4 — Two-class packaging（correction #4；sfc_ci_gate 零改动）

**实证矛盾的化解**：若一个只带 `{name, description, metadata}` 的官方风格 skill 落在 **repo 内**，`sfc_ci_gate.mjs` 会扫到它并报缺 8 键。但：
1. `sfc_ci_gate.mjs:68-70` 只扫 `--root .`（repo 内）；CI `--mode warn` 永不失败（:4,103）。
2. official-class 产物**落 repo 外 staging / active install（`~/.claude` | `~/.codex/skills`）** → sfc_ci_gate **永不扫到**。
3. provenance 骑在 `metadata.sfc.*` → 过官方 `quick_validate.py`（顶层 allowed 含 `metadata`；键检查 `set(frontmatter.keys()) - allowed_properties` 只比顶层、不递归 metadata，故嵌套 `metadata.sfc.*` 不被拒——承重是机制非注释，见 §核验接地的版本漂移披露）。

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
| **mcp-draft**（非 MVP，PR4，deferred） | API 形态 repo | **默认走 reimplement/skill-creator 轨产 MCP server 草案**（A）；或 repo 外可验证官方 MCP backend（B） | **非** delegate in-repo vendored `Skills/.../mcp-builder`（C 禁）；runtime S0 fail-closed | full-vision |

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
- [ ] §3 负向清单 N1–N11 全部为 fail-closed 测试且绿。
- [ ] HG1–HG6 全过；scout / license_policy / sfc_ci_gate 三文件 0-diff 实证。
- [ ] clean rewrite（D7，不 port 旧 skill-forge 脚本）。

**PR4（integration，非 MVP）**:
- [ ] mcp-draft deferred；PR4 必须**二选一**：(A) 经 source-intake/skill-creator reimplement 轨产 MCP server 草案，**或** (B) 引入一个**单独批准的、repo 外 official-class** MCP backend；**禁** delegate in-repo vendored `Skills/.../mcp-builder`（C）。先解除 runtime 的 S0 fail-closed 才允许执行 mcp-draft。full-vision 场景串联。

---

## 诚实披露

- **「一键」是营销话术，本轨是三闸半自动**。任何把它描述为「无人值守 URL→skill」的措辞都是谎标——状态机 S0→S1、S5→S6 之间各有不可逾越的人类闸。
- **license≠trust 是硬纪律不是装饰**：N8 专门防「permissive 就放行」的假绿。
- **本轨不解决 scout 的 transitive license 缺口**（scout `explicit_non_goals`「does not scan transitive/dependency licenses」`declaration.yaml:53`）——pinned commit 的 top-level license 复验之外，依赖树 license 仍是人审范畴，留 future_split。
- **skill-draft = reimplement，不是 vendor**：哪怕 permissive，本轨默认不把上游源码塞进产物；reference-pack 蒸馏 + reimplement 是默认姿态，守 Fork 纪律。
- **schema enum 含某 value ≠ runtime 该执行它**（v1.2 设计教训）：未实现/deferred 的产物类型即使保留在 schema 枚举里供 forward-compat，runtime 也**必须显式 fail-closed**，绝不能靠「还没接线」默认拦——否则会像 mcp-draft 那样悄悄打开执行面（#185 实遇并修）。
- **build backend 必须 repo 外 + 可验证**（v1.2 纠偏）：本轨「禁 vendor / official-class 落 repo 外」的纪律同样约束**自己依赖的 build backend**；不得 delegate 一个 repo 内 vendored 第三方社区镜像（in-repo `Skills/.../mcp-builder` / `meta/skill-creator` 即此类 legacy 物）。权威 skill-creator 在 repo 外 `~/.codex/skills/.system/skill-creator`。

---

## Anchor

- 上游 scout：`tools/github-scout/{scout.py,declaration.yaml}` + `docs/methodology/01_Research_Intelligence/github-scout/license_policy.yaml`（SSOT，本轨复用不改）
- build 后端（权威）：**repo 外** `~/.codex/skills/.system/skill-creator/`（含 `scripts/quick_validate.py`，allowed-keys 权威）。⚠ in-repo `Skills/00_Core_Utilities/meta/skill-creator/` = legacy vendored 社区镜像副本，非权威。
- mcp delegate：**无现成可信 delegate**（v1.2 纠偏）。in-repo `Skills/00_Core_Utilities/development-tools/mcp-builder/SKILL.md` 是 vendored 社区镜像，**禁用为 delegate**（C）；PR4 见 D8（默认 reimplement 轨 A，或 repo 外可验证官方 backend B）。
- 被替代能力 provenance：`_meta/skill-factory/retired-skills/skill-forge.yaml`（PR1 #182 `432c198`）
- 体例范本：`.planning/agentic-evolution/EVO-D-drift-monitor-physical-split/SPEC.md`
- 记忆锚：memory `project_source_intake_track`
- **进度**：PR2 #183 SPEC MERGED → PR3 impl #185 MERGED（`3b5165c`，40 测 N1–N11 绿 + HG1–6）→ **PR4 parked**（mcp-draft，非 MVP；启动前须按 v1.2 D8 定 backend）。**下一步优先：真实 reference-pack pilot**，不是启动 PR4。
