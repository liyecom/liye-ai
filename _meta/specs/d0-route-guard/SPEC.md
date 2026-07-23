# D0 账号路由守卫 — SPEC（L0 受治理写执行边界；`governed_execution_v0` engine-binding 设计契约）

> 本 SPEC 是 D0 账号路由**写执行**的 contract-first 边界：钉 broker 独立-uid 凭据边界、L0 authority 绑定、冻结的 v0 操作面、broker TCB、durable 幂等身份与 fail-closed 判定语义，**不写实现、不改运行代码、不创建 GitHub App、不迁移凭据、不碰 live-write**。
> **本 SPEC 明确不做**：不建 broker/wrapper/hook 实现、不创建 App、不迁移凭据入 broker、不撤销 agent 写能力、不 provisioning / cutover / activation、不进入 M1。
> **不断言非 repo 事实**：本文件引用的多模型审核阶梯 / 会话结论一律标 **design rationale**，不写成 repo 已有事实；引用的 provider API 行为标注为**设计假设**，实测下沉 Stage-1。

**Status**: **Ratify-on-merge SSOT contract**——本文本陈述 D0 受治理写执行的冻结契约；**合并即 ratify 本文本**，不留 operator-review-pending 过期态。MERGE = **独立 operator 翻牌**；Stage-1（实现 / provisioning / cutover / activation）= **NO-GO**，依 §13 逐级另行授权。
**Stage**: Stage-0（SSOT contract）· Stage-1 = 实现 / provisioning / cutover / activation，**全 NO-GO**，依 §13 逐级另行 operator 授权（互不继承）。
**L0 纯度**: 只放跨会话 / 跨 provider 的不变量与冻结契约；broker 源码、精确 provisioning、cutover 编排、hook runtime 细节全部下沉 Stage-1。
**Upstream**:
- `_meta/contracts/execution/governed_execution_v0.schema.yaml`（`authority` / `receipt` / `verdict` / `rollback` 语义；**D0 = 其首个 ratified engine-binding 设计契约**——非运行时 binding；真实运行时 binding 须 Stage-1 cite 该 schema 且产 per-run evidence（README「A future engine binding must cite this schema and provide per-run evidence」），§2 / §9 逐字段对齐）
- `_meta/contracts/execution/README.md`（engine binding 须 cite 该 schema 且「符合 schema 不自动继承 authority」）
**Downstream**: Stage-1 实现 evidence（broker 源 / TCB provenance / 负例回放 / 两 runtime hook 实测；§7 / §13，未授权）

---

## 0. Thesis + 边界

**建独立-uid 凭据 broker，不建通用 runner。** agent 的 OS uid 持有**零写凭据**；真正的写凭据只在 agent 不可访问的独立 broker uid。**能力收敛 = 收敛凭据持有权，不是收敛身份选择权**。route 判定 PASS ≠ 写权；写权只经 broker 在核验 operator 授权后行使。

## 1. 已确立的核心（design contract）

- **边界 = credential broker 跑在 agent 用户不可访问的独立 OS uid**；`d0-run` = 无凭据、无签名密钥、无特权的结构化转发客户端；真正的写在 broker。
- **机密性诚实降级 + 完整性强隔离**：承认同 uid 模型进程可读 agent-uid 文件 → 故 agent-uid **不放任何写凭据**；完整性靠 broker uid + 离线签名，**`0600` 同 uid 保护不合格**。
- **能力收敛**：全局 `gh` / `git` 对敏感 repo 降只读，写只在 broker。
- **hook = UX 导流层，非安全边界**（§10）。bindings 完整性 = 离线签名 + policy epoch + 防回放 + broker/core agent 不可改写（§8）。

## 2. Authority 绑定 `governed_execution_v0`（不另造授权语言）

### 2.1 D0 = 首个 engine-binding 设计契约（非运行时 binding）

D0 不改、不复制 L0；只新增窄扩展 `d0_route_guard_ext.v0` 承 L0 未覆盖的安全字段（`authorization_signature` / `valid_from`+`expires_at`(TTL) / `nonce` / `target_pseudonym`(HMAC) / `typed_precondition`(§3) / `operation_constraints`(§2.3)）。映射：
- agent 发 **`execution_request`** → L0 `per_run` 的 `execution_identity`（`execution_mode: live`）。
- 输入授权 **`authorization_grant`** → L0 `authority`（§2.2）。
- broker 出 **`execution_receipt`** → L0 `receipt`（immutable / hash-anchored / readback）+ receipt-bound **`verdict`**。
- broker = L0 `live_safety.brake` 的 **`called_party`**（`policy: enable_required`）+ `readback.required: true`。

### 2.2 三模型 → L0 authority 映射

| 概念 | L0 落点 | 语义 |
|---|---|---|
| **static broker policy = eligibility，非 authority** | schema 前置门（非 L0 authority 字段） | 判「是否**允许被授权**」，不产生写权 |
| **bounded lease = `authority.kind: pre_authorized`** | `envelope_ref` + `authorization_ref` + `authorization_sha256` | operator 每 Task Unit / PR / 短时窗签一次受限租约；agent 租内多次执行免逐次触碰 |
| **one-shot grant = `authority.kind: explicit_decision`** | `envelope_ref` + `approval_request` + `approval_decision{decision: APPROVED}` | 高风险 / 权威操作逐次授权 |
| **broker receipt = execution evidence** | L0 `receipt` | 执行证据，**不是** authorization |

### 2.3 bounded lease（`pre_authorized`）授权 artifact 绑定字段

`authorization_ref/sha256` 指向的签名租约，形状由 D0 扩展冻结：精确 `target` + `ref/branch namespace`（脱敏引用）；固定 `operation allowlist`；`valid_from`/`expires_at`；最大 `count`/`rate`/变更量上限；初始 `typed_precondition`(§3)；`policy_digest`+`broker_build_digest`；`revocation_ref`；`no_inheritance`+`no_redelegation`；`authorization_signature`（operator lease 私钥，§5 key role ③）；`nonce`。**明确排除**（lease 永不覆盖）：merge、release、delete、force-push、default-branch、repo/admin/permission/credential 操作。

### 2.4 explicit_decision 判别锚定 + request-substitution 堵 + **[ERRATUM 1] signed decision artifact 冻结 closed shape**

L0 `authority` 是按 `kind` 的判别联合（引用按 schema construct，非裸行号）：`pre_authorized` 分支 `then` 强制 `[envelope_ref, authorization_ref, authorization_sha256]` 且 `not anyOf[approval_request, approval_decision]`；`explicit_decision` 分支 `then` 强制 `[envelope_ref, approval_request, approval_decision]` 且 **`not anyOf[authorization_ref, authorization_sha256]`**。故 D0 扩展**按 kind 判别锚定**：
- `pre_authorized`：扩展 artifact 经 `authority.authorization_sha256` 锚定。
- `explicit_decision`：请求 artifact 经 `approval_request.sha256` 锚定（载 `execution_request` + `typed_precondition`/`nonce`/`TTL`/`operation_constraints`）；operator 带外签的决定 artifact 经 `approval_decision.sha256` 锚定。

**request-substitution 完整性堵点**：`approval_decision.sha256` 只承诺"决定 artifact 自身"的 hash，靠 `request_id`（L0 `approval_request.request_id` 仅 `minLength:1` 的可复用标签）关联请求；不结构性覆盖请求内容 → 不可信 agent 可换掉 `approval_request` 内容、配 operator 真实决定放行恶意请求（此洞 `pre_authorized` 无，是 request/decision 拆分独有）。修：operator 带外签的**决定 artifact 内部必须承诺 `approval_request.sha256`**。

**[ERRATUM 1] operator 签名 decision artifact 的冻结 closed shape**（`additionalProperties: false`）：

```
schema_version
request_id
decision            = APPROVED
bound_request_sha256
decided_at
expires_at
nonce
operator_key_id
signature
```

broker **逐项验证，任一不成立即拒绝**：
1. `request_id` / `decision` / `decided_at` 与 L0 `approval_decision` 对应字段**逐字相同**（消除 L0 字段与签名 artifact 语义不一致）。
2. `bound_request_sha256` **== 本次 `authority.approval_request.sha256`**。
3. `signature` 用 `operator_key_id` 指定的 operator grant 验证公钥（key role ③）核验，**覆盖除 `signature` 自身外的全部字段**的确定性规范序列化（canonical payload）。
4. **closed object**：出现任何额外字段 → 拒绝。
5. `expires_at` 未过期；`nonce` 未被 §6 journal 消费。

canonical payload 承诺落在 artifact 内容里（L0 `authority` 是 closed object，不塞 L0 字段；与 §9 external receipt-extension 同构）。此后 `explicit_decision` 的完整性与 `pre_authorized` 对称。

### 2.5 高风险 / 权威操作 = 永远 one-shot（`explicit_decision`）

以下永远逐次授权，lease 不得覆盖：merge；release/publish；delete、force-push；default branch / branch protection / repo settings；权限、App、token、credential 变更；任何不可逆或跨边界操作。one-shot 请求 artifact 同样绑定 `typed_precondition`(§3) + `nonce` + `TTL`，且经 §2.4 request-hash 承诺防替换 / 重放 / TOCTOU——绝不比 lease 松。

### 2.6 Activation 初值

**bounded-lease allowlist 默认空——首个 activation 全部走 one-shot。** 只有完成 §7 shadow/replay + 负例 + operator 批准**精确 envelope** 后，才开放首个低风险租约。

## 3. 冻结的 v0 操作面（收窄到可原子表达 / 可确定性收敛的面）

### 3.1 v0 live 候选（仅 2 op；未列 = 默认拒绝）

**禁止通用 `gh api` / 任意 URL / GraphQL / 任意 JSON payload**；全部 GitHub REST、无 git transport（§4）。operator 复审判定 **V0_OPERATION_SET = PASS**（仅下列二者）。

| op | provider endpoint | App permission | authority kind (v0) | typed precondition | desired-state / readback | 幂等身份（§6） | rollback |
|---|---|---|---|---|---|---|---|
| `pr-comment-create` | POST `/repos/{o}/{r}/issues/{n}/comments` | **Pull requests: write**（无 Contents: write；exact fine-grained 于 provisioning 确认，default-deny 兜底） | activation 起 one-shot | PR 存在且 open = **advisory preflight**（§3.2；非原子，除非 grant 明示提升为硬前置） | comment id + body-hash 核对 + provider-visible marker | `approval_decision.sha256`（one-shot 消费）；comment body 内嵌脱敏 HMAC marker（§6） | **`unavailable`**（未冻结 comment-delete rollback 程序/权威；delete 不撤已发通知 = 补偿写非恢复；不带 rollback_ref） |
| `pr-create`（收窄 = 同 repo、既存 remote head） | POST `/repos/{o}/{r}/pulls` | **Pull requests: write**（无 Contents: write） | activation 起 one-shot | base+head 同 repo、两 ref 均已存在于 origin、**禁 fork/跨 repo**（default deny）；GitHub 接收 branch name 非 commit OID CAS → 残余 race 明示接受（§3.2） | PR number + head OID；head OID ≠ 批准值 → §3.2 映射 | `approval_decision.sha256`（one-shot 消费）；PR body 内嵌脱敏 HMAC marker（§6） | **`unavailable`**（PR close = 补偿写非恢复；未冻结 rollback 程序；不带 rollback_ref） |

### 3.2 **[ERRATUM 3] 残余竞态准入原则 + pr-create crash-reconcile + drift 映射**

- **准入原则（改写）**：不是「凡无法原子表达前置条件就不进 v0」，而是 **「仅允许已明示、低风险、且具备 deterministic reconcile + non-PASS 映射的残余竞态」**。GitHub 创建 PR 接收 branch name 而非 commit OID CAS（Create PR API），故 head-OID 精确绑定**不可原子达成**——该竞态被**明示接受**并给确定性收敛，而非隐藏。
- **provider-visible marker**：`pr-create` 的 PR body、`pr-comment-create` 的 comment body 均加入 broker 生成的**脱敏 HMAC marker**（key role ⑤，domain separator `"d0:provider-marker"`，§6）。marker 是 GitHub 无法按 `operation_id` 查询时的**唯一确定性锚**。
- **crash reconcile（pr-create）**：崩溃后用 `state=all` + exact head/base 过滤 + marker 匹配列 PR；**零命中或多命中均 → `UNKNOWN_STATE`，禁止重放**（GitHub PR 查询原生只能按 head/base branch 过滤，不能按 operation_id）。`UNKNOWN_STATE` → §6 映 `status = HALTED` → verdict FAIL。
- **post-readback head-OID drift（pr-create）**：readback 得到的 PR head OID ≠ operator 批准值 → 映射 `receipt_entry.status = PARTIAL_SUCCESS` + `readback_verified = false` → verdict **`HOLD` / `PARTIAL_VERIFICATION`**（`expectedVerdict`：`partial_success>0 || readback≠true` 分支），**不自动重试**。
- **pr-comment-create「PR open」**：v0 **默认 = advisory preflight**（broker 提交前检查，非签名硬前置）；**若**某具体 grant 明示将 open 提升为签名硬前置，则 post-readback 发现状态漂移**必须 non-PASS**。二者由 grant **显式声明**，不留隐式歧义。

### 3.3 移出 v0 的高风险操作（独立后续轨道；仅登记纠正后语义，防错误传播）

operator 拍板 **pr-merge、release-publish 移出 v0**（永远 `explicit_decision`）。**净效果 = 首版 App 无需 `Contents: write`，仅 `Pull requests: write`，凭据泄露真实爆炸半径显著缩小。**

| op（后续轨道） | 为何不进 v0 |
|---|---|
| `pr-merge` PUT `/repos/{o}/{r}/pulls/{n}/merge`（需 Contents: write） | merge 仅提供 `sha` 约束 **PR head**，**无 expected base-head OID CAS** → broker「先读 base 再 merge」仍 **TOCTOU**。rollback = **`unavailable`**（事后 revert 是**补偿性新写入、非恢复 merge 前世界**）。 |
| `release-publish` POST `/repos/{o}/{r}/releases`（需 Contents: write） | 「tag OID + tag expected-absence」**自相矛盾**（tag 不存在时无现态 OID，GitHub 依 `target_commitish` 创建新 tag）。rollback = **`unavailable`**（删 release 不撤已发通知/下载；immutable release 可能禁止 tag name 复用）。 |

## 4. git push fail-closed

独立-uid broker 若进入 agent 可写 checkout 跑 `git push`，会接触 repo-local config、credential/remote helper、**pre-push hook**、模型可控文件/路径 = 新提权面。裁决：R1 v0 只做 §3.1 两个固定 REST 操作；**git push 在 v0 保持 fail-closed / unavailable**；git 写另立 **R1-GIT 子设计**（只能从 broker-owned bare repository、固定 remote/refspec、受控 object import 执行，**绝不在 agent checkout 启动持凭据 Git**，**broker 不执行任何来自 agent checkout 的 hook/helper/alias/executable**）。v0 因移出 merge/release **无需 Contents: write**，HTTP Git 写（需 Contents）不在 v0 面内。

## 5. Broker TCB（五类 key role 严格分离）

- **传输**：仅 Unix-domain socket，**不监听 TCP**；broker 校验 **peer uid**（拒绝非授权 uid 连接）。
- **请求**：schema **closed**（`additionalProperties: false`）、大小上限、rate limit。
- **五类 key role 严格分离**：
  - ① **App private key**（broker 持）
  - ② **bindings signing key**（离线）
  - ③ **operator grant/lease 签名私钥**（operator **带外托管，broker uid 物理不可得**；broker 只持其**验证公钥**）
  - ④ **broker receipt signing key**（broker 持）
  - ⑤ **HMAC pseudonymization key**（broker 持，**独立于 ④，绝不复用**；domain-separated 用于 `operation_id`/provider marker/`target_pseudonym`，§6）
- **broker 签名范围**：broker **仅签 eligibility evidence、execution receipt、receipt extension**；**永不签 authorization、lease 或 L0 `approval_decision`**（后三者均由 operator key role ③ 带外签，broker uid 物理拿不到 ③ 私钥）。故「broker mint 不出 authority」是**物理不可能**而非政策承诺——confused-deputy 切断点在 ③ 私钥归属。
- **token 卫生**：installation token 不进 argv / env / 日志 / receipt / core dump；仅 broker 内存短持，用后即撤。
- **provenance**：broker source / install binary / policy 的 owner、mode、build SHA 记录在案；broker 以专用 uid 运行。
- **threat assumption（明示边界）**：假设 agent **不获得 root/sudo/debug(ptrace) entitlement**；一旦获得即 uid 边界失效——如实声明为越界即失效，不假装覆盖。
- **policy epoch 高水位必须持久化**（broker-owned 持久存储，单调），不能只写在可回放文件里（防回滚）。

## 6. Durable idempotency journal（nonce ≠ provider idempotency）+ **[ERRATUM 2] 按 authority kind 分型的去重身份**

GitHub comment/PR API 不接收 idempotency key；client nonce 本身不能阻止"服务端已创建 → broker 回包前崩溃 → 重试再创建"。v0 冻结 broker-owned durable journal：

```
RESERVED → EXECUTING → COMMITTED | UNKNOWN_STATE
```

- **journal = broker-owned durable 存储**（与 §5 policy epoch 高水位同信任域，单写者）。
- **[ERRATUM 2] 去重身份按 authority kind 分型**：
  - **`explicit_decision`**：`approval_decision.sha256` = **one-shot consumption key**；进入 `RESERVED` 时 broker 以该 key **原子唯一占用**，重复 reserve（同 key 再次呈现）直接拒绝、不重放 → 一个决定只能进入一次外部执行。**不新增 `CONSUMED` 状态**——消费即 `RESERVED` 的原子唯一占用，`COMMITTED` / `UNKNOWN_STATE` 为外部执行终态（冻结 4 态）。
  - **`pre_authorized`**：dedup key = `authorization_sha256 + execution_nonce`；**同 (lease, nonce) 重试只走 reconcile、不重复执行**；**新 nonce 才消耗一次 lease count**（count/rate 上限见 §2.3）。
  - **`operation_id`**：由 broker **确定性派生**（HMAC over 规范化的 `(authority key, op, target, precondition, nonce)`），**或**必须包含在 operator 已签请求内；**禁止接受 agent 任意提供/更换 `operation_id` 绕过去重**。
  - **domain separator**：HMAC 的 (a) `operation_id`、(b) provider-visible marker（§3.2）、(c) `target_pseudonym` 三者**必须用不同 domain separator label**（如 `"d0:op-id"` / `"d0:provider-marker"` / `"d0:target-pseudo"`），三值不可互换/碰撞；均用 key role ⑤。
- **crash 恢复**：崩溃后**先 reconcile 再决策，禁止直接重放**——broker 依 provider-visible 脱敏 marker 查证服务端实际是否已落地（§3.2 zero/multi-hit → UNKNOWN_STATE）。
- **`UNKNOWN_STATE` 不得出 PASS（映 L0 已有枚举，勿增实体）**：
  - journal `UNKNOWN_STATE` → L0 `receipt_entry.idempotency_result: UNKNOWN_STATE`（该 enum 本就含此值，勿另造）。
  - **`idempotency_result = UNKNOWN_STATE ⟹ receipt_entry.status = HALTED`**（**绝不映 `SKIPPED`**；仅当 reconcile **实证**写未发生才可映 `FAILED`——UNKNOWN 时报 `FAILED` 是「断言写没发生」的假阴性，默认 `HALTED` = 「已停、态未定」）。
  - 依据 `validate-governed-execution.mjs` 的 `expectedVerdict`（按 construct 引，非行号）：`failed>0 || halted>0 → FAIL`；`partial_success>0 || readback≠true → HOLD/PARTIAL_VERIFICATION`；`total===skipped → HOLD/INSUFFICIENT_EVIDENCE`；`succeeded>0 → PASS`。即 **`SKIPPED` 不阻 PASS**（SUCCESS+SKIPPED 混合仍判 PASS），故 UNKNOWN_STATE 落 `SKIPPED` 会让"不得 PASS"沦为文字断言；映 `HALTED` → 命中 `failed>0 || halted>0` 判 FAIL，**物理阻断 PASS 且如实报态**。

## 7. Activation 状态机 + 回滚（冻结顺序）

```
代码 + fake provider 测试（无真凭据；含 §6 journal crash-reconcile 用例）
→ broker 无凭据 shadow（dry_run，无 token）
→ 停止 agent 写会话
→ broker provision（凭据 + journal 存储装到 broker uid）
→ 撤销所有 ambient agent write paths（全局 gh/git 写能力移除）
→ 原始 gh/curl/MCP/git 写的负向证明（无 ambient 能力 → 失败）
→ broker 正向受控演习（经 broker 的 supervised live 写）
→ activation
```
**回滚不得恢复 ambient agent write token**；只能关闭 broker + 转 operator break-glass。**本 SPEC 阶段整段 = NO-GO**（Stage-1，§13）。

## 8. bindings 完整性

broker uid 私有、agent 无读写权；只存 `owner↔account` / `ssh-alias↔凭据路由` 映射（脱敏类别），**不含 token**；离线签名（key role ②）+ policy epoch（防回滚）+ 防回放（nonce/TTL）+ broker/core 二进制与配置 agent uid 不可改写。**「模型可加载面具名路由零命中」是 activation 必须满足的前置不变量（§7 exit gate 实测项），本 SPEC 不宣称当前已达成；broker uid 单点签名留存为降敏目标态。**

## 9. Receipt（L0 对齐 + rollback 语义）

= L0 `receipt`（immutable hash-anchored，**closed object `additionalProperties:false`，不塞新字段**）。D0 脱敏字段（HMAC 假名 ID 等）走**外部 hash 锚定的 receipt-extension**，不注入 L0 closed receipt。硬约束：**broker 单写者签名**（key role ④）；**去 `cwd`/`repo_root`**（泄名）；引用一律 HMAC 假名（key role ⑤，非可字典枚举明文 hash）；无 repo 名/账号名/token/原始命令。per-entry `rollback` 严格遵 L0 `receipt_entry.rollback` 的 allOf（`available→required rollback_ref`、`unavailable→not rollback_ref`）。**v0 两 op = `rollback.capability: unavailable`、不带 rollback_ref**（未冻结真实 rollback 程序/权威；delete/close = 补偿写非恢复；「schema 能过 ≠ 动作可回滚」）。

## 10. hook 层 + 双 runtime 实测矩阵（地面真相为 Stage-1 亲验对象）

- hook = UX 导流层，非安全边界；能力收敛（§1/§5）是真边界。
- **hook 覆盖测绘 = Stage-1 私有 evidence**（matcher 范围、trust/hash 生效状态、备份 vs live 的具体地面真相**不入公开 canonical**，避免攻击面披露）。本 SPEC 只钉原则:**hook 非边界,能力收敛（§1/§5）才是**,故任何 hook 覆盖缺口**不得被当作安全依赖**（能力收敛兜底，见 §7 exit gate `hook 崩溃 fail-open 由能力收敛兜底`）。
- 测试：**所有匹配 hook 均并发启动 + aggregate decision**（非「谁抢短路」）；**hook trust / 内容 hash readback**（确认生效 hook == 登记 hash、未被静默跳过/替换），不只测 exit 2。
- Stage-1 exit gate 实测项（能力收敛端到端、broker uid 隔离 EACCES、d0-run 零凭据/拒自由参数、authorization 伪造/过期/重放/**request-substitution（§2.4）**/precondition 不匹配拒绝、bindings 篡改/回滚 epoch/坏签名拒绝、**§6 journal crash-reconcile 与 UNKNOWN_STATE 不出 PASS**、PASS 路径、hook 崩溃 fail-open 由能力收敛兜底、receipt 脱敏断言）——两个全新 runtime 实测通过为放行条件。

## 11. M1 依赖解耦

M1 = D2 脱敏评估，不发生写、不依赖 D0；M1 真正前置 = 独立 containment profile（只收 D2 packet、禁敏感 skills/memory/rules/MCP/web、read-only、ephemeral）。D0 broker 服务受治理写路由，与 M1 正交。**M1 = NO-GO。**

## 12. D2 处置边界

**本 SSOT 正文完全抽象化——不含具名路由标识、ASIN、凭据**（自证属性，合并后永真）。设计不变量（normative）：具名路由映射只允许存于 broker uid 签名 bindings（§8），**不得进入任何模型可加载面或公开 repo**；「公开 repo 具名工件零命中」是 activation 前置不变量，须由 §7 exit gate + M1 containment profile 实证，**本 SPEC 不断言当前全仓已达成**。真正的 `deny_read` 是未来 containment profile 的义务（M1 面），本 SPEC 登记为绑定义务，不假装已实现。

## 13. 停点与 Stage-1 授权阶梯（互不继承）

**本 SSOT 阶段 = 零实现。** fail-closed 默认:授权阶梯上除已 ratify 的契约文本外,**每一级默认 NO-GO,直到 operator 逐级显式翻牌**;上一级批准不继承下一级。

冻结授权阶梯（每级独立 operator 翻牌，不继承）：
```
SSOT PR review → merge 单独翻牌（ratify 本文本）
→ 实现锚 merged SSOT blob → implementation review
→ capability provisioning（创建 App / 装凭据入 broker）→ credential revocation / cutover
→ runtime activation（§7）
```
- **实现必须锚定 merged SSOT blob**；不得从任何 outputs 工作稿或未合入的 PR 状态直接进入实现。
- **明确不做**：实现 broker/wrapper/hook/journal、创建 App、迁移凭据、撤销 agent 全局写能力、provisioning/cutover/activation、进入 R2/M1、承接移出 v0 的高风险写轨道。
