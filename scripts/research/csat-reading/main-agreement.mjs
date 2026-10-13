// scripts/research/csat-reading/main-agreement.mjs
// Descriptive reliability for separately frozen v1.1 main-exam first submissions.
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {assertHash,categorical,jaccard,pairRows} from './agreement.mjs'
const relationCodes=['contrast','causal','example','elaboration','restatement','sequence','reference','condition','concession','problem_solution','list','other','none']
const tasks=['retrieve','stance','purpose','macro_compress','complete','coherence_order','coherence_insert','coherence_remove','referent','grammar','lexical_context','affect','quantitative']
const strategyKeys=['contrast','core_sentence','incremental','syntax','selective']
const statuses=['applicable','insufficient','not_applicable','unresolved']
const contentCodes=['entailed','contradicted','unsupported','underdetermined','not_propositional']
const fitCodes=['fits','fails','unresolved']
const failureCodes=['none','scope','agent','polarity','unsupported','grammar','lexical','coherence','numeric','task','other']
const norm=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
export function validateRater(rater,input){
 const errors=[],originals=new Map(input.items.map(it=>[it.id,it]))
 if(rater.protocol!=='1.1'||rater.answer_blind!==true||!['A','B'].includes(rater.rater))errors.push('protocol/blind/rater metadata missing')
 for(const it of rater.items){
  const original=originals.get(it.id),text=norm([original?.passage,original?.stem,...original?.choices||[]].join(' '))
  const at=message=>errors.push(`${it.id}: ${message}`)
  const anchor=x=>typeof x==='string'&&x.length>0&&x.length<=60&&norm(x).length>0&&text.includes(norm(x))
  if(!Number.isInteger(it.solved_answer)||it.solved_answer<1||it.solved_answer>5)at('invalid solved answer')
  if(!['practical','exposition','argument','narrative','data','mixed','unresolved'].includes(it.discourse)||!tasks.includes(it.task))at('invalid discourse/task')
  const axes={complexity:['scope','embedding','anaphora','polysemy','ellipsis','none_observed'],proposition:['agent','predicate','object','polarity','time','condition','quantifier','modality'],decisive_relations:relationCodes,background_relations:relationCodes,inference:['explicit','local','global','contextual','visual_numeric','structural_grammar']}
  for(const [axis,codes] of Object.entries(axes))if(!Array.isArray(it[axis])||it[axis].some(x=>!codes.includes(x))||new Set(it[axis]).size!==it[axis].length)at(`invalid ${axis}`)
  if(!it.decisive_relations?.length||it.decisive_relations.includes('none')&&it.decisive_relations.length>1)at('none cannot be empty or mixed with positive relations')
  if(!Array.isArray(it.relation_edges))at('missing relation edges')
  else{
   for(const e of it.relation_edges)if(!it.decisive_relations.includes(e.relation)||e.relation==='none'||!anchor(e.from)||!anchor(e.to)||!e.why)at('edge not bound to units/decisive relation')
   for(const c of it.decisive_relations||[])if(c!=='none'&&!it.relation_edges.some(e=>e.relation===c))at(`no edge for ${c}`)
  }
  if(!it.evidence?.length||it.evidence.some(e=>!anchor(e.anchor)||!e.why))at('missing/stale/overlong evidence anchor')
  if(it.choices?.length!==5||new Set(it.choices.map(c=>c.n)).size!==5||it.choices.some(c=>![1,2,3,4,5].includes(c.n)||!contentCodes.includes(c.content)||!fitCodes.includes(c.fit)||!failureCodes.includes(c.failure)||!c.why))at('five independent truth/fit/failure choice judgments required')
  for(const k of strategyKeys){const s=it.strategies?.[k];if(!s||!statuses.includes(s.status)||!Array.isArray(s.units)||s.units.some(u=>!anchor(u))||!s.reason)at(`invalid strategy ${k}`)}
  if(!it.design||!['hypothesis','logical','observed'].includes(it.design.level)||!it.design.statement)at('unsupported design level/missing reason')
  if(!Array.isArray(it.unresolved)||!it.source_status)at('missing unresolved/source status')
 }
 return errors
}
export function sourceAdmission(source,manifest){
 const ids=new Set(source.items.map(it=>it.id))
 if(ids.size!==source.items.length||ids.size!==manifest.length||manifest.some(m=>!ids.has(m.id)))throw Error('Source item IDs differ from pilot')
 const bindings=new Map(manifest.map(m=>[m.id,m.binding]))
 for(const it of source.items)if(it.binding!==bindings.get(it.id))throw Error(`Source binding mismatch: ${it.id}`)
 const fields=['body','stem','choices','presentation','answer']
 return source.items.filter(it=>fields.every(k=>it[k]?.status==='complete')&&it.answer.matches===true&&it.admission?.original_artifact_complete===true).map(it=>it.id)
}
function multilabel(rows,axis){
 const labels=[...new Set(rows.flatMap(r=>[...r.a[axis],...r.b[axis]]))].sort()
 return {n:rows.length,mean_jaccard:rows.reduce((s,r)=>s+jaccard(r.a[axis],r.b[axis]),0)/rows.length,missing_pairs:rows.filter(r=>!r.a[axis].length||!r.b[axis].length).length,per_label:Object.fromEntries(labels.map(c=>[c,categorical(rows.map(r=>r.a[axis].includes(c)?'yes':'no'),rows.map(r=>r.b[axis].includes(c)?'yes':'no'))]))}
}
function descriptiveInterval(rows,metric){
 const groups=[...new Set(rows.map(r=>r.group))],units=groups.map(g=>rows.filter(r=>r.group===g));let seed=20261014
 const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}
 const scores=[]
 for(let i=0;i<1000;i++){const sample=[];for(let j=0;j<units.length;j++)sample.push(...units[Math.floor(random()*units.length)]);scores.push(metric(sample))}
 scores.sort((a,b)=>a-b)
 return {low:scores[24],high:scores[974],method:'post-hoc descriptive fixed-seed cluster bootstrap,1000 resamples; purposive sample, not population confidence or confirmation of the gate'}
}
function main(){
 const run='main-20261014',dir=path.resolve('docs/research/csat-reading/data',run),local=path.resolve('scripts/research/csat-reading/local',run)
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')),reg=read('registration.json')
 const hashed=(file,expected)=>{const bytes=fs.readFileSync(file);assertHash(bytes,expected,file);return bytes}
 hashed('docs/research/csat-reading/PROTOCOL-v1.1.md',reg.protocol_sha256)
 hashed('scripts/research/csat-reading/select-main-pilot.mjs',reg.selection_script_sha256)
 hashed('scripts/research/csat-reading/local/snapshots/20261012-r0/db-corpus.json',reg.source_snapshot.sha256)
 const manifest=JSON.parse(hashed(path.join(dir,'manifest.json'),reg.manifest_sha256))
 const input=JSON.parse(hashed(path.join(local,'input.json'),reg.blind_input_sha256))
 const raters={A:read('rater-a.json'),B:read('rater-b.json')}
 for(const k of ['A','B']){
  hashed(path.join(dir,`rater-${k.toLowerCase()}.json`),reg.first_submissions[k]?.sha256)
  if(raters[k].rater!==k||reg.first_submissions[k]?.fork_turns!=='none')throw Error(`Rater identity/context metadata missing: ${k}`)
 }
 const rows=pairRows(raters.A.items,raters.B.items,manifest)
 const errors=['A','B'].flatMap(k=>validateRater(raters[k],input).map(e=>`${k}:${e}`))
 const key=JSON.parse(hashed(path.join(local,'key.json'),reg.key_sha256)),keys=new Map(key.map(r=>[r.id,r.answer]))
 if(keys.size!==key.length||keys.size!==rows.length||rows.some(r=>!keys.has(r.id)))throw Error('Key IDs differ from pilot')
 const source=JSON.parse(hashed(path.join(dir,'source-audit.json'),reg.source_audit_sha256)),admitted=sourceAdmission(source,manifest)
 const result={run,protocol:'1.1',preregistration_commit:reg.preregistration_commit,interpretation:'Purposive main-exam re-pilot; AI reliability, not human validity or teaching effectiveness. Definitions and sample differ from v1.0.',n:rows.length,groups:new Set(rows.map(r=>r.group)).size,quality:{errors,passed:!errors.length},source:{admitted_original_artifact_n:admitted.length,admitted_ids:admitted,summary:source.summary},axes:{},strategies:{},numeric_gates:{},confirmatory_expansion:{},answer_check:{},disagreements:[]}
 for(const axis of ['discourse','task']){const s=categorical(rows.map(r=>r.a[axis]),rows.map(r=>r.b[axis]));result.axes[axis]=s;result.numeric_gates[axis]=s.scorable_agreement_over_all>=.8&&(1-s.resolved_pair_n/s.n)<=.1}
 for(const axis of ['complexity','proposition','decisive_relations','background_relations','inference']){const s=multilabel(rows,axis);result.axes[axis]=s;if(['decisive_relations','inference'].includes(axis))result.numeric_gates[axis]=s.mean_jaccard>=.7&&s.missing_pairs/rows.length<=.1}
 for(const k of strategyKeys){const s=categorical(rows.map(r=>r.a.strategies[k].status),rows.map(r=>r.b.strategies[k].status));s.prevalence_warning=s.kappa===null||s.kappa<=0;result.strategies[k]=s;result.numeric_gates[`strategy_${k}`]=s.scorable_agreement_over_all>=.8&&(1-s.resolved_pair_n/s.n)<=.1}
 for(const axis of ['content','fit','failure']){const pairs=rows.flatMap(r=>[1,2,3,4,5].map(n=>[r.a.choices.find(c=>c.n===n)[axis],r.b.choices.find(c=>c.n===n)[axis]]));result.axes[`choice_${axis}`]={...categorical(pairs.map(p=>p[0]),pairs.map(p=>p[1])),unit:'160 dependent choice observations within32 items; descriptive only'}}
 for(const k of ['A','B'])result.answer_check[k]={matched:raters[k].items.filter(it=>it.solved_answer===keys.get(it.id)).length,total:rows.length,mismatches:raters[k].items.filter(it=>it.solved_answer!==keys.get(it.id)).map(it=>({id:it.id,initial:it.solved_answer,stored:keys.get(it.id)}))}
 for(const r of rows){const fields=['discourse','task'].filter(k=>r.a[k]!==r.b[k]);for(const k of ['decisive_relations','inference','complexity','proposition'])if(jaccard(r.a[k],r.b[k])!==1)fields.push(k);for(const k of strategyKeys)if(r.a.strategies[k].status!==r.b.strategies[k].status)fields.push(`strategy_${k}`);for(const k of ['content','fit','failure'])if([1,2,3,4,5].some(n=>r.a.choices.find(c=>c.n===n)[k]!==r.b.choices.find(c=>c.n===n)[k]))fields.push(`choice_${k}`);if(fields.length)result.disagreements.push({id:r.id,fields,status:'unadjudicated_originals_preserved'})}
 for(const [k,v] of Object.entries(result.numeric_gates))result.confirmatory_expansion[k]=v&&!errors.length&&rows.length>=32&&result.groups>=24&&admitted.length===rows.length&&!(k.startsWith('strategy_')&&result.strategies[k.slice(9)].prevalence_warning)
 result.descriptive_intervals={discourse:descriptiveInterval(rows,rs=>rs.filter(r=>r.a.discourse===r.b.discourse).length/rs.length),decisive_relations:descriptiveInterval(rows,rs=>rs.reduce((s,r)=>s+jaccard(r.a.decisive_relations,r.b.decisive_relations),0)/rs.length),inference:descriptiveInterval(rows,rs=>rs.reduce((s,r)=>s+jaccard(r.a.inference,r.b.inference),0)/rs.length)}
 fs.writeFileSync(path.join(dir,'agreement.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({n:result.n,groups:result.groups,quality:result.quality,admitted:admitted.length,discourse:result.axes.discourse.raw_agreement,task:result.axes.task.raw_agreement,relations:result.axes.decisive_relations.mean_jaccard,inference:result.axes.inference.mean_jaccard,strategies:Object.fromEntries(Object.entries(result.strategies).map(([k,v])=>[k,{agreement:v.raw_agreement,kappa:v.kappa}])),answers:result.answer_check,disagreements:result.disagreements.length},null,2))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main()
