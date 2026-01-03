#!/usr/bin/env node
/**
 * ADR Validation Script
 * Validates Architecture Decision Records for MaaP compliance
 *
 * Checks:
 * - decision_id format (ADR-XXXX)
 * - decision_id uniqueness across all ADRs
 * - Required fields: decision_id, domain, status, tags
 * - domain field matches path domain
 *
 * Part of Memory as a Product (MaaP) v1.0
 */

import fs from "fs";
import fg from "fast-glob";

function fail(msg) {
  console.error("[ADR VALIDATION FAIL]", msg);
  process.exit(1);
}

function read(p) {
  return fs.readFileSync(p, "utf8");
}

/**
 * Parse ADR metadata from markdown front matter
 * Supports format:
 * - decision_id: ADR-0001
 * - domain: general
 * - status: accepted
 * - tags: [a, b, c]
 */
function parseMeta(md) {
  const meta = {};
  const lines = md.split("\n").slice(0, 60);
  for (const line of lines) {
    const m = line.match(/^\-\s*(decision_id|domain|status|tags)\s*:\s*(.+)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].trim();
    if (k === "tags") {
      // Light parse for [a, b, c]
      v = v.replace(/^\[|\]$/g, "").split(",").map(x => x.trim()).filter(Boolean);
    }
    meta[k] = v;
  }
  return meta;
}

function titleOf(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

async function main() {
  const files = await fg(["docs/adr/**/*.md"], { dot: true });

  if (!files.length) {
    console.log(JSON.stringify({ ok: true, files: 0, message: "No ADR files found" }, null, 2));
    return;
  }

  const ids = new Map();
  const results = [];

  for (const f of files) {
    const md = read(f);
    const meta = parseMeta(md);
    const title = titleOf(md) || f;

    // Required field: decision_id
    if (!meta.decision_id) {
      fail(`${f}: missing decision_id`);
    }

    // Format check: ADR-XXXX
    if (!/^ADR-\d{4}$/.test(String(meta.decision_id))) {
      fail(`${f}: invalid decision_id format: ${meta.decision_id} (expected ADR-XXXX)`);
    }

    // Required field: domain
    if (!meta.domain) {
      fail(`${f}: missing domain`);
    }

    // Required field: status
    if (!meta.status) {
      fail(`${f}: missing status`);
    }

    // Required field: tags
    if (!Array.isArray(meta.tags)) {
      fail(`${f}: missing tags (expected [tag1, tag2, ...])`);
    }

    // Path consistency: docs/adr/<domain>/...
    const pathParts = f.split("/");
    const domainFromPath = pathParts[2]; // docs/adr/<domain>/...
    if (domainFromPath && String(meta.domain).trim() !== domainFromPath) {
      fail(`${f}: meta.domain (${meta.domain}) != path domain (${domainFromPath})`);
    }

    // Uniqueness check
    if (ids.has(meta.decision_id)) {
      fail(`decision_id duplicate: ${meta.decision_id} in ${f} and ${ids.get(meta.decision_id)}`);
    }
    ids.set(meta.decision_id, f);

    results.push({
      file: f,
      title,
      decision_id: meta.decision_id,
      domain: meta.domain,
      status: meta.status,
      tags: meta.tags
    });
  }

  console.log(JSON.stringify({
    ok: true,
    files: results.length,
    unique_decision_ids: ids.size,
    sample: results.slice(0, 5)
  }, null, 2));
}

main().catch(e => fail(e.stack || String(e)));
