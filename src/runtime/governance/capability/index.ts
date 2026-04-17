/**
 * BGHS Capability — barrel
 * Location: src/runtime/governance/capability/index.ts
 *
 * See README.md in this directory for the hard boundary against
 * src/control/registry.ts (AI-agent capability registry). Cross-
 * imports between the two trees are forbidden.
 */

export type {
  CapabilityKind,
  CapabilityKindRegistration,
  KindStatus,
  OwnerLayer,
  CapabilityOwner,
  SideEffectDecl,
  TrustBoundaryFsScope,
  TrustBoundaryNetworkScope,
  TrustBoundaryDecl,
  CapabilityStatus,
  CapabilityRegistration,
  DecisionAuthority,
  OperatorScope,
  GatewayMethodRegistration,
  KindRegisterResult,
  CapabilityRegisterResult,
  DecisionAuthorityRegisterResult,
  CapabilityKindFailureCode,
  CapabilityRegisterFailureCode,
  DecisionAuthorityFailureCode,
} from './types';

export {
  DecisionKind,
  CAPABILITY_KIND_RE,
  RESERVED_OPERATOR_ADMIN_NAMESPACES,
} from './types';

export { CapabilityKindRegistry } from './kind_registry';
export { CapabilityRegistry, DecisionAuthorityRegistry } from './registry';
