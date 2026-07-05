# BACKLOG INTAKE POLICY

> **Status:** PILOT VALIDATED (AGE only) — portfolio rollout requires separate approval.（AGE pilot 2026-07-03 已过 §9 判据:9/9 恰好一个准入态、agent-ready=0、0 裸奔;证据见 `evidence/backlog-intake-pilot-2026-07-03/`。）
> **Layer:** 0 (Governance)｜**Concern:** Governance
> **关联:** governed-work-loop 契约 `_meta/contracts/loop/`;执行基线 `DEFAULT_SKILL_POLICY.md` Policy 9 (Surgical Scope)。
> **不变量:** 拉取永远由 operator 人工触发,绝无自动出队。本 policy 不引入 autonomous runner。

本 policy 规定 LiYe portfolio 的**可执行待办如何被标注、授权、消费**,使 GitHub Issues 成为可按准入态过滤的工作载体,同时守住 fail-closed 边界。它是标注层,不是执行器。

---

## 1. 目的

- **主目标:** 让每个 open issue 携带明确的准入态,支撑人工 triage 按状态过滤(治「裸奔 issue」)。
- **副产品:** 标注同时构成将来 governed-work-loop runner 的准入 API,零返工。价值不绑定在尚不存在的 runner 上。

## 2. 权威边界(四层)

| 载体 | 定位 |
|---|---|
| **GitHub Issues** | repo-local actionable work list(可标注、可过滤的可执行待办)。**非**自动出队 queue,**非**治理权威。 |
| `.planning/<track>/` | phase / spec / track authority。 |
| `agentic-evolution/ROADMAP.md` | portfolio-level curated ordering(人工策展排序,只读产物)。 |
| `.planning/todos/` | deprecated scratch(见该目录 README)。 |

**规则:** GitHub Issues 不得反向覆盖 `.planning/` 的治理权威。

## 3. 标签规范

### 3.1 准入态(互斥,每个 open issue 恰好一个)

| Label | 含义 | 可作 candidate |
|---|---|---|
| `agent-ready` | 通过 §4 硬准入 + operator 授权(§5) | ✅ 可作**人工触发的 agent work candidate** |
| `needs-operator` | 未准入:缺决策 / 缺 DoD / 等触发条件 / parked。补齐后可转 `agent-ready` | ❌ |
| `control-plane` | 触碰治理 / exec / 生产写 / 契约。与 `agent-ready` **互斥** | ❌(永不) |

### 3.2 类型(正交,可选)

`chore` = docs / test / drift / refactor。**类型 ≠ 准入**(chore 也可能 needs-operator)。

### 3.3 Fail-closed 默认

- **裸奔(无任何准入标签)= 非 candidate**,一律视同 `needs-operator`。白名单制:仅显式 `agent-ready` 可作 candidate。
- **裸奔 = 违规**(待 triage 债),非中性默认。由 §6 机械检查检出。

## 4. `agent-ready` 硬准入(七条,全满足)

1. 有 **DoD**(可机验收的完成定义,写在 issue 正文)
2. 有 **验证命令**(测试 / lint / 构建)
3. **scope 有界**(单一 track/目录;呼应 Policy 9 Surgical Scope)
4. **PR-only**(产 PR,不直 commit main)
5. **无副作用**:无生产写、无 credential 访问、无 local config side effect
6. **无 control-plane** 触碰
7. **operator 授权**(§5;非 agent 自判)

任缺其一 → 不得为 `agent-ready`,退回 `needs-operator`。

## 5. 授权与新鲜度(双时点)

### 5.1 授权时点(打标)

打 `agent-ready` 前,issue 上**必须**留一条审计 comment,写明:approver、日期、七条准入 checklist 逐项、scope、验证命令(模板见附录)。

- agent 至多 **propose**。唯有在**同一会话内获得逐 issue 明确批准**后,agent 方可代执行 `gh label` 并留下该 comment;否则由人手动打标。
- 理由:GitHub label 事件只显示 API actor,不保留 operator 逐条批准语义;comment 是不可否认的审计锚。

### 5.2 执行时点(开工前 revalidation)

- `agent-ready` 是**候选状态,不是执行授权**。标签无 TTL(不引入定期扫描层)。
- **每次开工前**,必须基于**当时的 `origin/main`** 重新验证 §4 七条(正文 / 主干 / 测试路径 / 依赖可能已漂移)。
- 不满足 → 仅 **propose downgrade 到 `needs-operator`**,**不得开工**,等 operator 重新授权。

## 6. 不变量与机械检查

**不变量:** 每个 open issue 恰好一个准入态。

- Pilot 收尾及此后每次 triage 批处理**必须**跑一次 detection-only 检查,机械证明 0 裸奔、无冲突(命令见附录)。
- 不进 CI(避免 Actions billing 阻断),手动 / 本地跑。"0 裸奔"不接受目测。

## 7. 与 governed-work-loop runner 的接口

runner **目前不存在**(契约 + validator only)。本 policy 不建 runner,只保证标注是将来 runner 的合法进料。

runner 解锁前置(**必要非充分,须全满足**):
- (a) EVO-A gate wiring 完成(≠ runner build)
- (b) governed-work-loop validator 进 contracts gate
- (c) runner 独立 SPEC ceremony 升 v1.0

runner 一旦建,按契约消费:输入 = `agent-ready` open issues;触发 = **operator 指定**(非轮询);执行 = `proposes_only` 产 PR,不自 merge / 不自 close;每 run 产 attestation(契约 C6/C7),issue 留 ref。

## 8. 边界(禁止)

- ❌ 「有问题就修完 + 关 + 提交」写进 CLAUDE.md / agents.md / 任何 startup 文件
- ❌ 自动轮询 / 抢占式优先级队列 / 自动出队
- ❌ agent 自我授权打 `agent-ready`
- ❌ agent 自 merge / 自 close
- ❌ 碰 control-plane / exec / 生产写(锁在各自门,如 AGE #403)
- ❌ 因「token 富余」扩大 scope(Surgical Scope 优先于吞吐)

## 9. 试点范围与回滚

- **范围:** 首个 pilot 仅 `loudmirror/amazon-growth-engine`。推广到其他 repo(如 `liyecom/liye-ai`)须单独评估(含 gh 账号路径)。
- **成功判据:** detection report 显示 0 裸奔;抽查 `agent-ready` 子集每条真满足 §4 + 有 §5.1 audit comment。
- **回滚:** label 层功能上可回滚,但删 label **会丢当前分类视图**;回滚前先导出 issue-label snapshot 存档,再删。非"无残留"。

---

## 附录:授权审计 comment 模板

```markdown
**[agent-ready 授权]**
- approver: <operator handle>
- date: <YYYY-MM-DD>
- scope: <单一 track/目录>
- 验证命令: `<test/lint/build cmd>`
- 准入 checklist(§4): [x]1 DoD [x]2 验证命令 [x]3 scope有界 [x]4 PR-only [x]5 无副作用 [x]6 无control-plane [x]7 operator授权
- 备注: 候选态,开工前须 against 当时 origin/main 重验(§5.2)
```

## 附录:Detection report 命令(§6)

```bash
R=loudmirror/amazon-growth-engine
gh issue list -R $R --state open --limit 200 --json number,title,labels \
  | jq -r '.[]
      | ([.labels[].name] | map(select(. == "agent-ready" or . == "needs-operator" or . == "control-plane"))) as $adm
      | (if ($adm|length)==1 then "OK" elif ($adm|length)==0 then "NAKED" else "CONFLICT" end)
        + "\t" + (.number|tostring) + "\t" + (.title)' \
  | sort
# 期望每行首列 OK。NAKED(0 准入态)/CONFLICT(>1)= 违规,修正后重跑。
```

---

**Version:** 0.1 (DRAFT / pilot)
**Created:** 2026-07-03
**Owner:** loudmirror
