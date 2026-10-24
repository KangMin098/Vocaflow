// scripts/research/goal-data/review-b21/supplement.mjs
import fs from 'node:fs'
import {out,base,doc,at,read,json,hash,check,checks,inp,tracks,snap,per,overall,primary} from './audit.mjs'
const m=json(base+'b21-v24/prompts/manifest.json'),tpl=at(m.template),body=tpl.slice(tpl.indexOf('\n---\n')+5).replace(/^\n+/,'')
check('template hash',hash(tpl)===m.template_sha256)
const rules={A:'입력의 prior_analysis_unverified 는 검증 전 참고용 — 원문으로 확인한다.',B:'원문만 · 눈가림 — 기존 분석 · DB · 다른 판정 파일을 찾아보거나 읽지 않는다.'}
for(const r of m.runs){check(r.label+' prompt hash',hash(read(r.prompt_file))===r.prompt_sha256);check(r.label+' chunk hash',hash(read(base+'b21-v24/'+r.chunk+'.json'))===r.input_chunk_sha256);check(r.label+' exact replay',read(r.prompt_file)===body.replaceAll('{BATCH}','b21-v24').replaceAll('{TRACK}',r.track).replaceAll('{CHUNK}',r.chunk).replaceAll('{NN}',r.chunk.split('-').at(-1)).replaceAll('{LABEL}',r.label).replaceAll('{TRACK_RULE}',rules[r.track]));const c=json(base+'b21-v24/'+r.chunk+'.json');if(r.track==='B')check(r.label+' blind packet',c.items.every(i=>!('prior_analysis_unverified'in i)&&!('prior_traps'in i)))}
const sel=json(doc+'b21-v24-selection.json');check('selection 9/7/24 exclusion41',inp.rows.filter(r=>r.exam_id==='2014A').length===9&&inp.rows.filter(r=>r.exam_id==='M1809').length===7&&inp.rows.filter(r=>r.exam_id==='M2006').length===24&&sel.excluded.length===41)
const fields=(a,b,p='')=>JSON.stringify(a)===JSON.stringify(b)?[]:!a||!b||typeof a!=='object'||typeof b!=='object'?[{field:p,before:a,after:b}]:[...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>fields(a[k],b[k],p?p+'.'+k:k))
const changes=[],hands=[]
for(const label of ['A-01','A-02','B-01','B-02']){
 const p=Object.keys(snap.files).find(p=>p.includes('b21-v24-'+label+'-first/')&&p.endsWith('chunk-'+label+'.out.json'));if(!p)throw Error('missing first '+label)
 const first=json(p).rows,final=json(base+'b21-v24/chunk-'+label+'.out.json').rows
 for(const row of final){const f=fields(first.find(x=>x.item_id===row.item_id),row);if(f.length)changes.push({label,item:row.item_id,fields:f})}
 const ps=Object.keys(snap.files).filter(p=>p.startsWith(base+'b21-v24/sources/'+label+'/')&&p.endsWith('.json'));const hand=ps.flatMap(p=>{const j=json(p);return Array.isArray(j)?j:Object.entries(j).map(([item_id,v])=>({item_id,...v}))})
 for(const h of hand){const f=final.find(r=>r.item_id===h.item_id);check(label+' hand fields '+h.item_id,Object.keys(h).every(k=>JSON.stringify(h[k])===JSON.stringify(f[k])))}
 hands.push({label,parts:ps,rows:hand.length,first:p,first_rows:first.length})
}
const jl=p=>read(p).trim().split('\n').map(JSON.parse),links=jl(doc+'item-task-links.jsonl'),disputes=jl(doc+'disputed-links.jsonl'),r=jl('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl'),d=jl('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl'),g=json('docs/research/goal-data-batches/D3-principles/principle-groups.json'),coverage=json(doc+'mapping-coverage.json')
const totals={items:r.length,items_source_gap:r.filter(r=>r.evidence!=='source_text').length,primary_task_agree:r.filter(r=>r.primary_task.agree).length,same_decision_locus:r.filter(r=>r.decision_path.same_locus).length,wrong_options:d.length,distortion_agree:d.filter(r=>r.distortion.agree).length,distortion_agree_source_text:d.filter(r=>r.evidence==='source_text'&&r.distortion.agree).length,wrong_options_source_text:d.filter(r=>r.evidence==='source_text').length}
check('D3 totals',Object.entries(totals).every(([k,v])=>g.totals[k]===v),totals)
check('combined 746/1685/580',r.length===746&&links.length===1685&&disputes.length===580)
check('new 75/17/40/160',links.filter(r=>r.batch==='b21-v24').length===75&&disputes.filter(r=>r.batch==='b21-v24').length===17&&r.filter(r=>r.batch==='b21-v24').length===40&&d.filter(r=>r.batch==='b21-v24').length===160)
check('no confirmed relevance',links.concat(disputes).every(r=>r.relevance==='unknown'))
check('coverage counters',coverage.scope.items===746&&coverage.scope.r1_links===links.length&&coverage.scope.disputed===disputes.length)
check('D3 hypothesis status',r.every(r=>r.status==='AI_PROPOSED_TWO_TRACK'&&r.design_hypothesis.note.includes('가설')))
for(const id of ['2014A#29','M1809#26']){const b=id.startsWith('2014')?'b19-v24':'b20-v24';check('previous gap excluded '+id,json(doc+b+'-agreement.json').items_detail.find(r=>r.item_id===id).use==='excluded_source_gap')}
const r4=inp.rows.filter(i=>{const [a,b]=['A','B'].map(t=>tracks[t].find(r=>r.item_id===i.item_id).links.find(l=>l.task_id==='r.discourse_structure'));return a.relevance!==b.relevance}).map(i=>i.item_id)
const sample=json(doc+'b21-v24-review-sample.json'),ids=[...new Set([...r4,...primary.map(r=>r.item),...sample.candidates.map(r=>r.item),...sample.disputed.map(r=>r.item),'2014A#41','M1809#41'])]
const dossier=ids.map(id=>({id,input:inp.rows.find(i=>i.item_id===id),A:tracks.A.find(r=>r.item_id===id),B:tracks.B.find(r=>r.item_id===id)}))
fs.writeFileSync(out+'dossier.local.json',JSON.stringify(dossier,null,2))
fs.writeFileSync(out+'supplement.local.json',JSON.stringify({checks,changes,hands,totals,overall,per,primary,r4,input_manifest:Object.entries(snap.files).map(([p,s])=>({path:p,sha256:hash(s)}))},null,2))
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),changes:changes.map(r=>({...r,fields:r.fields.map(f=>f.field)})),totals,overall,per,primary,r4},null,2))
