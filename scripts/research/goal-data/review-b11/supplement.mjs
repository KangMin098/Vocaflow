// scripts/research/goal-data/review-b11/supplement.mjs
import fs from 'node:fs'
import path from 'node:path'
import {root,rev,old,out,doc,base,at,git,read,json,hash,snap,execute,checks,check,inp,tracks,history,locate,primary,per,overall} from './audit.mjs'
let lib=at('scripts/csat/map/v62/data/pilot-lib.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'').replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`)
const vfs={readFileSync:p=>read(path.relative(root,String(p)).replaceAll('\\','/'))}
const pilot=new Function('fs','path',lib+'\nreturn {nonHeldTasks,validateChunk,validateRow};')(vfs,path)
const code=at('scripts/research/goal-data/d2-validate.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
const make=new Function('validateChunk','validateRow',code+'\nreturn makeValidator;')(pilot.validateChunk,pilot.validateRow)
const ts=pilot.nonHeldTasks().filter(t=>inp.tasks.includes(t.id)),v24=make(inp,ts),v25=make({...inp,contract:'v2.5'},ts)
const firstErrors=history.map(h=>({path:h.path,errors:json(h.path).rows.flatMap(r=>v24.row(r).map(error=>({item:r.item_id,error})))}))
const row19=history[0].changes.find(c=>c.item==='M2309#19').before
const nullProbe={item:row19.item_id,v24:v24.row(row19),v25:v25.row(row19)}
check('B19 original v25 compatible but not v24',nullProbe.v24.some(e=>e.startsWith('주 TASK '))&&!nullProbe.v25.length,nullProbe)
const e1Probes=tracks.A.filter(r=>['R-FACT','R-NOTICE','X-FACT'].includes(inp.rows.find(i=>i.item_id===r.item_id).type_id)&&r.links.some(l=>l.task_id==='e.task_demand'&&l.relevance==='direct')).map(r=>{const p=structuredClone(r);p.primary_task='e.task_demand';return {item:r.item_id,v24:v24.row(p),v25:v25.row(p)}})
check('v24 does not prohibit E1 primary',e1Probes.every(p=>!p.v24.some(e=>e.includes('v2.5'))&&p.v25.some(e=>e.includes('v2.5'))),e1Probes)
const fixture=tracks.B.find(r=>r.item_id==='M2309#41'),source=inp.rows.find(r=>r.item_id===fixture.item_id)
const guardProbe=(answers,answer,choice)=>{const input=structuredClone(inp);const s=input.rows.find(r=>r.item_id===fixture.item_id).source;s.answers=answers;s.answer=answer;const r=structuredClone(fixture);r.distractors.push({...r.distractors[0],choice});return make(input,ts).row(r).filter(e=>e.startsWith('오답 목록에 정답'))}
const guardCases={single:guardProbe([3],3,3),fallback:guardProbe([],3,3),multiple:guardProbe([2,3],1,2),answers_precedence:guardProbe([3],1,1),valid_wrong:guardProbe([3],3,1)}
check('guard single/fallback/multiple/precedence/valid',guardCases.single.length===1&&guardCases.fallback.length===1&&guardCases.multiple.length>=1&&!guardCases.answers_precedence.length&&!guardCases.valid_wrong.length,guardCases)
const prior=new Set();for(const p of git('ls-tree','-r','--name-only',old,doc).trim().split('\n').filter(p=>p.endsWith('-selection.json')))for(const i of JSON.parse(at(p,old)).items)prior.add(i.item_id)
for(const i of JSON.parse(at('docs/csat-learner/v62/data-expansion/pilot-selection.json')).items)prior.add(i.item_id)
check('selection excludes all prior items',inp.rows.every(r=>!prior.has(r.item_id)))
const excluded=json(doc+'b11-v24-selection.json').excluded
check('excluded charts',excluded.every(e=>e.snapshot.type_id==='R-CHART'))
for(const e of excluded){const r=inp.excluded_raw.find(r=>r.item_id===e.item_id);const {body_ok,...s}=r.source;check(e.item_id+' excluded hashes',hash(s)===e.snapshot.source_sha256&&hash(s.passage)===e.snapshot.passage_sha256)}
const diffDetails=git('diff','--name-only',old,rev).trim().split('\n').map(p=>{const after=at(p);let before='';try{before=at(p,old)}catch{};if(p.endsWith('.jsonl')){const a=after.trim().split('\n').map(JSON.parse),b=before.trim()?before.trim().split('\n').map(JSON.parse):[],bs=new Set(b.map(hash)),as=new Set(a.map(hash));return {path:p,added:a.filter(r=>!bs.has(hash(r))),removed:b.filter(r=>!as.has(hash(r)))}}return {path:p,before,after}})
check('append only JSONL',diffDetails.filter(d=>d.path.endsWith('.jsonl')).every(d=>d.removed.length===0))
const firstChanges=history.flatMap(h=>h.changes.map(c=>({path:h.path,item:c.item,fields:[...new Set([...Object.keys(c.before),...Object.keys(c.after)])].filter(k=>JSON.stringify(c.before[k])!==JSON.stringify(c.after[k]))})))
check('history primary and link judgments preserved',firstChanges.every(c=>!c.fields.some(f=>['links','primary_task','primary_reason','main_performance_outside_subset','decision_path'].includes(f))))
const traceRows=['A','B'].flatMap(t=>tracks[t].map(r=>({track:t,item:r.item_id,primary:r.primary_task,reason:r.primary_reason,v24_errors:v24.row(r),v25_errors:v25.row(r),evidence:locate(base+`b11-v24/chunk-${t}-0${tracks[t].findIndex(a=>a.item_id===r.item_id)<20?1:2}.out.json`,r.item_id)})))
check('all 80 final rows v24',traceRows.length===80&&traceRows.every(r=>r.v24_errors.length===0))
const baselineFreeze=await execute('scripts/research/goal-data/prereg-freeze-check.mjs',[],Object.fromEntries([doc+'CONTRACT_V2_5.md','scripts/research/goal-data/d2-export.mjs','scripts/research/goal-data/d2-validate.mjs'].map(p=>[p,at(p,old)])))
check('freeze baseline restored 16/16',baselineFreeze.error==='EXIT 0'&&baselineFreeze.logs.filter(l=>l.startsWith('ok ')).length===16,baselineFreeze.logs)
fs.writeFileSync(out+'supplement.local.json',JSON.stringify({rev,firstErrors,nullProbe,e1Probes,guardCases,firstChanges,traceRows,diffDetails},null,2)+'\n')
fs.writeFileSync('docs/research/goal-data-batches/review-b11/checks.local.json',JSON.stringify({rev,checks},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),nullProbe,guardCases,firstErrors,firstChanges},null,2))

