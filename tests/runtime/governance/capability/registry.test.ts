/**
 * BGHS Capability Registry tests — Sprint 4.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CAPABILITY_KIND_RE,
  CapabilityKindRegistry,
  CapabilityRegistry,
  DecisionAuthorityRegistry,
  DecisionKind,
  type CapabilityKindRegistration,
  type CapabilityRegistration,
  type DecisionAuthority,
  type TrustBoundaryDecl,
} from '../../../../src/runtime/governance/capability';

function makeKindReg(overrides: Partial<CapabilityKindRegistration> = {}): CapabilityKindRegistration {
  return {
    kind: 'engine.write.amazon-ads-bid',
    layer_introduced: 0,
    contract_adr: 'ADR-OpenClaw-Capability-Boundary',
    contract_schema: '_meta/contracts/capability/engine.write.amazon-ads-bid.schema.yaml',
    introduced_at: '2026-04-17T00:00:00Z',
    superseded_by: null,
    status: 'active',
    ...overrides,
  };
}

function makeTrustBoundary(overrides: Partial<TrustBoundaryDecl> = {}): TrustBoundaryDecl {
  return {
    fs_scope: { read_roots: ['{component_root}/data'], write_roots: ['{component_root}/artifacts'] },
    network_scope: { egress_allowlist: ['advertising-api.amazon.com'], ingress: 'none' },
    in_process: false,
    credential_path: 'cred://amazon-growth-engine/ads-api-refresh-token',
    ...overrides,
  };
}

function makeCapReg(overrides: Partial<CapabilityRegistration> = {}): CapabilityRegistration {
  return {
    capability_id: 'amazon-growth-engine:bid_write',
    kind: 'engine.write.amazon-ads-bid',
    owner: {
      layer: 2,
      component: 'amazon-growth-engine',
      declaration_path: '_meta/declarations/amazon-growth-engine.yaml',
    },
    trust_boundary: makeTrustBoundary(),
    side_effects: [
      { kind: 'network-egress', target: 'advertising-api.amazon.com' },
      { kind: 'external-api', target: 'Amazon Advertising API' },
    ],
    observed_by: null,
    registered_at: '2026-04-17T00:00:00Z',
    status: 'active',
    ...overrides,
  };
}

// -------------------- CapabilityKindRegistry --------------------

describe('CAPABILITY_KIND_RE (naming pattern)', () => {
  it('accepts the primary reference kinds', () => {
    for (const k of [
      'engine.write.amazon-ads-bid',
      'session.event-stream',
      'guard.content-scan',
      'memory.write.authoritative',
    ]) {
      expect(CAPABILITY_KIND_RE.test(k)).toBe(true);
    }
  });

  it('rejects single-segment kinds', () => {
    expect(CAPABILITY_KIND_RE.test('engine')).toBe(false);
  });

  it('rejects leading digit / uppercase / underscore', () => {
    expect(CAPABILITY_KIND_RE.test('1engine.write')).toBe(false);
    expect(CAPABILITY_KIND_RE.test('Engine.write')).toBe(false);
    expect(CAPABILITY_KIND_RE.test('engine.write_bid')).toBe(false);
  });

  it('rejects trailing or doubled dots', () => {
    expect(CAPABILITY_KIND_RE.test('engine.')).toBe(false);
    expect(CAPABILITY_KIND_RE.test('engine..write')).toBe(false);
  });
});

describe('CapabilityKindRegistry', () => {
  let kinds: CapabilityKindRegistry;

  beforeEach(() => {
    kinds = new CapabilityKindRegistry();
  });

  it('accepts a well-formed kind registration', () => {
    const r = kinds.register(makeKindReg());
    expect(r.ok).toBe(true);
    expect(kinds.has('engine.write.amazon-ads-bid')).toBe(true);
  });

  it('rejects invalid kind name', () => {
    const r = kinds.register(makeKindReg({ kind: 'NotAKind' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_KIND_NAME');
  });

  it('rejects duplicate kind', () => {
    expect(kinds.register(makeKindReg()).ok).toBe(true);
    const r = kinds.register(makeKindReg());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUPLICATE_KIND');
  });

  it('rejects layer_introduced != 0', () => {
    const r = kinds.register(makeKindReg({ layer_introduced: 1 as unknown as 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('LAYER_INTRODUCED_MUST_BE_ZERO');
  });

  it('rejects missing contract_adr or contract_schema', () => {
    expect(kinds.register(makeKindReg({ contract_adr: '' })).ok).toBe(false);
    expect(kinds.register(makeKindReg({ kind: 'engine.write.foo', contract_schema: '' })).ok).toBe(false);
  });
});

// -------------------- CapabilityRegistry --------------------

describe('CapabilityRegistry', () => {
  let kinds: CapabilityKindRegistry;
  let caps: CapabilityRegistry;

  beforeEach(() => {
    kinds = new CapabilityKindRegistry();
    kinds.register(makeKindReg());
    caps = new CapabilityRegistry(kinds);
  });

  it('registers the reference capability engine.write.amazon-ads-bid', () => {
    const r = caps.register(makeCapReg());
    expect(r.ok).toBe(true);
    expect(caps.lookup('amazon-growth-engine:bid_write')?.kind).toBe(
      'engine.write.amazon-ads-bid',
    );
  });

  it('rejects unknown kind (B1)', () => {
    const r = caps.register(makeCapReg({ kind: 'engine.write.not-registered' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('UNKNOWN_KIND');
  });

  it('rejects duplicate active capability_id (B2)', () => {
    expect(caps.register(makeCapReg()).ok).toBe(true);
    const r2 = caps.register(makeCapReg());
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('DUPLICATE_ACTIVE');
  });

  it('accepts supersede when prior entry is non-active', () => {
    expect(caps.register(makeCapReg({ status: 'quarantined' })).ok).toBe(true);
    const r2 = caps.register(makeCapReg());
    expect(r2.ok).toBe(true);
  });

  it('rejects invalid owner layer (Layer 0 cannot own capabilities)', () => {
    const r = caps.register(makeCapReg({
      owner: { layer: 0 as unknown as 1, component: 'x', declaration_path: 'x.yaml' },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_OWNER_LAYER');
  });

  it('rejects missing trust_boundary (B4)', () => {
    const r = caps.register(makeCapReg({ trust_boundary: null as unknown as TrustBoundaryDecl }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_TRUST_BOUNDARY');
  });

  it('rejects trust_boundary with missing fs_scope object (B4)', () => {
    const tb = makeTrustBoundary();
    (tb as unknown as { fs_scope: unknown }).fs_scope = undefined;
    const r = caps.register(makeCapReg({ trust_boundary: tb }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_TRUST_BOUNDARY');
  });

  it('rejects network-egress side effect when egress_allowlist empty', () => {
    const tb = makeTrustBoundary({
      network_scope: { egress_allowlist: [], ingress: 'none' },
    });
    const r = caps.register(makeCapReg({ trust_boundary: tb }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('EMPTY_NETWORK_SCOPE_ON_NETWORK_SIDE_EFFECT');
  });

  it('accepts empty egress_allowlist when no network side effects declared', () => {
    // A capability with only fs writes can have an empty egress list.
    const tb = makeTrustBoundary({
      network_scope: { egress_allowlist: [], ingress: 'none' },
    });
    const r = caps.register(makeCapReg({
      trust_boundary: tb,
      side_effects: [{ kind: 'fs-write', target: '{component_root}/artifacts' }],
    }));
    expect(r.ok).toBe(true);
  });

  it('rejects invalid capability_id format', () => {
    const r = caps.register(makeCapReg({ capability_id: 'NoColonHere' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_CAPABILITY_ID_FORMAT');
  });
});

// -------------------- DecisionAuthorityRegistry --------------------

describe('DecisionAuthorityRegistry', () => {
  let reg: DecisionAuthorityRegistry;

  beforeEach(() => {
    reg = new DecisionAuthorityRegistry();
  });

  function makeAuth(overrides: Partial<DecisionAuthority> = {}): DecisionAuthority {
    return {
      kind: DecisionKind.CAPABILITY_ADMISSION,
      authoritative_layer: 0,
      authoritative_path: 'src/runtime/governance/capability/',
      observers_allowed: ['loamwise.observer'],
      override_allowed: false,
      ...overrides,
    };
  }

  it('accepts a valid authority with override_allowed=false', () => {
    expect(reg.register(makeAuth()).ok).toBe(true);
  });

  it('rejects override_allowed=true', () => {
    const r = reg.register(makeAuth({ override_allowed: true as unknown as false }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('OVERRIDE_ALLOWED_MUST_BE_FALSE');
  });

  it('rejects invalid authoritative_layer (Layer 2 not allowed)', () => {
    const r = reg.register(makeAuth({ authoritative_layer: 2 as unknown as 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_AUTHORITATIVE_LAYER');
  });

  it('rejects missing authoritative_path', () => {
    const r = reg.register(makeAuth({ authoritative_path: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_AUTHORITATIVE_PATH');
  });
});
