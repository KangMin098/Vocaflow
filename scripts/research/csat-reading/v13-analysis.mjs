// scripts/research/csat-reading/v13-analysis.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {categorical} from './agreement.mjs';
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function setAgreement(a,b){const x=new Set(a),y=new Set(b),union=new Set([...x,...y]);return {score:union.size?[...x].filter(z=>y.has(z)).length/union.size:null,both_empty:!union.size};}
export function limitedBudget(item,path,method){
 const by=new Map(item.units.map(x=>[x.id,x]));const used=path.used_units??[];
 const unknown=used.filter(id=>!by.has(id));const sentenceN=used.reduce((n,id)=>n+(by.get(id)?.sentence_count??1),0);
 const stimulusN=(path.stimulus_units??[]).reduce((n,id)=>n+(by.get(id)?.sentence_count??1),0);
 const complete=used.every(id=>by.get(id)?.syntactic_completeness==='complete'||(path.complete_sentences??[]).includes(id));
 const positions=used.map(id=>item.units.findIndex(x=>x.id===id)).sort((a,b)=>a-b);
 const consecutive=positions.every((p,i)=>!i||p===positions[i-1]+1);
 const limit=method==='core_sentence'?1:2;
 return {unknown,sentenceN,stimulusN,total_sentenceN:sentenceN+stimulusN,complete,consecutive,budget_ok:!unknown.length&&sentenceN>0&&sentenceN+stimulusN<=limit&&complete&&(method==='core_sentence'||consecutive),semantic_task_stimulus_is_free:false};
}
export function validateRater(r,input){
 const errors=[],sources=new Map(input.items.map(x=>[x.id,x]));
 if(r.answer_blind!==true)errors.push('not answer blind');
 if(r.items.length!==input.items.length||new Set(r.items.map(x=>x.id)).size!==input.items.length)errors.push('item denominator/duplicates');
 for(const row of r.items){const it=sources.get(row.id);if(!it||row.binding!==it.source_binding){errors.push(row.id+': binding');continue;}
  if(!row.inference?.length||row.inference.some(x=>!x.code||!x.target_result||!x.derivation||!Array.isArray(x.premise_units)))errors.push(row.id+': inference derivation');
  if(row.choices?.length!==5||new Set(row.choices.map(x=>x.n)).size!==5)errors.push(row.id+': choice denominator');
  for(const c of row.choices??[]){if(!['supports','contradicts','not_determined','not_propositional'].includes(c.textual_support)||!['fits','fails','undetermined'].includes(c.task_fit)||!c.context_key||!c.why)errors.push(row.id+': candidate target/support');}
  for(const p of row.paths??[]){if(!p.id||!['AI','FOV'].includes(p.goal)||!['sufficient','conditional','insufficient','defer'].includes(p.status)||!Array.isArray(p.used_units)||!Array.isArray(p.assumptions)||!p.why)errors.push(row.id+': path schema');
   if(p.used_units.some(id=>!it.units.some(u=>u.id===id)))errors.push(row.id+': unknown path unit');
   if(p.goal==='FOV'&&p.status==='sufficient'&&p.option_evidence?.length!==5)errors.push(row.id+': FOV without5');
  }
  for(const rel of row.relation_tests??[])if(!rel.relation||!rel.path_id||!rel.removal_test||!rel.direction)errors.push(row.id+': relation removal test');
  for(const method of ['core_sentence','selective'])for(const goal of ['AI','FOV'])if(!row.limited?.[method]?.[goal]?.status||!row.limited?.[method]?.[goal]?.why)errors.push(row.id+': limited status');
 }
 return errors;
}
function main(){
 const base='docs/research/csat-reading/data/v13/',local='scripts/research/csat-reading/local/v13/';
 const reg=read(base+'pilot-registration.json'),input=read(local+'pilot-input.json'),execution=read(base+'pilot-execution.json');
 for(const [p,h] of Object.entries({...reg.hashes,...execution.first_hashes}))if(sha(fs.readFileSync(p))!==h)throw Error('Frozen hash mismatch '+p);
 const a=read(base+'rater-a.json'),b=read(base+'rater-b.json'),errors=[...validateRater(a,input),...validateRater(b,input)];if(errors.length)throw Error(errors.join('\n'));
 const bs=new Map(b.items.map(x=>[x.id,x])),paired=a.items.map(x=>[x,bs.get(x.id)]);
 const cat=fn=>categorical(paired.map(([x])=>fn(x)),paired.map(([,y])=>fn(y)));
 const set=fn=>{const values=paired.map(([x,y])=>setAgreement(fn(x),fn(y)));const assessed=values.filter(x=>x.score!==null);return {n:values.length,nonempty_n:assessed.length,both_empty:values.filter(x=>x.both_empty).length,mean_jaccard:assessed.length?assessed.reduce((s,x)=>s+x.score,0)/assessed.length:null};};
 const choicePairs=paired.flatMap(([x,y])=>x.choices.map(c=>[c,y.choices.find(d=>d.n===c.n)]));
 const comparable=choicePairs.filter(([x,y])=>x.context_key===y.context_key);
 const metrics={discourse:cat(x=>x.discourse),task:cat(x=>x.task),inference:set(x=>x.inference.map(i=>i.code)),relation_presence:set(x=>x.relations_present),relation_required:set(x=>x.relations_required),choice_target_context_match:{n:choicePairs.length,comparable:comparable.length},textual_support:comparable.length?categorical(comparable.map(([x])=>x.textual_support),comparable.map(([,y])=>y.textual_support)):null,task_fit:categorical(choicePairs.map(([x])=>x.task_fit),choicePairs.map(([,y])=>y.task_fit)),limited:{}};
 for(const method of ['core_sentence','selective'])for(const goal of ['AI','FOV']){const ca=paired.map(([x])=>x.limited[method][goal].status),cb=paired.map(([,y])=>y.limited[method][goal].status),nA=ca.filter(x=>x==='sufficient').length,nB=cb.filter(x=>x==='sufficient').length,joint=ca.filter((x,i)=>x==='sufficient'&&cb[i]==='sufficient').length;metrics.limited[method+'_'+goal]={...categorical(ca,cb),positive_a:nA,positive_b:nB,positive_agreement:nA+nB?2*joint/(nA+nB):null};}
 const numeric={discourse:metrics.discourse.raw_agreement>=.8,task:metrics.task.raw_agreement>=.8,inference:metrics.inference.mean_jaccard>=.7,relations_required:metrics.relation_required.mean_jaccard>=.7,textual_support:comparable.length===choicePairs.length&&metrics.textual_support.raw_agreement>=.8&&metrics.textual_support.kappa!==null&&metrics.textual_support.kappa>=.6};
 for(const [k,v] of Object.entries(metrics.limited))numeric[k]=v.raw_agreement>=.8&&v.positive_agreement>=.7&&v.positive_a>=3&&v.positive_b>=3;
 const guards=paired.flatMap(([x,y])=>[x,y].flatMap((row,ri)=>['core_sentence','selective'].flatMap(m=>['AI','FOV'].flatMap(g=>{const l=row.limited[m][g];if(l.status!=='sufficient')return [];const p=row.paths.find(p=>p.id===l.path_id);return p?[{id:row.id,rater:ri?'B':'A',method:m,goal:g,path_id:p.id,...limitedBudget(input.items.find(i=>i.id===row.id),p,m)}]:[{id:row.id,rater:ri?'B':'A',method:m,goal:g,missing_path:true,budget_ok:false}];}))));
 const key=read(local+'pilot-key.json');const solved={A:a.items.filter(r=>key.find(k=>k.id===r.id).answer===r.solved_answer).length,B:b.items.filter(r=>key.find(k=>k.id===r.id).answer===r.solved_answer).length,n:key.length,interpretation:'Answer agreement is not sufficiency validity'};
 const result={version:'1.3',n:input.items.length,groups:new Set(input.items.map(x=>x.passage_group)).size,metrics,numeric_gate:numeric,logical_gate:'requires_separate_review',solved,positive_scope_guards:guards,disagreements:paired.filter(([x,y])=>JSON.stringify({...x,binding:null})!==JSON.stringify({...y,binding:null})).map(([x])=>x.id),population_inference:false};
 fs.writeFileSync(base+'agreement.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({n:result.n,metrics,numeric,solved},null,2));
}
if(process.argv.includes('--run'))main();
