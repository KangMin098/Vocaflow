// scripts/research/goal-data/review/inspect.mjs
import fs from 'node:fs'
const base='D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b2-v2/'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const lines=p=>fs.readFileSync(p,'utf8').trim().split(/\r?\n/).map(JSON.parse)
const d='docs/research/goal-data-batches/'
const originals=read(base+'input.json').rows
const tracks={}
for(const t of ['A','B']) tracks[t]=[1,2,3,4].flatMap(n=>read(base+`chunk-${t}-0${n}.out.json`).rows)
const r1=lines(d+'D2-task-mapping/b2-v2-item-task-links.jsonl')
const disputes=lines(d+'D2-task-mapping/b2-v2-disputed-links.jsonl')
function spread(a,n){return Array.from({length:n},(_,i)=>a[Math.floor(i*a.length/n)])}
const selectedR1=spread(r1,30)
const r3=disputes.filter(x=>x.display==='R3')
const selectedDisputes=[...r3,...spread(disputes.filter(x=>x.display!=='R3'),30-r3.length)]
const rows=[...selectedR1.map(x=>({...x,group:'R1'})),...selectedDisputes.map(x=>({...x,group:'dispute'}))]
const packet=rows.map((x,index)=>({...x,index,source:originals.find(o=>o.item_id===x.item).source,detail:Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(o=>o.item_id===x.item).links.find(l=>l.task_id===x.task)]))}))
fs.mkdirSync(d+'review',{recursive:true})
fs.writeFileSync(d+'review/sample-packet.local.json',JSON.stringify(packet,null,2)+'\n')
fs.writeFileSync(d+'review/.gitignore','*.local.json\n')
const start=Number(process.argv[2]??0),end=Number(process.argv[3]??10)
console.log(packet.slice(start,end).map(x=>JSON.stringify({index:x.index,item:x.item,task:x.display,group:x.group,source:x.source,detail:x.detail})).join('\n'))
