// scripts/research/goal-data/review-b16/supplement.mjs
import fs from 'node:fs'
import vm from 'node:vm'
import {out,base,doc,old,rev,at,git,read,json,hash,check,checks,inp,tracks,history,snap,execute,locate} from './audit.mjs'
const manifest=json(base+'b16-v24/prompts/manifest.json'),template=at(manifest.template,old),body=template.slice(template.indexOf('\n---\n')+5).replace(/^\n+/,'')
check('b16 uses preserved pre-chunk-output template',hash(template)===manifest.template_sha256)
check('current template deliberately changed after b16',hash(at(manifest.template))!==manifest.template_sha256)
const rules={A:'입력의 prior_analysis_unverified 는 검증 전 참고용 — 원문으로 확인한다.',B:'원문만 · 눈가림 — 기존 분석 · DB · 다른 판정 파일을 찾아보거나 읽지 않는다.'}
for(const r of manifest.runs){const text=read(r.prompt_file);check(r.label+' prompt SHA',hash(text)===r.prompt_sha256);check(r.label+' input SHA',hash(read(base+'b16-v24/'+r.chunk+'.json'))===r.input_chunk_sha256);check(r.label+' historic template exact replay',text===body.replaceAll('{BATCH}','b16-v24').replaceAll('{TRACK}',r.track).replaceAll('{CHUNK}',r.chunk).replaceAll('{LABEL}',r.label).replaceAll('{TRACK_RULE}',rules[r.track]))}
const selections=git('ls-tree','-r','--name-only',old,doc).trim().split('\n').filter(p=>p.endsWith('-selection.json'))
const prior=new Set(selections.flatMap(p=>JSON.parse(at(p,old)).items.map(i=>i.item_id)))
check('no previous selection overlap',inp.rows.every(r=>!prior.has(r.item_id)))
check('27 of 2020 + 13 of 2019',inp.rows.filter(r=>r.exam_id==='2020').length===27&&inp.rows.filter(r=>r.exam_id==='2019').length===13)
const selection=json(doc+'b16-v24-selection.json')
check('two exclusions',selection.excluded.length===2,selection.excluded)
const first=history.filter(h=>{const file=h.path.split('/').at(-1),label=/chunk-([AB]-\d+)/.exec(file)[1];return h.path.includes('b16-v24-'+label+'-first/')})
check('four own first snapshots',first.length===4)
const changes=first.flatMap(h=>h.changes.map(c=>({path:h.path,item:c.item,fields:Object.keys(c.before).filter(k=>JSON.stringify(c.before[k])!==JSON.stringify(c.after[k])),before:c.before,after:c.after})))
check('all snapshot links/primary preserved',changes.every(c=>!c.fields.includes('links')&&!c.fields.includes('primary_task')))
const transcripts=JSON.parse(fs.readFileSync(out+'transcript-summary.local.json'))
check('four first user prompts equal preserved prompts',transcripts.length===4&&transcripts.every(t=>t.prompt_equal))
const b02=transcripts.find(t=>t.label==='B-02'),command=b02.tools.find(t=>t.type==='tool_use'&&t.input?.command?.includes('// b16-v24-B-02: remove')).input.command
const script=command.split("<<'EOF'\n")[1].split('\nEOF')[0]
const b02first=first.find(h=>h.path.endsWith('chunk-B-02.out.json')),before=json(b02first.path),writes={}
const context=vm.createContext({process:{argv:['node','dedup','memory']}})
const module=new vm.SourceTextModule(script,{context})
await module.link(async()=>{const m=new vm.SyntheticModule(['default'],function(){this.setExport('default',{readFileSync:()=>JSON.stringify(before),writeFileSync:(_,v)=>writes.result=v})},{context});return m})
await module.evaluate()
const cleaned=JSON.parse(writes.result),dedup=before.rows.map((r,i)=>({item:r.item_id,fields:Object.keys(r).filter(k=>JSON.stringify(r[k])!==JSON.stringify(cleaned.rows[i][k])),removed:r.not_observable.filter(n=>!cleaned.rows[i].not_observable.some(x=>x.task_id===n.task_id)).map(n=>n.task_id)}))
check('actual dedup script only changes not_observable',dedup.every(r=>r.fields.every(f=>f==='not_observable')))
check('dedup removes only intersection',before.rows.every((r,i)=>JSON.stringify(cleaned.rows[i].not_observable)===JSON.stringify(r.not_observable.filter(n=>!r.directly_observable.includes(n.task_id)))))
check('dedup preserves links primary and all other fields',before.rows.every((r,i)=>Object.keys(r).filter(k=>k!=='not_observable').every(k=>JSON.stringify(r[k])===JSON.stringify(cleaned.rows[i][k]))))
const rewrites=changes.filter(c=>c.fields.includes('not_observable')).map(c=>({item:c.item,path:c.path,entries:c.after.not_observable.filter(n=>c.before.not_observable.some(b=>b.task_id===n.task_id&&b.why!==n.why))}))
const exposures=[]
for(const s of transcripts){const ownIds=new Set(json(base+'b16-v24/chunk-'+s.label+'.json').items.map(i=>i.item_id)),foreignIds=inp.rows.map(r=>r.item_id).filter(i=>!ownIds.has(i));const tools=s.tools.filter(t=>t.type==='tool_use'),uses=new Map(tools.map(t=>[t.id,t]));for(const t of s.tools.filter(t=>t.type==='tool_result')){const u=uses.get(t.tool_use_id);if(!u?.input?.command?.includes('d2-run.mjs b16-v24 validate'))continue;const text=JSON.stringify(t.content),ids=foreignIds.filter(id=>text.includes(id));if(ids.length)exposures.push({label:s.label,path:s.path,line:t.line,foreign_ids:ids})}}
check('observed same-track foreign chunk ids in all four analysts',new Set(exposures.map(e=>e.label)).size===4,exposures)
const jl=p=>read(p).trim().split('\n').map(JSON.parse),diff=[]
for(const p of git('diff','--name-only',old,rev).trim().split('\n')){const after=at(p);let before='';try{before=at(p,old)}catch{};if(p.endsWith('.jsonl')){const a=after.trim().split('\n').map(JSON.parse),b=before.trim()?before.trim().split('\n').map(JSON.parse):[],as=new Set(a.map(hash)),bs=new Set(b.map(hash));const removed=b.filter(r=>!as.has(hash(r))),added=a.filter(r=>!bs.has(hash(r)));check('append only '+p,removed.length===0);diff.push({path:p,added,removed})}else diff.push({path:p,before,after})}
const links=jl(doc+'item-task-links.jsonl'),disputes=jl(doc+'disputed-links.jsonl'),reasoning=jl('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl'),distortions=jl('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl'),groups=json('docs/research/goal-data-batches/D3-principles/principle-groups.json')
check('combined counts 1293/493/546',links.length===1293&&disputes.length===493&&reasoning.length===546)
check('b16 81/13/40/160',links.filter(r=>r.batch==='b16-v24').length===81&&disputes.filter(r=>r.batch==='b16-v24').length===13&&reasoning.filter(r=>r.batch==='b16-v24').length===40&&distortions.filter(r=>r.batch==='b16-v24').length===160)
check('unknown public relevance maintained',links.concat(disputes).every(r=>r.relevance==='unknown'))
const totals={items:reasoning.length,items_source_gap:reasoning.filter(r=>r.evidence!=='source_text').length,primary_task_agree:reasoning.filter(r=>r.primary_task.agree).length,same_decision_locus:reasoning.filter(r=>r.decision_path.same_locus).length,wrong_options:distortions.length,distortion_agree:distortions.filter(r=>r.distortion.agree).length,distortion_agree_source_text:distortions.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length,wrong_options_source_text:distortions.filter(r=>r.evidence==='source_text').length}
check('all D3 totals recomputed',Object.entries(totals).every(([k,v])=>groups.totals[k]===v),totals)
const citations=changes.map(c=>({item:c.item,path:locate(c.path,c.item),final:locate(base+'b16-v24/'+c.path.split('/').at(-1),c.item),fields:c.fields}))
fs.writeFileSync(out+'supplement.local.json',JSON.stringify({checks,manifest,first,changes,dedup,rewrites,exposures,transcripts,diff,totals,citations},null,2)+'\n')
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),changed:citations,dedup_removed:dedup.filter(r=>r.removed.length).length,exposures},null,2))
