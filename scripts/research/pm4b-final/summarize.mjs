// scripts/research/pm4b-final/summarize.mjs
// Read-only runner reconciliation. Raw numPassedTests can include skipped assertions in this Vitest JSON version.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const base=path.join(root,'docs/research/pm4b-final/data');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8').replace(/^\uFEFF/,''));
const reports=['product-initial-environment-errors.json','product-retry.json','product-factory-retry.json'];
const files=new Map();
for(const report of reports)for(const s of read(report).testResults)files.set(s.name,{...s,report});
const counts={},skips=[];
for(const s of files.values())for(const a of s.assertionResults){counts[a.status]=(counts[a.status]??0)+1;if(a.status==='skipped')skips.push({file:s.name.replace(root+'/',''),test:a.fullName,status:a.status});}
const errors=[...files.values()].filter(s=>s.message).map(s=>({file:s.name,message:s.message}));
const out={method:'Derived union by file, latest retry supersedes only that file; no double counting. Raw reports retained.',reports,files:files.size,counts,collectionErrors:errors,skips};
fs.writeFileSync(path.join(base,'product-summary.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({files:out.files,counts,collectionErrors:errors.length},null,2));
if(errors.length||counts.failed)process.exitCode=1;
