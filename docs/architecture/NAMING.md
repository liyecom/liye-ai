# LiYe AI / LiYe OS Naming Constitution

> **Version**: 3.1 Final
> **Status**: FROZEN
> **Date**: 2025-12-27

---

## 1. Brand vs Technical Naming

| Aspect | Name | Usage |
|--------|------|-------|
| **Brand** | LiYe AI | Website, README, marketing, open source community |
| **Technical Kernel** | LiYe OS | Architecture docs, code comments, technical discussions |
| **Domain** | liye.ai | Website, email |
| **npm Package** | `liye-ai` (primary), `liye-os` (alias) |
| **CLI** | `npx liye-ai` (primary), `npx liye-os` (alias) |
| **GitHub** | `github.com/liye-ai/liye-ai` |

### Relationship
> LiYe AI is the product brand; LiYe OS is its technical kernel codename.

---

## 2. Layer Naming

| Layer | Code Directory | Description |
|-------|---------------|-------------|
| Method | `src/method/` | Declaration layer (WHY) |
| Runtime | `src/runtime/` | Execution layer (HOW) |
| Skill | `src/skill/` | Capability layer (WHAT) |
| Domain | `src/domain/` | Business layer (WHERE) |

---

## 3. Component Naming

### 3.1 Agent Components

| Component | Prefix/Suffix | Example |
|-----------|---------------|---------|
| Persona definition | `.yaml` in `personas/` | `market-analyst.yaml` |
| Skill definition | `.ts` in `atomic/` | `market_research.ts` |
| Domain agent | `.yaml` in `agents/` | `amazon-growth/agents/market-analyst.yaml` |

### 3.2 Skill Naming

| Type | Pattern | Example |
|------|---------|---------|
| Atomic Skill | `snake_case` | `market_research`, `competitor_analysis` |
| Composite Skill | `snake_case` with `_report` suffix | `market_intelligence_report` |

### 3.3 Workflow Naming

| Type | Pattern | Example |
|------|---------|---------|
| Phase workflow | `phase_name.yaml` | `analyze.yaml`, `plan.yaml` |
| Domain workflow | `domain_action.yaml` | `amazon_launch.yaml` |

---

## 4. YAML Field Naming

### 4.1 Legacy (Deprecated)
```yaml
bmaddata:  # ← DO NOT USE
```

### 4.2 Current Standard
```yaml
liyedata:  # ← USE THIS
  module: "domain-name"
  workflow_stage: "Phase: Step N"
```

---

## 5. CLI Command Naming

### 5.1 Engineering Level (CLI)

| Command | Description |
|---------|-------------|
| `npx liye-ai install` | Install the system |
| `npx liye-ai init` | Initialize a project |
| `npx liye-ai agent run <name>` | Run an agent |
| `npx liye-ai skill list` | List available skills |
| `npx liye-ai build` | Build a module |

### 5.2 Session Level (Chat)

| Command | Description |
|---------|-------------|
| `/ly status` | View session status |
| `/ly save` | Save session |
| `/ly agent <name>` | Switch agent |
| `/ly skill <name>` | Invoke skill |
| `/ly workflow <name>` | Run workflow |

---

## 6. File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| YAML files | `kebab-case.yaml` | `market-analyst.yaml` |
| TypeScript files | `snake_case.ts` or `kebab-case.ts` | `market_research.ts` |
| Documentation | `UPPER_CASE.md` for constitutions | `ARCHITECTURE.md` |
| Configuration | `config.yaml` or `.liye/` | `.liye/config.yaml` |

---

## 7. Directory Naming

| Directory | Convention | Example |
|-----------|------------|---------|
| Layer directories | lowercase | `method/`, `runtime/` |
| Sub-directories | lowercase | `personas/`, `workflows/` |
| Domain directories | `kebab-case` | `amazon-growth/`, `medical-research/` |

---

## 8. Reserved Prefixes

| Prefix | Reserved For |
|--------|--------------|
| `ly-` | Official LiYe components |
| `liye-` | npm packages |
| `/ly` | Chat commands |
| `.liye/` | Runtime configuration |

---

## 9. Deprecated Names (Do Not Use)

| Deprecated | Replacement |
|------------|-------------|
| `bmad` | `liye` |
| `bmaddata` | `liyedata` |
| `bmad-method` | `liye-ai` |
| `LiYe OS` (alone) | `LiYe AI` (brand) or `LiYe OS` (kernel) |

---

## 10. npm Package Configuration

```json
{
  "name": "liye-ai",
  "bin": {
    "liye-ai": "./cli/index.js",
    "liye-os": "./cli/index.js"
  }
}
```

---

**This document is FROZEN as of v3.1 Final (2025-12-27).**
