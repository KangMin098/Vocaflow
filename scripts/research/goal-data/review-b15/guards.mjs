// scripts/research/goal-data/review-b15/guards.mjs
import fs from 'node:fs'
import path from 'node:path'
import {out,base,root,read,json,at,snap,execute,checks,check,hash,locate} from './audit.mjs'
let lib=at('scripts/csat/map/v62/data/pilot-lib.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'').replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`)
const pilot=new Function('fs','path',lib+'\nreturn {nonHeldTasks,validateChunk,validateRow};')({readFileSync:p=>read(path.relative(root,String(p)).replaceAll('\\','/'))},path)
const code=at('scripts/research/goal-data/d2-validate.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
const make=new Function('validateChunk','validateRow',code+'\nreturn {makeValidator,loadTrack};')(pilot.validateChunk,pilot.validateRow)
// Force only the new guard's activation in memory, keeping original validation separately.
const forcedCode=code.replace('if (reasonsRequired && bn >= 14)', 'if (true)').replace('if (!reasonsRequired && !withReason.length) return []','if (false) return []')
const forced=new Function('validateChunk','validateRow',forcedCode+'\nreturn makeValidator;')(pilot.validateChunk,pilot.validateRow)
const norm=s=>s.replace(/\s+/g,' ').trim(), all=[], hitRows=[]
const batches=[...new Set(Object.keys(snap.files).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))].sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1))||a.localeCompare(b))
for(const batch of batches){
 const input=json(base+batch+'/input.json'), tasks=pilot.nonHeldTasks().filter(t=>!input.tasks||input.tasks.includes(t.id))
 const files=Object.keys(snap.files).filter(p=>p.startsWith(base+batch+'/chunk-')&&p.endsWith('.out.json'))
 for(const track of [...new Set(files.map(p=>/chunk-([^-]+)-/.exec(p)[1]))]){
  const trackFiles=files.filter(p=>p.includes('/chunk-'+track+'-')).sort(), rows=trackFiles.flatMap(p=>json(p).rows), v=forced(input,tasks), errors=v.reasons(rows).filter(e=>e.includes('not_observable'))
  const groups=new Map();for(const r of rows)for(const n of r.not_observable??[]){const k=norm(n.why.split(r.item_id).join('#'));const g=groups.get(k)??{ids:new Set(),entries:0};g.ids.add(r.item_id);g.entries++;groups.set(k,g)}
  const hits=[...groups].filter(([,g])=>g.ids.size>=3).map(([why,g])=>({why,ids:[...g.ids],entries:g.entries}))
  check(batch+'/'+track+' independent grouping matches actual new guard',errors.length===hits.length)
  const record={batch,track,rows:rows.length,errors,hits,original_errors:make.makeValidator(input,tasks).reasons(rows)};all.push(record)
  if(hits.length)for(const r of rows){
   const p=trackFiles.find(p=>json(p).rows.some(x=>x.item_id===r.item_id)), i=input.rows.find(i=>i.item_id===r.item_id)
   hitRows.push({batch,track,id:r.item_id,hit:hits.some(h=>h.ids.includes(r.item_id)),evidence:locate(p,r.item_id),source_evidence:locate(base+batch+'/input.json',r.item_id),source:i.source,type:i.type_id,row:r,
    decision_summary_unique:rows.filter(x=>x.decision_path?.summary===r.decision_path?.summary).length===1,
    primary_reason_unique:!r.primary_reason||rows.filter(x=>x.primary_reason===r.primary_reason).length===1,
    counterfactuals:(r.links??[]).filter(l=>l.counterfactual).map(l=>({task:l.task_id,value:l.counterfactual,identical_other_rows:rows.filter(x=>x.item_id!==r.item_id&&x.links?.some(a=>JSON.stringify(a.counterfactual)===JSON.stringify(l.counterfactual))).map(x=>x.item_id)}))})
  }
 }
}
for(const r of hitRows){
 const flat=f=>typeof f==='string'?f.replace(/\s+/g,' ').trim():''
 const q=r.row.decision_path, text=q?.field==='choices'?r.source.choices.join(' '):r.source[q?.field??'passage']
 check(r.batch+'/'+r.track+'/'+r.id+' decision quote bound to source',!!q?.quote&&flat(text).includes(flat(q.quote)))
 for(const c of r.counterfactuals){const v=c.value;check(r.batch+'/'+r.id+'/'+c.task+' counterfactual anchored',v.kind==='choice'?!(r.source.answers??[r.source.answer]).includes(v.choice):flat(r.source[v.field??'passage']).includes(flat(v.quote)))}
}
const tests=await execute('scripts/research/goal-data/d2-validate.check.mjs')
check('all shipped guard counterexamples pass',(tests.error===null||tests.error==='EXIT 0')&&tests.logs.every(s=>!s.includes('FAIL')),tests.logs)
const input=json(base+'b14-v24/input.json'), ts=pilot.nonHeldTasks().filter(t=>input.tasks.includes(t.id)),v=make.makeValidator(input,ts)
const firstPath=Object.keys(snap.files).find(p=>p.includes('b14-v24-B-01-first/')&&p.endsWith('.out.json')), first=json(firstPath).rows
const initialErrors=v.reasons(first).filter(e=>e.includes('not_observable'))
check('actual B01 first 44 explanations across 19 rows rejected',initialErrors.some(s=>s.includes('19문항'))&&first.flatMap(r=>r.not_observable??[]).length===44,initialErrors)
// Verify actual loader clears the whole track on a new guard failure; all fs reads stay captured.
const firstLoad=await execute('scripts/research/goal-data/d2-run.mjs',['b14-v24','validate','B'],{[base+'b14-v24/chunk-B-01.out.json']:read(firstPath)})
check('actual first B track rejected by runner',firstLoad.error==='EXIT 1'&&firstLoad.logs.some(s=>s.includes('not_observable')),firstLoad)
const benign=[1,2,3].map(k=>({item_id:'Z#'+k,not_observable:[{task_id:'e.task_demand',why:'선택으로 요구 재진술 수행을 관찰할 수 없다'}]}))
const shortFalsePositive=v.reasons(benign).filter(e=>e.includes('not_observable'))
check('legitimate shared short rationale is also rejected (false-positive boundary reproduced)',shortFalsePositive.length===1,shortFalsePositive)
const finals=['A','B'].map(t=>({track:t,errors:v.reasons([1,2].flatMap(n=>json(base+`b14-v24/chunk-${t}-0${n}.out.json`).rows))}))
check('b14 final new guard clean',finals.every(t=>!t.errors.length))
fs.writeFileSync(out+'guards.local.json',JSON.stringify({checks,all,hitRows,firstPath,initialErrors,firstLoad,shortFalsePositive,finals},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),tracks:all.map(({batch,track,rows,hits})=>({batch,track,rows,hits})),initialErrors,shortFalsePositive},null,2))
