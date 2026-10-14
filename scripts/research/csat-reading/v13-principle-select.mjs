// scripts/research/csat-reading/v13-principle-select.mjs
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base='docs/research/csat-reading/data/';
const sourcePath=base+'v12/principle-task-review.json';
const x=read(sourcePath), priority=new Set(['r.central_meaning','e.option_correspondence','s.form_scope','v.contextual_sense']);
const eligible=x.items.filter(i=>i.pair_id.split('~').every(id=>/^20(1[4-9]|2[0-4])[AB]?#/.test(id))&&i.task_links.some(t=>priority.has(t.ID)));
const selected=eligible.slice().sort((a,b)=>a.source_ordinal-b.source_ordinal).slice(0,8);
const out={version:'v1.3',selection_basis:'metadata only; both endpoints 2014–2024 CSAT main, priority TASK semantic candidates inherited v1.2, ascending original ordinal; maximum8; local source availability checked next',source_path:sourcePath,source_sha256:createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex'),denominator:110,eligible:eligible.length,selected:selected.map(i=>({pair_id:i.pair_id,ordinal:i.source_ordinal,principle_sha256:i.original_principle_sha256,types:i.original_types,task_ids:i.task_links.map(t=>t.ID)})),ledger:x.items.map(i=>({pair_id:i.pair_id,status:selected.some(s=>s.pair_id===i.pair_id)?'selected_pending_source':eligible.some(s=>s.pair_id===i.pair_id)?'eligible_not_selected':'excluded_endpoint_scope_or_priority',reviewed:false}))};
const target=base+'v13/principle-selection.json';
if(fs.existsSync(target))throw Error('Registered selection exists; no overwrite');
fs.mkdirSync(base+'v13',{recursive:true});fs.writeFileSync(target,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({eligible:eligible.length,selected:out.selected},null,2));
