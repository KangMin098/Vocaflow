// scripts/research/csat-reading/v14-map-read.mjs
import fs from 'node:fs';
const packet=JSON.parse(fs.readFileSync('scripts/research/csat-reading/local/v14/map-input.json','utf8'));
const wanted=new Set(process.argv.slice(2));
for(const {path,item} of packet.items)if(!wanted.size||wanted.has(item.id))console.log(JSON.stringify({path,id:item.id,passage:item.passage,stem:item.stem,choices:item.choices,glosses:item.glosses,presentation:item.presentation}));
