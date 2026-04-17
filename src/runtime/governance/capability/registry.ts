/**
 * BGHS Capability — CapabilityRegistry (Layer 1/2/3 submissions)
 * Location: src/runtime/governance/capability/registry.ts
 *
 * ADR-OpenClaw-Capability-Boundary §2 + B2/B4. Enforces:
 *   - B1  kind must be registered in CapabilityKindRegistry.
 *   - B2  duplicate active capability_id → reject; supersede requires
 *         the previous entry to move to a non-active status first.
 *   - B4  TrustBoundaryDecl must be present; fs_scope/network_scope
 *         objects are required (empty arrays allowed = fail-closed).
 *         Any side_effect of kind 'network-egress' must have a
 *         non-empty network_scope.egress_allowlist.
 *   - Owner layer ∈ {1, 2, 3}; Layer 0 is not a capability owner.
 *
 * Also hosts the minimum DecisionAuthority registry with
 * override_allowed=false enforcement.
 */

import type { CapabilityKindRegistry } from './kind_registry';
import {
  type CapabilityRegisterResult,
  type CapabilityRegistration,
  type DecisionAuthority,
  type DecisionAuthorityRegisterResult,
  type DecisionKind,
} from './types';

const CAP_ID_RE = /^[a-z][a-z0-9-]*(?::[a-z][a-z0-9_-]*)+$/;

export class CapabilityRegistry {
  private entries: Map<string, CapabilityRegistration> = new Map();

  constructor(private readonly kinds: CapabilityKindRegistry) {}

  register(reg: CapabilityRegistration): CapabilityRegisterResult {
    // capability_id format
    if (!CAP_ID_RE.test(reg.capability_id)) {
      return { ok: false, code: 'INVALID_CAPABILITY_ID_FORMAT', detail: reg.capability_id };
    }

    // B1
    if (!this.kinds.has(reg.kind)) {
      return { ok: false, code: 'UNKNOWN_KIND', detail: reg.kind };
    }

    // B2 — duplicate active
    const prior = this.entries.get(reg.capability_id);
    if (prior && prior.status === 'active') {
      return { ok: false, code: 'DUPLICATE_ACTIVE', detail: reg.capability_id };
    }

    // Owner layer
    if (![1, 2, 3].includes(reg.owner.layer)) {
      return { ok: false, code: 'INVALID_OWNER_LAYER' };
    }
    if (!reg.owner.declaration_path) {
      return { ok: false, code: 'MISSING_DECLARATION_PATH' };
    }

    // B4 — trust boundary required (objects present; arrays may be empty)
    const tb = reg.trust_boundary;
    if (!tb || !tb.fs_scope || !tb.network_scope
      || !Array.isArray(tb.fs_scope.read_roots)
      || !Array.isArray(tb.fs_scope.write_roots)
      || !Array.isArray(tb.network_scope.egress_allowlist)) {
      return { ok: false, code: 'MISSING_TRUST_BOUNDARY' };
    }

    // B4 follow-through: if the capability declares network-egress, egress_allowlist must be non-empty
    const needsNet = reg.side_effects.some((s) => s.kind === 'network-egress');
    if (needsNet && tb.network_scope.egress_allowlist.length === 0) {
      return { ok: false, code: 'EMPTY_NETWORK_SCOPE_ON_NETWORK_SIDE_EFFECT' };
    }

    this.entries.set(reg.capability_id, reg);
    return { ok: true, capability_id: reg.capability_id };
  }

  lookup(capability_id: string): CapabilityRegistration | null {
    return this.entries.get(capability_id) ?? null;
  }

  size(): number {
    return this.entries.size;
  }

  _clearForTests(): void {
    this.entries.clear();
  }
}

export class DecisionAuthorityRegistry {
  private authorities: Map<DecisionKind, DecisionAuthority> = new Map();

  register(a: DecisionAuthority): DecisionAuthorityRegisterResult {
    if (a.override_allowed !== false) {
      return { ok: false, code: 'OVERRIDE_ALLOWED_MUST_BE_FALSE' };
    }
    if (![0, 1].includes(a.authoritative_layer)) {
      return { ok: false, code: 'INVALID_AUTHORITATIVE_LAYER' };
    }
    if (!a.authoritative_path) {
      return { ok: false, code: 'MISSING_AUTHORITATIVE_PATH' };
    }
    this.authorities.set(a.kind, a);
    return { ok: true, kind: a.kind };
  }

  lookup(kind: DecisionKind): DecisionAuthority | null {
    return this.authorities.get(kind) ?? null;
  }

  size(): number {
    return this.authorities.size;
  }

  _clearForTests(): void {
    this.authorities.clear();
  }
}
