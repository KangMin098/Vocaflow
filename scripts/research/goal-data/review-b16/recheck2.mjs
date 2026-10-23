// scripts/research/goal-data/review-b16/recheck2.mjs
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
const root='D:/workspace/Vocaflow-goal-data', rev='d85f22d145fdf284f5b7f4bff0f184bbe9a6eaa6', old='b447ccf406dcd264c75e1622bcc44905bf84a1c8'
const out='scripts/research/goal-data/review-b16/', base='scripts/research/goal-data/local/', doc='docs/research/goal-data-batches/review-b16/'
const git=(...args)=>execFileSync('C:/Program Files/Git/mingw64/bin/git.exe',['-c','safe.directory='+root,...args],{cwd:root,encoding:'utf8',maxBuffer:50*1024*1024,stdio:['pipe','pipe','pipe']})
const gitCache=new Map()
const at=(p,r=rev)=>{const k=r+':'+p;if(!gitCache.has(k))gitCache.set(k,git('show',k));return gitCache.get(k)}, hash=s=>crypto.createHash('sha256').update(s).digest('hex')
const snap=JSON.parse(fs.readFileSync(out+'packets.local.json')), cache=new Map(), checks=[], runs=[]
const read=p=>snap.files[p]??(cache.has(p)?cache.get(p):(cache.set(p,at(p)),cache.get(p)))
const json=p=>JSON.parse(read(p)), check=(name,pass,detail)=>checks.push({name,pass,detail})
const diff=git('diff',old,rev)
fs.writeFileSync(out+'recheck2-diff.local.json',JSON.stringify({old,rev,diff},null,2))
async function execute(file,args=[],overrides={},revision=rev,expose=false){
 const writes={},logs=[],modules=new Map(), relative=p=>path.relative(root,p instanceof URL?p.pathname.replace(/^\/([A-Za-z]:)/,'$1'):String(p)).replaceAll('\\','/')
 const get=p=>{if(Object.hasOwn(overrides,p)&&overrides[p]===null)throw Error('ENOENT '+p);return Object.hasOwn(writes,p)?writes[p]:Object.hasOwn(overrides,p)?overrides[p]:snap.files[p]??at(p,revision)}
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
check('shipped 26/26',shipped.error==='EXIT 0'&&shipped.logs.length===26&&shipped.logs.every(l=>l.startsWith('ok ')),shipped.logs)
const lib=(await execute('scripts/csat/map/v62/data/pilot-lib.mjs',[],{},rev,true)).namespace
const input=json(base+'b16-v24/input.json'),tasks=lib.nonHeldTasks().filter(t=>input.tasks.includes(t.id))
const p1=base+'b16-v24/chunk-A-01.out.json',p2=base+'b16-v24/chunk-A-02.out.json'
const a=json(p1),b=json(p2),dir=root+'/'+base+'b16-v24',clone=x=>structuredClone(x)
const pack=(x,y)=>({[p1]:JSON.stringify(x),[p2]:JSON.stringify(y)})
async function scenario(name,overrides){
 const m=(await execute(validator,[],overrides,rev,true)).namespace,V=m.makeValidator(input,tasks)
 const chunks=['01','02'].map(n=>{try{return m.checkChunk(dir,'A',n,2,V)}catch(e){return {error:e.message}}})
 const load=m.loadTrack(dir,'A',2,V,input.rows.map(r=>r.item_id))
 const whole=await execute(runner,['b16-v24','validate','A'],overrides)
 const chunk=await execute(runner,['b16-v24','validate','A','02'],overrides)
 const agree=await execute(runner,['b16-v24','agree'],overrides)
 const summary=JSON.parse(agree.writes['docs/research/goal-data-batches/D2-task-mapping/b16-v24-agreement.json'])
 return {name,chunks,load:{size:load.out.size,ids:[...load.out.keys()],errors:load.errors},whole,chunk,pairs:summary.pairs,items:summary.items_detail}
}
const x=clone(a),y=clone(b);[x.rows[0],y.rows[0]]=[y.rows[0],x.rows[0]]
const swapped=await scenario('real full-validator row swap',pack(x,y))
check('swap rejected consistently and not combined',swapped.whole.error==='EXIT 1'&&swapped.load.size===38&&swapped.load.errors.length===2&&swapped.chunks.every(c=>c.mine.length===2)&&swapped.pairs===228&&!swapped.load.ids.includes(x.rows[0].item_id)&&!swapped.load.ids.includes(y.rows[0].item_id))
const bypass=[]
for(const mode of ['delete-one','delete-both','rename-both']){
 const overrides=pack(x,y),names=mode==='delete-one'?['01']:['01','02']
 for(const n of names){const p=base+'b16-v24/chunk-A-'+n+'.json';overrides[p]=null;if(mode==='rename-both')overrides[p+'.renamed']=read(p)}
 const r=await scenario(mode,overrides);bypass.push(r)
 check('missing-input bypass reproduced '+mode,mode==='delete-one'?r.whole.error==='EXIT 1'&&r.load.size===39&&r.pairs===234:r.whole.error==='EXIT 0'&&r.load.size===40&&r.load.errors.length===0&&r.pairs===240&&r.chunks.some(c=>c.error))
}
const leakA=clone(a),leakB=clone(b),foreign=a.rows[4].item_id
for(const r of [...leakA.rows.slice(0,2),leakB.rows[0]])r.not_observable=[{task_id:'r.inference',why:foreign+' 다른 문항을 참조하는 동일 관측 한계 설명이다'}]
const masked=await scenario('free reason masking real functions',pack(leakA,leakB))
check('previous free-reason leak resolved',masked.chunk.error==='EXIT 1'&&!masked.chunk.logs.some(s=>s.includes(foreign))&&masked.chunk.logs.some(s=>s.includes('(다른 문항)')))
const source=at(validator),line=source.split('\n')[187],bs=Buffer.from(line)
check('ITEM_ID line188 zero backspace',line.includes('const ITEM_ID')&&bs.filter(b=>b===8).length===0,{line:188,hex:bs.toString('hex'),backspace_bytes:bs.filter(b=>b===8).length})
const regexText=/const ITEM_ID = (\/.*\/g)/.exec(source)[1],re=vm.runInNewContext(regexText)
const allIds=[...new Set(Object.entries(snap.files).filter(([p])=>p.endsWith('/input.json')).flatMap(([,s])=>JSON.parse(s).rows.map(r=>r.item_id)))]
// Independently read the repository's complete exam item list rather than limiting coverage to shipped batches.
const files=git('ls-tree','-r','--name-only',rev).trim().split('\n')
const idFiles=files.filter(p=>/exam|item/i.test(p)&&/\.(json|jsonl)$/.test(p))
const inventory=new Set(allIds),inventorySources=[]
const examInventory=[]
for(const p of ['scripts/csat/data/questions.json','scripts/csat/data/mock-questions.json']){
 const parsed=JSON.parse(at(p)),ids=new Set(),exams=new Set()
 function walk(o){if(!o||typeof o!=='object')return;if(typeof o.exam==='string'&&Number.isInteger(o.no))ids.add(o.exam+'#'+o.no);for(const [k,v] of Object.entries(o)){if(k.includes('#')&&!/\s/.test(k))ids.add(k);if(['item_id','id'].includes(k)&&typeof v==='string'&&v.includes('#')&&!/\s/.test(v))ids.add(v);if(['exam','exam_id'].includes(k)&&typeof v==='string')exams.add(v);walk(v)}}
 walk(parsed)
 for(const id of ids)inventory.add(id)
 const examMisses=[...exams].filter(exam=>{re.lastIndex=0;return (exam+'#1').match(re)?.[0]!==exam+'#1'})
 examInventory.push({path:p,items:ids.size,exams:[...exams],examMisses})
}
check('actual exam-list formats all matched',examInventory.every(s=>s.items>0&&s.examMisses.length===0),examInventory)
for(const p of idFiles){const s=at(p);const ids=s.match(/(?:M?\d{4}[AB]?)#\d{1,2}/g)??[];if(ids.length){inventorySources.push({path:p,count:ids.length});for(const id of ids)inventory.add(id)}}
const misses=[...inventory].filter(id=>{re.lastIndex=0;return id.match(re)?.[0]!==id})
check('complete discovered exam-id inventory regex coverage',misses.length===0,{count:inventory.size,misses,inventorySources})
const formats=['2014A#20','M2006#22','2099#1','2099#12']
const punctuation=['「ID」','(ID),','경로/ID.json','ID: 오류','앞ID뒤','xIDz','ID_후속']
const formatCases=formats.flatMap(id=>punctuation.map(t=>{const s=t.replace('ID',id);return {id,template:t,matched:s.match(re)??[],masked:s.replace(re,'(다른 문항)')}}))
check('requested formats and punctuation',formatCases.filter(c=>!['xIDz','ID_후속'].includes(c.template)).every(c=>c.matched.includes(c.id)))
const overmask={original:'문항이 아닌 가상 참조번호 2099#1',masked:'문항이 아닌 가상 참조번호 2099#1'.replace(re,'(다른 문항)')}
const embedded=[]
for(const template of ['xIDz','ID_후속']){
 const la=clone(a),lb=clone(b),text=template.replace('ID',foreign)+' 같은 관측 한계를 설명하는 문장이다'
 for(const r of [...la.rows.slice(0,2),lb.rows[0]])r.not_observable=[{task_id:'r.inference',why:text}]
 const r=await scenario('embedded ID '+template,pack(la,lb));embedded.push(r)
 check('embedded boundary leakage reproduced '+template,r.chunk.logs.some(s=>s.includes(foreign)))
}
// Missing own output is rendered using the basename; invalid JSON is thrown before the masking return.
const missingPath=await execute(runner,['b16-v24','validate','A','02'],{[p2]:null})
check('ordinary missing-output path emitted',missingPath.error==='EXIT 1'&&missingPath.logs.some(s=>s.includes('chunk-A-02.out.json')))
const invalidJson=await execute(runner,['b16-v24','validate','A','02'],{[p1]:'{"'+foreign+'": invalid}'})
const regression=[]
for(const batch of [...new Set(Object.keys(snap.files).filter(p=>p.endsWith('/input.json')).map(p=>p.split('/').at(-2)))].sort()){
 const before=await execute(runner,[batch,'validate'],{},old),after=await execute(runner,[batch,'validate'])
 const unchanged=before.error===after.error&&JSON.stringify(before.logs)===JSON.stringify(after.logs)
 regression.push({batch,unchanged,before,after});check('b2-b16 unchanged '+batch,unchanged)
}
// Replace shipped structural stubs with actual full validators for the previous six scenarios.
const repeat='독립 재검증 전용 반복 설명이며 문항별 판정 근거가 없다',fa=clone(a)
for(const r of fa.rows.slice(0,3))r.not_observable=[{task_id:'r.inference',why:repeat}]
const empty=await scenario('own empty actual functions',pack(fa,{...b,rows:[]}))
check('actual own-empty regression',empty.chunk.error==='EXIT 1'&&empty.chunks[1].mine.filter(s=>s.endsWith('출력 없음')).length===20)
const fb=clone(b);fb.rows[0].not_observable=[{task_id:'r.inference',why:repeat}]
const fourth=await scenario('fourth-member actual functions',pack(fa,fb))
check('actual fourth-member regression',fourth.chunk.error==='EXIT 1'&&fourth.chunks[1].mine.length===1)
const state=await scenario('state-only actual functions',pack(fa,b))
check('actual state-only regression',state.chunk.error==='EXIT 0'&&state.load.size===0&&state.pairs===0)
const changedPackets=Object.entries(snap.files).filter(([p,s])=>fs.readFileSync(root+'/'+p,'utf8')!==s).map(([p])=>p)
check('captured input bytes unchanged',changedPackets.length===0,changedPackets)
const raw={rev,old,observed_at:new Date().toISOString(),diff_sha256:hash(diff),checks,shipped,swapped,bypass,masked,embedded,missingPath,invalidJson,inventory:{count:inventory.size,misses,examInventory,sources:inventorySources},formatCases,overmask,regression,empty,fourth,state,runs,source_hashes:Object.fromEntries([...gitCache].map(([p,s])=>[p,hash(s)]))}
fs.writeFileSync(out+'recheck2.local.json',JSON.stringify(raw,null,2)+'\n')
console.log(JSON.stringify({total:checks.length,failed:checks.filter(c=>!c.pass),inventory:inventory.size,shipped:shipped.logs.length,swap:{accepted:swapped.load.size,pairs:swapped.pairs},bypass:bypass.map(r=>({name:r.name,accepted:r.load.size,pairs:r.pairs}))},null,2))
if(checks.some(c=>!c.pass))process.exitCode=1
