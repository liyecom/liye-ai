# LiYe OS

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a>
</p>

> **Governance & Architecture Reference Implementation for Claude Code / AI-Collaborative Development**
>
> Turn AI outputs into auditable, replayable, and controllable engineering systems.

[![Version](https://img.shields.io/badge/version-6.3.0-blue.svg)](https://github.com/liyecom/liye_os)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Stability](https://img.shields.io/badge/stability-contract-orange.svg)](docs/architecture/ARCHITECTURE_CONTRACT.md)

---

## What It Is

LiYe OS is a **reference implementation** for building AI-collaborative engineering systems with:

- **World Model Gate**: Forces risk analysis before execution (T1/T2/T3 cognitive pipeline)
- **Architecture Contract**: Defines frozen/stable/experimental boundaries
- **Replay & Audit**: Every decision is traceable and reproducible

**Core Philosophy**: "Not letting blind confidence happen structurally."

---

## Who It's For

**Use LiYe OS if you:**
- Want to build a personal AI operating system with governance
- Need to understand Claude Code + architecture governance best practices
- Want to reuse World Model Gate design patterns for your own systems

**Do NOT use LiYe OS if you:**
- Want an out-of-the-box AI tool (this is a reference, not a product)
- Don't want to understand the architecture before running it
- Expect a GUI interface

---

## Adoption Paths

Choose your path based on what you need:

### Path 1: Blueprint (Copy Structure)

**Goal**: Reuse directory structure and architecture patterns

```
Start here:
├── _meta/docs/ARCHITECTURE_CONSTITUTION.md  # Design principles
├── docs/architecture/                        # Architecture decisions
└── .github/workflows/*gate*                  # CI governance gates
```

### Path 2: Governance Stack (Embed Controls)

**Goal**: Integrate CI gates and contracts into your project

```
Start here:
├── .github/workflows/architecture-gate.yml   # Architecture enforcement
├── .github/workflows/constitution-*-gate.yml # Constitution checks
└── docs/architecture/ARCHITECTURE_CONTRACT.md # Stability contract
```

### Path 3: Minimal Runtime (Run the System)

**Goal**: Actually run LiYe OS with Claude Code

```bash
# Clone the repo
git clone https://github.com/liyecom/liye_os.git
cd liye_os

# Check architecture compliance
node .claude/scripts/guardrail.mjs

# Generate context for a task
node .claude/scripts/assembler.mjs --task "Analyze ASIN B08SVXGTRT"

# Use with Claude Code - just talk naturally:
# "Analyze ASIN B08SVXGTRT"
# Claude Code reads CLAUDE.md and auto-loads relevant context
```

---

## Stability Contract

LiYe OS maintains clear stability boundaries. See [ARCHITECTURE_CONTRACT.md](docs/architecture/ARCHITECTURE_CONTRACT.md) for details.

| Level | Meaning | Examples |
|-------|---------|----------|
| **Frozen** | Immutable, constitutional | `_meta/governance/`, `*gate*` workflows |
| **Stable** | Backward compatible | `docs/architecture/`, `src/kernel/` interfaces |
| **Experimental** | May change | `Agents/`, `Crews/`, `src/kernel/` internals |

---

## Documentation

- **Core (STABLE):** [`docs/README_CORE.md`](docs/README_CORE.md) - Stable kernel specification and quick start

---

## Architecture Overview

```
liye_os/
├── CLAUDE.md                 # Context compiler entry (Claude Code reads this)
├── .claude/packs/            # Domain knowledge packs (on-demand loading)
│
├── src/kernel/               # World Model kernel (T1/T2/T3)
│   ├── t1/                   # Causal reasoning
│   ├── t2/                   # State assessment
│   └── t3/                   # Dynamics projection
│
├── _meta/governance/         # Governance rules (Frozen)
├── .github/workflows/        # CI gates (Frozen: *gate*, Stable: others)
│
├── Agents/                   # Agent definitions (Experimental)
├── Skills/                   # Methodologies and SOPs
└── docs/architecture/        # Architecture documentation (Stable)
```

---

## World Model Gate

The core innovation: **No execution without risk analysis.**

| Layer | Question | Output |
|-------|----------|--------|
| T1 | Where will this fail under pressure? | Causal chains, assumptions exposed |
| T2 | Current dangerous state? | 5D coordinates (liquidity/relevance/expectation/leverage/uncertainty) |
| T3 | How will state evolve? | Shape description (acceleration/amplification/phase transition) |

**Constraint**: Every output must include "What this doesn't tell you..."

---

## For Adopters

If you're using LiYe OS as a reference or dependency:

1. **Register** in [ADOPTERS.md](ADOPTERS.md) (public or anonymous)
2. **Watch** for breaking change notifications
3. **Check** the [stability contract](docs/architecture/ARCHITECTURE_CONTRACT.md) before depending on a component

---

## Version History

| Version | Date | Focus |
|---------|------|-------|
| 6.3.0 | 2026-01-02 | Stability contract, adopter registration |
| 6.2.0 | 2026-01-01 | Phase 5.4 Replay & Regression Gate |
| 6.0.0 | 2025-12-31 | Claude Code native, removed CLI |

---

## License

[Apache License 2.0](LICENSE)

---

## Brand Note

| Context | Name | Note |
|---------|------|------|
| External communication | LiYe AI | Easier to remember |
| Technical documentation | LiYe OS | Maintains rigor |
| GitHub repository | liye_os | Unchanged |

---

*LiYe OS - Making blind confidence structurally impossible.*
