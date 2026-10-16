// scripts/research/lm-g1-5a-independent/checks.mjs
import crypto from 'node:crypto'
import {browserJobs,renderBrowserRunner} from './runner-contract.mjs'
import {productHashes} from './binding.mjs'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {spawn,spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {stopOwnedServer} from '../lm-g1-3a-independent/owned-server.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),web=path.join(root,'apps/web')
const req=createRequire(path.join(web,'package.json'))
const mode=process.argv[2]??'units'
const out=path.join(import.meta.dirname,mode==='broad-units'?'local/checks-broad':'local/checks');fs.mkdirSync(out,{recursive:true})
const run=(name,bin,args)=>{const r=spawnSync(process.execPath,[req.resolve(bin),...args],{cwd:web,encoding:'utf8',timeout:300000,maxBuffer:10*1024*1024});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout??'')+(r.stderr??'')); console.log(name,r.status,r.error?.message??'');return r.status===0}
if(mode==='browser'){
 const {createClient}=req('@supabase/supabase-js')
 const {cleanupOwnedAccounts}=await import('../lm-g1-1-independent/cleanup.mjs')
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
 const revision=process.argv[5]??'regression-v3';if(!/^[a-z0-9-]+$/.test(revision))throw Error('Invalid run revision');
 const base='http://localhost:3012',local=path.join(import.meta.dirname,'local',revision);if(fs.existsSync(local+'/browser-summary.json'))throw Error('Run already recorded; choose a new revision');fs.mkdirSync(local,{recursive:true})
 const jobs=browserJobs(base,local)
 const results=[]
 const dates=false,delta=false;const remainingJobs=jobs.slice(Number(process.argv[3]??0),process.argv[4]?Number(process.argv[3]??0)+Number(process.argv[4]):undefined);
 let ownedServer=null
 const ensureServer=async()=>{
  let online=false;try{const r=await fetch(base+'/login',{signal:AbortSignal.timeout(2000)});online=r.status<500}catch{}
  if(online){if(!ownedServer)throw Error('Refusing an unowned server on the verification port');return}
  if(!ownedServer||ownedServer.exitCode!==null||ownedServer.signalCode!==null){
  const fd=fs.openSync(local+'/supervised-server.log','a'),err=fs.openSync(local+'/supervised-server-error.log','a')
  ownedServer=spawn(process.execPath,['--max-old-space-size=2048','--tls-max-v1.2',req.resolve('next/dist/bin/next'),'dev','-p','3012'],{cwd:web,env:{...process.env,NEXT_DIST_DIR:'.next-lmg15a-review'},windowsHide:true,stdio:['ignore',fd,err]})
  ownedServer.on('exit',(code,signal)=>fs.appendFileSync(local+'/server-exits.jsonl',JSON.stringify({code,signal,at:new Date().toISOString()})+'\n'));fs.closeSync(fd);fs.closeSync(err)
  fs.writeFileSync(local+'/supervised-server.pid',String(ownedServer.pid))
  }
  const readyStarted=Date.now()
  for(let n=0;n<120&&Date.now()-readyStarted<120000;n++){if(ownedServer.exitCode!==null||ownedServer.signalCode!==null)throw Error('Owned server exited before readiness');await new Promise(r=>setTimeout(r,1000));try{if((await fetch(base+'/login',{signal:AbortSignal.timeout(5000)})).status===200)return}catch{}}
  throw Error('Owned server not ready')
 }
 try {
 for(const [name,file,args] of remainingJobs){
  await ensureServer()
  const folder=local+'/'+name;fs.mkdirSync(folder,{recursive:true})
  const ownIds=folder+'/owned-accounts.local.json'
  const at=new Date().toISOString(),src=renderBrowserRunner({root,file,folder,at})
  const generated=folder+'/runner.mjs';fs.writeFileSync(generated,src)
  const sourceHashes=()=>productHashes(root)
  const codeHash=sourceHashes();
  fs.writeFileSync(folder+'/source-hashes.json',JSON.stringify(codeHash));
  const headAtStart=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim()
  const r=spawnSync(process.execPath,['--tls-max-v1.2',generated,...args],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:16<<20,windowsHide:true})
  const log=((r.stdout??'')+'\n'+(r.stderr??'')).replace(/^.*(?:cookie|authorization):[^\r\n]*/gim,'[redacted authentication header]').replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/g,'[redacted token]');fs.writeFileSync(folder+'/run.log',log)
  const ids=fs.existsSync(ownIds)?JSON.parse(fs.readFileSync(ownIds,'utf8')):[]
  const present=[];let unknown=0
  for(const id of ids){const g=await db.auth.admin.getUserById(id);if(g.error?.status===404&&g.error?.code==='user_not_found')continue;if(g.data?.user&&!g.error)present.push(id);else unknown++}
  const cleanup=await cleanupOwnedAccounts(db.auth.admin,present)
  if(unknown){cleanup.ok=false;cleanup.unknown+=unknown;cleanup.accountsLeft=null;cleanup.errors.push('initial_absence_unconfirmed')}
  const failed=log.split(/\r?\n/).filter(l=>/^\[FAIL\]|^FAIL /.test(l))
  const passed=log.split(/\r?\n/).filter(l=>/^\[PASS\]|^PASS (?!\d)/.test(l))
  const sourceStable=JSON.stringify(codeHash)===JSON.stringify(sourceHashes());
  const row={name,sourceStable,headAtStart,startedAt:at,exit:r.status,error:r.error?.message??null,passLines:passed.length,failLines:failed.length,cleanup,created:ids.length}
  results.push(row);fs.writeFileSync(local+(dates?'/date-browser-summary.json':delta?'/delta-browser-summary.json':'/browser-summary.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(row))
  if(ownedServer){const stopped=await stopOwnedServer(ownedServer);fs.writeFileSync(folder+'/server-cleanup.json',JSON.stringify(stopped));ownedServer=null}
  if(!cleanup.ok||r.status!==0||failed.length||!sourceStable)break
 }
 process.exitCode=results.length===remainingJobs.length&&results.every(r=>r.exit===0&&r.failLines===0&&r.cleanup.ok&&r.sourceStable)?0:1
 } finally {
  try {const cleanup=await stopOwnedServer(ownedServer);fs.writeFileSync(local+'/owned-server-cleanup.json',JSON.stringify(cleanup))}
  catch(e){process.exitCode=1;fs.writeFileSync(local+'/owned-server-cleanup.json',JSON.stringify({error:String(e)}))}
 }
}else if(mode==='types'){process.exitCode=run('typecheck','typescript/bin/tsc',['--noEmit','--incremental','false'])?0:1}
else if(mode==='lint'){
 const files=spawnSync('git',['diff','--name-only','--','apps/web'],{cwd:root,encoding:'utf8'}).stdout.trim().split(/\r?\n/).filter(x=>/\.tsx?$/.test(x)).map(x=>path.relative(web,path.join(root,x)))
 process.exitCode=run('lint','next/dist/bin/next',['lint',...files.flatMap(f=>['--file',f])])?0:1
}else{
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)])
 const dirs=mode==='broad-units'?['src/lib/csat','src/lib/learner','src/lib/knowledge','src/components/csat']:['src/lib/csat/map','src/lib/knowledge','src/components/csat/diagnosis/map'];
 const files=dirs.flatMap(d=>walk(path.join(web,d))).filter(x=>/\.test\.tsx?$/.test(x)&&!x.includes('.integration.')).map(x=>path.relative(web,x))
 const results=[]
 for(let i=0;i<files.length;i+=20){const n='unit-'+String(i/20).padStart(2,'0'),json=path.join(out,n+'.json');const ok=run(n,'vitest/vitest.mjs',['run',...files.slice(i,i+20),'--pool=forks','--poolOptions.forks.singleFork','--reporter=json','--outputFile='+json]);results.push({files:files.slice(i,i+20),ok,report:n+'.json'})}
 fs.writeFileSync(path.join(out,'partitions.json'),JSON.stringify(results,null,2));process.exitCode=results.every(x=>x.ok)?0:1
}
fs.writeFileSync(path.join(out,mode+'-exit.json'),JSON.stringify({exit:process.exitCode??0,at:new Date().toISOString()}))
