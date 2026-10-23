// docs/csat-learner/skeleton-v4/s1-v6/selection/validate.mjs
// Read-only artifact/source checks. Does not execute or relabel prior tests.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {features,alternatives,recommended,reportedProposition} from './model.mjs'
const dir=path.dirname(fileURLToPath(import.meta.url)),wt=path.resolve(dir,'../../../../..')
const arg=name=>{const i=process.argv.indexOf(name);assert.ok(i>=0,`required ${name}`);return process.argv[i+1]}
const control=arg('--control-root')
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'))
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const git=args=>execFileSync('git',['-C',wt,...args],{encoding:'utf8'}).trim()
const baseline='b7fa848fdfdf2fd34c77ab42c1e3bd9483e7c572'
const r=read(path.join(dir,'RESULTS.json')),m=read(path.join(dir,'MANIFEST.json')),d=read(path.join(dir,'DECISIONS.json'))
const checks=[]
function check(name,fn){fn();checks.push({name,result:'PASS'})}
check('ancestor, allowed documentation scope, prior S1/S0 history preserved',()=>{
 git(['merge-base','--is-ancestor',baseline,'HEAD'])
 const changed=git(['diff','--name-only',baseline]).split('\n').filter(Boolean)
 assert.ok(changed.every(f=>f==='docs/CHANGELOG.md'||f==='docs/csat-learner/skeleton-v4/s1-v6/README.md'||f.startsWith('docs/csat-learner/skeleton-v4/s1-v6/selection/')))
 const all=git(['ls-tree','-r','--name-only',baseline,'--','docs/csat-learner/skeleton-v4']).split('\n').filter(Boolean)
 for(const p of all.filter(f=>f!=='docs/csat-learner/skeleton-v4/s1-v6/README.md')){
  const h=crypto.createHash('sha256').update(execFileSync('git',['-C',wt,'show',`${baseline}:${p}`],{maxBuffer:20e6})).digest('hex')
  assert.equal(hash(path.join(wt,p)),h,p)
 }
})
check('manifest and 18 captures are current, no orphan captures',()=>{
 for(const f of m.files)assert.equal(hash(path.join(dir,f.file)),f.sha256,f.file)
 assert.equal(r.captures.length,18)
 assert.deepEqual(fs.readdirSync(path.join(dir,'evidence')).sort(),r.captures.map(c=>path.basename(c.file)).sort())
 for(const c of r.captures)assert.equal(hash(path.join(dir,c.file)),c.sha256)
 assert.equal(hash(path.join(dir,m.oldBuilder.file)),m.oldBuilder.sha256)
})
check('old 20 artifacts and actual product sources unchanged',()=>{
 assert.equal(Object.keys(r.baselineHashes).length,20)
 for(const[p,h]of Object.entries({...r.baselineHashes,...r.originalHashes}))assert.equal(hash(path.join(wt,p)),h,p)
 assert.equal(hash(r.samplePath),r.sampleHash)
})
const prior=read(path.join(control,'runtime/t0131-s1-fit-20261023/inputs-and-tests.json'))
check('98 actual prior tests reused through 62 identical input hashes, not rerun',()=>{
 assert.equal(prior.commit,baseline);assert.equal(prior.tests.passed,98);assert.equal(prior.tests.failed,0);assert.equal(prior.tests.skipped,0);assert.equal(prior.tests.exit,0)
 assert.equal(prior.equivalentFiles.length,62)
 for(const f of prior.equivalentFiles)assert.equal(hash(path.join(wt,f.path)),f.sha256,f.path)
 assert.deepEqual(r.reuse,{oldTests:98,oldCases:24,oldCaptures:14,rerun:false})
})
check('42 targeted conditions are 40 affordance pass and two static eliminations, zero page/API errors',()=>{
 assert.equal(r.results.length,42);assert.equal(r.results.filter(x=>x.result==='PASS').length,40)
 assert.deepEqual(r.results.filter(x=>x.result==='ELIMINATED_STATIC').map(x=>x.feature).sort(),['F07','F08'])
 assert.deepEqual(r.errors,[]);assert.deepEqual(r.network,[])
 for(const f of features)for(const a of alternatives)assert.ok(r.results.some(x=>x.item==='2026-34'&&x.feature===f&&x.candidate===a))
 for(const item of ['2026-22','2026-38'])for(const f of features)assert.ok(r.results.some(x=>x.item===item&&x.feature===f&&x.candidate===recommended[f]))
 for(const item of ['2026-34','2026-22','2026-38'])for(const w of [1280,1440])assert.ok(r.results.some(x=>x.feature==='COMPOSED'&&x.item===item&&x.width===w))
})
check('same actual 34 choice records 1/3/2 compared in all alternatives, exact reported propositions only',()=>{
 const samples=read(r.samplePath),sample=samples.find(s=>s.itemId==='2026#34')
 for(const row of r.results.filter(x=>x.item==='2026-34'&&x.feature==='F04')){
  assert.deepEqual(row.sameCases.map(x=>x.choice),[1,3,2])
  for(const observed of row.sameCases){const c=sample.inquiry.v3.choices.find(c=>c.n===observed.choice);assert.equal(observed.truth,c.content_truth);assert.equal(observed.fit,c.requirement_fit);assert.deepEqual(observed.reportedProposition,reportedProposition(c))}
 }
 assert.equal(sample.inquiry.v3.choices.find(c=>c.n===2).content_truth,'unknown')
 for(const row of r.results.filter(x=>x.feature==='F03'&&x.candidate!=='REUSE')){assert.equal(row.unregisteredPair.inferredLink,false);assert.equal(row.unregisteredPair.display,'UNREGISTERED')}
})
check('actual player integration evidence covers adapter errors/rejection, media and explicit restart, not native TTS',()=>{
 const rows=r.results.filter(x=>x.feature==='F07'&&x.candidate!=='REUSE');assert.equal(rows.length,5)
 for(const row of rows){const p=row.player;assert.equal(p.engine,'actual LecturePlayer');assert.equal(p.transition,'PASS');assert.equal(p.adapterOutcomeErrorAndRejectionToNewShellBoundary,'PASS');assert.equal(p.nativeEngineOrTTSErrorHandling,'UNVERIFIED');assert.equal(p.readSilentOffAndExplicitRestart,'PASS');assert.equal(p.events.filter(e=>e.kind==='shell-adapter-error-boundary').length,2)}
})
check('six scoped selections have four distinct alternatives; four other features retain explicit evidence gaps',()=>{
 assert.equal(d.features.length,10)
 for(const f of features){const x=d.features.find(x=>x.id===f);assert.equal(x.selected,recommended[f]);assert.equal(x.status,'DESIGN_SELECTED');assert.deepEqual(x.alternatives.map(x=>x.kind),alternatives);assert.equal(new Set(x.alternatives.map(a=>a.goal)).size,4);for(const key of ['learnerJudgment','reason','codeRelation','costRisk','remaining','independentVerdict'])assert.ok(x[key]?.length);assert.equal(x.independentVerdict,'EXTERNAL_FIXED_COMMIT_REVIEW_REQUIRED')}
 for(const id of ['F02','F06','F09','F10']){const x=d.features.find(x=>x.id===id);assert.equal(x.selected,null);assert.equal(x.status,'BLOCKED_EVIDENCE');for(const key of ['fixedContract','notDecided','missing','validationPath'])assert.ok(x[key]?.length)}
 for(const id of ['F07','F08'])assert.equal(d.features.find(x=>x.id===id).alternatives.find(a=>a.kind==='REUSE').disposition,'ELIMINATED')
 assert.equal(d.acceptance,'INDEPENDENT_REVIEW_REQUIRED');assert.deepEqual(d.notAuthorized,['main integration','S2 full implementation']);assert.ok(d.unverified.length>=6)
})
console.log(JSON.stringify({task:'T-0135',commit:git(['rev-parse','HEAD']),checks,priorTests:{passed:98,rerun:false,inputs:62,recordHash:hash(path.join(control,'runtime/t0131-s1-fit-20261023/inputs-and-tests.json'))},newBrowser:{cases:42,affordancePass:40,staticEliminated:2,captures:18},unverified:r.unverified,notAuthorized:r.notAuthorized},null,2))
