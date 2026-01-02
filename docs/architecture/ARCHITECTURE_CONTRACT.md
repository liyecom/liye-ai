# LiYe OS Architecture Contract

> **Version**: 1.0
> **Effective Date**: 2026-01-02
> **Status**: Active

---

## Purpose

This document defines the stability contract for LiYe OS. It establishes clear boundaries between **Frozen**, **Stable**, and **Experimental** components, enabling adopters to make informed decisions about what they can safely depend on.

---

## Definitions

### Stability Levels

| Level | Meaning | Change Policy |
|-------|---------|---------------|
| **Frozen** | Immutable. Will not change without major version bump. | Requires RFC + 30-day notice + migration guide |
| **Stable** | Backward compatible. May add features, will not break existing behavior. | Requires 14-day notice in CHANGELOG |
| **Experimental** | May change at any time. Use at your own risk. | No notice required |

### Breaking Change

A change is considered **breaking** if it:
1. Removes or renames a public interface
2. Changes the behavior of an existing interface in a way that breaks existing usage
3. Modifies governance rules that would cause previously passing checks to fail
4. Alters the directory structure of Frozen/Stable components

---

## Stability Map

### Frozen (Immutable)

| Path | Description |
|------|-------------|
| `_meta/governance/` | Governance rules and policies |
| `.github/workflows/*governance*` | Governance gate workflows |
| `.github/workflows/*gate*` | Architecture gate workflows |
| `.github/workflows/*guard*` | Guard workflows |
| `docs/architecture/ARCHITECTURE_CONSTITUTION.md` | Architecture constitution |
| `docs/architecture/ARCHITECTURE_CONTRACT.md` | This contract |

**Rationale**: These components define the "constitutional" layer of LiYe OS. Changing them would break the trust relationship with adopters who depend on these guarantees.

### Stable (Backward Compatible)

| Path | Description |
|------|-------------|
| `.github/workflows/` (other: build/test/lint) | CI workflows (non-governance) |
| `docs/architecture/` (other documents) | Architecture documentation |
| `src/kernel/` (interfaces/contracts) | Kernel public interfaces |
| `CLAUDE.md` | Context compiler entry point |
| `.claude/packs/` | Pack system |
| `Skills/` | Skill library structure |

**Rationale**: These components may evolve but will maintain backward compatibility. Adopters can depend on their behavior.

### Experimental (May Change)

| Path | Description |
|------|-------------|
| `src/kernel/` (internal implementation) | Kernel internals |
| `Agents/` | Agent definitions |
| `Crews/` | Crew configurations |
| `Systems/` | System implementations |
| `src/domain/` | Domain-specific code |

**Rationale**: These components are actively evolving. Adopters should expect changes and avoid tight coupling.

---

## Version Strategy

### Current Phase: `0.y.z` (Rapid Iteration)

| Version Component | Meaning |
|-------------------|---------|
| `0.y.z` → `0.(y+1).0` | May contain breaking changes to Experimental components |
| `0.y.z` → `0.y.(z+1)` | Backward compatible, bug fixes only |

### Future Phase: `1.0.0+` (Stable Release)

Once LiYe OS reaches `1.0.0`:
- **Major** (`x.0.0`): May contain breaking changes to Stable components
- **Minor** (`x.y.0`): Backward compatible new features
- **Patch** (`x.y.z`): Bug fixes only

---

## Change Notification Process

### For Frozen Components

1. **RFC Required**: Submit an RFC (Request for Comments) explaining the need
2. **30-Day Notice**: Announce in CHANGELOG and GitHub Discussions
3. **Migration Guide**: Provide step-by-step migration instructions
4. **Major Version Bump**: Increment major version number

### For Stable Components

1. **14-Day Notice**: Announce in CHANGELOG
2. **Deprecation Period**: Mark old behavior as deprecated before removal
3. **Minor Version Bump**: Increment minor version number

### For Experimental Components

No formal notice required, but best practice is to document changes in commit messages.

---

## Governance Change Protocol

Any change to a Frozen governance component **MUST**:

1. **PR Label**: Include `governance-change` label
2. **PR Title**: Prefix with `[GOVERNANCE]`
3. **PR Notes**: Explain why the change is necessary
4. **Review**: Require explicit approval from maintainers

Example:
```
PR Title: [GOVERNANCE] Update architecture gate to include new domain
PR Label: governance-change
```

---

## Adopter Commitments

By adopting LiYe OS, you can expect:

1. **Frozen components will not change** without major version bump and 30-day notice
2. **Stable components will remain backward compatible** within minor versions
3. **Breaking changes will be documented** in CHANGELOG with migration guides
4. **Deprecation warnings** will be provided before removal

---

## Questions?

If you're unsure about the stability of a component:
1. Check this contract first
2. Open a GitHub Discussion if unclear
3. Register in [ADOPTERS.md](../../ADOPTERS.md) to receive change notifications

---

*This contract is itself Frozen. Any changes require the governance change protocol above.*
