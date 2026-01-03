#!/bin/bash
# =============================================================================
# Checkpoint Freeze Verification Script
# =============================================================================
# Checkpoint freeze enforces responsibility, not correctness.
#
# Purpose: Verify that frozen files are not modified without explicit unfreeze
#
# Frozen files (from checkpoint.yaml):
#   - Track Spec (decision layer)
#   - Glossary (semantic truth layer)
#
# NOT frozen:
#   - plan (execution layer)
#   - workflow (runtime layer)
#   - experience (observation layer)
#
# Exit codes:
#   0 = All frozen files unchanged OR valid unfreeze declarations exist
#   1 = Frozen file modified without unfreeze declaration
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UNFREEZE_DIR="$REPO_ROOT/docs/governance/unfreeze"

echo "============================================================================="
echo "              CHECKPOINT FREEZE VERIFICATION"
echo "============================================================================="
echo ""

# =============================================================================
# Step 1: Get changed files
# =============================================================================
echo "[1/4] Getting changed files..."

# Handle both PR and push scenarios
if [ -n "${GITHUB_BASE_REF:-}" ]; then
    # Pull request - compare to base branch
    BASE="origin/$GITHUB_BASE_REF"
elif [ -n "${GITHUB_EVENT_NAME:-}" ] && [ "$GITHUB_EVENT_NAME" = "push" ]; then
    # Push to main - compare to previous commit
    BASE="HEAD~1"
else
    # Local run - compare to main
    BASE="origin/main"
fi

# Get list of changed files
CHANGED_FILES=$(git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only "$BASE" HEAD 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
    echo "   No files changed. PASS."
    exit 0
fi

echo "   Changed files:"
echo "$CHANGED_FILES" | while read -r file; do
    echo "   - $file"
done
echo ""

# =============================================================================
# Step 2: Find all checkpoint.yaml files
# =============================================================================
echo "[2/4] Finding checkpoint files..."

CHECKPOINT_FILES=$(find "$REPO_ROOT/tracks" -name "checkpoint.yaml" 2>/dev/null || echo "")

if [ -z "$CHECKPOINT_FILES" ]; then
    echo "   No checkpoint files found. PASS (backward compatible)."
    exit 0
fi

echo "   Found checkpoints:"
echo "$CHECKPOINT_FILES" | while read -r cp; do
    echo "   - ${cp#$REPO_ROOT/}"
done
echo ""

# =============================================================================
# Step 3: Check each checkpoint's frozen files
# =============================================================================
echo "[3/4] Checking frozen files..."

VIOLATIONS=""
VIOLATION_COUNT=0

while IFS= read -r checkpoint_file; do
    [ -z "$checkpoint_file" ] && continue

    track_dir=$(dirname "$checkpoint_file")
    track_id=$(basename "$track_dir")

    echo "   Checking: $track_id"

    # Extract frozen files from checkpoint.yaml
    # Parse YAML frozen list (simple grep-based parser)
    in_frozen=false
    frozen_files=""

    while IFS= read -r line; do
        # Detect start of frozen section
        if echo "$line" | grep -q "^frozen:"; then
            in_frozen=true
            continue
        fi

        # Detect end of frozen section (next top-level key)
        if $in_frozen && echo "$line" | grep -qE "^[a-z_]+:"; then
            in_frozen=false
            continue
        fi

        # Extract frozen file paths (lines starting with "  - ")
        if $in_frozen && echo "$line" | grep -qE "^[[:space:]]+-[[:space:]]"; then
            file_path=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//' | tr -d '"' | tr -d "'")
            frozen_files="$frozen_files$file_path"$'\n'
        fi
    done < "$checkpoint_file"

    # Check each frozen file
    while IFS= read -r frozen_file; do
        [ -z "$frozen_file" ] && continue

        # Check if this frozen file was changed (exact path match)
        if echo "$CHANGED_FILES" | grep -qx "$frozen_file"; then
            echo "   ⚠️  Frozen file modified: $frozen_file"

            # Check for valid unfreeze declaration
            unfreeze_found=false

            if [ -d "$UNFREEZE_DIR" ]; then
                for unfreeze_file in "$UNFREEZE_DIR"/*.yaml; do
                    [ -f "$unfreeze_file" ] || continue

                    # Check if unfreeze declaration covers this file
                    if grep -q "track_id:[[:space:]]*$track_id" "$unfreeze_file" && \
                       grep -q "$frozen_file" "$unfreeze_file"; then

                        # Validate required fields
                        has_reason=$(grep -c "^reason:" "$unfreeze_file" || echo "0")
                        has_approved_by=$(grep -c "^approved_by:" "$unfreeze_file" || echo "0")
                        has_approved_at=$(grep -c "^approved_at:" "$unfreeze_file" || echo "0")

                        if [ "$has_reason" -gt 0 ] && [ "$has_approved_by" -gt 0 ] && [ "$has_approved_at" -gt 0 ]; then
                            unfreeze_found=true
                            echo "   ✓ Valid unfreeze: $(basename "$unfreeze_file")"
                            break
                        fi
                    fi
                done
            fi

            if ! $unfreeze_found; then
                VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
                VIOLATIONS="$VIOLATIONS
  [$VIOLATION_COUNT] $frozen_file
      Track: $track_id
      Checkpoint: ${checkpoint_file#$REPO_ROOT/}
      Resolution: Create unfreeze declaration in docs/governance/unfreeze/"
            fi
        fi
    done <<< "$frozen_files"

done <<< "$CHECKPOINT_FILES"

echo ""

# =============================================================================
# Step 4: Report results
# =============================================================================
echo "[4/4] Results..."
echo ""

if [ $VIOLATION_COUNT -eq 0 ]; then
    echo "============================================================================="
    echo "✅ CHECKPOINT FREEZE: PASS"
    echo "============================================================================="
    echo ""
    echo "All frozen files either:"
    echo "  - Not modified, OR"
    echo "  - Have valid unfreeze declarations"
    echo ""
    exit 0
else
    echo "============================================================================="
    echo "❌ CHECKPOINT FREEZE: FAIL"
    echo "============================================================================="
    echo ""
    echo "Violations found: $VIOLATION_COUNT"
    echo "$VIOLATIONS"
    echo ""
    echo "-----------------------------------------------------------------------------"
    echo "To resolve:"
    echo ""
    echo "1. Create an unfreeze declaration file:"
    echo "   docs/governance/unfreeze/<track_id>-<date>.yaml"
    echo ""
    echo "2. Include all required fields:"
    echo "   track_id: <track_id>"
    echo "   files:"
    echo "     - <frozen_file_path>"
    echo "   reason: \"<why this change is needed>\""
    echo "   approved_by: \"<your name>\""
    echo "   approved_at: \"<YYYY-MM-DD>\""
    echo ""
    echo "3. Commit the unfreeze declaration WITH your changes"
    echo ""
    echo "See: docs/governance/UNFREEZE_SCHEMA.md"
    echo "     docs/governance/CHECKPOINT_OVERRIDE_POLICY.md"
    echo "============================================================================="
    exit 1
fi
