/**
 * BGHS Wake/Resume — barrel
 * Location: src/runtime/governance/wake/index.ts
 */

export type {
  WakeResumeEntrypoint,
  ResourceContext,
  StateSnapshot,
  GovernanceFields,
  SnapshotRef,
  PreflightContract,
  ReplayContract,
  ResumeFailureMode,
  RegisterResult,
  RegisterResultOk,
  RegisterResultFail,
} from './types';

export {
  KNOWN_FAILURE_MODES,
  SNAPSHOT_BYPASSABLE,
  RESOURCE_CONTEXT_REQUIRED_FIELDS,
} from './types';

export { WakeResumeRegistry } from './validator';
