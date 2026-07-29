# pi (earendil-works/pi) Upstream Reference Recon — 2026-07-29

Reference Declaration

- artifact_scope: reference
- artifact_name: pi-agent-harness-upstream
- source_kind: upstream-repo（披露性偏离：模板 enum {concept|fork|paper|vendor_doc} 无精确项；非本组织 fork，按最接近语义登记并在此注记）
- source_uri: https://github.com/earendil-works/pi
- reference_anchor: commit `cced6a21da273b26ee4a23a803680614bbe8dd1e`（v0.82.1，2026-07-29）

本文件是 reference/harvest 记录。**它不构成引擎选型，不授权任何实现、依赖安装或 P1+ 工作**；execution contract v0 的边界不变（`contract_status: schema_validated_only`；"The contract is not a warrant for speculative runtime or compatibility work"，见 `_meta/contracts/execution/README.md`）。

## 1. 登记性质与制度约束（先于任何吸收）

- 只读上游参考；不建立长期 fork；不强制本机常驻 clone（需要时浅克隆到临时区，随用随弃）。
- ⛔ 不作为任何 LiYe 组件的 runtime dependency。若未来出现真实 consumer 需要直接依赖 `@earendil-works/*` 包，属 Fork 纪律（本仓 SYSTEMS.md「Fork 纪律」节）的显式偏离，须同时满足：该 engine/cell 语境内的 decision ADR、与至少一个非 pi 方案的比较、operator 批准的窄范围 dependency exception、source-intake 供应链核查。license/pin/shrinkwrap 检查不能替代架构授权。
- ⛔ pi-server 不进入任何 LiYe 控制面：上游自标 experimental（`packages/server/README.md`），且 Radius 凭证在场时会向 `radius.pi.dev` 上报 hostname/platform/pid 与各实例工作目录（`packages/server/src/radius.ts`），由凭据共享隐式触发、无独立开关。
- ⛔ pi session 不作为任何 LiYe evidence/truth 载体：完整转录但零 non-repudiation（无哈希链/签名/文件锁；无「谁批准了什么」的条目类型；格式无稳定性承诺，迁移原地重写文件）。外部程序若需消费 pi 会话，走其 RPC 接口而非直接解析 JSONL。
- 上游协作现实：新贡献者 issue/PR 由 workflow 自动关闭（白名单制），路线图（RFC）部分不公开——任何依赖「补丁能推回上游」的计划不成立。License 为 MIT，版权人为自然人（非公司），正式采用前须独立确认权属与商标/域名持有主体。

## 2. Harvest：值得吸收的 pattern（按 Fork 纪律经 ADR 决议后独立实现，或走上述例外门）

1. **多供应商归一的成本真相**：38 家 provider 压到 10 种 API 方言，真实复杂度在显式建模的 per-API compat 开关矩阵与跨供应商有损降级规则（thinking 签名跨模型丢弃、tool-call ID 重映射、error/aborted 消息跳过重放、孤儿 tool call 补合成结果）——`packages/ai/src/types.ts`、`packages/ai/src/api/transform-messages.ts`。启示：transport 抽象要预算「开关矩阵 + 降级词表」，而非幻想「统一格式」。
2. **模型目录治理**：生成物带 schema 版本 + 分片 sha256 manifest + 事务式生成（staging→校验→rename→复检→回滚）+ 远程 overlay 双层（编译期慢地板 + 运行时增量，过期覆盖按时间戳丢弃）——`packages/ai/scripts/model-data.ts`、`packages/coding-agent/src/core/remote-catalog-provider.ts`。
3. **工具授权拦截点位形**：参数 schema 校验先于 hook、typed 事件、block 短路返回——`packages/agent/src/agent-loop.ts`（`prepareToolCall`）。注意其语义缺陷见 §3。
4. **事件流「永远良构」契约**：无 error 事件，失败一律编码进 `stopReason`；loop 外异常也合成完整事件序列；`stopReason=length` 时整批 tool call 拒执行（防截断参数静默不完整）——`packages/agent/src/agent-loop.ts`。
5. **Session 父指针树**：同文件原地 branch（挪 leaf 指针零复制）与 fork 复制到新文件双机制；compaction 为 append-only 可逆节点——`packages/coding-agent/src/core/session-manager.ts`。
6. **durable-harness 设计词表**：durable boundary、队列消费先记录再视为已消费、非幂等工具禁自动重放、provider stream 不可恢复只能从边界重试——`packages/agent/docs/durable-harness.md`（设计备忘，未实现）。
7. **供应链闸组合**：`.npmrc` `min-release-age=2`；install-script 白名单逐条带理由 + 反向防腐烂校验（已消失的白名单项必须移除）；lockfile 变更默认阻断提交并打印增删改摘要；draft-first release + 资产集合精确比对；npm trusted publishing——`scripts/generate-coding-agent-shrinkwrap.mjs`、`scripts/check-lockfile-commit.mjs`、`.github/workflows/build-binaries.yml`。
8. **密闭测试**：faux provider 从罐装消息重推完整事件序列（伪 token 切片、任意时点 abort、cache 命中模拟），agent loop 走与真 provider 相同的事件形状；`test.sh` 用 `env -i` + 白名单环境结构性保证凭证闸全触发——`packages/ai/src/providers/faux.ts`、`test.sh`。
9. **两阶段 trust bootstrap**：先以 untrusted 状态加载、排除项目本地扩展，仅可信位置的扩展有资格决议 trust，决议后再做最终加载——`packages/coding-agent/src/core/extensions/resource-loader.ts`。
10. **工具后端注入一等公民**：每个内置工具 = 工厂 + Operations 接口，7 个工具可整体路由进 micro-VM——`packages/coding-agent/src/core/tools/`、`examples/extensions/gondolin/`。
11. **编辑工具工程细节**：realpath 互斥队列（symlink-aware 串行化）、abort 不在 listener 中 reject（防互斥队列早释）、CRLF/BOM 归一后写回还原——`packages/coding-agent/src/core/tools/edit.ts`、`file-mutation-queue.ts`。
12. **Agent Skills 标准互操作**：实现 agentskills.io 规范，可直接消费其他 harness 的 skills 目录——skill 资产跨 harness 可移植性的实证——`packages/coding-agent/docs/skills.md`。

## 3. Harvest：反面教材（pi 明确不提供、LiYe 契约面须显式补齐的性质）

- **默认 fail-open**：无 per-call 审批；hook 返回 `{block:true}` 产生的是可重试的错误 tool result 回给模型（模型可换说法再试），不是硬停机——`packages/agent/src/agent-loop.ts`。
- **abort 协作式非抢占**：并行工具模式下 abort 后、已完成准备的工具仍会全部启动——同上文件。硬 kill-switch 须同时满足：串行执行 且 执行器自身观察 AbortSignal 且 abort 后不得开始下一工具。
- **无文件系统边界**：cwd 是路径解析基点而非边界；bash 无默认 timeout、继承全部环境变量——`packages/agent/src/harness/tools/`。
- **extension 无隔离**：与主进程同权限；后加载的 extension 可无条件覆盖已受限的同名工具（仅留 diagnostic）；全局与 CLI 指定的 extension 不经 trust 门——`packages/coding-agent/src/core/agent-session.ts`、`resource-loader.ts`、`loader.ts`。
- **上下文注入面**：skills 校验仅格式；`AGENTS.md`/`CLAUDE.md` 不受 trust 门限制即进 system prompt——`packages/coding-agent/docs/security.md`。
- 上游对以上各条的态度是坦诚的「刻意不做」（security.md 明说部分沙箱会被误认为安全边界、真隔离须来自 OS）——这强化而非削弱本仓 fail-closed 契约的差异化必要性。

## 4. 故障模型类比（限定表述）

pi 的 durable-harness 设计词表（§2.6）与 LiYe 既有 engine-local 先例（recovery qualification 谓词、事务锁与 crash-gap reconciliation）在故障模型上同向。**这只是「可迁移的故障模型类比」**：LiYe 既有先例不是通用 agent loop contract，未证事项包括非幂等外部工具的 exactly-once/at-most-once、provider stream 中断恢复、tool execution receipt 与业务 readback 的绑定、队列消费的原子提交。不得据此断言「契约已就绪、只差 runner」。

## 5. 方法与证据边界

静态研读 upstream `cced6a2`（浅克隆），未运行、未 live 测试、未查询 npm registry。本文件所有行为断言以上游该 commit 的文件为锚；上游高频发布（lockstep 版本、minor 即 breaking），任何后续消费须先对新版复核。研究过程的完整机制地图属 operator-private 工作记录，不在本仓。
