// scripts/research/lm-g1-4-independent/audit.mjs
// Publish only bounded metadata and selected UI captures, never raw runtime/accounts.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
const root=path.resolve(import.meta.dirname,'../../..'),local=path.join(import.meta.dirname,'local'),docs=root+'/docs/research/lm-g1-4-independent'
const req=createRequire(root+'/apps/web/package.json'),environment={node:process.version,platform:process.platform,next:req('next/package.json').version,playwright:req('@playwright/test/package.json').version,typescript:req('typescript/package.json').version,vitest:req('vitest/package.json').version,browser:'Playwright default headless Chromium',server:'owned next dev localhost:3011',database:'development DB; owned synthetic account API writes and scoped read-only audit'}
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()
const read=p=>JSON.parse(fs.readFileSync(local+'/'+p,'utf8'))
const hash=x=>crypto.createHash('sha256').update(x).digest('hex')
const write=(name,value)=>fs.writeFileSync(docs+'/'+name,JSON.stringify(value,null,2)+'\n')
const assertions=u=>u.testResults.flatMap(f=>f.assertionResults.map(t=>({name:t.title,status:t.status,...(t.failureMessages?.length?{failures:t.failureMessages}:{} )})))
const base='8ee927dcee80a9b19d70b2d4c86869e8ea013813',pinned='68b1541fff7dd0dd880e6bd51e1ba091d770786c',head=git('rev-parse','HEAD'),run=process.argv[2]??'final-v5',rest=process.argv[3]??'final-v6'
if(git('ls-files','scripts/research/lm-g1-4-independent/local'))throw Error('Private files are tracked')
const coreNames=['t4-1280','t4-1440','t1'],rows=[...read(run+'/browser-summary.json').filter(r=>coreNames.includes(r.name)).map(r=>({...r,revision:run})),...read(rest+'/browser-summary.json').map(r=>({...r,revision:rest}))],required=[...coreNames,'t2-1280','t2-1440','t3-1280','t3-1440','security','workspace','return','study','supply']
for(const r of rows)r.runnerSha256=hash(fs.readFileSync(local+'/'+r.revision+'/'+r.name+'/runner.mjs'))
if(rows.length!==required.length||!required.every(n=>rows.some(r=>r.name===n)))throw Error('Browser coverage incomplete')
if(rows.some(r=>r.exit!==0||r.failLines||!r.sourceStable||!r.cleanup.ok))throw Error('Failed, unstable or unclean browser run')
const expectedCounts={'t4-1280':14,'t4-1440':14,t1:9,'t2-1280':26,'t2-1440':26,'t3-1280':20,'t3-1440':20,security:18,workspace:36,return:7,study:6,supply:6}
if(rows.some(r=>r.passLines!==expectedCounts[r.name]))throw Error('Incomplete browser assertion count')
const productFiles=git('diff','--name-only',base+'...HEAD','--','apps/web').split(/\r?\n/).filter(Boolean)
const productHashes=Object.fromEntries(productFiles.map(f=>[f,hash(fs.readFileSync(root+'/'+f))]))
const runtimeFiles=productFiles.filter(f=>!f.includes('__tests__')&&/\.(ts|tsx|css)$/.test(f))
for(const r of rows){const atRun=read(r.revision+'/'+r.name+'/source-hashes.json');if(runtimeFiles.some(f=>atRun[f]!==productHashes[f]))throw Error('Product changed after '+r.name)}
const parts=read('checks-broad/partitions.json'),units={files:0,pass:0,fail:0,pending:0}
const independent=[]
for(const p of parts){const u=read('checks-broad/'+p.report);if(!p.ok)throw Error('Unit partition failed');units.files+=p.files.length;units.pass+=u.numPassedTests;units.fail+=u.numFailedTests;units.pending+=u.numPendingTests;for(const f of u.testResults)if(/independent|instrument-hashes/.test(f.name))independent.push(...assertions({testResults:[f]}))}
if(units.fail||units.pending)throw Error('Unit failures/pending')
for(const mode of ['types','lint'])if(read('checks/'+mode+'-exit.json').exit!==0)throw Error(mode+' failed')
const original=read('original-counterexamples.json'),replay=read('baseline-final/results.json')
if(read('baseline-final/manifest.json').fixtureSha256!==hash(fs.readFileSync(root+'/apps/web/src/lib/csat/map/v62/__tests__/evidence-claims-independent.test.ts')))throw Error('Pinned replay fixture changed')
write('INITIAL-FAILS.json',{pinned,initial:{artifactSha256:hash(fs.readFileSync(local+'/original-counterexamples.json')),pass:original.numPassedTests,fail:original.numFailedTests,assertions:assertions(original)},stricterReplay:{...read('baseline-final/manifest.json'),assertions:assertions(replay)},explanation:'Initial exploratory 6/14 retained; later frozen fixture explicitly asserts unknown reader states and confirmed-help retry ineligibility. Pinned replay 5/15 is not a passing product result.'})
const probes={loaderOriginal:read('loader-full-gate-original.json'),loaderRevised:read('loader-full-gate-revised.json'),qualificationOriginal:read('qualification-original.json'),qualificationRevised:read('qualification-revised.json'),anchorOriginal:read('anchor-original.json'),anchorRevised:read('anchor-revised.json'),linkOriginal:read('link-failure-original.json'),linkRevised:read('link-failure-revised.json')}
if(probes.loaderRevised.results.some(r=>!r.pass)||['qualificationRevised','anchorRevised','linkRevised'].some(k=>probes[k].rows.some(r=>!r.pass)))throw Error('Revised probe failure')
const screenshots=[];fs.mkdirSync(docs+'/evidence',{recursive:true})
for(const width of [1280,1440])for(const [from,to] of [['04-01-find-failed-pop.png','find-popup'],['08-02-repair-fixed-drawer.png','repair-drawer'],['09-02-repair-fixed-modal.png','repair-workspace']]){
 const source=local+'/'+run+'/t4-'+width+'/'+from,target='evidence/'+to+'-'+width+'.png'
 fs.copyFileSync(source,docs+'/'+target);screenshots.push({path:target,width,height:900,sha256:hash(fs.readFileSync(source))})
}
const core=rows.filter(r=>r.name.startsWith('t4-')).map(r=>{const x=read(run+'/'+r.name+'/results.json');if(x.pass!==14||x.fail||x.fatal)throw Error('T4 core incomplete');return {name:r.name,sha:x.sha,dirtyTree:x.dirtyTree,width:x.width,pass:x.pass,fail:x.fail,accounts:x.accounts,layers:x.layers,assertions:x.results.map(t=>({id:t.id,name:t.name,status:t.status,layer:t.layer}))}})
const targetComparisons=[]
for(const width of [1280,1440])for(const score of [80,90]){const raw=fs.readFileSync(local+'/'+run+'/t4-'+width+'/runtime-'+score+'.local.json'),d=JSON.parse(raw),g=d.v4.target.goal;if(g.id==null)throw Error('Goal version missing');targetComparisons.push({width,score:g.score,exam:g.exam,goalVersionFingerprint:hash(String(g.id)),scopeExams:d.v4.target.scope.exams,inputSha256:hash(raw)})}
const compose=Object.fromEntries(['base','pinned','revised'].map(k=>[k,read('compose-'+k+'.json')]))
for(let i=0;i<2;i++)for(const key of ['asIsHash','planHash','taskPlansHash','toBeHash'])if(new Set(Object.values(compose).map(x=>x.inputs[i][key])).size!==1)throw Error('Existing engine output changed: '+key)
if(compose.revised.inputs[0].evidenceHash!==compose.revised.inputs[1].evidenceHash)throw Error('Goal changed evidence retrospectively')
const db=read('db-audit.json')
write('DB-AUDIT.json',{observedAt:db.observed_at,viewDefinitionSha256:hash(db.first_view),firstSelection:'DISTINCT ON(user_id,task_key,COALESCE(item_ref,empty),phase) ORDER BY answered_at,id',selectsAttemptId:/a.id AS attempt_id/.test(db.first_view),securityInvoker:db.view_options.includes('security_invoker=true'),attemptsRls:db.attempts_rls,columnAudit:read('db-columns.json'),stockOmitted:'Snapshot occurred during owned synthetic tests; not a clean learner baseline. Read-only catalog query; no DB/RPC/RLS changes.'})
const authorFiles=git('diff','--name-only',base+'...'+pinned).split(/\r?\n/).filter(Boolean),byExtension={},byCategory={}
for(const f of authorFiles){const ext=path.extname(f);byExtension[ext]=(byExtension[ext]??0)+1;const kind=/\.png$/.test(f)?'screenshots':/\.json$/.test(f)?'records':f.includes('__tests__')?'tests':f.startsWith('apps/web/')?'product':f.startsWith('scripts/')?'scripts':/\.md$/.test(f)?'documents':'other';byCategory[kind]=(byCategory[kind]??0)+1}
write('SOURCE-AUDIT.json',{base,pinned,sourceBasis:head,authorFileCount:authorFiles.length,byExtension,byCategory,authorCode:'b6b818231',authorFinalWording:'b6e8b93cb',authorWordingToPinnedProductDelta:git('diff','--name-only','b6e8b93cb',pinned,'--','apps/web'),productHashes,scope:'Exact original git diff, not the capped GitHub 100-file listing. User-stated 141 is not the measured denominator.'})
write('SCREENSHOTS.json',{sourceBasis:head,run,screenshots})
write('EVIDENCE.json',{base,pinned,sourceBasis:head,run,rest,environment,lockfileSha256:hash(fs.readFileSync(root+'/pnpm-lock.yaml')),units,independentAssertions:independent,core,targetComparisons,browser:rows,serverCleanup:rows.map(r=>({name:r.name,...read(r.revision+'/'+r.name+'/server-cleanup.json')})),probes,compose,screenshots,priorRuns:['final','final-v2','final-v4','final-v5'].map(k=>({revision:k,results:read(k+'/browser-summary.json')})),limits:['Synthetic development accounts are not learner effect evidence','Injected query/source failures are not live DB outages or source edits','Currentness reuses existing grading gates; legacy boundary-only source checks remain limited','Historic asof is not complete historical DB/content reconstruction','P1-P7 remain BLOCKED_APPROVAL; delayed NOT_ESTABLISHED; effect NOT_EVALUATED','SourceStable=false runs and interrupted T2 exit 3221226505 are preserved and excluded; Next-generated tsconfig dirty state is disclosed']})
console.log(JSON.stringify({sourceBasis:head,units,browser:rows.length,core:core.map(x=>({name:x.name,pass:x.pass})),screenshots:screenshots.length}))
