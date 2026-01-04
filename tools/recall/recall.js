#!/usr/bin/env node
/**
 * LiYe Recall - Unified Knowledge Query
 *
 * Aggregates search results from:
 * 1. Local Track system (tracks/{id}/experience.yaml)
 * 2. claude-mem Memory system (via HTTP API)
 *
 * Usage:
 *   node recall.js <query> [options]
 *
 * Options:
 *   --domain <name>   Filter by domain (e.g., kernel, amazon-growth)
 *   --project <name>  Filter claude-mem by project (default: liye_os)
 *   --limit <n>       Max results per source (default: 5)
 *   --source <name>   Only search: track, memory, or all (default: all)
 *
 * Examples:
 *   node recall.js "i18n"
 *   node recall.js "i18n" --domain kernel
 *   node recall.js "ppc optimization" --project amazon-growth-os
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

// Configuration
const TRACKS_DIR = path.join(__dirname, "../../tracks");

// ============================================================================
// Track Search Module
// ============================================================================

function searchTracks(query, options = {}) {
  const { domain, limit = 5 } = options;
  const results = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/);

  // Get all track directories
  if (!fs.existsSync(TRACKS_DIR)) {
    return results;
  }

  const trackDirs = fs.readdirSync(TRACKS_DIR).filter((name) => {
    const trackPath = path.join(TRACKS_DIR, name);
    return fs.statSync(trackPath).isDirectory();
  });

  for (const trackId of trackDirs) {
    const experiencePath = path.join(TRACKS_DIR, trackId, "experience.yaml");

    if (!fs.existsSync(experiencePath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(experiencePath, "utf8");
      const experience = yaml.load(content);

      // Domain filter
      if (domain && experience.meta?.domain !== domain) {
        continue;
      }

      // Calculate relevance score
      const score = calculateTrackScore(experience, queryTerms, content);

      if (score > 0) {
        results.push({
          source: "track",
          id: trackId,
          score,
          domain: experience.meta?.domain || "unknown",
          verdict: experience.outcome?.verdict || experience.meta?.verdict,
          summary: experience.decision?.summary || "",
          keywords: experience.trigger?.keywords || [],
          approach: experience.decision?.approach || "",
          path: `tracks/${trackId}/experience.yaml`,
        });
      }
    } catch (e) {
      // Skip malformed files
      continue;
    }
  }

  // Sort by score and limit
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

function calculateTrackScore(experience, queryTerms, rawContent) {
  let score = 0;
  const contentLower = rawContent.toLowerCase();

  for (const term of queryTerms) {
    // Keyword match (highest weight)
    if (experience.trigger?.keywords?.some((k) => k.toLowerCase().includes(term))) {
      score += 10;
    }

    // Approach/summary match
    if (experience.decision?.approach?.toLowerCase().includes(term)) {
      score += 5;
    }
    if (experience.decision?.summary?.toLowerCase().includes(term)) {
      score += 5;
    }

    // Condition match
    if (experience.trigger?.conditions?.some((c) => c.toLowerCase().includes(term))) {
      score += 3;
    }

    // Full content match (lowest weight)
    const matches = (contentLower.match(new RegExp(term, "g")) || []).length;
    score += Math.min(matches, 5); // Cap at 5 to avoid spam
  }

  // Bonus for successful tracks
  if (experience.outcome?.verdict === "success" || experience.meta?.verdict === "success") {
    score += 2;
  }

  return score;
}

// ============================================================================
// Claude-Mem Integration Module (Direct SQLite Query)
// ============================================================================

const { execSync } = require("child_process");
const os = require("os");

const CLAUDE_MEM_DB = path.join(os.homedir(), ".claude-mem", "claude-mem.db");

function searchMemory(query, options = {}) {
  const { project = "liye_os", limit = 5 } = options;
  const results = [];

  if (!fs.existsSync(CLAUDE_MEM_DB)) {
    return results;
  }

  try {
    // Search observations using FTS
    const escapedQuery = query.replace(/"/g, '""');
    const sql = `
      SELECT o.id, o.title, o.type, o.created_at, s.project
      FROM observations o
      LEFT JOIN sdk_sessions s ON o.sdk_session_id = s.sdk_session_id
      WHERE o.id IN (
        SELECT rowid FROM observations_fts
        WHERE observations_fts MATCH '"${escapedQuery}"'
      )
      ${project ? `AND (s.project = '${project}' OR s.project IS NULL)` : ""}
      ORDER BY o.created_at_epoch DESC
      LIMIT ${limit};
    `;

    const output = execSync(`sqlite3 "${CLAUDE_MEM_DB}" "${sql}"`, {
      encoding: "utf8",
      timeout: 5000,
    });

    for (const line of output.trim().split("\n")) {
      if (!line) continue;
      const [id, title, type, created_at, proj] = line.split("|");
      if (id) {
        results.push({
          source: "memory",
          id,
          title: title || "(no title)",
          type: type || "obs",
          time: formatTime(created_at),
          project: proj || "unknown",
        });
      }
    }
  } catch (e) {
    // FTS search failed, try simple LIKE search
    try {
      const sql = `
        SELECT o.id, o.title, o.type, o.created_at, s.project
        FROM observations o
        LEFT JOIN sdk_sessions s ON o.sdk_session_id = s.sdk_session_id
        WHERE (o.title LIKE '%${query}%' OR o.narrative LIKE '%${query}%')
        ${project ? `AND (s.project = '${project}' OR s.project IS NULL)` : ""}
        ORDER BY o.created_at_epoch DESC
        LIMIT ${limit};
      `;

      const output = execSync(`sqlite3 "${CLAUDE_MEM_DB}" "${sql}"`, {
        encoding: "utf8",
        timeout: 5000,
      });

      for (const line of output.trim().split("\n")) {
        if (!line) continue;
        const [id, title, type, created_at, proj] = line.split("|");
        if (id) {
          results.push({
            source: "memory",
            id,
            title: title || "(no title)",
            type: type || "obs",
            time: formatTime(created_at),
            project: proj || "unknown",
          });
        }
      }
    } catch (e2) {
      // Silent fail
    }
  }

  return results;
}

function formatTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatResults(trackResults, memoryResults, query) {
  const lines = [];

  lines.push(`\n${"=".repeat(60)}`);
  lines.push(`  LiYe Recall: "${query}"`);
  lines.push(`${"=".repeat(60)}\n`);

  // Track results
  lines.push(`## Track System (${trackResults.length} results)`);
  lines.push("");

  if (trackResults.length === 0) {
    lines.push("  No matching tracks found.\n");
  } else {
    for (const r of trackResults) {
      const verdict = r.verdict === "success" ? "✅" : r.verdict === "failed" ? "❌" : "⚪";
      lines.push(`  ${verdict} ${r.id}`);
      lines.push(`     Domain: ${r.domain} | Score: ${r.score}`);
      if (r.approach) {
        lines.push(`     Approach: ${r.approach}`);
      }
      if (r.summary) {
        lines.push(`     Summary: ${r.summary}`);
      }
      lines.push(`     Path: ${r.path}`);
      lines.push("");
    }
  }

  // Memory results
  lines.push(`## Memory System (${memoryResults.length} results)`);
  lines.push("");

  if (memoryResults.length === 0) {
    lines.push("  No matching memories found.");
    lines.push("  (Is claude-mem worker running? Check: curl http://127.0.0.1:37777/api/health)\n");
  } else {
    for (const r of memoryResults) {
      lines.push(`  ${r.type} #${r.id} [${r.time}]`);
      lines.push(`     ${r.title}`);
      lines.push("");
    }
  }

  lines.push(`${"=".repeat(60)}`);
  lines.push(`  Total: ${trackResults.length} tracks + ${memoryResults.length} memories`);
  lines.push(`${"=".repeat(60)}\n`);

  return lines.join("\n");
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let query = "";
  const options = {
    domain: null,
    project: "liye_os",
    limit: 5,
    source: "all",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--domain" && args[i + 1]) {
      options.domain = args[++i];
    } else if (args[i] === "--project" && args[i + 1]) {
      options.project = args[++i];
    } else if (args[i] === "--limit" && args[i + 1]) {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === "--source" && args[i + 1]) {
      options.source = args[++i];
    } else if (!args[i].startsWith("--")) {
      query = args[i];
    }
  }

  if (!query) {
    console.log(`
Usage: node recall.js <query> [options]

Options:
  --domain <name>   Filter by domain (e.g., kernel, amazon-growth)
  --project <name>  Filter claude-mem by project (default: liye_os)
  --limit <n>       Max results per source (default: 5)
  --source <name>   Only search: track, memory, or all (default: all)

Examples:
  node recall.js "i18n"
  node recall.js "i18n" --domain kernel
  node recall.js "ppc optimization" --project amazon-growth-os
`);
    process.exit(1);
  }

  // Execute searches
  let trackResults = [];
  let memoryResults = [];

  if (options.source === "all" || options.source === "track") {
    trackResults = searchTracks(query, options);
  }

  if (options.source === "all" || options.source === "memory") {
    memoryResults = searchMemory(query, options);
  }

  // Output results
  console.log(formatResults(trackResults, memoryResults, query));
}

main();
