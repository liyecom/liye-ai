import fs from "fs";
import YAML from "yaml";
import { execSync } from "child_process";

function sh(cmd){
  try { return execSync(cmd, { stdio: ["ignore","pipe","ignore"] }).toString("utf8").trim(); }
  catch { return ""; }
}

function loadFromText(txt){ return YAML.parse(txt); }

function readYamlAt(ref, path){
  const out = sh(`git show ${ref}:${path}`);
  if (!out) return null;
  return loadFromText(out);
}

function norm(s){ return String(s ?? "").trim(); }
function lc(s){ return norm(s).toLowerCase(); }

function classifyRisk(k){
  const t = lc(k);
  if (!t) return null;
  if (t.length <= 2) return "high:too-short";
  if (/^\d+$/.test(t)) return "high:numeric";
  if (/^[a-z]$/.test(t)) return "high:single-letter";
  if (["seo","amazon","ads","metric","data","report","policy","governance"].includes(t)) return "med:too-generic";
  if (/^[a-z]{3}$/.test(t)) return "med:abbr-3";
  return null;
}

function domainMap(obj){
  const m = new Map();
  const domains = (obj?.domains || []);
  for (const d of domains) {
    const id = norm(d.id);
    const core = (d.core_keywords || []).map(lc).filter(Boolean);
    const alias = (d.alias_keywords || []).map(lc).filter(Boolean);
    // legacy compat: if still has keywords, treat as core
    const legacy = (d.keywords || []).map(lc).filter(Boolean);
    const coreEff = (core.length || alias.length) ? core : legacy;
    const aliasEff = (core.length || alias.length) ? alias : [];
    m.set(id, { id, core: new Set(coreEff), alias: new Set(aliasEff) });
  }
  return m;
}

function invertAlias(domMap){
  const idx = new Map(); // alias -> Set(domains)
  for (const [id, d] of domMap.entries()) {
    for (const a of d.alias) {
      if (!idx.has(a)) idx.set(a, new Set());
      idx.get(a).add(id);
    }
  }
  return idx;
}

function main(){
  const path = ".claude/config/domain-mapping.yaml";
  const baseRef = process.env.ALIAS_DIFF_BASE || "origin/main";
  const headRef = process.env.ALIAS_DIFF_HEAD || "HEAD";

  // Ensure git available
  const hasGit = sh("git rev-parse --is-inside-work-tree") === "true";
  if (!hasGit) {
    console.log(JSON.stringify({ ok:false, error:"not a git repo" }, null, 2));
    process.exit(0);
  }

  const baseObj = readYamlAt(baseRef, path);
  const headObj = readYamlAt(headRef, path);

  if (!baseObj || !headObj) {
    console.log(JSON.stringify({ ok:false, error:`cannot read ${path} at ${baseRef} or ${headRef}` }, null, 2));
    process.exit(0);
  }

  const base = domainMap(baseObj);
  const head = domainMap(headObj);

  const domains = new Set([...base.keys(), ...head.keys()]);
  const changes = [];

  for (const id of [...domains].sort()) {
    const b = base.get(id) || { core:new Set(), alias:new Set() };
    const h = head.get(id) || { core:new Set(), alias:new Set() };

    const added = [...h.alias].filter(x => !b.alias.has(x)).sort();
    const removed = [...b.alias].filter(x => !h.alias.has(x)).sort();

    if (added.length || removed.length) {
      changes.push({ domain:id, added, removed });
    }
  }

  // Overlap analysis on HEAD
  const aliasIdx = invertAlias(head);
  const overlaps = [];
  for (const [a, ds] of aliasIdx.entries()) {
    if (ds.size > 1) overlaps.push({ alias:a, domains:[...ds].sort() });
  }
  overlaps.sort((a,b)=> b.domains.length - a.domains.length || a.alias.localeCompare(b.alias));

  // Risk flags only for ADDED aliases
  const risks = [];
  for (const c of changes) {
    for (const a of c.added) {
      const r = classifyRisk(a);
      if (r) risks.push({ domain:c.domain, alias:a, risk:r });
    }
  }

  const lines = [];
  lines.push(`# Alias Keywords Diff Report`);
  lines.push(`> Base: ${baseRef}`);
  lines.push(`> Head: ${headRef}`);
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(``);

  lines.push(`## Summary`);
  lines.push(`- Domains with alias changes: **${changes.length}**`);
  lines.push(`- New risk flags (added aliases): **${risks.length}**`);
  lines.push(`- Current alias overlaps on HEAD: **${overlaps.length}**`);
  lines.push(``);

  if (changes.length === 0) {
    lines.push(`✅ No alias_keywords changes.`);
    lines.push(``);
  } else {
    lines.push(`## Changes`);
    for (const c of changes) {
      lines.push(`### ${c.domain}`);
      if (c.added.length) lines.push(`- Added: ${c.added.join(", ")}`);
      if (c.removed.length) lines.push(`- Removed: ${c.removed.join(", ")}`);
      lines.push(``);
    }
  }

  lines.push(`## Risk Flags (added aliases)`);
  if (risks.length === 0) {
    lines.push(`✅ No risky added aliases detected by heuristics.`);
    lines.push(``);
  } else {
    lines.push(`| domain | alias | risk |`);
    lines.push(`|---|---|---|`);
    for (const r of risks) lines.push(`| ${r.domain} | ${r.alias} | ${r.risk} |`);
    lines.push(``);
  }

  lines.push(`## Alias Overlaps on HEAD (informational)`);
  if (overlaps.length === 0) {
    lines.push(`✅ No overlaps.`);
    lines.push(``);
  } else {
    lines.push(`| alias | domains |`);
    lines.push(`|---|---|`);
    for (const o of overlaps.slice(0, 100)) lines.push(`| ${o.alias} | ${o.domains.join(", ")} |`);
    lines.push(``);
  }

  fs.writeFileSync("docs/governance/ALIAS_KEYWORDS_DIFF.md", lines.join("\n"), "utf8");
  console.log(JSON.stringify({ ok:true, base:baseRef, head:headRef, changed_domains:changes.length, out:"docs/governance/ALIAS_KEYWORDS_DIFF.md" }, null, 2));
}

main();
