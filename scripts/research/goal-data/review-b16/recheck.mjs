// scripts/research/goal-data/review-b16/recheck.mjs
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const root='D:/workspace/Vocaflow-goal-data', rev='b447ccf406dcd264c75e1622bcc44905bf84a1c8', old='d1707f73c31dfe4c18337075d88624ece821295b'
const out='scripts/research/goal-data/review-b16/', base='scripts/research/goal-data/local/', doc='docs/research/goal-data-batches/review-b16/'
const git=(...args)=>execFileSync('C:/Program Files/Git/mingw64/bin/git.exe',['-c','safe.directory='+root,...args],{cwd:root,encoding:'utf8',maxBuffer:50*1024*1024,stdio:['pipe','pipe','pipe']})
const gitCache=new Map()
const at=(p,r=rev)=>{const k=r+':'+p;if(!gitCache.has(k))gitCache.set(k,git('show',k));return gitCache.get(k)}, hash=s=>crypto.createHash('sha256').update(s).digest('hex')
const snap=JSON.parse(fs.readFileSync(out+'packets.local.json')), cache=new Map(), checks=[], runs=[]
const read=p=>snap.files[p]??(cache.has(p)?cache.get(p):(cache.set(p,at(p)),cache.get(p)))
const json=p=>JSON.parse(read(p)), check=(name,pass,detail)=>checks.push({name,pass,detail})
const diff=git('diff',old,rev)
fs.writeFileSync(out+'recheck-diff.local.json',JSON.stringify({old,rev,diff},null,2))
async function execute(file,args=[],overrides={},revision=rev,expose=false){
 const writes={},logs=[],modules=new Map(), relative=p=>path.relative(root,p instanceof URL?p.pathname.replace(/^\/([A-Za-z]:)/,'$1'):String(p)).replaceAll('\\','/')
 const get=p=>Object.hasOwn(writes,p)?writes[p]:Object.hasOwn(overrides,p)?overrides[p]:snap.files[p]??at(p,revision)
 let temp=0
 const safeFs={readFileSync:p=>get(relative(p)),existsSync:p=>{try{return get(relative(p))!=null}catch{return false}},writeFileSync:(p,b)=>writes[relative(p)]=String(b),mkdirSync:()=>{},mkdtempSync:p=>String(p)+'memory-'+temp++,rmSync:()=>{},readdirSync:p=>[...new Set(Object.keys(snap.files).filter(q=>q.startsWith(relative(p)+'/')).map(q=>q.slice(relative(p).length+1).split('/')[0]))]}
 const context=vm.createContext({URL,console:{log:(...x)=>logs.push(x.join(' ')),error:(...x)=>logs.push(x.join(' '))},process:{argv:['node',file,...args],exit:c=>{throw Error('EXIT '+c)}}})
 async function mod(p){if(modules.has(p))return modules.get(p);if(p.startsWith('node:')){const val=p==='node:fs'?safeFs:await import(p),names=[...new Set(['default',...Object.keys(val)])];const m=new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,n==='default'?val:val[n])},{context});modules.set(p,m);return m}
 const m=new vm.SourceTextModule(get(relative(p)),{context,identifier:p,initializeImportMeta:m=>m.url=pathToFileURL(p).href});modules.set(p,m);await m.link(s=>mod(s.startsWith('node:')?s:path.resolve(path.dirname(p),s)));return m}
 let error=null,m;try{m=await mod(root+'/'+file);await m.evaluate()}catch(e){error=e.message}
 const r={file,args,revision,logs,error,writes};if(expose)return {r,namespace:m.namespace};runs.push(r);return r
}
const runner='scripts/research/goal-data/d2-run.mjs',validator='scripts/research/goal-data/d2-validate.mjs'
const shipped=await execute('scripts/research/goal-data/d2-validate.check.mjs')
check('shipped 23/23',shipped.error==='EXIT 0'&&shipped.logs.length===23&&shipped.logs.every(l=>l.startsWith('ok ')),shipped.logs)
const modules=await execute(validator,[],{},rev,true),Vmod=modules.namespace
const lib=await execute('scripts/csat/map/v62/data/pilot-lib.mjs',[],{},rev,true)
const input=json(base+'b16-v24/input.json'),tasks=lib.namespace.nonHeldTasks().filter(t=>input.tasks.includes(t.id)),V=Vmod.makeValidator(input,tasks)
const p1=base+'b16-v24/chunk-A-01.out.json',p2=base+'b16-v24/chunk-A-02.out.json',a=json(p1),b=json(p2),dir=root+'/'+base+'b16-v24'
check('baseline real row and chunk functions',a.rows.concat(b.rows).every(r=>V.row(r).length===0)&&V.chunk(a.rows).length===0&&V.chunk(b.rows).length===0)
const repeat='독립 재검증 전용 반복 설명이며 문항별 판정 근거가 없다'
const clone=x=>structuredClone(x), pack=(x,y)=>({[p1]:JSON.stringify(x),[p2]:JSON.stringify(y)})
const cases=[]
async function scenario(name,x,y){const overrides=pack(x,y),r=await execute(runner,['b16-v24','validate','A','02'],overrides);const m=await execute(validator,[],overrides,rev,true),v=m.namespace.makeValidator(input,tasks),chunks=['01','02'].map(n=>m.namespace.checkChunk(dir,'A',n,2,v)),load=m.namespace.loadTrack(dir,'A',2,v,input.rows.map(r=>r.item_id));const agree=await execute(runner,['b16-v24','agree'],overrides);const summary=JSON.parse(agree.writes['docs/research/goal-data-batches/D2-task-mapping/b16-v24-agreement.json']);const record={name,runner:r,chunks,load:{size:load.out.size,errors:load.errors},pairs:summary.pairs,all_human_review:summary.items_detail.every(i=>i.status==='HUMAN_REVIEW_REQUIRED')};cases.push(record);return record}
const foreign=clone(a);for(const r of foreign.rows.slice(0,3))r.not_observable=[{task_id:'r.inference',why:repeat}]
const empty=await scenario('P1-01 actual full validators',foreign,{...b,rows:[]})
check('P1-01 missing own rows visible and exit1',empty.runner.error==='EXIT 1'&&empty.chunks[1].mine.filter(e=>e.endsWith('출력 없음')).length===20)
const fourth=clone(b);fourth.rows[0].not_observable=[{task_id:'r.inference',why:repeat}]
const cross=await scenario('P1-02 fourth participant actual full validators',foreign,fourth)
check('P1-02 fourth member visible exit1 no foreign IDs',cross.runner.error==='EXIT 1'&&cross.chunks[1].mine.some(e=>e.startsWith('트랙 not_observable')&&e.includes(fourth.rows[0].item_id))&&!a.rows.some(r=>cross.runner.logs.some(l=>l.includes(r.item_id))))
const state=await scenario('foreign repetition state only',foreign,b)
check('state-only clean own chunk and excluded combination',state.runner.error==='EXIT 0'&&state.chunks[1].mine.length===0&&state.chunks[1].trackExcluded&&state.load.size===0&&state.pairs===0&&state.all_human_review)
check('empty and cross excluded combination',empty.pairs===0&&cross.pairs===0)
const linked=clone(b);for(const r of linked.rows.slice(0,5))r.links[0].why='실제 청크 함수 전체를 실행하여 반복 링크 설명을 검출하는 재검증이다'
const chunkBad=await scenario('real chunk defect with foreign repeat',foreign,linked)
check('real chunk function executed',chunkBad.runner.error==='EXIT 1'&&chunkBad.chunks[1].mine.some(e=>e.startsWith('청크:')))
const rowBad=clone(b);delete rowBad.rows[0].primary_reason
const rowCase=await scenario('real row defect with foreign repeat',foreign,rowBad)
check('real row function executed',rowCase.runner.error==='EXIT 1'&&rowCase.chunks[1].mine.some(e=>e.includes('primary_reason')))
const first=Object.keys(snap.files).find(p=>p.includes('b14-v24-B-01-first/')&&p.endsWith('.out.json'))
for(const n of ['01','02']){const r=await execute(runner,['b14-v24','validate','B',n],{[base+'b14-v24/chunk-B-01.out.json']:read(first)});check('first b14 B'+n,n==='01'?r.error==='EXIT 1'&&r.logs[0].includes('결함 3'):r.error==='EXIT 0'&&r.logs.some(l=>l.includes('배제된 상태')),r.logs)}
const regression=[]
for(const batch of [...new Set(Object.keys(snap.files).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))].sort()){
 const before=await execute(runner,[batch,'validate'],{},old),after=await execute(runner,[batch,'validate'])
 regression.push({batch,before:before.logs,after:after.logs,before_exit:before.error,after_exit:after.error})
 check('whole validate unchanged '+batch,before.error===after.error&&JSON.stringify(before.logs)===JSON.stringify(after.logs))
}
for(const t of ['A','B'])for(const n of ['01','02']){const r=await execute(runner,['b16-v24','validate',t,n]);check('final b16 '+t+n,r.error==='EXIT 0'&&r.logs[0].includes('결함 0'),r.logs)}
const prompt=at('docs/research/goal-data-batches/D2-task-mapping/prompts/batch-analyst.md')
check('manual-only prompt present',prompt.includes('검증 뒤 출력 수정은 문항별 수기로만')&&prompt.includes('관측 필드 · 설명 문장 포함'))
// Boundary counterexample: two valid rows exchange chunk ownership; row/reason validators still run unchanged.
const swapA=clone(a),swapB=clone(b);[swapA.rows[0],swapB.rows[0]]=[swapB.rows[0],swapA.rows[0]]
const swap=await scenario('valid rows swapped across chunk boundary',swapA,swapB)
const swapWhole=await execute(runner,['b16-v24','validate','A'],pack(swapA,swapB))
check('ownership divergence reproduced',swap.chunks.every(c=>c.mine.length>0)&&swap.load.errors.length===0&&swap.load.size===40&&swap.pairs===240&&swapWhole.error==='EXIT 0',swapWhole.logs)
const leakA=clone(a),leakB=clone(b)
for(const r of [...leakA.rows.slice(0,2),leakB.rows[0]])r.not_observable=[{task_id:'r.inference',why:a.rows[4].item_id+' 다른 문항을 참조하는 동일 관측 한계 설명이다'}]
const leak=await scenario('foreign id embedded in repeated reason text',leakA,leakB)
const leakOld=await execute(runner,['b16-v24','validate','A','02'],pack(leakA,leakB),old)
check('foreign id in text leaks newly',leak.runner.error==='EXIT 1'&&leak.runner.logs.some(l=>l.includes(a.rows[4].item_id))&&leakOld.error==='EXIT 1'&&leakOld.logs.some(l=>l.includes('(다른 청크)'))&&!leakOld.logs.some(l=>l.includes(a.rows[4].item_id)))
// Deterministic random boundary exploration. Compare reasons projections exactly, track exclusion, and accepted rows.
let seed=125,random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const fuzz=[]
for(let i=0;i<160;i++){
 const x=clone(a),y=clone(b),mode=i%8
 if(mode===0){const j=Math.floor(random()*20),k=Math.floor(random()*20);[x.rows[j],y.rows[k]]=[y.rows[k],x.rows[j]]}
 if(mode===1)y.rows.splice(Math.floor(random()*20),1)
 if(mode===2)delete y.rows[Math.floor(random()*20)].primary_reason
 if(mode===3)for(const r of [...x.rows.slice(0,3),y.rows[Math.floor(random()*20)]])r.not_observable=[{task_id:'r.inference',why:repeat}]
 if(mode===4)for(const r of x.rows.slice(0,3))r.not_observable=[{task_id:'r.inference',why:repeat}]
 if(mode===5)y.rows.push(clone(y.rows[Math.floor(random()*20)]))
 if(mode===6)for(const r of y.rows.slice(0,5))r.links[0].why='무작위 경계 탐색에서 실제 청크 반복 검사를 실행하는 동일한 설명이다'
 const m=await execute(validator,[],pack(x,y),rev,true),v=m.namespace.makeValidator(input,tasks),all=x.rows.concat(y.rows),details=v.reasonsDetail(all),chunks=['01','02'].map(n=>m.namespace.checkChunk(dir,'A',n,2,v)),load=m.namespace.loadTrack(dir,'A',2,v,input.rows.map(r=>r.item_id))
 check('fuzz reasons msg projection '+i,JSON.stringify(v.reasons(all))===JSON.stringify(details.map(e=>e.msg)))
 check('fuzz exclusion '+i,!details.length||load.out.size===0)
 check('fuzz track chunk membership '+i,chunks.every(c=>c.mine.filter(e=>e.startsWith('트랙 ')).length===details.filter(e=>e.ids.some(id=>c.own.includes(id))).length))
 fuzz.push({i,mode,sum:chunks.reduce((s,c)=>s+c.mine.length,0),load_errors:load.errors.length,accepted:load.out.size,track_defects:details.length,all_chunk_clean:chunks.every(c=>!c.mine.length)})
}
const changedPackets=Object.entries(snap.files).filter(([p,s])=>fs.readFileSync(root+'/'+p,'utf8')!==s).map(([p])=>p)
check('input local packets unchanged',changedPackets.length===0,changedPackets)
const raw={rev,old,observed_at:new Date().toISOString(),diff_sha256:hash(diff),checks,runs,cases,regression,fuzz,source_hashes:Object.fromEntries([...gitCache].map(([p,s])=>[p,hash(s)]))}
fs.writeFileSync(out+'recheck.local.json',JSON.stringify(raw,null,2)+'\n')
const summary={rev,old,total:checks.length,failed:checks.filter(c=>!c.pass),skip_count:0,cases:cases.map(c=>({name:c.name,exit:c.runner.error,logs:c.runner.logs,chunk_defects:c.chunks.map(c=>c.mine.length),load_errors:c.load.errors.length,pairs:c.pairs})),fuzz:{count:fuzz.length,ownership_divergences:fuzz.filter(c=>c.mode===0&&c.sum>0&&c.load_errors===0).length}}
fs.writeFileSync(out+'recheck-summary.local.json',JSON.stringify(summary,null,2)+'\n')
console.log(JSON.stringify(summary,null,2))
if(summary.failed.length)process.exitCode=1
