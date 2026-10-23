// docs/csat-learner/skeleton-v4/s1-v6/correction/r2/validate.mjs
// Read-only evidence integrity; neither content approval nor independent review.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {candidateErrors,objectHash} from '../candidate-check.mjs'
const here=path.dirname(fileURLToPath(import.meta.url)),dir=path.dirname(here),wt=path.resolve(here,'../../../../../..')
const idx=process.argv.indexOf('--control-root');assert.ok(idx>=0,'--control-root required')
const control=process.argv[idx+1],runtime=path.join(control,'runtime/t0135-correction-20261024')
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),digest=p=>sha(fs.readFileSync(p))
const git=args=>execFileSync('git',['-C',wt,...args],{encoding:'utf8'}).trim(),base='9e73d7660bfaa03f4bb73320275525137df92df9'
const r=read(path.join(here,'RESULTS.json')),m=read(path.join(here,'MANIFEST.json')),decision=read(path.join(here,'DECISION_UPDATE.json')),p=read(path.join(dir,'C1_CANDIDATE.json')),binding=read(path.join(dir,'SOURCE_BINDINGS.json')),old=read(path.join(dir,'RESULTS.json'))
const checks=[];function check(name,fn){fn();checks.push({name,result:'PASS'})}
function textLog(p){const b=fs.readFileSync(p);return b[0]===255&&b[1]===254?b.toString('utf16le'):b.toString('utf8')}
check('same task ancestry and allowed delta; product/original/prior artifacts preserved',()=>{
 git(['merge-base','--is-ancestor',base,'HEAD'])
 const changed=[...git(['diff','--name-only',base]).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean)
 assert.ok(changed.every(f=>f==='docs/CHANGELOG.md'||f==='docs/csat-learner/skeleton-v4/s1-v6/README.md'||f.startsWith('docs/csat-learner/skeleton-v4/s1-v6/correction/')))
 for(const[f,h]of Object.entries({...old.priorHashes,...old.originalHashes}))assert.equal(digest(path.join(wt,f)),h,f)
 for(const[f,h]of Object.entries(r.immutableR1Hashes)){assert.equal(digest(path.join(dir,f)),h);const bytes=execFileSync('git',['-C',wt,'show',`${base}:docs/csat-learner/skeleton-v4/s1-v6/correction/${f}`]);assert.equal(sha(bytes),h)}
})
check('official PDF/answers/source-page and sentence bindings remain exact',()=>{
 assert.equal(digest(path.join(runtime,'official-2026-english.pdf')),binding.questionSha256);assert.equal(digest(path.join(runtime,'official-2026-answers.pdf')),binding.answerSha256)
 for(const c of binding.pageCaptures)assert.equal(digest(c.path),c.sha256)
 const sentences=read(path.join(runtime,'38-source-sentences.json')).sentences
 for(const s of binding.sentenceBindings)assert.equal(sha(sentences[s.sentence-1]),s.sha256)
 for(const a of binding.newShortAnchors)assert.ok(sentences[a.sentence-1].includes(a.text))
 assert.deepEqual(binding.officialAnswers,{'2026#34':3,'2026#22':1,'2026#38':5})
})
check('C1 preserves original/version/hash,wide context and separate approval B',()=>{
 const original=read(path.join(wt,p.baseFile)).items['2026#38'],current={item:original,fileHash:digest(path.join(wt,p.baseFile)),sourceHash:binding.questionSha256};assert.deepEqual(candidateErrors(p,current),[])
 assert.deepEqual(p.payload.expected,original.v3.choices.find(c=>c.n===5));assert.deepEqual(p.payload.proposed.sentences,[1,4,5,6,7,8]);assert.ok(p.payload.proposed.decisive.includes('4~5번'));assert.ok(p.payload.proposed.decisive.includes('6~7번 사례만을 유일한 지시 대상으로 한정하지 않는다'))
 assert.equal(p.version,'1.0.0');assert.equal(p.approval.status,'NOT_APPROVED');assert.equal(p.approval.appliedToOriginal,false)
 for(const mutate of [x=>x.baseFileSha256='0'.repeat(64),x=>x.payload.proposed.decisive+='tamper',x=>{x.payload.proposed.sentences=[1,6,7,8];x.payloadSha256=objectHash(x.payload)},x=>x.approval.required=false]){const x=structuredClone(p);mutate(x);assert.ok(candidateErrors(x,current).length>0)}
})
check('actual unit9 PASS/0 FAIL/0skip;browser16cases60assertions28captures16AX',()=>{
 assert.equal(fs.readFileSync(path.join(runtime,'r2/unit-exit.txt'),'utf8').trim(),'0');const unit=textLog(path.join(runtime,'r2/unit.log'));assert.match(unit,/^[#ℹ] pass 9\r?$/m);assert.match(unit,/^[#ℹ] fail 0\r?$/m);assert.match(unit,/^[#ℹ] skipped 0\r?$/m)
 assert.equal(r.cases.length,16);assert.ok(r.cases.every(c=>c.result==='PASS'));assert.equal(r.assertions.length,60);assert.ok(r.assertions.every(a=>a.result==='PASS'));assert.equal(r.captures.length,28);assert.equal(r.failure,null);assert.deepEqual(r.errors,[]);assert.deepEqual(r.network,[])
 assert.equal(r.cases.filter(c=>c.audience==='learner').length,12);assert.equal(r.cases.filter(c=>c.audience==='review').length,4)
 for(const c of r.cases){assert.equal(digest(c.aria.path),c.aria.sha256);assert.ok(c.documentOverflow<=1)}for(const c of r.captures)assert.equal(digest(c.path),c.sha256)
 assert.equal(fs.readFileSync(path.join(runtime,'r2/run-01-exit.txt'),'utf8').trim(),'0');assert.ok(textLog(path.join(runtime,'r2/run-01.log')).includes('"pass":16'))
 assert.equal(digest(path.join(here,'RESULTS.json')),digest(path.join(runtime,'r2/run-01/EXECUTION.json')))
})
check('manifest files,private logs and visually inspected captures hash-bound',()=>{
 for(const f of m.files)assert.equal(digest(path.join(wt,f.path)),f.sha256,f.path)
 for(const f of m.privateArtifacts)assert.equal(digest(f.path),f.sha256,f.path)
 assert.equal(m.visualInspection.length,4);for(const f of m.visualInspection)assert.ok(r.captures.some(c=>c.path===f.path&&c.sha256===f.sha256))
})
check('98 tests source equivalence and historical controlled evidence reused without rerun',()=>{
 const tests=read(path.join(control,'runtime/t0131-s1-fit-20261023/inputs-and-tests.json'));assert.equal(tests.tests.passed,98);assert.equal(tests.tests.failed,0);assert.equal(tests.equivalentFiles.length,62);for(const f of tests.equivalentFiles)assert.equal(digest(path.join(wt,f.path)),f.sha256)
 assert.equal(old.results.length,12);assert.equal(old.results.flatMap(x=>x.steps).filter(x=>x.result==='PASS').length,100);assert.equal(old.results.flatMap(x=>x.steps).filter(x=>x.result==='NOT_APPLICABLE').length,8)
 assert.deepEqual(old.reuse,{prior98TestsRerun:false,prior24CasesRerun:false,prior42CasesRerun:false})
})
check('F08 prospective7domains,measurements null,two candidates no winner',()=>{
 const t=fs.readFileSync(path.join(here,'F08_EVALUATION.md'),'utf8');for(const x of ['1 동시 확인','2 근거 왕복','3 가독성','4 키보드','5 강의 독립','6 중복','7 구현','34-A','22-A','38-A','INVALID','UNSELECTED','사후 가중치'])assert.ok(t.includes(x),x)
 assert.deepEqual(decision.F08.candidates,['IMPROVE','REPLACE']);assert.equal(decision.F08.selected,null);assert.equal(decision.F08.measurements,null);assert.equal(decision.F08.status,'UNSELECTED')
})
check('transfer specification actual code scope preserved;implementation unrun,approval gaps held',()=>{
 const scope=read(path.join(here,'CODE_SCOPE.json'));for(const f of scope.files)assert.equal(digest(path.join(wt,f.path)),f.sha256)
 const t=fs.readFileSync(path.join(here,'PRODUCT_TRANSFER_2026_34.md'),'utf8');for(const x of ['F01','F03','F04','F05','F07','OFFICIAL_ANSWER','UNREGISTERED','HELD_CONTENT_APPROVAL','SOURCE_MISMATCH','map_ws','map_attempt','check=1','숙달','수용 테스트'])assert.ok(t.includes(x),x)
 assert.equal(decision.productTransfer.status,'DESIGN_ONLY_NOT_IMPLEMENTED');assert.equal(decision.D1.B,'NOT_APPROVED');assert.equal(decision.independentReview,'AWAITING_CLAUDE')
 for(const id of ['F02','F06','F09','F10'])assert.equal(decision.held[id],'BLOCKED_EVIDENCE')
 assert.ok(r.unverified.includes('screen reader'));assert.ok(r.unverified.includes('real local PDF'));assert.ok(r.notAuthorized.includes('product implementation'))
})
console.log(JSON.stringify({task:'T-0136',runSeq:2,commit:git(['rev-parse','HEAD']),checks,unit:{pass:9,fail:0,skip:0},browser:{pass:16,fail:0,assertions:60,captures:28,AX:16},D1:{A:'AUTHOR_PASS_PENDING_CLAUDE',B:'NOT_APPROVED'},F08:'UNSELECTED',productTransfer:'DESIGN_ONLY_NOT_IMPLEMENTED',independentReview:'AWAITING_CLAUDE',unverified:r.unverified},null,2))
