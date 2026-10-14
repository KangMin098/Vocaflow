// scripts/research/csat-reading/v15-workspace-read.mjs
import fs from 'node:fs';
const local='scripts/research/csat-reading/local/';
const ids=new Set(['2016#30','2020#37','2014B#42']);const source=new Map();
for(const path of ['main-20261014/input.json','v12/restore-a.json','v12/restore-b.json','v12/pilot-input.json','v13/development-input.json','v13/pilot-input.json']){const raw=JSON.parse(fs.readFileSync(local+path,'utf8'));for(const item of raw.items??raw)if(ids.has(item.id))source.set(item.id,{path:local+path,item});}
const packet={purpose:'source-reading for follow-up gap audit, not new student tasks',items:[...source.values()]};
fs.writeFileSync(local+'v15/workspace-sources.json',JSON.stringify(packet,null,2)+'\n');
for(const x of packet.items)console.log(JSON.stringify({path:x.path,id:x.item.id,passage:x.item.passage,presentation:x.item.presentation}));
