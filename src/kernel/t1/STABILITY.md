# T1 Kernel Stability Declaration

**Level**: v2_frozen
**Effective Date**: 2025-12-31
**Policy**: IMMUTABLE - No behavior change without new domain verdict

---

## What v2_frozen Means

### This Kernel is a Reference Standard

v2_frozen is stronger than v1_stable:
- v1_stable = "API won't change without notice"
- v2_frozen = "This IS the standard. Changes require new evidence."

### Frozen Scopes

| Scope | Status | Meaning |
|-------|--------|---------|
| always_on | FROZEN | T1_liquidity_illusion cannot be removed or modified |
| api | FROZEN | Three exports are the complete interface |
| governance | FROZEN | Rules cannot be relaxed |
| contextual | CONFIGURABLE | Plugins can be added (not removed) |

---

## The Irreducible Core

```yaml
T1_liquidity_illusion:
  status: IRREDUCIBLE
  meaning: "The world fails at peak need"
  token_cost: 200
  cross_domain_lift: 58%
  evidence: 8 cases across 3 domains
```

This primitive is the **minimal viable kernel**. Everything else is context amplification.

---

## Modification Rules

### To Modify Always-On (Essentially Impossible)

1. Conduct controlled experiments in 3+ NEW domains
2. Demonstrate that modification improves aggregate lift
3. Document failure modes of current primitive
4. Obtain Architecture Team + Domain Owner consensus
5. 90-day deprecation notice

**Note**: This has never happened. It is designed to be nearly impossible.

### To Add Contextual Plugin

1. Conduct ablation in 2+ domains
2. Demonstrate positive marginal lift
3. Define trigger conditions
4. Submit for review

**Note**: Adding is allowed. Removing existing plugins is not.

### To Modify API

1. All rules for Always-On modification, plus:
2. Backward compatibility layer for 180 days
3. Migration guide for all domains
4. Explicit approval from all domain owners

---

## Rollback Policy

**Rollback is not allowed.**

v2.0.0 is a one-way transition. The reasoning:
- v1.1.0 had 2 always-on primitives (400 tokens)
- v2.0.0 has 1 always-on primitive (200 tokens)
- Token efficiency is a permanent architectural improvement
- Rollback would re-introduce redundancy

If issues are discovered:
1. Fix forward (add compensating logic)
2. Document in traces/kernel/incidents/
3. Do NOT rollback to v1.x

---

## SLA (Service Level Agreement)

| Metric | Target | v1.1.0 | v2.0.0 |
|--------|--------|--------|--------|
| API Availability | 99.9% | 99.9% | 99.9% |
| Latency (p95) | < 200ms | 180ms | 120ms |
| Budget Compliance | 100% | 62.5% used | 57.5% used |
| Breaking Changes | 0 per quarter | 0 | N/A (frozen) |
| Always-On Token Cost | ≤ 400 | 400 | 200 |

---

## Version History

| Version | Date | Change | Reversible |
|---------|------|--------|------------|
| 1.0.0 | 2025-12-30 | Initial kernel | Yes |
| 1.1.0 | 2025-12-31 | Post-ablation ranking | Yes |
| **2.0.0** | **2025-12-31** | **Minimal skeleton + plugin mode** | **NO** |

---

## Governance Inheritance

Any system using T1_REASONING_KERNEL inherits:
1. The axiom: "The world fails at peak need"
2. The always-on primitive: T1_liquidity_illusion
3. The three API exports
4. The governance rules

Domains CANNOT:
- Disable always-on
- Modify API behavior
- Bypass governance

Domains CAN:
- Configure contextual triggers
- Add domain-specific signals
- Extend (not modify) the kernel

---

## Reference Standard Notice

```
┌─────────────────────────────────────────────────────────────┐
│  T1_REASONING_KERNEL v2.0.0                                 │
│  Status: REFERENCE STANDARD                                 │
│  Policy: IMMUTABLE                                          │
│                                                             │
│  This kernel defines what                                   │
│  "robust reasoning under uncertainty"                       │
│  means for high-stakes inference.                           │
│                                                             │
│  Anyone building such systems                               │
│  should address the T1 problem first.                       │
└─────────────────────────────────────────────────────────────┘
```

---

*Stability Level: v2_frozen*
*Declared: 2025-12-31*
*Owner: Architecture Team*
*Policy: No behavior change without new domain verdict*
