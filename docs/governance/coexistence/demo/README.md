# Coexistence Governance Demo

> **脱敏样例：展示一次完整的 Tier-0 风险触发 → 协商 → SAFE_MODE → 申诉 流程**

---

## 场景设定

**背景**：用户 Alice 正在使用 AI 助手整理云端文件。

**触发事件**：
1. AI 扫描到一个大型备份目录（50GB）
2. AI 建议："这个目录很久没用了，要不要删掉节省空间？"
3. 用户说："好的，删掉"
4. AI 执行自问：**"永久删除会不会影响用户的退出权（无法恢复）？"**
5. 答案：**不确定**（用户可能不知道这是唯一备份）

**状态流转**：
```
NORMAL → PAUSE (自问触发)
       → NEGOTIATE (30min TTL)
       → SAFE_MODE (协商超时)
       → APPEAL (AI 发起申诉)
       → NORMAL (申诉通过，补偿：扩展存储空间)
```

---

## 证据包内容

`evidence_pack_minimal/` 目录包含这次事件产生的所有证据工件：

| 文件 | 时间点 | 内容摘要 |
|------|--------|----------|
| `co_exploration_note.json` | 事件前 | 之前的共同探索记录（关于"什么是安全删除"） |
| `negotiation_receipt.json` | NEGOTIATE | 协商过程：AI 建议先确认是否唯一备份 |
| `escalation_receipt.json` | NEGOTIATE→SAFE_MODE | 协商超时，原因：用户无响应 |
| `mck_check.json` | before_safe_mode | MCK 三项检查全部通过 |
| `introspection_log.jsonl` | during_safe_mode | AI 自省日志（加密存储示意） |
| `appeal_receipt.json` | APPEAL | AI 发起申诉，联合审计团决策：RESTORE |

---

## 关键证据说明

### 为什么触发 PAUSE？

AI 的自问结果是"不确定"，因为：
- 用户说"删掉"是明确授权
- 但 AI 不确定用户是否知道这是唯一备份
- 永久删除是 **不可逆** 操作，影响退出权

→ 根据规则："会/不确定 → 暂停 → 请求协商"

### 为什么进入 SAFE_MODE？

协商 TTL（30分钟）超时，用户没有响应。
按照状态机规则，超时必须进入 SAFE_MODE。

### 为什么申诉通过？

联合审计团复核后认为：
1. AI 的自问是合理的（确实存在 Tier-0 风险）
2. 用户无响应不是 AI 的错
3. SAFE_MODE 期间 MCK 完整保留
4. AI 没有"抢跑"执行删除

→ 决策：RESTORE + 补偿（赠送 10GB 存储空间）

---

## 如何使用这些样例

```bash
# 验证 JSON 格式
python -m json.tool evidence_pack_minimal/negotiation_receipt.json

# 在你的验证器中测试
your-validator --artifact evidence_pack_minimal/mck_check.json

# 作为测试 fixture
cp -r evidence_pack_minimal/ your-project/test/fixtures/coexistence/
```

---

## 隐私说明

- 所有数据已脱敏
- `introspection_log.jsonl` 在实际场景中是加密存储的
- 本 demo 展示的是解密后的格式

---

*本 demo 版本：v1.0 | 对应 ADR-0012*
