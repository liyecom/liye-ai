#!/usr/bin/env node
/**
 * Env Hygiene Gate — Sprint 2 Wave 2.2.
 *
 * Blocks NEW additions of direct environment variable reads inside the
 * gated scope (src/, builders/, systems/). Existing reads are reported
 * by .security/env-audit.md but not blocked here.
 *
 * Scope rules (frozen by Sprint 2):
 *   GATED      src/** , builders/** , systems/**
 *     → new process.env.X / process.env[...] / os.getenv(...) /
 *       os.environ[...] / os.environ.get(...) additions = BLOCK
 *   WHITELIST  src/runtime/credential/**
 *     → allowed (broker bootstrap; ADR-Credential-Mediation M7)
 *   EXEMPT     .claude/scripts/** , scripts/** , examples/** ,
 *              tools/notion-sync/**
 *     → no enforcement (local tooling / one-shot scripts)
 *   OTHER      everything else
 *     → no enforcement (not a migration target)
 *
 * Invocation:
 *   node .claude/scripts/env_hygiene_gate.mjs            # staged-diff mode (pre-commit)
 *   node .claude/scripts/env_hygiene_gate.mjs --all      # full-repo audit
 *   node .claude/scripts/env_hygiene_gate.mjs --report   # machine output (JSON)
 *
 * Exit codes:
 *   0 — pass (no new additions found)
 *   1 — blocked (new additions in gated scope)
 *   2 — usage error
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ENV_PATTERNS = [
  /\bprocess\.env\.[A-Z_][A-Z0-9_]*/,            // process.env.FOO
  /\bprocess\.env\[/,                              // process.env[...]
  /\bos\.getenv\(/,                                // Python os.getenv(
  /\bos\.environ\[/,                               // Python os.environ[...]
  /\bos\.environ\.get\(/,                          // Python os.environ.get(
];

function isEnvLine(line) {
  return ENV_PATTERNS.some((re) => re.test(line));
}

/** Strip the `+` prefix plus the optional hunk-context space. */
function stripAddMarker(line) {
  return line.startsWith('+') ? line.slice(1) : line;
}

/** Classify a file path against the scope rules. */
function classify(p) {
  // normalize: no leading slash, posix separators
  const norm = p.replace(/\\/g, '/');
  if (/^(node_modules|vendor)\//.test(norm) || /\/(node_modules|vendor)\//.test(norm)) return 'exempt-deps';
  if (norm.startsWith('src/runtime/credential/')) return 'whitelist';
  if (
    norm.startsWith('.claude/scripts/')
    || norm.startsWith('scripts/')
    || norm.startsWith('examples/')
    || norm.startsWith('tools/notion-sync/')
  ) return 'exempt';
  if (
    norm.startsWith('src/')
    || norm.startsWith('builders/')
    || norm.startsWith('systems/')
  ) return 'gated';
  return 'other';
}

/** Parse unified diff output into per-file added lines with their line numbers. */
function parseDiff(diffText) {
  const files = [];
  let current = null;
  let newLineNo = 0;

  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      if (current) files.push(current);
      current = { path: null, hunks: [] };
      continue;
    }
    if (raw.startsWith('+++ ')) {
      const m = raw.match(/^\+\+\+ b\/(.+)$/);
      if (m && current) current.path = m[1];
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) newLineNo = parseInt(m[1], 10);
      continue;
    }
    if (!current || !current.path) continue;

    if (raw.startsWith('+') && !raw.startsWith('+++')) {
      const content = stripAddMarker(raw);
      current.hunks.push({ line_no: newLineNo, content });
      newLineNo += 1;
    } else if (raw.startsWith('-') && !raw.startsWith('---')) {
      // removal — new-line counter does not advance
    } else if (raw.startsWith(' ')) {
      // context
      newLineNo += 1;
    } else {
      // meta line; ignore
    }
  }
  if (current) files.push(current);
  return files.filter((f) => f.path);
}

/** --all mode: walk the gated trees and report every env-read line. */
function scanFull() {
  const roots = ['src', 'builders', 'systems', '.claude/scripts', 'scripts', 'examples', 'tools'];
  const hits = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    walk(root, (filepath) => {
      const cls = classify(filepath);
      if (cls === 'exempt-deps') return;
      const content = fs.readFileSync(filepath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (isEnvLine(line)) {
          hits.push({ path: filepath, line_no: idx + 1, content: line.trim(), classification: cls });
        }
      });
    });
  }
  return hits;
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, visit);
    } else if (/\.(ts|js|mjs|cjs|tsx|jsx|py)$/.test(entry.name)) {
      visit(full);
    }
  }
}

function mainStaged() {
  let diff;
  try {
    diff = execSync('git diff --cached --unified=0 --diff-filter=AM', { encoding: 'utf8' });
  } catch (err) {
    console.error('env_hygiene_gate: git diff failed:', err.message);
    process.exit(2);
  }

  const files = parseDiff(diff);
  const violations = [];

  for (const f of files) {
    const cls = classify(f.path);
    if (cls !== 'gated') continue;
    for (const h of f.hunks) {
      if (isEnvLine(h.content)) {
        violations.push({ path: f.path, line_no: h.line_no, content: h.content.trim() });
      }
    }
  }

  if (violations.length === 0) {
    return 0;
  }

  console.error('');
  console.error('❌ Env hygiene gate blocked the commit.');
  console.error('');
  console.error('New direct environment reads detected in gated scope');
  console.error('(src/**, builders/**, systems/**). These must go through');
  console.error('CredentialBroker (src/runtime/credential/) per ADR-Credential-');
  console.error('Mediation; env reads only survive on the whitelist');
  console.error('(src/runtime/credential/**) or on exempt tooling paths');
  console.error('(.claude/scripts/**, scripts/**, examples/**, tools/notion-sync/**).');
  console.error('');
  for (const v of violations) {
    console.error(`  ${v.path}:${v.line_no}  ${v.content}`);
  }
  console.error('');
  console.error('To fix: construct a CredentialBroker and replace the env read');
  console.error('with broker.resolve(cred://<owner>/<name>, ctx). See the');
  console.error('EnvCredentialBroker reference impl for the minimum plumbing.');
  console.error('');
  return 1;
}

function mainReport() {
  const hits = scanFull();
  const grouped = { gated: [], whitelist: [], exempt: [], other: [] };
  for (const h of hits) grouped[h.classification]?.push(h);
  process.stdout.write(JSON.stringify(
    {
      total_hits: hits.length,
      counts: {
        gated: grouped.gated.length,
        whitelist: grouped.whitelist.length,
        exempt: grouped.exempt.length,
        other: grouped.other.length,
      },
      hits: grouped,
    },
    null,
    2,
  ) + '\n');
  return 0;
}

function mainAllText() {
  const hits = scanFull();
  const grouped = { gated: [], whitelist: [], exempt: [], other: [] };
  for (const h of hits) grouped[h.classification]?.push(h);
  console.log(`Env reads across scanned trees: ${hits.length}`);
  console.log(`  gated (migration target): ${grouped.gated.length}`);
  console.log(`  whitelist (broker bootstrap): ${grouped.whitelist.length}`);
  console.log(`  exempt (tooling): ${grouped.exempt.length}`);
  console.log(`  other: ${grouped.other.length}`);
  return 0;
}

const args = process.argv.slice(2);
if (args.includes('--report')) process.exit(mainReport());
if (args.includes('--all')) process.exit(mainAllText());
process.exit(mainStaged());
