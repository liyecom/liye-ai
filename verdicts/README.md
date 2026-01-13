# Verdicts (Decision Semantics)

This directory contains **human-readable semantics** for machine verdicts.

## Purpose

- Explain what a machine verdict means in business terms
- Support auditing, replay, and user-facing explanations
- Provide consistent language for decision interpretation

## Non-goals

- This directory does NOT define rules or constraints
- This directory is NOT consumed by CI, validators, or builders
- This directory does NOT generate decisions

## Important

- Governance / hard constraints live in `_meta/contracts/`
- Do NOT treat files here as executable rules

## Mental Model

```
_meta/contracts/  → "Can the system do this?" (governance)
verdicts/         → "What does the system's decision mean?" (semantics)
```

## Structure

```
verdicts/
├── <domain>/
│   ├── README.md           # Domain-specific context
│   └── contracts.yaml      # Decision definitions
└── schema/
    └── decision.schema.json  # Canonical schema
```

## See Also

- [Governance Contracts](_meta/contracts/README.md)
- [Architecture Constitution](_meta/docs/ARCHITECTURE_CONSTITUTION.md)
