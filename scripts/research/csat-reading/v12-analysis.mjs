// scripts/research/csat-reading/v12-analysis.mjs
// Preserved first-submission reliability and explicit evidence-window guards.
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {categorical,jaccard,assertHash} from './agreement.mjs'
export const methods=['contrast','core_sentence','selective','incremental','syntax','meaning_units','proposition_relations','structure_reconstruction','evidence_option_comparison','type_specific']
export const states=['sufficient','conditional','insufficient','defer']
export const positive=x=>['sufficient','conditional'].includes(x)
const sha=x=>createHash('sha256').update(x).digest('hex')
export function sufficientGate(a,b,types){
 const stats=categorical(a,b),resolved=a.map((x,i)=>i).filter(i=>a[i]!=='defer'&&b[i]!=='defer')
 const both=resolved.filter(i=>positive(a[i])&&positive(b[i])).length
 const onlyA=resolved.filter(i=>positive(a[i])&&!positive(b[i])).length,onlyB=resolved.filter(i=>!positive(a[i])&&positive(b[i])).length
 const positiveAgreement=2*both+onlyA+onlyB?2*both/(2*both+onlyA+onlyB):null
 const counts=[a,b].map(x=>x.filter(positive).length),typeCounts=[a,b].map(x=>new Set(types.filter((_,i)=>positive(x[i]))).size)
 const exact=resolved.filter(i=>a[i]===b[i]).length/a.length,deferRate=1-resolved.length/a.length
 return {...stats,exact_excluding_defer_over_all:exact,defer_rate:deferRate,positive_agreement:positiveAgreement,positive_counts:counts,positive_type_counts:typeCounts,numeric_pass:exact>=.8&&positiveAgreement!==null&&positiveAgreement>=.7&&counts.every(n=>n>=3)&&typeCounts.every(n=>n>=2)&&stats.kappa!==null&&stats.kappa>=.4&&deferRate<=.1}
}
export function validateRater(rater,input){
 const errors=[],byId=new Map(input.items.map(x=>[x.id,x]))
 const at=(id,x)=>errors.push(`${id}: ${x}`)
 if(rater.protocol!=='1.2'||rater.answer_blind!==true||!['A','B'].includes(rater.rater))at('metadata','protocol/blind/rater')
 if(rater.items?.length!==input.items.length||new Set(rater.items?.map(x=>x.id)).size!==input.items.length)at('metadata','missing or duplicate items')
 for(const it of rater.items||[]){
  const original=byId.get(it.id);if(!original){at(it.id,'unknown item');continue}
  if(it.binding!==original.source_binding)at(it.id,'source binding mismatch')
  if(!Number.isInteger(it.solved_answer)||it.solved_answer<1||it.solved_answer>5)at(it.id,'answer number')
  if(!['practical','exposition','argument','narrative','data','mixed','unresolved'].includes(it.discourse))at(it.id,'discourse')
  if(!['retrieve','stance','purpose','macro_compress','complete','coherence_order','coherence_insert','coherence_remove','referent','grammar','lexical_context','affect','quantitative'].includes(it.task))at(it.id,'task')
  for(const axis of ['complexity','proposition','decisive_relations','background_relations','inference'])if(!Array.isArray(it[axis])||new Set(it[axis]).size!==it[axis].length)at(it.id,`${axis} array`)
  if(!it.decisive_relations?.length||!it.inference?.length)at(it.id,'empty decisive/inference')
  const unitIds=new Set(original.units.map(u=>u.id)),glossIds=new Set((original.glosses||[]).map(g=>g.id)),cellIds=new Set((original.presentation?.table?.cells||[]).map(c=>c.id))
  const checkUnits=(ids,label)=>{if(!Array.isArray(ids)||ids.some(id=>!unitIds.has(id)))at(it.id,`${label} unknown units`)}
  if(it.choices?.length!==5||new Set(it.choices.map(c=>c.n)).size!==5)at(it.id,'five option judgments')
  for(const c of it.choices||[]){
   if(![1,2,3,4,5].includes(c.n)||!['expression','sentence','candidate_inserted','whole_passage_role','remove_before_after','diagram','world','task'].includes(c.context)||!['supports','contradicts','not_determined','not_propositional'].includes(c.textual_support)||!['fits','fails','not_determined'].includes(c.task_fit)||c.content_truth!=='not_assessed'||!c.why)at(it.id,`choice ${c.n} context/support/fit/world distinction`)
   checkUnits(c.units,`choice ${c.n}`)
  }
  const paths=new Map((it.paths||[]).map(p=>[p.id,p]));if(paths.size!==(it.paths||[]).length)at(it.id,'duplicate path IDs')
  for(const p of paths.values()){
   checkUnits(p.used_units,`path ${p.id}`)
   if(!Array.isArray(p.gloss_ids)||p.gloss_ids.some(id=>!glossIds.has(id))||!Array.isArray(p.cells)||p.cells.some(id=>!cellIds.has(id)))at(it.id,`path ${p.id} unknown gloss/cell`)
   if(!Array.isArray(p.ranges)||p.ranges.some(r=>!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.start>=r.end||r.end>original.passage.length||!p.used_units.some(id=>{const u=original.units.find(u=>u.id===id);return u&&r.start>=u.start&&r.end<=u.end})))at(it.id,`path ${p.id} ranges not contained`)
   for(const ref of p.references||[])if(!p.used_units.includes(ref.from)||!p.used_units.includes(ref.to)||!ref.why)at(it.id,`path ${p.id} external antecedent`)
   if(!Array.isArray(p.assumptions)||!p.why||!Array.isArray(p.option_verification))at(it.id,`path ${p.id} assumptions/logic/option ledger missing`)
   for(const o of p.option_verification||[]){checkUnits(o.units,`path ${p.id} option ${o.n}`);if(o.units.some(id=>!p.used_units.includes(id))||!o.why)at(it.id,`path ${p.id} option evidence outside window`)}
  }
  for(const name of methods){
   const m=it.methods?.[name];if(!m||!states.includes(m.AI)||!states.includes(m.FOV)||!m.why||m.educational_effect!=='not_tested'){at(it.id,`${name} missing method distinction`);continue}
   const p=paths.get(m.path_id)
   if((positive(m.AI)||positive(m.FOV))&&!p){at(it.id,`${name} positive without path`);continue}
   if(!p)continue
   if(m.AI==='sufficient'&&p.assumptions.includes('unique_correct_option'))at(it.id,`${name} unique-answer assumption requires conditional`)
   if(positive(m.FOV)&&(p.option_verification.length!==5||new Set(p.option_verification.map(x=>x.n)).size!==5||p.option_verification.some(x=>!['fits','fails'].includes(x.fit))))at(it.id,`${name} FOV positive without five resolved proofs`)
   const used=original.units.filter(u=>p.used_units.includes(u.id))
   if((positive(m.AI)||positive(m.FOV))&&name==='core_sentence'&&(used.length!==1||used[0].kind!=='sentence'))at(it.id,`${name} requires one complete sentence`)
   if((positive(m.AI)||positive(m.FOV))&&name==='contrast'&&(used.length>2||!p.required_relations?.includes('contrast')))at(it.id,`${name} not two-proposition contrast`)
   if((positive(m.AI)||positive(m.FOV))&&name==='selective'&&p.cells.length===0){const indices=p.used_units.map(id=>original.units.findIndex(u=>u.id===id)).sort((a,b)=>a-b);if(indices.length>2||indices.length===2&&indices[1]-indices[0]!==1)at(it.id,`${name} not contiguous <=2 units`)}
   if((positive(m.AI)||positive(m.FOV))&&name==='syntax'&&!p.syntax_ranges?.length)at(it.id,'syntax positive without dependency range')
  }
  if(!['observed','logical','hypothesis'].includes(it.design?.level)||!it.design?.statement)at(it.id,'design evidence level')
 }
 return errors
}
export function assertPreserved(reg,readBytes=fs.readFileSync){for(const [file,expected]of Object.entries(reg.old_frozen_hashes))assertHash(readBytes(file),expected,file)}
export function analyze(a,b,input,key,source,execution){
 const errors=[...validateRater(a,input).map(x=>'A '+x),...validateRater(b,input).map(x=>'B '+x)]
 const pairs=input.items.map(o=>({o,a:a.items.find(x=>x.id===o.id),b:b.items.find(x=>x.id===o.id)}));if(pairs.some(p=>!p.a||!p.b))throw Error('Missing paired observations')
 const result={protocol:'1.2',n:pairs.length,groups:new Set(pairs.map(p=>p.o.passage_group)).size,source_complete:source.items.filter(x=>x.status==='complete').length,quality:{errors,passed:!errors.length},axes:{},methods:{},disagreements:[],answer_check:{},execution,interpretation:'Purposive new main-exam pilot; separate AI contexts, not human validity, optimal window size or teaching effects.'}
 for(const axis of ['discourse','task']){const s=categorical(pairs.map(p=>p.a[axis]),pairs.map(p=>p.b[axis]));result.axes[axis]={...s,numeric_pass:s.scorable_agreement_over_all>=.8&&(1-s.resolved_pair_n/s.n)<=.1}}
 for(const axis of ['complexity','proposition','decisive_relations','background_relations','inference']){const mean=pairs.reduce((s,p)=>s+jaccard(p.a[axis],p.b[axis]),0)/pairs.length;result.axes[axis]={mean_jaccard:mean,n:pairs.length,numeric_pass:['decisive_relations','inference'].includes(axis)?mean>=.7:null}}
 for(const name of methods){result.methods[name]={};for(const target of ['AI','FOV']){const s=sufficientGate(pairs.map(p=>p.a.methods[name][target]),pairs.map(p=>p.b.methods[name][target]),pairs.map(p=>p.o.type_id));result.methods[name][target]={...s,admission:s.numeric_pass&&!errors.length&&result.source_complete===pairs.length&&pairs.length>=16&&result.groups>=12,logical_review:'pending_separate_review',confirmatory_full_expansion:false}}}
 for(const target of ['textual_support','task_fit']){const rows=pairs.flatMap(p=>[1,2,3,4,5].map(n=>[p.a.choices.find(c=>c.n===n)[target],p.b.choices.find(c=>c.n===n)[target]]));result.axes['option_'+target]={...categorical(rows.map(x=>x[0]),rows.map(x=>x[1])),unit:'80 dependent choices nested in16 items; descriptive only'}}
 const keys=new Map(key.map(k=>[k.id,k.answer]));if(keys.size!==pairs.length||pairs.some(p=>!keys.has(p.o.id)))throw Error('Key item mismatch')
 for(const [name,rater]of [['A',a],['B',b]])result.answer_check[name]={matched:rater.items.filter(i=>i.solved_answer===keys.get(i.id)).length,total:pairs.length,mismatches:rater.items.filter(i=>i.solved_answer!==keys.get(i.id)).map(i=>({id:i.id,first:i.solved_answer,key:keys.get(i.id)}))}
 for(const p of pairs){const axes=['discourse','task'].filter(k=>p.a[k]!==p.b[k]);for(const k of ['decisive_relations','inference','complexity','proposition'])if(jaccard(p.a[k],p.b[k])!==1)axes.push(k);for(const k of methods)for(const t of ['AI','FOV'])if(p.a.methods[k][t]!==p.b.methods[k][t])axes.push(k+'.'+t);if(axes.length)result.disagreements.push({id:p.o.id,axes,status:'first_judgments_preserved'})}
 return result
}
function main(){
 const base='docs/research/csat-reading/data/v12/',local='scripts/research/csat-reading/local/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
 const reg=read(base+'registration.json'),ex=read(base+'pilot-execution.json');assertPreserved(reg)
 assertHash(fs.readFileSync('docs/research/csat-reading/PROTOCOL-v1.2.md'),reg.protocol_sha256,'v1.2 protocol')
 for(const [file,expected]of Object.entries(ex.hashes))assertHash(fs.readFileSync(file),expected,file)
 const result=analyze(read(base+'rater-a.json'),read(base+'rater-b.json'),read(local+'pilot-input.json'),read(local+'pilot-key.json'),read(base+'pilot-source.json'),ex)
 const output=base+'pilot-agreement.json';fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify({n:result.n,source_complete:result.source_complete,errors:result.quality.errors,axes:result.axes,methods:result.methods,answers:result.answer_check,disagreements:result.disagreements.length},null,2))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main()
