// scripts/research/csat-reading/v14-map-select.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='docs/research/csat-reading/data/', local='scripts/research/csat-reading/local/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const out=base+'v14/map-selection.json';
if(fs.existsSync(out))throw Error('Frozen selection exists');
const paths=[local+'main-20261014/input.json',local+'v12/restore-a.json',local+'v12/restore-b.json',local+'v12/pilot-input.json',local+'v13/development-input.json',local+'v13/pilot-input.json'];
const source=new Map();
const complete=new Set(read(base+'main-20261014/source-audit.json').items.filter(x=>['body','stem','choices','presentation','answer'].every(k=>x[k]?.status==='complete')).map(x=>x.id));
for(const path of paths){const raw=read(path);for(const item of raw.items??raw){if(path.includes('main-20261014')&&!complete.has(item.id))continue;source.set(item.id,{path,item});}}
const admitted=new Set(read(base+'v13/pilot-source.json').items.filter(x=>x.status==='complete'&&x.keymatch).map(x=>x.id));
for(const [id,x]of source)if(x.path.endsWith('v13/pilot-input.json')&&!admitted.has(id))source.delete(id);
const old=[...read(base+'v12/item-task-reviewed.json').rows,...read(base+'v13/task-review.json').rows];
const reviewed=new Set(old.map(r=>`${r.item_id}/${r.task_id}`));
const candidates=fs.readFileSync(base+'v12/item-task-map.jsonl','utf8').trim().split('\n').map(JSON.parse);
const tasks=['r.central_meaning','e.option_correspondence','s.form_scope','v.contextual_sense'];
const targetTypes=[['R-TOPIC','R-FACT'],['R-NOTICE','R-GRAMMAR'],['R-CHART','R-GRAMMAR'],['R-VOCAB','R-BLANK']];
let state=202610144;const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const strata=tasks.map((task,t)=>{const pool=candidates.filter(r=>r.task_id===task&&source.has(r.item_id)&&!reviewed.has(`${r.item_id}/${task}`)).sort((a,b)=>a.item_id.localeCompare(b.item_id));const purposeful=[];for(const type of targetTypes[t]){const row=pool.find(r=>r.type_id.startsWith(type)&&!purposeful.includes(r));if(row)purposeful.push(row);}for(const row of pool)if(purposeful.length<2&&!purposeful.includes(row))purposeful.push(row);const probabilityPool=pool.filter(r=>!purposeful.includes(r)), shuffled=[...probabilityPool];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}const sample=[...purposeful.map(r=>({...r,stratum:'purposive_type_contrast',inclusion_probability:null})),...shuffled.slice(0,4).map(r=>({...r,stratum:'uniform_restricted_audit',inclusion_probability:4/probabilityPool.length}))].map(r=>({item_id:r.item_id,task_id:r.task_id,type_id:r.type_id,candidate_relevance:r.candidate_relevance,candidate_rule:r.rule,stratum:r.stratum,inclusion_probability:r.inclusion_probability}));return {task_id:task,denominator:pool.length,denominator_ids:pool.map(r=>r.item_id),probability_denominator:probabilityPool.length,probability_denominator_ids:probabilityPool.map(r=>r.item_id),sample};});
const result={version:'1.4',seed:202610144,prior_unique:reviewed.size,frame_items:source.size,frame_source_hashes:paths.map(path=>({path,sha256:hash(path)})),selection_method:'Within each TASK choose two deterministic type contrasts, then four uniform random without replacement from remaining restricted frame. Purposeful and probability estimates kept separate.',research_exposure:'All sources are previously exposed development inputs; no fresh confirmation or learner unseen claim.',strata,semantic_review_started:false,population_estimates:false};
fs.mkdirSync(base+'v14',{recursive:true});fs.mkdirSync(local+'v14',{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
const packet={version:'1.4',purpose:'Post-key development semantic mapping review; source admission inherited; no first-pilot assessment',selection_sha256:hash(out),items:[...new Set(strata.flatMap(s=>s.sample.map(r=>r.item_id)))].map(id=>source.get(id)),rows:strata.flatMap(s=>s.sample)};
fs.writeFileSync(local+'v14/map-input.json',JSON.stringify(packet,null,2)+'\n');
console.log(JSON.stringify({selection_sha256:hash(out),frame_items:source.size,prior_unique:reviewed.size,strata:strata.map(s=>({task:s.task_id,n:s.denominator,sample:s.sample.map(r=>r.item_id)}))},null,2));
