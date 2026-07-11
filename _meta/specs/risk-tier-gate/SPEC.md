# merge_risk_tier gate — SPEC（L0 cross-repo invariants）

> 本 SPEC 是 changeset authorization + merge enforcement 的 **contract-first 边界**：只钉 `merge_risk_tier` 语义、trust root、fail-closed 与 sequencing，**不写实现、不改运行代码、不改 branch protection、不碰 live-write**。与 issue-admission policy（`_meta/policies/BACKLOG_INTAKE_POLICY.md`）是**不同治理对象**（issue admission ≠ changeset authorization），本 SPEC 不修改、不合并进它。
> **本 SPEC 明确不做**：不建 runner、不改 branch protection、不碰 live-write、不改任何 merge 合入行为。
> **不断言非 repo 事实**：本文件引用的 memory/会话结论一律标 **design rationale**，不写成 repo 已有事实。

**Status**: Accepted（Stage-0 L0 design contract；**合并即 ratify 本文本**,不留 operator-review-pending 过期态；**零 enforcement / 零实现 / 零 protection 改动**——Stage-1+ 依 §12–§13 另行 operator 授权）
**Stage**: Stage-0（spec ratified；next = Stage-1 offline shadow,**未授权**）· 五级 sequencing 见 §12
**L0 纯度**: 只放跨仓不变量;具体 actor / repo 快照 / 私有路径 / fixture / 回放证据全部下沉各仓 Stage-1（§13/§15）
**Upstream**:
- `_meta/contracts/execution/governed_execution_v0.schema.yaml`（`authority.pre_authorized` shape；§9 对齐锚，已逐字段核）
- `_meta/policies/BACKLOG_INTAKE_POLICY.md`（**不同治理对象**，仅边界参照）
**Downstream**: 各仓 Stage-1 evidence（`$AGE_REPO` 等：私有路径 allowlist / adversarial fixture / 回放 FP-FN / entitlement 实测；§13/§15）

---

## 0. Thesis + 命名

**建闸，不建 runner；先证明闸能 fail-closed，再谈放开低风险合入。** 无回放证据时，**有效 MRT-1 = 空集**是健康状态。

**正式命名（消歧）**：字段 `merge_risk_tier`，取值 **MRT-1 / MRT-2 / MRT-3**——刻意区别于 portfolio investment tier、knowledge tier、`execution_tiers.yaml`,三者互不相关。

## 1. 治理对象与非目标

- **管**：一个 changeset（PR/diff）落进哪个 `merge_risk_tier`，及 merge enforcement 如何 fail-closed。
- **不管（commit gate 能力边界）**：commit gate **只约束 main 合入**。它**不**约束网络出站、凭证读取、issues/releases/其它 GitHub API 副作用、生产 API 副作用。故**「只缺一道 commit gate 就能让 runner 在 operator 不在场时安全」为假**——commit gate 只覆盖 git-merge 一个面。
- **与 issue-admission 边界**：现行 policy 明文禁 agent 自 merge；本 spec 不把「未来自 merge 设计」追加进那份文件,避免自相矛盾。

## 2. Substrate 现实

**attended orchestration substrate 已存在**（operator 在环的并发编排底座）。**governed / unattended runner 不存在**，本 spec 不创建它。精确表述：**有编排底座，无受治理无人值守 runner**（对齐 SSOT `schema_validated_only / no runner`）。

## 3. 两药分离

- **有 git 断点的 changeset 类**：containment = main 的 branch-protection required-check（若已 machine-enforced，见 §11），**不是** worktree。⚠ worktree ≠ sandbox：带 Bash+network 的执行体能 push / curl 生产 API / 读 env 凭证逃逸。被「不能 merge」关住,不是被「沙箱」关住。
- **无可逆 propose 态的写类**（生产写路径是直连 API call、中间无 git/merge 断点的引擎）：写即 commit,路径里没有 git 闸。→ 永远 bounded write envelope,**永不进 MRT-1**。

## 4. merge_risk_tier 模型

| tier | 范围 | 授权形态（Stage-0/1） | 解锁信号 |
|---|---|---|---|
| **MRT-1** | 显式 allowlist 命中的可逆低风险类 | **有效 = 空集**；gate 可输出 `candidate_tier: MRT-1`,但 **authorized_tier 恒 ≥ MRT-2** | —（Stage-0/1 无授权效果） |
| **MRT-2** | control-plane / 契约 / governance-surface / 一切未命中 MRT-1 allowlist 者（默认 deny） | 异步批量 operator review | **operator approving-review 身份**（非 label——label 可被 write 持有者伪造） |
| **MRT-3** | **触碰/改变** live-write / 凭证 / prod config / activation / branch-protection / admin-bypass **surface 的 changeset**（非生产动作本身） | 逐次，永不降级 | 见 §10 MRT-3 授权条件 |

`candidate_tier ≠ authorized_tier`：gate 可「建议」low-risk,但 Stage-0/1 的 authorized_tier 恒 ≥ MRT-2。

## 5. 敏感面不变量（L0 只列类别；精确路径下沉各仓 Stage-1）

默认 deny。以下类别命中即自动升级（每仓 Stage-1 映射成本仓精确路径）：
1. runtime / 生产执行代码
2. governance 配置 / gate 配置 / waivers
3. schema / migrations
4. CI workflow（含 gate workflow 自身）
5. **gate 判定器脚本 + 其 allowlist 配置自身**（§7 无自证）
6. activation 钥匙（engine manifest / gate flip / learning sources）→ MRT-3
7. live-write / 生产 API caller / 凭证 resolver → MRT-3
8. 契约 / handoff schema / version registry

## 6. Allowlist 纪律

- **Stage-0/1：MRT-1 allowlist = 空集。** 不放 `docs/**`、不放根 `*.md`（真实仓 `docs/**` 含 governance/contracts/ADR/runbook；根 glob 命中 `CLAUDE.md`；与「control-plane 必 MRT-2」冲突）。
- **晋升只能凭回放**：Stage-1 后只能把经回放验证的**精确文件 / 精确目录**逐个晋升,**不得**直接放开粗 glob。
- **allow 规则必须同时约束**（任一命中即不得判 MRT-1,一律升级）：rename/delete、binary、symlink/submodule、mixed diff、文件数上限、diff 大小上限。
- **deny / escalation 永远优先于 allow。**

## 7. Trust root / check provenance（B4 + App-identity 修正）

**必要条件**：
1. gate workflow / executable / policy 来自**受保护 base revision**（非 PR head）。
2. PR head **只作数据读取，绝不执行**。
3. **PR-head 数据读取面的 token 只读、无 secrets**(评估 workflow 读 PR head 内容所用凭据;杜绝 pwn-request 提权)。此「只读」约束的是**读 PR head 数据**的面,与 §7 route-1 dedicated App **发布判定结果**所需的窄 write 面正交(见下),二者不共享凭据。
4. 触碰 workflow / gate / allowlist 的 PR **自动升级,且不能更换自己的判定器**。

**「固定 expected App source」是必要非充分**：GitHub Actions 不同 workflow **共用同一个 `github-actions` App identity**——固定 expected App 只绑定 App,不天然绑定**具体受保护 workflow**。**Stage-3 前必须证明 check context 无法被其它 workflow 冒名。** 可接受路线三选一：
1. **dedicated App**：发布 required check 的凭据**最小化为 `checks:write` 或 `statuses:write`**——**绝不含** contents、pull_requests、issues、actions、administration、approve 或 merge 权限;该发布凭据 / App signing credential **与 PR-head 执行面物理隔离**(不注入任何 PR-triggered、可被 head 代码读取的步骤)。故与 §7 条 3「读取面只读」**不矛盾**:**只读**约束读 PR head 数据面,**checks/statuses-write** 是发布判定结果的独立窄面；
2. 具备**固定受保护 workflow identity** 能力的组织 / ruleset；
3. 二者皆无 → **Stage-3/4 HOLD（在可信 producer 不存在期间,非"永久"字面锁死）;停留 Stage-2 live shadow,继续 blanket review,不得宣称 trusted required check**。

⚠ `pull_request_target` 须保持：base workflow、PR head 只作数据、绝不执行 PR 代码、read-only token、无 secrets;否则高权限 "pwn request"（https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target）。

**gatekeeper 立场**：不笼统拒绝所有 App;**只拒绝具 approve/merge 权限的 gatekeeper**。只签 attestation、不 approve/merge 的 dedicated App 可接受。

## 8. 分类 fail-closed 语义 + 不对称门槛（B5）

- **safety-critical false negative：必须为 0**。
- **unknown / error / timeout / mixed diff：一律升级**（never down-classify）。
- **false positive：单独设运营预算**,不与 FN 混算。
- **oracle label 必须由 gate 之外的 checker 给出**（ground truth 不能是 gate 自己）。

## 9. Attestation + execution-contract 对齐

gate 每 run 的 attestation **必须绑定**：exact **base SHA** + exact **head SHA**、每文件 **change status**（A/M/D/R + rename/binary/symlink 标记）、**policy digest** + **gate digest**、**canonical SHA-256**。不是含义不明的 "evidence hash"。

**对齐 governed execution contract**（现行 v0.1.0 精确 shape,锚 `_meta/contracts/execution/governed_execution_v0.schema.yaml`;schema `required: [envelope_ref, authorization_ref, authorization_sha256]`,已逐字段核）：
```
authority:
  kind: pre_authorized
  envelope_ref: ...
  authorization_ref: ...
  authorization_sha256: ...
```
- **只有 `authorization_ref` 有对应 `authorization_sha256`**；
- **不得声称 `envelope_ref` 已被 schema hash-pin**；
- **loop C8 / C12 与 execution authority 是正交锚点**,不是「C8 从属于 execution contract」。

**class-authorization envelope 定义**（MRT-1 晋升时的授权凭据）须含：authorization ID/ref；repo + branch scope；actor/principal；**精确 allowlist 与 diff 限额**；policy digest + gate digest；`valid_from` / `expires_at`；revocation reference；bypass policy；**no inheritance / no redelegation**。

## 10. Stage-3 required check PASS/HOLD 语义（B3）

```
PASS =
  classification_valid
  AND attestation_valid
  AND (
    MRT-1 has valid class-authorization envelope
    OR MRT-2 has non-author operator approval bound to current head SHA
    OR MRT-3 satisfies its separately defined operator-only condition
  )
```
要求：
- **pull_request head 更新后重新计算**；
- **review submitted / dismissed 后重新计算**；
- **approval 必须绑定当前 head SHA**；
- **unknown / error / timeout / missing check 一律 HOLD/FAIL**；
- **Stage-3 保留 blanket review,仅作冗余保护**；
- **Stage-4 只能移除冗余 review,不能同时更换 gate 判定逻辑。**

**MRT-3 授权条件（pinned,operator 已批准）**：
```
MRT-3 authorization =
  non-author operator approval
  AND approval carried by a machine-parseable, hash-bound approval artifact
      (sha256-bound to exact head SHA; tier-tagged merge_risk_tier=MRT-3;
       gate-verifiable — 自由文本 review 评论不计数)
  AND approval bound to current head SHA
  AND approval explicitly acknowledges merge_risk_tier=MRT-3
  AND approval authorizes this changeset merge only
  AND approval explicitly does not authorize live execution
```
merge click 主体不限;不要求 operator 亲手点击,也不引入 approve/merge gatekeeper（GitHub 原生规则无法按 tier 限定「最后由谁点击 merge」,亲手语义须独占 merger identity,与 §7 冲突）。

- **MRT-3 acknowledgement 须机读、hash-bound**：tier 确认不得为自由文本;须落成 machine-parseable、sha256-bound(绑定 exact head SHA)、tier-tagged 的 approval artifact,gate 可校验——至少含 `approver`、`head_sha`、`merge_risk_tier=MRT-3`、`authorization_scope=changeset_merge_only`、`live_execution_authorized=false`、`decided_at`;对齐 §9 `authorization_ref` + `authorization_sha256` shape;缺该 artifact,gate 判 HOLD,自由文本 review 不得单独构成授权事实。

**MRT-3 范围（措辞）**：MRT-3 = **触碰或改变 live-write surface 的 changeset**,不是「live-write 动作本身」。真正的生产 API 动作**完全在本 spec 之外**,另走 bounded write envelope——不得从「允许合入代码」滑成「允许执行生产写」（上式末条 authorization 断言显式封此滑坡）。

## 11. Enforcement 现实 + entitlement（L0 不变量；AGE 快照下沉 Stage-1）

- **API 能 readback branch-protection 配置 ≠ 机器门有效。** 个人账户 private repo 于 GitHub Free 下,private protected branches / required checks 需相应付费 entitlement;配置可读不代表被 enforce。
- **「required check 阻断」是未来目标条件句**,非当前既成:*若 entitlement 已确认、required check 已 machine-enforced,且受治理 actor 不具 applicable bypass,则该 check 对该 actor 阻断 merge。* **只有 no-bypass stance 经 readback + 受控演习证明后,才能声称「对所有受治理 actor 阻断」。** 不无条件写「对所有人」。
- 作者自批禁令（GitHub 全域:https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews）**只有在 required-review 真被 enforce 时才具保护意义**。
- **Stage-3 entry 前置（全部满足方可进）**：
  1. **entitlement 已确认**；
  2. **required-check 配置已 readback**；
  3. **受控阻断演习已通过**：direct push 被挡、无 check 的 merge 被挡、失败 check 被挡;
  4. **admin / bypass stance 已明确**；
  5. **未完成实弹认证前,只允许称 trust + detection,不得称 fail-closed。**
- Stage-4 co-design（不能只改一个 approval 数字）：CODEOWNERS + gate review semantics + bypass + expected check source 一起设计（保护分支+CODEOWNERS:https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches；required check expected source 同页 #require-status-checks-before-merging）。

## 12. 五级 sequencing

- **Stage-0**：独立 spec（本文件）。零代码、零 protection 改动。
- **Stage-1**：**离线 shadow**——历史 PR 回放 + adversarial fixture,测 FP/FN。不接真实 CI,不改 merge 行为。
- **Stage-2**：**真实 PR live shadow**——接真实 CI 作 informational,**零 merge effect**;验 CI integration 的 timeout / missing check / API failure / trusted-source 行为。
- **Stage-3**：required check **生效**（须先过 §11 entry 前置 + §7 provenance）,但**保留 blanket review** 作冗余;PASS/HOLD 按 §10。
- **Stage-4**：**另行授权** branch-protection / review 迁移,**才**谈移除冗余 review。

## 13. Runner 与 Stage-4 边界（B6）

- **`agent-ready>0` 与 contract shape-match 仅是必要非充分条件。** 任何 governed / unattended runner 仍须满足：现行 governed-work-loop **全部前置** + 独立 **runner SPEC ceremony** + **attestation / kill-switch / evidence-package** 要求 + **operator 单独授权**。
- **本 spec 不授权 runner。**
- **Stage-0/1/2 不授权非空有效 MRT-1。**
- **Stage-2 → Stage-3** 必须由 operator 批准**首个精确 allowlist 版本及其 authorization envelope**。
- **Stage-4 是全新的 branch-protection / authorization 决策。**
- **若不能证明 trusted check provenance、有效 entitlement 或 MRT-3 enforcement,Stage-3/4 必须保持 HOLD（停留 Stage-2）。**
- **不得为了证明 lane 有用而制造 agent-ready 工作。**

## 14. Explicitly out of scope（当前）

无人值守 runner（§13）；branch-protection / ruleset 变更（Stage-4）；live-write 路径（envelope,另章）；approve/merge-capable gatekeeper（拒）；制造 agent-ready 工作（拒）。

## 15. 各仓 Stage-1 handoff（L0 提纯下沉物）

以下**不进 L0**,全部留各仓 Stage-1 evidence（`$AGE_REPO` 等）：本仓当前 branch-protection / CODEOWNERS / rulesets 快照；私有敏感路径 allowlist；具体 actor / 编排底座实现；生产写路径硬编码事实；adversarial fixture；历史 PR 回放 FP/FN 数据；entitlement 实测与受控阻断演习记录。每仓 Stage-1 把 §5 类别映射成本仓精确路径。
