// scripts/research/goal-data/review-b20/audit.mjs
// Pinned Git source + captured local packets. Source execution has no filesystem write capability.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const root='D:/workspace/Vocaflow-goal-data', rev='00eed70e2b8e6b9195c9b9a6f52f45c1af7f8d33', old='fa9835ed5'
const out='scripts/research/goal-data/review-b20/', doc='docs/research/goal-data-batches/D2-task-mapping/', base='scripts/research/goal-data/local/'
const git=(...args)=>execFileSync('git',['-c','safe.directory='+root,...args],{cwd:root,encoding:'utf8',maxBuffer:40*1024*1024,stdio:['pipe','pipe','pipe']})
const at=(p,r=rev)=>git('show',r+':'+p), hash=b=>crypto.createHash('sha256').update(typeof b==='string'?b:JSON.stringify(b)).digest('hex')
if(!fs.existsSync(out+'packets.local.json')){
 const files={}; const walk=p=>{for(const e of fs.readdirSync(root+'/'+p,{withFileTypes:true})){const q=p+'/'+e.name;if(e.isDirectory())walk(q);else files[q]=fs.readFileSync(root+'/'+q,'utf8')}}
 for(const b of ['b2-v2','b3-insert','b4-v21','b5-v22','b6-v23','b7-v24','b8-v24','b9-v24','b9t-v24','b9t-v25','b11-v24','b12-v24','b13-v24','b14-v24','b15-v24','b16-v24','b17-v24','b18-v24','b19-v24','b20-v24'])walk(base+b)
 fs.writeFileSync(out+'packets.local.json',JSON.stringify({observed_at:new Date().toISOString(),files},null,2))
}
const snap=JSON.parse(fs.readFileSync(out+'packets.local.json')), cache=new Map(), read=p=>snap.files[p]??(cache.has(p)?cache.get(p):(cache.set(p,at(p)),cache.get(p))), json=p=>JSON.parse(read(p))
const commands=[],checks=[],check=(name,pass,detail)=>checks.push({name,pass,detail})
const diff=git('diff',old,rev);fs.writeFileSync(out+'diff.local.json',JSON.stringify({old,rev,diff},null,2))
async function execute(file,args=[],overrides={}){
 const writes={},logs=[],modules=new Map();const relative=p=>path.relative(root,p instanceof URL?p.pathname.replace(/^\/([A-Za-z]:)/,'$1'):String(p)).replaceAll('\\','/')
 const safeFs={readdirSync:p=>[...new Set(Object.keys(snap.files).filter(q=>q.startsWith(relative(p)+'/')).map(q=>q.slice(relative(p).length+1).split('/')[0]))],readFileSync:(p)=>writes[relative(p)]??overrides[relative(p)]??read(relative(p)),existsSync:p=>{if(Object.hasOwn(overrides,relative(p))&&overrides[relative(p)]===null)return false;if(Object.hasOwn(writes,relative(p)))return true;try{read(relative(p));return true}catch{return false}},writeFileSync:(p,b)=>writes[relative(p)]=String(b),mkdirSync:()=>{},mkdtempSync:p=>String(p)+'memory-only',rmSync:()=>{},copyFileSync:()=>{throw Error('copy blocked')}}
 const context=vm.createContext({URL,console:{log:(...x)=>logs.push(x.join(' ')),error:(...x)=>logs.push(x.join(' '))},process:{on:()=>{},argv:['node',file,...args],exit:c=>{throw Error('EXIT '+c)}}})
 async function mod(p){if(modules.has(p))return modules.get(p);if(p.startsWith('node:')){const val=p==='node:fs'?safeFs:await import(p);const names=[...new Set(['default',...Object.keys(val)])];const m=new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,n==='default'?val:val[n])},{context});modules.set(p,m);return m}
 const m=new vm.SourceTextModule(overrides[relative(p)]??read(relative(p)),{context,identifier:p,initializeImportMeta:m=>m.url=pathToFileURL(p).href});modules.set(p,m);await m.link(s=>mod(s.startsWith('node:')?s:path.resolve(path.dirname(p),s)));return m}
 let error=null;try{await(await mod(root+'/'+file)).evaluate()}catch(e){error=e.message}
 const r={file,args,logs,error,writes};commands.push(r);return r
}
const validator=await execute('scripts/research/goal-data/d2-run.mjs',['b20-v24','validate'])
check('b12 final validation',validator.error==='EXIT 0',validator.logs)
for(const b of ['b2-v2','b3-insert','b4-v21','b5-v22','b6-v23','b7-v24','b8-v24','b9-v24','b11-v24','b12-v24','b13-v24','b14-v24']){const r=await execute('scripts/research/goal-data/d2-run.mjs',[b,'validate']);check(b+' regression',r.error==='EXIT 0',r.logs)}
const regenerated=await execute('scripts/research/goal-data/d2-run.mjs',['b20-v24','agree'])
for(const [p,b]of Object.entries(regenerated.writes))check('reproduce '+p,b===at(p))
const inp=json(base+'b20-v24/input.json'),selection=json(doc+'b20-v24-selection.json'),agreement=json(doc+'b20-v24-agreement.json')
const tracks=Object.fromEntries(['A','B'].map(t=>[t,[1,2].flatMap(n=>json(base+`b20-v24/chunk-${t}-0${n}.out.json`).rows)]))
check('40 selected',inp.rows.length===40&&selection.items.length===40,selection.exam_totals)
check('excluded recorded',selection.excluded.length>0,selection.excluded)
check('selection hash',hash(selection.items)===selection.selection_sha256)
for(const r of inp.rows)check(r.item_id+' source hashes',hash(r.source)===r.source_sha256&&hash(r.source.passage)===r.passage_sha256&&selection.items.some(i=>i.item_id===r.item_id&&i.source_sha256===r.source_sha256))
for(const c of agreement.contracts)check('contract hash '+c.path,hash(read(c.path).replace(/\r\n/g,'\n'))===c.sha256)
check('input hash',hash(inp.rows.map(r=>[r.item_id,r.source_sha256]))===agreement.input_sha256)
const cats=['direct','indirect','not_applicable','unknown'];const stats=p=>{const n=p.length,a=p.filter(([a,b])=>a===b).length,pe=cats.reduce((s,c)=>s+p.filter(x=>x[0]===c).length*p.filter(x=>x[1]===c).length/n/n,0);return {n,agree:a,agreement:a/n,kappa:pe===1?null:(a/n-pe)/(1-pe)}}
const pairs=[],per={};for(const task of inp.tasks){const p=inp.rows.map(i=>['A','B'].map(t=>tracks[t].find(r=>r.item_id===i.item_id).links.find(l=>l.task_id===task).relevance));pairs.push(...p);per[task]=stats(p);check('per task '+task,Number(per[task].agreement.toFixed(4))===agreement.per_task[task].agreement&&Number(per[task].kappa?.toFixed(4))===agreement.per_task[task].kappa)}
const overall=stats(pairs);check('overall recalculation',Number(overall.agreement.toFixed(4))===agreement.agreement&&Number(overall.kappa.toFixed(4))===agreement.kappa)
const primary=tracks.A.filter(a=>a.primary_task!==tracks.B.find(b=>b.item_id===a.item_id).primary_task).map(a=>({item:a.item_id,A:a.primary_task,B:tracks.B.find(b=>b.item_id===a.item_id).primary_task}))
check('primary 37/40',primary.length===3&&agreement.primary_task_agreement===37,primary)
const alarms=Object.fromEntries(Object.entries(per).filter(([t])=>t!=='e.evidence_location').map(([t,v])=>[agreement.per_task[t].display,v.kappa===null?'unclear':v.agreement<.8&&v.kappa<.68?'stop':'ok']));check('alarms',JSON.stringify(alarms)===JSON.stringify(agreement.stop_alarm),alarms)
const sample=json(doc+'b20-v24-review-sample.json'), ids=[...new Set([...sample.candidates,...sample.disputed].map(r=>r.item).concat(primary.map(r=>r.item)))]
const locate=(p,id)=>p+':'+(read(p).split('\n').findIndex(l=>l.includes('"item_id"')&&l.includes('"'+id+'"'))+1)
const dossier=ids.map(id=>({id,input:inp.rows.find(r=>r.item_id===id),judgments:Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(r=>r.item_id===id)])),evidence:[locate(base+'b20-v24/input.json',id),...['A','B'].map(t=>locate(base+`b20-v24/chunk-${t}-0${tracks[t].findIndex(r=>r.item_id===id)<20?1:2}.out.json`,id))]}))
const history=[];for(const p of Object.keys(snap.files).filter(p=>p.startsWith(base+'b20-v24/history/')&&p.endsWith('/manifest.json'))){const m=json(p),dir=p.slice(0,p.lastIndexOf('/')+1);for(const f of m.files){check('history '+dir+f.file,hash(read(dir+f.file))===f.sha256);const first=json(dir+f.file).rows,final=json(base+'b20-v24/'+f.file).rows;history.push({path:dir+f.file,changes:first.flatMap(r=>{const next=final.find(a=>a.item_id===r.item_id);return hash(r)===hash(next)?[]:[{item:r.item_id,before:r,after:next}]})})}}
const trace=Object.fromEntries(['A','B'].map(t=>[t,tracks[t].map(r=>({item:r.item_id,primary:r.primary_task,reason:r.primary_reason,type:inp.rows.find(i=>i.item_id===r.item_id).type_id,direct:r.links.filter(l=>l.relevance==='direct').map(l=>l.task_id)}))]))
fs.writeFileSync(out+'audit.local.json',JSON.stringify({rev,old,observed_at:snap.observed_at,commands,checks,overall,per,primary,sample,dossier,history,trace},null,2)+'\n')
fs.writeFileSync(out+'dossier.local.json',JSON.stringify(dossier,null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass)}))
export {root,rev,old,out,doc,base,at,git,read,json,hash,snap,execute,checks,check,inp,tracks,history,locate,dossier,primary,per,overall}



