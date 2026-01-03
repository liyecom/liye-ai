import fs from "fs";
import YAML from "yaml";
import { execSync } from "child_process";

function loadYaml(p){ return YAML.parse(fs.readFileSync(p,"utf8")); }

function sh(cmd){
  try {
    return execSync(cmd, { stdio: ["ignore","pipe","ignore"] }).toString("utf8").trim();
  } catch {
    return "";
  }
}

function main(){
  const redirectsPath = "state/memory/id_redirects.yaml";
  if (!fs.existsSync(redirectsPath)) {
    console.log(JSON.stringify({ ok:true, note:"no redirects file found" }, null, 2));
    return;
  }

  const obj = loadYaml(redirectsPath);
  const redirects = obj.redirects || {};
  const legacyIds = Object.keys(redirects);

  const lines = [];
  lines.push(`# Redirect Usage Audit`);
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Source: ${redirectsPath}`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(`- Redirect entries: **${legacyIds.length}**`);
  lines.push(`- Purpose: detect remaining legacy concept_id references in repo`);
  lines.push(``);

  // Audit strategy v2:
  // (A) SSOT-field hits: concept_id/id-style references in YAML/MD
  // (B) token hits: any occurrence (informational; may include variables/keywords)
  const ssotHits = [];
  const tokenHits = [];

  const SSOT_GLOBS = [
    "knowledge/glossary/**/*.yaml",
    "docs/**/*.md",
    ".claude/**/*.md",
    "playbooks/**/*.md"
  ];

  const EXCLUDES = [
    "-g'!**/.git/**'",
    "-g'!**/node_modules/**'",
    "-g'!**/.claude/.compiled/**'",
    "-g'!**/dist/**'",
    "-g'!**/build/**'",
    "-g'!state/memory/id_redirects.yaml'",
    "-g'!.claude/config/domain-mapping.yaml'",
    "-g'!knowledge/glossary/geo-seo.yaml'"
  ].join(" ");

  function rg(pattern, globs){
    const gl = globs.map(g => `-g'${g}'`).join(" ");
    return sh(`rg -n --hidden --no-ignore-vcs -S "${pattern}" . ${gl} ${EXCLUDES}`);
  }

  for (const legacy of legacyIds) {
    // A) SSOT-field patterns (high-signal)
    const ssotPattern = [
      `concept_id:\\s*${legacy}\\b`,
      `\\bid\\s*=\\s*${legacy}\\b`,
      `\\bconcept_id\\s*=\\s*${legacy}\\b`
    ].join("|");
    const ssotOut = rg(ssotPattern, SSOT_GLOBS);
    const ssotLines = ssotOut ? ssotOut.split("\n").filter(Boolean) : [];
    ssotHits.push({ legacy, mapped_to: redirects[legacy], count: ssotLines.length, samples: ssotLines.slice(0, 20) });

    // B) token occurrences inside SSOT docs only (lower-signal; still useful)
    const tokenPattern = `(^|[^A-Za-z0-9_])${legacy}([^A-Za-z0-9_]|$)`;
    const tokOut = rg(tokenPattern, SSOT_GLOBS);
    const tokLines = tokOut ? tokOut.split("\n").filter(Boolean) : [];
    tokenHits.push({ legacy, mapped_to: redirects[legacy], count: tokLines.length, samples: tokLines.slice(0, 10) });
  }

  const remainingSSOT = ssotHits.filter(h => h.count > 0);

  lines.push(`## SSOT-Field Legacy References (high-signal)`);
  lines.push(`- Remaining IDs with SSOT-field hits: **${remainingSSOT.length}** / ${legacyIds.length}`);
  lines.push(``);

  if (remainingSSOT.length === 0) {
    lines.push(`✅ No SSOT-field legacy concept_id references found.`);
    lines.push(``);
  } else {
    lines.push(`| legacy_id | mapped_to | hit_count |`);
    lines.push(`|---|---:|---:|`);
    for (const h of remainingSSOT.sort((a,b)=>b.count-a.count)) {
      lines.push(`| ${h.legacy} | ${h.mapped_to} | ${h.count} |`);
    }
    lines.push(``);
    for (const h of remainingSSOT.sort((a,b)=>b.count-a.count)) {
      lines.push(`### ${h.legacy} → ${h.mapped_to} (hits=${h.count})`);
      lines.push(`Samples (top 20):`);
      lines.push("");
      for (const s of h.samples) lines.push(`- ${s}`);
      lines.push("");
    }
  }

  lines.push(`## Token Occurrences in SSOT Docs (low-signal)`);
  lines.push(`These may include variable names, prose, or routing keywords. They do NOT imply concept_id misuse.`);
  lines.push(``);
  lines.push(`| legacy_id | mapped_to | token_hits |`);
  lines.push(`|---|---:|---:|`);
  for (const h of tokenHits.sort((a,b)=>b.count-a.count)) {
    lines.push(`| ${h.legacy} | ${h.mapped_to} | ${h.count} |`);
  }
  lines.push(``);

  // Also write machine-readable JSON for automation if needed later
  fs.writeFileSync("docs/governance/REDIRECT_AUDIT.md", lines.join("\n"), "utf8");
  fs.writeFileSync("docs/governance/REDIRECT_AUDIT.json", JSON.stringify({ ok:true, redirectsPath, ssotHits, tokenHits }, null, 2), "utf8");

  console.log(JSON.stringify({
    ok: true,
    redirects: legacyIds.length,
    remaining_ssot: remainingSSOT.length,
    out_md: "docs/governance/REDIRECT_AUDIT.md",
    out_json: "docs/governance/REDIRECT_AUDIT.json"
  }, null, 2));
}

main();
