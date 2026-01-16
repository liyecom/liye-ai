#!/usr/bin/env node
/**
 * SFC CI Gate
 * - scans all SKILL.md under repo
 * - checks required SFC v0.1 frontmatter keys
 * - mode=warn (default): never fails, prints warnings
 * - mode=strict: fails if any debt exists
 *
 * Usage:
 *   node .claude/scripts/sfc_ci_gate.mjs --root . --mode warn
 *   node .claude/scripts/sfc_ci_gate.mjs --root . --mode strict
 */

import fs from "fs";
import path from "path";

const REQUIRED = ["name","description","skeleton","triggers","inputs","outputs","failure_modes","verification"];

function read(p){ try{return fs.readFileSync(p,"utf8")}catch{return null} }

function extractFrontmatter(md){
  const t = md.trimStart();
  if(!t.startsWith("---")) return null;
  const lines = t.split("\n");
  let end = -1;
  for(let i=1;i<Math.min(lines.length,500);i++){
    if(lines[i].trim()==="---"){ end=i; break; }
  }
  if(end===-1) return null;
  return lines.slice(1,end).join("\n");
}

function hasKey(fm,key){
  const re = new RegExp(`^${key}\\s*:`, "m");
  return re.test(fm);
}

function walkSkillMd(rootDir){
  const res=[];
  const SKIP=new Set([".git","node_modules",".next","dist","build","out",".turbo",".cache",".compiled",".session"]);
  function walk(dir){
    let entries;
    try{ entries=fs.readdirSync(dir,{withFileTypes:true}) }catch{ return; }
    for(const e of entries){
      const full=path.join(dir,e.name);
      if(e.isDirectory()){
        if(SKIP.has(e.name)) continue;
        walk(full);
      }else if(e.isFile() && e.name==="SKILL.md"){
        res.push(full);
      }
    }
  }
  walk(rootDir);
  return res;
}

function parseArgs(argv){
  const args={root:".",mode:"warn"};
  for(let i=2;i<argv.length;i++){
    const a=argv[i];
    if(a==="--root" && argv[i+1]) args.root=argv[++i];
    else if(a==="--mode" && argv[i+1]) args.mode=argv[++i];
  }
  return args;
}

const {root,mode}=parseArgs(process.argv);
const absRoot=path.resolve(process.cwd(),root);
const files=walkSkillMd(absRoot);

let debtCount=0;
const debtList=[];

for(const f of files){
  const md=read(f);
  if(!md) continue;
  const fm=extractFrontmatter(md);
  if(!fm){
    debtCount++;
    debtList.push({file:f, missing:["frontmatter"]});
    continue;
  }
  const missing=REQUIRED.filter(k=>!hasKey(fm,k));
  if(missing.length){
    debtCount++;
    debtList.push({file:f, missing});
  }
}

console.log(`SFC CI Gate`);
console.log(`Root: ${absRoot}`);
console.log(`SKILL.md found: ${files.length}`);
console.log(`With Debt: ${debtCount}`);

if(debtCount){
  for(const d of debtList.slice(0,50)){
    console.log(`- ${d.file}`);
    console.log(`  missing: ${d.missing.join(", ")}`);
  }
}

if(mode==="strict" && debtCount>0){
  console.error("SFC CI Gate FAIL: debt detected");
  process.exit(1);
}

process.exit(0);
