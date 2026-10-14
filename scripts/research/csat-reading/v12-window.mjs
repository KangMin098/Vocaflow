// scripts/research/csat-reading/v12-window.mjs
// Post-first-freeze window-only AI test; excludes keys, full outside-window text and rater claims.
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {assertHash} from './agreement.mjs'
const dir='docs/research/csat-reading/data/v12/',local='scripts/research/csat-reading/local/v12/',read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=x=>createHash('sha256').update(x).digest('hex')
const ex=read(dir+'pilot-execution.json');for(const [file,h]of Object.entries(ex.hashes))assertHash(fs.readFileSync(file),h,file)
const b=read(dir+'rater-b.json'),input=read(local+'pilot-input.json'),positive=x=>['sufficient','conditional'].includes(x)
const preference=['core_sentence','selective','syntax','contrast','incremental','meaning_units','proposition_relations','structure_reconstruction','evidence_option_comparison','type_specific']
const windows=[],manifest=[]
for(const item of input.items){
 const r=b.items.find(r=>r.id===item.id)
 const candidates=preference.map((m,i)=>({method:m,index:i,state:r.methods[m],path:r.paths.find(p=>p.id===r.methods[m].path_id)})).filter(x=>positive(x.state.AI)&&x.path).sort((a,b)=>a.index-b.index)
 const selected=candidates[0];if(!selected)continue
 const p=selected.path,units=item.units.filter(u=>p.used_units.includes(u.id)),cells=(item.presentation.table?.cells||[]).filter(c=>p.cells.includes(c.id)),glosses=item.glosses.filter(g=>p.gloss_ids.includes(g.id))
 windows.push({id:item.id,stem:item.stem,choices:item.choices,units:units.map(u=>({id:u.id,text:u.text,start:u.start,end:u.end,kind:u.kind})),cells,glosses,presentation_cues:{kind:item.presentation.kind,underline_spans:(item.presentation.underline_spans||[]).filter(s=>units.some(u=>s.start>=u.start&&s.end<=u.end)),insertion_slots:item.presentation.insertion_slots,block_labels:item.presentation.block_labels},source_binding:item.source_binding,scope:'Only supplied window, question and options. Do not infer omitted text from prior familiarity.'})
 manifest.push({id:item.id,source_rater:'B',method:selected.method,path_id:p.id,used_units:p.used_units,cells:p.cells,gloss_ids:p.gloss_ids,original_units:item.units.length,supplied_units:units.length,partial:units.length<item.units.length,first_claim_AI:selected.state.AI,first_claim_FOV:selected.state.FOV})
}
const out=local+'window-input.json';if(fs.existsSync(out))throw Error('Window input already exists; no rewrite')
fs.writeFileSync(out,JSON.stringify({protocol:'1.2',answer_blind:true,claim_blind:true,items:windows},null,2)+'\n')
fs.writeFileSync(dir+'window-registration.json',JSON.stringify({method:'Post-first-submission exploratory verification; B first positive method in fixed preference order. Keys and first claims omitted. Source all text already read by A/B, fresh verifier sees supplied windows only.',n:windows.length,partial_windows:manifest.filter(m=>m.partial).length,input_sha256:sha(fs.readFileSync(out)),manifest,student_effect_test:false},null,2)+'\n')
console.log(JSON.stringify({n:windows.length,partial:manifest.filter(m=>m.partial).length,chosen:manifest.map(x=>({id:x.id,method:x.method,units:x.supplied_units,original:x.original_units}))},null,2))
