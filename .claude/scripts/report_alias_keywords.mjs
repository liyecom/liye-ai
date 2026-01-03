#!/usr/bin/env node
/**
 * Alias Keywords Governance Report
 * Generates docs/governance/ALIAS_KEYWORDS_REPORT.md
 * Part of MaaP v1.0 asset governance
 */

import fs from "fs";
import YAML from "yaml";

function loadYaml(p) {
  try {
    return YAML.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const cfg = loadYaml(".claude/config/domain-mapping.yaml");
  if (!cfg || !cfg.domains) {
    console.log(JSON.stringify({ ok: false, error: "config_missing" }));
    return;
  }

  const lines = [];
  lines.push(`# Alias Keywords Governance Report`);
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Source: .claude/config/domain-mapping.yaml`);
  lines.push(``);

  // Summary stats
  let totalDomains = 0;
  let domainsWithAlias = 0;
  let totalCoreKw = 0;
  let totalAliasKw = 0;
  let totalLegacyKw = 0;

  const domainDetails = [];

  for (const d of cfg.domains) {
    totalDomains++;
    const core = d.core_keywords || [];
    const alias = d.alias_keywords || [];
    const legacy = d.keywords || [];

    totalCoreKw += core.length;
    totalAliasKw += alias.length;
    totalLegacyKw += legacy.length;

    if (alias.length > 0) domainsWithAlias++;

    domainDetails.push({
      id: d.id,
      priority: d.priority || 0,
      core: core.length,
      alias: alias.length,
      legacy: legacy.length,
      coreList: core,
      aliasList: alias,
      legacyList: legacy,
      hasCoreSplit: core.length > 0 || alias.length > 0
    });
  }

  lines.push(`## Summary`);
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total domains | ${totalDomains} |`);
  lines.push(`| Domains with core/alias split | ${domainsWithAlias} |`);
  lines.push(`| Domains with legacy keywords | ${totalDomains - domainsWithAlias} |`);
  lines.push(`| Total core keywords | ${totalCoreKw} |`);
  lines.push(`| Total alias keywords | ${totalAliasKw} |`);
  lines.push(`| Total legacy keywords | ${totalLegacyKw} |`);
  lines.push(``);

  lines.push(`## Domains Overview`);
  lines.push(`| Domain | Priority | Core | Alias | Legacy | Status |`);
  lines.push(`|--------|----------|------|-------|--------|--------|`);
  for (const d of domainDetails.sort((a, b) => b.priority - a.priority)) {
    const status = d.hasCoreSplit ? "✅ Governed" : "⚠️ Legacy";
    lines.push(`| ${d.id} | ${d.priority} | ${d.core} | ${d.alias} | ${d.legacy} | ${status} |`);
  }
  lines.push(``);

  // Detail for domains with alias keywords
  const aliasDomainsDetail = domainDetails.filter(d => d.alias > 0);
  if (aliasDomainsDetail.length > 0) {
    lines.push(`## Alias Keywords Detail`);
    for (const d of aliasDomainsDetail) {
      lines.push(`### ${d.id}`);
      lines.push(`- **Priority**: ${d.priority}`);
      lines.push(`- **Core keywords** (${d.core}): ${d.coreList.slice(0, 10).join(", ")}${d.core > 10 ? "..." : ""}`);
      lines.push(`- **Alias keywords** (${d.alias}): ${d.aliasList.join(", ")}`);
      lines.push(``);
    }
  }

  // Recommendations
  lines.push(`## Governance Recommendations`);
  const legacyDomains = domainDetails.filter(d => !d.hasCoreSplit);
  if (legacyDomains.length > 0) {
    lines.push(`### Domains to migrate to core/alias split:`);
    for (const d of legacyDomains) {
      lines.push(`- **${d.id}**: ${d.legacy} legacy keywords → split into core + alias`);
    }
    lines.push(``);
  } else {
    lines.push(`✅ All domains have been migrated to core/alias governance.`);
    lines.push(``);
  }

  // Write report
  fs.mkdirSync("docs/governance", { recursive: true });
  fs.writeFileSync("docs/governance/ALIAS_KEYWORDS_REPORT.md", lines.join("\n"), "utf8");

  console.log(JSON.stringify({
    ok: true,
    total_domains: totalDomains,
    domains_with_alias: domainsWithAlias,
    total_core_kw: totalCoreKw,
    total_alias_kw: totalAliasKw,
    total_legacy_kw: totalLegacyKw,
    out: "docs/governance/ALIAS_KEYWORDS_REPORT.md"
  }, null, 2));
}

main();
