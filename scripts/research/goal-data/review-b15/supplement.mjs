// scripts/research/goal-data/review-b15/supplement.mjs
import fs from 'node:fs'
import path from 'node:path'
import {root,rev,old,out,doc,base,at,git,read,json,hash,snap,execute,checks,check,inp,tracks,history,locate,primary,per,overall} from './audit.mjs'
let lib=at('scripts/csat/map/v62/data/pilot-lib.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'').replace(/const ROOT = .*\r?\n/,`const ROOT = ${JSON.stringify(root)};\n`)
const pilot=new Function('fs','path',lib+'\nreturn {nonHeldTasks,validateChunk,validateRow};')({readFileSync:p=>read(path.relative(root,String(p)).replaceAll('\\','/'))},path)
const code=at('scripts/research/goal-data/d2-validate.mjs').replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
const make=new Function('validateChunk','validateRow',code+'\nreturn makeValidator;')(pilot.validateChunk,pilot.validateRow)
const ts=pilot.nonHeldTasks().filter(t=>inp.tasks.includes(t.id)),v24=make(inp,ts),v25=make({...inp,contract:'v2.5'},ts)
const traceRows=['A','B'].flatMap(t=>tracks[t].map(r=>({track:t,item:r.item_id,primary:r.primary_task,reason:r.primary_reason,v24_errors:v24.row(r),v25_errors:v25.row(r),evidence:locate(base+`b15-v24/chunk-${t}-0${tracks[t].findIndex(a=>a.item_id===r.item_id)<20?1:2}.out.json`,r.item_id)})))
check('56 final rows v24',traceRows.length===56&&traceRows.every(r=>!r.v24_errors.length))
const firstRows=['A','B'].flatMap(t=>[1,2].flatMap(n=>{const suffix=`chunk-${t}-0${n}.out.json`;const p=Object.keys(snap.files).find(p=>p.startsWith(base+'b15-v24/history/')&&p.includes(`b15-v24-${t}-0${n}-first/`)&&p.endsWith(suffix));return json(p).rows.map(r=>({track:t,item:r.item_id,primary:r.primary_task,reason:r.primary_reason,v24_errors:v24.row(r),v25_errors:v25.row(r),evidence:locate(p,r.item_id)}))}))
check('first 56 rows: no v25-only accepted structure',firstRows.length===56&&firstRows.every(r=>!r.v24_errors.length||r.v25_errors.length>0), firstRows.filter(r=>r.v24_errors.length))
const firstChanges=history.flatMap(h=>h.changes.map(c=>({path:h.path,item:c.item,fields:[...new Set([...Object.keys(c.before),...Object.keys(c.after)])].filter(k=>JSON.stringify(c.before[k])!==JSON.stringify(c.after[k])),before:c.before,after:c.after})))
check('history primary and decision paths unchanged',firstChanges.every(c=>!c.fields.some(f=>['primary_task','main_performance_outside_subset','decision_path'].includes(f))))
check('all changed links preserve relevance',firstChanges.filter(c=>c.fields.includes('links')).every(c=>c.before.links.every(l=>l.relevance===c.after.links.find(x=>x.task_id===l.task_id).relevance)))
const guard=null
const manifest=json(base+'b15-v24/prompts/manifest.json'),tpl=read(manifest.template),body=tpl.slice(tpl.indexOf('\n---\n')+5).replace(/^\n+/,'')
check('template hash',hash(tpl)===manifest.template_sha256)
const rules={A:'입력의 prior_analysis_unverified 는 검증 전 참고용 — 원문으로 확인한다.',B:'원문만 · 눈가림 — 기존 분석 · DB · 다른 판정 파일을 찾아보거나 읽지 않는다.'}
const normalized=[]
for(const r of manifest.runs){const text=read(r.prompt_file),chunk=base+'b15-v24/'+r.chunk+'.json';check(r.label+' prompt hash',hash(text)===r.prompt_sha256);check(r.label+' input hash',hash(read(chunk))===r.input_chunk_sha256);const expected=body.replaceAll('{BATCH}','b15-v24').replaceAll('{TRACK}',r.track).replaceAll('{CHUNK}',r.chunk).replaceAll('{LABEL}',r.label).replaceAll('{TRACK_RULE}',rules[r.track]);check(r.label+' template substitutions only',text===expected);check(r.label+' v25 prohibition',text.includes('CONTRACT_V2_5.md · V2_5_* · prereg-* · v2_5-* 파일은 열지 않는다')&&r.forbidden_inputs[0].includes('V2_5_*'));normalized.push(text.replaceAll(r.label,'{LABEL}').replaceAll(r.chunk,'{CHUNK}').replaceAll(rules[r.track],'{TRACK_RULE}').replaceAll('트랙 '+r.track,'트랙 {TRACK}').replaceAll('validate '+r.track,'validate {TRACK}'))}
check('four prompt bodies normalized equal',normalized.length===4&&normalized.every(s=>s===normalized[0]))
const regenerated=await execute('scripts/research/goal-data/mk-prompts.mjs',['b15-v24'])
check('generator refuses existing manifest',regenerated.error?.includes('manifest.json')&&Object.keys(regenerated.writes).length===0,regenerated.error)
const generated=await execute('scripts/research/goal-data/mk-prompts.mjs',['b15-v24'],{[base+'b15-v24/prompts/manifest.json']:null});
// Replay with the manifest hidden, never touching the input filesystem.
for(const r of manifest.runs)check('generator reproduces '+r.label,generated.writes[r.prompt_file]===read(r.prompt_file))
const prior=new Set();for(const p of git('ls-tree','-r','--name-only',old,doc).trim().split('\n').filter(p=>p.endsWith('-selection.json')))for(const i of JSON.parse(at(p,old)).items)prior.add(i.item_id)
for(const i of JSON.parse(at('docs/csat-learner/v62/data-expansion/pilot-selection.json')).items)prior.add(i.item_id)
check('no previously selected item',inp.rows.every(r=>!prior.has(r.item_id)))
check('1 M2109 and 27 M2106',inp.rows.filter(r=>r.exam_id==='M2109').length===1&&inp.rows.filter(r=>r.exam_id==='M2106').length===27)
const selection=json(doc+'b15-v24-selection.json')
check('28 exclusions',selection.excluded.length===28,selection.excluded)
const diffDetails=git('diff','--name-only',old,rev).trim().split('\n').map(p=>{const after=at(p);let before='';try{before=at(p,old)}catch{};if(p.endsWith('.jsonl')){const a=after.trim().split('\n').map(JSON.parse),b=before.trim()?before.trim().split('\n').map(JSON.parse):[],bs=new Set(b.map(hash)),as=new Set(a.map(hash));return {path:p,added:a.filter(r=>!bs.has(hash(r))),removed:b.filter(r=>!as.has(hash(r)))}}return {path:p,before,after}})
check('append only JSONL',diffDetails.filter(d=>d.path.endsWith('.jsonl')).every(d=>!d.removed.length))
const reasoning=jsonLines('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl'),distortions=jsonLines('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl'),groups=json('docs/research/goal-data-batches/D3-principles/principle-groups.json')
function jsonLines(p){return read(p).trim().split('\n').map(JSON.parse)}
const recalculated={items:reasoning.length,items_source_gap:reasoning.filter(r=>r.evidence!=='source_text').length,primary_task_agree:reasoning.filter(r=>r.primary_task.agree).length,same_decision_locus:reasoning.filter(r=>r.decision_path.same_locus).length,wrong_options:distortions.length,distortion_agree:distortions.filter(r=>r.distortion.agree).length,distortion_agree_source_text:distortions.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length,wrong_options_source_text:distortions.filter(r=>r.evidence==='source_text').length}
check('all D3 totals recalculated',Object.entries(recalculated).every(([k,v])=>groups.totals[k]===v),recalculated)
check('D3 appended 28/112',reasoning.filter(r=>r.batch==='b15-v24').length===28&&distortions.filter(r=>r.batch==='b15-v24').length===112)
for(const row of reasoning.filter(r=>r.batch==='b15-v24')){const a=tracks.A.find(r=>r.item_id===row.item_id),b=tracks.B.find(r=>r.item_id===row.item_id);check('D3 binds '+row.item_id,row.source_sha256===a.source_sha256&&row.source_sha256===b.source_sha256&&row.primary_task.A===a.primary_task&&row.primary_task.B===b.primary_task)}
const allLinks=jsonLines(doc+'item-task-links.jsonl'),allDisputes=jsonLines(doc+'disputed-links.jsonl')
check('combined R1 1212 / disputes 480',allLinks.length===1212&&allDisputes.length===480)
check('public relevance unknown',allLinks.concat(allDisputes).every(r=>r.relevance==='unknown'))
fs.writeFileSync(out+'supplement.local.json',JSON.stringify({rev,firstRows,traceRows,firstChanges,guard,manifest,diffDetails,commands:regenerated,checks},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),guard,firstChanges:firstChanges.map(c=>({path:c.path,item:c.item,fields:c.fields})),v25_final:traceRows.filter(r=>r.v25_errors.length),v25_first:firstRows.filter(r=>r.v25_errors.length)},null,2))
