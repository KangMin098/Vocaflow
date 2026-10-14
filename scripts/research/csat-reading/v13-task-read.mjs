// scripts/research/csat-reading/v13-task-read.mjs
// Print only preselected development sources; no recent holdout body access.
import fs from 'node:fs'
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const paths=['scripts/research/csat-reading/local/main-20261014/input.json','scripts/research/csat-reading/local/v12/restore-a.json','scripts/research/csat-reading/local/v12/restore-b.json','scripts/research/csat-reading/local/v12/pilot-input.json']
const map=new Map();for(const path of paths){const data=read(path);for(const item of data.items??data)map.set(item.id,{path,item})}
const selection=read('docs/research/csat-reading/data/v13/task-selection.json')
const requested=process.argv.slice(2)
const ids=requested.length?requested:[...new Set(selection.strata.flatMap(x=>x.sample.map(y=>y.item_id)))]
for(const id of ids){const source=map.get(id);if(!source)throw Error(`Unavailable ${id}`);const {item,path}=source;console.log(JSON.stringify({path,id:item.id,passage:item.passage,stem:item.stem,choices:item.choices,glosses:item.glosses,presentation:item.presentation?.kind,table:item.presentation?.table??null,binding:item.source_binding??item.binding??item.old_binding}))}
