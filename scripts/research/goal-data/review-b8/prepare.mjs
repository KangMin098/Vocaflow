// scripts/research/goal-data/review-b8/prepare.mjs
import fs from 'node:fs';
const dir='scripts/research/goal-data/review-b8/';
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync('docs/research/goal-data-batches/review-b8',{recursive:true});
for(const d of [dir,'docs/research/goal-data-batches/review-b8/'])fs.writeFileSync(d+'.gitignore','*.local.json\n');
let s=fs.readFileSync('scripts/research/goal-data/review-b7/check.mjs','utf8');
s=s.replaceAll('review-b7','review-b8').replace("rev='e87bdc173',old='78ff7df39'","rev='1fa75b9cc',old='e87bdc173'");
s=s.replace("['-c',`safe.directory=${root}`,'-C',root,...a]","[...a]");
s=s.replaceAll("'b6-v23','b7-v24']","'b6-v23','b7-v24','b8-v24']");
// Keep regression b7 while moving the target batch to b8.
s=s.replaceAll("base+'b7-v24/","base+'b8-v24/").replaceAll("doc+'b7-v24-","doc+'b8-v24-").replaceAll('`b7-v24/','`b8-v24/').replaceAll("'/b7-v24-selection.json'","'/b8-v24-selection.json'").replaceAll("r.batch==='b7-v24'","r.batch==='b8-v24'").replaceAll("'d2-run','b7-v24'","'d2-run','b8-v24'");
s=s.replaceAll('b7-v24/chunk-','b8-v24/chunk-');
s=s.replaceAll(".concat(['2024#21','2025#21','2023#19','2024#19','2025#19','2024#26','2024#27','2024#28','2025#26','2025#27','2025#28'])",".concat(['M2409#39','M2706#30','M2706#45','M2409#35'])");
s=s.replace("const {body_ok,...s}=r.source;","const {body_ok,...s}=r.source;").replace("Object.hasOwn(r.source,'type_id')","r.type_id===e.snapshot.type_id");
s=s.replace('assert.equal(excluded.length,3)','assert.equal(excluded.length,14)');
const start=s.indexOf("const types=at("),end=s.indexOf("const priority=",start);
s=s.slice(0,start)+s.slice(end);
s=s.replace('exportProbes,typeProbes,allTypeProbes,','exportProbes,');
s=s.replaceAll("w.batch==='b7-v24'","w.batch==='b8-v24'");
s=s.replace('b2–b7 D2/D3 regression, source hashes, 12-row type probe, 13 types, 3 export probes, 4 regenerated artifacts and D3 propagation','b2–b8 D2/D3 regression, source hashes, export probes, 4 regenerated artifacts and D3 propagation');
s=s.replace("const prior=new Set();","const prior=new Set();");
// Selection order may include previous selections: restrict those to earlier batches.
s=s.replace("&&!p.endsWith('/b8-v24-selection.json')","&&!p.endsWith('/b8-v24-selection.json')");
fs.writeFileSync(dir+'check.mjs',s);
