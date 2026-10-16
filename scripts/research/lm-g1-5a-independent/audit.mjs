// scripts/research/lm-g1-5a-independent/audit.mjs
// Assemble only source-matching, fully completed evidence. Skip/unknown/missing is never PASS.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process'
import {productHashes,assertSameManifest,assertRows} from './binding.mjs'
import {bindingHashes} from './bound-checks.mjs'
import {browserJobs,renderBrowserRunner} from './runner-contract.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),local=path.join(import.meta.dirname,'local'),docs=root+'/docs/research/lm-g1-5a-independent'
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8'))
const expected={'v2-1280':6,'v2-1440':6,'t4-1280':14,'t4-1440':14,t1:9,'t2-1280':26,'t2-1440':26,'t3-1280':20,'t3-1440':20,security:18,workspace:36,return:7,study:6,supply:6}
const runs=(process.argv[2]??'frozen-product').split(','),chosen={},excluded=[]
for(const run of runs){const file=local+'/'+run+'/browser-summary.json';if(!fs.existsSync(file))continue
 for(const row of read(file)){
  const folder=local+'/'+run+'/'+row.name,sources=read(folder+'/source-hashes.json')
  let sourceMatches=false;try{assertSameManifest(sources,productHashes(root));sourceMatches=true}catch{}
  const job=browserJobs('http://localhost:3012',local+'/'+run).find(x=>x[0]===row.name);if(!job)throw Error('Unknown browser job')
  const runnerMatches=fs.readFileSync(folder+'/runner.mjs','utf8')===renderBrowserRunner({root,file:job[1],folder:path.join(local,run)+'/'+row.name,at:row.startedAt})
  const pass=row.exit===0&&row.failLines===0&&row.passLines===expected[row.name]&&row.cleanup.ok&&row.cleanup.accountsLeft===0&&row.cleanup.unknown===0&&row.sourceStable&&sourceMatches&&runnerMatches
  const result={...row,sourceMatches,runnerMatches,run,runnerSha256:hash(folder+'/runner.mjs'),sourceManifestSha256:hash(folder+'/source-hashes.json')}
  if(pass)chosen[row.name]=result;else excluded.push(result)
 }
}
const missing=Object.keys(expected).filter(k=>!chosen[k]);if(missing.length){console.log(JSON.stringify({pending:true,missing,completed:Object.keys(chosen),excluded}));process.exit(1)}
const bound=read(local+'/bound-checks.json');assertSameManifest(bound.hashes,bindingHashes());if(bound.jobs.length!==6||bound.jobs.some(x=>x.exit!==0))throw Error('Bound checks incomplete')
const counterFiles=['bound-contract.json','bound-source.json','bound-duplicate.json'];assertRows(read(local+'/bound-contract.json').rows,10);assertRows(read(local+'/bound-source.json').rows,6);assertRows([read(local+'/bound-duplicate.json').row],1)
const inv=read(local+'/bound-inventory.json');assertRows(inv.providerPreservation,15);if(inv.candidates.length!==51||inv.candidates.some(x=>x.currentProvider!==null)||inv.normalMatches!==true||inv.otherTaskRejected!==true||inv.otherItemRejected!==true)throw Error('Inventory contract failed')
const units=read(local+'/bound-focused.json');if(units.numPassedTests!==22||units.numFailedTests||units.numPendingTests)throw Error('Focused tests incomplete')
const evidence={submittedHead:'4064c002bec87cedc3f4dece9d86172eed3d8fc0',sourceBasis:'7ee352f1baa76347a413ba676a85e05411436408',assemblyHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 activeV2Content:0,actualV2Vertical:'BLOCKED_CONTENT',expertValidation:'NOT_TESTED',learningEffect:'NOT_CLAIMED',
 browsers:{assertions:Object.values(chosen).reduce((n,x)=>n+x.passLines,0),jobs:Object.values(chosen),excluded},
 binding:{receiptSha256:hash(local+'/bound-checks.json'),...bound},
 focused:{files:5,tests:22,fail:0,skip:0,sha256:hash(local+'/bound-focused.json')},
 isolated:{file:'bound-panel/results.json',sha256:hash(local+'/bound-panel/results.json'),...read(local+'/bound-panel/results.json')},
 counterexamples:counterFiles.map(f=>({file:f,sha256:hash(local+'/'+f),result:read(local+'/'+f)})),
 originals:{file:'INITIAL-FAILS.json',sha256:hash(docs+'/INITIAL-FAILS.json')},
 inventory:{file:'bound-inventory.json',sha256:hash(local+'/bound-inventory.json'),result:read(local+'/bound-inventory.json')},
 limits:['No actual V2 attempt has been saved; isolated writers and HTTP replies are fixtures','Metadata is not an actual blind review ledger or semantic annotation validation','Existing E provider retained; dual instrument selection remains separate','No DB/RPC/RLS or content release changes; synthetic accounts only']}
if(evidence.isolated.rows.length!==28||evidence.isolated.rows.some(x=>!x.pass))throw Error('Isolated panel cases incomplete')
fs.writeFileSync(docs+'/EVIDENCE.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({assertions:evidence.browsers.assertions,jobs:Object.keys(chosen).length,focused:evidence.focused,isolated:evidence.isolated.rows.length}))
