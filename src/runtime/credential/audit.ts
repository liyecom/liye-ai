/**
 * BGHS Credential Mediation — in-memory audit sink
 * Location: src/runtime/credential/audit.ts
 *
 * Sprint 2 Wave 2.1 ships an in-memory CredentialAuditSink so broker
 * unit tests and local development have a full end-to-end path. Later
 * sprints add a SessionAdjacentArtifact sink that registers each
 * record as a CREDENTIAL_AUDIT entry in the Layer 0 StreamRegistry
 * (ADR-Credential-Mediation §4 + P1-e §3 QUERY_AUDIT sibling rules).
 */

import { randomUUID } from 'node:crypto';
import type {
  CredentialAuditAppendInput,
  CredentialAuditRecord,
  CredentialAuditSink,
} from './types';

interface InMemoryAuditOptions {
  /** The component_id / layer writing the audit entries. */
  owner: { component_id: string; layer: 0 | 1 | 2 };
}

export class InMemoryCredentialAuditSink implements CredentialAuditSink {
  private records: CredentialAuditRecord[] = [];

  constructor(private readonly opts: InMemoryAuditOptions) {}

  async append(input: CredentialAuditAppendInput): Promise<string> {
    const audit_id = randomUUID();
    const rec: CredentialAuditRecord = {
      ...input,
      artifact_id: audit_id,
      adjacent_kind: 'credential-audit',
      owner: this.opts.owner,
    };
    this.records.push(rec);
    return audit_id;
  }

  list(): readonly CredentialAuditRecord[] {
    return this.records;
  }

  _clearForTests(): void {
    this.records = [];
  }
}
