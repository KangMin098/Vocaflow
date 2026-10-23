// scripts/research/goal-data/review-b16/run.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const out='scripts/research/goal-data/review-b16/',commands=[]
for(const file of ['guards.mjs','supplement.mjs','verify-diff.mjs','transcripts.mjs']){
 const args=['--experimental-vm-modules',out+file],r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:30*1024*1024})
 commands.push({command:process.execPath,args,status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message??null})
 fs.writeFileSync(out+'commands.local.json',JSON.stringify(commands,null,2)+'\n')
 if(r.status!==0)throw Error(file+' failed; commands.local.json retains output')
 console.log(file+': completed')
}
const records=['audit','guards','supplement','extra'].flatMap(n=>JSON.parse(fs.readFileSync(out+n+'.local.json')).checks)
const unique=[...new Map(records.map(c=>[c.name,c])).values()],failed=unique.filter(c=>!c.pass)
const files=JSON.parse(fs.readFileSync(out+'packets.local.json')).files
const unchanged=Object.entries(files).every(([p,v])=>fs.readFileSync('D:/workspace/Vocaflow-goal-data/'+p,'utf8')===v)
fs.writeFileSync(out+'checks.local.json',JSON.stringify({checks:unique,unchanged,commands},null,2)+'\n')
console.log(JSON.stringify({checks:unique.length,failed,source_packets_unchanged:unchanged}))
if(failed.length||!unchanged)process.exitCode=1
