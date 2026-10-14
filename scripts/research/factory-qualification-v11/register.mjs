// scripts/research/factory-qualification-v11/register.mjs
import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const target='docs/research/factory-qualification-v11/data/registration.json';
const dirs=['docs/research/factory-qualification','scripts/research/factory-qualification','docs/research/csat-reading','scripts/research/csat-reading'];
const files=execFileSync('git',['ls-files','--',...dirs],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const registration={version:'FQ1.1-preregistered',task:'T-0031',base:'e5b24b1eb9e594144a2959faeb5c1acfbc7f0fed',branch:'research/factory-qualification-v11',protocol:{path:'docs/research/factory-qualification-v11/PROTOCOL.md',sha256:hash('docs/research/factory-qualification-v11/PROTOCOL.md')},frozen:Object.fromEntries(files.map(p=>[p,hash(p)])),historical_integrity:{path:'docs/research/factory-qualification/data/integrity.json',sha256:hash('docs/research/factory-qualification/data/integrity.json')},public_qualified:0,assessment_qualified:0};
if(fs.existsSync(target))throw Error('Preserve registration; no overwrite');fs.writeFileSync(target,JSON.stringify(registration,null,2)+'\n');console.log(JSON.stringify({frozen:files.length,protocol:registration.protocol.sha256}));
