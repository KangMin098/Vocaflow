// scripts/research/goal-data/review-b9/audit.mjs
// Read-only source execution: all source writes are captured in memory.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
const root = 'D:/workspace/Vocaflow-goal-data'
const dest = path.resolve('docs/research/goal-data-batches/review-b9')
const local = 'scripts/research/goal-data/local/'
const doc = 'docs/research/goal-data-batches/D2-task-mapping/'
const sha = b => crypto.createHash('sha256').update(b).digest('hex')
const read = p => fs.readFileSync(path.join(root,p))
const json = p => JSON.parse(read(p))
const gitEvidence=JSON.parse(fs.readFileSync(path.join(dest,'source-git.local.json'),'utf8').replace(/^\uFEFF/,''))
const record = { head: gitEvidence.head, commands:[], files:[] }
const checks=[]
const check=(name,pass,detail)=>checks.push({name,pass,detail})
async function execute(file,args=[]) {
 const writes=new Map(), logs=[], cache=new Map()
 const safeFS={...fs,writeFileSync:(p,b)=>writes.set(String(p).replaceAll('\\','/'),String(b)),mkdirSync:()=>{throw Error('mkdir refused')},copyFileSync:()=>{throw Error('copy refused')}}
 const context=vm.createContext({console:{log:(...x)=>logs.push(x.join(' ')),error:(...x)=>logs.push(x.join(' '))},process:{argv:['node',file,...args],exit:c=>{throw Error('EXIT '+c)}}})
 async function moduleFor(p){
  if(cache.has(p))return cache.get(p)
  if(p.startsWith('node:')){const value=p==='node:fs'?safeFS:await import(p);const names=[...new Set(['default',...Object.keys(value)])];const m=new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,n==='default'?value:value[n])},{context});cache.set(p,m);return m}
  const m=new vm.SourceTextModule(fs.readFileSync(p,'utf8'),{context,identifier:p,initializeImportMeta:meta=>{meta.url=pathToFileURL(p).href}});cache.set(p,m);await m.link(s=>moduleFor(s.startsWith('node:')?s:path.resolve(path.dirname(p),s)));return m
 }
 let error=null;try{await(await moduleFor(path.join(root,file))).evaluate()}catch(e){error=e.message}
 const out={file,args,logs,error,writes:Object.fromEntries(writes)};record.commands.push(out);return out
}
record.diff=gitEvidence.diff
check('input HEAD',record.head==='2b3f3bafbb85b94f96ce04f4512c228c07a8cabe',record.head)
check('registration sha',sha(read(doc+'V2_5_PREREGISTRATION.md'))==='05293147cc7e0308c352dbd791aa28fd7e305131028c820c4420412dfac686a3')
for(const stage of ['export','judging','compute'])record.files.push({path:local+'b9-v24/prompts/freeze-check-'+stage+'.txt',body:read(local+'b9-v24/prompts/freeze-check-'+stage+'.txt').toString()})
await execute('scripts/research/goal-data/prereg-freeze-check.mjs')
const rerun=await execute('scripts/research/goal-data/prereg-compare.mjs')
check('comparison byte reproduction',rerun.writes[root+'/'+doc+'v2_5-comparison.json']===read(doc+'v2_5-comparison.json').toString())
const run=json(doc+'v2_5-prereg-run.json'),manifest=json(local+'b9-v24/prompts/manifest.json')
for(const r of manifest.runs){check(r.LABEL+' prompt hash',sha(read(r.prompt_file))===r.prompt_sha256);check(r.LABEL+' chunk hash',sha(read(local+r.BATCH+'/chunk-'+r.TRACK+'-01.json'))===r.input_chunk_sha256);let rendered=read(doc+'prereg-prompts/comparison-analyst.md').toString().split('---')[1].trim();for(const key of ['LABEL','BATCH','TRACK','CONTRACT_LIST'])rendered=rendered.replaceAll('{'+key+'}',r[key]);check(r.LABEL+' template rendering',rendered===read(r.prompt_file).toString().trim())}
for(const [batch,entries] of Object.entries(run.snapshots))for(const entry of entries){
 const p=local+batch+'/history/'+entry.dir+'/',m=json(p+'manifest.json')
 check(entry.dir+' manifest hash',sha(read(p+'manifest.json'))===entry.manifest_sha256)
 for(const f of m.files){const b=read(p+f.file),rows=JSON.parse(b).rows;check(entry.dir+' '+f.file+' hash',sha(b)===f.sha256);record.files.push({path:p+f.file,bytes:b.length,sha256:sha(b),rows:rows.length,primary_reason_count:rows.filter(r=>r.primary_reason).length,why_count:rows.reduce((n,r)=>n+r.links.filter(l=>l.why).length,0)})}
}
for(const [batch,entries]of Object.entries(run.final_outputs))for(const f of entries)check(batch+' '+f.file+' final hash',sha(read(local+batch+'/'+f.file))===f.sha256)
for(const batch of ['b9-v24','b9t-v25','b9t-v24'])for(const track of ['A','B'])await execute('scripts/research/goal-data/d2-run.mjs',[batch,'validate',track])
const first='b9t-v25/history/2026-10-23T08-34-49-503Z-prereg-C-first/chunk-A-01.out.json'
const before=json(local+first).rows,after=json(local+'b9t-v25/chunk-A-01.out.json').rows
record.correction=before.flatMap((r,i)=>r.links.flatMap((l,j)=>JSON.stringify(l)===JSON.stringify(after[i].links[j])?[]:[{item:r.item_id,before:l,after:after[i].links[j]}]))
check('C only five E1 why changes',record.correction.length===5&&before.every((r,i)=>{const a=structuredClone(r),b=structuredClone(after[i]);for(const x of [a,b])for(const l of x.links)if(l.task_id==='e.task_demand')delete l.why;return JSON.stringify(a)===JSON.stringify(b)}))
record.run=run
const {makeValidator,loadTrack}=await import(pathToFileURL(root+'/scripts/research/goal-data/d2-validate.mjs'))
const {nonHeldTasks}=await import(pathToFileURL(root+'/scripts/csat/map/v62/data/pilot-lib.mjs'))
const bi=json(local+'b9-v24/input.json'),ts=nonHeldTasks().filter(t=>bi.tasks.includes(t.id))
const bfirst=json(local+'b9-v24/history/2026-10-23T08-42-59-952Z-B01-first/chunk-B-01.out.json').rows
record.baseline_first_errors=bfirst.flatMap(r=>makeValidator(bi,ts).row(r).map(e=>({item:r.item_id,error:e})))
const probe=structuredClone(bfirst.find(r=>r.item_id==='M2406#26')??bfirst.find(r=>r.links.some(l=>l.task_id==='e.task_demand'&&l.relevance==='direct')))
probe.primary_task='e.task_demand'
record.baseline_probe={item:probe.item_id,v24:makeValidator(bi,ts).row(probe),v25:makeValidator({...bi,contract:'v2.5'},ts).row(probe)}
check('v24 cannot emit v25 E1 prohibition',!record.baseline_probe.v24.some(e=>e.includes('v2.5'))&&record.baseline_probe.v25.some(e=>e.includes('v2.5')))
const ci=json(local+'b9t-v25/input.json'),cv=makeValidator(ci,ts)
record.c_first_validation=loadTrack(root+'/'+local+'b9t-v25/history/2026-10-23T08-34-49-503Z-prereg-C-first','A',1,cv,ci.rows.map(r=>r.item_id)).errors
for(const batch of ['b9-v24','b9t-v25','b9t-v24']){
 const walk=p=>{for(const e of fs.readdirSync(path.join(root,p),{withFileTypes:true})){const q=p+'/'+e.name;if(e.isDirectory())walk(q);else record.files.push({path:q,sha256:sha(read(q)),body:read(q).toString()})}}
 walk(local+batch)
}
record.dossier=json(local+'b9t-v25/input.json').rows.map(r=>({item:r.item_id,type:r.type_id,source:r.source,tracks:Object.fromEntries(['b9t-v25','b9t-v24'].flatMap(b=>['A','B'].map(t=>[b+t,json(local+b+'/chunk-'+t+'-01.out.json').rows.find(x=>x.item_id===r.item_id)])))}))
fs.writeFileSync(path.join(dest,'audit.local.json'),JSON.stringify(record,null,2)+'\n')
fs.writeFileSync(path.join(dest,'checks.json'),JSON.stringify(checks,null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),commands:record.commands.map(({file,args,logs,error})=>({file,args,logs,error})),snapshots:record.files.filter(x=>x.rows),correction:record.correction.map(x=>x.item)},null,2))
