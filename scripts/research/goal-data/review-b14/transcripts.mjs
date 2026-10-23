// scripts/research/goal-data/review-b14/transcripts.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b14/'
const dir='C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/'
const captures=[],summary=[]
for(const id of ['a1f1dd2c1cbec0e30','a8296655e51909765','a93e38f49b5b7961a','aefe18a07b0542b73']){
 const file=dir+'agent-'+id+'.jsonl',raw=fs.readFileSync(file,'utf8'),rows=raw.trim().split('\n').map(JSON.parse),u=rows.find(r=>r.type==='user')
 const label=/b14-v24-([AB]-0[12])/.exec(u.message.content)[1]
 const tools=rows.flatMap((r,i)=>(Array.isArray(r.message?.content)?r.message.content:[]).filter(b=>b.type==='tool_use').map(b=>({line:i+1,name:b.name,input:b.input})))
 const saved=fs.readFileSync('D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b14-v24/prompts/b14-v24-'+label+'.md','utf8')
 captures.push({label,path:file,raw});summary.push({label,path:file,prompt_equal:u.message.content.trimEnd()===saved.trimEnd(),tools})
}
fs.writeFileSync(out+'transcripts.local.json',JSON.stringify(captures,null,2)+'\n')
fs.writeFileSync(out+'transcript-summary.local.json',JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify(summary.map(s=>({label:s.label,prompt_equal:s.prompt_equal,path:s.path}))))
