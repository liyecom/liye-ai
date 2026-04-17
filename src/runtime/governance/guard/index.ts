/**
 * BGHS Guard — barrel
 * Location: src/runtime/governance/guard/index.ts
 */

export {
  GuardKind,
  GuardVerdict,
  GuardEnforcementMode,
  ProtectedPathKind,
  PROTECTED_PATHS_WHITELIST,
} from './types';

export type {
  GuardEvidence,
  GuardEvidenceSink,
  GuardChain,
  GuardChainStep,
  GuardRegisterResult,
  GuardRegisterFailureCode,
  GuardRunInput,
  HitDetail,
  ScannedPath,
  ProtectedScannedPathKind,
  ProtectedPath,
  VerdictRouting,
} from './types';

export {
  redactSnippet,
  looksSensitive,
  makeEvidence,
  normalizeHit,
  InMemoryGuardEvidenceSink,
} from './evidence';

export {
  ShadowRunner,
  NoopScanner,
  AlwaysDangerousScanner,
  type Scanner,
  type ScannerResult,
  type ShadowRunnerOptions,
  type ShadowRunOutput,
} from './shadow_runner';

export { GuardChainRegistry } from './chain_registry';
