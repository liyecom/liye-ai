/**
 * LiYe AI Runtime Type Definitions
 * Location: src/runtime/executor/types.ts
 */

// === Agent Types ===
export interface AgentConfig {
  id: string;
  name: string;
  domain: string;
  persona: PersonaConfig;
  skills: SkillsConfig;
  runtime: RuntimeConfig;
}

export interface PersonaConfig {
  role: string;
  goal: string;
  backstory?: string;
  communication_style?: string;
}

export interface SkillsConfig {
  atomic: string[];
  composite?: string[];
}

export interface RuntimeConfig {
  process: 'sequential' | 'hierarchical' | 'parallel';
  memory: boolean;
  delegation: boolean;
  max_iterations: number;
  verbose: boolean;
}

// === Task Types ===
export interface Task {
  id: string;
  agent: string;
  skill: string;
  inputs: Record<string, any>;
  depends_on?: string[];
  timeout?: number;
}

export interface TaskResult {
  task_id: string;
  status: 'success' | 'failure' | 'timeout';
  outputs: Record<string, any>;
  duration: number;
  error?: string;
}

// === Execution Types ===
export interface ExecutionContext {
  workflow_id: string;
  phase_id: string;
  task_id: string;
  inputs: Record<string, any>;
  memory: Record<string, any>;
}

export interface ExecutionResult {
  status: 'completed' | 'failed' | 'cancelled';
  outputs: Record<string, any>;
  tasks: TaskResult[];
  duration: number;
  quality_score?: number;
}

// === Memory Types ===
export interface MemoryStore {
  get(key: string): any;
  set(key: string, value: any): void;
  has(key: string): boolean;
  clear(): void;
}

// === Process Types ===
export type ProcessMode = 'sequential' | 'hierarchical' | 'parallel';

export interface ProcessConfig {
  mode: ProcessMode;
  max_parallel?: number;
  timeout?: number;
}
