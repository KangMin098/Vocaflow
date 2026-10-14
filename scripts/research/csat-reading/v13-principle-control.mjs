// scripts/research/csat-reading/v13-principle-control.mjs
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const sha=x=>createHash('sha256').update(x).digest('hex'),r=p=>JSON.parse(fs.readFileSync(p,'utf8')),d='docs/research/csat-reading/data/v13/',local='scripts/research/csat-reading/local/v13/';
const pairId='M2206#37~M2306#36',comparePath='apps/web/src/lib/csat/compare-v3-data.json',pair=r(comparePath).pairs[pairId];
if(process.argv.includes('--register')){const out={version:'v1.3',layer:'priority-external mock boundary control',selected:[pairId],denominator_old_scope_remaining:1,rule:'唯一 remaining both-end2014–2024 bounded pair excluded by priority4TASKcandidate; selected for user-required cohesion/structure boundary control; not pooled with main-only/prior priority extension',principle_sha256:sha(JSON.stringify(pair.principle)),compare_sha256:sha(fs.readFileSync(comparePath)),source_read_timing:'registration before full original/key extraction',old_registrations_unchanged:true};if(fs.existsSync(d+'principle-control-registration.json'))throw Error('No overwrite');fs.writeFileSync(d+'principle-control-registration.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out));process.exit(0);}
if(!fs.existsSync(d+'principle-control-registration.json'))throw Error('Register first');
const req=createRequire('D:/workspace/Vocaflow/scripts/csat/render-pdf-page.mjs'),pdfRoot=path.dirname(req.resolve('pdfjs-dist/package.json')).replaceAll('\\','/'),{getDocument}=await import(pathToFileURL(pdfRoot+'/legacy/build/pdf.mjs').href);
const root='C:/Users/Administrator/Documents/영어/모의평가/';
const raw=r('scripts/research/csat-reading/local/snapshots/20261012-r0/db-corpus.json');
const result={pair_id:pairId,principle:pair.principle,mappings:pair.mappings,endpoints:[]};
for(const id of [pair.left,pair.right]){const prefix='20'+id.split('#')[0].slice(1),db=raw.items.find(i=>i.id===id),files=[];for(const name of fs.readdirSync(root).filter(f=>f.startsWith(prefix)&&f.endsWith('.pdf'))){const bytes=fs.readFileSync(root+name),doc=await getDocument({data:new Uint8Array(bytes),cMapUrl:pdfRoot+'/cmaps/',cMapPacked:true,standardFontDataUrl:pdfRoot+'/standard_fonts/',isEvalSupported:false,verbosity:0}).promise;const pages=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),tc=await p.getTextContent();pages.push({page:n,text:tc.items.map(i=>i.str).join(' ')});}files.push({name,sha256:sha(bytes),pages});}result.endpoints.push({id,db,files});}
if(fs.existsSync(local+'principle-control-input.json'))throw Error('Registered input exists; no overwrite');
fs.writeFileSync(local+'principle-control-input.json',JSON.stringify(result,null,2)+'\n');
for(const e of result.endpoints){console.log('ITEM',JSON.stringify(e.db));for(const f of e.files){console.log('FILE',f.name,f.sha256,'pages',f.pages.length);for(const p of f.pages.filter(p=>f.name.includes('정답')||p.page===6||p.page===7))console.log('PAGE',p.page,p.text);}}console.log('PRINCIPLE',JSON.stringify(pair.principle));
