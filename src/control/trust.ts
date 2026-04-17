/**
 * LiYe AI Trust Score Store
 * Location: src/control/trust.ts
 *
 * EMA-based 3-dimensional trust scoring with YAML persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { TrustProfile, ITrustStore } from './types';

const EMA_ALPHA = 0.1;
const COLD_START_SCORE = 0.5;

const DEFAULT_PROFILE: TrustProfile = {
  overall_score: COLD_START_SCORE,
  read_score: COLD_START_SCORE,
  write_score: COLD_START_SCORE,
  total_executions: 0,
  last_updated: new Date().toISOString(),
};

export class TrustScoreStore implements ITrustStore {
  private profiles: Map<string, TrustProfile> = new Map();
  private persistPath: string;

  constructor(persistPath: string = 'state/control/trust-scores.yaml') {
    this.persistPath = path.resolve(persistPath);
    this.load();
  }

  /**
   * Get trust profile for an agent (cold-start if not found)
   */
  getProfile(agentId: string): TrustProfile {
    if (!this.profiles.has(agentId)) {
      this.profiles.set(agentId, {
        ...DEFAULT_PROFILE,
        last_updated: new Date().toISOString(),
      });
    }
    return this.profiles.get(agentId)!;
  }

  /**
   * Record execution outcome and update trust scores
   * EMA: score = alpha * (success ? 1 : 0) + (1 - alpha) * score
   * overall = read * 0.4 + write * 0.6 (ranking only, not for write gating)
   */
  recordOutcome(agentId: string, kind: 'read' | 'write', success: boolean): void {
    const profile = this.getProfile(agentId);
    const signal = success ? 1 : 0;

    if (kind === 'read') {
      profile.read_score = EMA_ALPHA * signal + (1 - EMA_ALPHA) * profile.read_score;
    } else {
      profile.write_score = EMA_ALPHA * signal + (1 - EMA_ALPHA) * profile.write_score;
    }

    // Recalculate overall (for ranking only)
    profile.overall_score = profile.read_score * 0.4 + profile.write_score * 0.6;
    profile.total_executions++;
    profile.last_updated = new Date().toISOString();

    this.save();
  }

  /**
   * Set trust profile directly (for initialization from registry)
   */
  setProfile(agentId: string, profile: TrustProfile): void {
    this.profiles.set(agentId, profile);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): Map<string, TrustProfile> {
    return new Map(this.profiles);
  }

  /**
   * Load profiles from YAML persistence
   */
  private load(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const content = fs.readFileSync(this.persistPath, 'utf-8');
        const data = yaml.load(content) as Record<string, TrustProfile> | null;
        if (data && typeof data === 'object') {
          for (const [agentId, profile] of Object.entries(data)) {
            if (profile && typeof profile.overall_score === 'number') {
              this.profiles.set(agentId, profile);
            }
          }
        }
      }
    } catch {
      // Start fresh if load fails
    }
  }

  /**
   * Save profiles to YAML
   */
  private save(): void {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data: Record<string, TrustProfile> = {};
      for (const [agentId, profile] of this.profiles) {
        data[agentId] = profile;
      }
      fs.writeFileSync(this.persistPath, yaml.dump(data, { lineWidth: 120 }), 'utf-8');
    } catch {
      // Silently fail on save errors
    }
  }
}

export default TrustScoreStore;
