// scripts/research/goal-data/review-b20/deep.mjs
import fs from 'node:fs'
import {out,base,doc,read,json,hash,at,git,snap,inp,tracks,execute,check,checks} from './audit.mjs'
const inv=json('docs/research/goal-data-batches/D1-source-audit/source-inventory.json'),aa=inv.items.filter(r=>r.exam_id==='2014A'),bb=inv.items.filter(r=>r.exam_id==='2014B')
const normalizedPairs=aa.flatMap(a=>bb.filter(b=>a.passage_sha256===b.passage_sha256).map(b=>({A:a.item_id,B:b.item_id,inventory_source_equal:a.source_sha256===b.source_sha256})))
check('23x23 exhaustive inventory comparison',aa.length===23&&bb.length===23&&normalizedPairs.length===3)
const packets=['b19-v24','b20-v24'].map(b=>json(base+b+'/input.json'))
const raw=new Map(packets.flatMap(p=>[...p.rows,...p.excluded_raw]).map(r=>[r.item_id,r]))
const key=s=>({stem:s.stem,passage:s.passage,choices:s.choices,answer:s.answer,answers:s.answers})
const duplicates=normalizedPairs.map(p=>{const a=raw.get(p.A),b=raw.get(p.B);return {...p,equal:Object.fromEntries(Object.keys(key(a.source)).map(k=>[k,hash(a.source[k])===hash(b.source[k])])),points:[a.source.points,b.source.points],key_equal:hash(key(a.source))===hash(key(b.source))}})
check('three exact identity pairs, points excluded',duplicates.every(p=>p.key_equal))
const reasoning=read('docs/research/goal-data-batches/D3-principles/item-reasoning.jsonl').trim().split('\n').map(JSON.parse)
const kept=duplicates.map(p=>({A:p.A,B:p.B,A_count:reasoning.filter(r=>r.item_id===p.A).length,B_count:reasoning.filter(r=>r.item_id===p.B).length}))
check('earliest judged retained, chart neither',kept.every(p=>p.B_count===0&&p.A_count===(p.A==='2014A#32'?0:1)))
const combinations=reasoning.map(r=>({item:r.item_id,batch:r.batch})),pairRows=[],batchCounts={}
for(const batch of [...new Set(combinations.map(r=>r.batch))]){
 if(batch==='pilot-1')continue
 const input=json(base+batch+'/input.json'),rows={}
 for(const t of ['A','B'])rows[t]=[...new Map(Object.keys(snap.files).filter(p=>p.startsWith(base+batch+'/chunk-'+t+'-')&&p.endsWith('.out.json')).flatMap(p=>json(p).rows).map(r=>[r.item_id,r])).values()]
 const wanted=combinations.filter(r=>r.batch===batch)
 batchCounts[batch]=wanted.length
 for(const w of wanted){for(const task of rows.A.find(r=>r.item_id===w.item).links.map(l=>l.task_id)){const [a,b]=['A','B'].map(t=>rows[t].find(r=>r.item_id===w.item).links.find(l=>l.task_id===task).relevance);pairRows.push({item:w.item,batch,task,A:a,B:b})}}
}
const pilot=json('docs/csat-learner/v62/data-expansion/pilot-links.json').links
for(const r of pilot.filter(r=>combinations.some(x=>x.batch==='pilot-1'&&x.item===r.item)))pairRows.push({item:r.item,batch:'pilot-1',task:r.task,A:r.judgments.A,B:r.judgments.B})
const stats=rows=>{const n=rows.length,cats=[...new Set(rows.flatMap(r=>[r.A,r.B]))],agree=rows.filter(r=>r.A===r.B).length,pe=cats.reduce((v,c)=>v+rows.filter(r=>r.A===c).length*rows.filter(r=>r.B===c).length/n/n,0);return {n,agree,agreement:agree/n,kappa:pe===1?null:(agree/n-pe)/(1-pe),categories:cats}}
const pooled=stats(pairRows),b19b20=stats(pairRows.filter(r=>['b19-v24','b20-v24'].includes(r.batch))),v24=stats(pairRows.filter(r=>r.batch.endsWith('v24'))),cov=json(doc+'mapping-coverage.json')
// Pooled statistic is descriptive only: task sets/contracts differ, so do not replace batch kappas.
const linkKeys=new Set(json('docs/csat-learner/v4/codebook.json').tasks.filter(r=>r.status!=='hold'&&r.kind!=='integrated').map(r=>r.id))
const atomic=pairRows.filter(r=>linkKeys.has(r.task))
const combined=stats(atomic)
check('pooled atomic pairs match coverage',combined.n===cov.scope.pairs)
const gapIds=new Set(reasoning.filter(r=>r.evidence!=='source_text').map(r=>r.item_id))
const b20WithoutGap=stats(atomic.filter(r=>r.batch==='b20-v24'&&!gapIds.has(r.item))),combinedWithoutGaps=stats(atomic.filter(r=>!gapIds.has(r.item)))
check('combined distinct items 706',new Set(pairRows.map(r=>r.item)).size===706)
const partial=aa.flatMap(a=>bb.filter(b=>a.passage_sha256===b.passage_sha256&&!duplicates.some(p=>p.A===a.item_id&&p.B===b.item_id)).map(b=>[a.item_id,b.item_id]))
const partialFixtures=[{stem:'title',passage:'shared',choices:['a'],answer:1,answers:[1]},{stem:'blank',passage:'shared',choices:['a'],answer:1,answers:[1]}]
check('same passage different stem remains two',hash(key(partialFixtures[0]))!==hash(key(partialFixtures[1])))
const gap='M1809#26',source=inp.rows.find(r=>r.item_id===gap),judge=Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(r=>r.item_id===gap)]))
const originalPath='D:/workspace/Vocaflow/scripts/csat/data/columns2/M1809.txt',original=fs.readFileSync(originalPath,'utf8'),ls=original.replaceAll('\r','').split('\n')
const {passageOf}=await import('file:///D:/workspace/Vocaflow/scripts/csat/lib-passage.mjs')
const start=ls.findIndex(l=>/^26\./.test(l)),end=ls.findIndex((l,i)=>i>start&&/^27\./.test(l)),block=ls.slice(start,end),without=passageOf(block),withNote=passageOf(block,{keepEnglishNotes:true}),norm=s=>s.replace(/\s+/g,' ').replace(/\s*\*\s*/g,'*').trim()
check('M1809 line299 explicit prohibition',ls[298].includes('No cash donations will be accepted.'))
check('parser reproduces missing line',norm(without)===norm(source.source.passage)&&!without.includes('No cash')&&withNote.includes('No cash'))
const d3gap=reasoning.find(r=>r.item_id===gap),wrong=read('docs/research/goal-data-batches/D3-principles/distractor-logic.jsonl').trim().split('\n').map(JSON.parse).filter(r=>r.item_id===gap),d2gap=json(doc+'b20-v24-agreement.json').items_detail.find(r=>r.item_id===gap)
check('M1809 D3 isolation 1+4',d3gap.evidence==='source_gap:footnote_dropped'&&wrong.length===4&&wrong.every(r=>r.evidence==='source_gap:footnote_dropped'))
check('D2 retained candidate finding',d2gap.use==='independent_check_candidate'&&Object.values(d2gap.independent_assessment).every(v=>v==='candidate_if_unexposed'))
const notes=[]
for(const folder of ['columns','columns2'])for(const f of fs.readdirSync('D:/workspace/Vocaflow/scripts/csat/data/'+folder).filter(f=>f.endsWith('.txt'))){const lines=fs.readFileSync('D:/workspace/Vocaflow/scripts/csat/data/'+folder+'/'+f,'utf8').replaceAll('\r','').split('\n');lines.forEach((line,i)=>{const s=line.trim();if(/^\*\s+[A-Z]/.test(s)&&!/:.*[가-힣]/.test(s)&&s.replace(/^\*\s*/,'').split(/\s+/).length>=5)notes.push({folder,file:f,line:i+1,text:line})})}
const negative=[];const seen=new Set()
for(const p of Object.keys(snap.files).filter(p=>/\/chunk-[AB]-\d+\.out\.json$/.test(p)&&!p.includes('/history/'))){const batch=p.split('/').at(-2),inputP=base+batch+'/input.json';if(!snap.files[inputP])continue;const ins=json(inputP);for(const r of json(p).rows){const s=ins.rows.find(x=>x.item_id===r.item_id);if(!s||!['R-NOTICE','R-FACT','X-FACT'].includes(s.type_id))continue;const text=r.answer_logic.why+' '+r.primary_reason;if(/언급.{0,12}(없|않)|본문.{0,12}없|부재/.test(text)){const k=r.item_id+'|'+/chunk-([AB])/.exec(p)[1];if(seen.has(k))continue;seen.add(k);negative.push({batch,item:r.item_id,path:p,type:s.type_id,why:r.answer_logic.why,primary_reason:r.primary_reason,source:s.source})}}}
const fullDiff=JSON.parse(fs.readFileSync(out+'diff.local.json')).diff
const result={duplicates,exhaustive:{A:aa.length,B:bb.length,comparisons:aa.length*bb.length,normalizedPairs,partial_pairs:partial,hash_normalization:'D1 norm: whitespace collapse, trim, lowercase; raw fields compare all three matches; remaining normalized hash inequalities rule out exact duplicates'},kept,batchCounts,pool:{pooled,combined,b19b20,v24,b20WithoutGap,combinedWithoutGaps,coverage_pairs:cov.scope.pairs,warning:'heterogeneous contracts/tasks; descriptive only, not a stability/validity estimate'},gap:{source,judge,originalPath,line299:ls[298],without,withNote,d3gap,wrong,d2gap},notes,negative,full_diff_lines:fullDiff.split('\n').length,checks}
fs.writeFileSync(out+'deep.local.json',JSON.stringify(result,null,2))
console.log(JSON.stringify({...result,gap:{d2gap,d3evidence:d3gap.evidence,answer:source.source.answer,body_ok:source.body_ok},negative:negative.map(({source,...r})=>r),checks:{count:checks.length,failed:checks.filter(c=>!c.pass)}},null,2))
