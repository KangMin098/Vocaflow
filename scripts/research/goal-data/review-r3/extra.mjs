// scripts/research/goal-data/review-r3/extra.mjs
import fs from 'node:fs';
const root='docs/research/goal-data-batches/';const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const jl=p=>fs.readFileSync(p,'utf8').trim().split(/\r?\n/).map(JSON.parse);
const ds=jl(root+'D3-principles/distractor-logic.jsonl');
const packet=[];
for(const id of ['M2606#36','2024#37','M2606#38','2024#38']){const input=read('D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b4-v21/input.json').rows.find(r=>r.item_id===id);packet.push({id,source:input.source,distortions:ds.filter(r=>r.item_id===id)});}
fs.writeFileSync(root+'review-r3/d3-packet.local.json',JSON.stringify(packet,null,2));
const third=read('D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b2-v2/r3-third.out.json').rows;
const dir='D:/workspace/Vocaflow-goal-data/scripts/research/goal-data/local/b2-v2/';
const tracks=Object.fromEntries(['A','B'].map(t=>[t,fs.readdirSync(dir).filter(f=>f.startsWith('chunk-'+t)&&f.endsWith('.out.json')).flatMap(f=>read(dir+f).rows)]));
console.log('third full',JSON.stringify(third.map(c=>({item:c.item_id,C:c.relevance,...Object.fromEntries(['A','B'].map(t=>[t,tracks[t].find(r=>r.item_id===c.item_id).links.find(l=>l.task_id==='r.discourse_function').relevance]))}))));
