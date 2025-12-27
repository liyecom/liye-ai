/**
 * LiYe AI Context Memory
 * Location: src/runtime/memory/context.ts
 *
 * Manages execution context and memory across tasks
 */

import { MemoryStore } from '../executor/types';

/**
 * Context Memory Implementation
 * Stores and retrieves execution context
 */
export class ContextMemory implements MemoryStore {
  private store: Map<string, any> = new Map();
  private history: Array<{ key: string; value: any; timestamp: number }> = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Get value by key
   */
  get(key: string): any {
    return this.store.get(key);
  }

  /**
   * Set value with optional history tracking
   */
  set(key: string, value: any): void {
    this.store.set(key, value);

    // Track history
    this.history.push({
      key,
      value,
      timestamp: Date.now()
    });

    // Trim history if needed
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Clear all memory
   */
  clear(): void {
    this.store.clear();
    this.history = [];
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get all values
   */
  values(): any[] {
    return Array.from(this.store.values());
  }

  /**
   * Get memory as plain object
   */
  toObject(): Record<string, any> {
    return Object.fromEntries(this.store);
  }

  /**
   * Load from plain object
   */
  fromObject(obj: Record<string, any>): void {
    for (const [key, value] of Object.entries(obj)) {
      this.set(key, value);
    }
  }

  /**
   * Get history entries
   */
  getHistory(limit?: number): Array<{ key: string; value: any; timestamp: number }> {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get history for a specific key
   */
  getKeyHistory(key: string): Array<{ value: any; timestamp: number }> {
    return this.history
      .filter(entry => entry.key === key)
      .map(({ value, timestamp }) => ({ value, timestamp }));
  }

  /**
   * Get memory size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Delete a key
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Merge another memory store
   */
  merge(other: ContextMemory): void {
    const otherObj = other.toObject();
    for (const [key, value] of Object.entries(otherObj)) {
      this.set(key, value);
    }
  }
}

export default ContextMemory;
