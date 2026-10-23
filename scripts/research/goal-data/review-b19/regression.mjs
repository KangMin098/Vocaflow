// scripts/research/goal-data/review-b19/regression.mjs
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync,execFileSync} from 'node:child_process'
const out=path.resolve('scripts/research/goal-data/review-b19'),tmp=fs.mkdtempSync(path.join(out,'isolated-')),rev='aa851c2772d84fec4436cb96e60cd1c96bbb7e25',seen=new Set(),sources={}
function copy(p){if(seen.has(p))return;seen.add(p);const s=execFileSync('git',['-c','safe.directory=D:/workspace/Vocaflow-goal-data','show',rev+':'+p],{cwd:'D:/workspace/Vocaflow-goal-data',encoding:'utf8'});sources[p]=s;const f=path.join(tmp,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);for(const m of s.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))copy(path.posix.normalize(path.posix.join(path.posix.dirname(p),m[1])))}
try{
copy('scripts/research/goal-data/d2-validate.check.mjs');copy('scripts/research/goal-data/d2-run.mjs');
copy('docs/csat-learner/v4/codebook.json');
copy('scripts/research/goal-data/prereg-compare.mjs');
const packets=JSON.parse(fs.readFileSync(path.join(out,'packets.local.json'))).files
for(const [p,s] of Object.entries(packets)){const f=path.join(tmp,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s)}
const r=spawnSync(process.execPath,[path.join(tmp,'scripts/research/goal-data/d2-validate.check.mjs')],{cwd:tmp,encoding:'utf8',env:{...process.env,TEMP:tmp,TMP:tmp},timeout:30000,maxBuffer:3e6})
const count=(r.stdout.match(/^ok /gm)||[]).length,pass=r.status===0&&count===32
fs.writeFileSync(path.join(out,'regression.local.json'),JSON.stringify({rev,sources,status:r.status,stdout:r.stdout,stderr:r.stderr,count,pass},null,2))
console.log(JSON.stringify({status:r.status,count,pass,stderr:r.stderr}));if(!pass)process.exitCode=1
}finally{const target=path.resolve(tmp);if(!target.startsWith(out+path.sep))throw Error('cleanup path outside output');fs.rmSync(target,{recursive:true,force:true})}
