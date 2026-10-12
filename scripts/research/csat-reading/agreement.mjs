// scripts/research/csat-reading/agreement.mjs
// Agreement on preserved initial independent judgments, never on adjudicated labels.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
export function jaccard(a,b){const x=new Set(a),y=new Set(b);const u=new Set([...x,...y]);return u.size?[...x].filter(v=>y.has(v)).length/u.size:0}
export function assertHash(bytes,expected,label){
 if(!expected||createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error(`Registered hash mismatch: ${label}`)
}
export function categorical(a,b){
 if(a.length!==b.length||!a.length)throw new Error('Paired nonempty observations required')
 const n=a.length;const labels=[...new Set([...a,...b])].sort();const table=Object.fromEntries(labels.map(x=>[x,Object.fromEntries(labels.map(y=>[y,0]))]))
 for(let i=0;i<n;i++)table[a[i]][b[i]]++
 const observed=a.filter((x,i)=>x===b[i]).length/n
 const expected=labels.reduce((sum,x)=>sum+a.filter(v=>v===x).length/n*b.filter(v=>v===x).length/n,0)
 const scorable=a.map((x,i)=>i).filter(i=>![a[i],b[i]].some(v=>['unresolved','missing',null,undefined].includes(v)))
 const scoredMatches=scorable.filter(i=>a[i]===b[i]).length
 const kappa=expected===1?null:(observed-expected)/(1-expected)
 const resolvedKappa=scorable.length===n?kappa:scorable.length?categorical(scorable.map(i=>a[i]),scorable.map(i=>b[i])).kappa:null
 return {n,raw_agreement:observed,scorable_agreement_over_all:scoredMatches/n,resolved_pair_n:scorable.length,resolved_pair_agreement:scorable.length?scoredMatches/scorable.length:null,resolved_kappa:resolvedKappa,kappa,kappa_note:expected===1?'undefined: both marginals degenerate':'descriptive small-sample estimate; unresolved included only in conventional full confusion, not expansion agreement',labels,confusion:table}
}
export function pairRows(a,b,manifest){
 const index=x=>new Map(x.map(r=>[r.id,r]));const aa=index(a),bb=index(b)
 if(aa.size!==a.length||bb.size!==b.length)throw new Error('Duplicate item IDs')
 if(a.length!==manifest.length||b.length!==manifest.length)throw new Error('Missing or extra rater observations')
 return manifest.map(m=>{const x=aa.get(m.id),y=bb.get(m.id);if(!x||!y||x.binding!==m.binding||y.binding!==m.binding)throw new Error(`Input binding mismatch ${m.id}`);return {id:m.id,group:m.passage_group,a:x,b:y}})
}
function bootInterval(rows,metric){
 const groups=[...new Set(rows.map(r=>r.group))];const grouped=groups.map(g=>rows.filter(r=>r.group===g));let seed=20261012
 const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}
 const sample=[];for(let i=0;i<1000;i++){const rs=[];for(let j=0;j<groups.length;j++)rs.push(...grouped[Math.floor(random()*groups.length)]);sample.push(metric(rs))}
 sample.sort((a,b)=>a-b);return {low:sample[24],high:sample[974],method:'fixed-seed percentile cluster bootstrap, 1000 resamples; purposive pilot, not population inference'}
}
function main(){
 const dir=path.resolve('docs/research/csat-reading/data');const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'))
 const execution=read('execution-record.json')
 const hashed=(file,expected)=>{const bytes=fs.readFileSync(file);assertHash(bytes,expected,file);return bytes}
 const snapshotDir=path.dirname(execution.source_snapshot.private_path)
 hashed(execution.source_snapshot.private_path,execution.source_snapshot.sha256)
 hashed('docs/research/csat-reading/PROTOCOL.md',execution.current_protocol_sha256)
 const manifest=JSON.parse(hashed(path.join(dir,'pilot-manifest.json'),execution.pilot_manifest_sha256))
 const a=read('pilot-a.json'),b=read('pilot-b.json');const paired=pairRows(a.items,b.items,manifest)
 const blindInput=JSON.parse(hashed(path.join(snapshotDir,'pilot-input.json'),execution.private_blind_input_sha256))
 const storedKey=JSON.parse(hashed(path.join(snapshotDir,'pilot-answer-key.json'),execution.private_answer_key_sha256))
 const originals=new Map(blindInput.items.map(it=>[it.id,it]))
 const normalize=value=>String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
 const required=['id','binding','solved_answer','discourse','complexity','proposition','relations','inference','task','choices','design','strategies','evidence','strategy_note','source_status','unresolved']
 const errors=[]
 for(const [key,rater] of [['A',a],['B',b]]){
  if(rater.answer_blind!==true||execution.raters[key]?.fork_turns!=='none')errors.push(`${key}: blind/separate-context metadata missing`)
  const actualHash=createHash('sha256').update(fs.readFileSync(path.join(dir,`pilot-${key.toLowerCase()}.json`))).digest('hex')
  if(actualHash!==execution.complete_submission_hashes[key])errors.push(`${key}: complete-submission hash not registered or changed`)
  for(const it of rater.items){
   for(const field of required)if(!(field in it))errors.push(`${key}:${it.id}: missing ${field}`)
   if(!it.evidence?.length||it.evidence.some(e=>!e.anchor||!e.why))errors.push(`${key}:${it.id}: missing evidence`)
   const original=originals.get(it.id);const text=normalize([original?.passage,original?.stem,...original?.choices||[]].join(' '))
   for(const e of it.evidence||[])if(!text.includes(normalize(e.anchor)))errors.push(`${key}:${it.id}: evidence anchor not in registered original text`)
   if(it.choices?.length!==5||new Set(it.choices.map(c=>c.n)).size!==5||it.choices.some(c=>![1,2,3,4,5].includes(c.n)))errors.push(`${key}:${it.id}: five choice judgments required`)
  }
 }
 const quality={errors,passed:errors.length===0,first_complete_submission_note:execution.first_complete_submission_note,partial_draft_loss:execution.partial_draft_loss}
 const result={protocol:'1.0.1',preregistered_protocol:'1.0',raters:[a.rater,b.rater],independence:'two separate AI contexts, same inherited configuration; no human expert evidence',items:paired.length,passage_groups:new Set(paired.map(r=>r.group)).size,quality,axes:{},strategies:{},disagreements:[],expansion:{},answer_check:null}
 for(const axis of ['discourse','task']){
  const values=paired.map(r=>[r.a[axis],r.b[axis]]);const s=categorical(values.map(x=>x[0]),values.map(x=>x[1]));s.raw_agreement_interval=bootInterval(paired,rs=>rs.filter(r=>r.a[axis]===r.b[axis]).length/rs.length)
  s.unresolved_rate=paired.filter(r=>[r.a[axis],r.b[axis]].includes('unresolved')).length/paired.length
  result.axes[axis]=s;result.expansion[axis]=s.scorable_agreement_over_all>=0.8&&s.unresolved_rate<=0.1
 }
 for(const axis of ['complexity','proposition','relations','inference']){
  const values=paired.map(r=>jaccard(r.a[axis],r.b[axis]));const mean=values.reduce((s,v)=>s+v,0)/values.length
  const labels=[...new Set(paired.flatMap(r=>[...r.a[axis],...r.b[axis]]))].sort();const missing=paired.filter(r=>!r.a[axis].length||!r.b[axis].length).length;const s={n:paired.length,mean_jaccard:mean,missing_pairs:missing,empty_set_policy:'zero similarity, reported as missing; never positive agreement',interval:bootInterval(paired,rs=>rs.reduce((s,r)=>s+jaccard(r.a[axis],r.b[axis]),0)/rs.length),per_label:Object.fromEntries(labels.map(label=>[label,categorical(paired.map(r=>r.a[axis].includes(label)?'yes':'no'),paired.map(r=>r.b[axis].includes(label)?'yes':'no'))])),unresolved_rate:paired.filter(r=>!r.a[axis].length||!r.b[axis].length||[...r.a[axis],...r.b[axis]].includes('unresolved')).length/paired.length}
  result.axes[axis]=s;if(['relations','inference'].includes(axis))result.expansion[axis]=mean>=0.7&&s.unresolved_rate<=0.1
 }
 for(const key of ['contrast','core_sentence','incremental','syntax','selective']){
  const s=categorical(paired.map(r=>r.a.strategies[key]),paired.map(r=>r.b.strategies[key]));s.unresolved_rate=paired.filter(r=>[r.a.strategies[key],r.b.strategies[key]].includes('unresolved')).length/paired.length
  result.strategies[key]=s;result.expansion['strategy_'+key]=s.scorable_agreement_over_all>=0.8&&s.unresolved_rate<=0.1
 }
 const choicePairs=paired.flatMap(r=>[1,2,3,4,5].map(n=>({id:r.id,n,a:r.a.choices.find(c=>c.n===n)?.status,b:r.b.choices.find(c=>c.n===n)?.status})))
 if(choicePairs.some(r=>!r.a||!r.b))throw new Error('Missing choice status')
 result.axes.choice_status={...categorical(choicePairs.map(r=>r.a),choicePairs.map(r=>r.b)),unit:'160 paired choice labels within 32 items; dependent observations, descriptive only',interpretation:'Code-label agreement does not validate truth versus task-fit distinctions',differences:choicePairs.filter(r=>r.a!==r.b)}
 const keys=new Map(storedKey.map(r=>[r.id,r.answer]));if(keys.size!==storedKey.length||keys.size!==paired.length||paired.some(r=>!keys.has(r.id)))throw new Error('Stored key IDs differ from registered pilot')
 result.answer_check={source:'Pinned DB stored answer; official PDF corroboration is separate',raters:Object.fromEntries([['a',a],['b',b]].map(([key,rater])=>[key,{answered:rater.items.filter(r=>r.solved_answer!==null).length,matched:rater.items.filter(r=>r.solved_answer===keys.get(r.id)).length,mismatches:rater.items.filter(r=>r.solved_answer!==keys.get(r.id)).map(r=>({id:r.id,initial:r.solved_answer,stored:keys.get(r.id)}))}]))}
 for(const r of paired){const fields=['discourse','task'].filter(k=>r.a[k]!==r.b[k]);for(const k of ['relations','inference'])if(jaccard(r.a[k],r.b[k])!==1)fields.push(k);for(const k of Object.keys(r.a.strategies))if(r.a.strategies[k]!==r.b.strategies[k])fields.push('strategy_'+k);if(fields.length)result.disagreements.push({id:r.id,fields,status:'unadjudicated_initial_difference_preserved'})}
 result.minimum_pilot_met=paired.length>=32&&new Set(paired.map(r=>r.group)).size>=24
 for(const k of Object.keys(result.expansion))result.expansion[k]&&=quality.passed&&result.minimum_pilot_met
 const source=read('source-audit.json')
 const sourceIds=new Set(source.items.map(it=>it.id));if(sourceIds.size!==source.items.length||sourceIds.size!==paired.length||paired.some(it=>!sourceIds.has(it.id)))throw new Error('Source-audit IDs differ from registered pilot')
 result.numeric_and_record_gate_met={...result.expansion}
 const verifiedSources=source.items.filter(it=>it.body_check?.full_verbatim_comparison_completed&&it.choice_check?.full_visual_mapping_completed&&it.answer_check?.key_pdf&&it.answer_check?.matches).length
 result.confirmatory_admission={allowed:verifiedSources===paired.length&&quality.passed,verified_source_items:verifiedSources,required:paired.length,reason:'Confirmatory admission requires original presentation and same-form key verification for the complete pilot; text screening is insufficient',source_summary:source.summary??null}
 for(const k of Object.keys(result.expansion))result.expansion[k]&&=result.confirmatory_admission.allowed
 fs.writeFileSync(path.join(dir,'pilot-agreement.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({n:result.items,groups:result.passage_groups,discourse:result.axes.discourse.raw_agreement,task:result.axes.task.raw_agreement,relations:result.axes.relations.mean_jaccard,inference:result.axes.inference.mean_jaccard,strategies:Object.fromEntries(Object.entries(result.strategies).map(([k,v])=>[k,v.raw_agreement])),expansion:result.expansion,answer_check:result.answer_check},null,2))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main()
