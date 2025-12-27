/**
 * LiYe AI Skill Registry
 * Location: src/skill/registry/index.ts
 */

import { Skill, CompositeSkill, SkillRegistry as ISkillRegistry } from '../types';

// Import atomic skills
import { market_research } from '../atomic/market_research';
import { competitor_analysis } from '../atomic/competitor_analysis';
import { keyword_research } from '../atomic/keyword_research';
import { content_optimization } from '../atomic/content_optimization';

/**
 * Skill Registry Implementation
 * Manages registration and retrieval of skills
 */
export class SkillRegistry implements ISkillRegistry {
  private skills: Map<string, Skill | CompositeSkill> = new Map();
  private categories: Map<string, Set<string>> = new Map();

  constructor() {
    // Auto-register built-in skills
    this.registerBuiltinSkills();
  }

  /**
   * Register a skill
   */
  register(skill: Skill | CompositeSkill): void {
    if (this.skills.has(skill.id)) {
      console.warn(`Skill ${skill.id} is already registered. Overwriting.`);
    }

    this.skills.set(skill.id, skill);

    // Track by category if available
    if ('category' in skill && skill.category) {
      if (!this.categories.has(skill.category)) {
        this.categories.set(skill.category, new Set());
      }
      this.categories.get(skill.category)!.add(skill.id);
    }
  }

  /**
   * Get a skill by ID
   */
  get(id: string): Skill | CompositeSkill | undefined {
    return this.skills.get(id);
  }

  /**
   * List all registered skill IDs
   */
  list(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * List skills by category
   */
  listByCategory(category: string): string[] {
    const categorySkills = this.categories.get(category);
    return categorySkills ? Array.from(categorySkills) : [];
  }

  /**
   * Get skill count
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * Check if a skill exists
   */
  has(id: string): boolean {
    return this.skills.has(id);
  }

  /**
   * Register built-in skills
   */
  private registerBuiltinSkills(): void {
    // Research skills
    this.register(market_research);
    this.register(competitor_analysis);

    // Optimization skills
    this.register(keyword_research);
    this.register(content_optimization);
  }
}

// Export singleton instance
export const registry = new SkillRegistry();
export default registry;
