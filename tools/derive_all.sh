#!/usr/bin/env bash
# =============================================================================
# derive_all.sh - Enhancement 2: 派生层重建脚本
# =============================================================================
# Purpose: 从 traces/ 重建所有派生层
# Input:   traces/
# Output:  state/ event_clock/ world_model/ semantic/ (部分)
#
# Principle: 派生层永远是缓存，可以不进 git
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
RUNTIME="${AMAZON_RUNTIME:-$HOME/Documents/amazon-runtime}"
TRACES_DIR="$RUNTIME/traces"
STATE_DIR="$RUNTIME/state"
EVENT_CLOCK_DIR="$RUNTIME/event_clock"
WORLD_MODEL_DIR="$RUNTIME/world_model"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# -----------------------------------------------------------------------------
# Pre-flight checks
# -----------------------------------------------------------------------------
if [[ ! -d "$TRACES_DIR" ]]; then
    log_error "Traces directory not found: $TRACES_DIR"
    exit 1
fi

log_info "=== Amazon Growth Engine: Derive All ==="
log_info "Runtime:  $RUNTIME"
log_info "Traces:   $TRACES_DIR"
log_info ""

# -----------------------------------------------------------------------------
# Step 1: Clean derived directories (optional with --clean flag)
# -----------------------------------------------------------------------------
if [[ "${1:-}" == "--clean" ]]; then
    log_warn "Cleaning derived directories..."
    rm -rf "$STATE_DIR"/*
    rm -rf "$EVENT_CLOCK_DIR"/*
    rm -rf "$WORLD_MODEL_DIR/hypotheses"/*
    rm -rf "$WORLD_MODEL_DIR/experiments"/*
    log_info "Derived directories cleaned."
fi

# -----------------------------------------------------------------------------
# Step 2: Ensure directories exist
# -----------------------------------------------------------------------------
mkdir -p "$STATE_DIR"/{intent_buckets,metrics}
mkdir -p "$EVENT_CLOCK_DIR"/{intent_buckets,content_versions}
mkdir -p "$WORLD_MODEL_DIR"/{hypotheses,causal_laws,emerged_patterns,experiments}

# -----------------------------------------------------------------------------
# Step 3: Rebuild state/intent_buckets/ from traces
# -----------------------------------------------------------------------------
log_info "Rebuilding state/intent_buckets/..."

# Find all trace files
TRACE_FILES=$(find "$TRACES_DIR" -name "TRACE-*.yaml" -o -name "TRACE-*.yml" 2>/dev/null | sort)
TRACE_COUNT=$(echo "$TRACE_FILES" | grep -c "TRACE-" || echo "0")

log_info "Found $TRACE_COUNT trace files"

if [[ "$TRACE_COUNT" -gt 0 ]]; then
    # Extract unique ASINs from traces (简化版，实际需要 yaml parser)
    # This is a best-effort grep-based extraction
    ASINS=$(grep -h "asin:" $TRACE_FILES 2>/dev/null | sed 's/.*asin:\s*["'\'']\?\([^"'\'']*\)["'\'']\?.*/\1/' | sort -u || true)

    for asin in $ASINS; do
        if [[ -n "$asin" && "$asin" != "null" && "$asin" != "B0XXXX" ]]; then
            mkdir -p "$STATE_DIR/intent_buckets"
            log_info "  Processing ASIN: $asin"
            # Create state file (placeholder - real implementation needs yaml parsing)
            echo "# Auto-derived from traces/ at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE_DIR/intent_buckets/${asin}_state.yaml"
            echo "asin: $asin" >> "$STATE_DIR/intent_buckets/${asin}_state.yaml"
            echo "last_trace_scan: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$STATE_DIR/intent_buckets/${asin}_state.yaml"
        fi
    done
fi

# -----------------------------------------------------------------------------
# Step 4: Rebuild event_clock/ from traces
# -----------------------------------------------------------------------------
log_info "Rebuilding event_clock/..."

# Extract events from traces (simplified)
EVENT_COUNT=0
if [[ "$TRACE_COUNT" -gt 0 ]]; then
    # Look for state transitions in traces
    TRANSITIONS=$(grep -h "state:" $TRACE_FILES 2>/dev/null | wc -l || echo "0")
    EVENT_COUNT=$TRANSITIONS
fi

log_info "  Found $EVENT_COUNT potential state transition events"

# Write event summary
cat > "$EVENT_CLOCK_DIR/rebuild_summary.yaml" <<EOF
# Event Clock Rebuild Summary
rebuilt_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
source: traces/
trace_count: $TRACE_COUNT
event_count: $EVENT_COUNT
EOF

# -----------------------------------------------------------------------------
# Step 5: Rebuild world_model/hypotheses/ from traces
# -----------------------------------------------------------------------------
log_info "Rebuilding world_model/hypotheses/..."

if [[ "$TRACE_COUNT" -gt 0 ]]; then
    # Extract hypothesis IDs from traces
    HYPOTHESIS_IDS=$(grep -h "hypothesis_id:" $TRACE_FILES 2>/dev/null | sed 's/.*hypothesis_id:\s*["'\'']\?\([^"'\'']*\)["'\'']\?.*/\1/' | sort -u || true)

    for h_id in $HYPOTHESIS_IDS; do
        if [[ -n "$h_id" && "$h_id" != "null" && "$h_id" =~ ^H-[0-9]+ ]]; then
            mkdir -p "$WORLD_MODEL_DIR/hypotheses"
            log_info "  Found hypothesis: $h_id"
            # Create hypothesis file if not exists
            if [[ ! -f "$WORLD_MODEL_DIR/hypotheses/${h_id}.yaml" ]]; then
                cat > "$WORLD_MODEL_DIR/hypotheses/${h_id}.yaml" <<EOF
# Auto-derived from traces/
hypothesis:
  id: "$h_id"
  status: "TESTING"
  derived_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
  source_traces: []
  confidence: 0.50
EOF
            fi
        fi
    done
fi

# -----------------------------------------------------------------------------
# Step 6: Rebuild metrics
# -----------------------------------------------------------------------------
log_info "Rebuilding state/metrics/..."

# Decision density calculation (simplified)
DECISION_COUNT=$(grep -l "trace_type:\s*decision" $TRACE_FILES 2>/dev/null | wc -l || echo "0")

cat > "$STATE_DIR/metrics/decision_density.yaml" <<EOF
# Decision Density Metrics
rebuilt_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
total_traces: $TRACE_COUNT
decision_traces: $DECISION_COUNT
decision_density_pct: null  # Requires intent bucket count to calculate
EOF

# Freeze rate (placeholder)
cat > "$STATE_DIR/metrics/freeze_rate.yaml" <<EOF
# Freeze Rate Metrics
rebuilt_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
total_buckets: null
frozen_buckets: null
freeze_rate_pct: null
EOF

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
log_info ""
log_info "=== Rebuild Complete ==="
log_info "Traces processed:  $TRACE_COUNT"
log_info "State dir:         $STATE_DIR"
log_info "Event clock dir:   $EVENT_CLOCK_DIR"
log_info "World model dir:   $WORLD_MODEL_DIR"
log_info ""
log_info "Note: Derived layers are caches. If inconsistent with traces/, traces/ is truth."
log_info ""
log_info "To clean and rebuild: $0 --clean"
