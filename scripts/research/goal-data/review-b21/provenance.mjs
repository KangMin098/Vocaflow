// scripts/research/goal-data/review-b21/provenance.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
const out='scripts/research/goal-data/review-b21/',ts=JSON.parse(fs.readFileSync(out+'transcripts.local.json')),results=[]
for(const t of ts){
 const uses=[...new Map(t.tools.filter(x=>x.type==='tool_use').map(x=>[x.id,x])).values()],direct=uses.filter(x=>['Write','Edit'].includes(x.name)&&/chunk-[AB]-\d+\.out\.json$/.test(x.input.file_path??''))
 const handback=uses.filter(x=>x.name==='SubagentHandback').map(x=>x.input.message)
 results.push({label:t.label,path:t.path,prompt_equal:t.prompt_equal,direct_edits:direct,handback,tools:uses.map(x=>({line:x.line,id:x.id,name:x.name,path:x.input.file_path,command:x.input.command,edit:x.name==='Edit'?x.input:undefined})),sha256:crypto.createHash('sha256').update(t.raw).digest('hex')})
}
const main='C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl',mainEvents=[]
for(const [i,l]of fs.readFileSync(main,'utf8').split('\n').entries()){if(!l.includes('b21-v24')&&!l.includes('a93f86f2656c694c7'))continue;try{const r=JSON.parse(l),cs=r.message?.content;if(Array.isArray(cs))for(const c of cs)if((c.type==='tool_use'||c.type==='tool_result')&&/b21-v24|a93f86f2656c694c7/.test(JSON.stringify(c)))mainEvents.push({line:i+1,...c})}catch{}}
fs.writeFileSync(out+'provenance.local.json',JSON.stringify({results,main,mainEvents},null,2))
console.log(JSON.stringify({results:results.map(r=>({label:r.label,prompt_equal:r.prompt_equal,direct_edits:r.direct_edits.length,handbacks:r.handback.length})),main:mainEvents.map(r=>({line:r.line,type:r.type,name:r.name,input:r.input})).filter(r=>r.type==='tool_use')},null,2))
