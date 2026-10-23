// scripts/research/goal-data/review-b20/supplement.mjs
import fs from 'node:fs'
import {out,base,doc,old,at,git,read,json,hash,check,checks,inp,tracks,snap,execute,per,overall,primary} from './audit.mjs'
const m=json(base+'b20-v24/prompts/manifest.json'),template=at(m.template),body=template.slice(template.indexOf('\n---\n')+5).replace(/^\n+/,'')
check('template SHA',hash(template)===m.template_sha256)
const rules={A:'입력의 prior_analysis_unverified 는 검증 전 참고용 — 원문으로 확인한다.',B:'원문만 · 눈가림 — 기존 분석 · DB · 다른 판정 파일을 찾아보거나 읽지 않는다.'}
for(const r of m.runs){const text=read(r.prompt_file);check(r.label+' prompt SHA',hash(text)===r.prompt_sha256);check(r.label+' chunk SHA',hash(read(base+'b20-v24/'+r.chunk+'.json'))===r.input_chunk_sha256);check(r.label+' template replay',text===body.replaceAll('{BATCH}','b20-v24').replaceAll('{TRACK}',r.track).replaceAll('{CHUNK}',r.chunk).replaceAll('{NN}',r.chunk.split('-').at(-1)).replaceAll('{LABEL}',r.label).replaceAll('{TRACK_RULE}',rules[r.track]))}
const prior=new Set(git('ls-tree','-r','--name-only',old,doc).trim().split('\n').filter(p=>p.endsWith('-selection.json')).flatMap(p=>JSON.parse(at(p,old)).items.map(i=>i.item_id)))
check('no prior overlap',inp.rows.every(r=>!prior.has(r.item_id)))
check('2014B20 M1809 20 excluded9',inp.rows.filter(r=>r.exam_id==='2014B').length===20&&inp.rows.filter(r=>r.exam_id==='M1809').length===20&&json(doc+'b20-v24-selection.json').excluded.length===9)
for(const p of ['d2-run.mjs','d2-validate.mjs','d2-validate.check.mjs'])check(p+' @8980aaa59',at('scripts/research/goal-data/'+p)===at('scripts/research/goal-data/'+p,'8980aaa59'))
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),fields=(a,b,p='')=>equal(a,b)?[]:!a||!b||typeof a!=='object'||typeof b!=='object'?[{field:p,before:a,after:b}]:[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>fields(a[k],b[k],p?p+'.'+k:k))
const changes=[]
for(const t of ['A-01','A-02','B-01','B-02']){
 const p=Object.keys(snap.files).find(p=>p.includes('b20-v24-'+t+'-first/')&&p.endsWith('chunk-'+t+'.out.json')),first=json(p).rows,final=json(base+'b20-v24/chunk-'+t+'.out.json').rows
 for(const row of final){const f=fields(first.find(x=>x.item_id===row.item_id),row);if(f.length)changes.push({label:t,item:row.item_id,fields:f})}
}
const artifacts=[]
for(const p of git('diff','--name-only',old,'00eed70e2b8e6b9195c9b9a6f52f45c1af7f8d33').trim().split('\n')){let before='';try{before=at(p,old)}catch{};const after=at(p);if(p.endsWith('.jsonl')){const a=after.trim().split('\n').map(JSON.parse),b=before.trim()?before.trim().split('\n').map(JSON.parse):[],bs=new Set(b.map(hash)),as=new Set(a.map(hash)),added=a.filter(r=>!bs.has(hash(r))),removed=b.filter(r=>!as.has(hash(r)));check('append only '+p,removed.length===0);artifacts.push({path:p,added,removed})}else artifacts.push({path:p,before,after})}
const jl=p=>read(p).trim().split('\n').map(JSON.parse),r=jl('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl'),d=jl('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl'),links=jl(doc+'item-task-links.jsonl'),disputes=jl(doc+'disputed-links.jsonl'),g=json('docs/research/goal-data-batches/D3-principles/principle-groups.json')
const totals={items:r.length,items_source_gap:r.filter(r=>r.evidence!=='source_text').length,primary_task_agree:r.filter(r=>r.primary_task.agree).length,same_decision_locus:r.filter(r=>r.decision_path.same_locus).length,wrong_options:d.length,distortion_agree:d.filter(r=>r.distortion.agree).length,distortion_agree_source_text:d.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length,wrong_options_source_text:d.filter(r=>r.evidence==='source_text').length}
check('D3 totals',Object.entries(totals).every(([k,v])=>g.totals[k]===v),totals)
check('cumulative 706/1610/563',r.length===706&&links.length===1610&&disputes.length===563)
check('new 82/19/40/160',links.filter(r=>r.batch==='b20-v24').length===82&&disputes.filter(r=>r.batch==='b20-v24').length===19&&r.filter(r=>r.batch==='b20-v24').length===40&&d.filter(r=>r.batch==='b20-v24').length===160)
check('unknown relevance',links.concat(disputes).every(r=>r.relevance==='unknown'))
for(const b of [...new Set(Object.keys(snap.files).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))]){const res=await execute('scripts/research/goal-data/d2-run.mjs',[b,'validate']);check(b+' regression',res.error==='EXIT 0',res.logs)}
const re=JSON.parse(fs.readFileSync(out+'regression.local.json'));check('isolated 32/32',re.pass)
check('owner packets unchanged',Object.entries(snap.files).every(([p,v])=>fs.readFileSync('D:/workspace/Vocaflow-goal-data/'+p,'utf8')===v))
fs.writeFileSync(out+'supplement.local.json',JSON.stringify({checks,changes,artifacts,totals,overall,per,primary},null,2))
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),changes:changes.map(r=>({...r,fields:r.fields.map(f=>f.field)})),totals,overall,per},null,2))
