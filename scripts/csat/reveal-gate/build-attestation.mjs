// scripts/csat/reveal-gate/build-attestation.mjs
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {filesUnder} from './verification-core.mjs'
const digest=files=>{const hash=createHash('sha256');for(const file of files.sort())hash.update(file).update(fs.readFileSync(file));return hash.digest('hex')}
const serverFiles=repo=>[...filesUnder(path.join(repo,'apps/web/.next/server'),true),...['required-server-files.json','routes-manifest.json','prerender-manifest.json','build-manifest.json','app-build-manifest.json'].map(name=>path.join(repo,'apps/web/.next',name)).filter(file=>fs.existsSync(file))]
export const REQUIRED_MERGE_LAYERS=['V1 loader classification','scanner mutation/canary','V3/V4 correctness oracle and fault injection','V7 paging architecture diff','V2 client source graph','production build','V2 production bundle','V6 completion/recompute transition','V6 changed migration execution coverage','V6 isolated SQL transitions and migration integrity','production source attestation']
export function verificationFingerprint(repo) {
  const dirs=['scripts/csat/reveal-gate','scripts/csat/reveal-gate/__tests__','scripts/csat/error-evidence/isolated-pg','apps/web/src/lib/csat/__tests__','apps/web/src/lib/csat/ec-pilot/__tests__','apps/web/src/lib/csat/diagnosis/__tests__']
  const files=dirs.flatMap(dir=>{const full=path.join(repo,dir);return fs.existsSync(full)?fs.readdirSync(full,{withFileTypes:true}).filter(e=>e.isFile()&&!/^results-/.test(e.name)&&/\.(mjs|json|ts|sql)$/.test(e.name)).map(e=>path.join(full,e.name)):[]})
  return digest(files)
}
export function sourceFingerprint(repo) {
  const files=['apps/web/src','apps/web/public','packages'].flatMap(dir=>filesUnder(path.join(repo,dir),true))
  for(const name of ['pnpm-lock.yaml','package.json','apps/web/package.json','apps/web/tsconfig.json','apps/web/next.config.js','apps/web/next.config.mjs'])if(fs.existsSync(path.join(repo,name)))files.push(path.join(repo,name))
  // No .env, token, credential or credential-derived hash is ever read.
  return digest(files)
}
export function attestBuild(repo,revision,reportFile=path.join(repo,'tmp/reveal-gate-merge-verification.json')) {
  const directory=path.join(repo,'apps/web/.next/static'),id=path.join(repo,'apps/web/.next/BUILD_ID')
  if(!fs.existsSync(id)||!filesUnder(directory,true).length)throw Error('No production build')
  const attestation={revision,verification_sha256:verificationFingerprint(repo),report_file:reportFile,source_sha256:sourceFingerprint(repo),build_id:fs.readFileSync(id,'utf8').trim(),static_sha256:digest(filesUnder(directory,true)),server_sha256:digest(serverFiles(repo))}
  fs.writeFileSync(path.join(repo,'tmp/reveal-production.json'),JSON.stringify(attestation,null,2)+'\n')
  return attestation
}
export function checkBuild(repo) {
  try {
    const prior=JSON.parse(fs.readFileSync(path.join(repo,'tmp/reveal-production.json'),'utf8'))
    if(typeof prior.report_file!=='string'||!path.resolve(prior.report_file).startsWith(path.join(repo,'tmp')+path.sep))return{ok:false,reason:'missing_merge_receipt'}
    const report=JSON.parse(fs.readFileSync(prior.report_file,'utf8'))
    if(report.phase!=='merge'||report.result!=='MERGEABLE'||report.revision!==prior.revision||!Array.isArray(report.layers)||report.layers.some(r=>r.status!=='PASS')||REQUIRED_MERGE_LAYERS.some(layer=>!report.layers.some(r=>r.layer===layer&&r.status==='PASS')))return{ok:false,reason:'merge_checks_not_complete'}
    const id=fs.readFileSync(path.join(repo,'apps/web/.next/BUILD_ID'),'utf8').trim()
    const ok=prior.verification_sha256===verificationFingerprint(repo)&&prior.source_sha256===sourceFingerprint(repo)&&prior.build_id===id&&prior.static_sha256===digest(filesUnder(path.join(repo,'apps/web/.next/static'),true))&&prior.server_sha256===digest(serverFiles(repo))
    return{ok,reason:ok?null:'production_source_or_bundle_mismatch',build_id:id,source_sha256:prior.source_sha256}
  }catch{return{ok:false,reason:'missing_production_attestation'}}
}
export async function startVerifiedApp(repo,env) {
  const proof=checkBuild(repo);if(!proof.ok)return proof
  const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})})
  const child=spawn(process.execPath,[path.join(repo,'apps/web/node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','-p',String(port)],{cwd:path.join(repo,'apps/web'),env,stdio:'ignore',windowsHide:true})
  let failed=false;child.on('error',()=>{failed=true});child.on('exit',()=>{failed=true})
  const close=async()=>{if(child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();setTimeout(()=>{child.kill('SIGKILL');resolve()},5000).unref()})}
  const url='http://127.0.0.1:'+port
  for(let i=0;i<60&&!failed;i++){
    try{const response=await fetch(url+'/_next/static/'+encodeURIComponent(proof.build_id)+'/_buildManifest.js',{signal:AbortSignal.timeout(1000)});if(response.status===200&&checkBuild(repo).ok)return{ok:true,url,close,proof}}catch{}
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  await close();return{ok:false,reason:'verified_runtime_start_failed'}
}
