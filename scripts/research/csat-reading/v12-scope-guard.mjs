// scripts/research/csat-reading/v12-scope-guard.mjs
// Supplement to the frozen first validator: a block ID is not a sentence budget.
import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {positive} from './v12-analysis.mjs'
export function narrowBudget(item,path){
 const units=item.units.filter(u=>path.used_units.includes(u.id))
 if(path.cells?.length){
  const cells=(item.presentation?.table?.cells||[]).filter(c=>path.cells.includes(c.id)&&c.row>0&&c.col>0)
  const rows=new Set(cells.map(c=>c.row)),cols=new Set(cells.map(c=>c.col))
  return {passed:cells.length>0&&(rows.size<=2||cols.size<=2),basis:'specified numeric rows or columns; two columns may still cover a whole chart, so not an efficiency claim',rows:rows.size,cols:cols.size}
 }
 const unknown=units.filter(u=>u.kind!=='sentence'&&!Number.isInteger(u.reading_sentence_count))
 const count=units.reduce((s,u)=>s+(u.kind==='sentence'?1:u.reading_sentence_count||0),0)
 const indices=units.map(u=>item.units.findIndex(x=>x.id===u.id)).sort((a,b)=>a-b)
 const contiguous=indices.length<=1||indices.every((x,i)=>!i||x===indices[i-1]+1)
 return {passed:!unknown.length&&count>0&&count<=2&&contiguous,sentence_count:count,unknown_block_ids:unknown.map(u=>u.id),basis:'Actual sentence budget required; unannotated multisentence blocks never count as one sentence. Notice items require a separate defined item-budget annotation.'}
}
export function derivedUnitIssues(input){return input.items.flatMap(i=>i.units.filter(u=>u.kind==='sentence'&&/^(Mr|Ms|Mrs|Dr|Prof|St)\.$/i.test(u.text.trim())).map(u=>({id:i.id,unit:u.id,issue:'honorific abbreviation split as a complete sentence',source_text_missing:false,scope:'derived segmentation defect; original characters are present'})))}
function main(){
 const dir='docs/research/csat-reading/data/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),input=read('scripts/research/csat-reading/local/v12/pilot-input.json'),flags=[]
 for(const name of ['a','b'])for(const r of read(dir+`rater-${name}.json`).items){const m=r.methods.selective;if(!positive(m.AI)&&!positive(m.FOV))continue;const p=r.paths.find(p=>p.id===m.path_id),it=input.items.find(i=>i.id===r.id),budget=narrowBudget(it,p);if(!budget.passed)flags.push({rater:name.toUpperCase(),id:r.id,method:'selective',path_id:p.id,original_AI:m.AI,original_FOV:m.FOV,budget,status:'blocked_positive_claim_original_preserved'})}
 const result={protocol:'1.2',stage:'post_first_freeze_supplement_not_revised_initial_validator',frozen_validator_errors:0,supplementary_budget_flags:flags,derived_unit_issues:derivedUnitIssues(input),countermodel:{id:'2022#44',rater:'B',known:'Only(c)=Cora',model1:'(a),(b),(d),(e)=Anna, so(c)isodd',model2:'(a),(b),(c),(d)=Cora and(e)=Anna, so(e)isodd',conclusion:'Unique four-plus-one assumption alone does not identify(c) from a single known target.',scope:'Window information, not alternative reinterpretation of the actual full original'},first_states_changed:false,DB_or_product_changed:false}
 fs.writeFileSync(dir+'scope-guard.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({positive_budget_flags:flags.length,derived_unit_issues:result.derived_unit_issues.length},null,2))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main()
