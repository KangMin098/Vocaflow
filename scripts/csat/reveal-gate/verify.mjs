// scripts/csat/reveal-gate/verify.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { scanLoaders,scanClient,scanBundle,pagingDiff } from './verification-core.mjs'
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..')
const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]}
const phase=value('--phase','merge'),base=value('--base',process.env.REVEAL_VERIFY_BASE??'origin/main')
if(!['pr','merge','db'].includes(phase))throw Error('Unknown verification phase')
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/csat/reveal-gate/manifest.json'),'utf8'))
const policy=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/csat/reveal-gate/verification-policy.json'),'utf8'))
const rows=[],src=path.join(ROOT,'apps/web/src')
const tmp=path.join(ROOT,'tmp');fs.mkdirSync(tmp,{recursive:true})
if(fs.realpathSync(tmp)!==tmp)throw Error('Report directory must not be a symlink')
const revision=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).stdout.trim()
const record=(layer,ok,detail)=>{rows.push({layer,status:ok?'PASS':'BLOCKED',detail});console.log(`${ok?'PASS':'BLOCKED'} ${layer}`)}
async function run(command,argv) {
  return new Promise(resolve=>{
    const child=spawn(command,argv,{cwd:ROOT,stdio:['ignore','pipe','pipe'],shell:false});let bytes=0
    child.stdout.on('data',data=>{bytes+=data.length});child.stderr.on('data',data=>{bytes+=data.length})
    child.on('error',()=>resolve({ok:false,exit_code:null,reason:'command_unavailable'}))
    child.on('close',code=>resolve({ok:code===0,exit_code:code,output_bytes:bytes}))
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
  const tests=await run(process.execPath,['--test','scripts/csat/reveal-gate/__tests__/verification-core.test.mjs','scripts/csat/reveal-gate/__tests__/deployment-verification.test.mjs'])
  record('scanner mutation/canary',tests.ok,tests)
  const unit=await runVitest(['src/lib/csat/__tests__/reveal-verification.test.ts','src/lib/csat/__tests__/embargo-gate.test.ts','src/lib/csat/__tests__/embargo-gate-coverage.test.ts','src/lib/csat/__tests__/embargo-gate-failure.test.ts','src/lib/csat/ec-pilot/__tests__/ec-pilot.test.ts'],'reveal-unit')
  record('V3/V4 correctness oracle and fault injection',unit.ok,{...unit,scope:'Real route/loaders and injected DB transport. Live accounts are a separate DB gate.'})
  const budget=pagingDiff(ROOT,base,policy.paging_allowlist);record('V7 paging architecture diff',budget.issues.length===0,budget)
  if(phase==='merge') {
    const graph=scanClient(src,policy.canaries);record('V2 client source graph',graph.roots>0&&graph.files>0&&!graph.issues.length&&!graph.unresolved.length,graph)
    const build=await packageCommand(['--filter','web','build']);record('production build',build.ok,build)
    if(build.ok){const bundle=scanBundle(path.join(ROOT,'apps/web/.next/static'),policy.canaries);record('V2 production bundle',!bundle.issues.length,bundle)}else record('V2 production bundle',false,{reason:'build_failed_not_executed'})
  }
  if(phase==='merge'||phase==='db') {
    const stateTest='apps/web/src/lib/csat/diagnosis/__tests__/reveal-sync.test.ts'
    if(!fs.existsSync(path.join(ROOT,stateTest)))record('V6 completion/recompute transition',false,{reason:'snapshot_transition_test_not_implemented'})
    else {
      const result=await runVitest(['src/lib/csat/diagnosis/__tests__/reveal-sync.test.ts'],'reveal-state')
      record('V6 completion/recompute transition',result.ok,{...result,scope:'Snapshot worker failure/retry invariant; migration state transitions remain a deployment gate.'})
    }
  }
  if(phase==='db') {
    const sqlFile=path.join(ROOT,'scripts/csat/error-evidence/isolated-pg/results-pilot.json')
    if(fs.existsSync(sqlFile))fs.unlinkSync(sqlFile)
    const sql=await run(process.execPath,['scripts/csat/error-evidence/isolated-pg/run-pilot.mjs'])
    const sqlRows=sql.ok&&fs.existsSync(sqlFile)?JSON.parse(fs.readFileSync(sqlFile,'utf8')):[]
    record('V6 isolated SQL transitions and migration integrity',sql.ok&&sqlRows.length>0&&sqlRows.every(r=>r.pass===true),{...sql,checks:sqlRows.length,scope:'Migrations run only in a fresh local PostgreSQL cluster. No live SQL deployment.'})
    const {liveCanary,securityAdvisor}=await import('./live-verification.mjs')
    const live=args.includes('--live')?await liveCanary(ROOT,process.env,value('--app',null),run):{ok:false,reason:'live_canary_requires_explicit_live_flag_and_local_app'}
    record('live actor matrix and controlled fixture cleanup',live.ok,live)
    const {dbPreflight}=await import('./db-preflight.mjs')
    const beforeFile=value('--before',null),before=beforeFile?JSON.parse(fs.readFileSync(beforeFile,'utf8')):null
    const result=await dbPreflight(ROOT,manifest,process.env,{before,expectedDiff:policy.db_expected_permission_diff,snapshotOut:value('--snapshot-out',null),authenticatedVerified:live.ok&&live.authenticated_verified})
    record('V5 actual JWT/catalog preflight',result.status==='PASS',result)
    const surfaces=await run(process.execPath,['--tls-max-v1.2','scripts/csat/reveal-gate/check-surfaces.mjs']);record('DB default-deny surface discovery',surfaces.ok,surfaces)
    const advisor=await securityAdvisor(process.env,fetch,policy.security_advisor_allowlist??[]);record('Security Advisor',advisor.ok,advisor)
  }
}catch{record('verification execution',false,{reason:'execution_failed'})}
const blocked=rows.some(r=>r.status!=='PASS'),result=blocked?'BLOCKED':phase==='pr'?'PR_READY':phase==='db'?'DB_READY':'MERGEABLE'
const report={phase,revision,base_ref:base,result,layers:rows,limitations:['Static coverage is a discovery/classification guard, not a complete interprocedural proof.','Timing is not asserted as security-equivalent by deterministic unit tests.','DB SQL is never applied by this command.']}
const output=path.resolve(ROOT,value('--output','tmp/reveal-gate-verification.json'))
if(!output.startsWith(path.join(ROOT,'tmp')+path.sep)||!output.endsWith('.json'))throw Error('Report target must be tmp/*.json')
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(`RESULT: ${result}`)
process.exitCode=blocked?1:0
