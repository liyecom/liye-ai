#!/usr/bin/env bash
# install-hooks.sh — One-time setup for LiYe OS local git hooks.
#
# Run this once after cloning liye_os. It points git at the tracked hook
# directory via git's native core.hooksPath (no third-party framework):
#
#     git config core.hooksPath .claude/.githooks
#
# Before this script, the only way to enable the hooks was to type that
# command by hand — this mirrors amazon-growth-engine's ./bin/install-hooks.sh
# so the same muscle memory works across both repos.
#
# These hooks are LOCAL GUARDRAILS, not enforcement:
#   - Bypassable with `git commit --no-verify` (so NOT a security boundary).
#   - Real enforcement lives in CI / server-side checks.
#   - Their job is to catch accidental scope drift / secret leaks BEFORE a
#     push, not to defend against an intentional bypass.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_PATH=".claude/.githooks"

cd "$REPO_ROOT"

if [ ! -f "$HOOKS_PATH/pre-commit" ]; then
  echo "❌ $HOOKS_PATH/pre-commit not found under $REPO_ROOT" >&2
  echo "   Are you running this from a liye_os clone? Aborting." >&2
  exit 1
fi

# Use git's native core.hooksPath (idempotent — safe to re-run).
git config core.hooksPath "$HOOKS_PATH"

# Ensure the hook is executable.
chmod +x "$HOOKS_PATH/pre-commit"

cat <<'EOF'
✓ Git hooks installed via core.hooksPath = .claude/.githooks

  Active hook:
    - pre-commit: guardrail (CLAUDE.md / Pack size limits) + blocks for
      .DS_Store / >10MB files / data files / venv / .env / .env.local /
      .env.production files, a staged
      secret-pattern scan (env / keys), the env-hygiene gate
      (.claude/scripts/env_hygiene_gate.mjs), and the forbidden-name lint
      (tools/lint_forbidden_names.sh).

  ⚠ IMPORTANT: this is a LOCAL guardrail only.
    - Bypassable with `git commit --no-verify` — NOT a security boundary.
    - It does NOT replace code review or CI.

  To verify install:
    git config core.hooksPath        # -> .claude/.githooks

  To uninstall:
    git config --unset core.hooksPath
EOF
