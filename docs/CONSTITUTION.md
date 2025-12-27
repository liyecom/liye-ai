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

**Final Rule:**
> If it feels wrong, it does not belong here.
