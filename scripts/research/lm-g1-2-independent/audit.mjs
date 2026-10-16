// scripts/research/lm-g1-2-independent/audit.mjs
// Local reproducibility/provenance aggregation only; never reads credentials or learner payloads.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../..'),local=path.join(import.meta.dirname,'local'),report=path.join(root,'docs/research/lm-g1-2-independent')
fs.mkdirSync(report,{recursive:true})
const hash=b=>crypto.createHash('sha256').update(b).digest('hex')
const read=p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):null
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
const original=read(local+'/original-inventory.json')
const rows=execFileSync('git',['diff','--name-only','7e7b51ab74e2b0db1e137f13041390150530d305','HEAD'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)
const product=rows.filter(f=>f.startsWith('apps/web/')&&!f.includes('__tests__'))
const renderedProductCommit=read(local+'/revised-1280/results.json')?.sha
if(!renderedProductCommit||renderedProductCommit!==read(local+'/revised-1440/results.json')?.sha)throw Error('PC runs must bind the same frozen product commit')
const paths=product.map(file=>{const sha256=hash(fs.readFileSync(path.join(root,file)));const renderedSha256=hash(execFileSync('git',['show',renderedProductCommit+':'+file],{cwd:root}));return {file,sha256,renderedSha256,equalToRenderedProduct:sha256===renderedSha256}})
const unitFiles=fs.existsSync(local+'/checks')?fs.readdirSync(local+'/checks').filter(f=>/^unit-.*\.json$/.test(f)):[]
const units=unitFiles.map(file=>{const j=read(local+'/checks/'+file);return {file,passed:j.numPassedTests,failed:j.numFailedTests,skipped:j.numPendingTests,files:j.testResults.map(x=>path.relative(path.join(root,'apps/web'),x.name))}})
const suiteNames=['pinned-1280','pinned-1440','revised-1280','revised-1440','timing','security','late-remount','t1','workspace','supply']
const suites=Object.fromEntries(suiteNames.map(name=>[name,read(local+'/'+name+'/results.json')]))
// Remove opaque synthetic UUIDs from public result detail; source item IDs and versions remain.
const redact=value=>JSON.parse(JSON.stringify(value).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'<synthetic-uuid>'))
const walk=d=>fs.existsSync(d)?fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]):[]
const screenshots=walk(local).filter(f=>f.endsWith('.png')).map(f=>({path:path.relative(root,f),bytes:fs.statSync(f).size,sha256:hash(fs.readFileSync(f))}))
const probes={}
for(const name of ['pinned-counterexamples-enriched','pinned-loader-limit','cross-stage-before','saved-shortage-before','revised-core-final','revised-boundaries','loader-limit-results','atomic-results','browser-wrapper-failed','browser-wrapper-double-delete','browser-server-lost','failed-1440-server','policy-before','policy-after-final','stale-draft-before','stale-draft-nextsave-before','installed-source-binding','browser-7dcd-summary','browser-677-summary','stale-note-before','stale-note-diagnostic-before','browser-92a-summary','late-boundaries-before','passage-failure-before','passage-gate-before','passage-failure-results','snapshot-fixture-before','restore-allocation-before','draft-stage-before','browser-c785-partial-summary','browser-c785-interrupted','saved-read-failure-before','late-remount-before','late-remount-fixture-error','browser-aef-partial-summary','browser-aef-interrupted','server-cleanup-probe','plan-recovery-before','plan-recovery-probe','browser-9f88-full-summary']) {
 const value=read(local+'/'+name+'.json')
 if(value?.testResults) probes[name]={passed:value.numPassedTests,failed:value.numFailedTests,skipped:value.numPendingTests,tests:value.testResults.flatMap(f=>f.assertionResults.map(a=>({name:a.fullName,status:a.status,error:a.failureMessages.join('').slice(0,500)})))}
 else probes[name]=value
}
const runtimeBundles=walk(root+'/apps/web/.next-lmg12-review/static/chunks').filter(f=>f.endsWith('.js')&&f.includes('/csat/diagnosis/')).map(f=>{const b=fs.readFileSync(f);return {path:path.relative(root,f),sha256:hash(b),passageRule:b.toString().includes('확인 묶음 밖 서로 다른 지문 수')}})
const harnesses=walk(import.meta.dirname).filter(f=>f.endsWith('.mjs')&&!f.includes('/local/')).map(file=>({file:path.relative(root,file),sha256:hash(fs.readFileSync(file))}))
const reviewLogs=['purpose-review.log','purpose-review-final.log','purpose-review-r3.log','purpose-review-r4.log','restore-overlay-before.log','support-edit-before.log','purpose-review-final-source.log','purpose-review-stage-final.log','purpose-review-last.log','purpose-review-harness-final.log','purpose-review-final-accepted.log'].filter(f=>fs.existsSync(local+'/'+f)).map(file=>({file,sha256:hash(fs.readFileSync(local+'/'+file))}))
const result=redact({observedAt:new Date().toISOString(),pinned:'e32609ccf44b077c4d759424fc1e08a55cd5ac12',base:'7e7b51ab74e2b0db1e137f13041390150530d305',reviewHead:head,renderedProductCommit,original,reviewLogs,harnesses,product:paths,publishedScreenshots:read(report+'/SCREENSHOTS.json'),units,suites,browser:read(local+'/browser-summary.json'),checks:{types:read(local+'/checks/types-exit.json'),units:read(local+'/checks/units-exit.json'),lint:read(local+'/checks/lint-exit.json')},probes,screenshots,runtimeBundles})
fs.writeFileSync(report+'/EVIDENCE.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({head,unitFiles:units.reduce((n,x)=>n+x.files.length,0),passed:units.reduce((n,x)=>n+x.passed,0),failed:units.reduce((n,x)=>n+x.failed,0),skipped:units.reduce((n,x)=>n+x.skipped,0),screenshots:screenshots.length}))
