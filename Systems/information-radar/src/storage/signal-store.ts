/**
 * Signal Store - KV-based signal persistence
 * V2.0: Stores signals with structured indexes for digest generation
 *
 * Key Schema:
 * - signal:{date}:{source}_{id} → StoredSignal
 * - index:daily:{YYYY-MM-DD} → string[] (signal IDs)
 * - index:weekly:{YYYY}-W{WW} → string[] (signal IDs)
 */

import type { Signal, StoredSignal, Env } from "../types";

// ISO week number calculation
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Format week as YYYY-WXX
function formatWeek(date: Date): string {
  const week = getISOWeek(date);
  return `${date.getFullYear()}-W${week.toString().padStart(2, "0")}`;
}

/**
 * Generate a unique signal ID from source and item ID
 */
export function generateSignalId(source: string, itemId: string): string {
  return `${source}_${itemId}`;
}

/**
 * Store a signal in KV with proper indexing
 */
export async function storeSignal(
  signal: Signal,
  itemId: string,
  env: Env
): Promise<StoredSignal | null> {
  if (!env.SIGNAL_STORE) {
    console.warn("[SignalStore] SIGNAL_STORE not configured, skipping storage");
    return null;
  }

  const now = new Date();
  const dateStr = formatDate(now);
  const weekStr = formatWeek(now);
  const signalId = generateSignalId(signal.source, itemId);

  // Build StoredSignal
  const storedSignal: StoredSignal = {
    ...signal,
    id: signalId,
    stored_at: now.toISOString(),
    key_points: [], // Will be populated from summary
    target_audience: "", // Will be populated from summary
  };

  // Store the signal
  const signalKey = `signal:${dateStr}:${signalId}`;
  await env.SIGNAL_STORE.put(signalKey, JSON.stringify(storedSignal), {
    expirationTtl: 60 * 60 * 24 * 90, // 90 days TTL
  });

  // Update daily index
  await updateIndex(env.SIGNAL_STORE, `index:daily:${dateStr}`, signalId);

  // Update weekly index
  await updateIndex(env.SIGNAL_STORE, `index:weekly:${weekStr}`, signalId);

  console.log(`[SignalStore] Stored signal ${signalId} for ${dateStr}`);
  return storedSignal;
}

/**
 * Store a signal with full summary data
 */
export async function storeSignalWithSummary(
  signal: Signal,
  itemId: string,
  keyPoints: string[],
  targetAudience: string,
  env: Env
): Promise<StoredSignal | null> {
  if (!env.SIGNAL_STORE) {
    console.warn("[SignalStore] SIGNAL_STORE not configured, skipping storage");
    return null;
  }

  const now = new Date();
  const dateStr = formatDate(now);
  const weekStr = formatWeek(now);
  const signalId = generateSignalId(signal.source, itemId);

  // Build StoredSignal with summary data
  const storedSignal: StoredSignal = {
    ...signal,
    id: signalId,
    stored_at: now.toISOString(),
    key_points: keyPoints,
    target_audience: targetAudience,
  };

  // Store the signal
  const signalKey = `signal:${dateStr}:${signalId}`;
  await env.SIGNAL_STORE.put(signalKey, JSON.stringify(storedSignal), {
    expirationTtl: 60 * 60 * 24 * 90, // 90 days TTL
  });

  // Update daily index
  await updateIndex(env.SIGNAL_STORE, `index:daily:${dateStr}`, signalId);

  // Update weekly index
  await updateIndex(env.SIGNAL_STORE, `index:weekly:${weekStr}`, signalId);

  console.log(`[SignalStore] Stored signal ${signalId} for ${dateStr}`);
  return storedSignal;
}

/**
 * Update an index by adding a signal ID
 */
async function updateIndex(
  kv: KVNamespace,
  indexKey: string,
  signalId: string
): Promise<void> {
  const existing = await kv.get(indexKey);
  const ids: string[] = existing ? JSON.parse(existing) : [];

  if (!ids.includes(signalId)) {
    ids.push(signalId);
    await kv.put(indexKey, JSON.stringify(ids), {
      expirationTtl: 60 * 60 * 24 * 90, // 90 days TTL
    });
  }
}

/**
 * Get all signals for a specific date
 */
export async function getSignalsByDate(
  date: string, // YYYY-MM-DD
  env: Env
): Promise<StoredSignal[]> {
  if (!env.SIGNAL_STORE) {
    console.warn("[SignalStore] SIGNAL_STORE not configured");
    return [];
  }

  // Get index
  const indexKey = `index:daily:${date}`;
  const indexData = await env.SIGNAL_STORE.get(indexKey);

  if (!indexData) {
    return [];
  }

  const signalIds: string[] = JSON.parse(indexData);
  const signals: StoredSignal[] = [];

  // Fetch each signal
  for (const signalId of signalIds) {
    const signalKey = `signal:${date}:${signalId}`;
    const signalData = await env.SIGNAL_STORE.get(signalKey);
    if (signalData) {
      signals.push(JSON.parse(signalData) as StoredSignal);
    }
  }

  // Sort by value_score descending
  return signals.sort((a, b) => b.value_score - a.value_score);
}

/**
 * Get all signals for a specific week
 */
export async function getSignalsByWeek(
  week: string, // YYYY-WXX
  env: Env
): Promise<StoredSignal[]> {
  if (!env.SIGNAL_STORE) {
    console.warn("[SignalStore] SIGNAL_STORE not configured");
    return [];
  }

  // Get index
  const indexKey = `index:weekly:${week}`;
  const indexData = await env.SIGNAL_STORE.get(indexKey);

  if (!indexData) {
    return [];
  }

  const signalIds: string[] = JSON.parse(indexData);
  const signals: StoredSignal[] = [];
  const seen = new Set<string>();

  // We need to find the signals across multiple days
  // Parse week to get date range
  const weekMatch = week.match(/(\d{4})-W(\d{2})/);
  if (!weekMatch) {
    return [];
  }

  const year = parseInt(weekMatch[1]);
  const weekNum = parseInt(weekMatch[2]);

  // Get all days in this week
  const weekDates = getWeekDates(year, weekNum);

  for (const date of weekDates) {
    const dateStr = formatDate(date);
    for (const signalId of signalIds) {
      if (seen.has(signalId)) continue;

      const signalKey = `signal:${dateStr}:${signalId}`;
      const signalData = await env.SIGNAL_STORE.get(signalKey);
      if (signalData) {
        signals.push(JSON.parse(signalData) as StoredSignal);
        seen.add(signalId);
      }
    }
  }

  // Sort by value_score descending
  return signals.sort((a, b) => b.value_score - a.value_score);
}

/**
 * Get dates for a given ISO week
 */
function getWeekDates(year: number, weekNum: number): Date[] {
  // Get January 4th (always in week 1)
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Sunday = 7

  // Get Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  // Get Monday of target week
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (weekNum - 1) * 7);

  // Return all 7 days
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(targetMonday);
    d.setUTCDate(targetMonday.getUTCDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Get today's signals
 */
export async function getTodaySignals(env: Env): Promise<StoredSignal[]> {
  const today = formatDate(new Date());
  return getSignalsByDate(today, env);
}

/**
 * Get current week's signals
 */
export async function getCurrentWeekSignals(env: Env): Promise<StoredSignal[]> {
  const week = formatWeek(new Date());
  return getSignalsByWeek(week, env);
}

/**
 * Get signal by ID
 */
export async function getSignalById(
  signalId: string,
  date: string,
  env: Env
): Promise<StoredSignal | null> {
  if (!env.SIGNAL_STORE) {
    return null;
  }

  const signalKey = `signal:${date}:${signalId}`;
  const signalData = await env.SIGNAL_STORE.get(signalKey);

  return signalData ? (JSON.parse(signalData) as StoredSignal) : null;
}

/**
 * Get signal count for a date
 */
export async function getSignalCount(date: string, env: Env): Promise<number> {
  if (!env.SIGNAL_STORE) {
    return 0;
  }

  const indexKey = `index:daily:${date}`;
  const indexData = await env.SIGNAL_STORE.get(indexKey);

  return indexData ? JSON.parse(indexData).length : 0;
}

/**
 * Get signal statistics for a date range
 */
export async function getSignalStats(
  startDate: string,
  endDate: string,
  env: Env
): Promise<{
  totalCount: number;
  avgScore: number;
  topScoreCount: number;
  sourceBreakdown: Record<string, number>;
}> {
  if (!env.SIGNAL_STORE) {
    return {
      totalCount: 0,
      avgScore: 0,
      topScoreCount: 0,
      sourceBreakdown: {},
    };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const allSignals: StoredSignal[] = [];

  // Iterate through dates
  const current = new Date(start);
  while (current <= end) {
    const dateStr = formatDate(current);
    const daySignals = await getSignalsByDate(dateStr, env);
    allSignals.push(...daySignals);
    current.setDate(current.getDate() + 1);
  }

  if (allSignals.length === 0) {
    return {
      totalCount: 0,
      avgScore: 0,
      topScoreCount: 0,
      sourceBreakdown: {},
    };
  }

  const totalScore = allSignals.reduce((sum, s) => sum + s.value_score, 0);
  const topScoreCount = allSignals.filter((s) => s.value_score >= 4).length;

  const sourceBreakdown: Record<string, number> = {};
  for (const signal of allSignals) {
    sourceBreakdown[signal.source] = (sourceBreakdown[signal.source] || 0) + 1;
  }

  return {
    totalCount: allSignals.length,
    avgScore: Math.round((totalScore / allSignals.length) * 10) / 10,
    topScoreCount,
    sourceBreakdown,
  };
}
