/**
 * BGHS Capability — CapabilityKindRegistry
 * Location: src/runtime/governance/capability/kind_registry.ts
 *
 * ADR-OpenClaw-Capability-Boundary §1 + B1. Layer 0 is the ONLY place
 * that may introduce new CapabilityKinds. Every registration must be
 * backed by a contract ADR and a schema file.
 */

import {
  CAPABILITY_KIND_RE,
  type CapabilityKind,
  type CapabilityKindRegistration,
  type KindRegisterResult,
  type KindStatus,
} from './types';

const VALID_STATUS: ReadonlySet<KindStatus> = new Set<KindStatus>([
  'proposed', 'active', 'frozen', 'superseded',
]);

export class CapabilityKindRegistry {
  private kinds: Map<CapabilityKind, CapabilityKindRegistration> = new Map();

  register(r: CapabilityKindRegistration): KindRegisterResult {
    if (!CAPABILITY_KIND_RE.test(r.kind)) {
      return { ok: false, code: 'INVALID_KIND_NAME', detail: r.kind };
    }
    if (this.kinds.has(r.kind)) {
      return { ok: false, code: 'DUPLICATE_KIND', detail: r.kind };
    }
    if (r.layer_introduced !== 0) {
      return { ok: false, code: 'LAYER_INTRODUCED_MUST_BE_ZERO' };
    }
    if (!r.contract_adr) {
      return { ok: false, code: 'MISSING_CONTRACT_ADR' };
    }
    if (!r.contract_schema) {
      return { ok: false, code: 'MISSING_CONTRACT_SCHEMA' };
    }
    if (!VALID_STATUS.has(r.status)) {
      return { ok: false, code: 'INVALID_STATUS', detail: r.status };
    }
    this.kinds.set(r.kind, r);
    return { ok: true, kind: r.kind };
  }

  has(kind: CapabilityKind): boolean {
    return this.kinds.has(kind);
  }

  lookup(kind: CapabilityKind): CapabilityKindRegistration | null {
    return this.kinds.get(kind) ?? null;
  }

  size(): number {
    return this.kinds.size;
  }

  _clearForTests(): void {
    this.kinds.clear();
  }
}
