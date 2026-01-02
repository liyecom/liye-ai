# LiYe AI — Project Constitution

## 0. Preamble（存在理由）

LiYe AI is an AI-native infrastructure project.

It exists to orchestrate intelligent agents and to upgrade how humans and systems work together over time.
It is not a product, not a framework demo, and not a personal workspace.

LiYe AI prioritizes long-term evolvability, system correctness, and governance clarity over short-term convenience.

---

## 1. Project Identity（项目身份）

LiYe AI is defined as:

- An infrastructure-level project
- AI-native, not AI-assisted
- Agent-centric, not tool-centric
- Designed for long-term evolution, not rapid feature churn

Once something enters this repository, it is assumed to be:
- Public
- Inspectable
- Potentially depended upon by others

---

## 2. Scope & Non-Goals（范围与非目标）

### 2.1 In Scope（属于本项目）
- Agent models and abstractions
- Orchestration, coordination, and execution primitives
- Memory, state, and context management systems
- System-level governance documents
- Reusable infra tooling

### 2.2 Explicit Non-Goals（明确不做）
- End-user applications
- Demos, examples, or playgrounds
- Product-specific implementations
- Marketing, branding, or website code

---

## 3. Public / Private Boundary（资产边界）

### Core Principle
Public Infrastructure ≠ Personal Workspace

### Forbidden Content
- ChatGPT / Claude logs
- Personal planning documents
- Domain, business, or strategy materials
- Websites, blogs, landing pages

Patterns:
```
websites/
*域名整理*
*chatgpt对话*
*ChatGPT*
```

---

## 4. Repository Governance（仓库治理）

- System-level content only
- Split repos over boundary erosion
- Main branch is canonical

---

## 5. Versioning & History Policy（版本与历史）

- Tags are contracts
- No history rewriting by default
- Exceptions only for security or legal reasons

---

## 6. Automation & Agents Policy（自动化与智能体规则）

- AI assists, humans decide
- No autonomous scope expansion
- No autonomous history rewriting

---

## 7. Decision-Making Rule（决策规则）

- P0: integrity & boundary
- P1: infra correctness
- P2: enhancements

---

## 8. Amendment Rule（宪法修改）

- Explicit intent required
- Amendments must be documented

---

## 9. Reasoning Substrate Governance（推理基底治理）

### 9.1 Pre-Productization Gate

**Canonical Statement:**
> No reasoning substrate may be exposed before lift is demonstrated.

This governance rule applies to any T1 (Tier-1) knowledge system that claims to provide reasoning enhancement.

### 9.2 Prohibited Before Lift Verification

The following activities are **BLOCKED** until Reasoning Lift is experimentally demonstrated:

| Activity | Rationale |
|----------|-----------|
| External API exposure | Cannot promise value without proof |
| Agent productization | Core hypothesis unvalidated |
| T1 capability claims | May be false advertising |
| T1 unit count promotion | Quantity ≠ Quality |

### 9.3 Lift Verification Process

Reference: `docs/architecture/REASONING_LIFT_CRITERIA.md`

Required evidence:
1. Controlled experiment with baseline vs T1-enabled conditions
2. Positive Lift on at least 2 of 4 evaluation dimensions
3. No increase in Hallucination Risk

### 9.4 Rationale

If T1 units do not demonstrably improve reasoning quality beyond baseline LLM performance, then:
- The entire reasoning substrate premise collapses
- Productization would be premature and misleading
- Resources should be redirected to T1 quality improvement

This guardrail ensures the project remains scientifically grounded and avoids the common trap of optimizing distribution before validating core value.

---

## 10. Lift Regression Protection（Lift 回归保护）

### 10.1 Regression Prevention Gate

**Canonical Statement:**
> Any modification to T1 units that causes verified POSITIVE_LIFT to regress requires explicit justification and human approval.

This governance rule protects the validated reasoning lift from unintended degradation.

### 10.2 Mandatory Regression Check

The following changes **MUST** pass the Lift Regression Gate before merge:

| Change Type | Gate Required |
|-------------|---------------|
| T1 unit modification | ✅ YES |
| T1 unit deletion | ✅ YES |
| Agent logic change | ✅ YES |
| Lift criteria modification | ✅ YES |

Reference: `scripts/lift_regression_gate.py`

### 10.3 Regression Response Protocol

When a PR causes Lift regression (detected by CI):

1. **Automatic Block**: PR cannot be merged
2. **Required Documentation**:
   - Root cause analysis
   - Alternative mechanism proposal (if applicable)
   - Explicit acceptance of regression (if intentional)
3. **Human Review**: Merge requires explicit human approval

### 10.4 Repro Pack Governance

Locked cases in `experiments/repro_pack_v1/` are protected baselines:

| Constraint | Enforcement |
|------------|-------------|
| `locked: true` cases immutable | CI-enforced |
| Verdict regression blocked | CI-enforced |
| Lift drop ≥ 2 blocked | CI-enforced |
| Blacklist mechanism usage blocked | CI-enforced |

### 10.5 Rationale

Validated Lift represents proven engineering capability. Allowing uncontrolled modifications risks:
- Losing demonstrated reasoning improvement
- Accumulating technical debt
- Undermining trust in T1 system

This guardrail ensures reproducibility is protected as a first-class concern.

Reference: `docs/architecture/P0_5_LIFT_REPRODUCTION.md`

---

## 11. World Model Stack（世界模型栈）

**Status**: FROZEN
**Effective Date**: 2025-12-31

### 11.1 Stack Definition

```
T1: Causal Skeleton (what fails under stress)
T2: World State (what is true now)
T3: World Dynamics (how states evolve under pressure)
```

### 11.2 Invariants (Immutable)

The World Model Stack operates under the following absolute constraints:

| Invariant | Meaning |
|-----------|---------|
| No Prediction | World Model describes states, not outcomes |
| No Recommendation | World Model informs, does not advise |
| No Optimization Target | World Model is not a loss function |

### 11.3 Layer Responsibilities

| Layer | Kernel | Question Answered |
|-------|--------|-------------------|
| T1 | T1_REASONING_KERNEL | "Where will the world fail under stress?" |
| T2 | T2_WORLD_STATE_KERNEL | "What dangerous state is the world in now?" |
| T3 | T3_WORLD_DYNAMICS_KERNEL | "How might this state evolve under pressure?" |

### 11.4 Boundary Enforcement

The World Model is **cognitive infrastructure**, not a decision engine.

Any output that contains:
- Probability of specific outcome
- Recommended action
- Optimization suggestion

Is a **governance violation** and must be blocked.

### 11.5 Rationale

The purpose of the World Model is to make **blind confidence structurally impossible**.

It does not tell anyone what to do.
It ensures that anyone making a decision cannot ignore what the world actually is.

---

**Final Rule:**
> If it feels wrong, it does not belong here.
