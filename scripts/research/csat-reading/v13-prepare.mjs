// scripts/research/csat-reading/v13-prepare.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base='docs/research/csat-reading/',out=base+'data/v13/',local='scripts/research/csat-reading/local/v13/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=x=>createHash('sha256').update(x).digest('hex');
export function selectPilot(rows,old){
 const groups=new Set(old.map(x=>x.passage_group)), ids=new Set(old.map(x=>x.id));
 const excluded=new Set(rows.filter(x=>groups.has(x.passage_group)||ids.has(x.id)||x.previously_exposed||['2019#27','2019#28'].includes(x.id)).map(x=>x.normalized_passage_sha256));
 const pool=rows.filter(x=>x.kind==='suneung'&&x.set==='discovery'&&x.public_v3&&!groups.has(x.passage_group)&&!excluded.has(x.normalized_passage_sha256)&&x.db_passage_matches&&x.db_stem_matches&&x.db_answer_matches);
 const selected=[],counts=new Map();
 for(const type of ['R-PURPOSE','R-TOPIC','R-TITLE','R-BLANK','R-ORDER','R-INSERT','R-SUMMARY','R-VOCAB','R-GRAMMAR','R-FACT','R-CHART','R-IRRELEVANT']){
  const next=pool.filter(x=>x.type===type&&!selected.some(y=>y.passage_group===x.passage_group)).sort((a,b)=>(counts.get(a.exam)||0)-(counts.get(b.exam)||0)||hash('csat-v13-20261014:'+a.id).localeCompare(hash('csat-v13-20261014:'+b.id)))[0];
  if(!next)throw Error('No fresh '+type);selected.push(next);counts.set(next.exam,(counts.get(next.exam)||0)+1);
 }
 return {pool,selected};
}
if(process.argv.includes('--run')){
 if(fs.existsSync(out+'registration.json'))throw Error('Registered v1.3 preparation cannot be overwritten');
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(local,{recursive:true});
 const previous=read(base+'data/v12/artifacts.json'),frozen={};
 for(const [p,b] of Object.entries(previous.files)){const actual=hash(fs.readFileSync(p));if(actual!==b.sha256)throw Error('Prior artifact changed '+p);frozen[p]=actual;}
 frozen[base+'data/v12/artifacts.json']=hash(fs.readFileSync(base+'data/v12/artifacts.json'));
 const old=[...read(base+'data/pilot-manifest.json'),...read(base+'data/main-20261014/manifest.json'),...read(base+'data/v12/pilot-selection.json')];
 if(new Set(old.map(x=>x.id)).size!==80)throw Error('Old unique denominator');
 const {pool,selected}=selectPilot(read(base+'data/item-manifest.json'),old);
 const raw=read('scripts/research/csat-reading/local/snapshots/20261012-r0/db-corpus.json'),rawBy=new Map(raw.items.map(x=>[x.id,x]));
 const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
 write(out+'pilot-selection.json',selected.map(x=>({id:x.id,exam:x.exam,type:x.type,passage_group:x.passage_group,source_binding:x.source_binding_sha256})));
 write(local+'pilot-raw-input.json',{version:'1.3-preflight',items:selected.map(x=>({id:x.id,passage_group:x.passage_group,type_id:x.type,old_binding:x.source_binding_sha256,passage:rawBy.get(x.id).passage,stem:rawBy.get(x.id).stem,choices:rawBy.get(x.id).choices}))});
 write(local+'pilot-key.json',selected.map(x=>({id:x.id,answer:rawBy.get(x.id).answer})));
 const bindings=['C:/Users/Administrator/Downloads/Vocaflow_CSAT_Learning_Map_v6_2_CANON.md','C:/Users/Administrator/Downloads/Vocaflow_v6_2_Implementation_Handoff.md','docs/csat-learner/v4/workspaces.json','docs/csat-learner/v4/codebook.json','docs/csat-learner/v4/relations.json','apps/web/src/lib/csat/inquiry-data.json','apps/web/src/lib/csat/compare-v3-data.json'];
 write(out+'registration.json',{version:'1.3',task:'T-0027',date:'2026-10-14',old_head:'cdb799775',old_unique:80,previous_artifact_hashes:frozen,asset_hashes:Object.fromEntries(bindings.map(p=>[p,hash(fs.readFileSync(p))])),protocol_sha256:hash(fs.readFileSync(base+'PROTOCOL-v1.3.md')),selection_code_sha256:hash(fs.readFileSync('scripts/research/csat-reading/v13-prepare.mjs')),selection_sha256:hash(fs.readFileSync(out+'pilot-selection.json')),pool_n:pool.length,pilot_n:12,pilot_groups:new Set(selected.map(x=>x.passage_group)).size,key_sha256:hash(fs.readFileSync(local+'pilot-key.json')),initial_semantic_classification:'not_started',recent_read_for_selection:false});
 console.log(JSON.stringify({old_unique:80,pool:pool.length,selected:selected.map(x=>x.id),prior_files:Object.keys(frozen).length}));
}
