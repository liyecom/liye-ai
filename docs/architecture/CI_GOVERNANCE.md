# CI Governance Policy

> **Version**: 1.0
> **Date**: 2025-12-28
> **Status**: ACTIVE

---

## 1. Core Principle: Build vs Governance

```
┌─────────────────────────────────────────────────────────────┐
│                    CI Pipeline                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────┐      ┌─────────────────┐             │
│   │     BUILD       │      │   GOVERNANCE    │             │
│   │                 │      │                 │             │
│   │  - Lint         │      │  - Constitution │             │
│   │  - Test         │      │  - Architecture │             │
│   │  - Compile      │      │  - Boundary     │             │
│   │                 │      │                 │             │
│   │  "Does it run?" │      │  "Should it     │             │
│   │                 │      │   exist?"       │             │
│   └─────────────────┘      └─────────────────┘             │
│                                                             │
│   continue-on-error:       NEVER skip.                     │
│   allowed for debug        Block merge on fail.            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 Build Jobs

| Job | Purpose | On Failure |
|-----|---------|------------|
| Lint | Code style check | Warning allowed |
| Test | Functionality verification | Block merge |
| Compile | Build artifact | Block merge |

**Characteristic**: Tests "Does the code work?"

### 1.2 Governance Jobs

| Job | Purpose | On Failure |
|-----|---------|------------|
| Constitution Gate | External tools boundary | **BLOCK MERGE** |
| Architecture Gate | Layer dependency rules | **BLOCK MERGE** |

**Characteristic**: Tests "Should this code exist in this location?"

---

## 2. Governance Failure = Block Merge

```yaml
# Governance gates are NEVER skippable
governance-gate:
  # ❌ FORBIDDEN:
  # continue-on-error: true

  # ❌ FORBIDDEN:
  # if: ${{ !contains(github.event.pull_request.labels.*.name, 'skip-governance') }}

  # ✅ REQUIRED:
  # Always runs, always blocks on failure
```

### 2.1 Why No Skip?

| Reason | Explanation |
|--------|-------------|
| **Architectural Debt** | Skipping creates invisible debt that compounds |
| **Precedent** | One skip leads to "just one more skip" |
| **Audit Trail** | Clean governance = clean history |

### 2.2 Governance = Law Enforcement

> **"Governance gates don't test code quality. They enforce architectural law."**

A governance failure is not a bug to fix. It's a design violation to reconsider.

---

## 3. Emergency Bypass Protocol

### 3.1 There Is No Runtime Bypass

```
┌─────────────────────────────────────────────────────────────┐
│  EMERGENCY BYPASS PROTOCOL                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Q: How do I bypass governance in an emergency?             │
│                                                             │
│  A: You don't bypass governance.                            │
│     You AMEND THE CONSTITUTION.                             │
│                                                             │
│  Process:                                                   │
│  1. Create PR that modifies docs/architecture/*.md          │
│  2. Document why the rule needs to change                   │
│  3. Get approval from governance owner                      │
│  4. Merge constitution change FIRST                         │
│  5. Then merge your code change                             │
│                                                             │
│  This is not bureaucracy. This is anti-fragility.           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Why Amendment Over Bypass?

| Approach | Problem |
|----------|---------|
| **Skip label** | Creates invisible exceptions, no audit trail |
| **Admin override** | Centralizes power, creates single point of failure |
| **Timeout bypass** | Rewards waiting, punishes diligence |
| **Amendment** | Forces explicit reasoning, creates permanent record |

### 3.3 Amendment Template

When proposing a governance rule change:

```markdown
## Proposed Amendment

**Current Rule**: [Quote the current rule]

**Proposed Change**: [Describe the new rule]

**Justification**: [Why is this change necessary?]

**Impact Assessment**:
- [ ] Reviewed affected code paths
- [ ] No security implications
- [ ] Backward compatible (or migration plan provided)

**Sunset Clause** (optional): [Does this exception expire?]
```

---

## 4. Governance Stack

### 4.1 Current Gates

| Gate | Repository | Version | Scope |
|------|------------|---------|-------|
| Constitution Gate | `liyecom/constitution-gate` | v1 | External tools boundary |
| Architecture Gate | (inline) | - | Layer dependencies |

### 4.2 Future Gates (Planned)

| Gate | Purpose | Status |
|------|---------|--------|
| Naming Gate | Enforce naming conventions | Planned |
| Domain Gate | Prevent cross-domain coupling | Planned |
| Security Gate | Secret detection, vulnerability scan | Planned |

---

## 5. Implementation Rules

### 5.1 Workflow Requirements

```yaml
# Every governance workflow MUST:
governance-gate:
  runs-on: ubuntu-latest

  # 1. Run on both push and PR
  on:
    pull_request:
      branches: [ main ]
    push:
      branches: [ main ]

  # 2. Never use continue-on-error
  # 3. Never use conditional skip
  # 4. Exit 1 on any violation
```

### 5.2 Reusable Action Requirements

```yaml
# Every governance action MUST:
- name: Governance Gate
  uses: liyecom/constitution-gate/.github/actions/XXX@vN
  # 1. Be version-tagged (never @main)
  # 2. Have clear failure messages
  # 3. Reference documentation in output
```

---

## 6. Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Main architecture constitution
- [EXTERNAL_TOOLS_POLICY.md](./EXTERNAL_TOOLS_POLICY.md) - External tools usage rules
- [NON_FORK_STATEMENT.md](./NON_FORK_STATEMENT.md) - Code origin declaration

---

## 7. Governance Owners

| Gate | Owner | Contact |
|------|-------|---------|
| Constitution Gate | LiYe OS Core Team | - |
| Architecture Gate | LiYe OS Core Team | - |

---

**Document Version**: 1.0
**Last Updated**: 2025-12-28
