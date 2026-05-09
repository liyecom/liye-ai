/**
 * BGHS Session Registry — barrel
 * Location: src/runtime/governance/session/index.ts
 */

export { ArtifactClass } from './types';
export type {
  SessionEventStream,
  StreamOwner,
  StreamScope,
  StreamFormat,
  RetentionPolicy,
  RegistryEntry,
  RegisterResult,
  RegisterResultOk,
  RegisterResultFail,
  RegisterFailureCode,
  StreamFilter,
  StreamRef,
  StreamRefKind,
  OwnerLayer,
} from './types';

export { StreamRegistry } from './stream_registry';
export { validateStrict, validateProvisional } from './validator';
