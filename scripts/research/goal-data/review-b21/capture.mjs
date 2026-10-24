// scripts/research/goal-data/review-b21/capture.mjs
import fs from 'node:fs'
const out='scripts/research/goal-data/review-b21/',home='C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents/',records=[]
for(const f of fs.readdirSync(home).filter(f=>f.endsWith('.jsonl'))){
 const raw=fs.readFileSync(home+f,'utf8');if(!raw.includes('b21-v24'))continue
 const tools=[],users=[],texts=[]
 raw.trim().split('\n').forEach((l,i)=>{const m=JSON.parse(l).message??{};let cs=m.content??[];if(typeof cs==='string')cs=[{type:'text',text:cs}];for(const c of cs){if(['tool_use','tool_result'].includes(c.type))tools.push({...c,line:i+1});else if(c.type==='text')(m.role==='user'?users:texts).push({line:i+1,text:c.text})}})
 const prompt=users.find(r=>r.text.includes('너는 Vocaflow 문항')&&r.text.includes('b21-v24'))?.text;if(!prompt)continue
 const label=/b21-v24-([AB]-0[12])/.exec(prompt)?.[1];if(!label)continue
 const preserved=fs.readFileSync('D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b21-v24/prompts/b21-v24-'+label+'.md','utf8')
 records.push({label,path:home+f,prompt_equal:prompt.trimEnd()===preserved.trimEnd(),raw,tools,texts})
}
fs.writeFileSync(out+'transcripts.local.json',JSON.stringify(records,null,2))
console.log(JSON.stringify(records.map(r=>({label:r.label,path:r.path,prompt_equal:r.prompt_equal,tools:r.tools.filter(t=>t.type==='tool_use').map(t=>({line:t.line,name:t.name,path:t.input.file_path,command:t.input.command?.slice(0,750)}))})),null,2))
