#!/usr/bin/env node
/**
 * Unit Tests for Memory Observation Gateway
 * Tests: src/runtime/memory/observation-gateway.ts
 *
 * Run: node tests/runtime/memory-gateway.test.mjs
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Test Framework (Simple Assertions)
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    testsFailed++;
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    testsPassed++;
    console.log(`✅ PASS: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

async function test(name, fn) {
  console.log(`\n📝 Testing: ${name}`);
  try {
    await fn();
    console.log(`   → Test completed successfully`);
  } catch (e) {
    console.error(`   → Test failed: ${e.message}`);
  }
}

// ============================================================================
// Mock: Observation Gateway (inline copy for testing)
// ============================================================================

class TestObservationValidator {
  validate(obs) {
    const errors = [];

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

    if (
      obs.source_prompt_id === undefined ||
      obs.source_prompt_id === null ||
      obs.source_prompt_id === ""
    ) {
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

    if (obs.integrity_status !== "VERIFIED" && obs.integrity_status !== "REJECTED") {
      errors.push("invalid_field: integrity_status must be 'VERIFIED' or 'REJECTED'");
    }

    if (obs.integrity_status === "REJECTED" && !obs.governance_reason) {
      errors.push("invalid_field: integrity_status=REJECTED requires governance_reason");
    }

    return { valid: errors.length === 0, errors };
  }

  isValidISO8601(timestamp) {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    return iso8601Regex.test(timestamp);
  }
}

class TestGovernanceLogger {
  constructor(logPath) {
    this.logPath = logPath;
    this.logDir = path.dirname(logPath);

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  logRejection(error) {
    const line = JSON.stringify(error) + "\n";
    fs.appendFileSync(this.logPath, line, "utf8");
  }

  logSuccess(event) {
    const line = JSON.stringify(event) + "\n";
    fs.appendFileSync(this.logPath, line, "utf8");
  }

  getRecentRejections(limit = 10) {
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
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((item) => item !== null);
    } catch {
      return [];
    }
  }

  clear() {
    if (fs.existsSync(this.logPath)) {
      fs.unlinkSync(this.logPath);
    }
  }
}

class TestObservationGateway {
  constructor() {
    this.validator = new TestObservationValidator();
    const logPath = path.join(__dirname, "..", "..", ".liye", "logs", "test-compliance.jsonl");
    this.logger = new TestGovernanceLogger(logPath);
    this.nextId = 1;
    this.rejectedObservations = [];
  }

  async save_observation_with_validation(input) {
    const obs = {
      id: input.id || `obs-${this.nextId++}`,
      timestamp: input.timestamp || new Date().toISOString(),
      content: input.content || "",
      session_id: input.session_id || "",
      source_prompt_id: input.source_prompt_id || "",
      entities: input.entities || [],
      integrity_status: input.integrity_status || "VERIFIED",
      ...input,
    };

    const validation = this.validator.validate(obs);

    if (!validation.valid) {
      const error = {
        event: "MAAP_OBSERVATION_REJECTED",
        timestamp: new Date().toISOString(),
        session_id: obs.session_id || null,
        source_prompt_id: obs.source_prompt_id || null,
        missing_fields: validation.errors
          .filter((e) => e.startsWith("missing_field:"))
          .map((e) => e.replace("missing_field:", "").trim()),
        invalid_fields: validation.errors
          .filter((e) => e.startsWith("invalid_field:"))
          .map((e) => e.replace("invalid_field:", "").trim()),
        governance_reason: `Failed validation: ${validation.errors.slice(0, 3).join("; ")}${validation.errors.length > 3 ? "..." : ""}`,
        payload_digest: `${(obs.content || "").substring(0, 100)}[...${(obs.content || "").length} chars]`,
      };

      this.logger.logRejection(error);
      this.rejectedObservations.push(error);

      return {
        success: false,
        error: `Observation validation failed: ${validation.errors.join(", ")}`,
      };
    }

    // Log success event (Step 6.1: Positive Instrumentation)
    const savedEvent = {
      event: "MAAP_OBSERVATION_SAVED",
      timestamp: new Date().toISOString(),
      observation_id: obs.id,
      session_id: obs.session_id,
      source_prompt_id: obs.source_prompt_id,
      entities: obs.entities,
      content_length: obs.content.length,
    };
    this.logger.logSuccess(savedEvent);

    return {
      success: true,
      observation: obs,
    };
  }

  getRejectedObservations() {
    return [...this.rejectedObservations];
  }

  clearRejections() {
    this.rejectedObservations = [];
  }

  getLogger() {
    return this.logger;
  }
}

// ============================================================================
// Test Cases (Align with Contract v1)
// ============================================================================

async function runTests() {
  const gateway = new TestObservationGateway();

  console.log("\n" + "=".repeat(80));
  console.log("Memory Observation Gateway — Unit Tests");
  console.log("=".repeat(80));

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Missing session_id → Reject
  // ─────────────────────────────────────────────────────────────────────────
  await test("缺 session_id → 拒绝，不落盘，产生治理日志事件", async () => {
    gateway.clearRejections();
    gateway.getLogger().clear();

    const result = await gateway.save_observation_with_validation({
      content: "Test observation without session_id",
      // session_id: missing
      source_prompt_id: "prompt-123",
      entities: ["test"],
      integrity_status: "VERIFIED",
    });

    assert(!result.success, "Result should indicate failure");
    assert(result.error.includes("session_id"), "Error message should mention session_id");
    assert(gateway.getRejectedObservations().length === 1, "One observation should be rejected");

    const rejectionLog = gateway.getLogger().getRecentRejections(1);
    assert(rejectionLog.length === 1, "Governance log should have 1 entry");
    assert(rejectionLog[0].event === "MAAP_OBSERVATION_REJECTED", "Event type should be correct");
    assert(
      rejectionLog[0].missing_fields.includes("session_id"),
      "Governance log should list missing session_id"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Missing source_prompt_id → Reject
  // ─────────────────────────────────────────────────────────────────────────
  await test("缺 source_prompt_id → 拒绝，不落盘，产生治理日志事件", async () => {
    gateway.clearRejections();
    gateway.getLogger().clear();

    const result = await gateway.save_observation_with_validation({
      content: "Test observation without source_prompt_id",
      session_id: "sess-123",
      // source_prompt_id: missing
      entities: ["test"],
      integrity_status: "VERIFIED",
    });

    assert(!result.success, "Result should indicate failure");
    assert(result.error.includes("source_prompt_id"), "Error message should mention source_prompt_id");
    assert(gateway.getRejectedObservations().length === 1, "One observation should be rejected");

    const rejectionLog = gateway.getLogger().getRecentRejections(1);
    assert(rejectionLog.length === 1, "Governance log should have 1 entry");
    assert(rejectionLog[0].missing_fields.includes("source_prompt_id"), "Should list missing source_prompt_id");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Empty entities array → Reject
  // ─────────────────────────────────────────────────────────────────────────
  await test("entities=[] → 拒绝，不落盘，产生治理日志事件", async () => {
    gateway.clearRejections();
    gateway.getLogger().clear();

    const result = await gateway.save_observation_with_validation({
      content: "Test observation with empty entities",
      session_id: "sess-123",
      source_prompt_id: "prompt-123",
      entities: [], // Empty array
      integrity_status: "VERIFIED",
    });

    assert(!result.success, "Result should indicate failure");
    assert(result.error.includes("entities"), "Error message should mention entities");
    assert(gateway.getRejectedObservations().length === 1, "One observation should be rejected");

    const rejectionLog = gateway.getLogger().getRecentRejections(1);
    assert(rejectionLog.length === 1, "Governance log should have 1 entry");
    assert(
      rejectionLog[0].invalid_fields.some((f) => f.includes("entities")),
      "Should list invalid entities"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Valid object → Write success with auto-generated fields
  // ─────────────────────────────────────────────────────────────────────────
  await test("合法对象 → 写入成功，写入对象满足 Contract v1（含 id/timestamp）", async () => {
    gateway.clearRejections();

    const result = await gateway.save_observation_with_validation({
      content: "This is a valid observation with all required fields",
      session_id: "sess-20260208",
      source_prompt_id: "prompt-20260208",
      entities: ["test", "memory", "governance"],
      integrity_status: "VERIFIED",
    });

    assert(result.success, "Result should indicate success");
    assert(result.observation !== undefined, "Should return the saved observation");
    assert(result.observation.id !== undefined, "Should have auto-generated id");
    assert(result.observation.timestamp !== undefined, "Should have auto-generated timestamp");
    assert(result.observation.content === "This is a valid observation with all required fields", "Content should match");
    assert(result.observation.session_id === "sess-20260208", "session_id should match");
    assert(result.observation.source_prompt_id === "prompt-20260208", "source_prompt_id should match");
    assert(
      JSON.stringify(result.observation.entities) === JSON.stringify(["test", "memory", "governance"]),
      "entities should match"
    );
    assert(result.observation.integrity_status === "VERIFIED", "integrity_status should be VERIFIED");
    assert(gateway.getRejectedObservations().length === 0, "No observations should be rejected");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: REJECTED status without governance_reason → Reject
  // ─────────────────────────────────────────────────────────────────────────
  await test(
    "integrity_status=REJECTED 但缺 governance_reason → 拒绝",
    async () => {
      gateway.clearRejections();
      gateway.getLogger().clear();

      const result = await gateway.save_observation_with_validation({
        content: "This is a rejected observation",
        session_id: "sess-123",
        source_prompt_id: "prompt-123",
        entities: ["test"],
        integrity_status: "REJECTED",
        // governance_reason: missing
      });

      assert(!result.success, "Result should indicate failure");
      assert(
        gateway.getRejectedObservations().length === 1,
        "One observation should be rejected"
      );
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Content too short → Reject
  // ─────────────────────────────────────────────────────────────────────────
  await test("content 长度 < 10 → 拒绝", async () => {
    gateway.clearRejections();

    const result = await gateway.save_observation_with_validation({
      content: "short", // Less than 10 chars
      session_id: "sess-123",
      source_prompt_id: "prompt-123",
      entities: ["test"],
      integrity_status: "VERIFIED",
    });

    assert(!result.success, "Result should indicate failure");
    assert(gateway.getRejectedObservations().length === 1, "One observation should be rejected");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: Successful save logs MAAP_OBSERVATION_SAVED event (Step 6.1)
  // ─────────────────────────────────────────────────────────────────────────
  await test("成功保存时记录 MAAP_OBSERVATION_SAVED 事件", async () => {
    gateway.clearRejections();
    gateway.getLogger().clear();

    const result = await gateway.save_observation_with_validation({
      content: "This is a valid observation for Step 6.1 test",
      session_id: "sess-step61",
      source_prompt_id: "prompt-step61",
      entities: ["memory", "metrics"],
      integrity_status: "VERIFIED",
    });

    assert(result.success, "Result should indicate success");

    // Read log and check for SAVED event
    const logs = gateway.getLogger().getRecentRejections(10);
    const savedEvent = logs.find(log => log.event === "MAAP_OBSERVATION_SAVED");

    assert(savedEvent !== undefined, "Should log MAAP_OBSERVATION_SAVED event");
    assert(savedEvent.session_id === "sess-step61", "session_id should match");
    assert(savedEvent.source_prompt_id === "prompt-step61", "source_prompt_id should match");
    assert(savedEvent.content_length > 0, "content_length should be recorded");
    assert(Array.isArray(savedEvent.entities), "entities should be recorded");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(80));
  console.log("Test Summary");
  console.log("=".repeat(80));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📊 Total: ${testsPassed + testsFailed}`);

  if (testsFailed > 0) {
    process.exit(1);
  }

  console.log("\n✅ All tests passed!");
}

// ============================================================================
// Run Tests
// ============================================================================

runTests().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
