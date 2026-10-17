// scripts/research/factory-i0-277-independent/audit.mjs
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process'
import {productHashes,assertSameManifest,hashFile} from '../lm-g1-5a-independent/binding.mjs'
import {renderBrowserRunner} from '../lm-g1-5a-independent/runner-contract.mjs'
import {factoryBrowserJobs} from './jobs.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),local=path.join(import.meta.dirname,'local'),docs=root+'/docs/research/factory-i0-277-independent'
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),expected={'v2-1280':6,'v2-1440':6,'t4-1280':14,'t4-1440':14,t1:9,'t1-1440':9,'t2-1280':26,'t2-1440':26,'t3-1280':20,'t3-1440':20,security:18,workspace:36,return:7,study:6,supply:6},chosen={},excluded=[]
for(const revision of (process.argv[2]??'regression-final').split(',')){
 const run=path.join(local,revision),summary=run+'/browser-summary.json';if(!fs.existsSync(summary))continue
 for(const row of read(summary)){
  const folder=run+'/'+row.name,job=factoryBrowserJobs('http://localhost:3013',run).find(x=>x[0]===row.name)
  if(!job)throw Error('Unknown browser job')
  let sourceMatches=false;try{assertSameManifest(read(folder+'/source-hashes.json'),productHashes(root));sourceMatches=true}catch{}
  const runnerMatches=fs.readFileSync(folder+'/runner.mjs','utf8')===renderBrowserRunner({root,file:job[1],folder,at:row.startedAt})
  const log=fs.readFileSync(folder+'/run.log','utf8'),lines=log.split(/\r?\n/),loggedPass=lines.filter(l=>/^\[PASS\]|^PASS (?!\d)/.test(l)).length,loggedFail=lines.filter(l=>/^\[FAIL\]|^FAIL /.test(l)).length
  const logMatches=loggedPass===row.passLines&&loggedFail===row.failLines&&!lines.some(l=>/^\[FATAL\]/.test(l))
  const complete=row.exit===0&&row.passLines===expected[row.name]&&row.failLines===0&&row.cleanup.ok&&row.cleanup.accountsLeft===0&&row.cleanup.unknown===0&&row.sourceStable&&sourceMatches&&runnerMatches&&logMatches
  const bound={...row,revision,sourceMatches,runnerMatches,logMatches,runLogSha256:hashFile(folder+'/run.log'),runnerSha256:hashFile(folder+'/runner.mjs'),sourceManifestSha256:hashFile(folder+'/source-hashes.json')}
  if(complete)chosen[row.name]=bound;else excluded.push(bound)
 }
}
const missing=Object.keys(expected).filter(k=>!chosen[k]);if(missing.length){console.log(JSON.stringify({pending:true,missing,completed:Object.keys(chosen),excluded}));process.exit(1)}
const units=read(local+'/unit-final-binding.json');assertSameManifest(units.hashes,productHashes(root))
if(units.passed!==77||units.failed!==0||units.skipped!==0||units.resultSha256!==hashFile(local+'/unit-final.json')||units.runnerSha256!==hashFile(import.meta.dirname+'/unit-final.mjs'))throw Error('Stale or incomplete units')
const broad=read(local+'/broad-final-binding.json');assertSameManifest(broad.hashes,productHashes(root))
if(broad.files!==215||broad.passed!==2603||broad.failed!==0||broad.skipped!==0||broad.runnerSha256!==hashFile(import.meta.dirname+'/checks.mjs')||broad.wrapperSha256!==hashFile(import.meta.dirname+'/broad-final.mjs'))throw Error('Stale broad unit run')
for(const report of broad.reports)if(report.sha256!==hashFile(local+'/checks-broad/'+report.file))throw Error('Changed broad report')
const sql=read(docs+'/SQL-ISOLATED.json');if(sql.rows[0]?.reproduced!==true||sql.rows[0]?.safetyPass!==false||sql.rows.slice(1).length!==7||sql.rows.slice(1).some(x=>x.pass!==true))throw Error('Pending SQL audit incomplete')
const authSql=read(docs+'/SQL-AUTH-ISOLATED.json');if(authSql.rows[0]?.reproduced!==true||authSql.rows[0]?.safetyPass!==false||authSql.rows.slice(1).length!==5||authSql.rows.slice(1).some(x=>x.pass!==true)||authSql.helperSnapshotSha256!==hashFile(docs+'/AUTH-HELPERS.json'))throw Error('Pending SQL authorization audit incomplete')
const pendingHash=hashFile(root+'/supabase/migrations/_pending_workspace_supply_c_qualification.sql');if(sql.pendingFileSha256!==pendingHash||authSql.pendingFileSha256!==pendingHash||sql.remoteChanges!==false||authSql.remoteChanges!==false)throw Error('SQL evidence is not bound to the current unmodified proposal')
for(const [published,run] of [['SQL-ISOLATED.json','sql-isolated.json'],['SQL-AUTH-ISOLATED.json','sql-auth-isolated.json']])if(hashFile(docs+'/'+published)!==hashFile(local+'/'+run))throw Error('Published SQL evidence differs from its local run')
const s01=fs.readFileSync(root+'/apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/factory-bridge.test.ts','utf8');const section=s=>s.slice(s.indexOf("describe('반례 S01–S16'"),s.indexOf("describe('ProductionNeed 상태 사다리"))
const original=spawnSync('git',['show','200bfdeacd55af39f35c5d3a9648ffe050b7e3ed:apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/factory-bridge.test.ts'],{cwd:root,encoding:'utf8'})
if(original.status!==0||section(original.stdout)!==section(s01))throw Error('S01-S16 changed')
const evidence={submittedHead:'200bfdeacd55af39f35c5d3a9648ffe050b7e3ed',baseMain:'9c19f15b1fc911b13040dc01fe5a12fef5af592f',sourceBasis:units.head,head:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),connection:'CONTRACT_ONLY',actualFactory:'NOT_CONNECTED',actualOrderProductionDelivery:'NOT_CLAIMED',browsers:{assertions:Object.values(chosen).reduce((n,x)=>n+x.passLines,0),jobs:Object.values(chosen),excluded},units,broad,sql:{file:'SQL-ISOLATED.json',sha256:hashFile(docs+'/SQL-ISOLATED.json'),pending:'BLOCKED_APPROVAL',remoteChanges:false},authorizationSql:{file:'SQL-AUTH-ISOLATED.json',sha256:hashFile(docs+'/SQL-AUTH-ISOLATED.json'),pending:'BLOCKED_APPROVAL',remoteChanges:false},originals:{initialSha256:hashFile(docs+'/INITIAL.json'),pinnedReplaySha256:hashFile(docs+'/PINNED-REPLAY.json'),purposeSha256:hashFile(docs+'/PURPOSE-REVIEW.json'),s01S16:'byte-identical'},limits:['Typed pure inputs are not authenticated server ledger readers','Lineage structural hashes are not actual content verification','SQL proposal checks use local admin fixtures; no live RLS or concurrency claim','No actual orders, production, release, learner delivery or learning effect']}
const out=docs+'/EVIDENCE.json';if(fs.existsSync(out))throw Error('Immutable evidence exists')
fs.writeFileSync(out,JSON.stringify(evidence,null,2));console.log(JSON.stringify({jobs:Object.keys(chosen).length,browserAssertions:evidence.browsers.assertions,units:units.passed}))
