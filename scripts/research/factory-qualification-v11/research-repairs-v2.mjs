// scripts/research/factory-qualification-v11/research-repairs-v2.mjs
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {hash,repairActivity} from './research-repairs.mjs';
const LOCAL='scripts/research/factory-qualification-v11/local/';
export function componentState({available=true,observed=[],required=[],errors=[]}){
 if(!available||!observed.length)return 'defer';
 if(errors.length)return 'defect';
 const correct=new Set(observed.filter(v=>required.includes(v)));
 if(!correct.size)return 'defer';
 return correct.size===new Set(required).size?'meets':'partial';
}
export function run(root,check=false){
 const bytes=p=>fs.readFileSync(path.join(root,p)),read=p=>JSON.parse(bytes(p));
 const oldPath=LOCAL+'research-repairs-packet.json',reviewPath=LOCAL+'independent-research-first.json';
 if(hash(bytes(oldPath))!=='6c155d761f614cb0ef05a048acacc59533c24c3febc131ec89bdaa09c9868cd4')throw Error('Repair1 drift');
 if(hash(bytes(reviewPath))!=='0c792fc0d4280121eaf3b9b07be883cf1e72918faf430051c2c913040c0b31e0')throw Error('Independent first drift');
 const review=read(reviewPath);
 if(!review.sealed||review.input_sha256!=='560872546dbdd945df9aa53ddf772275fa6500848fb6deac6e4d872a17350666')throw Error('Unsealed or mismatched independent first');
 const config=read(LOCAL+'research-repairs-v2-config.json'),old=read(oldPath);
 const activities=config.activities.map(c=>{
  const prior=old.activities.find(a=>a.repaired.activity_id===c.activity_id);
  if(!prior)throw Error('Missing previous artifact');
  const repaired=repairActivity(prior.repaired,c);repaired.revision=config.version;
  repaired.repair_issue_ids=[...prior.repaired.repair_issue_ids,...c.issue_ids];
  return {activity_id:c.activity_id,previous:prior.repaired,repaired,supplied_source:prior.supplied_source,
   independent_issue_ids:c.issue_ids,synthetic_cases:c.new_cases,remaining:c.remaining};
 });
 if(activities.flatMap(a=>a.independent_issue_ids).some(id=>!review.review.issues.some(i=>i.id===id)))throw Error('Unbound independent issue');
 const packet={version:config.version,population:'synthetic_not_student',previous:{path:oldPath,sha256:hash(bytes(oldPath))},
  independent_first:{path:reviewPath,sha256:hash(bytes(reviewPath)),first_status:'4HOLD preserved'},activities};
 const blind={version:config.version,population:packet.population,activities:activities.map(a=>({activity_id:a.activity_id,
  item_id:a.repaired.item_id,repaired:a.repaired,supplied_source:a.supplied_source,
  cases:a.synthetic_cases.map(({expected,...c})=>c)}))};
 const enc=x=>JSON.stringify(x,null,2)+'\n';
 const out={[LOCAL+'research-repairs-v2-packet.json']:enc(packet),[LOCAL+'research-repairs-v2-blind.json']:enc(blind)};
 const summary={version:config.version,previous:packet.previous,independent_first:packet.independent_first,
  config:{path:LOCAL+'research-repairs-v2-config.json',sha256:hash(bytes(LOCAL+'research-repairs-v2-config.json'))},
  repair_packet:{path:LOCAL+'research-repairs-v2-packet.json',sha256:hash(out[LOCAL+'research-repairs-v2-packet.json'])},
  blind_packet:{path:LOCAL+'research-repairs-v2-blind.json',sha256:hash(out[LOCAL+'research-repairs-v2-blind.json'])},
  activities:activities.map(a=>({activity_id:a.activity_id,item_id:a.repaired.item_id,task_id:a.repaired.task_id,
   previous_artifact_sha256:hash(JSON.stringify(a.previous)),new_artifact_sha256:hash(JSON.stringify(a.repaired)),
   source:a.repaired.source,independent_issue_ids:a.independent_issue_ids,
   modified_facets:a.previous.analytic_rubric.filter(f=>JSON.stringify(f)!==JSON.stringify(a.repaired.analytic_rubric.find(n=>n.facet===f.facet))).map(f=>f.facet),
   cases:a.synthetic_cases.map(c=>({id:c.id,facet:c.facet,expected:c.expected,provenance:c.id.includes('-a')?'used_discovery_countercase':'novel_synthetic'})),remaining:a.remaining})),
  counts:{activities:4,new_issues_resolved_by_author:5,prior_independent_HOLD:4,
   used_countercases:activities.flatMap(a=>a.synthetic_cases).filter(c=>c.id.includes('-a')).length,
   novel_synthetic_cases:activities.flatMap(a=>a.synthetic_cases).filter(c=>c.id.includes('-n')).length,
   new_independent_reviews:0,human_reviewers:0,learners:0,public_qualified:0,assessment_qualified:0},
  status:'second repair revision sealed; fresh independent verification pending; previous firsts unchanged'};
 out['docs/research/factory-qualification-v11/data/research-repairs-v2.json']=enc(summary);
 for(const[p,text]of Object.entries(out)){
  const abs=path.join(root,p);if(check||fs.existsSync(abs)){if(!fs.existsSync(abs)||fs.readFileSync(abs,'utf8')!==text)throw Error('Frozen repair2 drift '+p);}
  else{fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,text);}
 }return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(run(process.cwd(),process.argv.includes('--check')).counts));
