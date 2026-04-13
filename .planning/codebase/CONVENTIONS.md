# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- TypeScript source files: `snake_case.ts` for modules (e.g., `market_research.ts`, `trace_store.ts`, `job_runner.ts`)
- TypeScript type files: `types.ts` in each directory
- Barrel exports: `index.ts` in each directory
- Hyphenated names for multi-word modules: `discovery-policy.ts`, `a3-write-policy.ts`, `control-plane.test.ts`
- JavaScript modules: `.mjs` extension for ESM (e.g., `enforce.mjs`, `gate.mjs`, `trace_writer.mjs`)
- Test files: `.test.ts` for main project, `.spec.ts` for gateway and Extensions

**Functions:**
- camelCase for all functions: `inferSideEffect()`, `extractFromAgentYAML()`, `scanAgentYAMLs()`
- Verb-first naming: `generateToken()`, `verifyToken()`, `buildGovRequest()`
- Private methods: camelCase without prefix underscore: `private load()`, `private save()`
- Factory/builder functions: `create*` or `build*` pattern: `createDenyRule()`, `buildGovRequest()`

**Variables/Constants:**
- camelCase for local variables and parameters: `traceId`, `taskResults`, `trustUpdates`
- UPPER_SNAKE_CASE for module-level constants: `EMA_ALPHA`, `COLD_START_SCORE`, `POLL_INTERVAL_MS`, `MAX_POLL_ATTEMPTS`
- Constants with default values: `DEFAULT_` prefix: `DEFAULT_MIN_TRUST`, `DEFAULT_APPROVAL_TIMEOUT_MS`, `DEFAULT_TRUST`

**Types/Interfaces:**
- PascalCase for interfaces and types: `AgentCard`, `CapabilityContract`, `TrustProfile`
- Prefix `I` for abstract interfaces (dependency inversion): `ICapabilityRegistry`, `IDiscoveryPolicy`, `IExecutionPolicy`, `ITrustStore`
- Union type aliases: PascalCase: `SideEffect`, `ProcessMode`, `DAGNodeStatus`
- Result types: `*Result` suffix: `ExecutionPolicyResult`, `OrchestrationResult`, `ResolvedTaskResult`
- Enum-like objects in `.mjs`: `Object.freeze({...})` with PascalCase name: `GateDecision`, `RuleEffect`, `TraceEventType`

**Classes:**
- PascalCase: `CapabilityRegistry`, `TrustScoreStore`, `DAGScheduler`, `OrchestrationEngine`
- Singleton accessor: `get*()` function: `getCapabilityRegistry()`, `getDomainRegistry()`

## Code Style

**Formatting:**
- No dedicated formatter config (no `.prettierrc`, `.eslintrc` in root project)
- Extensions/slack-proxy has ESLint configured
- 2-space indentation throughout
- Single quotes for strings in TypeScript
- Semicolons always used
- Trailing commas in multiline structures

**TypeScript Configuration (`tsconfig.json`):**
- Target: ES2022
- Module: NodeNext / ModuleResolution: NodeNext
- Strict mode: enabled
- Declaration maps: enabled
- ESM interop: enabled

## Import Organization

**Order:**
1. Node.js built-in modules: `import * as fs from 'fs'`, `import { createHmac } from 'crypto'`
2. Third-party packages: `import * as yaml from 'js-yaml'`, `import { describe, it, expect } from 'vitest'`
3. Internal absolute paths: `import { CapabilityRegistry } from '../../src/control/registry'`
4. Relative imports: `import { TraceStore } from './trace_store'`

**Import style:**
- Named imports preferred: `import { AgentCard, TrustProfile } from './types'`
- Namespace imports for Node builtins: `import * as fs from 'fs'`, `import * as path from 'path'`
- Type-only imports used where applicable: `import type { Task, TaskResult } from '../executor/types'`
- In `.mjs` files: named imports from local modules: `import { GateDecision, RuleEffect } from './types.mjs'`

**Path Aliases:**
- None configured. All imports use relative paths (`../../`, `../`, `./`).

## Error Handling

**Patterns:**
- Silent catch for non-critical operations (persistence, trace writing):
  ```typescript
  try {
    // file I/O
  } catch {
    // Start fresh if load fails
  }
  ```
- Bare `catch` blocks (no error parameter) for ignored errors: `catch { }` in `src/control/trust.ts`, `src/control/extractor.ts`, `src/runtime/orchestrator/engine.ts`
- Error type narrowing with `instanceof Error`:
  ```typescript
  catch (error) {
    verdictSummary = error instanceof Error ? error.message : 'Unknown error occurred';
  }
  ```
- Validation-first pattern: validate input at function entry, return error objects (not exceptions):
  ```typescript
  function validateRequest(req): { valid: boolean; reason?: string } { ... }
  ```
- Conservative fail-closed: Unknown inputs default to the restrictive option (e.g., unknown skill -> `write` side effect)

**Guidelines for new code:**
- Use bare `catch {}` only for truly non-fatal operations (file persistence, trace logging)
- Use validation-first for request/input checking -- return `{ valid: boolean; reason?: string }` or `{ ok: boolean; errors?: string[] }`
- Never throw in constructor; initialize gracefully from empty state
- Use `existsSync()` checks before file operations rather than try/catch for expected missing files

## Logging

**Framework:** None (no logging framework). Console is used sparingly.

**Patterns:**
- `console.log()` only in test metric reporting and demo scripts
- Source modules are silent -- no logging in `src/control/`, `src/gateway/`, `src/runtime/`
- Trace writing replaces logging: structured events written to `TraceStore` or JSON trace files

## Comments

**When to Comment:**
- Module-level JSDoc block required at top of every file:
  ```typescript
  /**
   * LiYe AI [Component Name]
   * Location: src/path/to/file.ts
   *
   * [Brief description of purpose]
   * [Fix references if applicable]
   */
  ```
- Fix references: `[Fix #N]` annotations inline where a specific design fix was applied
- Section separators in test files using comment blocks:
  ```typescript
  // ============================================================
  // Phase 0: Extractor
  // ============================================================
  ```
- JSDoc `@param` and `@returns` used in `.mjs` files; TypeScript files rely on type signatures instead

**JSDoc/TSDoc:**
- `.mjs` files use full JSDoc with `@param`, `@returns`, `@typedef`
- `.ts` files use brief `/** ... */` descriptions without param tags (types serve as documentation)
- `@readonly @enum` used for frozen enum-like objects in `.mjs`

## Function Design

**Size:**
- Functions are generally 10-40 lines
- Longer orchestration methods (e.g., `executeLoop` at ~80 lines) are acceptable for pipeline logic
- Helper functions extracted for reuse: `matchesRule()`, `jaccardSimilarity()`, `extractTagsFromSkillId()`

**Parameters:**
- Options object pattern for constructors and complex functions:
  ```typescript
  constructor(opts: { decomposer: RuleBasedDecomposer; router: CapabilityRouter; ... })
  ```
- Simple functions use positional parameters (up to ~4)
- Default parameter values using `=` syntax: `minTrust: number = DEFAULT_MIN_TRUST`

**Return Values:**
- Result objects for operations: `{ valid: boolean; reason?: string }`, `{ allowed: boolean; autonomy: string }`
- `undefined` or `null` for "not found": `findAgent(id): AgentCard | undefined`
- Async generators for streaming: `async function* runGovernedToolCall(): AsyncGenerator<StreamChunkV1>`

## Module Design

**Exports:**
- Named exports preferred over default exports
- Default export added as secondary alongside named: `export default CapabilityRegistry`
- `export type { ... }` used in barrel files to re-export types without runtime overhead

**Barrel Files:**
- Every major directory has an `index.ts` barrel file
- Pattern: types exported first, then implementations
- Barrel files document the public API of each layer:
  ```typescript
  // Types & Interfaces
  export type { CapabilityContract, AgentCard, ... } from './types';
  // Implementations
  export { CapabilityRegistry } from './registry';
  ```

## Dual Language Convention

**TypeScript (`.ts`):**
- Used for typed system code: control plane, orchestrator, gateway, scheduler
- Strict mode, full type annotations
- `interface` for data shapes; `class` for stateful services
- `type` for unions and aliases

**JavaScript ESM (`.mjs`):**
- Used for governance kernel, MCP server, reasoning engine, CLI scripts
- JSDoc for type documentation (no transpilation needed)
- `Object.freeze()` for enum-like constants
- Functions exported directly (no classes)
- `@typedef` for complex types in comments

**When to use which:**
- New system/runtime code: TypeScript (`.ts`)
- New governance/policy/script code: check existing neighbors; governance kernel uses `.mjs`
- New test files: always TypeScript (`.test.ts` or `.spec.ts`)

---

*Convention analysis: 2026-04-13*
