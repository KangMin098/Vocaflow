// scripts/research/csat-reading/v12-review-links.mjs
// Reproduce case-linked rows from the published profile; never replace a different registered result.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const dir='docs/research/csat-reading/data/v12/',profile=JSON.parse(fs.readFileSync(dir+'task-relation-review.json','utf8')),sources=new Map(profile.source_registry.map(s=>[s.item,s])),rows=[]
for(const task of profile.tasks)for(const c of task.support_cases){
 const source=sources.get(c.item);if(!source||source.used_input.status!=='complete'||!c.evidence_locator)throw Error(`Missing source or locator ${c.item}`)
 rows.push({item_id:c.item,task_id:task.id,relevance:c.relevance,source_checked:true,source_ref:c.source_ref,research_input_version:source.used_input.version,research_input_sha256:source.used_input.new_input_sha256??source.used_input.binding,why:c.why,evidence:[{source_ref:c.source_ref,locator:c.evidence_locator}],sufficiency:c.sufficient_for,counterexample:task.contrast_or_countercases.map(k=>({item:k.item,why:k.why,locator:k.evidence_locator})),disagreement:'single_AI_case_review_not_double_rated',human_review:false})
}
const bytes=JSON.stringify({protocol:'1.2',source_profile_sha256:createHash('sha256').update(fs.readFileSync(dir+'task-relation-review.json')).digest('hex'),rows},null,2)+'\n',out=dir+'item-task-reviewed.json'
if(fs.existsSync(out)){if(fs.readFileSync(out,'utf8')!==bytes)throw Error('Registered case-link result differs; create a new version')}
else fs.writeFileSync(out,bytes,{flag:'wx'})
console.log(JSON.stringify({rows:rows.length,direct:rows.filter(r=>r.relevance==='direct').length,indirect:rows.filter(r=>r.relevance==='indirect').length,matched_existing:true}))
