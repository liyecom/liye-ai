/**
 * LiYe AI Agent Executor
 * Location: src/runtime/executor/agent.ts
 *
 * Runtime shell for executing agents (← CrewAI pattern)
 */

import {
  AgentConfig,
  Task,
  TaskResult,
  ExecutionContext,
  ExecutionResult
} from './types';
import { loader as skillLoader } from '../../skill/loader';
import { Skill } from '../../skill/types';

/**
 * Agent Executor
 * Executes agent tasks using loaded skills
 */
export class AgentExecutor {
  private config: AgentConfig;
  private memory: Map<string, any> = new Map();
  private iteration: number = 0;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Execute a task
   */
  async executeTask(task: Task, context: ExecutionContext): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      // Load the skill
      const skill = skillLoader.load(task.skill) as Skill;
      if (!skill) {
        throw new Error(`Skill ${task.skill} not found`);
      }

      // Validate inputs
      if (!skill.validate(task.inputs)) {
        throw new Error(`Invalid inputs for skill ${task.skill}`);
      }

      // Check iteration limit
      if (this.iteration >= this.config.runtime.max_iterations) {
        throw new Error('Max iterations reached');
      }
      this.iteration++;

      // Execute the skill
      const outputs = await skill.execute(task.inputs);

      // Store in memory if enabled
      if (this.config.runtime.memory) {
        this.memory.set(task.id, outputs);
      }

      return {
        task_id: task.id,
        status: 'success',
        outputs,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        task_id: task.id,
        status: 'failure',
        outputs: {},
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute multiple tasks based on process mode
   */
  async executeTasks(tasks: Task[], context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const results: TaskResult[] = [];
    const outputs: Record<string, any> = {};

    const mode = this.config.runtime.process;

    try {
      if (mode === 'sequential') {
        // Execute tasks one by one
        for (const task of tasks) {
          const result = await this.executeTask(task, context);
          results.push(result);
          if (result.status === 'success') {
            outputs[task.id] = result.outputs;
          }
        }
      } else if (mode === 'parallel') {
        // Execute all tasks in parallel
        const promises = tasks.map(task => this.executeTask(task, context));
        const parallelResults = await Promise.all(promises);
        for (let i = 0; i < tasks.length; i++) {
          results.push(parallelResults[i]);
          if (parallelResults[i].status === 'success') {
            outputs[tasks[i].id] = parallelResults[i].outputs;
          }
        }
      } else if (mode === 'hierarchical') {
        // Execute with delegation (simplified)
        for (const task of tasks) {
          const result = await this.executeTask(task, context);
          results.push(result);
          if (result.status === 'success') {
            outputs[task.id] = result.outputs;
          }
        }
      }

      const hasFailure = results.some(r => r.status === 'failure');

      return {
        status: hasFailure ? 'failed' : 'completed',
        outputs,
        tasks: results,
        duration: Date.now() - startTime,
        quality_score: this.calculateQualityScore(results)
      };

    } catch (error) {
      return {
        status: 'failed',
        outputs,
        tasks: results,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Calculate quality score based on task results
   */
  private calculateQualityScore(results: TaskResult[]): number {
    if (results.length === 0) return 0;

    const successCount = results.filter(r => r.status === 'success').length;
    return successCount / results.length;
  }

  /**
   * Get agent info
   */
  getInfo(): { id: string; name: string; role: string } {
    return {
      id: this.config.id,
      name: this.config.name,
      role: this.config.persona.role
    };
  }

  /**
   * Get memory contents
   */
  getMemory(): Record<string, any> {
    return Object.fromEntries(this.memory);
  }

  /**
   * Clear memory
   */
  clearMemory(): void {
    this.memory.clear();
  }

  /**
   * Reset iteration counter
   */
  resetIterations(): void {
    this.iteration = 0;
  }
}

export default AgentExecutor;
