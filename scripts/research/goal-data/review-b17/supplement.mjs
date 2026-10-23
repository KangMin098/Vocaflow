// scripts/research/goal-data/review-b17/supplement.mjs
import fs from 'node:fs'
import {out,base,doc,old,rev,at,git,read,json,hash,check,checks,inp,tracks,history,snap,execute,locate} from './audit.mjs'
const m=json(base+'b17-v24/prompts/manifest.json'),template=at(m.template),body=template.slice(template.indexOf('\n---\n')+5).replace(/^\n+/,'')
check('current revised template SHA',hash(template)===m.template_sha256)
const rules={A:'입력의 prior_analysis_unverified 는 검증 전 참고용 — 원문으로 확인한다.',B:'원문만 · 눈가림 — 기존 분석 · DB · 다른 판정 파일을 찾아보거나 읽지 않는다.'}
for(const r of m.runs){const text=read(r.prompt_file);check(r.label+' prompt SHA',hash(text)===r.prompt_sha256);check(r.label+' input SHA',hash(read(base+'b17-v24/'+r.chunk+'.json'))===r.input_chunk_sha256);check(r.label+' prompt replay',text===body.replaceAll('{BATCH}','b17-v24').replaceAll('{TRACK}',r.track).replaceAll('{CHUNK}',r.chunk).replaceAll('{NN}',r.chunk.split('-').at(-1)).replaceAll('{LABEL}',r.label).replaceAll('{TRACK_RULE}',rules[r.track]))}
const prior=new Set(git('ls-tree','-r','--name-only',old,doc).trim().split('\n').filter(p=>p.endsWith('-selection.json')).flatMap(p=>JSON.parse(at(p,old)).items.map(i=>i.item_id)))
check('no previous selection overlap',inp.rows.every(r=>!prior.has(r.item_id)))
check('2018 27 + 2017 13 and exclusions 2',inp.rows.filter(r=>r.exam_id==='2018').length===27&&inp.rows.filter(r=>r.exam_id==='2017').length===13&&json(doc+'b17-v24-selection.json').excluded.length===2)
for(const p of ['d2-run.mjs','d2-validate.mjs','d2-validate.check.mjs'])check(p+' unchanged since 8980aaa59',at('scripts/research/goal-data/'+p)===at('scripts/research/goal-data/'+p,old))
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const diffFields=(a,b,p='')=>{if(equal(a,b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return [{field:p,before:a,after:b}];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diffFields(a[k],b[k],p?p+'.'+k:k))}
const changes=[]
for(const t of ['A-01','A-02','B-01','B-02']){
 const p=Object.keys(snap.files).find(p=>p.includes('b17-v24-'+t+'-first/')&&p.endsWith('chunk-'+t+'.out.json')),first=json(p).rows,final=json(base+'b17-v24/chunk-'+t+'.out.json').rows
 for(const row of final){const prev=first.find(x=>x.item_id===row.item_id);const fields=diffFields(prev,row);if(fields.length)changes.push({label:t,item:row.item_id,first:locate(p,row.item_id),final:locate(base+'b17-v24/chunk-'+t+'.out.json',row.item_id),added:!prev,fields})}
}
const transcripts=JSON.parse(fs.readFileSync(out+'transcripts.local.json'))
check('four actual first prompts equal',transcripts.length===4&&transcripts.every(t=>t.prompt_equal))
const exposure=[],assembly=[]
for(const s of transcripts){const own=new Set(json(base+'b17-v24/chunk-'+s.label+'.json').items.map(i=>i.item_id)),foreign=inp.rows.map(r=>r.item_id).filter(id=>!own.has(id)),uses=new Map(s.tools.filter(t=>t.type==='tool_use').map(t=>[t.id,t]));for(const t of s.tools){if(t.type==='tool_use'&&t.name==='Write'&&t.input.file_path.includes('scratchpad'))assembly.push({label:s.label,line:t.line,path:t.input.file_path,content:t.input.content});if(t.type==='tool_result'){const u=uses.get(t.tool_use_id);if(u?.input?.command?.includes('d2-run.mjs b17-v24 validate')){const ids=foreign.filter(id=>JSON.stringify(t.content).includes(id));exposure.push({label:s.label,line:t.line,foreign_ids:ids,content:t.content})}}}}
check('no foreign id in observed chunk validation results',exposure.every(r=>r.foreign_ids.length===0),exposure.map(({content,...r})=>r))
const artifacts=[]
for(const p of git('diff','--name-only',old,rev).trim().split('\n')){let before='';try{before=at(p,old)}catch{};const after=at(p);if(p.endsWith('.jsonl')){const a=after.trim().split('\n').map(JSON.parse),b=before.trim()?before.trim().split('\n').map(JSON.parse):[],as=new Set(a.map(hash)),bs=new Set(b.map(hash)),added=a.filter(r=>!bs.has(hash(r))),removed=b.filter(r=>!as.has(hash(r)));check('append only '+p,removed.length===0);artifacts.push({path:p,added,removed})}else artifacts.push({path:p,before,after})}
const jl=p=>read(p).trim().split('\n').map(JSON.parse),r=jl('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl'),d=jl('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl'),links=jl(doc+'item-task-links.jsonl'),disputes=jl(doc+'disputed-links.jsonl'),g=json('docs/research/goal-data-batches/D3-principles/principle-groups.json')
const totals={items:r.length,items_source_gap:r.filter(r=>r.evidence!=='source_text').length,primary_task_agree:r.filter(r=>r.primary_task.agree).length,same_decision_locus:r.filter(r=>r.decision_path.same_locus).length,wrong_options:d.length,distortion_agree:d.filter(r=>r.distortion.agree).length,distortion_agree_source_text:d.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length,wrong_options_source_text:d.filter(r=>r.evidence==='source_text').length}
check('D3 all totals',Object.entries(totals).every(([k,v])=>g.totals[k]===v),totals)
check('cumulative 586/1371/509',r.length===586&&links.length===1371&&disputes.length===509)
check('b17 78/16/40/160',links.filter(r=>r.batch==='b17-v24').length===78&&disputes.filter(r=>r.batch==='b17-v24').length===16&&r.filter(r=>r.batch==='b17-v24').length===40&&d.filter(r=>r.batch==='b17-v24').length===160)
check('unknown public relevance',links.concat(disputes).every(r=>r.relevance==='unknown'))
const mood=[]
for(const b of ['b13-v24','b14-v24','b15-v24','b17-v24']){const input=json(base+b+'/input.json');for(const i of input.rows.filter(i=>i.type_id==='R-MOOD')){const js=Object.fromEntries(['A','B'].map(t=>[t,[1,2].flatMap(n=>json(base+b+`/chunk-${t}-0${n}.out.json`).rows).find(r=>r.item_id===i.item_id)]));mood.push({batch:b,item:i.item_id,primary:{A:js.A.primary_task,B:js.B.primary_task},input:locate(base+b+'/input.json',i.item_id),judgments:js})}}
check('historic mood A/B primary disagreement only observed in b17 among named batches',mood.filter(m=>m.primary.A!==m.primary.B).length===2&&mood.filter(m=>m.primary.A!==m.primary.B).every(m=>m.batch==='b17-v24'))
const r6=inp.rows.filter(i=>tracks.A.find(r=>r.item_id===i.item_id).links.some(l=>l.task_id==='r.inference'&&l.relevance==='direct')&&tracks.B.find(r=>r.item_id===i.item_id).links.some(l=>l.task_id==='r.inference'&&l.relevance==='direct')).map(i=>i.item_id)
check('R6 jointly direct exactly 3',r6.length===3,r6)
for(const b of [...new Set(Object.keys(snap.files).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))]){const r=await execute('scripts/research/goal-data/d2-run.mjs',[b,'validate']);check(b+' final regression',r.error==='EXIT 0',r.logs)}
const regression=JSON.parse(fs.readFileSync(out+'regression.local.json'));check('shipped regressions actual isolated process 32/32',regression.pass,regression.stdout)
check('local packets unchanged',Object.entries(snap.files).every(([p,v])=>fs.readFileSync('D:/workspace/Vocaflow-goal-data/'+p,'utf8')===v))
fs.writeFileSync(out+'supplement.local.json',JSON.stringify({checks,changes,exposure,assembly,artifacts,totals,transcripts,mood,r6},null,2))
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),changes:changes.map(({fields,...r})=>({...r,fields:fields.map(f=>f.field)})),mood:mood.map(({judgments,...m})=>m),r6},null,2))
