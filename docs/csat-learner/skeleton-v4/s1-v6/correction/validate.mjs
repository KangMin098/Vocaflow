// docs/csat-learner/skeleton-v4/s1-v6/correction/validate.mjs
// Read-only source/artifact and mutation checks, not independent content approval.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {candidateErrors,objectHash} from './candidate-check.mjs'
import {qualificationRecords} from '../selection/model.mjs'
const dir=path.dirname(fileURLToPath(import.meta.url)),wt=path.resolve(dir,'../../../../..')
const arg=name=>{const i=process.argv.indexOf(name);assert.ok(i>=0,`missing ${name}`);return process.argv[i+1]}
const control=arg('--control-root'),runtime=path.join(control,'runtime/t0135-correction-20261024')
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
const git=args=>execFileSync('git',['-C',wt,...args],{encoding:'utf8'}).trim()
const baseline='a6e33d1d4580124fc1e7c1032cb21961abf4f989'
const r=read(path.join(dir,'RESULTS.json')),m=read(path.join(dir,'MANIFEST.json')),p=read(path.join(dir,'C1_CANDIDATE.json')),s=read(path.join(dir,'SOURCE_BINDINGS.json')),d=read(path.join(dir,'DECISION_UPDATE.json'))
const original=read(path.join(wt,p.baseFile)),item=original.items['2026#38'],current={item,fileHash:digest(path.join(wt,p.baseFile)),sourceHash:s.questionSha256}
const checks=[]
function check(name,fn){fn();checks.push({name,result:'PASS'})}
check('baseline ancestry and exact allowed delta; original and historical artifacts unchanged',()=>{
 git(['merge-base','--is-ancestor',baseline,'HEAD'])
 const changed=git(['diff','--name-only',baseline]).split('\n').filter(Boolean)
 assert.ok(changed.every(f=>f==='docs/CHANGELOG.md'||f==='docs/csat-learner/skeleton-v4/s1-v6/README.md'||f.startsWith('docs/csat-learner/skeleton-v4/s1-v6/correction/')))
 for(const[f,h]of Object.entries({...r.priorHashes,...r.originalHashes}))assert.equal(digest(path.join(wt,f)),h,f)
})
check('official PDF/answer/page captures and eight source sentence hashes',()=>{
 assert.equal(digest(path.join(runtime,'official-2026-english.pdf')),s.questionSha256);assert.equal(digest(path.join(runtime,'official-2026-answers.pdf')),s.answerSha256)
 for(const c of s.pageCaptures)assert.equal(digest(c.path),c.sha256)
 const sentences=read(path.join(runtime,'38-source-sentences.json')).sentences
 for(const x of s.sentenceBindings)assert.equal(crypto.createHash('sha256').update(sentences[x.sentence-1]).digest('hex'),x.sha256)
 for(const a of s.newShortAnchors)assert.ok(sentences[a.sentence-1].includes(a.text))
 assert.deepEqual(s.officialAnswers,{'2026#34':3,'2026#22':1,'2026#38':5})
 assert.equal(s.readingBasis,'AUTHOR_SOURCE_BOUND_INTERPRETATION_NOT_OFFICIAL_RATIONALE')
})
check('34 official condition substrings match existing qualification projection',()=>{
 const samples=read('D:/workspace/Vocaflow-main-serving/tmp/csat-item-review-20261023/samples.json'),q=qualificationRecords(samples.find(s=>s.itemId==='2026#34'))
 const page6=read(path.join(runtime,'source-pages.json')).pages[6].replace(/\s+/g,' ')
 assert.ok(page6.includes(q[0].text));assert.ok(page6.includes(q[1].text.replace(/\s*___$/u,'')));assert.ok(page6.includes(q[2].text))
})
check('version/base/source/payload bound C1 proposal and explicit unapproved original application',()=>{
 assert.deepEqual(candidateErrors(p,current),[])
 assert.deepEqual(p.payload.expected,item.v3.choices.find(c=>c.n===5))
 assert.deepEqual(p.payload.proposed.sentences,[1,4,5,6,7,8]);assert.ok(p.payload.proposed.meaning_ids.includes('m3'));assert.ok(p.payload.proposed.meaning_ids.includes('m4'))
 assert.ok(p.payload.proposed.decisive.includes('4~5번'));assert.ok(p.payload.proposed.decisive.includes('유일한 지시 대상으로 한정하지 않는다'))
 assert.equal(p.approval.required,true);assert.equal(p.approval.appliedToOriginal,false)
})
check('negative proposal checks reject stale source/base, payload tamper and false approval state',()=>{
 const mutations=[['stale-file',x=>{x.baseFileSha256='0'.repeat(64)}],['stale-item',x=>{x.baseItemSha256='0'.repeat(64)}],['wrong-source',x=>{x.sourceSha256='0'.repeat(64)}],['changed-payload',x=>{x.payload.proposed.decisive+=' tampered'}],['invalid-proposal-approval-state',x=>{x.approval.required=false}],['unknown-meaning',x=>{x.payload.proposed.meaning_ids.push('invented');x.payloadSha256=objectHash(x.payload)}],['missing-general-context',x=>{x.payload.proposed.sentences=[1,6,7,8];x.payloadSha256=objectHash(x.payload)}]]
 for(const [expected,mutate]of mutations){const c=structuredClone(p);mutate(c);assert.ok(candidateErrors(c,current).includes(expected),expected)}
})
check('twelve real controlled cases,100 assertions pass,8 typed N/A,paired initial/final state equivalence',()=>{
 assert.equal(r.results.length,12);assert.ok(r.results.every(x=>x.result==='PASS'));assert.equal(r.results.flatMap(x=>x.steps).filter(x=>x.result==='PASS').length,100);assert.equal(r.results.flatMap(x=>x.steps).filter(x=>x.result==='NOT_APPLICABLE').length,8)
 assert.equal(r.failure,null);assert.deepEqual(r.errors,[]);assert.deepEqual(r.network,[])
 for(const item of ['2026-34','2026-22','2026-38'])for(const width of [1280,1440]){const pair=r.results.filter(x=>x.item===item&&x.width===width);assert.deepEqual(pair.map(x=>x.layout),['IMPROVE','REPLACE']);assert.deepEqual(pair[0].input,pair[1].input);assert.deepEqual(pair[0].startState,pair[1].startState);assert.deepEqual(pair[0].endState,pair[1].endState);assert.ok(pair.every(x=>x.geometry.documentOverflow<=1&&x.geometry.judgeOverflow<=1))}
})
check('current manifest plus40 private captures and actual terminal exit log',()=>{
 for(const f of m.files)assert.equal(digest(path.join(dir,f.file)),f.sha256,f.file)
 assert.equal(digest(m.execution.path),m.execution.sha256);assert.equal(digest(path.join(dir,'RESULTS.json')),m.execution.sha256)
 assert.equal(r.captures.length,40);for(const c of r.captures){assert.equal(digest(c.path),c.sha256);assert.ok(c.path.toLowerCase().startsWith(runtime.toLowerCase()))}
 assert.equal(fs.readFileSync(path.join(runtime,'run-04-exit.txt'),'utf8').trim(),'0')
 const terminalBytes=fs.readFileSync(path.join(runtime,'run-04-terminal.log'))
 const terminal=terminalBytes[0]===255&&terminalBytes[1]===254?terminalBytes.toString('utf16le'):terminalBytes.toString('utf8')
 assert.ok(terminal.includes('"passed":12'))
})
check('real failed executions preserved separately and98/24/42prior evidence reused without rerun',()=>{
 const a=read(path.join(runtime,'run-01/EXECUTION.json')),b=read(path.join(runtime,'run-02/EXECUTION.json')),c=read(path.join(runtime,'run-03/EXECUTION.json'))
 assert.ok(a.failure.includes("'none' !== 'solid'"));assert.ok(b.failure.includes('Timeout'));assert.equal(c.failure,null);assert.equal(c.results.length,12)
 const old=read(path.join(control,'runtime/t0131-s1-fit-20261023/inputs-and-tests.json'));assert.equal(old.tests.passed,98);assert.equal(old.tests.failed,0);assert.equal(old.equivalentFiles.length,62)
 for(const f of old.equivalentFiles)assert.equal(digest(path.join(wt,f.path)),f.sha256)
 assert.deepEqual(r.reuse,{prior98TestsRerun:false,prior24CasesRerun:false,prior42CasesRerun:false})
})
check('F08 no unsupported single winner, held four and accessibility/content/auth/audio gaps preserved',()=>{
 assert.equal(d.F08.currentSelection,null);assert.equal(d.F08.status,'SINGLE_WINNER_NOT_ESTABLISHED');assert.equal(d.independentVerdict,'AWAITING_ACCEPT_PARTIAL_REJECT')
 for(const id of ['F02','F06','F09','F10'])assert.equal(d.otherHeldFeatures[id],'BLOCKED_EVIDENCE')
 for(const key of ['colorContrast','screenReader','pdfImageTextAlternative','fullKeyboardTraversal'])assert.equal(r.accessibility[key],'NOT_VERIFIED')
 assert.deepEqual(r.notAuthorized,['main integration','S2 full implementation','DB/original mutation'])
})
console.log(JSON.stringify({task:'T-0136',commit:git(['rev-parse','HEAD']),checks,browser:{cases:12,pass:12,assertions:100,notApplicable:8,captures:40},sourceBoundCorrection:'PROPOSED_NOT_APPROVED',F08:'SINGLE_WINNER_NOT_ESTABLISHED',independentReview:'AWAITING_ACCEPT_PARTIAL_REJECT',unverified:r.unverified},null,2))
