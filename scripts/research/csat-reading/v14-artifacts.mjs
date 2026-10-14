// scripts/research/csat-reading/v14-artifacts.mjs
import fs from 'node:fs';
import {sha,checkHashes} from './v14-integrity.mjs';
const base='docs/research/csat-reading/',dir=base+'data/v14/',index=dir+'artifacts.json';
const files=[...fs.readdirSync(base).filter(f=>f.startsWith('V14-')&&f.endsWith('.md')).map(f=>base+f),base+'PROTOCOL-v1.4.md',...fs.readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='artifacts.json').map(f=>dir+f),...fs.readdirSync('scripts/research/csat-reading/').filter(f=>f.startsWith('v14-')||f==='v14.test.mjs').map(f=>'scripts/research/csat-reading/'+f)].sort();
if(process.argv.includes('--check')){const data=JSON.parse(fs.readFileSync(index,'utf8'));if(JSON.stringify(Object.keys(data.files))!==JSON.stringify(files))throw Error('Artifact list drift');checkHashes(data.files);console.log(JSON.stringify({status:'pass',artifacts:files.length}));}
else {const data={version:'1.4',scope:'V14 research artifacts only; original v13 index preserved',files:Object.fromEntries(files.map(p=>[p,sha(p)])),private_sources:'ignored local; hash-bound references remain in public metadata, originals/keys/Gold excluded'};fs.writeFileSync(index,JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify({indexed:files.length}));}
