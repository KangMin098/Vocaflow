// scripts/research/goal-data/review-b19/capture.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b19/',home='C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/',rows=[]
for(const f of ['agent-a5f623598c754a2f9.jsonl','agent-ae85c0abc7657a823.jsonl','agent-a4bc78bc6f8e0dba7.jsonl','agent-a84cb6def62d50cd0.jsonl']){
 const raw=fs.readFileSync(home+f,'utf8'),tools=[],users=[],assistants=[]
 raw.trim().split('\n').forEach((l,i)=>{const m=JSON.parse(l).message??{};let cs=m.content??[];if(typeof cs==='string')cs=[{type:'text',text:cs}];for(const c of cs){if(['tool_use','tool_result'].includes(c.type))tools.push({...c,line:i+1});else if(c.type==='text')(m.role==='user'?users:assistants).push({line:i+1,text:c.text})}})
 const prompt=users.find(x=>x.text.includes('너는 Vocaflow 문항')).text,label=/b19-v24-([AB]-0[12])/.exec(prompt)[1],preserved=fs.readFileSync('D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b19-v24/prompts/b19-v24-'+label+'.md','utf8')
 rows.push({label,path:home+f,raw,prompt_equal:prompt.trimEnd()===preserved.trimEnd(),tools,assistants})
}
fs.writeFileSync(out+'transcripts.local.json',JSON.stringify(rows,null,2))
fs.writeFileSync(out+'transcript-concise.local.json',JSON.stringify(rows.map(({raw,...r})=>r),null,2))
console.log(rows.map(r=>({label:r.label,prompt_equal:r.prompt_equal,tools:r.tools.length})))
for(const r of rows){console.log('\n'+r.label+' '+r.path);for(const t of r.tools.filter(t=>t.type==='tool_use'))console.log(t.line,t.name,JSON.stringify(t.input).slice(0,230));console.log(r.assistants.at(-1))}
