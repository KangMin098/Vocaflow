// scripts/research/factory-qualification/audit-main.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const initial=JSON.parse(fs.readFileSync('docs/research/factory-qualification/data/product-audit.json','utf8'));
const git=(args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore']});
const head=git(['rev-parse','origin/main']).trim();
const files=initial.files.map(x=>{try{const b=git(['show',`${head}:${x.file}`]);return{file:x.file,exists:true,sha256:sha(b)};}catch{return{file:x.file,exists:false,sha256:null};}});
const dest='docs/research/factory-qualification/data/product-main-audit.json';if(fs.existsSync(dest))throw Error('preserve first main observation');
fs.writeFileSync(dest,JSON.stringify({version:'fq1-main-audit-1',ref:'origin/main',head,observed_at:new Date().toISOString(),method:'git show pinned HEAD read-only',files,not_runtime_verification:true},null,2)+'\n');console.log(JSON.stringify({head,exists:files.filter(x=>x.exists).length,missing:files.filter(x=>!x.exists).map(x=>x.file)}));
