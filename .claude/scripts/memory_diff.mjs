#!/usr/bin/env node
/**
 * Memory Brief Diff Script
 * Compares current session's Memory Brief with the previous one
 * Part of Memory as a Product (MaaP) v1.0
 *
 * Output: memory/diff/MEMORY_DIFF_<timestamp>.md
 */

import fs from "fs";
import path from "path";

const MEMORY_BRIEF_PATH = ".claude/.compiled/memory_brief.md";
const MEMORY_BRIEF_HISTORY_DIR = ".claude/.compiled/memory_history";
const DIFF_OUTPUT_DIR = "memory/diff";

/**
 * Parse Memory Brief markdown into structured data
 */
function parseMemoryBrief(content) {
  if (!content) return null;

  const result = {
    timestamp: null,
    domain: null,
    confidence: null,
    reason: null,
    task: null,
    glossary_ref: null,
    terms: [],
  };

  // Extract timestamp
  const tsMatch = content.match(/Generated at:\s*(.+)/);
  if (tsMatch) result.timestamp = tsMatch[1].trim();

  // Extract domain
  const domainMatch = content.match(/\*\*domain\*\*:\s*(.+)/);
  if (domainMatch) result.domain = domainMatch[1].trim();

  // Extract confidence
  const confMatch = content.match(/\*\*confidence\*\*:\s*([\d.]+)/);
  if (confMatch) result.confidence = parseFloat(confMatch[1]);

  // Extract reason
  const reasonMatch = content.match(/\*\*confidence\*\*:\s*[\d.]+\s*\(([^)]+)\)/);
  if (reasonMatch) result.reason = reasonMatch[1].trim();

  // Extract task
  const taskMatch = content.match(/\*\*task\*\*:\s*(.+)/);
  if (taskMatch) result.task = taskMatch[1].trim();

  // Extract glossary ref
  const glossaryMatch = content.match(/\*\*ref\*\*:\s*`([^`]+)`/);
  if (glossaryMatch) result.glossary_ref = glossaryMatch[1].trim();

  // Extract terms from table
  const tableMatch = content.match(/\| Term \| Definition \| Formula \|\n\|[-|]+\|\n([\s\S]*?)(?=\n\n|\n##|$)/);
  if (tableMatch) {
    const rows = tableMatch[1].trim().split("\n");
    for (const row of rows) {
      const cols = row.split("|").map(c => c.trim()).filter(c => c);
      if (cols.length >= 1) {
        const termMatch = cols[0].match(/\*\*([^*]+)\*\*/);
        if (termMatch) {
          result.terms.push({
            term: termMatch[1],
            definition: cols[1] || "",
            formula: cols[2] || "",
          });
        }
      }
    }
  }

  return result;
}

/**
 * Find the most recent previous Memory Brief
 */
function findPreviousBrief() {
  if (!fs.existsSync(MEMORY_BRIEF_HISTORY_DIR)) {
    return null;
  }

  const files = fs.readdirSync(MEMORY_BRIEF_HISTORY_DIR)
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const latestPath = path.join(MEMORY_BRIEF_HISTORY_DIR, files[0]);
  try {
    return fs.readFileSync(latestPath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Save current Memory Brief to history
 */
function saveToHistory(content) {
  if (!content) return;

  fs.mkdirSync(MEMORY_BRIEF_HISTORY_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `memory_brief_${timestamp}.md`;
  const filepath = path.join(MEMORY_BRIEF_HISTORY_DIR, filename);

  fs.writeFileSync(filepath, content, "utf8");

  // Keep only last 50 history files
  const files = fs.readdirSync(MEMORY_BRIEF_HISTORY_DIR)
    .filter(f => f.endsWith(".md"))
    .sort();

  if (files.length > 50) {
    const toDelete = files.slice(0, files.length - 50);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(MEMORY_BRIEF_HISTORY_DIR, f));
    }
  }
}

/**
 * Compare two parsed Memory Briefs
 */
function computeDiff(prev, curr) {
  const diff = {
    has_changes: false,
    domain_change: null,
    confidence_change: null,
    confidence_warning: false,
    terms_added: [],
    terms_removed: [],
    terms_modified: [],
  };

  if (!prev) {
    diff.has_changes = true;
    diff.domain_change = { from: null, to: curr?.domain };
    diff.terms_added = curr?.terms?.map(t => t.term) || [];
    return diff;
  }

  // Domain change
  if (prev.domain !== curr.domain) {
    diff.has_changes = true;
    diff.domain_change = { from: prev.domain, to: curr.domain };
  }

  // Confidence change
  if (prev.confidence !== null && curr.confidence !== null) {
    const delta = Math.abs(curr.confidence - prev.confidence);
    if (delta > 0.01) {
      diff.has_changes = true;
      diff.confidence_change = {
        from: prev.confidence,
        to: curr.confidence,
        delta: curr.confidence - prev.confidence,
      };
      if (delta > 0.2) {
        diff.confidence_warning = true;
      }
    }
  }

  // Term changes
  const prevTerms = new Map(prev.terms.map(t => [t.term, t]));
  const currTerms = new Map(curr.terms.map(t => [t.term, t]));

  for (const [term, data] of currTerms) {
    if (!prevTerms.has(term)) {
      diff.has_changes = true;
      diff.terms_added.push(term);
    } else {
      const prevData = prevTerms.get(term);
      if (prevData.formula !== data.formula || prevData.definition !== data.definition) {
        diff.has_changes = true;
        diff.terms_modified.push({
          term,
          field: prevData.formula !== data.formula ? "formula" : "definition",
          from: prevData.formula !== data.formula ? prevData.formula : prevData.definition,
          to: prevData.formula !== data.formula ? data.formula : data.definition,
        });
      }
    }
  }

  for (const [term] of prevTerms) {
    if (!currTerms.has(term)) {
      diff.has_changes = true;
      diff.terms_removed.push(term);
    }
  }

  return diff;
}

/**
 * Generate diff report markdown
 */
function generateDiffReport(prev, curr, diff) {
  const lines = [];
  const timestamp = new Date().toISOString();

  lines.push(`# Memory Brief Diff Report`);
  lines.push(``);
  lines.push(`> Generated: ${timestamp}`);
  lines.push(`> Previous: ${prev?.timestamp || "N/A (first session)"}`);
  lines.push(`> Current: ${curr?.timestamp || "N/A"}`);
  lines.push(``);

  if (!diff.has_changes) {
    lines.push(`## Status: NO CHANGES`);
    lines.push(``);
    lines.push(`Memory Brief is identical to previous session.`);
    return lines.join("\n");
  }

  lines.push(`## Status: CHANGES DETECTED`);
  lines.push(``);

  // Domain change
  if (diff.domain_change) {
    lines.push(`### Domain Change`);
    lines.push(``);
    lines.push(`| From | To |`);
    lines.push(`|------|-----|`);
    lines.push(`| ${diff.domain_change.from || "(none)"} | ${diff.domain_change.to || "(none)"} |`);
    lines.push(``);
  }

  // Confidence change
  if (diff.confidence_change) {
    const emoji = diff.confidence_warning ? "⚠️ WARNING" : "ℹ️";
    const direction = diff.confidence_change.delta > 0 ? "↑" : "↓";

    lines.push(`### Confidence Change ${emoji}`);
    lines.push(``);
    lines.push(`| From | To | Delta |`);
    lines.push(`|------|-----|-------|`);
    lines.push(`| ${diff.confidence_change.from.toFixed(2)} | ${diff.confidence_change.to.toFixed(2)} | ${direction} ${Math.abs(diff.confidence_change.delta).toFixed(2)} |`);
    lines.push(``);

    if (diff.confidence_warning) {
      lines.push(`> **WARNING**: Confidence changed by more than 0.2. Review domain detection logic.`);
      lines.push(``);
    }
  }

  // Terms added
  if (diff.terms_added.length > 0) {
    lines.push(`### Terms Added (+${diff.terms_added.length})`);
    lines.push(``);
    for (const term of diff.terms_added) {
      lines.push(`- \`${term}\``);
    }
    lines.push(``);
  }

  // Terms removed
  if (diff.terms_removed.length > 0) {
    lines.push(`### Terms Removed (-${diff.terms_removed.length})`);
    lines.push(``);
    for (const term of diff.terms_removed) {
      lines.push(`- \`${term}\``);
    }
    lines.push(``);
  }

  // Terms modified
  if (diff.terms_modified.length > 0) {
    lines.push(`### Terms Modified (~${diff.terms_modified.length})`);
    lines.push(``);
    for (const mod of diff.terms_modified) {
      lines.push(`#### ${mod.term} (${mod.field})`);
      lines.push(`- **From**: ${mod.from}`);
      lines.push(`- **To**: ${mod.to}`);
      lines.push(``);
    }
  }

  // Summary
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Domain Changed | ${diff.domain_change ? "Yes" : "No"} |`);
  lines.push(`| Confidence Warning | ${diff.confidence_warning ? "⚠️ Yes" : "No"} |`);
  lines.push(`| Terms Added | ${diff.terms_added.length} |`);
  lines.push(`| Terms Removed | ${diff.terms_removed.length} |`);
  lines.push(`| Terms Modified | ${diff.terms_modified.length} |`);

  return lines.join("\n");
}

/**
 * Main function
 */
function main() {
  // Read current Memory Brief
  let currentContent = null;
  if (fs.existsSync(MEMORY_BRIEF_PATH)) {
    currentContent = fs.readFileSync(MEMORY_BRIEF_PATH, "utf8");
  }

  if (!currentContent) {
    console.log(JSON.stringify({
      ok: false,
      reason: "current_brief_missing",
      message: "No current Memory Brief found. Run memory_bootstrap first.",
    }));
    process.exit(0); // Non-blocking failure
  }

  // Parse current
  const curr = parseMemoryBrief(currentContent);

  // Find and parse previous
  const prevContent = findPreviousBrief();
  const prev = prevContent ? parseMemoryBrief(prevContent) : null;

  // Compute diff
  const diff = computeDiff(prev, curr);

  // Generate report
  const report = generateDiffReport(prev, curr, diff);

  // Write diff output
  fs.mkdirSync(DIFF_OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const diffPath = path.join(DIFF_OUTPUT_DIR, `MEMORY_DIFF_${timestamp}.md`);
  fs.writeFileSync(diffPath, report, "utf8");

  // Save current to history (after diff, so we compare with actual previous)
  saveToHistory(currentContent);

  // Output result
  const result = {
    ok: true,
    has_changes: diff.has_changes,
    domain_change: diff.domain_change,
    confidence_warning: diff.confidence_warning,
    terms_added: diff.terms_added.length,
    terms_removed: diff.terms_removed.length,
    terms_modified: diff.terms_modified.length,
    diff_path: diffPath,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(result, null, 2));

  // Return warning exit code if confidence warning
  if (diff.confidence_warning) {
    console.error("WARNING: Domain confidence changed by more than 0.2");
  }
}

main();
