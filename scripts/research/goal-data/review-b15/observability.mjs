// scripts/research/goal-data/review-b15/observability.mjs
// Read-only independent invariants; raw rows stay in ignored local JSON.
import fs from 'node:fs'
import {out,base,doc,snap,json,read,at,git,hash,locate,check,checks,execute} from './audit.mjs'
export function observableErrors(r) {
 const direct=new Set((r.links??[]).filter(l=>l.relevance==='direct').map(l=>l.task_id))
 const no=new Set((r.not_observable??[]).map(n=>n.task_id))
 return (r.directly_observable??[]).flatMap(t=>[...(!direct.has(t)?['observable_not_direct:'+t]:[]),...(no.has(t)?['both_observable_and_not:'+t]:[])])
}
check('empty observable with direct is valid',observableErrors({links:[{task_id:'T',relevance:'direct'}],directly_observable:[],not_observable:[{task_id:'T',why:'response does not identify a path'}]}).length===0)
check('overlap is detected',observableErrors({links:[{task_id:'T',relevance:'direct'}],directly_observable:['T'],not_observable:[{task_id:'T'}]}).includes('both_observable_and_not:T'))
check('observable outside direct is detected',observableErrors({links:[],directly_observable:['T']}).includes('observable_not_direct:T'))
const files=Object.keys(snap.files).filter(p=>/\/chunk-[AB]-\d+\.out\.json$/.test(p)&&!p.includes('/history/')).sort()
const all=[],summary=[],chunkSummary=[],violations=[],comparisons=[]
for(const p of files){const rows=json(p).rows,batch=p.split('/').at(-2),track=/chunk-([AB])-/.exec(p)[1];chunkSummary.push({file:p,n:rows.length,empty:rows.filter(r=>!r.directly_observable.length).length})
 for(const r of rows){const errors=observableErrors(r);all.push({batch,track,file:p,row:r});if(errors.length)violations.push({batch,track,item:r.item_id,evidence:locate(p,r.item_id),errors,row:r})}
}
for(const batch of [...new Set(all.map(x=>x.batch))]){const pairs={};for(const t of ['A','B']){const rr=all.filter(x=>x.batch===batch&&x.track===t);summary.push({batch,track:t,n:rr.length,empty:rr.filter(x=>!x.row.directly_observable.length).length,empty_with_direct:rr.filter(x=>!x.row.directly_observable.length&&x.row.links.some(l=>l.relevance==='direct')).length,invalid_rows:rr.filter(x=>observableErrors(x.row).length).length});pairs[t]=rr}
 for(const a of pairs.A){const b=pairs.B.find(b=>b.row.item_id===a.row.item_id);if(b)comparisons.push({batch,item:a.row.item_id,A:a.row.directly_observable,B:b.row.directly_observable,equal:JSON.stringify([...a.row.directly_observable].sort())===JSON.stringify([...b.row.directly_observable].sort()),evidence:[locate(a.file,a.row.item_id),locate(b.file,b.row.item_id)]})}
}
check('30 tracks including four derivative tracks',summary.length===30)
check('b15 final observable invariants clean',violations.filter(v=>v.batch==='b15-v24').length===0)
// Population comes from the pinned D1 inventory, not a prose total. No DB access.
const inv=json('docs/research/goal-data-batches/D1-source-audit/source-inventory.json'),examIds=new Set(inv.exams.filter(e=>e.group.startsWith('kice/')).map(e=>e.exam_id)),population=inv.items.filter(i=>examIds.has(i.exam_id))
const reasoning=read('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl').trim().split('\n').map(JSON.parse),done=new Set(reasoning.map(r=>r.item_id))
const selections=git('ls-tree','-r','--name-only','57b7e7006',doc).trim().split('\n').filter(p=>p.endsWith('-selection.json')).map(p=>({path:p,...json(p)})).filter(s=>!s.derived_from)
const excluded=new Map();for(const s of selections)for(const e of s.excluded??[])if(!done.has(e.item_id))excluded.set(e.item_id,{...e,path:s.path})
const gaps=population.filter(i=>!done.has(i.item_id)).map(i=>({...i,exclusion:excluded.get(i.item_id)??null,covered_exam:reasoning.some(r=>r.exam_id===i.exam_id)}))
const coverage={population:population.length,covered:done.size,exams:[...new Set(reasoning.map(r=>r.exam_id))],excluded:gaps.filter(g=>g.exclusion).length,unrecorded:gaps.filter(g=>!g.exclusion).length,covered_exam_unrecorded:gaps.filter(g=>g.covered_exam&&!g.exclusion).map(g=>g.item_id),outside_exam:gaps.filter(g=>!g.covered_exam).length,exam_totals:inv.exams.filter(e=>examIds.has(e.exam_id)&&e.reading_items).map(e=>({exam:e.exam_id,population:e.reading_items,covered:reasoning.filter(r=>r.exam_id===e.exam_id).length})),gaps}
check('population partition reconciles',coverage.population===802&&coverage.covered===506&&gaps.length===296&&coverage.excluded===16&&coverage.unrecorded===280)
check('no duplicate final item',reasoning.length===done.size)
const selection=json(doc+'b15-v24-selection.json');check('b15 own frame exhaustive',selection.items.length+selection.excluded.length===56&&new Set([...selection.items,...selection.excluded].map(i=>i.item_id)).size===56)
check('b15 excluded 26 previously judged and 2 charts',selection.excluded.filter(e=>e.reason.startsWith('이미 판정')).length===26&&selection.excluded.filter(e=>e.reason.includes('도표')).length===2)
const b15input=json(base+'b15-v24/input.json')
for(const e of selection.excluded){const r=b15input.excluded_raw.find(r=>r.item_id===e.item_id),s=r?.source;const canonical=s?Object.fromEntries(Object.entries(s).filter(([k])=>k!=='body_ok')):null
 check('b15 excluded snapshot '+e.item_id,!!s&&hash(canonical)===e.snapshot.source_sha256&&hash(s.passage)===e.snapshot.passage_sha256&&r.type_id===e.snapshot.type_id&&s.body_ok===e.snapshot.body_ok&&Array.isArray(s.choices)===e.snapshot.choices_is_array&&s.choices.length===e.snapshot.choices_count&&!!(s.answers?.length||s.answer!=null)===e.snapshot.has_answer)
}
const promptManifest=json(base+'b15-v24/prompts/manifest.json')
for(const r of promptManifest.runs)check('b14 prompt identical except batch '+r.label,read(r.prompt_file).replaceAll('b15-v24','b14-v24')===read(r.prompt_file.replaceAll('b15-v24','b14-v24')))
const unexplained=[]
for(const x of all.filter(x=>['b13-v24','b14-v24','b15-v24'].includes(x.batch)&&!x.row.directly_observable.length))for(const l of x.row.links.filter(l=>l.relevance==='direct'))if(!x.row.not_observable.some(n=>n.task_id===l.task_id))unexplained.push({batch:x.batch,track:x.track,item:x.row.item_id,task:l.task_id,evidence:locate(x.file,x.row.item_id)})
check('b15 empty direct reasons fully accounted',unexplained.filter(x=>x.batch==='b15-v24').length===0)
const shipped=await execute('scripts/research/goal-data/d2-validate.check.mjs');check('shipped validator counterexamples',(!shipped.error||shipped.error==='EXIT 0')&&shipped.logs.every(x=>!x.includes('FAIL')),shipped.logs)
const diff=JSON.parse(fs.readFileSync(out+'diff.local.json','utf8')).diff
const diffFiles=[...diff.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map(m=>m[1]);check('entire pinned diff captured',diffFiles.length===15)
fs.writeFileSync(out+'observability.local.json',JSON.stringify({checks,summary,chunkSummary,violations,comparisons,unexplained,coverage,diffFiles,shipped},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),summary,violations:violations.map(({row,...x})=>x),coverage:{...coverage,gaps:undefined},b15:comparisons.filter(c=>c.batch==='b15-v24'&&!c.equal)},null,2))
