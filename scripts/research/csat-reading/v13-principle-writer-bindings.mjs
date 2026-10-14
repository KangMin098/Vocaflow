// scripts/research/csat-reading/v13-principle-writer-bindings.mjs
import fs from 'node:fs';
import {contentHash} from '../../csat/lib-inquiry-review.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),ids=new Set(['2014A#36','2014B#37']),dir='scripts/csat/inquiry-drain/',found=new Map();
for(const f of fs.readdirSync(dir).filter(f=>/^chunk-(inq|v3)-[\w-]+\.out\.json$/.test(f)).sort()){const x=read(dir+f);for(const i of(Array.isArray(x)?x:x.items??[])){if(!ids.has(i.id))continue;const prev=found.get(i.id);if(!prev||(i.v3&&!prev.item.v3)||f.startsWith('chunk-v3'))found.set(i.id,{file:dir+f,item:i});}}
const pair=read('apps/web/src/lib/csat/compare-v3-data.json').pairs['2014A#36~2014B#37'];
const result={version:'v1.3',algorithm:'scripts/csat/lib-inquiry-review.mjs contentHash on latest selected writer output using compare-v3-build selection; not whole public object SHA',items:[['left',pair.left],['right',pair.right]].map(([side,id])=>{const x=found.get(id);return {id,writer_file:x?.file??null,content_hash:x?contentHash(x.item):null,compare_inquiry_hash:pair.binding[side].inquiry_hash,match:x?contentHash(x.item)===pair.binding[side].inquiry_hash:null,status:x?'writer_source_available':'writer_source_unavailable'};})};
const target='docs/research/csat-reading/data/v13/principle-writer-bindings.json';if(fs.existsSync(target))throw Error('No overwrite');fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
