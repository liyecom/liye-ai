# BMAD Boundary Leaks Index

**Incident**: bmad-boundary CI gate failure
**Date**: 2025-12-30
**Total Violations**: 13
**Status**: Fixing

---

## Classification Definitions

| Type | Name | Pattern |
|------|------|---------|
| **A** | Role Identity Leakage | Agent declares "BMAD architect/analyst/planner" identity |
| **B** | Design-Time Vocabulary Leakage | "from BMad Method", "design decision", "meta step" |
| **C** | Method Dependency Leakage | Runtime depends on BMAD workflow/URI/phase |
| **D** | Metadata Contamination | `bmaddata:` field in agent config |

---

## Leak Registry (13 total)

### Type A - Role Identity Leakage (2)

| # | File | Line | Content | Fix |
|---|------|------|---------|-----|
| 1 | `Agents/amazon-growth/sprint-orchestrator.yaml` | 4 | `title: 3-Day Sprint Orchestration Master (BMAD Integrated)` | Remove "(BMAD Integrated)" |
| 2 | `Agents/amazon-growth/sprint-orchestrator.yaml` | 11 | `role: BMad Master / Scrum Orchestrator` | Change to "Sprint Orchestrator" |

### Type B - Design-Time Vocabulary Leakage (2)

| # | File | Line | Content | Fix |
|---|------|------|---------|-----|
| 3 | `Agents/_template.yaml` | 11 | `# Persona Layer (WHO) - from BMad Method` | Remove "- from BMad Method" |
| 4 | `Agents/README.md` | 33 | `persona:           # WHO - from BMad Method` | Remove "- from BMad Method" |

### Type C - Method Dependency Leakage (1)

| # | File | Line | Content | Fix |
|---|------|------|---------|-----|
| 5 | `Agents/amazon-growth/sprint-orchestrator.yaml` | 77 | `- uri: file://~/.npm/_npx/.../bmad-method/` | Remove entire URI reference |

### Type D - Metadata Contamination (8)

| # | File | Line | Content | Fix |
|---|------|------|---------|-----|
| 6 | `Agents/amazon-growth/market-analyst.yaml` | 64 | `bmaddata:` | Remove entire bmaddata block |
| 7 | `Agents/amazon-growth/quality-gate.yaml` | 44 | `bmaddata:` | Remove entire bmaddata block |
| 8 | `Agents/amazon-growth/execution-agent.yaml` | 57 | `bmaddata:` | Remove entire bmaddata block |
| 9 | `Agents/amazon-growth/keyword-architect.yaml` | 67 | `bmaddata:` | Remove entire bmaddata block |
| 10 | `Agents/amazon-growth/review-sentinel.yaml` | 50 | `bmaddata:` | Remove entire bmaddata block |
| 11 | `Agents/amazon-growth/ppc-strategist.yaml` | 65 | `bmaddata:` | Remove entire bmaddata block |
| 12 | `Agents/amazon-growth/sprint-orchestrator.yaml` | 30 | `bmaddata:` | Remove entire bmaddata block |
| 13 | `Agents/amazon-growth/listing-optimizer.yaml` | 59 | `bmaddata:` | Remove entire bmaddata block |

---

## Fix Strategy

### Batch 1: Type D - Remove all `bmaddata:` blocks (8 files)
- Mechanical removal of entire bmaddata section
- No content migration needed (metadata only)

### Batch 2: Type A - Dehydrate role identity (1 file)
- sprint-orchestrator.yaml: Remove BMAD from title and role

### Batch 3: Type B - Remove vocabulary references (2 files)
- _template.yaml: Clean comment
- README.md: Clean example

### Batch 4: Type C - Remove method dependency (1 file)
- sprint-orchestrator.yaml: Remove bmad-method URI from knowledge_sources

---

## Dehydration Principle

```
DESIGN produces STRUCTURE.
RUNTIME executes STRUCTURE.
METHOD must never execute itself.
```

---

*Generated: 2025-12-30*
