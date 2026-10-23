// scripts/research/goal-data/review/d3-inspect.mjs
import fs from 'node:fs'
const d='docs/research/goal-data-batches/'
const all=fs.readFileSync(d+'D3-principles/distractor-logic.jsonl','utf8').trim().split(/\r?\n/).map(JSON.parse).filter(x=>x.batch==='b2-v2')
const special=all.filter(x=>['R-GRAMMAR','R-ORDER'].includes(x.type_id))
const other=all.filter(x=>!['R-GRAMMAR','R-ORDER'].includes(x.type_id))
const selected=[...special,...Array.from({length:30-special.length},(_,i)=>other[Math.floor(i*other.length/(30-special.length))])]
const src=JSON.parse(fs.readFileSync('D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b2-v2/input.json','utf8')).rows
const packet=selected.map((x,index)=>({...x,index,source:src.find(o=>o.item_id===x.item_id).source}))
fs.writeFileSync(d+'review/d3-packet.local.json',JSON.stringify(packet,null,2)+'\n')
for(const x of packet.slice(Number(process.argv[2]??0),Number(process.argv[3]??30))) console.log(JSON.stringify(x))
