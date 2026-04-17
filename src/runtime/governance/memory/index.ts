/**
 * BGHS Memory — barrel
 * Location: src/runtime/governance/memory/index.ts
 *
 * See README.md in this directory for the hard boundary against
 * `src/runtime/memory/` (the pre-existing execution-face memory
 * module) and Loamwise `align/` (retrieval engine). Cross-imports
 * between governance and execution trees are forbidden.
 */

export {
  MemoryTier,
  tierRank,
  canDeriveTo,
} from './types';

export type {
  MemoryRecord,
  MemoryRecordSource,
  MemoryRecordSourceLayer,
  GuardEvidenceRef,
  MemoryRetrievalRequest,
  MemoryRetrievalTriggeredBy,
  RetrievalPurpose,
  QueryMode,
  StructuredQuery,
  RetrievalFragment,
  RetrievalResult,
  MemoryAssemblyPlan,
  RetrievalSpec,
  AssemblyStep,
  AssemblyStepKind,
  MemoryWriteSpec,
  MemoryUsePolicy,
  DerivationRule,
  WriteActorRule,
  WriteActorKind,
  GuardKindId,
  DecisionKindId,
  FrozenSnapshot,
  MemoryWriteRequest,
  AssemblyFragmentIngestRequest,
  UsePolicyFailureCode,
  UsePolicyRegisterResult,
  PlanFailureCode,
  PlanRegisterResult,
  PlanFreezeResult,
  RecordFailureCode,
  RecordRegisterResult,
  RetrievalFailureCode,
  RetrievalValidateResult,
  GuardedWriteFailureCode,
  GuardedMemoryWriteResult,
  FragmentIngestFailureCode,
  GuardedFragmentIngestResult,
} from './types';

export { MemoryUsePolicyRegistry } from './use_policy_registry';
export { MemoryRecordRegistry } from './record_registry';
export { MemoryPlanRegistry } from './plan_registry';
export { buildFrozenSnapshot } from './snapshot';
export { validateRetrievalRequest, DEFAULT_QUERY_MODE } from './retrieval';

export {
  guardedMemoryWrite,
  guardedAssemblyFragmentIngest,
  type GuardedMemoryWriteOptions,
  type GuardedFragmentIngestOptions,
} from './guard_wire';
