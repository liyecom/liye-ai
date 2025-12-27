/**
 * LiYe AI Skill Loader
 * Location: src/skill/loader/index.ts
 */

import { Skill, CompositeSkill, SkillLoader as ISkillLoader } from '../types';
import { SkillRegistry, registry as defaultRegistry } from '../registry';

/**
 * Skill Loader Implementation
 * Loads skills from registry with caching
 */
export class SkillLoader implements ISkillLoader {
  private registry: SkillRegistry;
  private cache: Map<string, Skill | CompositeSkill> = new Map();

  constructor(registry?: SkillRegistry) {
    this.registry = registry || defaultRegistry;
  }

  /**
   * Load a skill by ID
   */
  load(id: string): Skill | CompositeSkill | undefined {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    // Load from registry
    const skill = this.registry.get(id);
    if (skill) {
      this.cache.set(id, skill);
    }

    return skill;
  }

  /**
   * Load multiple skills
   */
  loadMany(ids: string[]): (Skill | CompositeSkill)[] {
    const skills: (Skill | CompositeSkill)[] = [];

    for (const id of ids) {
      const skill = this.load(id);
      if (skill) {
        skills.push(skill);
      } else {
        console.warn(`Skill ${id} not found in registry`);
      }
    }

    return skills;
  }

  /**
   * Clear the loader cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Preload all skills into cache
   */
  preloadAll(): void {
    const ids = this.registry.list();
    this.loadMany(ids);
  }
}

// Export singleton instance
export const loader = new SkillLoader();
export default loader;
