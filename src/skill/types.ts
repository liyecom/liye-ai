/**
 * LiYe AI Skill Type Definitions
 * Location: src/skill/types.ts
 */

// === Input/Output Types ===
export interface SkillInput {
  [key: string]: any;
}

export interface SkillOutput {
  [key: string]: any;
}

// === Schema Types ===
export interface PropertySchema {
  type: string;
  required?: boolean;
  description?: string;
  default?: any;
  enum?: string[];
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
}

export interface Schema {
  type: string;
  properties: Record<string, PropertySchema>;
  required?: string[];
}

// === Skill Interface ===
export interface Skill {
  // Metadata
  id: string;
  name: string;
  version: string;
  description: string;
  category?: string;

  // Schema
  input: Schema;
  output: Schema;

  // Methods
  execute(input: SkillInput): Promise<SkillOutput>;
  validate(input: SkillInput): boolean;
}

// === Composite Skill Interface ===
export interface SkillChainStep {
  skill: string;
  input_mapping: Record<string, string>;
  output_alias: string;
}

export interface CompositeSkill {
  id: string;
  name: string;
  version: string;
  description: string;

  chain: SkillChainStep[];
  output_mapping: Record<string, string>;
}

// === Registry Types ===
export interface SkillRegistry {
  register(skill: Skill | CompositeSkill): void;
  get(id: string): Skill | CompositeSkill | undefined;
  list(): string[];
  listByCategory(category: string): string[];
}

// === Loader Types ===
export interface SkillLoader {
  load(id: string): Skill | CompositeSkill | undefined;
  loadMany(ids: string[]): (Skill | CompositeSkill)[];
}
