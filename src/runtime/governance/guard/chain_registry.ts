/**
 * BGHS Guard — GuardChain registry + validator
 * Location: src/runtime/governance/guard/chain_registry.ts
 *
 * ADR-Loamwise-Guard-Content-Security §7. Enforces:
 *   - G2 protected_path.kind must be in the 6-entry whitelist.
 *   - G2 protected_path.required_guard_kinds must be covered by
 *     chain.steps.
 *   - G3 SHADOW step must have non_shadow_allowed_by == null.
 *   - G3 ADVISORY/ACTIVE step must have non_shadow_allowed_by != null
 *     (step-level; chain-level declared_by_adr does not satisfy this).
 *   - G3 global_shadow must be false (schema-forced; caller may not
 *     override without a double-signed ADR).
 *   - VerdictRouting must never allow on_dangerous = 'pass'.
 *   - Chain must carry declared_by_adr.
 */

import {
  GuardEnforcementMode,
  PROTECTED_PATHS_WHITELIST,
  type GuardChain,
  type GuardRegisterResult,
} from './types';

export class GuardChainRegistry {
  private chains: Map<string, GuardChain> = new Map();

  register(chain: GuardChain): GuardRegisterResult {
    if (this.chains.has(chain.chain_id)) {
      return { ok: false, code: 'DUPLICATE_CHAIN_ID', detail: chain.chain_id };
    }

    if (!chain.declared_by_adr) {
      return { ok: false, code: 'MISSING_CHAIN_ADR' };
    }

    if (chain.global_shadow !== false) {
      return { ok: false, code: 'GLOBAL_SHADOW_DISALLOWED' };
    }

    if (!PROTECTED_PATHS_WHITELIST.has(chain.protected_path.kind)) {
      return {
        ok: false,
        code: 'PATH_NOT_IN_WHITELIST',
        detail: chain.protected_path.kind,
      };
    }

    const stepKinds = new Set(chain.steps.map((s) => s.guard_kind));
    for (const required of chain.protected_path.required_guard_kinds) {
      if (!stepKinds.has(required)) {
        return {
          ok: false,
          code: 'MISSING_REQUIRED_GUARD_KIND',
          detail: required,
        };
      }
    }

    for (const step of chain.steps) {
      if (step.mode === GuardEnforcementMode.SHADOW) {
        if (step.non_shadow_allowed_by !== null) {
          return {
            ok: false,
            code: 'SHADOW_STEP_HAS_NON_SHADOW_REF',
            detail: step.step_id,
          };
        }
      } else {
        if (!step.non_shadow_allowed_by) {
          return {
            ok: false,
            code: 'NON_SHADOW_STEP_MISSING_ESCALATION_ADR',
            detail: step.step_id,
          };
        }
      }

      // VerdictRouting: 'pass' on dangerous is forbidden (TS type already
      // excludes it, but runtime validator guards against relaxed inputs).
      const dangerous = step.on_verdict.on_dangerous as string;
      if (dangerous === 'pass') {
        return {
          ok: false,
          code: 'VERDICT_ROUTING_ALLOWS_DANGEROUS_PASS',
          detail: step.step_id,
        };
      }
    }

    this.chains.set(chain.chain_id, chain);
    return { ok: true, chain_id: chain.chain_id };
  }

  lookup(chain_id: string): GuardChain | null {
    return this.chains.get(chain_id) ?? null;
  }

  size(): number {
    return this.chains.size;
  }

  _clearForTests(): void {
    this.chains.clear();
  }
}
