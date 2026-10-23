// scripts/research/goal-data/review-b20/assembly.mjs
import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const out=path.resolve('scripts/research/goal-data/review-b20'),root='D:/workspace/Vocaflow-goal-data',base='scripts/research/goal-data/local/',snap=JSON.parse(fs.readFileSync(out+'/packets.local.json')).files
const tmp=fs.mkdtempSync(path.join(out,'assembly-')),results=[]
try{
for(const batch of ['b20-v24']){
 for(const [p,s]of Object.entries(snap).filter(([p])=>p.startsWith(base+batch+'/'))){const dest=path.join(tmp,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,s)}
 for(const label of batch==='b20-v24'?['A-01','A-02','B-01','B-02']:['A-01']){
  const p=base+batch+'/sources/'+label+'/assemble.mjs',dest=path.join(tmp,p),original=fs.readFileSync(dest,'utf8')
  // B18 alone hardcodes the owner's output path. Relocate that single base literal.
  const relocated=original.replaceAll(root+'/'+base+batch+'/',path.join(tmp,base,batch).replaceAll('\\','/')+'/')
  if(relocated.includes(root))throw Error('owner path remains')
  fs.writeFileSync(dest,relocated)
  const r=spawnSync(process.execPath,[dest],{encoding:'utf8',cwd:tmp,maxBuffer:3e6}),output=fs.readFileSync(path.join(tmp,base,batch,'chunk-'+label+'.out.json'),'utf8'),final=snap[base+batch+'/chunk-'+label+'.out.json']
  results.push({batch,label,relocated:relocated!==original,status:r.status,stdout:r.stdout,stderr:r.stderr,byte_equal:output===final,json_equal:JSON.stringify(JSON.parse(output))===JSON.stringify(JSON.parse(final)),output,original})
 }
}
fs.writeFileSync(out+'/assembly.local.json',JSON.stringify(results,null,2))
console.log(JSON.stringify(results.map(({output,original,...r})=>r),null,2))
if(results.some(r=>r.status!==0||!r.json_equal))process.exitCode=1
}finally{const resolved=path.resolve(tmp);if(!resolved.startsWith(out+path.sep))throw Error('unsafe cleanup');fs.rmSync(resolved,{recursive:true,force:true})}
