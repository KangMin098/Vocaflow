// docs/csat-learner/g3-transfer-20261024/validate.mjs
// Read-only provenance/contract checks for G3; no product test, DB write or content approval.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const dir=path.dirname(fileURLToPath(import.meta.url)),wt=path.resolve(dir,'../../..'),idx=process.argv.indexOf('--control-root');assert.ok(idx>=0,'--control-root required')
const control=process.argv[idx+1],runtime=path.join(control,'runtime/g3-transfer-20261024')
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),digest=p=>hash(fs.readFileSync(p)),canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':JSON.stringify(v),ch=v=>hash(canon(v))
const git=(args,encoding='utf8')=>execFileSync('git',['-C',wt,...args],{encoding,maxBuffer:64*1024*1024})
const s=read(dir+'/SOURCE_INDEX.json'),d=read(dir+'/DATA_STATUS.json'),q=read(dir+'/CUE_DISCLOSURE_34.json'),m=read(dir+'/MANIFEST.json'),local=read(runtime+'/LOCAL_34.json'),db=read(runtime+'/DB_34.json'),snapshot=read(s.privateSnapshot),checks=[]
function check(name,fn){fn();checks.push({name,result:'PASS'})}
check('fixed branches and61 source blobs match frozen observations;intake history and accepted spec preserved',()=>{
 assert.equal(s.files.length,61);assert.equal(digest(s.privateSnapshot),s.privateSnapshotSha256);assert.equal(digest(s.initialSnapshot.path),s.initialSnapshot.sha256)
 for(const f of s.files){assert.equal(hash(git(['show',`${f.commit}:${f.path}`],null)),f.blobSha256);const original=snapshot.files.find(x=>x.branch===f.branch&&x.path===f.path);assert.equal(digest(original.snapshot),f.blobSha256)}
 assert.equal(s.productScopeDeltaFromAccepted,'');assert.equal(s.lectureBehindMain,0)
 for(const f of s.files.filter(f=>f.branch==='accepted'))assert.equal(hash(git(['show',`HEAD:${f.path}`],null)),f.blobSha256)
})
check('allowed documentation delta only;no product,original,research or main integration',()=>{
 git(['merge-base','--is-ancestor',s.refs.accepted,'HEAD'])
 const names=[...git(['diff','--name-only',s.refs.accepted]).trim().split('\n'),...git(['ls-files','--others','--exclude-standard']).trim().split('\n')].filter(Boolean)
 assert.ok(names.every(f=>f==='docs/CHANGELOG.md'||f.startsWith('docs/csat-learner/g3-transfer-20261024/')))
 assert.equal(git(['diff','--name-only',s.refs.accepted,'--','apps','packages','scripts','supabase','docs/csat-learner/skeleton-v4']).trim(),'')
})
check('read-only DB snapshot five choices versus separate author visual PDF comparison',()=>{
 assert.equal(digest(d.database.privateEvidence),d.database.privateEvidenceSha256);assert.equal(db.item.id,'2026#34');assert.equal(db.item.choices.length,5);assert.equal(ch(db.item.choices),d.database.choicesSha256);assert.equal(db.item.answer,3)
 assert.equal(db.analyses.at(-1).version,5);assert.ok(db.analyses.every(a=>a.units_hash===null&&a.units_version===null));assert.equal(db.units,null);assert.equal(db.skeleton,null)
 for(const f of [d.pdfComparison.question,d.pdfComparison.answer,d.pdfComparison.pageImage])assert.equal(digest(f.path),f.sha256)
 assert.equal(d.pdfComparison.status,'AUTHOR_VISUAL_MATCH_NOT_INDEPENDENT_CONTENT_APPROVAL');assert.equal(d.pdfComparison.choices.length,5);assert.ok(d.pdfComparison.choices.every(x=>x.stored&&x.visuallyMatched));assert.equal(d.pdfComparison.productPdfWorkerAlignmentVerified,false)
 assert.equal(d.database.privilegedReadIsNormalAuthRlsProof,false)
})
check('analysis5,inquiry/meaning bindings,lecture2 and original unknown/fails preserved',()=>{
 assert.equal(local.inquiry.analysis_version,5);assert.equal(local.inquiry.v3.units_hash,'7fb095d3cac4821e');assert.equal(local.meaning.binding.basePublicHash,ch(local.inquiry));assert.equal(ch(local.inquiry),d.inquiry.canonicalRecordSha256);assert.equal(ch(local.meaning),d.meaning.canonicalRecordSha256)
 const c=local.inquiry.v3.choices.find(c=>c.n===2);assert.equal(c.content_truth,'unknown');assert.equal(c.requirement_fit,'fails');assert.deepEqual(d.inquiry.choice2,{truth:'unknown',fit:'fails'})
 assert.equal(d.fileSkeleton.present,true);assert.equal(d.meaning.alignmentSentences,7);assert.equal(d.meaning.liveSourceSnapshotHashRecheckedByLoader,false)
 assert.equal(local.lecture.version,2);assert.equal(local.lecture.cues.length,12);assert.equal(ch(local.lecture),d.lecture.canonicalRecordSha256);assert.equal(d.lecture.analysisBindingPresent,false);assert.equal(d.lecture.disclosureTagsPresent,false)
 assert.equal(d.inquiry.registeredPairCount,0)
})
check('twelve cue-risk proposals bind exact originals;approval and cumulative elimination remain separate',()=>{
 assert.equal(q.status,'PROPOSED_NOT_APPROVED');assert.equal(q.appliedToProduct,false);assert.equal(q.independentContentReview,'NOT_RUN');assert.equal(q.cues.length,12);assert.equal(q.binding.lectureSha256,ch(local.lecture));assert.equal(q.binding.sourcePdfSha256,d.pdfComparison.question.sha256)
 for(const c of q.cues){const original=local.lecture.cues.find(x=>x.id===c.id);assert.equal(ch(original),c.canonicalCueSha256);assert.deepEqual(c.target,original.target);assert.ok(c.riskChannels.includes('aria'));assert.ok(['hint','decisive','answer'].includes(c.proposedLevel))}
 assert.equal(q.firstProposedHint,'c1');assert.equal(q.cues.find(c=>c.id==='c4').proposedLevel,'answer');assert.deepEqual(q.cumulativeRules.distinctRejectedChoices,[1,2,4,5]);assert.equal(q.cumulativeRules.reviewStatus,'NOT_APPROVED');assert.equal(q.consentDoesNotOverrideContentHold,true)
 for(const id of ['c7','c10'])assert.equal(q.cues.find(c=>c.id===id).contentState,'HOLD_INDEPENDENT_CONTENT_REVIEW')
 const side=read(runtime+'/snapshots-r2/research/'+d.researchSidecar.path);assert.equal(digest(runtime+'/snapshots-r2/research/'+d.researchSidecar.path),d.researchSidecar.fileSha256);const lecture=side.lectures.find(l=>l.lecture_id==='2026#34');for(const c of lecture.cues)assert.equal(c.source_hash,'sha256:'+hash(JSON.stringify(local.lecture.cues.find(x=>x.id===c.cue_id))))
 assert.equal(q.cues.find(c=>c.id==='c3').existingResearch.local,'UNKNOWN');assert.equal(q.cues.find(c=>c.id==='c3').existingResearch.conflict,true);assert.equal(q.cues.find(c=>c.id==='c5').existingResearch.cumulative,'ANSWER');assert.equal(q.cues.find(c=>c.id==='c5').existingResearch.local,'UNKNOWN');assert.equal(d.researchSidecar.usedByProduct,false)
})
check('main versus learner-control actual residual paths and evidence scope',()=>{
 const source=(branch,file)=>fs.readFileSync(runtime+'/snapshots-r2/'+branch+'/apps/web/src/'+file,'utf8')
 const main=source('main','components/csat/theater/AnalysisTheater.tsx'),theater=source('lecture','components/csat/theater/AnalysisTheater.tsx'),stage=source('lecture','components/csat/lecture/LectureStage.tsx')
 assert.ok(main.includes("if (target !== scene) selectScene(target, 'replace')"));assert.ok(!theater.includes("if (target !== scene) selectScene(target, 'replace')"));assert.ok(theater.includes("if (lec && lec.status === 'playing') lec.toggle()"));assert.ok(theater.includes('lec && lectureStarted'));assert.ok(stage.includes('setFollowing(true)'));assert.ok(stage.includes('void playerRef.current.jump(i)'));assert.ok(stage.includes('if (active && following)'));assert.ok(stage.includes("window.addEventListener('pointerdown'"))
 const r3=fs.readFileSync(runtime+'/snapshots/research/docs/csat-learner/all-types-research-20261024/19_INDEPENDENT_VERIFICATION_R3.md','utf8');assert.ok(r3.includes('6f7fbe1ce'));assert.ok(r3.includes('PARTIAL'));assert.ok(r3.includes('AnalysisTheater'))
 const report=read(runtime+'/snapshots/research/docs/csat-learner/all-types-research-20261024/harness/harness-results.json');assert.equal(report.results.length,32);assert.ok(report.results.every(r=>r.pass));assert.ok(report.harness.includes('LectureStage isolated'))
})
check('current manifest and collision scan bound without claiming other workers idle',()=>{
 for(const f of m.files)assert.equal(digest(path.join(wt,f.path)),f.sha256,f.path)
 for(const f of m.privateArtifacts)assert.equal(digest(f.path),f.sha256,f.path)
 assert.equal(s.conflicts.scannedLocalBranches,294);assert.equal(s.conflicts.noCommonHistory.length,5);assert.equal(s.conflicts.committedDeltaCandidates.length,21);assert.ok(s.conflicts.committedDeltaCandidates.some(c=>c.ref==='feat/lecture-learner-control'))
})
check('preserved decisions and no fabricated PDF/auth/a11y/effect success',()=>{
 assert.deepEqual(d.preserved,{D1A:'ACCEPT',C1Content:'NOT_APPROVED',D2:'ACCEPT',F08:'UNDETERMINED',transfer34:'ACCEPT_DESIGN_ONLY',product34:'NOT_COMPLETE',wholeS1:'NOT_APPROVED',wholeS2:'NOT_APPROVED',mainIntegration:'NOT_APPROVED'})
 assert.ok(d.unverified.includes('normal learner auth and RLS'));assert.ok(d.unverified.includes('real TTS'));assert.equal(q.safeNoneCueCount,0)
})
const currentRefs=Object.fromEntries([['main','main'],['research','research/csat-all-types-20261024'],['lecture','feat/lecture-learner-control']].map(([k,ref])=>[k,git(['rev-parse',ref]).trim()]))
console.log(JSON.stringify({task:'T-0137',commit:git(['rev-parse','HEAD']).trim(),checks,verificationScope:'Read-only provenance and contract integrity; no product test or content approval',reused:{T0136:'limited ACCEPT',lectureResearch:'32 isolated cases at recorded prior SHA,not rerun'},newProductTestsRun:0,sourceRefs:s.refs,currentRefs,refDrift:Object.keys(currentRefs).filter(k=>currentRefs[k]!==s.refs[k]),F08:'UNDETERMINED',independentReview:'AWAITING_CLAUDE',unverified:d.unverified},null,2))
