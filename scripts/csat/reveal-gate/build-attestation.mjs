// scripts/csat/reveal-gate/build-attestation.mjs
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {filesUnder} from './verification-core.mjs'
const digest=files=>{const hash=createHash('sha256');for(const file of files.sort())hash.update(file).update(fs.readFileSync(file));return hash.digest('hex')}
export function sourceFingerprint(repo) {
  const files=['apps/web/src','packages'].flatMap(dir=>filesUnder(path.join(repo,dir)))
  for(const name of ['pnpm-lock.yaml','package.json','apps/web/package.json','apps/web/tsconfig.json','apps/web/next.config.js','apps/web/next.config.mjs'])if(fs.existsSync(path.join(repo,name)))files.push(path.join(repo,name))
  // No .env, token, credential or credential-derived hash is ever read.
  return digest(files)
}
export function attestBuild(repo,revision) {
  const directory=path.join(repo,'apps/web/.next/static'),id=path.join(repo,'apps/web/.next/BUILD_ID')
  if(!fs.existsSync(id)||!filesUnder(directory).length)throw Error('No production build')
  const attestation={revision,source_sha256:sourceFingerprint(repo),build_id:fs.readFileSync(id,'utf8').trim(),static_sha256:digest(filesUnder(directory))}
  fs.writeFileSync(path.join(repo,'tmp/reveal-production.json'),JSON.stringify(attestation,null,2)+'\n')
  return attestation
}
export function checkBuild(repo) {
  try {
    const prior=JSON.parse(fs.readFileSync(path.join(repo,'tmp/reveal-production.json'),'utf8'))
    const id=fs.readFileSync(path.join(repo,'apps/web/.next/BUILD_ID'),'utf8').trim()
    const ok=prior.source_sha256===sourceFingerprint(repo)&&prior.build_id===id&&prior.static_sha256===digest(filesUnder(path.join(repo,'apps/web/.next/static')))
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
