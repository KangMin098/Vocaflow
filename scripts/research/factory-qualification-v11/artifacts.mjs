// scripts/research/factory-qualification-v11/artifacts.mjs
import fs from 'node:fs';import crypto from 'node:crypto';
const target='docs/research/factory-qualification-v11/data/artifacts.json';
function collect(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='local'?[]:e.isDirectory()?collect(dir+'/'+e.name):[dir+'/'+e.name]);}
const files=[...collect('docs/research/factory-qualification-v11'),...collect('scripts/research/factory-qualification-v11')].filter(p=>p!==target).sort();
const output={version:'FQ1.1-public-artifact-index-1',files:Object.fromEntries(files.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scope:'public metadata/code/doc bytes only; private originals and actual review inputs remain separately hash-bound and ignored'};
if(process.argv.includes('--check')){const old=JSON.parse(fs.readFileSync(target,'utf8'));if(JSON.stringify(old)!==JSON.stringify(output))throw Error('Public artifact byte/list drift');}
else{if(fs.existsSync(target))throw Error('Preserve artifact index first');fs.writeFileSync(target,JSON.stringify(output,null,2)+'\n');}
console.log(JSON.stringify({public_artifacts:files.length,private_files_published:0}));
