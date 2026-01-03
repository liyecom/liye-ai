import fs from "fs";
import YAML from "yaml";

function fail(msg){
  console.error("[LEGACY KEYWORDS GUARD FAIL]", msg);
  process.exit(1);
}

function main(){
  const p = ".claude/config/domain-mapping.yaml";
  if (!fs.existsSync(p)) fail(`missing ${p}`);

  const cfg = YAML.parse(fs.readFileSync(p, "utf8"));
  const domains = cfg.domains || [];
  const offenders = [];

  for (const d of domains) {
    if (Array.isArray(d.keywords) && d.keywords.length > 0) {
      offenders.push({ id: d.id, count: d.keywords.length });
    }
  }

  if (offenders.length) {
    const lines = offenders.map(o => `- ${o.id}: keywords=${o.count} (must migrate to core_keywords/alias_keywords)`).join("\n");
    fail(`legacy 'keywords' blocks detected\n${lines}`);
  }

  console.log(JSON.stringify({ ok: true, domains: domains.length, legacy_keywords_blocks: 0 }, null, 2));
}

main();
