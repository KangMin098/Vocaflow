// scripts/research/factory-qualification/public-validation.mjs
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {privateLeaks} from './integrity.mjs';
import {validateSpecification,releaseBoundary} from './qualification.mjs';
export function validatePublic(root=process.cwd()){
 const dir=path.join(root,'docs/research/factory-qualification'),data=path.join(dir,'data');
 const leaks=[];let jsonFiles=0,links=0;
 for(const name of fs.readdirSync(data).filter(x=>x.endsWith('.json'))){jsonFiles++;leaks.push(...privateLeaks(JSON.parse(fs.readFileSync(path.join(data,name),'utf8'))).map(field=>({file:name,field})));}
 if(leaks.length)throw Error('Private original/answer fields in public metadata: '+JSON.stringify(leaks));
 for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.md'))){const body=fs.readFileSync(path.join(dir,name),'utf8');for(const m of body.matchAll(/\]\(([^)]+)\)/g)){if(/^(?:https?:|#)/.test(m[1]))continue;const target=m[1].split('#')[0];if(!fs.existsSync(path.resolve(dir,target)))throw Error('Missing doc target '+name+': '+target);links++;}}
 const reg=JSON.parse(fs.readFileSync(path.join(data,'registration.json'),'utf8')),packet=JSON.parse(fs.readFileSync(path.join(data,'qualification-results.json'),'utf8'));
 for(const [i,s]of packet.specifications.entries()){if(!reg.canonical_TASKs.ids.includes(s.task_id))throw Error('Noncanonical TASK');validateSpecification(s);releaseBoundary(s,packet.results[i]);}
 return {jsonFiles,links,contentPairs:packet.specifications.length,roleUses:packet.role_results.length,privacyFailures:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(validatePublic()));
