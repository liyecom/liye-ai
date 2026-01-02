# P2: Deterministic LLM Runner

> **Status**: CANONICAL
> **Phase**: P2 (Engineering, not Research)
> **Created**: 2025-12-31
> **Priority**: 可复现 > 可审计 > 可回滚

---

## Core Principle

> **LLM 是确定性执行器，不是推理源或变量源**

```
┌─────────────────────────────────────────────────────────┐
│                    REASONING AUTHORITY                   │
│                                                         │
│   ✅ T1 Mechanisms      → 因果逻辑的唯一来源            │
│   ✅ Lift Criteria      → 质量判据的唯一来源            │
│   ✅ Case Baselines     → 正确性基准的唯一来源          │
│                                                         │
│   ❌ LLM                → 禁止作为推理源                │
│   ❌ Prompt             → 禁止作为逻辑载体              │
│   ❌ Chain-of-Thought   → 禁止作为决策依据              │
└─────────────────────────────────────────────────────────┘
```

---

## LLM Role Definition

### ✅ LLM IS: Executor（执行器）

LLM 的唯一职责是将 T1 机制**格式化输出**为结构化 JSON。

```
Input:  T1 Mechanism + Context Data
Output: Structured JSON (schema-validated)
```

### ❌ LLM IS NOT:

| 禁止角色 | 含义 | 违规示例 |
|----------|------|----------|
| Reasoner | 不产生新推理 | "根据我的分析..." |
| Planner | 不规划步骤 | "我建议先...然后..." |
| Advisor | 不给建议 | "你应该考虑..." |
| Synthesizer | 不综合观点 | "综上所述..." |

---

## P2 Scope Boundaries

### P2 允许

- 实现 Deterministic Runner
- 验证 LLM 输出可复现性
- 建立输出校验机制
- 创建 Runner 专用 Case

### P2 禁止

| 禁止事项 | 理由 |
|----------|------|
| ❌ Prompt Engineering 优化 | 会引入不可控变量 |
| ❌ Chain-of-Thought | 会创造新推理路径 |
| ❌ 多模型 Ensemble | 会增加不确定性 |
| ❌ 对外 API / UI | 超出工程阶段范围 |
| ❌ 产品化叙事 | 违反阶段边界 |
| ❌ 改变 Lift 判据 | 已在 P0.5/P1 冻结 |
| ❌ 扩展 Domain | 已在 P1 冻结 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     T1 Analyst Agent                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │  1. Select T1 Units (based on domain/question)     ││
│  │  2. Call Deterministic Runner                       ││
│  │  3. Return validated output                         ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Deterministic Runner                    │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │ Execution       │  │ Output          │              │
│  │ Contract        │  │ Validator       │              │
│  │ - input schema  │  │ - JSON schema   │              │
│  │ - output schema │  │ - hash verify   │              │
│  │ - constraints   │  │ - reject free   │              │
│  └─────────────────┘  └─────────────────┘              │
│                           │                             │
│  ┌─────────────────────────────────────────────────────┐│
│  │ runner_config.yaml (FROZEN)                         ││
│  │ - temperature: 0.0                                  ││
│  │ - top_p: 1.0                                        ││
│  │ - retries: 0                                        ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      LLM Provider                        │
│  (Stateless, Deterministic, Schema-bound)               │
└─────────────────────────────────────────────────────────┘
```

---

## Determinism Requirements

### 1. Bit-Level Reproducibility

```
Same Input → Same Output (hash identical)
```

Enforced by:
- `temperature: 0.0`
- `top_p: 1.0`
- `retries: 0`
- No random seeds
- No timestamp in output

### 2. Schema-Bound Output

```json
{
  "mechanism_id": "string (required)",
  "domain": "string (required)",
  "analysis": {
    "trigger_match": "boolean (required)",
    "applicable_rules": ["array of strings (required)"],
    "recommended_action": "string (required)"
  },
  "confidence": "NOT_ALLOWED (reject if present)",
  "summary": "NOT_ALLOWED (reject if present)"
}
```

### 3. No Free Text

| Field Type | Allowed | Rejected |
|------------|---------|----------|
| Structured JSON | ✅ | - |
| Enum values | ✅ | - |
| Predefined strings | ✅ | - |
| Free-form text | ❌ | "I think...", "Based on my analysis..." |
| Markdown | ❌ | Any formatting |
| Explanations | ❌ | "This is because..." |

---

## File Structure

```
src/runner/
├── deterministic_runner.py   # Main runner implementation
├── execution_contract.py     # Input/output contracts
├── output_validator.py       # Schema validation + hash
└── runner_config.yaml        # FROZEN configuration

experiments/runner_validation/
├── case_r01.yaml             # Reproducibility test
├── case_r02.yaml             # Schema compliance test
└── case_r03.yaml             # Verdict stability test
```

---

## Configuration Freeze

`runner_config.yaml` is **FROZEN**. Any modification requires:

1. Human approval (PR review)
2. Justification document
3. All Runner Cases must PASS
4. Regression Gate must PASS

### Frozen Values

```yaml
llm:
  temperature: 0.0      # FROZEN - no randomness
  top_p: 1.0            # FROZEN - no sampling

execution:
  retries: 0            # FROZEN - no retry variance
  parallel: false       # FROZEN - deterministic order

determinism:
  enforce_schema: true  # FROZEN - always validate
  reject_free_text: true # FROZEN - no prose
  hash_outputs: true    # FROZEN - always hash
```

---

## CI Gate: Determinism Gate

Triggers on:
- Any change to `src/runner/`
- Any change to `runner_config.yaml`

Blocks if:
- `temperature > 0`
- `top_p < 1`
- `retries > 0`
- Schema validation disabled
- Hash verification disabled

---

## Definition of Done (P2)

P2 is complete when:

| Criterion | Verification |
|-----------|--------------|
| ✅ Runner 输出 100% 可复现 | hash 一致性测试 PASS |
| ✅ 所有 Runner Case PASS | 3+ cases in runner_validation/ |
| ✅ Regression Gate PASS | v1 + v2 + Runner Gate |
| ✅ Agent 无自主推理能力 | Code review + test |

---

## What P2 Does NOT Change

These remain frozen from P0.5/P1:

- T1 Mechanism definitions
- Lift Criteria (4 dimensions)
- Case Baselines (18 cases)
- Domain scope (PPC, BSR, Listing only)
- Regression Gate thresholds

---

## Reporting Requirements

After P2 completion, report ONLY:

1. Runner 是否做到 bit-level reproducibility
2. Stub → LLM 输出差异是否不影响 verdict
3. 是否出现 schema 漂移
4. CI 是否成功阻断违规改动

---

**Version**: 1.0.0
**Phase**: P2 (Engineering)
**Next Phase**: P3 (Productization Gate - requires separate approval)
