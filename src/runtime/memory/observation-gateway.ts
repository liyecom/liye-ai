/**
 * Memory Observation Gateway
 * Location: src/runtime/memory/observation-gateway.ts
 *
 * MAAP (Memory as a Product) unified write entry point.
 * Implements Contract v1 validation + Fail-Fast + Fail-Closed.
 *
 * All Observation writes MUST go through save_observation_with_validation().
 * No bypass allowed. No exceptions.
 */

import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "events";

// ============================================================================
// Types (aligned with Contract v1)
// ============================================================================

interface Observation {
  // System-generated (optional input, auto-generated if missing)
  id?: string | number;
  timestamp?: string;

  // Required (must be provided)
  content: string;
  session_id: string;
  source_prompt_id: string | number;
  entities: string[];
  integrity_status: "VERIFIED" | "REJECTED";

  // Optional but recommended
  governance_reason?: string | null;
  legacy_status?: "trusted" | "legacy_untrusted";
  observation_type?: string;
  context_timeline?: {
    before?: any[];
    current?: any;
    after?: any[];
  };

  // Additional fields allowed
  [key: string]: any;
}

interface ComplianceError {
  event: "MAAP_OBSERVATION_REJECTED";
  timestamp: string;
  session_id: string | null;
  source_prompt_id: string | number | null;
  missing_fields: string[];
  invalid_fields: string[];
  governance_reason: string;
  payload_digest: string;
}

// ============================================================================
// Governance Logger
// ============================================================================

class GovernanceLogger {
  private logPath: string;
  private logDir: string;

  constructor() {
    // Log to .liye/logs/memory-compliance.jsonl
    this.logDir = path.join(process.cwd(), ".liye", "logs");
    this.logPath = path.join(this.logDir, "memory-compliance.jsonl");

    // Ensure directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log a compliance rejection event (non-blocking, best-effort)
   */
  logRejection(error: ComplianceError): void {
    try {
      const line = JSON.stringify(error) + "\n";
      fs.appendFileSync(this.logPath, line, "utf8");
    } catch (e) {
      // Non-blocking: if logging fails, don't crash the system
      console.error("[MAAP] Warning: Failed to write governance log", e);
    }
  }

  /**
   * Get recent rejection logs (for testing/debugging)
   */
  getRecentRejections(limit: number = 10): ComplianceError[] {
    try {
      if (!fs.existsSync(this.logPath)) {
        return [];
      }

      const content = fs.readFileSync(this.logPath, "utf8");
      const lines = content.trim().split("\n").filter((l) => l.length > 0);

      return lines
        .slice(-limit)
        .map((line) => {
          try {
            return JSON.parse(line) as ComplianceError;
          } catch {
            return null;
          }
        })
        .filter((item): item is ComplianceError => item !== null);
    } catch {
      return [];
    }
  }
}

// ============================================================================
// Contract v1 Validator
// ============================================================================

class ObservationValidator {
  /**
   * Validate an observation against Contract v1
   * Returns { valid: true } or { valid: false, errors: [...] }
   */
  validate(obs: any): { valid: boolean; errors: string[]; warnings?: string[] } {
    const errors: string[] = [];

    // Check required fields (hard constraints)
    if (!obs.content) {
      errors.push("missing_field: content");
    } else if (typeof obs.content !== "string" || obs.content.length < 10) {
      errors.push("invalid_field: content must be string with length >= 10");
    }

    if (!obs.session_id) {
      errors.push("missing_field: session_id");
    } else if (typeof obs.session_id !== "string") {
      errors.push("invalid_field: session_id must be string");
    }

    if (obs.source_prompt_id === undefined || obs.source_prompt_id === null || obs.source_prompt_id === "") {
      errors.push("missing_field: source_prompt_id");
    }

    if (!Array.isArray(obs.entities)) {
      errors.push("invalid_field: entities must be array");
    } else if (obs.entities.length === 0) {
      errors.push("invalid_field: entities array must have at least 1 element");
    }

    if (obs.timestamp && !this.isValidISO8601(obs.timestamp)) {
      errors.push("invalid_field: timestamp must be valid ISO8601");
    }

    // integrity_status validation
    if (obs.integrity_status !== "VERIFIED" && obs.integrity_status !== "REJECTED") {
      errors.push("invalid_field: integrity_status must be 'VERIFIED' or 'REJECTED'");
    }

    // If REJECTED, must have governance_reason
    if (obs.integrity_status === "REJECTED" && !obs.governance_reason) {
      errors.push("invalid_field: integrity_status=REJECTED requires governance_reason");
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidISO8601(timestamp: string): boolean {
    // Basic ISO8601 check: YYYY-MM-DDTHH:mm:ss(.sss)?Z?
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return iso8601Regex.test(timestamp);
  }
}

// ============================================================================
// Main Gateway
// ============================================================================

class ObservationGateway {
  private validator: ObservationValidator;
  private logger: GovernanceLogger;
  private eventEmitter: EventEmitter;
  private nextId: number = 1; // Simple ID generator (can use UUID in production)
  private rejectedObservations: ComplianceError[] = [];

  constructor() {
    this.validator = new ObservationValidator();
    this.logger = new GovernanceLogger();
    this.eventEmitter = new EventEmitter();

    // Load next ID from last rejection log (for production, use proper ID store)
    this.initializeIdSequence();
  }

  private initializeIdSequence(): void {
    const recentRejections = this.logger.getRecentRejections(100);
    if (recentRejections.length > 0) {
      // This is just a simple heuristic; in production, use a proper ID store
      this.nextId = Math.max(...recentRejections.map((r) => parseInt(String(r.session_id || "0"), 10))) + 1;
    }
  }

  /**
   * MAIN ENTRY POINT: Save observation with validation (Fail-Fast + Fail-Closed)
   *
   * Contract:
   * - System auto-fills: id (if missing), timestamp (if missing)
   * - Required: content, session_id, source_prompt_id, entities
   * - If validation fails: return error + governance log (do NOT save)
   */
  async save_observation_with_validation(input: Partial<Observation>): Promise<{
    success: boolean;
    observation?: Observation;
    error?: string;
  }> {
    // Step 1: System auto-fill
    const obs: Observation = {
      id: input.id || `obs-${this.nextId++}`,
      timestamp: input.timestamp || new Date().toISOString(),
      content: input.content || "",
      session_id: input.session_id || "",
      source_prompt_id: input.source_prompt_id || "",
      entities: input.entities || [],
      integrity_status: input.integrity_status || "VERIFIED",
      ...input,
    };

    // Step 2: Validate
    const validation = this.validator.validate(obs);

    if (!validation.valid) {
      // FAIL-FAST: reject and log
      const error = this.createComplianceError(obs, validation.errors);
      this.logger.logRejection(error);
      this.rejectedObservations.push(error);

      // Emit event for testing/monitoring
      this.eventEmitter.emit("observation_rejected", error);

      return {
        success: false,
        error: `Observation validation failed: ${validation.errors.join(", ")}`,
      };
    }

    // Step 3: Persist to storage
    try {
      // TODO: Integrate with claude-mem HTTP API here
      // For now, just emit success event (placeholder for actual persistence)
      this.eventEmitter.emit("observation_saved", obs);

      return {
        success: true,
        observation: obs,
      };
    } catch (e) {
      const error: ComplianceError = {
        event: "MAAP_OBSERVATION_REJECTED",
        timestamp: new Date().toISOString(),
        session_id: obs.session_id,
        source_prompt_id: obs.source_prompt_id,
        missing_fields: [],
        invalid_fields: [`persistence_error: ${String(e).substring(0, 100)}`],
        governance_reason: "Failed to persist observation to storage",
        payload_digest: this.hashContent(obs.content),
      };

      this.logger.logRejection(error);
      this.rejectedObservations.push(error);

      return {
        success: false,
        error: `Failed to save observation: ${String(e).substring(0, 100)}`,
      };
    }
  }

  /**
   * Create a compliance error record
   */
  private createComplianceError(obs: Partial<Observation>, errors: string[]): ComplianceError {
    // Parse error types
    const missingFields = errors
      .filter((e) => e.startsWith("missing_field:"))
      .map((e) => e.replace("missing_field:", "").trim());

    const invalidFields = errors
      .filter((e) => e.startsWith("invalid_field:"))
      .map((e) => e.replace("invalid_field:", "").trim());

    return {
      event: "MAAP_OBSERVATION_REJECTED",
      timestamp: new Date().toISOString(),
      session_id: obs.session_id || null,
      source_prompt_id: obs.source_prompt_id || null,
      missing_fields: missingFields,
      invalid_fields: invalidFields,
      governance_reason: `Failed validation: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`,
      payload_digest: this.hashContent(obs.content || ""),
    };
  }

  /**
   * Simple hash of content (truncate to prevent log bloat)
   */
  private hashContent(content: string): string {
    // Just return first 100 chars + length indicator
    return `${content.substring(0, 100)}[...${content.length} chars]`;
  }

  /**
   * Get governance logger (for testing)
   */
  getLogger(): GovernanceLogger {
    return this.logger;
  }

  /**
   * Get event emitter (for testing/monitoring)
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }

  /**
   * Get rejected observations (for testing)
   */
  getRejectedObservations(): ComplianceError[] {
    return [...this.rejectedObservations];
  }

  /**
   * Clear rejected observations (for testing)
   */
  clearRejections(): void {
    this.rejectedObservations = [];
  }
}

// ============================================================================
// Exports
// ============================================================================

export const gateway = new ObservationGateway();

/**
 * Public API: The ONLY entry point for saving observations
 */
export async function save_observation_with_validation(
  input: Partial<Observation>
): Promise<{
  success: boolean;
  observation?: Observation;
  error?: string;
}> {
  return gateway.save_observation_with_validation(input);
}

export { ObservationValidator, ObservationGateway, GovernanceLogger };
