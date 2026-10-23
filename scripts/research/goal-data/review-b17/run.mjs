// scripts/research/goal-data/review-b17/run.mjs
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
const out='scripts/research/goal-data/review-b17/',commands=[]
for(const f of ['regression.mjs','assembly.mjs','supplement.mjs','verify-diff.mjs']){
 const args=['--experimental-vm-modules',out+f],r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:40e6,timeout:60000})
 commands.push({command:process.execPath,args,status:r.status,stdout:r.stdout,stderr:r.stderr,error:r.error?.message??null})
 fs.writeFileSync(out+'commands.local.json',JSON.stringify(commands,null,2));if(r.status!==0)throw Error(f+' failed');console.log(f+' completed')
}
const checks=[...new Map(['audit','assembly','supplement','extra'].flatMap(n=>JSON.parse(fs.readFileSync(out+n+'.local.json')).checks).map(c=>[c.name,c])).values()]
const packets=JSON.parse(fs.readFileSync(out+'packets.local.json')),ts=JSON.parse(fs.readFileSync(out+'transcripts.local.json'))
checks.push({name:'captured transcripts remain byte identical',pass:ts.every(t=>fs.readFileSync(t.path,'utf8')===t.raw)})
const failed=checks.filter(c=>!c.pass)
fs.writeFileSync(out+'checks.local.json',JSON.stringify({checks,failed,packet_count:Object.keys(packets.files).length,commands},null,2))
console.log(JSON.stringify({checks:checks.length,failed,packets:Object.keys(packets.files).length,shipped_regressions:32}));if(failed.length)process.exitCode=1
