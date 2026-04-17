/**
 * BGHS Session Registry — StreamRegistry
 * Location: src/runtime/governance/session/stream_registry.ts
 *
 * ADR-Session-and-Session-Adjacent-Taxonomy-Federated-Query §4.
 * Registry is a metadata layer; it does not store stream payloads.
 *
 * Sprint 1 Wave 1.1 scope:
 *   - registerStream() (strict, F1-compliant only)
 *   - registerProvisionalStream() (F1.3 exempted, must be opt-in)
 *   - lookupStream() / listStreams()
 * SessionAdjacentArtifact registration and federated query live in later
 * sprints.
 */

import type {
  RegisterResult,
  RegistryEntry,
  SessionEventStream,
  StreamFilter,
} from './types';
import { validateProvisional, validateStrict } from './validator';

function computeF1(s: SessionEventStream): boolean {
  return s.is_append_only === true && s.is_hash_chained === true;
}

function matchesFilter(entry: RegistryEntry, f: StreamFilter): boolean {
  const s = entry.stream;
  if (f.owner_component_id && s.owner.component_id !== f.owner_component_id) return false;
  if (f.scope_kind && s.scope.scope_kind !== f.scope_kind) return false;
  if (f.format && s.format !== f.format) return false;
  if (f.f1_compliant_only && !entry.f1_compliant) return false;
  if (f.scope_keys) {
    for (const [k, v] of Object.entries(f.scope_keys)) {
      if (s.scope.scope_keys[k] !== v) return false;
    }
  }
  return true;
}

export class StreamRegistry {
  private entries: Map<string, RegistryEntry> = new Map();

  /** Strict registration — rejects any stream that does not meet F1.1 + F1.3. */
  registerStream(s: SessionEventStream): RegisterResult {
    if (this.entries.has(s.stream_id)) {
      return { ok: false, code: 'DUPLICATE_STREAM_ID', detail: s.stream_id };
    }
    const err = validateStrict(s);
    if (err) return { ok: false, code: err };
    const entry: RegistryEntry = {
      stream: s,
      f1_compliant: computeF1(s),
      provisional: false,
    };
    this.entries.set(s.stream_id, entry);
    return { ok: true, stream_id: s.stream_id, f1_compliant: entry.f1_compliant };
  }

  /**
   * Provisional registration — allows is_hash_chained=false. The stream is
   * flagged provisional; downstream federated queries must NOT place its
   * events in strict_truth bucket 1 until it satisfies F1.3 and is re-
   * registered via registerStream().
   */
  registerProvisionalStream(s: SessionEventStream): RegisterResult {
    if (this.entries.has(s.stream_id)) {
      return { ok: false, code: 'DUPLICATE_STREAM_ID', detail: s.stream_id };
    }
    const err = validateProvisional(s);
    if (err) return { ok: false, code: err };
    const entry: RegistryEntry = {
      stream: s,
      f1_compliant: computeF1(s),
      provisional: true,
    };
    this.entries.set(s.stream_id, entry);
    return { ok: true, stream_id: s.stream_id, f1_compliant: entry.f1_compliant };
  }

  lookupStream(stream_id: string): RegistryEntry | null {
    return this.entries.get(stream_id) ?? null;
  }

  listStreams(filter: StreamFilter = {}): RegistryEntry[] {
    const out: RegistryEntry[] = [];
    for (const entry of this.entries.values()) {
      if (matchesFilter(entry, filter)) out.push(entry);
    }
    return out;
  }

  /** Test/admin helper — clears the registry. NOT for production paths. */
  _clearForTests(): void {
    this.entries.clear();
  }

  /** Entry count (observability). */
  size(): number {
    return this.entries.size;
  }
}
