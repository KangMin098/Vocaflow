// scripts/csat/reveal-gate/verify.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { scanLoaders,scanClient,scanBundle,pagingDiff,migrationCoverage } from './verification-core.mjs'
import {attestBuild,checkBuild,startVerifiedApp,sourceFingerprint,verificationFingerprint} from './build-attestation.mjs'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]}
const phase=value('--phase','merge'),base=value('--base',process.env.REVEAL_VERIFY_BASE??'origin/main')
if(!['pr','merge','db'].includes(phase))throw Error('Unknown verification phase')
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/csat/reveal-gate/manifest.json'),'utf8'))
const policy=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/csat/reveal-gate/verification-policy.json'),'utf8'))
const rows=[],src=path.join(ROOT,'apps/web/src')
const tmp=path.join(ROOT,'tmp');fs.mkdirSync(tmp,{recursive:true})
if(fs.realpathSync(tmp)!==tmp)throw Error('Report directory must not be a symlink')
// Receipts and .next are shared within a worktree; phases must never overlap.
const lockFile=path.join(tmp,'reveal-verification.lock')
if(fs.existsSync(lockFile)) {
  const pid=Number(fs.readFileSync(lockFile,'utf8'))
  let active=false;try{if(Number.isInteger(pid)&&pid>0){process.kill(pid,0);active=true}}catch{}
  if(active)throw Error('Another Reveal Gate verification is running in this worktree')
  fs.unlinkSync(lockFile)
}
const lockHandle=fs.openSync(lockFile,'wx');fs.writeFileSync(lockHandle,String(process.pid));fs.closeSync(lockHandle)
process.once('exit',()=>{if(fs.existsSync(lockFile)&&fs.readFileSync(lockFile,'utf8')===String(process.pid))fs.unlinkSync(lockFile)})
const revision=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).stdout.trim()
// The app prebuild materializes ignored ONNX assets. Prepare them before freezing sources.
if(phase==='merge') {
  const prepared=spawnSync(process.execPath,['apps/web/scripts/ensure-onnx-runtime.mjs'],{cwd:ROOT,stdio:'ignore',windowsHide:true})
  if(prepared.status!==0)throw Error('Production asset preparation failed')
}
const verificationBefore=verificationFingerprint(ROOT)
const sourceAtStart=sourceFingerprint(ROOT)
const output=path.resolve(ROOT,value('--output',`tmp/reveal-gate-${phase}-verification.json`))
if(!output.startsWith(path.join(ROOT,'tmp')+path.sep)||!output.endsWith('.json'))throw Error('Report target must be tmp/*.json')
if(phase!=='merge'&&fs.existsSync(path.join(tmp,'reveal-production.json'))&&JSON.parse(fs.readFileSync(path.join(tmp,'reveal-production.json'),'utf8')).report_file===output)throw Error('Output must not overwrite the merge receipt')
if(phase==='merge'&&fs.existsSync(path.join(tmp,'reveal-production.json')))fs.unlinkSync(path.join(tmp,'reveal-production.json'))
const record=(layer,ok,detail)=>{rows.push({layer,status:ok?'PASS':'BLOCKED',detail});console.log(`${ok?'PASS':'BLOCKED'} ${layer}`)}
async function run(command,argv) {
  return new Promise(resolve=>{
    const child=spawn(command,argv,{cwd:ROOT,stdio:['ignore','pipe','pipe'],shell:false});let bytes=0,stdout=''
    child.stdout.on('data',data=>{bytes+=data.length;stdout+=data.toString()});child.stderr.on('data',data=>{bytes+=data.length})
    child.on('error',()=>resolve({ok:false,exit_code:null,reason:'command_unavailable'}))
    child.on('close',code=>{const counts=Object.fromEntries(['tests','pass','fail','skipped','todo','cancelled'].map(key=>[key,Number(stdout.match(new RegExp('# '+key+' (\\d+)'))?.[1]??-1)]));resolve({ok:code===0,exit_code:code,output_bytes:bytes,test_counts:counts})})
  })
}
const pnpm=process.platform==='win32'?'pnpm.cmd':'pnpm'
// Windows .cmd is launched through cmd.exe with a fixed, argument-only command.
const packageCommand=argv=>process.platform==='win32'?run('cmd.exe',['/d','/s','/c',['pnpm',...argv].join(' ')]):run(pnpm,argv)
async function runVitest(files,name) {
  const receipt=path.join(tmp,name+'.json');if(fs.existsSync(receipt))fs.unlinkSync(receipt)
  const result=await packageCommand(['--filter','web','exec','vitest','run',...files,'--reporter=json','--outputFile=../../tmp/'+name+'.json'])
  const body=fs.existsSync(receipt)?JSON.parse(fs.readFileSync(receipt,'utf8')):null
  return {...result,ok:result.ok&&body?.numTotalTests>0&&body.numPassedTests===body.numTotalTests&&body.numPendingTests===0,tests:body?.numTotalTests??0,passed:body?.numPassedTests??0,pending:body?.numPendingTests??null}
}
try{
  const loaders=scanLoaders(src,manifest,policy);record('V1 loader classification',loaders.discovered.length>0&&!loaders.issues.length,loaders)
  const tests=await run(process.execPath,['--test','--test-reporter=tap','scripts/csat/reveal-gate/__tests__/verification-core.test.mjs','scripts/csat/reveal-gate/__tests__/deployment-verification.test.mjs'])
  record('scanner mutation/canary',tests.ok&&tests.test_counts.tests>0&&tests.test_counts.pass===tests.test_counts.tests&&tests.test_counts.skipped===0&&tests.test_counts.todo===0&&tests.test_counts.cancelled===0,tests)
  const unit=await runVitest(['src/lib/csat/__tests__/reveal-verification.test.ts','src/lib/csat/__tests__/embargo-gate.test.ts','src/lib/csat/__tests__/embargo-gate-coverage.test.ts','src/lib/csat/__tests__/embargo-gate-failure.test.ts','src/lib/csat/ec-pilot/__tests__/ec-pilot.test.ts'],'reveal-unit')
  record('V3/V4 correctness oracle and fault injection',unit.ok,{...unit,scope:'Real route/loaders and injected DB transport. Live accounts are a separate DB gate.'})
  const budget=pagingDiff(ROOT,base,policy.paging_allowlist);record('V7 paging architecture diff',budget.issues.length===0,budget)
  if(phase==='merge') {
    const graph=scanClient(src,policy.canaries);record('V2 client source graph',graph.roots>0&&graph.files>0&&!graph.issues.length&&!graph.unresolved.length,graph)
    const sourceBefore=sourceFingerprint(ROOT)
    const build=await packageCommand(['--filter','web','build']);build.ok=build.ok&&sourceBefore===sourceAtStart&&sourceAtStart===sourceFingerprint(ROOT);record('production build',build.ok,build)
    if(build.ok){const bundle=scanBundle(path.join(ROOT,'apps/web/.next/static'),policy.canaries);record('V2 production bundle',!bundle.issues.length,bundle)}else record('V2 production bundle',false,{reason:'build_failed_not_executed'})
  }
  if(phase==='merge'||phase==='db') {
    const stateTest='apps/web/src/lib/csat/diagnosis/__tests__/reveal-sync.test.ts'
    if(!fs.existsSync(path.join(ROOT,stateTest)))record('V6 completion/recompute transition',false,{reason:'snapshot_transition_test_not_implemented'})
    else {
      const result=await runVitest(['src/lib/csat/diagnosis/__tests__/reveal-sync.test.ts'],'reveal-state')
      record('V6 completion/recompute transition',result.ok,{...result,scope:'Snapshot worker failure/retry invariant; migration state transitions remain a deployment gate.'})
    }
    const sqlFile=path.join(ROOT,'scripts/csat/error-evidence/isolated-pg/results-pilot.json')
    const migrations=migrationCoverage(ROOT,base,policy.applied_sql_migrations)
    record('V6 changed migration execution coverage',migrations.issues.length===0,migrations)
    if(fs.existsSync(sqlFile))fs.unlinkSync(sqlFile)
    const requiredSQL=['stage1','t_flow','t_pilot','t_capture','t_reveal','t_rls','t_funcs','t_rq1','t_hash','t_seal','t_p1fix','t_p2fix','t_concurrency','t_delete']
    const missingSQL=requiredSQL.filter(name=>!fs.existsSync(path.join(ROOT,'scripts/csat/error-evidence/isolated-pg',name+'.mjs')))
    const sql=missingSQL.length?{ok:false,reason:'missing_sql_test_modules',missing:missingSQL}:await run(process.execPath,['scripts/csat/error-evidence/isolated-pg/run-pilot.mjs'])
    const sqlRows=sql.ok&&fs.existsSync(sqlFile)?JSON.parse(fs.readFileSync(sqlFile,'utf8')):[]
    record('V6 isolated SQL transitions and migration integrity',sql.ok&&sqlRows.length>0&&sqlRows.every(r=>r.pass===true),{...sql,checks:sqlRows.length,scope:'Migrations run only in a fresh local PostgreSQL cluster. No live SQL deployment.'})
  }
  if(phase==='db') {
    const {liveCanary,securityAdvisor}=await import('./live-verification.mjs')
    let live={ok:false,reason:'live_canary_requires_explicit_live_flag'}
    if(args.includes('--live')) {
      const runtime=await startVerifiedApp(ROOT,process.env)
      if(!runtime.ok)live=runtime
      else try{live=await liveCanary(ROOT,process.env,runtime.url,run,{runtimeVerified:true});if(!checkBuild(ROOT).ok)live={ok:false,reason:'production_changed_during_live_verification'}}finally{await runtime.close()}
    }
    record('live actor matrix and controlled fixture cleanup',live.ok,live)
    const {dbPreflight}=await import('./db-preflight.mjs')
    const beforeFile=value('--before',null),before=beforeFile?JSON.parse(fs.readFileSync(beforeFile,'utf8')):null
    const result=await dbPreflight(ROOT,manifest,process.env,{before,expectedDiff:policy.db_expected_permission_diff,snapshotOut:value('--snapshot-out',null),authenticatedVerified:live.ok&&live.authenticated_verified})
    record('V5 actual JWT/catalog preflight',result.status==='PASS',result)
    const surfaces=await run(process.execPath,['--tls-max-v1.2','scripts/csat/reveal-gate/check-surfaces.mjs']);record('DB default-deny surface discovery',surfaces.ok,surfaces)
    const advisor=await securityAdvisor(process.env,fetch,policy.security_advisor_allowlist??[]);record('Security Advisor',advisor.ok,advisor)
  }
}catch{record('verification execution',false,{reason:'execution_failed'})}
if(phase==='merge') {
  const eligible=rows.every(r=>r.status==='PASS')&&verificationBefore===verificationFingerprint(ROOT)&&sourceAtStart===sourceFingerprint(ROOT)
  record('production source attestation',eligible,eligible?attestBuild(ROOT,revision,output,sourceAtStart):{reason:'merge_checks_failed_or_source_or_verifier_changed'})
}
const blocked=rows.some(r=>r.status!=='PASS'),result=blocked?'BLOCKED':phase==='pr'?'PR_READY':phase==='db'?'DB_READY':'MERGEABLE'
const report={phase,revision,base_ref:base,result,layers:rows,limitations:['Static coverage is a discovery/classification guard, not a complete interprocedural proof.','Timing is not asserted as security-equivalent by deterministic unit tests.','DB SQL is never applied by this command.']}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(`RESULT: ${result}`)
process.exitCode=blocked?1:0
