// scripts/research/goal-data/review-b13/transcripts.mjs
// Capture only the four identified b13 analyst sessions; do not query processes.
import fs from 'node:fs'
import {out,read,base,checks,check} from './audit.mjs'
const dir='C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60/subagents'
const agents={A01:'a3cba8c54d7591738',A02:'a5335fc75c7124e82',B01:'a21108585f09b5403',B02:'abad50d2d5cd12cdd'}
const captures=Object.entries(agents).map(([label,id])=>{const p=dir+'/agent-'+id+'.jsonl';return {label,path:p,raw:fs.readFileSync(p,'utf8')}})
fs.writeFileSync(out+'transcripts.local.json',JSON.stringify(captures,null,2)+'\n')
const summary=[]
for(const c of captures){const rows=c.raw.trim().split('\n').map(JSON.parse);const u=rows.find(r=>r.type==='user'),prompt=read(base+`b13-v24/prompts/b13-v24-${c.label[0]}-${c.label.slice(1)}.md`);check(c.label+' dispatched saved prompt',u.message.content.trimEnd()===prompt.trimEnd());const tools=rows.flatMap((r,i)=>(Array.isArray(r.message?.content)?r.message.content:[]).filter(b=>b.type==='tool_use').map(b=>({line:i+1,name:b.name,input:b.input})));const report=tools.find(t=>t.name==='SubagentHandback');const commands=tools.filter(t=>['Bash','Read'].includes(t.name));summary.push({label:c.label,path:c.path,prompt_equal:u.message.content.trimEnd()===prompt.trimEnd(),report,commands});}
fs.writeFileSync(out+'transcript-summary.local.json',JSON.stringify({summary,checks},null,2)+'\n')
console.log(JSON.stringify(summary.map(s=>({label:s.label,prompt_equal:s.prompt_equal,report_line:s.report?.line,report:s.report?.input.message,reads:s.commands.filter(c=>c.name==='Read')})),null,2))
