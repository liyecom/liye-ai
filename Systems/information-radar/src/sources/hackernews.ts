/**
 * Hacker News Data Source
 * Uses hnrss.org for RSS feed of frontpage
 */

import { XMLParser } from "fast-xml-parser";
import type { RawItem, Env } from "../types";
import { getConfig } from "../config";

interface RSSItem {
  title: string;
  link: string;
  guid: string | { "#text": string; "@_isPermaLink"?: string };
  pubDate: string;
  description?: string;
  "dc:creator"?: string;
}

interface RSSFeed {
  rss: {
    channel: {
      item: RSSItem[];
    };
  };
}

/**
 * Fetch top stories from Hacker News via hnrss.org
 */
export async function fetchHackerNews(env: Env): Promise<RawItem[]> {
  const config = getConfig(env);
  const rssUrl = `${config.hn.rssUrl}?count=${config.hn.maxItems}`;

  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "Information-OS/0.1 (LiYe OS)",
    },
  });

  if (!response.ok) {
    throw new Error(`HN RSS fetch failed: ${response.status}`);
  }

  const xmlText = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const feed = parser.parse(xmlText) as RSSFeed;
  const items = feed.rss?.channel?.item || [];

  return items.map((item) => ({
    id: extractHNId(item.guid || item.link),
    title: item.title,
    link: item.link,
    source: "hacker_news" as const,
    pubDate: item.pubDate,
  }));
}

/**
 * Extract HN item ID from URL or GUID
 * e.g., "https://news.ycombinator.com/item?id=42638877" -> "hn_42638877"
 */
function extractHNId(urlOrGuid: string | { "#text": string } | undefined): string {
  // Handle object format from XML parser (when guid has attributes)
  let value: string;
  if (typeof urlOrGuid === "object" && urlOrGuid !== null && "#text" in urlOrGuid) {
    value = urlOrGuid["#text"];
  } else if (typeof urlOrGuid === "string") {
    value = urlOrGuid;
  } else {
    return `hn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  const match = value.match(/id=(\d+)/);
  if (match) {
    return `hn_${match[1]}`;
  }
  // Fallback: hash the URL
  return `hn_${hashString(value)}`;
}

/**
 * Simple string hash for fallback ID generation
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
