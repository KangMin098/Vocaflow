// scripts/research/goal-data/review-r3/packet.mjs
import fs from 'node:fs';
const base='docs/research/goal-data-batches/',out=base+'review-r3/';
const jl=p=>fs.readFileSync(base+p,'utf8').trim().split(/\r?\n/).map(JSON.parse);
const local='D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/';
const inputs=new Map(),analyses=new Map();
for(const b of ['b2-v2','b3-insert','b4-v21']){const dir=local+b+'/';for(const r of JSON.parse(fs.readFileSync(dir+'input.json','utf8')).rows)inputs.set(b+':'+r.item_id,r);for(const t of ['A','B'])for(const f of fs.readdirSync(dir).filter(f=>f.startsWith('chunk-'+t)&&f.endsWith('.out.json')))for(const r of JSON.parse(fs.readFileSync(dir+f,'utf8')).rows)analyses.set(b+':'+r.item_id+':'+t,r);}
const pick=(a,n)=>Array.from({length:Math.min(n,a.length)},(_,i)=>a[Math.floor(i*a.length/Math.min(n,a.length))]);
const links=jl('D2-task-mapping/item-task-links.jsonl').filter(r=>['b3-insert','b4-v21'].includes(r.batch));
const disputes=jl('D2-task-mapping/disputed-links.jsonl').filter(r=>['b3-insert','b4-v21'].includes(r.batch));
const chosen=[...pick(links,20).map(r=>({kind:'r1',...r})),...pick(disputes.filter(r=>r.display==='E2'),10).map(r=>({kind:'disputed',...r})),...pick(disputes.filter(r=>r.display==='V4'),10).map(r=>({kind:'disputed',...r}))];
const packet=chosen.map(r=>({...r,source:inputs.get(r.batch+':'+r.item).source,details:Object.fromEntries(['A','B'].map(t=>[t,analyses.get(r.batch+':'+r.item+':'+t).links.find(l=>l.task_id===r.task)]))}));
fs.writeFileSync(out+'mapping-packet.local.json',JSON.stringify(packet,null,2));
console.log(JSON.stringify(packet.map((r,i)=>({i,kind:r.kind,item:r.item,display:r.display,judgments:r.judgments}))));
