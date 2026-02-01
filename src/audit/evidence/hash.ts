/**
 * SHA-256 Hash Helper
 * Contract: docs/contracts/EVIDENCE_PACKAGE_V1.md (FROZEN: 2026-02-01)
 *
 * Returns 64-character lowercase hex string
 * No salt, no base64, pure SHA-256
 */

import { createHash } from "crypto";

/**
 * Compute SHA-256 hash of input string
 *
 * @param input - String to hash
 * @returns 64-character lowercase hex string
 */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
