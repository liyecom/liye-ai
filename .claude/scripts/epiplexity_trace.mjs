#!/usr/bin/env node
/**
 * Epiplexity Trace Emitter
 * Phase 0-1: Observation only, no behavior change
 *
 * Usage:
 *   // As module
 *   import { emitTrace } from './epiplexity_trace.mjs';
 *   emitTrace({ task_type: 'amazon', packs_loaded: ['operations'], task_success: true, ... });
 *
 *   // As CLI
 *   node epiplexity_trace.mjs --task_type=amazon --packs_loaded=operations,infrastructure --task_success=true
 *
 * Output: data/traces/epiplexity/epiplexity-traces.jsonl
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

// ============================================================================
// Constants
// ============================================================================

const TRACE_DIR = path.join(REPO_ROOT, "data/traces/epiplexity");
const TRACE_FILE = path.join(TRACE_DIR, "epiplexity-traces.jsonl");

const VALID_TASK_TYPES = ["amazon", "seo", "dev", "docs", "ops", "general"];

// ============================================================================
// Trace Schema
// ============================================================================

/**
 * @typedef {Object} EpiplexityTrace
 * @property {string} trace_id - Unique identifier: {ISO_timestamp}__{random_suffix}
 * @property {string} ts - ISO8601 timestamp
 * @property {string} task_type - Category: amazon|seo|dev|docs|ops|general
 * @property {string[]} packs_loaded - List of pack IDs loaded for this task
 * @property {number} context_tokens_total - Estimated total context tokens
 * @property {boolean} task_success - Whether task completed successfully
 * @property {number|null} quality_score - Optional quality metric (null if unavailable)
 * @property {number} strike_count - Consecutive failure count (from 3-strike protocol)
 * @property {string[]} failure_mode_tags - Array of failure mode identifiers
 * @property {number} duration_ms - Task execution duration in milliseconds
 * @property {string} notes - Optional notes
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique trace ID
 * @returns {string}
 */
function generateTraceId() {
  const ts = new Date().toISOString();
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${ts}__${suffix}`;
}

/**
 * Estimate token count from character count
 * Rough heuristic: ~4 chars per token for English, ~2 chars per token for Chinese
 * Using conservative 3 chars per token as middle ground
 * @param {number} charCount
 * @returns {number}
 */
function estimateTokens(charCount) {
  return Math.ceil(charCount / 3);
}

/**
 * Validate task type
 * @param {string} taskType
 * @returns {string}
 */
function normalizeTaskType(taskType) {
  const normalized = String(taskType).toLowerCase().trim();
  return VALID_TASK_TYPES.includes(normalized) ? normalized : "general";
}

/**
 * Ensure trace directory exists
 */
function ensureTraceDir() {
  if (!fs.existsSync(TRACE_DIR)) {
    fs.mkdirSync(TRACE_DIR, { recursive: true });
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Emit a trace record to the epiplexity trace file
 * @param {Partial<EpiplexityTrace>} data - Trace data (partial, will fill defaults)
 * @returns {EpiplexityTrace} - The emitted trace record
 */
export function emitTrace(data = {}) {
  ensureTraceDir();

  const now = new Date();
  const trace = {
    trace_id: data.trace_id || generateTraceId(),
    ts: data.ts || now.toISOString(),
    task_type: normalizeTaskType(data.task_type || "general"),
    packs_loaded: Array.isArray(data.packs_loaded) ? data.packs_loaded : [],
    context_tokens_total: data.context_tokens_total || 0,
    task_success: Boolean(data.task_success),
    quality_score: data.quality_score ?? null,
    strike_count: data.strike_count || 0,
    failure_mode_tags: Array.isArray(data.failure_mode_tags) ? data.failure_mode_tags : [],
    duration_ms: data.duration_ms || 0,
    notes: data.notes || "phase0 observe"
  };

  // Append to JSONL file
  const line = JSON.stringify(trace) + "\n";
  fs.appendFileSync(TRACE_FILE, line, "utf8");

  return trace;
}

/**
 * Read all traces from the trace file
 * @returns {EpiplexityTrace[]}
 */
export function readTraces() {
  if (!fs.existsSync(TRACE_FILE)) {
    return [];
  }

  const content = fs.readFileSync(TRACE_FILE, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.warn(`[epiplexity_trace] Failed to parse line ${idx + 1}: ${e.message}`);
      return null;
    }
  }).filter(Boolean);
}

/**
 * Get trace file path
 * @returns {string}
 */
export function getTraceFilePath() {
  return TRACE_FILE;
}

// ============================================================================
// CLI Interface
// ============================================================================

function parseCliArgs() {
  const args = process.argv.slice(2);
  const data = {};

  for (const arg of args) {
    if (arg.startsWith("--")) {
      const [key, value] = arg.substring(2).split("=");
      if (key && value !== undefined) {
        // Handle special cases
        if (key === "packs_loaded" || key === "failure_mode_tags") {
          data[key] = value.split(",").map(s => s.trim()).filter(Boolean);
        } else if (key === "task_success") {
          data[key] = value === "true" || value === "1";
        } else if (key === "context_tokens_total" || key === "strike_count" || key === "duration_ms") {
          data[key] = parseInt(value, 10) || 0;
        } else if (key === "quality_score") {
          data[key] = value === "null" ? null : parseFloat(value);
        } else {
          data[key] = value;
        }
      }
    }
  }

  return data;
}

function printUsage() {
  console.log(`
Epiplexity Trace Emitter - Phase 0-1 Observation Tool

Usage:
  node epiplexity_trace.mjs [options]

Options:
  --task_type=<type>              Task category: amazon|seo|dev|docs|ops|general
  --packs_loaded=<pack1,pack2>    Comma-separated list of pack IDs
  --context_tokens_total=<n>      Estimated context token count
  --task_success=<true|false>     Whether task succeeded
  --quality_score=<n|null>        Optional quality score (0-1)
  --strike_count=<n>              Consecutive failure count
  --failure_mode_tags=<tag1,tag2> Comma-separated failure mode tags
  --duration_ms=<n>               Task duration in milliseconds
  --notes=<text>                  Optional notes

Example:
  node epiplexity_trace.mjs \\
    --task_type=amazon \\
    --packs_loaded=operations,infrastructure \\
    --context_tokens_total=8420 \\
    --task_success=true \\
    --duration_ms=18432

Output:
  Appends trace to: ${TRACE_FILE}
`);
}

// ============================================================================
// Main
// ============================================================================

const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith("epiplexity_trace.mjs") ||
   process.argv[1].includes("epiplexity_trace"));

if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  if (args.length === 0) {
    console.log("[epiplexity_trace] No arguments provided. Emitting default trace...");
    const trace = emitTrace({ notes: "cli test trace" });
    console.log("[epiplexity_trace] Trace emitted:");
    console.log(JSON.stringify(trace, null, 2));
  } else {
    const data = parseCliArgs();
    const trace = emitTrace(data);
    console.log("[epiplexity_trace] Trace emitted:");
    console.log(JSON.stringify(trace, null, 2));
  }
}
