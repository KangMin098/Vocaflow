// scripts/research/lm-g1-3a-independent/checks.mjs
import crypto from 'node:crypto'
import fs from 'node:fs'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {spawn,spawnSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {stopOwnedServer} from '../lm-g1-2-independent/owned-server.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),web=path.join(root,'apps/web')
const req=createRequire(path.join(web,'package.json'))
const out=path.join(import.meta.dirname,'local/checks');fs.mkdirSync(out,{recursive:true})
const mode=process.argv[2]??'units'
const run=(name,bin,args)=>{const r=spawnSync(process.execPath,[req.resolve(bin),...args],{cwd:web,encoding:'utf8',timeout:300000,maxBuffer:10*1024*1024});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout??'')+(r.stderr??'')); console.log(name,r.status,r.error?.message??'');return r.status===0}
if(mode==='browser'){
 const {createClient}=req('@supabase/supabase-js')
 const {cleanupOwnedAccounts}=await import('../lm-g1-1-independent/cleanup.mjs')
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
 const base='http://localhost:3008',local=path.join(import.meta.dirname,'local/final')
 const jobs=[
 ['independent-1280','scripts/research/lm-g1-3a-independent/independent-browser.mjs',['--base',base,'--width','1280','--evidence',local+'/independent-1280']],
 ['independent-1440','scripts/research/lm-g1-3a-independent/independent-browser.mjs',['--base',base,'--width','1440','--evidence',local+'/independent-1440']],
 ['target-1280','scripts/csat/map/v62/e2e-lm-g1-3a.mjs',['--base',base,'--width','1280','--evidence',local+'/target-1280']],
 ['target-1440','scripts/csat/map/v62/e2e-lm-g1-3a.mjs',['--base',base,'--width','1440','--evidence',local+'/target-1440']],
  ['revised-1280','scripts/research/lm-g1-2-independent/vertical.mjs',['--base',base,'--width','1280','--evidence',local+'/revised-1280']],
  ['revised-1440','scripts/research/lm-g1-2-independent/vertical.mjs',['--base',base,'--width','1440','--evidence',local+'/revised-1440']],
  ['timing','scripts/csat/map/v62/e2e-lm-g1-2-timing.mjs',['--base',base,'--evidence',local+'/timing']],
  ['security','scripts/research/lm-g1-2-independent/security.mjs',[base]],
  ['late-remount','scripts/research/lm-g1-2-independent/late-remount.mjs',[base]],
  ['t1','scripts/research/lm-g1-1-independent/browser.mjs',['--base',base,'--width','1280','--evidence',local+'/t1']],
  ['workspace','scripts/csat/map/v62/e2e-map-workspace.mjs',['--base',base,'--evidence',local+'/workspace']],
  ['return','scripts/csat/map/v62/e2e-map-return.mjs',['--base',base]],
  ['study','scripts/csat/map/v62/e2e-map-study.mjs',['--base',base]],
  ['supply','scripts/csat/map/v62/e2e-map-supply.mjs',['--base',base,'--evidence',local+'/supply']],
 ]
 const results=[]
 const delta=process.argv[3]==='delta'
 const remainingJobs=delta?[jobs.find(j=>j[0]==='security'),jobs.find(j=>j[0]==='late-remount'),...['1280','1440'].map(w=>['save-unchanged-'+w,'scripts/research/lm-g1-2-independent/save-unchanged.mjs',[base,w]]),...jobs.filter(j=>['t1','workspace','return','study','supply'].includes(j[0]))]:jobs.slice(Number(process.argv[3]??0))
 let ownedServer=null
 const ensureServer=async()=>{
  try{const r=await fetch(base+'/login',{signal:AbortSignal.timeout(2000)});if(r.status<500)return}catch{}
  if(!ownedServer||ownedServer.exitCode!==null||ownedServer.signalCode!==null){
  const fd=fs.openSync(local+'/supervised-server.log','a'),err=fs.openSync(local+'/supervised-server-error.log','a')
  ownedServer=spawn(process.execPath,['--max-old-space-size=2048','--tls-max-v1.2',req.resolve('next/dist/bin/next'),'dev','-p','3008'],{cwd:web,env:{...process.env,NEXT_DIST_DIR:'.next-lmg13a-review'},windowsHide:true,stdio:['ignore',fd,err]})
  fs.closeSync(fd);fs.closeSync(err)
  fs.writeFileSync(local+'/supervised-server.pid',String(ownedServer.pid))
  }
  for(let n=0;n<120;n++){await new Promise(r=>setTimeout(r,1000));try{if((await fetch(base+'/login',{signal:AbortSignal.timeout(5000)})).status===200)return}catch{}}
  throw Error('Owned server not ready')
 }
 try {
 for(const [name,file,args] of remainingJobs){
  await ensureServer()
  const folder=local+'/'+name;fs.mkdirSync(folder,{recursive:true})
  const ownIds=folder+'/owned-accounts.local.json'
  let src=fs.readFileSync(path.join(root,file),'utf8')
  // Only runner location, viewport, hydration and cleanup instrumentation change; assertions remain.
  src=src.replace(/const ROOT = path.resolve\(import.meta.dirname, [^\n]+\n/, 'const ROOT = '+JSON.stringify(root)+'\n')
  src=src.replaceAll('/scripts/research/lm-g1-2-independent/local/','/scripts/research/lm-g1-3a-independent/local/');
  src=src.replaceAll("from './source-loader.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-3a-independent/source-loader.mjs').href));
  src=src.replaceAll("from './cleanup.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-1-independent/cleanup.mjs').href))
  src=src.replaceAll("from '../../../research/lm-g1-1-independent/cleanup.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-1-independent/cleanup.mjs').href))
  src=src.replaceAll("from '../lm-g1-1-independent/cleanup.mjs'","from "+JSON.stringify(pathToFileURL(root+'/scripts/research/lm-g1-1-independent/cleanup.mjs').href))
  src=src.replace("if (scenario === 'unmounted') {", "if (scenario === 'unmounted') {await b.page.screenshot({path:"+JSON.stringify(folder+'/before-unmount.png')+"});fs.writeFileSync("+JSON.stringify(folder+'/before-unmount-dom.local.html')+",await b.page.content());");
  src=src.replace("users.push(u.user.id)","users.push(u.user.id); (await import('node:fs')).writeFileSync("+JSON.stringify(ownIds)+",JSON.stringify(users))")
  src=src.replace("height: 1000","height: 900")
  src=src.replace("await page.fill('input[type=\"email\"]', email)","await page.waitForTimeout(700); await page.fill('input[type=\"email\"]', email)")
  const generated=folder+'/runner.mjs';fs.writeFileSync(generated,src)
  const codeHash=Object.fromEntries(['GoalBar.tsx','PlanSection.tsx'].map(f=>['component/'+f,crypto.createHash('sha256').update(fs.readFileSync(root+'/apps/web/src/components/csat/diagnosis/map/'+f)).digest('hex')]));
  fs.writeFileSync(folder+'/source-hashes.json',JSON.stringify(codeHash));
  const at=new Date().toISOString(),headAtStart=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim()
  const r=spawnSync(process.execPath,['--tls-max-v1.2',generated,...args],{cwd:root,encoding:'utf8',timeout:900000,maxBuffer:16<<20,windowsHide:true})
  const log=(r.stdout??'')+'\n'+(r.stderr??'');fs.writeFileSync(folder+'/run.log',log)
  const ids=fs.existsSync(ownIds)?JSON.parse(fs.readFileSync(ownIds,'utf8')):[]
  const present=[];let unknown=0
  for(const id of ids){const g=await db.auth.admin.getUserById(id);if(g.error?.status===404&&g.error?.code==='user_not_found')continue;if(g.data?.user&&!g.error)present.push(id);else unknown++}
  const cleanup=await cleanupOwnedAccounts(db.auth.admin,present)
  if(unknown){cleanup.ok=false;cleanup.unknown+=unknown;cleanup.accountsLeft=null;cleanup.errors.push('initial_absence_unconfirmed')}
  const failed=log.split(/\r?\n/).filter(l=>/^\[FAIL\]|^FAIL /.test(l))
  const passed=log.split(/\r?\n/).filter(l=>/^\[PASS\]|^PASS (?!\d)/.test(l))
  const row={name,headAtStart,startedAt:at,exit:r.status,error:r.error?.message??null,passLines:passed.length,failLines:failed.length,cleanup,created:ids.length}
  results.push(row);fs.writeFileSync(local+(delta?'/delta-browser-summary.json':'/browser-summary.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(row))
  if(!cleanup.ok||r.status!==0||failed.length)break
 }
 process.exitCode=results.length===remainingJobs.length&&results.every(r=>r.exit===0&&r.failLines===0&&r.cleanup.ok)?0:1
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
 const files=[...walk(path.join(web,'src/lib/csat/map')),...walk(path.join(web,'src/lib/knowledge')),...walk(path.join(web,'src/components/csat/diagnosis/map'))].filter(x=>/\.test\.tsx?$/.test(x)&&!x.includes('.integration.')).map(x=>path.relative(web,x))
 const results=[]
 for(let i=0;i<files.length;i+=20){const n='unit-'+String(i/20).padStart(2,'0'),json=path.join(out,n+'.json');const ok=run(n,'vitest/vitest.mjs',['run',...files.slice(i,i+20),'--pool=forks','--poolOptions.forks.singleFork','--reporter=json','--outputFile='+json]);results.push({files:files.slice(i,i+20),ok,report:n+'.json'})}
 fs.writeFileSync(path.join(out,'partitions.json'),JSON.stringify(results,null,2));process.exitCode=results.every(x=>x.ok)?0:1
}
fs.writeFileSync(path.join(out,mode+'-exit.json'),JSON.stringify({exit:process.exitCode??0,at:new Date().toISOString()}))
