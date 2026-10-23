// scripts/research/goal-data/review-b20/inspect.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b20/',d=JSON.parse(fs.readFileSync(out+'dossier.local.json'))
const packets=JSON.parse(fs.readFileSync(out+'packets.local.json')).files
const input=JSON.parse(packets['scripts/research/goal-data/local/b20-v24/input.json'])
const n=Number(process.argv[2]??0)
for(const r of d.slice(n,n+3)){
 const slim=j=>({primary:j.primary_task,reason:j.primary_reason,path:j.decision_path,answer:j.answer_logic,links:j.links.map(l=>({task:l.task_id,relevance:l.relevance,why:l.why})),distractors:j.distractors,observable:j.directly_observable,eligibility:j.independent_assessment})
 console.log(JSON.stringify({id:r.id,source:r.input.source,A:slim(r.judgments.A),B:slim(r.judgments.B)}))
}
if(n===18){
 const id='M1809#26';console.log(JSON.stringify(input.rows.find(r=>r.item_id===id)))
}
