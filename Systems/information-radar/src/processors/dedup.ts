/**
 * Deduplication Processor
 * Uses Cloudflare KV to track seen items
 */

import type { RawItem, Env } from "../types";
import { getConfig } from "../config";

/**
 * Filter out items that have already been seen
 * Returns only new items
 */
export async function filterNewItems(
  items: RawItem[],
  env: Env
): Promise<RawItem[]> {
  const newItems: RawItem[] = [];

  for (const item of items) {
    const seen = await env.SEEN_ITEMS.get(item.id);
    if (!seen) {
      newItems.push(item);
    }
  }

  return newItems;
}

/**
 * Mark items as seen in KV store
 */
export async function markAsSeen(items: RawItem[], env: Env): Promise<void> {
  const config = getConfig(env);

  const promises = items.map((item) =>
    env.SEEN_ITEMS.put(item.id, JSON.stringify({ seenAt: Date.now() }), {
      expirationTtl: config.seenItemTTL,
    })
  );

  await Promise.all(promises);
}

/**
 * Check if a specific item has been seen
 */
export async function isSeen(itemId: string, env: Env): Promise<boolean> {
  const seen = await env.SEEN_ITEMS.get(itemId);
  return seen !== null;
}
