# Release Notes v6.1.2

> **Version**: v6.1.2
> **Release Date**: 2026-01-01
> **Type**: Governance Hardening
> **Base**: v6.1.1-hardening

---

## Summary

v6.1.2 completes the governance hardening cycle by establishing a Single Source of Truth (SSOT) for version management, ensuring all governance scripts read the current version from a canonical file.

---

## Changes

### Governance: Version SSOT

- **`config/version.txt`** is now the authoritative source for LiYe OS current version
- `verify_v6_1.py` reads `current_version` from this file by default
- Version source is disclosed in all output: `source: file:config/version.txt`
- Constitutional Amendment 2026-01-01-C documents this contract

### Governance: Symlink Retirement Enforcement (from v6.1.1)

- Symlink retirement enforcement remains active
- When `current_version >= retire_by`, verify exits with code 1
- OVERDUE symlinks block CI merge

### Testing: Selftest Enhancement

- `selftest_symlink_retire.sh` validates version source disclosure
- 5 test scenarios cover file source, env override, and edge cases

---

## How to Override Version (Testing Only)

For selftest and CI testing scenarios, the version can be overridden:

```bash
# Override with environment variable
LIYE_OS_VERSION=v6.3.0 python tools/audit/verify_v6_1.py

# This will show: source: env:LIYE_OS_VERSION
```

**Note**: Environment override is for testing only. Production always uses `config/version.txt`.

---

## Verification

```bash
# Verify architecture compliance
python tools/audit/verify_v6_1.py

# Run selftest for version SSOT
bash tools/audit/selftest_symlink_retire.sh
```

---

## Files Changed

| File | Change |
|------|--------|
| `config/version.txt` | Created (SSOT for version) |
| `tools/audit/verify_v6_1.py` | Added `load_current_version()` function |
| `tools/audit/selftest_symlink_retire.sh` | Added version source validation |
| `_meta/docs/ARCHITECTURE_CONSTITUTION.md` | Updated to v1.4, Amendment 2026-01-01-C |
| `docs/architecture/RELEASE_v6.1.1_CHECKLIST.md` | Added version SSOT checklist |

---

## Rollback

```bash
# If issues arise, revert to pre-merge state
git checkout ba4e168  # release/v6.1.1-hardening before merge
```

---

## Next Steps

- v6.2.0: Memory Governance (MaaP v1.0)
- v6.3.0: Symlink retirement deadline (all symlinks must be removed)
