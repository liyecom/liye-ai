/**
 * WakeResumeRegistry tests — Sprint 1 Wave 1.2.
 *
 * Hard rejection classes required by the sprint exit criteria:
 *   (a) IMPURE_REPLAY_REJECTED
 *   (b) PREFLIGHT_UNKNOWN_CHECK (unknown failure codes)
 *   (c) SNAPSHOT_DANGLING_DERIVED_FROM
 *   (d) RESOURCE_CONTEXT_ESCAPE_HATCH (declared fields differ from the 4-field minimum)
 *
 * Plus the PreflightContract P1–P6 rules and ownership/duplicate guards.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { StreamRegistry, type SessionEventStream } from '../../../../src/runtime/governance/session';
import {
  WakeResumeRegistry,
  type WakeResumeEntrypoint,
} from '../../../../src/runtime/governance/wake';

function makeStream(overrides: Partial<SessionEventStream> = {}): SessionEventStream {
  return {
    stream_id: 'age.stream.state_transitions',
    owner: { component_id: 'age.onboarding.store_state', layer: 2 },
    scope: { scope_kind: 'engine-execution', scope_keys: { store_id: 'STR-TEST' } },
    format: 'ndjson.append',
    storage_location: '/tmp/state_transitions.jsonl',
    retention: { min_retention_days: 365, immutable_after_days: null, delete_after_days: null },
    is_append_only: true,
    is_hash_chained: false,                // provisional
    hash_alg: 'sha256',
    registered_at: '2026-04-17T00:00:00Z',
    registered_by_adr: 'ADR-AGE-Wake-Resume.md',
    ...overrides,
  };
}

function makeWRE(overrides: Partial<WakeResumeEntrypoint> = {}): WakeResumeEntrypoint {
  return {
    entrypoint_id: 'age.onboarding.replay_state',
    component_id: 'age.onboarding.store_state',
    declared_by_adr: 'ADR-AGE-Wake-Resume',
    module_path: 'scripts.onboarding.replay_state',
    callable: 'main',
    stream_refs: [
      { ref_kind: 'session-event', stream_id: 'age.stream.state_transitions', f1_compliant: false },
    ],
    snapshot_refs: [
      { snapshot_id: 'age.snapshot.state_yaml', derived_from: ['age.stream.state_transitions'] },
    ],
    preflight: {
      required_checks: [
        'MISSING_STREAM', 'EMPTY_STREAM', 'STRUCTURAL_INVALID',
        'ILLEGAL_TRANSITION', 'MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE',
        'SNAPSHOT_DIVERGED', 'ENTRYPOINT_UNRESOLVED',
      ],
      snapshot_required: true,
      allow_from_scratch_bypass: ['MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE', 'SNAPSHOT_DIVERGED'],
      diff_required_before_apply: true,
      abort_on_first_failure: true,
    },
    replay: {
      is_pure: true,
      stable_ordering_keys: ['at', 'event_id'],
      declared_failure_modes: [
        'MISSING_STREAM', 'EMPTY_STREAM', 'STRUCTURAL_INVALID',
        'ILLEGAL_TRANSITION', 'MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE',
        'SNAPSHOT_DIVERGED', 'ENTRYPOINT_UNRESOLVED',
      ],
    },
    resource_context_declared_fields: ['resource_type', 'id', 'scope', 'safe_summary'],
    ...overrides,
  };
}

function makeRegistryWithStream(): { streams: StreamRegistry; wake: WakeResumeRegistry } {
  const streams = new StreamRegistry();
  streams.registerProvisionalStream(makeStream());
  const wake = new WakeResumeRegistry(streams);
  return { streams, wake };
}

describe('WakeResumeRegistry — happy path', () => {
  it('accepts AGE wake entrypoint when all rules pass', () => {
    const { wake } = makeRegistryWithStream();
    const r = wake.register(makeWRE());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entrypoint_id).toBe('age.onboarding.replay_state');
    expect(wake.size()).toBe(1);
  });
});

describe('WakeResumeRegistry — 4 hard rejection classes', () => {
  // (a) is_pure = false
  it('rejects is_pure=false (IMPURE_REPLAY_REJECTED)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.replay = { ...wre.replay, is_pure: false as unknown as true };
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('IMPURE_REPLAY_REJECTED');
  });

  // (b) unknown failure code in declared_failure_modes
  it('rejects unknown failure code (PREFLIGHT_UNKNOWN_CHECK)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.replay = {
      ...wre.replay,
      declared_failure_modes: [
        ...wre.replay.declared_failure_modes,
        'NOT_A_REAL_CODE' as unknown as 'MISSING_STREAM',
      ],
    };
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PREFLIGHT_UNKNOWN_CHECK');
  });

  // (c) dangling derived_from
  it('rejects snapshot referencing an unregistered stream (SNAPSHOT_DANGLING_DERIVED_FROM)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.snapshot_refs = [
      { snapshot_id: 's1', derived_from: ['stream.does.not.exist.in.stream_refs'] },
    ];
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SNAPSHOT_DANGLING_DERIVED_FROM');
  });

  // (d) ResourceContext escape hatch
  it('rejects extra declared fields (RESOURCE_CONTEXT_ESCAPE_HATCH)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE({
      resource_context_declared_fields: ['resource_type', 'id', 'scope', 'safe_summary', 'extra'],
    });
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('RESOURCE_CONTEXT_ESCAPE_HATCH');
  });

  it('rejects missing required field (RESOURCE_CONTEXT_ESCAPE_HATCH)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE({
      resource_context_declared_fields: ['resource_type', 'id', 'scope'],
    });
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('RESOURCE_CONTEXT_ESCAPE_HATCH');
  });
});

describe('WakeResumeRegistry — PreflightContract P1–P6', () => {
  it('rejects snapshot_required=true without MISSING_SNAPSHOT in checks (P6)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.preflight = {
      ...wre.preflight,
      required_checks: wre.preflight.required_checks.filter((c) => c !== 'MISSING_SNAPSHOT'),
      allow_from_scratch_bypass: wre.preflight.allow_from_scratch_bypass.filter((c) => c !== 'MISSING_SNAPSHOT'),
    };
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PREFLIGHT_SNAPSHOT_CHECK_MISSING');
  });

  it('rejects allow_from_scratch_bypass outside snapshot set (P3)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.preflight = {
      ...wre.preflight,
      allow_from_scratch_bypass: [
        ...wre.preflight.allow_from_scratch_bypass,
        'MISSING_STREAM',                // not a snapshot code — illegal bypass
      ],
    };
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PREFLIGHT_BYPASS_OUT_OF_SCOPE');
  });

  it('rejects bypass entry not in required_checks (P2)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.preflight = {
      ...wre.preflight,
      required_checks: wre.preflight.required_checks.filter((c) => c !== 'SNAPSHOT_DIVERGED'),
      allow_from_scratch_bypass: ['SNAPSHOT_DIVERGED'],
    };
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PREFLIGHT_BYPASS_NOT_REQUIRED');
  });

  it('rejects diff_required_before_apply=false (P4)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.preflight = { ...wre.preflight, diff_required_before_apply: false as unknown as true };
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PREFLIGHT_WEAK_DIFF_GUARD');
  });

  it('rejects abort_on_first_failure=false (P5)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE();
    wre.preflight = { ...wre.preflight, abort_on_first_failure: false as unknown as true };
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PREFLIGHT_CONTINUE_ON_FAILURE');
  });
});

describe('WakeResumeRegistry — other guards', () => {
  it('rejects missing module_path (ENTRYPOINT_UNRESOLVED)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE({ module_path: '' });
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ENTRYPOINT_UNRESOLVED');
  });

  it('rejects missing callable (ENTRYPOINT_UNRESOLVED)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE({ callable: '' });
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ENTRYPOINT_UNRESOLVED');
  });

  it('rejects stream_ref not in StreamRegistry (STREAM_NOT_REGISTERED)', () => {
    const streams = new StreamRegistry();       // empty
    const wake = new WakeResumeRegistry(streams);
    const r = wake.register(makeWRE());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('STREAM_NOT_REGISTERED');
  });

  it('rejects duplicate entrypoint_id', () => {
    const { wake } = makeRegistryWithStream();
    expect(wake.register(makeWRE()).ok).toBe(true);
    const r2 = wake.register(makeWRE());
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('DUPLICATE_ENTRYPOINT_ID');
  });

  it('rejects empty stream_refs (MISSING_STREAM)', () => {
    const { wake } = makeRegistryWithStream();
    const wre = makeWRE({ stream_refs: [], snapshot_refs: [] });
    const r = wake.register(wre);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_STREAM');
  });

  it('rejects empty entrypoint_id (ENTRYPOINT_UNRESOLVED)', () => {
    const { wake } = makeRegistryWithStream();
    const r = wake.register(makeWRE({ entrypoint_id: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ENTRYPOINT_UNRESOLVED');
  });

  it('rejects empty component_id (ENTRYPOINT_UNRESOLVED)', () => {
    const { wake } = makeRegistryWithStream();
    const r = wake.register(makeWRE({ component_id: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ENTRYPOINT_UNRESOLVED');
  });

  it('rejects empty declared_by_adr (ENTRYPOINT_UNRESOLVED)', () => {
    const { wake } = makeRegistryWithStream();
    const r = wake.register(makeWRE({ declared_by_adr: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('ENTRYPOINT_UNRESOLVED');
  });

  it('does NOT collapse duplicate-guard on empty entrypoint_id (two empties both rejected, not the second as duplicate)', () => {
    const { wake } = makeRegistryWithStream();
    const r1 = wake.register(makeWRE({ entrypoint_id: '' }));
    const r2 = wake.register(makeWRE({ entrypoint_id: '' }));
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('ENTRYPOINT_UNRESOLVED');
    if (!r2.ok) expect(r2.code).toBe('ENTRYPOINT_UNRESOLVED');
    expect(wake.size()).toBe(0);
  });
});

describe('session barrel — runtime export of ArtifactClass', () => {
  it('exposes ArtifactClass as a value (enum), not just a type', async () => {
    const mod = await import('../../../../src/runtime/governance/session');
    expect(mod.ArtifactClass).toBeDefined();
    expect(mod.ArtifactClass.SESSION_EVENT_STREAM).toBe('session.event-stream');
    expect(mod.ArtifactClass.SESSION_ADJACENT).toBe('session.adjacent');
    expect(mod.ArtifactClass.NEITHER).toBe('neither');
  });
});

describe('WakeResumeRegistry — AGE reference binding', () => {
  it('registers the exact AGE entrypoint declared in ADR-AGE-Wake-Resume §6', () => {
    const streams = new StreamRegistry();
    streams.registerProvisionalStream(makeStream({
      stream_id: 'age.stream.state_transitions',
      owner: { component_id: 'age.onboarding.store_state', layer: 2 },
    }));
    const wake = new WakeResumeRegistry(streams);

    const wre: WakeResumeEntrypoint = {
      entrypoint_id: 'age.onboarding.replay_state',
      component_id: 'age.onboarding.store_state',
      declared_by_adr: 'ADR-AGE-Wake-Resume',
      module_path: 'scripts.onboarding.replay_state',
      callable: 'main',
      stream_refs: [
        { ref_kind: 'session-event', stream_id: 'age.stream.state_transitions', f1_compliant: false },
      ],
      snapshot_refs: [
        { snapshot_id: 'age.snapshot.state_yaml', derived_from: ['age.stream.state_transitions'] },
      ],
      preflight: {
        required_checks: [
          'MISSING_STREAM', 'EMPTY_STREAM', 'STRUCTURAL_INVALID',
          'ILLEGAL_TRANSITION', 'MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE',
          'SNAPSHOT_DIVERGED', 'ENTRYPOINT_UNRESOLVED',
        ],
        snapshot_required: true,
        allow_from_scratch_bypass: [
          'MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE', 'SNAPSHOT_DIVERGED',
        ],
        diff_required_before_apply: true,
        abort_on_first_failure: true,
      },
      replay: {
        is_pure: true,
        stable_ordering_keys: ['at', 'event_id'],
        declared_failure_modes: [
          'MISSING_STREAM', 'EMPTY_STREAM', 'STRUCTURAL_INVALID',
          'ILLEGAL_TRANSITION', 'MISSING_SNAPSHOT', 'SNAPSHOT_UNREADABLE',
          'SNAPSHOT_DIVERGED', 'ENTRYPOINT_UNRESOLVED',
        ],
      },
      resource_context_declared_fields: ['resource_type', 'id', 'scope', 'safe_summary'],
    };

    const r = wake.register(wre);
    expect(r.ok).toBe(true);
  });
});
