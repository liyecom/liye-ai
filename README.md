# LiYe OS

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">简体中文</a>
</p>

> **An AI-native infrastructure for orchestrating intelligent agents and upgrading how humans and systems work.**

**Implementation**: A governance and architecture reference for Claude Code / AI-collaborative development.
Turn AI outputs into auditable, replayable, and controllable engineering systems.

[![Version](https://img.shields.io/badge/version-6.3.0-blue.svg)](https://github.com/liyecom/liye_os)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)
[![Stability](https://img.shields.io/badge/stability-contract-orange.svg)](docs/architecture/ARCHITECTURE_CONTRACT.md)

---

## Start here (pick one)

Most people don't need the whole repo. Choose the entry that matches your intent:

### 1) 📜 Architecture Contract (stability boundaries)
If you're going to copy anything, copy this first.

→ **Read:** [Architecture Contract](docs/start-here/ARCHITECTURE_CONTRACT.md)

### 2) 🧱 Governance Gates (CI enforcement layer)
If you want "no silent break / no silent relax", start here.

→ **Browse:** [Governance Gates](docs/start-here/GOVERNANCE_GATES.md)

### 3) 🗺️ Blueprint Map (directory structure you can replicate)
If you're here for the structure, use this as a reference blueprint.

→ **Read:** [Blueprint Map](docs/start-here/BLUEPRINT_MAP.md)

---

## 1-Minute Quickstart

```bash
# Clone and explore
git clone https://github.com/liyecom/liye_os.git
cd liye_os

# View architecture overview
cat docs/architecture/DIRECTORY_STRUCTURE.md

# View governance constitution
cat _meta/docs/ARCHITECTURE_CONSTITUTION.md
```

**What you'll find**:
- `CLAUDE.md` - Context compiler entry point for Claude Code
- `src/kernel/` - World Model (T1/T2/T3) for risk analysis
- `_meta/governance/` - Governance rules (Frozen tier)
- `Skills/` - Methodology and SOP library

> **Want to run the system?** See [SKELETON_QUICKSTART.md](docs/quickstart/SKELETON_QUICKSTART.md)

---

## What It Is

LiYe OS is a **reference implementation** for building AI-collaborative engineering systems with:

- **World Model Gate**: Forces risk analysis before execution (T1/T2/T3 cognitive pipeline)
- **Architecture Contract**: Defines frozen/stable/experimental boundaries
- **Replay & Audit**: Every decision is traceable and reproducible

**Core Philosophy**: "Not letting blind confidence happen structurally."

---

## Who It's For

**Core audience**: People who want to upgrade how humans and systems work through AI-native infrastructure.

| Good Fit | Not a Good Fit |
|----------|----------------|
| Building a personal AI operating system with governance | Want an out-of-the-box AI product |
| Learning Claude Code + architecture governance patterns | Prefer GUI-based tools |
| Reusing World Model Gate for risk analysis | Need a turnkey solution without studying architecture |
| Integrating AI agents into existing workflows | Looking for a SaaS platform |

> **This is a reference implementation, not a product.**
> You should expect to read documentation and understand architecture before deriving value.

---

## Roadmap

**Current Focus (Q1 2025)**:
- Notion Enhanced Sync with real-time dashboard
- Skills System v2 with generation pipeline
- World Model Gate maturity

**2026 Vision**: Self-evolving personal operating system where AI agents handle most work.

See full roadmap: [`_meta/EVOLUTION_ROADMAP_2025.md`](_meta/EVOLUTION_ROADMAP_2025.md)

---

## Adoption Paths

Choose your path based on what you need:

### Path 1: Blueprint (Copy Structure)

**Goal**: Reuse directory structure and architecture patterns

Start from:

```text
_meta/docs/ARCHITECTURE_CONSTITUTION.md   # design principles
docs/architecture/                        # architecture decisions
.github/workflows/                        # governance gates (CI)
```

### Path 2: Governance Stack (Embed Controls)

**Goal**: Integrate CI gates and contracts into your project

Start from:

```text
.github/workflows/architecture-gate.yml        # architecture enforcement
.github/workflows/constitution-*-gate.yml      # constitution enforcement
docs/architecture/ARCHITECTURE_CONTRACT.md     # stability contract
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
node .claude/scripts/assembler.mjs --task "Your task description"

# Use with Claude Code - just talk naturally
# Claude Code reads CLAUDE.md and auto-loads relevant context
```

---

## Memory Governance (SSOT)

**LiYe OS is the Single Source of Truth (SSOT) for MAAP (Memory as a Product) governance rules.** Step 5B boundary enforcement ensures no direct claude-mem API access outside `src/runtime/memory/observation-gateway.ts`. See [`scripts/ci/memory-governance-gate.sh`](scripts/ci/memory-governance-gate.sh) for enforcement details.

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

## For adopters (helps us manage breaking-change radius)

If you're using LiYe OS as a blueprint or governance stack (even privately):

- ⭐ **Star the repo** — it helps us estimate downstream adoption and breaking-change radius.
- 🧾 **Register in** [ADOPTERS.md](ADOPTERS.md) (public or anonymous).

Thank you — governance only works when downstream usage is observable.

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

*LiYe OS - AI-native infrastructure for intelligent agent orchestration.*
