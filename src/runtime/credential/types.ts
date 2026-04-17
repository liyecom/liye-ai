/**
 * BGHS Credential Mediation — Types
 * Location: src/runtime/credential/types.ts
 *
 * Mirrors ADR-Credential-Mediation §1–§6. Sprint 2 Wave 2.1 lands the
 * seam: types, reference parser, SecretValue wrapper, and
 * EnvCredentialBroker reference implementation. Component Declaration
 * integration (§5/§7) and full SessionAdjacentRegistry wiring land in
 * later sprints.
 */

// === §1 CredentialReference ===

export type CredentialReference = string;  // "cred://<owner>/<name>[?<qualifier>=<value>&...]"

export interface ParsedCredentialRef {
  scheme: 'cred';
  owner: string;
  name: string;
  qualifiers: Record<string, string>;
}

export class InvalidCredentialReferenceError extends Error {
  constructor(readonly input: string, readonly reason: string) {
    super(`invalid credential reference "${input}": ${reason}`);
    this.name = 'InvalidCredentialReferenceError';
  }
}

// === §6 SecretValue ===

/**
 * Opaque wrapper around a raw credential string.
 *
 * Contract (ADR §6):
 *   - JSON.stringify / String() / debug-print MUST produce a masked
 *     placeholder; never the raw value.
 *   - reveal() is the single sanctioned path to the raw string; callers
 *     must drop the reference as soon as it's been used.
 */
export interface SecretValue {
  reveal(): string;
  toJSON(): '***REDACTED***';
  toString(): '***REDACTED***';
}

// === §2 BrokerScope / ResolutionContext / ResolutionResult ===

export interface BrokerScope {
  owners_served: string[];
  layer: 0 | 1 | 2;
}

export interface ResolutionContext {
  requester_component_id: string;
  requester_layer: 0 | 1 | 2 | 3;
  purpose: string;
  /**
   * Points at the policy / approval record that authorized this access.
   * v1 permits null (Sprint 2 bootstrap) — policy ADRs tighten this
   * later by making it required for DecisionKind.CREDENTIAL_ACCESS.
   */
  authorization_ref: string | null;
}

export type ResolutionOutcome = 'resolved' | 'denied' | 'not-found' | 'broker-error';

export type ResolutionResult =
  | { outcome: 'resolved'; value: SecretValue; audit_id: string }
  | { outcome: 'denied'; denial_reason: string; audit_id: string }
  | { outcome: 'not-found'; audit_id: string }
  | { outcome: 'broker-error'; error: string; audit_id: string };

// === §4 CredentialAuditRecord ===

export interface CredentialAuditAppendInput {
  credential_path: CredentialReference;
  requester_component_id: string;
  requester_layer: 0 | 1 | 2 | 3;
  purpose: string;
  outcome: ResolutionOutcome;
  chain_step: number;
  chain_result: string;
  redacted_value_hint: string | null;
  authorization_ref: string | null;
  broker_id: string;
  resolved_at: string;
}

export interface CredentialAuditRecord extends CredentialAuditAppendInput {
  artifact_id: string;
  adjacent_kind: 'credential-audit';
  owner: { component_id: string; layer: 0 | 1 | 2 };
  // NOTE: derived_from / hash_self / storage_location / format_kind /
  // is_append_only / audit_subject / registered_by_adr / created_at are
  // set by the session-adjacent registration step (later sprint). This
  // Sprint-2 shape is the seam-level payload.
}

export interface CredentialAuditSink {
  append(input: CredentialAuditAppendInput): Promise<string>;   // returns audit_id
  list(): readonly CredentialAuditRecord[];
}

// === §2 CredentialBroker ===

export interface CredentialBroker {
  readonly broker_id: string;
  readonly declared_scope: BrokerScope;
  readonly audit_sink: CredentialAuditSink;

  resolve(ref: CredentialReference, ctx: ResolutionContext): Promise<ResolutionResult>;

  invalidate?(ref: CredentialReference): Promise<void>;
  refresh?(ref: CredentialReference): Promise<void>;
}

// === §5 CredentialBinding (for Component Declaration integration) ===

export interface CredentialBinding {
  ref: CredentialReference;
  purpose: string;
  broker_required: 'any' | string;
}
