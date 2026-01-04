#!/usr/bin/env bash
set -euo pipefail

# Governance Index Guard: Ensures INDEX.md contains required governance entries.
# Used by CI gates to prevent accidental deletion of key policy references.

idx="docs/governance/INDEX.md"
test -f "$idx" || (echo "FAIL: Governance INDEX.md missing"; exit 1)

grep -q "PUBLIC_BOUNDARY.md" "$idx" || (echo "FAIL: INDEX missing PUBLIC_BOUNDARY.md"; exit 1)
grep -q "DOMAIN_MIGRATION_PLAYBOOK.md" "$idx" || (echo "FAIL: INDEX missing DOMAIN_MIGRATION_PLAYBOOK.md"; exit 1)

echo "PASS: Governance INDEX contains required entries"
