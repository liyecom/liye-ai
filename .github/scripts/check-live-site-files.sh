#!/usr/bin/env bash
set -euo pipefail

# Public interface: read changed website paths from stdin.
# Exit 0 when every path is allowed, 1 for policy violations, 2 for matcher/tool failure.
ALLOWLIST_REGEX='^websites/(example-site/|_templates/|\.gitignore$|README\.md$)'
CHANGED=$(cat)

if [ -z "$CHANGED" ]; then
  exit 0
fi

set +e
LIVE_FILES=$(printf '%s\n' "$CHANGED" | grep -Ev "$ALLOWLIST_REGEX")
MATCHER_STATUS=$?
set -e

case "$MATCHER_STATUS" in
  0)
    printf '%s\n' "$LIVE_FILES"
    exit 1
    ;;
  1)
    exit 0
    ;;
  *)
    echo "ERROR: live-site classifier failed (grep exit $MATCHER_STATUS)" >&2
    exit 2
    ;;
esac
