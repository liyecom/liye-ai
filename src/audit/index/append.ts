/**
 * Audit Index (append-only JSONL)
 * Contract: docs/contracts/EVIDENCE_PACKAGE_V1.md (FROZEN: 2026-02-01)
 *
 * JSONL format for audit trail:
 * - One JSON object per line
 * - Append-only, no deletion/overwrite
 * - Git-friendly (diff shows new lines only)
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Audit index entry structure
 */
export interface AuditIndexEntry {
  trace_id: string;
  decision: "ALLOW" | "BLOCK" | "DEGRADE" | "UNKNOWN";
  date: string; // YYYY-MM-DD
  evidence_ref: string; // Path to evidence file
  package_hash: string; // sha256:xxx format
}

const DEFAULT_INDEX_PATH = "audit_index.jsonl";

/**
 * Append entry to audit index (append-only)
 *
 * @param entry - Audit index entry to append
 * @param indexPath - Path to index file (default: audit_index.jsonl)
 */
export function appendAuditIndex(
  entry: AuditIndexEntry,
  indexPath: string = DEFAULT_INDEX_PATH
): void {
  // Ensure parent directory exists
  const dir = path.dirname(indexPath);
  if (dir && dir !== ".") {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Format entry as single-line JSON
  const line = JSON.stringify(entry) + "\n";

  // Append to file (creates if not exists)
  fs.appendFileSync(indexPath, line, "utf8");
}

/**
 * Read all entries from audit index
 *
 * @param indexPath - Path to index file
 * @returns Array of audit index entries
 */
export function readAuditIndex(
  indexPath: string = DEFAULT_INDEX_PATH
): AuditIndexEntry[] {
  if (!fs.existsSync(indexPath)) {
    return [];
  }

  const content = fs.readFileSync(indexPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);

  return lines.map((line) => JSON.parse(line) as AuditIndexEntry);
}

/**
 * Find entry by trace_id
 *
 * @param trace_id - Trace ID to find
 * @param indexPath - Path to index file
 * @returns Entry if found, undefined otherwise
 */
export function findByTraceId(
  trace_id: string,
  indexPath: string = DEFAULT_INDEX_PATH
): AuditIndexEntry | undefined {
  const entries = readAuditIndex(indexPath);
  return entries.find((e) => e.trace_id === trace_id);
}

/**
 * Count entries in audit index
 *
 * @param indexPath - Path to index file
 * @returns Number of entries
 */
export function countEntries(indexPath: string = DEFAULT_INDEX_PATH): number {
  return readAuditIndex(indexPath).length;
}
