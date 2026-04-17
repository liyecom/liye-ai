/**
 * BGHS Credential Mediation — EnvCredentialBroker
 * Location: src/runtime/credential/broker.ts
 *
 * ADR-Credential-Mediation §3. This is the sanctioned bridge between
 * legacy `process.env.*` reads and the P1-f seam. Consumers get
 * CredentialReferences; the broker keeps the env-variable mapping in
 * its own private table (never leaked to callers or logs).
 *
 * The env gate (Sprint 2 Wave 2.2) whitelists `src/runtime/credential/**`
 * so this file is allowed to read process.env directly — it is the
 * bootstrap seam (ADR M7).
 */

import { createHash } from 'node:crypto';
import { parseCredentialRef } from './reference';
import { wrapSecret } from './secret_value';
import type {
  BrokerScope,
  CredentialAuditSink,
  CredentialBroker,
  CredentialReference,
  ResolutionContext,
  ResolutionResult,
} from './types';

export interface EnvBrokerConfig {
  broker_id: string;
  declared_scope: BrokerScope;
  audit_sink: CredentialAuditSink;
  /**
   * Mapping from CredentialReference string to the env variable name
   * that holds the raw secret. Never exposed to consumers.
   */
  env_map: Readonly<Record<CredentialReference, string>>;
  /**
   * Optional env accessor (defaults to process.env). Injection point
   * for tests — production always uses the real process.env.
   */
  env?: NodeJS.ProcessEnv;
}

function hint(raw: string): string {
  const sha = createHash('sha256').update(raw).digest('hex');
  return `sha256:${sha.slice(0, 12)}...`;
}

function nowUtc(): string {
  return new Date().toISOString();
}

export class EnvCredentialBroker implements CredentialBroker {
  readonly broker_id: string;
  readonly declared_scope: BrokerScope;
  readonly audit_sink: CredentialAuditSink;

  private readonly env_map: Readonly<Record<string, string>>;
  private readonly env: NodeJS.ProcessEnv;

  constructor(config: EnvBrokerConfig) {
    this.broker_id = config.broker_id;
    this.declared_scope = config.declared_scope;
    this.audit_sink = config.audit_sink;
    this.env_map = config.env_map;
    this.env = config.env ?? process.env;
  }

  async resolve(
    ref: CredentialReference,
    ctx: ResolutionContext,
  ): Promise<ResolutionResult> {
    const parsed = parseCredentialRef(ref);   // throws InvalidCredentialReferenceError on bad input

    // Scope check — broker must be declared to serve this owner.
    if (!this.declared_scope.owners_served.includes(parsed.owner)) {
      const audit_id = await this.audit_sink.append({
        credential_path: ref,
        requester_component_id: ctx.requester_component_id,
        requester_layer: ctx.requester_layer,
        purpose: ctx.purpose,
        outcome: 'denied',
        chain_step: 0,
        chain_result: 'out-of-scope',
        redacted_value_hint: null,
        authorization_ref: ctx.authorization_ref,
        broker_id: this.broker_id,
        resolved_at: nowUtc(),
      });
      return {
        outcome: 'denied',
        denial_reason: `broker ${this.broker_id} does not serve owner "${parsed.owner}"`,
        audit_id,
      };
    }

    const envKey = this.env_map[ref];
    if (!envKey) {
      const audit_id = await this.audit_sink.append({
        credential_path: ref,
        requester_component_id: ctx.requester_component_id,
        requester_layer: ctx.requester_layer,
        purpose: ctx.purpose,
        outcome: 'not-found',
        chain_step: 0,
        chain_result: 'no-mapping',
        redacted_value_hint: null,
        authorization_ref: ctx.authorization_ref,
        broker_id: this.broker_id,
        resolved_at: nowUtc(),
      });
      return { outcome: 'not-found', audit_id };
    }

    const raw = this.env[envKey];
    if (!raw) {
      const audit_id = await this.audit_sink.append({
        credential_path: ref,
        requester_component_id: ctx.requester_component_id,
        requester_layer: ctx.requester_layer,
        purpose: ctx.purpose,
        outcome: 'not-found',
        chain_step: 0,
        chain_result: 'env-unset',
        redacted_value_hint: null,
        authorization_ref: ctx.authorization_ref,
        broker_id: this.broker_id,
        resolved_at: nowUtc(),
      });
      return { outcome: 'not-found', audit_id };
    }

    const audit_id = await this.audit_sink.append({
      credential_path: ref,
      requester_component_id: ctx.requester_component_id,
      requester_layer: ctx.requester_layer,
      purpose: ctx.purpose,
      outcome: 'resolved',
      chain_step: 0,
      chain_result: 'env-hit',
      redacted_value_hint: hint(raw),
      authorization_ref: ctx.authorization_ref,
      broker_id: this.broker_id,
      resolved_at: nowUtc(),
    });

    return {
      outcome: 'resolved',
      value: wrapSecret(raw),
      audit_id,
    };
  }
}
