# Language Architecture Status

> **Status**: FROZEN (Steady State)
> **Tag**: `phase-1-3-language-architecture-frozen`
> **Frozen Date**: 2026-01-02
> **Next Phase**: None scheduled

---

## Current Architecture State

### System Locale Configuration

| Property | Value | Notes |
|----------|-------|-------|
| **System Locale (SSOT)** | `en-US` | Hardcoded, non-negotiable |
| **User Display Locale** | Configurable | Default: `zh-CN` |
| **Locale Priority** | CLI > File > Env > Config | 4-tier resolution |

### Authoritative Sources

| Component | Language | Location |
|-----------|----------|----------|
| CLAUDE.md (Kernel) | English | `/CLAUDE.md` |
| Packs (4 files) | English | `.claude/packs/*.md` |
| Glossary (5 files, 57 concepts) | English | `knowledge/glossary/*.yaml` |
| i18n Config | English | `i18n/config.yaml` |

### Display Layer (Optional)

| Component | Language | Location |
|-----------|----------|----------|
| Chinese Display Files | Chinese | `i18n/display/zh-CN/` |
| Glossary i18n Blocks | Chinese | `*.yaml` → `i18n.zh-CN` |

---

## Phase Completion Status

### Phase 1: Language Authority (COMPLETED)

- [x] CLAUDE.md migrated to English SSOT
- [x] 4 Packs migrated to English SSOT
- [x] i18n config.yaml created
- [x] i18n-gate.yml CI workflow added
- [x] validate.mjs validation script created

### Phase 2: Domain Semantics (COMPLETED)

- [x] Glossary schema defined (`_schema.yaml`)
- [x] 5 glossary files migrated (57 concepts total)
  - amazon-advertising.yaml (7 concepts)
  - general.yaml (5 concepts)
  - geo-os.yaml (6 concepts)
  - geo-seo.yaml (32 concepts)
  - medical-research.yaml (7 concepts)
- [x] Chinese definitions moved to `i18n.zh-CN` blocks
- [x] Glossary validation added to i18n-gate

### Phase 3: Expression Layer (COMPLETED)

- [x] `getUserLocale()` with 4-tier priority
- [x] `SYSTEM_LOCALE = "en-US"` hardcoded (architecture red line)
- [x] i18n metadata header injection to compiled context
- [x] `.claude-locale.example` configuration template
- [x] Output language policy documentation

### Phase 4: Display Layer Refinement (NOT SCHEDULED)

- [ ] Dynamic translation loading
- [ ] User-facing message catalogs
- [ ] Error message localization

**Decision**: Phase 4 is deferred indefinitely. No product decision to proceed.

---

## Freeze Rules (Effective Immediately)

### Prohibited Actions

- Adding new Display Layer translation tasks
- Introducing `messages.yaml` / `errors.yaml` in new languages
- Forcing translation of analysis or reasoning output
- Modifying locale behavior without ADR

### Permitted Actions

- English SSOT content maintenance
- Glossary English definition updates (must pass validation)
- Non-language-related feature development
- Bug fixes in existing i18n infrastructure

### Change Control

Any requirement involving **language behavior change** must:

1. Open a new Architecture Decision Record (ADR)
2. Undergo architecture review
3. NOT proceed directly to implementation

---

## Validation Commands

```bash
# Full i18n validation
node i18n/scripts/validate.mjs

# Glossary-only validation
node i18n/scripts/validate.mjs --glossary-only

# SSOT-only validation
node i18n/scripts/validate.mjs --ssot-only

# Verbose output
node i18n/scripts/validate.mjs --verbose
```

---

## Architecture Invariants

1. **English is Authoritative**: All system semantics, policies, and contracts are defined in English
2. **Locale ≠ Logic**: User locale preference affects only output expression, never reasoning or decisions
3. **SSOT Non-Negotiable**: `SYSTEM_LOCALE = "en-US"` cannot be overridden by configuration
4. **Semantic Invariance**: Same input produces same governance decision regardless of display language

---

## Related Documents

- Architecture Constitution: `_meta/docs/ARCHITECTURE_CONSTITUTION.md`
- i18n Configuration: `i18n/config.yaml`
- Glossary Schema: `knowledge/glossary/_schema.yaml`
- Locale Example: `.claude-locale.example`

---

**Version**: 1.0
**Author**: Claude + LiYe
**Last Updated**: 2026-01-02
