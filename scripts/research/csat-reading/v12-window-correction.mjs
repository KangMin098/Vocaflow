// scripts/research/csat-reading/v12-window-correction.mjs
// A separate corrected packet for two packaging omissions; first window input/review remain immutable.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
const dir='docs/research/csat-reading/data/v12/',local='scripts/research/csat-reading/local/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const input=read(local+'pilot-input.json'),first=read(local+'window-input.json'),output=local+'window-corrected-input.json'
if(fs.existsSync(output))throw Error('Corrected window already frozen')
const items=first.items.filter(x=>['2014B#38','2019#40'].includes(x.id)).map(w=>{
 const o=input.items.find(x=>x.id===w.id),copy=structuredClone(w)
 if(o.id==='2014B#38')copy.question_fields={blocks:o.presentation.blocks.map(b=>({label:b.label,start:b.start,end:b.end,unit_ids:o.units.filter(u=>u.start>=b.start&&u.end<=b.end).map(u=>u.id)})),given_unit_ids:o.presentation.given_sentence.unit_ids}
 else copy.question_fields={summary_sentence:o.presentation.summary_sentence,choice_columns:o.presentation.choice_columns,choice_rows:o.presentation.choice_rows,added_source_unit_ids:['u5'],note:'Summary template is explicitly added as a task stimulus, not an unrecorded body reading. Whether the method budget excludes task stimuli requires definition clarification.'}
 return copy
})
fs.writeFileSync(output,JSON.stringify({protocol:'1.2',answer_blind:true,claim_blind:true,items},null,2)+'\n')
fs.writeFileSync(dir+'window-correction-registration.json',JSON.stringify({n:2,first_input_sha256:sha(local+'window-input.json'),first_review_sha256:sha(dir+'window-review.json'),corrected_input_sha256:sha(output),originals_changed:false,reason:'Generator omitted block-label mapping and summary template. First outcomes must not be interpreted as failures of the underlying original methods.',timing:'after_first_window_result',new_ai_context:true,question_fields_explicit:true,method_budget_definition_for_summary:'unresolved; corrected packet treats boxed template as supplied task condition; no retrospective rater-status change'},null,2)+'\n');console.log('Two corrected task-stimulus packets frozen separately')
