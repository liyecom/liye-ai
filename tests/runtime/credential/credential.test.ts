/**
 * CredentialBroker + reference + SecretValue tests — Sprint 2 Wave 2.1.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  EnvCredentialBroker,
  InMemoryCredentialAuditSink,
  InvalidCredentialReferenceError,
  SECRET_MASK,
  isValidCredentialRef,
  parseCredentialRef,
  wrapSecret,
  type ResolutionContext,
} from '../../../src/runtime/credential';

// -------------------- CredentialReference --------------------

describe('parseCredentialRef', () => {
  it('accepts a minimal valid reference', () => {
    const r = parseCredentialRef('cred://liye-os/notion-api-key');
    expect(r.scheme).toBe('cred');
    expect(r.owner).toBe('liye-os');
    expect(r.name).toBe('notion-api-key');
    expect(r.qualifiers).toEqual({});
  });

  it('parses qualifiers', () => {
    const r = parseCredentialRef(
      'cred://amazon-growth-engine/ads-api-refresh-token?marketplace=US',
    );
    expect(r.owner).toBe('amazon-growth-engine');
    expect(r.name).toBe('ads-api-refresh-token');
    expect(r.qualifiers).toEqual({ marketplace: 'US' });
  });

  it('parses multiple qualifiers', () => {
    const r = parseCredentialRef(
      'cred://amazon-growth-engine/ads-api-token?marketplace=US&profile=default',
    );
    expect(r.qualifiers).toEqual({ marketplace: 'US', profile: 'default' });
  });

  it('rejects wrong scheme', () => {
    expect(() => parseCredentialRef('http://liye-os/x')).toThrow(InvalidCredentialReferenceError);
  });

  it('rejects uppercase owner', () => {
    expect(() => parseCredentialRef('cred://LiYe/notion')).toThrow(InvalidCredentialReferenceError);
  });

  it('rejects too-short name (<3 chars)', () => {
    expect(() => parseCredentialRef('cred://liye-os/x')).toThrow(InvalidCredentialReferenceError);
  });

  it('rejects too-long name (>64 chars)', () => {
    const big = 'a'.repeat(65);
    expect(() => parseCredentialRef(`cred://liye-os/${big}`)).toThrow(InvalidCredentialReferenceError);
  });

  it('rejects underscore in name', () => {
    expect(() => parseCredentialRef('cred://liye-os/notion_key')).toThrow(InvalidCredentialReferenceError);
  });

  it('rejects malformed qualifier', () => {
    expect(() => parseCredentialRef('cred://liye-os/notion-key?no-equals')).toThrow(
      InvalidCredentialReferenceError,
    );
  });
});

describe('isValidCredentialRef', () => {
  it('returns true for valid refs, false otherwise', () => {
    expect(isValidCredentialRef('cred://liye-os/notion-key')).toBe(true);
    expect(isValidCredentialRef('not-a-ref')).toBe(false);
  });
});

// -------------------- SecretValue --------------------

describe('wrapSecret / SecretValue', () => {
  it('reveal() returns the raw string', () => {
    const s = wrapSecret('my-real-token-1234');
    expect(s.reveal()).toBe('my-real-token-1234');
  });

  it('JSON.stringify produces the masked placeholder', () => {
    const s = wrapSecret('my-real-token-1234');
    expect(JSON.stringify(s)).toBe(`"${SECRET_MASK}"`);
  });

  it('String(s) and s.toString() produce the masked placeholder', () => {
    const s = wrapSecret('my-real-token-1234');
    expect(String(s)).toBe(SECRET_MASK);
    expect(s.toString()).toBe(SECRET_MASK);
  });

  it('util.inspect custom hook produces the masked placeholder', () => {
    const s = wrapSecret('my-real-token-1234') as Record<symbol, () => string>;
    const hook = s[Symbol.for('nodejs.util.inspect.custom')];
    expect(typeof hook).toBe('function');
    expect(hook()).toBe(SECRET_MASK);
  });

  it('template-literal interpolation produces the masked placeholder', () => {
    const s = wrapSecret('my-real-token-1234');
    expect(`${s}`).toBe(SECRET_MASK);
  });
});

// -------------------- EnvCredentialBroker --------------------

function makeBroker(env: Record<string, string | undefined>, owner_served: string = 'liye-os') {
  const sink = new InMemoryCredentialAuditSink({
    owner: { component_id: 'liye-os.test', layer: 1 },
  });
  const broker = new EnvCredentialBroker({
    broker_id: 'test-broker',
    declared_scope: { owners_served: [owner_served], layer: 1 },
    audit_sink: sink,
    env_map: {
      'cred://liye-os/notion-api-key': 'NOTION_API_KEY',
      'cred://liye-os/hmac-secret': 'HMAC_SECRET',
    },
    env,
  });
  return { broker, sink };
}

const CTX: ResolutionContext = {
  requester_component_id: 'tester',
  requester_layer: 1,
  purpose: 'unit-test',
  authorization_ref: null,
};

describe('EnvCredentialBroker.resolve', () => {
  it('returns resolved + redacted hint for a present env var', async () => {
    const { broker, sink } = makeBroker({ NOTION_API_KEY: 'secret-abc' });
    const r = await broker.resolve('cred://liye-os/notion-api-key', CTX);
    expect(r.outcome).toBe('resolved');
    if (r.outcome === 'resolved') {
      expect(r.value.reveal()).toBe('secret-abc');
      expect(r.audit_id).toBeTruthy();
    }
    const audit = sink.list();
    expect(audit).toHaveLength(1);
    expect(audit[0].outcome).toBe('resolved');
    expect(audit[0].chain_result).toBe('env-hit');
    expect(audit[0].redacted_value_hint).toMatch(/^sha256:[a-f0-9]{12}\.\.\.$/);
  });

  it('returns not-found when env var is unset', async () => {
    const { broker, sink } = makeBroker({});
    const r = await broker.resolve('cred://liye-os/notion-api-key', CTX);
    expect(r.outcome).toBe('not-found');
    expect(sink.list()[0].chain_result).toBe('env-unset');
  });

  it('returns not-found when ref has no mapping', async () => {
    const { broker, sink } = makeBroker({ SOMETHING: 'x' });
    const r = await broker.resolve('cred://liye-os/unmapped-key', CTX);
    expect(r.outcome).toBe('not-found');
    expect(sink.list()[0].chain_result).toBe('no-mapping');
  });

  it('returns denied when owner is out of declared_scope', async () => {
    const { broker, sink } = makeBroker({ NOTION_API_KEY: 'secret-abc' }, 'some-other-owner');
    const r = await broker.resolve('cred://liye-os/notion-api-key', CTX);
    expect(r.outcome).toBe('denied');
    expect(sink.list()[0].chain_result).toBe('out-of-scope');
    expect(sink.list()[0].outcome).toBe('denied');
  });

  it('rejects invalid credential reference before any audit write', async () => {
    const { broker, sink } = makeBroker({});
    await expect(
      broker.resolve('http://bad/thing' as unknown as `cred://${string}/${string}`, CTX),
    ).rejects.toThrow(InvalidCredentialReferenceError);
    expect(sink.list()).toHaveLength(0);
  });
});

describe('EnvCredentialBroker — audit fields', () => {
  it('preserves requester_component_id / purpose / authorization_ref on every outcome', async () => {
    const { broker, sink } = makeBroker({ NOTION_API_KEY: 'k' });
    const ctx: ResolutionContext = {
      requester_component_id: 'component-x',
      requester_layer: 2,
      purpose: 'nightly-sync',
      authorization_ref: 'ADR-Credential-Mediation#M7',
    };
    await broker.resolve('cred://liye-os/notion-api-key', ctx);
    await broker.resolve('cred://liye-os/unmapped', ctx);

    const [a, b] = sink.list();
    for (const rec of [a, b]) {
      expect(rec.requester_component_id).toBe('component-x');
      expect(rec.requester_layer).toBe(2);
      expect(rec.purpose).toBe('nightly-sync');
      expect(rec.authorization_ref).toBe('ADR-Credential-Mediation#M7');
      expect(rec.broker_id).toBe('test-broker');
      expect(rec.adjacent_kind).toBe('credential-audit');
    }
  });

  it('does NOT include the raw secret anywhere in the audit record', async () => {
    const { broker, sink } = makeBroker({ NOTION_API_KEY: 'super-secret-xyz' });
    await broker.resolve('cred://liye-os/notion-api-key', CTX);
    const serialized = JSON.stringify(sink.list());
    expect(serialized).not.toContain('super-secret-xyz');
    expect(serialized).toContain(SECRET_MASK === '***REDACTED***' ? 'sha256:' : '');  // hint prefix
  });
});
