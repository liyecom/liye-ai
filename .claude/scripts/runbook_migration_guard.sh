#!/usr/bin/env bash
set -euo pipefail

# Runbook Migration Guard: Ensures domain-related PRs reference the migration playbook.
# Used by CI gates to enforce governance compliance.

# Only enforce when PR changes touch domain-related paths
if ! git diff --name-only origin/main...HEAD 2>/dev/null | grep -qE '(^src/domain/|^Agents/|^Crews/|^docs/runbook/)'; then
  echo "Runbook Guard: skip (no domain-related changes)"
  exit 0
fi

# Require PR body (if available) or commit message to reference the playbook
# Fallback: require a marker file added/updated in docs/runbook/
if git log -1 --pretty=%B | grep -qE 'DOMAIN_MIGRATION_PLAYBOOK|Domain Migration Playbook|迁移回放|runbook'; then
  echo "Runbook Guard: PASS (commit references playbook)"
  exit 0
fi

if git diff --name-only origin/main...HEAD 2>/dev/null | grep -qE '^docs/runbook/DOMAIN_MIGRATION_PLAYBOOK\.md'; then
  echo "Runbook Guard: PASS (playbook updated in this PR)"
  exit 0
fi

echo "Runbook Guard: FAIL"
echo "Domain-related change detected but no reference to docs/runbook/DOMAIN_MIGRATION_PLAYBOOK.md"
exit 1
