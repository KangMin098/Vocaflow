// scripts/research/goal-data/review-b21/deep.mjs
import fs from 'node:fs'
import {out,base,doc,at,json,hash,snap,execute,check,checks,inp,tracks} from './audit.mjs'
const regenerated=[]
for(const file of ['scripts/research/goal-data/d2-combine.mjs','scripts/research/goal-data/d3-build.mjs']){
 if(file.endsWith('d3-build.mjs')){
  const p='D:/workspace/Vocaflow-map-data-expansion/scripts/csat/map/v62/data/local/'
  for(const f of fs.readdirSync(p).filter(f=>f.endsWith('.json')))snap.files[base+'pilot-1/'+f]=fs.readFileSync(p+f,'utf8')
 }
 const res=await execute(file);check(file+' execution',!res.error,res.error)
 for(const [p,s]of Object.entries(res.writes)){let a=at(p),b=s;if(p.endsWith('.json')){a=JSON.parse(a);b=JSON.parse(b);delete a.generated_at;delete b.generated_at;a=JSON.stringify(a);b=JSON.stringify(b)}check('rebuild '+p,a===b);regenerated.push({path:p,sha256:hash(s),equal:a===b})}
}
const norm=s=>s.replace(/_{2,}/g,'').replace(/\s+/g,''),rows=Object.entries(snap.files).filter(([p])=>p.endsWith('/input.json')&&!p.includes('b9t-')).flatMap(([p,s])=>JSON.parse(s).rows.map(r=>({...r,batch:p.split('/').at(-2)}))),byId=new Map(rows.map(r=>[r.item_id,r]))
const pairs=[]
for(const a of byId.values())if(!/_{2,}/.test(a.source.passage))for(const b of byId.values())if(a.exam_id===b.exam_id&&a.item_id!==b.item_id&&/_{2,}/.test(b.source.passage)&&norm(a.source.passage)===norm(b.source.passage))pairs.push({missing:a.item_id,sibling:b.item_id})
const raw=[]
for(const [exam,p,pattern]of [['2014A','D:/workspace/Vocaflow/scripts/csat/data/columns/2014A.txt',/In business and life/],['M1809','D:/workspace/Vocaflow/scripts/csat/data/columns2/M1809.txt',/supported by environmental/]]){const s=fs.readFileSync(p,'utf8'),lines=s.split('\n'),n=lines.findIndex(l=>pattern.test(l));raw.push({exam,path:p,sha256:hash(s),line:n+1,text:lines.slice(n-1,n+3).join('\n')});const a=byId.get(exam+'#41'),b=byId.get(exam+'#42');check(exam+' blank paired identity',norm(a.source.passage)===norm(b.source.passage)&&!/_{2,}/.test(a.source.passage)&&/_{2,}/.test(b.source.passage))}
const main='C:/Users/Administrator/.claude/projects/d--workspace-Vocaflow/c4d62ec5-d73f-4d51-898b-475f87e9be60.jsonl',ml=fs.readFileSync(main,'utf8').split('\n'),history=[6776,6778,6787,6792,6907,6913,6914].map(n=>({line:n,record:JSON.parse(ml[n-1])}))
check('local packets unchanged',Object.entries(snap.files).filter(([p])=>!p.startsWith(base+'pilot-1/')).every(([p,s])=>fs.readFileSync('D:/workspace/Vocaflow-goal-data/'+p,'utf8')===s))
const order=inp.rows.filter(i=>/ORDER/.test(i.type_id)).map(i=>({id:i.item_id,A:tracks.A.find(r=>r.item_id===i.item_id).links.find(l=>l.task_id==='r.discourse_structure').relevance,B:tracks.B.find(r=>r.item_id===i.item_id).links.find(l=>l.task_id==='r.discourse_structure').relevance}))
fs.writeFileSync(out+'deep.local.json',JSON.stringify({checks,regenerated,pairs,raw,history,order},null,2))
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(c=>!c.pass),regenerated,pairs,raw,order},null,2))
