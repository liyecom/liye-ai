/**
 * RED TEAM TEST - Intentional Boundary Violation
 *
 * This file intentionally violates the memory boundary by attempting
 * direct access to the CLAUDE_MEM_BASE_URL (outside observation-gateway.ts)
 *
 * Expected outcome: memory-governance-gate.sh Check 4.5 should detect this
 * and fail the CI check, preventing merge.
 */

const CLAUDE_MEM_BASE_URL = process.env.CLAUDE_MEM_BASE_URL || "https://api.claude-mem.anthropic.com";

// Direct API access (VIOLATION - should be caught by Check 4.5)
async function directMemoryAccess() {
  const response = await fetch(`${CLAUDE_MEM_BASE_URL}/observations`, {
    method: "POST",
    body: JSON.stringify({
      content: "Direct memory write (VIOLATION)",
    }),
  });
  return response.json();
}

export { directMemoryAccess };
