# Geo Pipeline Agents

T1-powered agents for verified domains.

## Status

| Agent | Version | Status | Verified Domains |
|-------|---------|--------|------------------|
| T1 Analyst Agent | v0.1.0 | INTERNAL | PPC, BSR Diagnosis, Listing |

---

## T1 Analyst Agent v0.1

### Purpose

First integration of T1 reasoning substrate into agent runtime.

### Scope Constraints

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Domains | PPC, BSR Diagnosis, Listing | Verified Lift domains (Case 01, 03, 04) |
| Agent Type | Analyst | Strategy/Product agents not verified |
| T1 Usage | Hidden context only | T1 is substrate, not source |
| Max T1 Units | 10 | Prevent context overflow |
| External Exposure | PROHIBITED | Pre-productization gate |

### Usage

```python
from agents import create_analyst_agent, AnalystDomain

agent = create_analyst_agent()

# PPC Analysis (verified)
result = agent.analyze(
    domain=AnalystDomain.PPC,
    query="ACoS 从 45% 降到 25% 的策略"
)

# BSR Diagnosis (verified)
result = agent.analyze(
    domain=AnalystDomain.BSR_DIAGNOSIS,
    query="BSR 从 Top 100 跌至 500+ 的根因分析"
)

# Listing Optimization (verified 2025-12-31)
result = agent.analyze(
    domain=AnalystDomain.LISTING,
    query="如何优化 Bullet Points 以提升转化率"
)
```

### Output Requirements

All outputs MUST include the footer:
```
---
*This analysis is powered by internal reasoning substrate.*
```

### What This Agent CANNOT Do

| Action | Status | Reason |
|--------|--------|--------|
| Keyword Research | ❌ BLOCKED | Domain not verified |
| A+ Content Strategy | ❌ BLOCKED | Domain not verified |
| Quote T1 directly | ❌ PROHIBITED | Constitutional constraint |
| Expose T1 IDs | ❌ PROHIBITED | Constitutional constraint |
| External API | ❌ PROHIBITED | Pre-productization gate |

### What This Agent CAN Do (Updated 2025-12-31)

| Action | Status | Verification |
|--------|--------|--------------|
| PPC Analysis | ✅ VERIFIED | Case 01: +4 lift |
| BSR Diagnosis | ✅ VERIFIED | Case 03: +4 lift |
| Listing Optimization | ✅ VERIFIED | Case 04: +7 lift |

---

## Governance

### Pre-Productization Gate

Reference: `docs/CONSTITUTION.md` § 9

This agent was created AFTER Lift verification:
- Experiment: `experiments/reasoning_comparison/`
- Result: LIFT_CONFIRMED for PPC, BSR, and Listing domains
- Gate Status: PASSED (scope expanded 2025-12-31)

### Expansion Path

To add new domains to this agent:
1. Create Lift experiment for new domain
2. Verify Positive Lift (2/4 dimensions)
3. Update `DOMAIN_KEYWORDS` in agent
4. Update this README

---

## References

- `experiments/reasoning_comparison/evaluation_summary.md` - Lift verification
- `docs/architecture/T1_COVERAGE_MAP.md` - Domain coverage
- `docs/architecture/T1_MECHANISM_WHITELIST.md` - Allowed mechanism types
- `docs/architecture/T1_CONSUMPTION_RULES.md` - T1 usage constraints

---

**Version**: 0.1.0
**Created**: 2025-12-31
**Status**: INTERNAL PROTOTYPE
