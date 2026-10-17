// scripts/research/lm-g1-5a-independent/bound-checks.mjs
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module'
import {productHashes,hashFile,assertSameManifest} from './binding.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),local=import.meta.dirname+'/local',req=createRequire(root+'/apps/web/package.json')
const tests=['src/lib/knowledge/__tests__/contextual-sense-acceptance.test.ts','src/lib/knowledge/__tests__/contextual-sense-server.test.ts','src/lib/knowledge/__tests__/contextual-sense.test.ts','src/components/csat/theater/__tests__/ContextSensePanel.test.tsx','src/lib/csat/map/v62/__tests__/v2-support-boundary.test.ts']
const scripts=['contract-probe.mjs','source-probe.mjs','duplicate-probe.mjs','inventory.mjs','panel-browser.mjs','binding.mjs','bound-checks.mjs']
const extra=[...tests.map(f=>'apps/web/'+f),...scripts.map(f=>'scripts/research/lm-g1-5a-independent/'+f),'scripts/research/lm-g1-3a-independent/source-loader.mjs','apps/web/src/components/csat/theater/task-meta.ts']
export const bindingHashes=()=>({...productHashes(root),...Object.fromEntries(extra.map(f=>[f,hashFile(root+'/'+f)]))})
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const receipt=local+'/bound-checks.json';if(fs.existsSync(receipt))throw Error('Immutable binding already exists')
 const before=bindingHashes(),startedAt=new Date().toISOString(),jobs=[]
 const run=(name,args,cwd=root)=>{const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:16<<20,timeout:180000,windowsHide:true});fs.writeFileSync(local+'/bound-'+name+'.log',(r.stdout??'')+(r.stderr??''));jobs.push({name,exit:r.status,error:r.error?.message??null});if(r.status!==0)throw Error('Bound check failed: '+name)}
 run('contract',[import.meta.dirname+'/contract-probe.mjs','--revision=bound-contract'])
 run('source',[import.meta.dirname+'/source-probe.mjs','--revision=bound-source'])
 run('duplicate',[import.meta.dirname+'/duplicate-probe.mjs','--revision=bound-duplicate'])
 run('inventory',[import.meta.dirname+'/inventory.mjs','--revision=bound-inventory'])
 run('panel',[import.meta.dirname+'/panel-browser.mjs','--actual-meta','--revision=bound-panel'])
 run('focused',[req.resolve('vitest/vitest.mjs'),'run',...tests,'--pool=forks','--poolOptions.forks.singleFork','--reporter=json','--outputFile='+local+'/bound-focused.json'],root+'/apps/web')
 assertSameManifest(bindingHashes(),before)
 fs.writeFileSync(receipt,JSON.stringify({startedAt,finishedAt:new Date().toISOString(),hashes:before,jobs},null,2));console.log(JSON.stringify({bound:true,jobs:jobs.length}))
}
