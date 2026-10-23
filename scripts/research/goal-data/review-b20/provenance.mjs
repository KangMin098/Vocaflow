// scripts/research/goal-data/review-b20/provenance.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b20/',ts=JSON.parse(fs.readFileSync(out+'transcripts.local.json')),packets=JSON.parse(fs.readFileSync(out+'packets.local.json')).files
const results=ts.map(t=>{
 const uses=[...new Map(t.tools.filter(x=>x.type==='tool_use').map(x=>[x.id,x])).values()],byId=new Map(uses.map(x=>[x.id,x])),own=new Set(JSON.parse(packets['scripts/research/goal-data/local/b20-v24/chunk-'+t.label+'.json']).items.map(x=>x.item_id)),foreign=[...new Set(Object.entries(packets).filter(([p])=>p==='scripts/research/goal-data/local/b20-v24/input.json').flatMap(([,s])=>JSON.parse(s).rows.map(x=>x.item_id)))].filter(id=>!own.has(id))
 const edits=uses.filter(x=>['Write','Edit'].includes(x.name)).map(x=>({line:x.line,id:x.id,name:x.name,path:x.input.file_path,replace_all:x.input.replace_all??false})),direct=edits.filter(x=>/chunk-[AB]-\d+\.out\.json$/.test(x.path))
 const shell=uses.filter(x=>x.name==='Bash').map(x=>({line:x.line,command:x.input.command})),validations=t.tools.filter(x=>x.type==='tool_result'&&byId.get(x.tool_use_id)?.input?.command?.includes('d2-run.mjs b20-v24 validate')).map(x=>({line:x.line,foreign_ids:foreign.filter(id=>JSON.stringify(x.content).includes(id)),content:x.content}))
 return {label:t.label,prompt_equal:t.prompt_equal,edits,direct_output_edits:direct.length,shell,validations}
})
const pass=results.length===4&&results.every(r=>r.prompt_equal&&r.direct_output_edits===0&&r.validations.every(v=>v.foreign_ids.length===0))
fs.writeFileSync(out+'provenance.local.json',JSON.stringify({pass,results},null,2))
console.log(JSON.stringify({pass,results:results.map(r=>({label:r.label,prompt_equal:r.prompt_equal,direct_output_edits:r.direct_output_edits,foreign_ids:r.validations.flatMap(v=>v.foreign_ids)}))}))
if(!pass)process.exitCode=1
