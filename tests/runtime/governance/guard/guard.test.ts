/**
 * Guard runtime skeleton tests — Sprint 3 Wave 3.1.
 *
 * Coverage:
 *   - redactSnippet / looksSensitive sanitization rules.
 *   - ShadowRunner: appends GuardEvidence, never blocks, even on DANGEROUS.
 *   - ShadowRunner: fail_open on scanner throw, scanner_failed=true recorded.
 *   - GuardChainRegistry: rejects all 7 validator classes from ADR §7.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  AlwaysDangerousScanner,
  GuardChainRegistry,
  GuardEnforcementMode,
  GuardKind,
  GuardVerdict,
  InMemoryGuardEvidenceSink,
  NoopScanner,
  ProtectedPathKind,
  ShadowRunner,
  looksSensitive,
  redactSnippet,
  type GuardChain,
  type GuardRunInput,
  type Scanner,
} from '../../../../src/runtime/governance/guard';

// -------------------- redactSnippet / looksSensitive --------------------

describe('redactSnippet', () => {
  it('returns [empty] for empty/null/undefined', () => {
    expect(redactSnippet(null)).toBe('[empty]');
    expect(redactSnippet(undefined)).toBe('[empty]');
    expect(redactSnippet('')).toBe('[empty]');
  });

  it('passes short non-sensitive content through', () => {
    expect(redactSnippet('hello')).toBe('hello');
  });

  it('hashes long non-sensitive content with length hint', () => {
    // Uses spaces to avoid matching the base64/hex "sensitive" regexes.
    const long = 'hello world '.repeat(10);    // 120 chars, not token-shaped
    const r = redactSnippet(long);
    expect(r).toMatch(/^sha256:[a-f0-9]{12}\.\.\. \[len=\d+\]$/);
  });

  it('hashes sensitive-looking short content', () => {
    expect(redactSnippet('ya29.abc')).toMatch(/^sha256:[a-f0-9]{12}\.\.\.$/);
    expect(redactSnippet('Bearer xyz')).toMatch(/^sha256:[a-f0-9]{12}\.\.\.$/);
  });
});

describe('looksSensitive', () => {
  it('flags ya29 and Atza prefixes', () => {
    expect(looksSensitive('ya29.a-b-c')).toBe(true);
    expect(looksSensitive('Atza|something')).toBe(true);
  });

  it('flags Bearer tokens', () => {
    expect(looksSensitive('Authorization: Bearer abcdef')).toBe(true);
  });

  it('flags long base64-ish and hex runs', () => {
    expect(looksSensitive('AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH')).toBe(true);
    expect(looksSensitive('deadbeefcafebabedeadbeefcafebabe')).toBe(true);
  });

  it('passes ordinary text', () => {
    expect(looksSensitive('hello world')).toBe(false);
  });
});

// -------------------- ShadowRunner --------------------

const RUN_INPUT: GuardRunInput = {
  guard_id: 'test-guard',
  guard_kind: GuardKind.CONTENT_SCAN,
  scanner_version: '',              // overridden by scanner
  pattern_catalog_version: '',
  trace_id: 'trace-abc',
  scanned_path: { path_kind: 'skill-candidate', target_ref: 'cand-1' },
  payload: { text: 'dummy' },
};

describe('ShadowRunner', () => {
  let sink: InMemoryGuardEvidenceSink;

  beforeEach(() => {
    sink = new InMemoryGuardEvidenceSink();
  });

  it('writes evidence and never blocks on SAFE', async () => {
    const runner = new ShadowRunner(new NoopScanner(GuardKind.CONTENT_SCAN), { sink, fail_open: true });
    const out = await runner.run(RUN_INPUT);
    expect(out.blocked).toBe(false);
    expect(out.verdict).toBe(GuardVerdict.SAFE);
    expect(sink.list()).toHaveLength(1);
    expect(sink.list()[0].mode).toBe(GuardEnforcementMode.SHADOW);
  });

  it('writes evidence and STILL does not block on DANGEROUS', async () => {
    const runner = new ShadowRunner(
      new AlwaysDangerousScanner(GuardKind.CONTENT_SCAN),
      { sink, fail_open: true },
    );
    const out = await runner.run(RUN_INPUT);
    expect(out.blocked).toBe(false);         // SHADOW never blocks
    expect(out.verdict).toBe(GuardVerdict.DANGEROUS);
    expect(sink.list()[0].verdict).toBe(GuardVerdict.DANGEROUS);
    expect(sink.list()[0].hits).toHaveLength(1);
  });

  it('fails open on scanner throw and records scanner_failed=true', async () => {
    const throwingScanner: Scanner = {
      scanner_id: 'throwing',
      scanner_version: '0',
      pattern_catalog_version: '0',
      supports_kind: GuardKind.CONTENT_SCAN,
      async scan() {
        throw new Error('scanner imploded');
      },
    };
    const runner = new ShadowRunner(throwingScanner, { sink, fail_open: true });
    const out = await runner.run(RUN_INPUT);
    expect(out.blocked).toBe(false);
    expect(out.verdict).toBe(GuardVerdict.SAFE);   // fail-open default
    const ev = sink.list()[0];
    expect(ev.scanner_failed).toBe(true);
    expect(ev.failure_reason).toBe('scanner imploded');
  });
});

// -------------------- GuardChainRegistry --------------------

function makeChain(overrides: Partial<GuardChain> = {}): GuardChain {
  return {
    chain_id: 'chain.skill-candidate-submit.v1',
    protected_path: {
      kind: ProtectedPathKind.SKILL_CANDIDATE_SUBMIT,
      required_guard_kinds: [GuardKind.CONTENT_SCAN],
    },
    steps: [
      {
        step_id: 'step-1',
        guard_kind: GuardKind.CONTENT_SCAN,
        mode: GuardEnforcementMode.SHADOW,
        parallel_with: null,
        on_verdict: {
          on_safe: 'pass',
          on_caution: 'pass-with-warning',
          on_dangerous: 'block',
        },
        non_shadow_allowed_by: null,
      },
    ],
    global_shadow: false,
    declared_at: '2026-04-17T00:00:00Z',
    declared_by_adr: 'ADR-Loamwise-Guard-Content-Security',
    ...overrides,
  };
}

describe('GuardChainRegistry', () => {
  let reg: GuardChainRegistry;

  beforeEach(() => {
    reg = new GuardChainRegistry();
  });

  it('registers a valid SHADOW-only chain for skill-candidate-submit', () => {
    const r = reg.register(makeChain());
    expect(r.ok).toBe(true);
  });

  it('rejects duplicate chain_id', () => {
    expect(reg.register(makeChain()).ok).toBe(true);
    const r2 = reg.register(makeChain());
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe('DUPLICATE_CHAIN_ID');
  });

  it('rejects unknown protected_path.kind', () => {
    const c = makeChain();
    c.protected_path = {
      kind: 'not.in.whitelist' as unknown as ProtectedPathKind,
      required_guard_kinds: [GuardKind.CONTENT_SCAN],
    };
    const r = reg.register(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PATH_NOT_IN_WHITELIST');
  });

  it('rejects chain missing a required_guard_kind', () => {
    const c = makeChain({
      protected_path: {
        kind: ProtectedPathKind.MEMORY_WRITE_AUTH,
        required_guard_kinds: [GuardKind.CONTENT_SCAN, GuardKind.TRUTH_WRITE],
      },
      // only CONTENT_SCAN in steps
    });
    const r = reg.register(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_REQUIRED_GUARD_KIND');
  });

  it('rejects SHADOW step with a non-null non_shadow_allowed_by', () => {
    const c = makeChain();
    c.steps[0].non_shadow_allowed_by = 'ADR-Foo';
    const r = reg.register(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('SHADOW_STEP_HAS_NON_SHADOW_REF');
  });

  it('rejects ADVISORY/ACTIVE step without escalation ADR', () => {
    const c = makeChain();
    c.steps[0].mode = GuardEnforcementMode.ACTIVE;
    c.steps[0].non_shadow_allowed_by = null;
    const r = reg.register(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('NON_SHADOW_STEP_MISSING_ESCALATION_ADR');
  });

  it('accepts ACTIVE step when non_shadow_allowed_by is present', () => {
    const c = makeChain();
    c.steps[0].mode = GuardEnforcementMode.ACTIVE;
    c.steps[0].non_shadow_allowed_by = 'ADR-Guard-Escalation-SkillSubmit';
    const r = reg.register(c);
    expect(r.ok).toBe(true);
  });

  it('rejects missing declared_by_adr', () => {
    const c = makeChain({ declared_by_adr: '' });
    const r = reg.register(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('MISSING_CHAIN_ADR');
  });

  it('rejects global_shadow != false', () => {
    const c = makeChain();
    (c as unknown as { global_shadow: unknown }).global_shadow = true;
    const r = reg.register(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('GLOBAL_SHADOW_DISALLOWED');
  });

  it('rejects on_dangerous = pass at runtime even if the TS type forbids it', () => {
    const c = makeChain();
    (c.steps[0].on_verdict as unknown as { on_dangerous: string }).on_dangerous = 'pass';
    const r = reg.register(c);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('VERDICT_ROUTING_ALLOWS_DANGEROUS_PASS');
  });
});
