// scripts/research/goal-data/review-b14/recheck.mjs
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const rev='30ea8e94f293f81c910708d04545d50976536d8f', old='57b7e7006', root='D:/workspace/Vocaflow-goal-data', out='scripts/research/goal-data/review-b14/', base='scripts/research/goal-data/local/'
const git=(...a)=>execFileSync('git',a,{encoding:'utf8',maxBuffer:40*1024*1024,stdio:['pipe','pipe','pipe']})
const at=p=>git('show',rev+':'+p), files=JSON.parse(fs.readFileSync(out+'packets.local.json')).files
const read=p=>files[p]??at(p), json=p=>JSON.parse(read(p)), norm=s=>s.replace(/\s+/g,' ').trim()
const checks=[],check=(name,pass,detail)=>checks.push({name,pass,detail})
const validatorPath='scripts/research/goal-data/d2-validate.mjs', code=at(validatorPath).replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
const lib=at('scripts/csat/map/v62/data/pilot-lib.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'').replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`)
const pilot=new Function('fs','path',lib+'\nreturn {nonHeldTasks,validateChunk,validateRow};')({readFileSync:p=>read(path.relative(root,String(p)).replaceAll('\\','/'))},path)
const make=(force=false)=>new Function('validateChunk','validateRow',(force?code.replace('if (reasonsRequired && bn >= 14)','if (true)').replace('if (!reasonsRequired && !withReason.length) return []','if (false) return []'):code)+'\nreturn makeValidator;')(pilot.validateChunk,pilot.validateRow)
const actual=make(), forced=make(true), tasks=pilot.nonHeldTasks()
const loc=(p,id)=>p+':'+(read(p).split('\n').findIndex(l=>l.includes('"item_id"')&&l.includes('"'+id+'"'))+1)
const lines=(p,term)=>p+':'+(at(p).split('\n').findIndex(l=>l.includes(term))+1)
// Evaluate the shipped check module with memory-only filesystem, including its loader tests.
async function execute(file,args=[],overrides={}) {
 const writes={},logs=[],modules=new Map(),relative=p=>path.relative(root,p instanceof URL?p.pathname.replace(/^\/([A-Za-z]:)/,'$1'):String(p)).replaceAll('\\','/')
 const safeFs={readFileSync:p=>writes[relative(p)]??overrides[relative(p)]??read(relative(p)),existsSync:p=>{try{if(writes[relative(p)]!==undefined||overrides[relative(p)]!==undefined)return true;read(relative(p));return true}catch{return false}},writeFileSync:(p,b)=>writes[relative(p)]=String(b),mkdirSync:()=>{},mkdtempSync:p=>String(p)+'memory-only',rmSync:()=>{}}
 const context=vm.createContext({URL,console:{log:(...a)=>logs.push(a.join(' ')),error:(...a)=>logs.push(a.join(' '))},process:{argv:['node',file,...args],exit:c=>{throw Error('EXIT '+c)}}})
 async function mod(p){if(modules.has(p))return modules.get(p);if(p.startsWith('node:')){const val=p==='node:fs'?safeFs:await import(p),names=[...new Set(['default',...Object.keys(val)])],m=new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,n==='default'?val:val[n])},{context});modules.set(p,m);return m}const m=new vm.SourceTextModule(overrides[relative(p)]??read(relative(p)),{context,identifier:p,initializeImportMeta:m=>m.url=pathToFileURL(p).href});modules.set(p,m);await m.link(s=>mod(s.startsWith('node:')?s:path.resolve(path.dirname(p),s)));return m}
 let error=null;try{await(await mod(root+'/'+file)).evaluate()}catch(e){error=e.message}return {file,args,error,logs,writes}
}
const shipped=await execute('scripts/research/goal-data/d2-validate.check.mjs')
check('shipped 16/16',shipped.error==='EXIT 0'&&shipped.logs.length===16&&shipped.logs.every(x=>x.startsWith('ok ')),shipped.logs)
const tracks=[],dossiers=[]
for(const batch of [...new Set(Object.keys(files).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))].sort()){
 const input=json(base+batch+'/input.json'), paths=Object.keys(files).filter(p=>p.startsWith(base+batch+'/chunk-')&&p.endsWith('.out.json')).sort()
 for(const track of [...new Set(paths.map(p=>/chunk-([^-]+)-/.exec(p)[1]))]){
  const ps=paths.filter(p=>p.includes('/chunk-'+track+'-')),rows=ps.flatMap(p=>json(p).rows), v=forced(input,tasks),errors=v.reasons(rows).filter(e=>e.includes('not_observable'))
  // Independent two-pass grouping, excluding insertion E2 exactly as the changed implementation does.
  const entries=rows.map(r=>({r,ws:(r.not_observable??[]).filter(n=>typeof n.why==='string'&&!(n.task_id==='e.evidence_location'&&input.rows.find(i=>i.item_id===r.item_id)?.type_id==='R-INSERT')).map(n=>({task:n.task_id,key:norm(n.why.split(r.item_id).join('#'))}))})),groups=new Map()
  for(const {r,ws}of entries)for(const w of ws){if(!groups.has(w.key))groups.set(w.key,new Set());groups.get(w.key).add(r.item_id)}
  const repeated=[...groups].filter(([,ids])=>ids.size>=3).map(([key])=>key),qualifying=new Map()
  for(const {r,ws}of entries){const hits=ws.filter(w=>repeated.includes(w.key));if(ws.length&&hits.length/ws.length>=.5)for(const w of hits){if(!qualifying.has(w.key))qualifying.set(w.key,new Set());qualifying.get(w.key).add(r.item_id)}}
  const flagged=[...qualifying].filter(([,ids])=>ids.size>=3)
  check(batch+'/'+track+' independent row grouping',errors.length===flagged.length)
  tracks.push({batch,track,rows:rows.length,errors,repeated_groups:repeated.length,flagged_groups:flagged.length})
  if(['b13-v24','b9t-v24'].includes(batch)&&track==='A')for(const {r,ws}of entries){const p=ps.find(p=>json(p).rows.some(x=>x.item_id===r.item_id)),inp=input.rows.find(i=>i.item_id===r.item_id);dossiers.push({batch,id:r.item_id,evidence:[loc(p,r.item_id),loc(base+batch+'/input.json',r.item_id)],source:inp.source,type:inp.type_id,row:r,explanations:ws.map(w=>({...w,repeated:repeated.includes(w.key)}))})}
 }
}
check('28 tracks',tracks.length===28)
check('only b8 A flagged',JSON.stringify(tracks.filter(t=>t.errors.length).map(t=>t.batch+'/'+t.track))===JSON.stringify(['b8-v24/A']))
for(const [b,t]of [['b3-insert','B'],['b6-v23','A']])check(b+'/'+t+' allowed under forced guard',tracks.some(x=>x.batch===b&&x.track===t&&!x.errors.length))
const input=json(base+'b14-v24/input.json'), v=actual(input,tasks.filter(t=>input.tasks.includes(t.id))), firstPath=Object.keys(files).find(p=>p.includes('b14-v24-B-01-first/')&&p.endsWith('.out.json')),first=json(firstPath).rows,firstErrors=v.reasons(first)
check('initial B01 blocked',firstErrors.some(e=>e.includes('not_observable')))
const firstRun=await execute('scripts/research/goal-data/d2-run.mjs',['b14-v24','validate','B'],{[base+'b14-v24/chunk-B-01.out.json']:read(firstPath)})
check('initial B01 actual runner blocked',firstRun.error==='EXIT 1'&&firstRun.logs.some(l=>l.includes('not_observable')))
const synth=n=>[1,2,3].map((k)=>({item_id:'S#'+k,not_observable:[{task_id:'r.inference',why:'선택 하나만으로 수행의 근거 지목을 확인할 수 없다'},...Array.from({length:n},(_,j)=>({task_id:['r.central_meaning','e.task_demand'][j],why:`무의미 식별자 ${['가','나','다'][k-1]} ${['별','달'][j]}`}))]}))
const synthetic=[0,1,2].map(n=>({unique_padding:n,errors:v.reasons(synth(n))}))
check('one repeated + one meaningless unique blocked',synthetic[1].errors.some(e=>e.includes('not_observable')))
check('one repeated + two meaningless unique bypass',synthetic[2].errors.length===0)
// Stronger test: append padding to structurally valid real rows and retain their original primary/links.
const real=input.rows.slice(0,3).map(i=>json(base+'b14-v24/chunk-A-01.out.json').rows.find(r=>r.item_id===i.item_id))
const padded=real.map((r,k)=>({...r,not_observable:synth(2)[k].not_observable})),paddedRowErrors=padded.map(r=>({id:r.item_id,errors:v.row(r)})),paddedChunkErrors=v.chunk(padded),paddedReasons=v.reasons(padded)
check('real-row padding full validation bypass',paddedRowErrors.every(r=>!r.errors.length)&&!paddedChunkErrors.length&&!paddedReasons.length,{paddedRowErrors,paddedChunkErrors,paddedReasons})
const padPath=base+'b14-v24/chunk-A-01.out.json',padChunk=json(padPath)
padChunk.rows=padChunk.rows.map(r=>padded.find(p=>p.item_id===r.item_id)??r)
const paddedRun=await execute('scripts/research/goal-data/d2-run.mjs',['b14-v24','validate','A'],{[padPath]:JSON.stringify(padChunk)})
check('padded real track accepted by actual runner',paddedRun.error==='EXIT 0',paddedRun.logs)
const insertRows=[1,2,3].map(k=>({item_id:'I#'+k,not_observable:[{task_id:'e.evidence_location',why:'무관한 동일 문장을 근거 없이 재사용한다'}]})),insertValidator=actual({contract:'v2.4',batch:'b14-v24',rows:insertRows.map(r=>({item_id:r.item_id,type_id:'R-INSERT'}))},[])
const broadExemption=insertValidator.reasons(insertRows)
check('insertion E2 arbitrary text exempted',broadExemption.length===0)
const aPaths=Object.keys(files).filter(p=>p.startsWith(base+'b14-v24/chunk-A-')&&p.endsWith('.out.json')).sort(),insertIds=input.rows.filter(i=>i.type_id==='R-INSERT').slice(0,3).map(i=>i.item_id),insertOverrides={}
for(const p of aPaths){const chunk=json(p);chunk.rows=chunk.rows.map(r=>insertIds.includes(r.item_id)?{...r,not_observable:[...(r.not_observable??[]).filter(n=>n.task_id!=='e.evidence_location'),{task_id:'e.evidence_location',why:'무관한 동일 문장을 근거 없이 재사용한다'}]}:r);insertOverrides[p]=JSON.stringify(chunk)}
const insertionRun=await execute('scripts/research/goal-data/d2-run.mjs',['b14-v24','validate','A'],insertOverrides)
check('arbitrary insertion E2 real-track bypass',insertIds.length===3&&insertionRun.error==='EXIT 0',insertionRun.logs)
const snapshotHashes=Object.fromEntries(Object.entries(files).filter(([p])=>p.endsWith('input.json')||/\/chunk-[AB]-\d+\.out\.json$/.test(p)).map(([p,b])=>[p,crypto.createHash('sha256').update(b).digest('hex')]))
for(const p of Object.keys(snapshotHashes))check('captured packet unchanged '+p,fs.readFileSync(root+'/'+p,'utf8')===files[p])
for(const d of dossiers){const q=d.row.decision_path,src=q.field==='choices'?d.source.choices.join(' '):d.source[q.field];check(d.batch+'/'+d.id+' decision quote source bound',norm(src).includes(norm(q.quote)))}
const report={rev,old,observed_at:new Date().toISOString(),checks,tracks,synthetic,firstErrors,firstRun,shipped,paddedRowErrors,paddedChunkErrors,paddedReasons,paddedRun,broadExemption,insertionRun,insertIds,dossiers,snapshotHashes,diff:git('diff',old,rev),contract:at('docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2_2.md'),sources:{validator:lines(validatorPath,'const tmplRows'),exemption:lines(validatorPath,"if (n.task_id === 'e.evidence_location'"),mapping:lines('docs/research/goal-data-batches/D2-task-mapping/mapping-review.md','수정 가드로 전 배치')}}
fs.writeFileSync(out+'recheck.local.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),tracks:tracks.filter(t=>t.errors.length),synthetic,paddedRowErrors,paddedChunkErrors,paddedReasons,sources:report.sources,dossiers:dossiers.filter(d=>d.explanations.some(e=>e.repeated)).map(d=>({batch:d.batch,id:d.id,evidence:d.evidence,explanations:d.explanations,decision:d.row.decision_path,reason:d.row.primary_reason}))},null,2))
if(checks.some(c=>!c.pass))process.exitCode=1
