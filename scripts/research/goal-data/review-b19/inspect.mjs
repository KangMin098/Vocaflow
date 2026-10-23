// scripts/research/goal-data/review-b19/inspect.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b19/',a=JSON.parse(fs.readFileSync(out+'audit.local.json'))
for(const d of a.dossier){console.log('\n'+d.id+' '+d.input.type_id+' '+d.evidence.join(' '));console.log(JSON.stringify(d.input.source));for(const [t,r]of Object.entries(d.judgments))console.log(t,JSON.stringify({primary:r.primary_task,reason:r.primary_reason,path:r.answer_logic,links:r.links.filter(l=>l.relevance!=='not_applicable'),assessment:r.independent_assessment,observable:r.directly_observable,not_observable:r.not_observable}))}
