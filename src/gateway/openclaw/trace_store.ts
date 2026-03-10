/**
 * Trace Store
 *
 * Append-only event log for governance traces.
 * Each trace is stored in state/traces/<trace_id>/ with:
 * - events.jsonl: Append-only event log
 * - result.json: Final result (when complete)
 */

import { mkdir, readFile, appendFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { TraceEvent } from './types';

export class TraceStore {
  private rootDir: string;

  constructor(rootDir: string = 'state/traces') {
    this.rootDir = rootDir;
  }

  private traceDir(traceId: string): string {
    return join(this.rootDir, traceId);
  }

  private eventsPath(traceId: string): string {
    return join(this.traceDir(traceId), 'events.jsonl');
  }

  private resultPath(traceId: string): string {
    return join(this.traceDir(traceId), 'result.json');
  }

  /**
   * Initialize a new trace.
   */
  async init(traceId: string): Promise<void> {
    const dir = this.traceDir(traceId);
    await mkdir(dir, { recursive: true });
    // Create empty events file
    await writeFile(this.eventsPath(traceId), '', 'utf-8');
  }

  /**
   * Append an event to the trace log.
   * Returns the event with seq number.
   */
  async append(
    traceId: string,
    event: Omit<TraceEvent, 'seq'>
  ): Promise<TraceEvent> {
    const eventsPath = this.eventsPath(traceId);

    // Get current seq by counting lines
    let seq = 0;
    if (existsSync(eventsPath)) {
      const content = await readFile(eventsPath, 'utf-8');
      seq = content.trim().split('\n').filter((line) => line.length > 0).length;
    }

    const fullEvent: TraceEvent = { seq, ...event };
    await appendFile(eventsPath, JSON.stringify(fullEvent) + '\n', 'utf-8');

    return fullEvent;
  }

  /**
   * List events since a sequence number.
   */
  async list(traceId: string, sinceSeq: number = 0): Promise<TraceEvent[]> {
    const eventsPath = this.eventsPath(traceId);

    if (!existsSync(eventsPath)) {
      return [];
    }

    const content = await readFile(eventsPath, 'utf-8');
    const lines = content.trim().split('\n').filter((line) => line.length > 0);

    return lines
      .map((line) => JSON.parse(line) as TraceEvent)
      .filter((event) => event.seq >= sinceSeq);
  }

  /**
   * Set the final result for a trace.
   */
  async setResult(traceId: string, result: unknown): Promise<void> {
    const resultPath = this.resultPath(traceId);
    await writeFile(resultPath, JSON.stringify(result, null, 2), 'utf-8');
  }

  /**
   * Get trace events and result.
   */
  async get(
    traceId: string
  ): Promise<{ events: TraceEvent[]; result?: unknown }> {
    const events = await this.list(traceId);

    let result: unknown;
    const resultPath = this.resultPath(traceId);
    if (existsSync(resultPath)) {
      const content = await readFile(resultPath, 'utf-8');
      result = JSON.parse(content);
    }

    return { events, result };
  }

  /**
   * Check if a trace exists.
   */
  exists(traceId: string): boolean {
    return existsSync(this.traceDir(traceId));
  }
}
