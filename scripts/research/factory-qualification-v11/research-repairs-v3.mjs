// scripts/research/factory-qualification-v11/research-repairs-v3.mjs
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {hash,repairActivity} from './research-repairs.mjs';
const LOCAL='scripts/research/factory-qualification-v11/local/';
export function validateCoverage(activity,config,referencePrompt){
 if(typeof activity.student_prompt!=='string'||!activity.student_prompt.length)throw Error('Missing learner instruction');
 if(referencePrompt!==undefined&&activity.student_prompt!==referencePrompt)throw Error('Original requested outputs changed');
 const facets=new Set(activity.analytic_rubric.map(f=>f.facet));const covered=new Set();
 if(!Array.isArray(config.output_crosswalk)||config.output_crosswalk.length===0)throw Error('Missing output crosswalk');
 for(const row of config.output_crosswalk){
  if(typeof row.request!=='string'||!row.request.length)throw Error('Missing explicit learner request');
  for(const f of row.facets){
   if(!facets.has(f)||!Array.isArray(row.required_components[f])||row.required_components[f].length===0)throw Error('Missing rubric component binding');
   covered.add(f);
  }
 }
 if([...facets].some(f=>!covered.has(f)))throw Error('Unbound scored facet');
 return true;
}
export function run(root,check=false){
 const bytes=p=>fs.readFileSync(path.join(root,p)),read=p=>JSON.parse(bytes(p));
 const previousPath=LOCAL+'research-repairs-v2-packet.json',firstPath=LOCAL+'revision2-review-first.json';
 if(hash(bytes(previousPath))!=='c64b9b5cbb13388dc240a2e833a023443684ba146a795aaf1055b40185934939')throw Error('Repair2 artifact drift');
 if(hash(bytes(firstPath))!=='7da1d79cc869c855a7f882a994060a1ca9a5794359a5c7f302e4d163a2b92fa3')throw Error('Second independent first drift');
 const old=read(previousPath),first=read(firstPath),config=read(LOCAL+'research-repairs-v3-config.json');
 const activities=config.activities.map(c=>{
  const original=old.activities.find(a=>a.activity_id===c.activity_id);if(!original)throw Error('Missing prior activity');
  if(c.issue_ids.some(id=>!first.findings.some(f=>f.id===id&&f.activity===c.activity_id)))throw Error('Unbound second finding');
  const repaired=repairActivity(original.repaired,c);repaired.revision=config.version;
  repaired.repair_issue_ids=[...original.repaired.repair_issue_ids,...c.issue_ids];
  validateCoverage(repaired,c,original.repaired.student_prompt);
  repaired.required_output_crosswalk=c.output_crosswalk;
  return {activity_id:c.activity_id,previous:original.repaired,repaired,supplied_source:original.supplied_source,
   independent_issue_ids:c.issue_ids,cases:c.cases,remaining:c.remaining};
 });
 const packet={version:config.version,population:'synthetic_not_student',previous:{path:previousPath,sha256:hash(bytes(previousPath))},
  second_independent_first:{path:firstPath,sha256:hash(bytes(firstPath))},unchanged_supported_activities:first.activity_reviews.filter(a=>a.status==='bounded_semantic_repair_supported').map(a=>a.id),activities};
 const blind={version:config.version,population:packet.population,activities:activities.map(a=>({activity_id:a.activity_id,item_id:a.repaired.item_id,repaired:a.repaired,supplied_source:a.supplied_source,cases:a.cases.map(({expected,...c})=>c)}))};
 const enc=x=>JSON.stringify(x,null,2)+'\n';const out={[LOCAL+'research-repairs-v3-packet.json']:enc(packet),[LOCAL+'research-repairs-v3-blind.json']:enc(blind)};
 const summary={version:config.version,previous:packet.previous,second_independent_first:packet.second_independent_first,
  configuration:{path:LOCAL+'research-repairs-v3-config.json',sha256:hash(bytes(LOCAL+'research-repairs-v3-config.json'))},
  repair_packet:{path:LOCAL+'research-repairs-v3-packet.json',sha256:hash(out[LOCAL+'research-repairs-v3-packet.json'])},blind_packet:{path:LOCAL+'research-repairs-v3-blind.json',sha256:hash(out[LOCAL+'research-repairs-v3-blind.json'])},
  unchanged_supported_activities:packet.unchanged_supported_activities,
  activities:activities.map(a=>({activity_id:a.activity_id,item_id:a.repaired.item_id,task_id:a.repaired.task_id,previous_artifact_sha256:hash(JSON.stringify(a.previous)),new_artifact_sha256:hash(JSON.stringify(a.repaired)),source:a.repaired.source,independent_issue_ids:a.independent_issue_ids,scored_facets:a.repaired.analytic_rubric.map(f=>f.facet),case_states:a.cases.map(c=>({id:c.id,facet:c.facet,state:c.expected,provenance:c.id.includes('-a')?'used_discovery_countercase':'novel_synthetic'})),remaining:a.remaining})),
  counts:{new_artifacts:2,unchanged_supported_prior_artifacts:2,new_issue_ids:3,used_countercases:3,novel_synthetic_cases:5,new_independent_reviews:0,human_reviews:0,students:0,public_qualified:0,assessment_qualified:0},
  status:'third repair revision sealed; fresh independent review pending; previous artifacts/first statuses retained'};
 out['docs/research/factory-qualification-v11/data/research-repairs-v3.json']=enc(summary);
 for(const[p,text]of Object.entries(out)){const abs=path.join(root,p);if(check||fs.existsSync(abs)){if(!fs.existsSync(abs)||fs.readFileSync(abs,'utf8')!==text)throw Error('Frozen repair3 drift '+p);}else{fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,text);}}
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(run(process.cwd(),process.argv.includes('--check')).counts));
