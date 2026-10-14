// scripts/research/csat-reading/v14-source-locate.mjs
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base='docs/research/csat-reading/data/v14/',local='scripts/research/csat-reading/local/v14/';
if(!fs.existsSync(base+'registration.json'))throw Error('Freeze v1.4 protocol/selection registration first');
if(fs.existsSync(local+'source-raw-input.json'))throw Error('Source draft exists');
const selected=read(base+'source-availability-v4.json').selected_metadata,raw=read('scripts/research/csat-reading/local/snapshots/20261012-r0/db-corpus.json'),extracted=read('scripts/research/csat-reading/local/main-20261014/source-extracted-main.json'),norm=s=>s.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const items=selected.map(meta=>{const it=raw.items.find(x=>x.id===meta.id),f=extracted.files.find(x=>x.exam===meta.exam&&!x.filename.includes('정답'));let pages=f.pages.filter(p=>p.page<=8&&norm(p.text).includes(norm(it.passage.slice(0,65))));if(pages.length!==1)pages=f.pages.filter(p=>p.page<=8&&norm(p.text).includes(norm(it.passage.slice(0,30))));if(pages.length!==1)throw Error('Page locate ambiguity '+meta.id);return{...meta,passage:it.passage,stem:it.stem,choices:it.choices,pdf:{filename:f.filename,sha256:f.sha256,pages:pages.map(x=>x.page)}};});
fs.mkdirSync(local,{recursive:true});fs.writeFileSync(local+'source-raw-input.json',JSON.stringify({version:'1.4-source-first-draft',answer_blind:true,items},null,2)+'\n');fs.writeFileSync(local+'pilot-key.json',JSON.stringify(selected.map(meta=>({id:meta.id,answer:raw.items.find(x=>x.id===meta.id).answer})),null,2)+'\n');console.log(JSON.stringify(items.map(x=>({id:x.id,...x.pdf}))));
