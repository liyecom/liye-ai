import { execSync } from "child_process";
const task = "local pack gbp nap reviews citations";
const out = execSync(`node .claude/scripts/memory_bootstrap.mjs "${task}"`).toString("utf8");
console.log(out);
if (!out.includes('"domain": "geo-os"')) process.exit(1);
