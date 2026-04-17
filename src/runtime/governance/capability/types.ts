/**
 * BGHS Capability — Types
 * Location: src/runtime/governance/capability/types.ts
 *
 * Mirrors ADR-OpenClaw-Capability-Boundary §1–§5. This tree is the
 * **BGHS** capability registry — distinct from src/control/registry.ts
 * (the AI-agent CapabilityRegistry). See README.md in this directory
 * for the no-cross-import rule.
 *
 * Sprint 4 scope:
 *   - CapabilityKindRegistry (Layer 0 exclusive definitions)
 *   - CapabilityRegistry (Layer 1/2/3 submissions)
 *   - Runtime validators for B1/B2/B4, DecisionAuthority.override_allowed=false,
 *     operator_scope reserved namespaces.
 * Out of scope: DecisionAuthority runtime enforcement, GatewayMethodRegistration
 * routing, SessionEventStream writeback on registration (comes after
 * SessionRegistry integration in a later sprint).
 */

// === §1 CapabilityKind ===

/**
 * Globally unique capability kind, defined exclusively by Layer 0.
 * Minimum naming pattern (Sprint 4): dotted segments, each segment
 * `[a-z][a-z0-9-]*`, at least 2 segments, no trailing dot. Version
 * suffixes and deeper grammars are up to later contract schemas.
 */
export type CapabilityKind = string;

export const CAPABILITY_KIND_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

export type KindStatus = 'proposed' | 'active' | 'frozen' | 'superseded';

export interface CapabilityKindRegistration {
  kind: CapabilityKind;
  layer_introduced: 0;            // schema-forced (B1)
  contract_adr: string;           // required
  contract_schema: string;        // required; points at the JSON/YAML schema file
  introduced_at: string;          // ISO 8601
  superseded_by: string | null;
  status: KindStatus;
}

// === §2 CapabilityRegistration ===

export type OwnerLayer = 1 | 2 | 3;

export interface CapabilityOwner {
  layer: OwnerLayer;
  component: string;
  declaration_path: string;
}

export interface SideEffectDecl {
  kind: 'fs-write' | 'network-egress' | 'external-api' | 'process-spawn' | 'db-write';
  target: string;                 // path / hostname / endpoint — already scoped by trust_boundary
  notes?: string;
}

// === §4 TrustBoundaryDecl ===

export interface TrustBoundaryFsScope {
  read_roots: string[];
  write_roots: string[];
}

export interface TrustBoundaryNetworkScope {
  egress_allowlist: string[];
  ingress: 'none' | 'gateway-only';
}

export interface TrustBoundaryDecl {
  fs_scope: TrustBoundaryFsScope;
  network_scope: TrustBoundaryNetworkScope;
  in_process: boolean;
  credential_path: string | null;      // points at CredentialBroker seam (P1-f)
}

export type CapabilityStatus = 'pending' | 'active' | 'quarantined' | 'revoked';

export interface CapabilityRegistration {
  capability_id: string;          // e.g. "amazon-growth-engine:bid_write"
  kind: CapabilityKind;
  owner: CapabilityOwner;
  trust_boundary: TrustBoundaryDecl;
  side_effects: SideEffectDecl[];
  observed_by: string[] | null;
  registered_at: string;
  status: CapabilityStatus;
}

// === §3 Decision plane ===

export enum DecisionKind {
  CAPABILITY_ADMISSION = 'capability.admission',
  APPROVAL = 'approval',
  TOOL_SAFETY = 'tool.safety',
  OPERATOR_SCOPE = 'operator.scope',
  SESSION_WRITE = 'session.write',
}

export interface DecisionAuthority {
  kind: DecisionKind;
  authoritative_layer: 0 | 1;
  authoritative_path: string;
  observers_allowed: string[];
  override_allowed: false;        // schema-forced (B3)
}

// === §5 Operator scope ===

export type OperatorScope = 'operator.admin' | 'operator.write' | 'operator.read';

export interface GatewayMethodRegistration {
  method: string;
  scope_required: OperatorScope;
  capability_id: string | null;
  audit_required: boolean;
}

/**
 * Reserved gateway namespaces — Layer 0 rejects any plugin that tries
 * to register a capability binding to a method in these namespaces.
 * Sprint 4 captures the ADR's §5 reserved set; Gateway enforcement
 * lands with the gateway wiring sprint.
 */
export const RESERVED_OPERATOR_ADMIN_NAMESPACES: readonly string[] = [
  'config.',
  'exec.approvals.',
  'wizard.',
];

// === Register result ===

export type CapabilityKindFailureCode =
  | 'INVALID_KIND_NAME'
  | 'DUPLICATE_KIND'
  | 'LAYER_INTRODUCED_MUST_BE_ZERO'
  | 'MISSING_CONTRACT_ADR'
  | 'MISSING_CONTRACT_SCHEMA'
  | 'INVALID_STATUS';

export type CapabilityRegisterFailureCode =
  | 'UNKNOWN_KIND'
  | 'DUPLICATE_ACTIVE'
  | 'INVALID_OWNER_LAYER'
  | 'MISSING_DECLARATION_PATH'
  | 'MISSING_TRUST_BOUNDARY'
  | 'EMPTY_NETWORK_SCOPE_ON_NETWORK_SIDE_EFFECT'
  | 'INVALID_CAPABILITY_ID_FORMAT';

export type DecisionAuthorityFailureCode =
  | 'OVERRIDE_ALLOWED_MUST_BE_FALSE'
  | 'INVALID_AUTHORITATIVE_LAYER'
  | 'MISSING_AUTHORITATIVE_PATH';

export type KindRegisterResult =
  | { ok: true; kind: CapabilityKind }
  | { ok: false; code: CapabilityKindFailureCode; detail?: string };

export type CapabilityRegisterResult =
  | { ok: true; capability_id: string }
  | { ok: false; code: CapabilityRegisterFailureCode; detail?: string };

export type DecisionAuthorityRegisterResult =
  | { ok: true; kind: DecisionKind }
  | { ok: false; code: DecisionAuthorityFailureCode; detail?: string };
