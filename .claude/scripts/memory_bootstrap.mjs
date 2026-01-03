#!/usr/bin/env node
/**
 * Memory Bootstrap Script
 * Generates session memory brief with domain detection and glossary loading
 * Part of Memory as a Product (MaaP) v1.0
 */

import fs from "fs";
import path from "path";
import YAML from "yaml";
import { execSync } from "child_process";

function loadYaml(p) {
  try {
    return YAML.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function loadRedirects() {
  const p = "state/memory/id_redirects.yaml";
  try {
    if (!fs.existsSync(p)) return {};
    const obj = loadYaml(p);
    return obj.redirects || {};
  } catch {
    return {};
  }
}

function scoreDomain(task, cwd, d) {
  const text = `${task}\n${cwd}`.toLowerCase();

  // Support both legacy keywords and new core/alias split
  const kws = d.keywords || [];
  const core = d.core_keywords || [];
  const alias = d.alias_keywords || [];
  const all = kws.length ? kws : [...core, ...alias];

  // Count hits
  let hits = 0;
  let coreHits = 0;
  let aliasHits = 0;

  for (const kw of all) {
    if (kw && text.includes(String(kw).toLowerCase())) {
      hits += 1;
    }
  }

  if (core.length) {
    for (const kw of core) {
      if (kw && text.includes(String(kw).toLowerCase())) {
        coreHits += 1;
      }
    }
  }

  if (alias.length) {
    for (const kw of alias) {
      if (kw && text.includes(String(kw).toLowerCase())) {
        aliasHits += 1;
      }
    }
  }

  // Count negative keyword hits (disqualifies domain if present)
  const negKws = d.negative_keywords || [];
  let negHits = 0;
  for (const nk of negKws) {
    if (nk && text.includes(String(nk).toLowerCase())) {
      negHits += 1;
    }
  }

  // If negative keywords found, reduce score significantly
  const effectiveHits = negHits > 0 ? 0 : hits;

  // Weighted scoring: core=1.0, alias=alias_weight (default 0.6)
  const aw = Number(d.alias_weight ?? 0.6);
  const weightedHits = coreHits + aliasHits * aw;
  const effectiveWeighted = negHits > 0 ? 0 : weightedHits;

  // Weighted hit count is primary (×100), priority is tiebreaker
  return { hits, coreHits, aliasHits, negHits, effectiveHits, weightedHits, effectiveWeighted, aliasWeight: aw, score: effectiveWeighted * 100 + (d.priority || 0), hasCoreSplit: core.length > 0 };
}

function detectDomain(task) {
  const cfg = loadYaml(".claude/config/domain-mapping.yaml");
  if (!cfg || !cfg.domains) {
    return { domain: "general", def: null, confidence: 0.1, reason: "config_missing" };
  }

  const cwd = process.cwd();
  const scored = cfg.domains
    .map(d => {
      const result = scoreDomain(task, cwd, d);
      return {
        id: d.id,
        hits: result.hits,
        coreHits: result.coreHits,
        aliasHits: result.aliasHits,
        negHits: result.negHits,
        effectiveHits: result.effectiveHits,
        weightedHits: result.weightedHits,
        effectiveWeighted: result.effectiveWeighted,
        aliasWeight: result.aliasWeight,
        score: result.score,
        hasCoreSplit: result.hasCoreSplit,
        d
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.effectiveWeighted === 0) {
    const g = cfg.domains.find(x => x.id === "general");
    return { domain: "general", def: g, confidence: 0.2, reason: "no_keyword_match" };
  }

  // Confidence scaling based on effective hits:
  // 1-2 hits → 0.70
  // 3 hits → 0.75
  // 4-5 hits → 0.85
  // ≥6 hits → 0.95
  let confidence;
  const h = best.effectiveHits;
  if (h <= 2) {
    confidence = 0.70;
  } else if (h === 3) {
    confidence = 0.75;
  } else if (h <= 5) {
    confidence = 0.85;
  } else {
    confidence = 0.95;
  }

  // Build reason string with core/alias breakdown if available
  let reason;
  if (best.hasCoreSplit) {
    const negInfo = best.negHits > 0 ? `, neg=${best.negHits}` : "";
    reason = `keyword_score(weighted=${best.weightedHits.toFixed(2)}, core=${best.coreHits}, alias=${best.aliasHits}, aw=${best.aliasWeight}${negInfo})`;
  } else {
    const negInfo = best.negHits > 0 ? `, neg_hits=${best.negHits}` : "";
    reason = `keyword_score(${best.hits}_hits${negInfo})`;
  }

  return { domain: best.id, def: best.d, confidence, reason };
}

function safeRead(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

/**
 * Load active track from memory_state.json (Track Integration)
 * Returns null if no active track or file doesn't exist
 */
function loadActiveTrack() {
  const statePath = ".claude/.compiled/memory_state.json";
  try {
    if (!fs.existsSync(statePath)) return null;
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (!state.active_track) return null;

    // Load track's state.yaml
    const trackPath = `tracks/${state.active_track}/state.yaml`;
    if (!fs.existsSync(trackPath)) return null;

    const trackState = loadYaml(trackPath);
    if (!trackState || !trackState.domain) return null;

    return {
      track_id: state.active_track,
      domain: trackState.domain,
      glossary_version: trackState.glossary_version || "v1.0",
      glossary_path: trackState.glossary_path || null
    };
  } catch {
    return null;
  }
}

function escapeRg(s) {
  return String(s).replace(/"/g, '\\"');
}

function grepTop(globPattern, query, topN) {
  try {
    // Convert multi-word query to OR pattern for ripgrep
    const words = query.split(/\s+/).filter(w => w.length > 2);
    const pattern = words.join("|");
    // Extract base path and glob from pattern like "docs/adr/general/**/*.md"
    const parts = globPattern.split("**/");
    const basePath = parts[0] || ".";
    const fileGlob = parts[1] || "*.md";
    const cmd = `rg -n --no-heading --smart-case --glob "${fileGlob}" "${escapeRg(pattern)}" ${basePath} 2>/dev/null | head -n ${topN}`;
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString("utf8").trim();
    if (!out) return [];
    return out.split("\n").slice(0, topN);
  } catch {
    return [];
  }
}

function uniq(arr) {
  return [...new Set(arr)];
}

function extractFilePathsFromRg(lines) {
  // Format: path:line:content
  const files = [];
  for (const l of lines) {
    const p = String(l).split(":")[0];
    if (p && p.endsWith(".md")) files.push(p);
  }
  return uniq(files);
}

function adrMeta(md) {
  const meta = {};
  const head = md.split("\n").slice(0, 60);
  for (const line of head) {
    const m = line.match(/^\-\s*(decision_id|domain|status|tags)\s*:\s*(.+)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if (k === "tags") {
      v = v.replace(/^\[|\]$/g, "").split(",").map(x => x.trim()).filter(Boolean);
    }
    meta[k] = v;
  }
  return meta;
}

function extractDecisionBullets(md, max = 3) {
  const lines = md.split("\n");
  const start = lines.findIndex(l => l.trim() === "## Decision");
  if (start < 0) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("## ")) break;
    const m = l.match(/^\s*\d+\)\s+(.+)\s*$/);
    if (m) out.push(m[1].trim());
    if (out.length >= max) break;
  }
  return out;
}

function titleOf(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function main() {
  const task = process.argv.slice(2).join(" ").trim() || "session";

  // Track Integration: Check for active track first
  const activeTrack = loadActiveTrack();
  let domain, def, confidence, reason, trackInfo;

  if (activeTrack) {
    // Force load domain from active track (Track → Domain binding)
    const cfg = loadYaml(".claude/config/domain-mapping.yaml");
    def = cfg?.domains?.find(d => d.id === activeTrack.domain) || null;
    domain = activeTrack.domain;
    confidence = 1.0; // Track binding is authoritative
    reason = `track_bound(${activeTrack.track_id})`;
    trackInfo = activeTrack;
  } else {
    // Normal domain detection (no active track)
    const detected = detectDomain(task);
    domain = detected.domain;
    def = detected.def;
    confidence = detected.confidence;
    reason = detected.reason;
    trackInfo = null;
  }

  // Load redirects and build reverse map (canonical -> [legacy ids])
  const redirects = loadRedirects();
  const reverse = {};
  for (const [oldId, newId] of Object.entries(redirects)) {
    reverse[newId] ||= [];
    reverse[newId].push(oldId);
  }

  const lines = [];
  lines.push(`# Session Memory Brief`);
  lines.push(`> Generated at: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`## Domain Detection`);
  lines.push(`- **domain**: ${domain}`);
  lines.push(`- **confidence**: ${confidence.toFixed(2)} (${reason})`);
  lines.push(`- **task**: ${task}`);

  // Track Integration: Show active track if bound
  if (trackInfo) {
    lines.push(``);
    lines.push(`## Active Track`);
    lines.push(`- **track_id**: ${trackInfo.track_id}`);
    lines.push(`- **glossary_version**: ${trackInfo.glossary_version}`);
    lines.push(`- **binding**: Domain forced by Track (confidence=1.0)`);
  }
  lines.push(``);

  // Glossary section (i18n SSOT: English definition is authoritative)
  if (def && def.glossary) {
    const gPath = def.glossary;
    const gRaw = safeRead(gPath);

    if (gRaw) {
      lines.push(`## Canonical Glossary`);
      lines.push(`- **ref**: \`${gPath}\``);
      lines.push(`- **i18n**: English SSOT (authoritative for reasoning)`);
      lines.push(``);

      try {
        const obj = YAML.parse(gRaw);
        const concepts = obj.concepts || obj.glossary || [];
        const top = concepts.slice(0, 30);

        if (top.length > 0) {
          lines.push(`| Term | Definition (EN SSOT) | Formula | Version |`);
          lines.push(`|------|---------------------|---------|---------|`);

          for (const c of top) {
            const term = c.name || c.term || c.concept_id || "?";
            // Use English definition (SSOT) - this is authoritative for reasoning
            const defText = (c.definition || "").substring(0, 50);
            const formula = c.formula || "-";
            const version = c.version || "-";

            // Collect all aliases (both en-US and zh-CN for matching)
            const allAliases = [];

            // Legacy aliases (flat array)
            if (Array.isArray(c.aliases)) {
              allAliases.push(...c.aliases);
            }
            // New i18n aliases (locale-keyed object)
            else if (c.aliases && typeof c.aliases === "object") {
              const enAliases = c.aliases["en-US"] || [];
              const zhAliases = c.aliases["zh-CN"] || [];
              allAliases.push(...enAliases, ...zhAliases);
            }

            // Add legacy redirect aliases
            if (reverse[c.concept_id]?.length) {
              allAliases.push(...reverse[c.concept_id]);
            }

            const aliasStr = allAliases.length > 0
              ? ` (aliases: ${allAliases.slice(0, 3).join(", ")}${allAliases.length > 3 ? "..." : ""})`
              : "";

            lines.push(`| **${term}**${aliasStr} | ${defText}... | ${formula} | ${version} |`);
          }
        }
      } catch {
        lines.push(`- (parse failed)`);
      }
      lines.push(``);
    } else {
      lines.push(`## Canonical Glossary`);
      lines.push(`- **ref missing**: \`${gPath}\``);
      lines.push(`- **action**: create the glossary file or update domain-mapping.yaml`);
      lines.push(``);
    }
  }

  // ADR / Playbooks section (grouped summaries)
  lines.push(`## Related Decisions / Playbooks`);

  if (def) {
    const q = task; // use full task for higher recall
    const adrRaw = def.adrs_glob ? grepTop(def.adrs_glob, q, 20) : [];
    const pbHits = def.playbooks_glob ? grepTop(def.playbooks_glob, q, 6) : [];
    const adrFiles = extractFilePathsFromRg(adrRaw);

    if (!adrFiles.length && !pbHits.length) {
      lines.push(`- (no hits for query: "${q}")`);
    } else {
      if (adrFiles.length) {
        lines.push(`### ADR Hits (grouped)`);
        for (const f of adrFiles.slice(0, 5)) {
          try {
            const md = fs.readFileSync(f, "utf8");
            const meta = adrMeta(md);
            const title = titleOf(md) || f;
            const did = meta.decision_id ? String(meta.decision_id) : "ADR-UNKNOWN";
            const status = meta.status ? String(meta.status) : "unknown";
            const tags = Array.isArray(meta.tags) ? meta.tags.join(", ") : "";
            lines.push(`- **${did}** ${title} (status=${status}${tags ? ` | tags=${tags}` : ""})`);
            lines.push(`  - ref: ${f}`);
            const bullets = extractDecisionBullets(md, 3);
            if (bullets.length) {
              lines.push(`  - decision:`);
              bullets.forEach(b => lines.push(`    - ${b}`));
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
      if (pbHits.length) {
        lines.push(`### Playbook Hits`);
        pbHits.forEach(h => lines.push(`- ${h}`));
      }
    }
  } else {
    lines.push(`- (no domain definition found)`);
  }
  lines.push(``);

  // Output Contract
  lines.push(`## Output Contract (MUST FOLLOW)`);
  lines.push(`1. Any **definition/metric/decision** output MUST cite:`);
  lines.push(`   - glossary: \`path + concept_id + version\``);
  lines.push(`   - ADR/playbook: \`file path + section\``);
  lines.push(`2. Do NOT use legacy concept_id if a redirect exists; use canonical id (e.g., AMZ_ACOS not acos).`);
  lines.push(`3. If **SSOT missing**, propose a patch (glossary/ADR) instead of guessing.`);
  lines.push(`4. Use **Pre-Action Memory Check** before making decisions.`);
  lines.push(``);

  // Write output
  fs.mkdirSync(".claude/.compiled", { recursive: true });
  const outPath = ".claude/.compiled/memory_brief.md";
  fs.writeFileSync(outPath, lines.join("\n"), "utf8");

  // Run Memory Diff (best-effort, non-blocking)
  let diffResult = null;
  try {
    const diffOutput = execSync("node .claude/scripts/memory_diff.mjs", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    });
    diffResult = JSON.parse(diffOutput);
  } catch (e) {
    // Diff failure is non-blocking
    diffResult = { ok: false, reason: "diff_failed", error: e.message };
  }

  console.log(JSON.stringify({
    ok: true,
    domain,
    confidence,
    reason,
    out: outPath,
    diff: diffResult,
    track: trackInfo,  // Track Integration: Include track info in output
    timestamp: new Date().toISOString()
  }, null, 2));
}


main();
