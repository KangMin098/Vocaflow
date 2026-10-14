// scripts/research/csat-reading/v13-source-locate.mjs
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),norm=s=>s.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
const input=read('scripts/research/csat-reading/local/v13/pilot-raw-input.json'),source=read('scripts/research/csat-reading/local/main-20261014/source-extracted-main.json');
for(const it of input.items){const exam=it.id.split('#')[0],f=source.files.find(f=>f.exam===exam&&!f.filename.includes('정답'));const pages=f.pages.filter(p=>norm(p.text).includes(norm(it.passage.slice(0,65))));console.log(JSON.stringify({id:it.id,filename:f.filename,pages:pages.map(p=>p.page),sha256:f.sha256}));}
