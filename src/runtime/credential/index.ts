/**
 * BGHS Credential Mediation — barrel
 * Location: src/runtime/credential/index.ts
 */

export type {
  CredentialReference,
  ParsedCredentialRef,
  BrokerScope,
  ResolutionContext,
  ResolutionResult,
  ResolutionOutcome,
  SecretValue,
  CredentialAuditRecord,
  CredentialAuditAppendInput,
  CredentialAuditSink,
  CredentialBroker,
  CredentialBinding,
} from './types';

export { InvalidCredentialReferenceError } from './types';

export {
  parseCredentialRef,
  isValidCredentialRef,
} from './reference';

export {
  wrapSecret,
  SECRET_MASK,
} from './secret_value';

export { InMemoryCredentialAuditSink } from './audit';

export {
  EnvCredentialBroker,
  type EnvBrokerConfig,
} from './broker';
