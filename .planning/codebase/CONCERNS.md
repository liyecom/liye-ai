# Codebase Concerns

**Analysis Date:** 2026-04-13

## Tech Debt

**Mixed Module Systems (CJS + ESM + TypeScript):**
- Issue: The `src/` directory contains 61 `.js`/`.mjs` files using three different module systems: CommonJS (`require()`), ESM (`import`), and TypeScript (`import` with types). CJS files use `require()` (all `src/brokers/*.js`, `src/config/*.js`, `src/mission/*.js`, `src/context/*.js`), while `.mjs` files use ESM imports (all `src/reasoning/**/*.mjs`, `src/runtime/execution/*.mjs`, `src/governance/**/*.mjs`), and `.ts` files use TypeScript ESM (all `src/gateway/**/*.ts`, `src/runtime/scheduler/*.ts`, `src/skill/**/*.ts`).
- Files: `src/brokers/*.js` (CJS), `src/reasoning/**/*.mjs` (ESM), `src/gateway/openclaw/*.ts` (TS)
- Impact: Cannot import CJS modules from ESM modules without wrappers. Testing inconsistency (legacy `.mjs` tests use `assert` directly while newer `.test.ts` files use vitest). Build pipeline complexity. Refactoring across module boundaries is error-prone.
- Fix approach: Migrate CJS files (`src/brokers/`, `src/config/`, `src/mission/`, `src/context/`, `src/analytics/`) to TypeScript. Set `"type": "module"` in `package.json` and convert `.mjs` files to `.ts`. Target: single module system (TypeScript ESM).

**Placeholder/Stub Implementations:**
- Issue: Multiple adapter files contain only `throw new Error('...not yet implemented')` with no real logic. The write executor (`src/adapters/write_executor/index.mjs`) has 5 action handlers that all throw `'Real API execution not implemented (Week 6)'` -- this "Week 6" reference is frozen tech debt from an earlier sprint.
- Files:
  - `src/adapters/t1/external-agent.ts` (all methods throw NotImplementedError)
  - `src/adapters/t1/third-party-os.ts` (all methods throw NotImplementedError)
  - `src/adapters/write_executor/index.mjs` lines 109-223 (5 action types all stub)
  - `src/runtime/memory/observation-gateway.ts` line 272 (persistence is a no-op, emits event only)
  - `tools/notion-sync/index.js` line 78 (full bidirectional sync not implemented)
- Impact: Any code path reaching these stubs will crash at runtime. The observation gateway silently drops data (pretends to save but does not persist). Sprint references ("Week 6") create confusion about current project state.
- Fix approach: Either implement the real logic or remove the dead code and document the gap. Replace sprint references with descriptive TODO labels.

**Custom YAML Parser in Write Gate:**
- Issue: `src/runtime/execution/write_gate.mjs` lines 52-88 implement a hand-rolled YAML parser instead of using the `yaml` package (which is already a project dependency in `package.json`).
- Files: `src/runtime/execution/write_gate.mjs`
- Impact: The custom parser only handles a narrow subset of YAML. Any policy file changes that use standard YAML features (nested lists, multi-line strings, anchors) will silently fail. This is a security-sensitive file (write gate policy).
- Fix approach: Replace `parseSimpleYaml()` with `import yaml from 'yaml'` (already in `package.json` dependencies). Convert the file from `.mjs` to `.ts` for type safety.

**Deprecated API Still Exported:**
- Issue: `src/adapters/write_executor/index.mjs` line 287-292 exports a deprecated `execute()` function that logs a warning but still works, bypassing the mandatory `executeWithGate()` preflight checks.
- Files: `src/adapters/write_executor/index.mjs`
- Impact: Callers can accidentally bypass governance gates by using the old API. The warning-only approach does not enforce the migration.
- Fix approach: Remove the deprecated export or make it throw an error directing callers to `executeWithGate()`.

**Legacy Test Framework (27 files):**
- Issue: 27 test files use `test_*.mjs` naming with raw `assert` from Node.js stdlib, while 11 newer test files use `*.test.ts` / `*.spec.ts` with vitest. The vitest config explicitly excludes one test file (`tests/runtime/memory-gateway.test.mjs`). The two test styles are incompatible.
- Files: `tests/reasoning/test_*.mjs`, `tests/execution/test_*.mjs`, `tests/governance/test_*.mjs` (legacy) vs. `tests/trial-run/*.test.ts`, `tests/orchestrator/*.test.ts`, `tests/gateway/**/*.spec.ts` (modern)
- Impact: `npm test` (vitest) does not run the 27 legacy `.mjs` tests. No CI evidence that legacy tests pass. Duplicate coverage or gaps between the two suites.
- Fix approach: Migrate legacy `test_*.mjs` files to `*.test.ts` using vitest. Remove the explicit exclusion in `vitest.config.ts`.

**Vitest Picks Up Third-Party Test Files:**
- Issue: `vitest.config.ts` excludes `Extensions/**` and `websites/**` but does not exclude `examples/**`. The `examples/wecom/` directory contains `node_modules/` with test files (blake3-wasm, wrangler) that vitest discovers and fails on (13 failures in current test run).
- Files: `vitest.config.ts`
- Impact: `npm test` reports 13 false failures from third-party code, masking real test results. CI would always fail.
- Fix approach: Add `'examples/**'` to the `exclude` array in `vitest.config.ts`.

## Known Bugs

**Vitest False Failures from examples/wecom/node_modules:**
- Symptoms: Running `npx vitest --run` reports 13 failed test files, all from `examples/wecom/node_modules/blake3-wasm/` and `examples/wecom/node_modules/wrangler/`. Error: `ReferenceError: describe is not defined`.
- Files: `vitest.config.ts` (missing exclusion)
- Trigger: Run `npm test` or `npx vitest --run`
- Workaround: Add `'examples/**'` to vitest exclude config.

## Security Considerations

**XOR "Encryption" in Credential Vault:**
- Risk: `src/runtime/mcp/security/vault.py` uses XOR cipher with SHA-256 key derivation for "encrypting" the credential vault. XOR cipher is trivially reversible and provides zero real security. The code explicitly acknowledges this: "Uses simple XOR encryption for portability. For production, consider using cryptography library." Additionally, when no master key is provided, credentials are stored as plain JSON.
- Files: `src/runtime/mcp/security/vault.py` lines 278-318
- Current mitigation: Environment variables are checked first (priority 1), so the vault file may not be used in practice.
- Recommendations: Replace XOR cipher with `cryptography.fernet` (Python) or remove the vault file approach entirely in favor of env-var-only credential management. Never store credentials in a file with reversible XOR.

**Function() Constructor for Expression Evaluation:**
- Risk: `src/reasoning/explanation/build_explanation.mjs` line 116 uses `Function('"use strict"; return (' + expr + ')')()` to evaluate decision logic expressions. While the input is transformed from internal playbook definitions (not user input), this is a code injection vector if the signal/target data is ever derived from external sources.
- Files: `src/reasoning/explanation/build_explanation.mjs` line 116
- Current mitigation: Input comes from internal playbook YAML definitions and signal objects, not directly from user input. The expressions are string-replaced before evaluation.
- Recommendations: Replace `Function()` with a safe expression evaluator library (e.g., `expr-eval`, `mathjs`). This eliminates the injection vector entirely.

**CORS Wildcard on HTTP Gateway:**
- Risk: `src/gateway/openclaw/http_routes.ts` line 77 sets `Access-Control-Allow-Origin: *`, allowing any origin to access the trace API. Combined with the unauthenticated HTTP routes (no HMAC check on HTTP, only on WebSocket), this exposes trace data to any web page.
- Files: `src/gateway/openclaw/http_routes.ts` lines 77-79
- Current mitigation: The HTTP server only exposes read-only trace queries and health checks. WebSocket (write operations) requires HMAC authentication.
- Recommendations: Restrict CORS to known origins. Add authentication to HTTP routes, or at minimum restrict to localhost.

**HTTP Routes Have No Authentication:**
- Risk: The WebSocket server at `src/gateway/openclaw/ws_server.ts` requires HMAC token authentication, but the HTTP server at `src/gateway/openclaw/http_routes.ts` has no authentication whatsoever. Anyone who can reach the HTTP port can read all trace data.
- Files: `src/gateway/openclaw/http_routes.ts`, `src/gateway/openclaw/server.ts`
- Current mitigation: Server likely runs on localhost only, but no bind-address restriction is enforced.
- Recommendations: Add HMAC authentication to HTTP routes, or at minimum bind to `127.0.0.1`.

**Unsafe `as` Cast on WebSocket Params:**
- Risk: `src/gateway/openclaw/ws_server.ts` line 79 casts `params as GovToolCallRequestV1` without proper validation, then only checks the `version` field. Malformed payloads could cause runtime errors deeper in the call chain.
- Files: `src/gateway/openclaw/ws_server.ts` line 79
- Current mitigation: The version field check provides minimal validation.
- Recommendations: Use a schema validation library (ajv is already a dependency) to validate the full request shape before processing.

## Performance Bottlenecks

**Polling Loop in Job Runner (300 iterations, 1s each):**
- Problem: `src/gateway/openclaw/job_runner.ts` uses a polling loop with `MAX_POLL_ATTEMPTS = 300` and `POLL_INTERVAL_MS = 1000`, meaning a single job can block for up to 5 minutes with 300 HTTP requests to the AGE API.
- Files: `src/gateway/openclaw/job_runner.ts` lines 25, 245-315
- Cause: Polling-based architecture instead of event-driven (webhooks or server-sent events). Each poll is a full HTTP round-trip.
- Improvement path: Implement WebSocket-based event streaming from AGE, or use exponential backoff instead of fixed 1s intervals. Consider a job queue with callbacks.

**Synchronous File Reads at Module Load Time:**
- Problem: Several modules read config/policy files synchronously during module initialization (top-level scope), blocking the event loop during import.
- Files:
  - `src/runtime/execution/write_gate.mjs` lines 27-47 (reads YAML policy + JSON allowlist at import)
  - `src/config/load.js` (reads YAML configs on first call, but caches)
- Cause: `readFileSync` in module-level scope.
- Improvement path: Lazy-load configs on first use, or use async initialization.

## Fragile Areas

**Write Gate / Execution Pipeline:**
- Files: `src/runtime/execution/write_gate.mjs`, `src/runtime/execution/real_executor.mjs`, `src/runtime/execution/dry_run_executor.mjs`, `src/runtime/execution/kill_switch.mjs`, `src/runtime/execution/four_key_gate.mjs`, `src/runtime/execution/quota_gate.mjs`
- Why fragile: Six interdependent modules form the write execution pipeline, all in plain `.mjs` without types. The write gate loads a scope allowlist from an unrelated `examples/feishu/` directory (line 41-42 of `write_gate.mjs`). Environment variables (`WRITE_ENABLED`, `KILL_SWITCH`, `DENY_READONLY_ENV`) control critical safety behavior with no centralized validation.
- Safe modification: Always test with `WRITE_ENABLED=0` first. Verify all 4 gate layers pass before enabling writes. Run `tests/runtime/execution/test_write_gate_p6c.mjs` and related tests.
- Test coverage: Tests exist in `tests/runtime/execution/` but they use the legacy `assert` style and are not part of the vitest suite.

**Governance Trace System:**
- Files: `src/governance/trace/trace_writer.mjs`, `src/governance/trace/trace_reader.mjs`, `src/governance/replay.mjs`
- Why fragile: The trace system uses file-based storage with hash chains for integrity. The `TRACE_BASE_DIR` default path (`.liye/traces`) is hardcoded across 8+ files with no single source of truth. Breaking the hash chain silently corrupts the audit trail.
- Safe modification: Never change event format without updating both writer and reader. Test with `tests/governance/` suite.
- Test coverage: Legacy test suite only (`tests/governance/test_*.mjs`).

**Reasoning Explanation Engine:**
- Files: `src/reasoning/explanation/build_explanation.mjs`, `src/reasoning/explanation/explain_observation.mjs`
- Why fragile: Uses `Function()` constructor for expression evaluation. The playbook matching depends on exact observation ID strings. Adding new observation types requires coordinated changes across playbook definitions, explanation builder, and tests.
- Safe modification: Always add snapshot tests when introducing new observation types (see `tests/reasoning/test_p1_observations_snapshot.mjs` as pattern).
- Test coverage: Good snapshot coverage in `tests/reasoning/` but uses legacy test framework.

## Scaling Limits

**File-Based Trace Storage:**
- Current capacity: Works for development and low-volume usage.
- Limit: Traces stored in individual files under `.liye/traces/` and `state/traces/`. No indexing, no cleanup, no rotation. Thousands of traces will slow directory listing and trace search operations.
- Scaling path: Migrate to SQLite (already a dependency pattern in the codebase) or DuckDB for trace storage. Implement trace retention policies.

## Dependencies at Risk

**Python Code Without Dependency Management:**
- Risk: 35 Python files exist in `src/runtime/mcp/` and `src/runtime/policy/` but there is no `requirements.txt` or `pyproject.toml` at the project root or in `src/`. Only `tools/web-publisher/requirements.txt` and `systems/site-deployer/requirements.txt` exist for their respective subprojects. Python dependencies are undeclared.
- Impact: Python MCP servers (`src/runtime/mcp/server_main.py`) may fail on clean installs due to missing dependencies. No reproducible environment.
- Migration plan: Add a `requirements.txt` or `pyproject.toml` at project root covering `src/runtime/mcp/` and `src/runtime/policy/` Python code. Pin dependency versions.

**Hardcoded Model References:**
- Risk: `src/config/load.js` line 17 hardcodes `'gpt-5.2-thinking'` as default model, and model aliases are baked into the config. Model availability changes from OpenAI will break defaults.
- Impact: If the hardcoded model is deprecated or renamed, the system falls back to broken defaults silently.
- Migration plan: Move model defaults to `config/brokers.yaml` (external config) rather than embedding in code.

## Missing Critical Features

**No Linting or Formatting Enforcement:**
- Problem: No ESLint, Prettier, Biome, or any code formatting tool is configured. No linting rules in `package.json` devDependencies. No `.eslintrc`, `.prettierrc`, or `biome.json` files exist.
- Blocks: Consistent code style across the mixed JS/MJS/TS codebase. Automated catching of common bugs (unused variables, unreachable code, type mismatches in JS files).

**No CI/CD Pipeline Detected:**
- Problem: No `.github/workflows/`, `Jenkinsfile`, `.gitlab-ci.yml`, or similar CI configuration was found. Tests are not automatically run on push/PR.
- Blocks: Automated regression detection. The 13 false test failures from `examples/wecom/` would have been caught immediately in CI.

## Test Coverage Gaps

**CJS Module Layer Completely Untested:**
- What's not tested: `src/brokers/*.js` (5 files: claude, codex, gemini, antigravity, registry), `src/config/*.js` (3 files: load, safety, approval), `src/mission/*.js` (5 files: types, run, ingest, utils, summary, new), `src/context/*.js` (2 files), `src/analytics/cost-report.js`.
- Files: `src/brokers/`, `src/config/`, `src/mission/`, `src/context/`, `src/analytics/`
- Risk: The broker layer is the primary interface to external AI CLIs (codex, claude, gemini). Configuration loading and safety scanning have zero test coverage. Mission lifecycle (create, run, ingest, summarize) is untested.
- Priority: High -- these are core runtime paths.

**MCP Server Untested:**
- What's not tested: `src/mcp/server.mjs`, `src/mcp/tools.mjs`, `src/mcp/validator.mjs` -- the governance MCP server has no tests.
- Files: `src/mcp/server.mjs`, `src/mcp/tools.mjs`, `src/mcp/validator.mjs`
- Risk: The MCP server exposes governance tools via JSON-RPC. Protocol-level bugs (malformed responses, missing error handling) would not be caught.
- Priority: Medium.

**Gateway HTTP Routes Untested:**
- What's not tested: `src/gateway/openclaw/http_routes.ts` has no test coverage. Only `trace_store.spec.ts` and `job_runner.spec.ts` exist for the gateway.
- Files: `src/gateway/openclaw/http_routes.ts`
- Risk: CORS, routing, and error handling in the HTTP API are unverified.
- Priority: Medium.

**Python MCP Layer Has Minimal Tests:**
- What's not tested: `src/runtime/mcp/tests/test_mcp_basic.py` exists but the Python test infrastructure is not integrated with the main test runner. Policy engine (`src/runtime/policy/`), vault (`src/runtime/mcp/security/vault.py`), adapters (`src/runtime/mcp/adapters/`), and MCP servers are largely untested.
- Files: `src/runtime/mcp/`, `src/runtime/policy/`
- Risk: The vault's XOR encryption, credential lookup, and policy evaluation logic have no automated verification.
- Priority: High -- security-sensitive code.

---

*Concerns audit: 2026-04-13*
