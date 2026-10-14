// scripts/research/csat-reading/v13-source-repair.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {deriveUnits,informationBudget} from './v13-source-units.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const oldPath='scripts/research/csat-reading/local/v12/pilot-input.json',out='docs/research/csat-reading/data/v13/source-repair.json',newPath='scripts/research/csat-reading/local/v13/development-input.json';
if(fs.existsSync(out)||fs.existsSync(newPath))throw Error('Registered source repair cannot be overwritten');
const oldBytes=fs.readFileSync(oldPath),old=read(oldPath),items=old.items.map(original=>{
  const item=structuredClone(original);delete item.source_binding;
  const forcedEnds=original.id==='2016#25'?[original.passage.indexOf('B.C.')+4]:[];
  item.previous_source_binding=original.source_binding;item.derived_version='1.3-source-r1';item.previous_units=original.units.map(({id,start,end,kind})=>({id,start,end,kind}));item.boundary_overrides=forcedEnds.map(end=>({end,reason:'B.C. closes this printed sentence; general initials protection would incorrectly merge following Interestingly.'}));item.units=deriveUnits(original,{forcedEnds});
  for(const key of ['given_sentence','summary_sentence'])if(item.presentation[key])item.presentation[key].unit_ids=item.units.filter(u=>u.start>=item.presentation[key].start&&u.end<=item.presentation[key].end).map(u=>u.id);
  for(const b of item.presentation.blocks??[])b.unit_ids=item.units.filter(u=>u.start>=b.start&&u.end<=b.end).map(u=>u.id);
  item.derived_status='mechanically_valid_manual_review_required';item.source_binding=sha(JSON.stringify(item));
  if(item.passage!==original.passage)throw Error('Passage changed');
  for(const u of item.units)if(item.passage.slice(u.start,u.end)!==u.text)throw Error('Offset mismatch '+item.id);
  return item;
});
const book=read('docs/csat-learner/v4/codebook.json'),rels=read('docs/csat-learner/v4/relations.json'),work=read('docs/csat-learner/v4/workspaces.json'),ids=new Set(book.tasks.map(t=>t.id)),rids=new Set(rels.relations.map(t=>t.id));
const workspaces={path:'docs/csat-learner/v4/workspaces.json',sha256:sha(fs.readFileSync('docs/csat-learner/v4/workspaces.json')),templates:work.templates.length,task_catalog:ids.size,missing_task_refs:work.templates.flatMap(w=>[...w.core,...w.support].filter(t=>!ids.has(t)).map(t=>({workspace:w.id,task:t}))),missing_relation_refs:work.templates.flatMap(w=>w.relations.filter(r=>!rids.has(r)).map(r=>({workspace:w.id,relation:r}))),readiness:work.templates.reduce((s,w)=>(s[w.readiness]=(s[w.readiness]??0)+1,s),{}),runtime_verified:false,learner_validated:false,templates_summary:work.templates.map(w=>({id:w.id,core:w.core,support:w.support,readiness:w.readiness,hold:w.hold,quantities_and_criteria:'static_design_candidates_not_validated_measurement',criterion_source_field:w.criterion}))};
fs.mkdirSync('scripts/research/csat-reading/local/v13',{recursive:true});fs.mkdirSync('docs/research/csat-reading/data/v13',{recursive:true});
fs.writeFileSync(newPath,JSON.stringify({version:'1.3-source-r1',answer_blind:true,development_only:true,items},null,2)+'\n');
const audit={version:'1.3',old_input_sha256:sha(oldBytes),derived_input_sha256:sha(fs.readFileSync(newPath)),helper_sha256:sha(fs.readFileSync('scripts/research/csat-reading/v13-source-units.mjs')),old_inputs_unchanged:sha(fs.readFileSync(oldPath))===sha(oldBytes),items:items.map((it,i)=>({id:it.id,previous_binding:it.previous_source_binding,new_binding:it.source_binding,passage_sha256:sha(it.passage),passage_unchanged:it.passage===old.items[i].passage,old_units:old.items[i].units.length,new_units:it.units.length,punctuation_sentence_units:it.units.reduce((n,u)=>n+u.sentence_count,0),role_counts:it.units.reduce((s,u)=>(s[u.role]=(s[u.role]??0)+1,s),{}),units:it.units.map(({id,start,end,role,block_label,kind,sentence_count})=>({id,start,end,role,block_label,kind,sentence_count})),old_to_new:old.items[i].units.map(u=>({old:u.id,new:it.units.filter(s=>s.end>u.start&&s.start<u.end).map(s=>s.id)})),status:'mechanically_valid_manual_review_required'})),workspaces,budget_examples:[{item:'2024#35',...informationBudget(items.find(i=>i.id==='2024#35'),[],['c1','c2','c3','c4','c5'])}],limits:['Punctuation units are an operational budget unit, not guaranteed independent propositions or syntactically complete sentences.','No new item classification or strategy success inference.','Original source admission inherited; selected boundary regions require new PDF comparison.','Table transcription is derived from bars; a cell budget is not the visual reading cost.','Independent reference access must be explicitly declared; no automatic resolution.']};
fs.writeFileSync(out,JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit.items.map(i=>({id:i.id,old:i.old_units,new:i.new_units,roles:i.role_counts})),null,2));
