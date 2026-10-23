// scripts/research/goal-data/review-b16/verify-diff.mjs
import fs from 'node:fs'
import {out,doc,base,read,json,hash,at,old,execute,check,checks,tracks,inp,locate} from './audit.mjs'

const jl=p=>read(p).trim().split('\n').map(JSON.parse)
const equal=(a,b)=>{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const k=Object.keys(a);return k.length===Object.keys(b).length&&k.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]))}
const r=jl('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl'),d=jl('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl'),g=json('docs/research/goal-data-batches/D3-principles/principle-groups.json')
for(const row of r.filter(x=>x.batch==='b16-v24')){
 const a=tracks.A.find(x=>x.item_id===row.item_id),b=tracks.B.find(x=>x.item_id===row.item_id)
 check('D3 full reasoning binding '+row.item_id,equal(row.answer_logic,{A:a.answer_logic.why,B:b.answer_logic.why})&&equal(row.passage_structure,{A:a.passage_structure,B:b.passage_structure})&&equal(row.stem_demand,{A:a.stem_demand,B:b.stem_demand})&&row.decision_path.A===a.decision_path.summary&&row.decision_path.B===b.decision_path.summary&&row.decision_path.locus_sha256.A===hash(a.decision_path.quote)&&row.decision_path.locus_sha256.B===hash(b.decision_path.quote))
}
for(const row of d.filter(x=>x.batch==='b16-v24')){
 const [a,b]=['A','B'].map(t=>tracks[t].find(x=>x.item_id===row.item_id).distractors.find(x=>x.choice===row.choice))
 check('D3 distractor binding '+row.item_id+'/'+row.choice,equal(row.distortion,{A:a.distortion_type,B:b.distortion_type,agree:a.distortion_type===b.distortion_type})&&equal(row.design,{A:a.design,B:b.design})&&equal(row.why,{A:a.why,B:b.why}))
}
const groups={}
for(const x of d.filter(x=>x.evidence==='source_text')){const v=groups[x.type_id]??={items:new Set(),options:0,agree:0,distortions:{}};v.items.add(x.batch+':'+x.item_id);v.options++;if(x.distortion.agree){v.agree++;v.distortions[x.distortion.A]=(v.distortions[x.distortion.A]??0)+1}}
for(const [t,v]of Object.entries(groups)){const p={};for(const x of r.filter(x=>x.type_id===t&&x.evidence==='source_text')){const k=x.primary_task.agree?x.primary_task.A:x.primary_task.A+'|'+x.primary_task.B;p[k]=(p[k]??0)+1}check('D3 all group fields '+t,equal(g.groups[t],{items:v.items.size,wrong_options:v.options,distortion_agreement:Number((v.agree/v.options).toFixed(3)),agreed_distortions:v.distortions,primary_task_pairs:p,small_sample:v.items.size<5}))}
const cov=json(doc+'mapping-coverage.json'),links=jl(doc+'item-task-links.jsonl'),disputes=jl(doc+'disputed-links.jsonl')
check('coverage scope recomputed',cov.scope.items===new Set(r.map(x=>x.item_id)).size&&equal([...cov.scope.exams].sort(),[...new Set(r.map(x=>x.exam_id))].sort())&&cov.scope.r1_links===links.length&&cov.scope.disputed===disputes.length)
for(const [t,v]of Object.entries(cov.per_task)){const ls=links.filter(x=>x.task===t),ds=disputes.filter(x=>x.task===t);check('coverage links '+t,equal([...v.r1_direct_items].sort(),ls.filter(x=>x.candidateRelevance==='direct').map(x=>x.item).sort())&&v.r1_indirect_items===ls.filter(x=>x.candidateRelevance==='indirect').length&&v.disputed===ds.length)}
check('b12 ambiguity explicitly unresolved',read(doc+'mapping-review.md').includes('미확정**으로 둔다')&&read(doc+'mapping-review.md').includes('고유 · 영구 모호함'))
const extra=[]
fs.writeFileSync(out+'extra.local.json',JSON.stringify({checks,extra},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.pass)},null,2))
