// scripts/csat/source-repair.mjs
// Verified local PDF repairs: preview by default, exact input compare-and-set on --commit.
import fs from 'node:fs'
import path from 'node:path'
import {createClient} from '@supabase/supabase-js'
import {isDeepStrictEqual} from 'node:util'
import {applySourceRepair,mergeSourceRepair} from './lib-source-repair.mjs'

const argv=process.argv.slice(2)
const value=key=>argv[argv.indexOf(key)+1]
if(!argv.includes('--file')||!value('--file'))throw Error('--file 수리 계획 JSON이 필요하다')
const plan=JSON.parse(fs.readFileSync(value('--file'),'utf8'))
if(!Array.isArray(plan.repairs)||!plan.repairs.length||plan.repairs.length>100)throw Error('한 번에 1~100문항 수리만 받는다')
if(new Set(plan.repairs.map(r=>r.item_id)).size!==plan.repairs.length||plan.repairs.some(r=>!/^H\d{4}G[123]#\d{2}$/.test(r.item_id)))throw Error('학평 문항만 중복 없이 받는다')
const env=name=>{
  if(process.env[name])return process.env[name]
  for(const file of ['.env.local','.env','apps/web/.env.local','apps/web/.env']){
    if(!fs.existsSync(file))continue
    const m=fs.readFileSync(file,'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`,'m'))
    if(m)return m[1].trim().replace(/^["']|["']$/g,'')
  }
}
const db=createClient(env('NEXT_PUBLIC_SUPABASE_URL')??env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}})
const folder=process.env.CSAT_HAKPYEONG_DIR??'C:/Users/Administrator/Documents/영어/학력평가'
const {data:rows,error}=await db.from('csat_items').select('id,type_id,stem,passage,choices,answer,answers,body_ok').in('id',plan.repairs.map(r=>r.item_id))
if(error)throw Error(error.message)
const patches=plan.repairs.map(repair=>{
  const old=rows.find(r=>r.id===repair.item_id)
  if(!old)throw Error(`${repair.item_id}: 문항 없음`)
  if(path.basename(repair.pdf_file)!==repair.pdf_file||!repair.pdf_file.endsWith('.pdf'))throw Error('PDF는 정본 폴더의 파일명만 받는다')
  const next=applySourceRepair(old,repair,fs.readFileSync(path.join(folder,repair.pdf_file)))
  const patch={...repair.after,body_ok:true}
  return {old,patch,changed:!Object.entries(patch).every(([field,v])=>isDeepStrictEqual(old[field],v)),next}
})
const recipeFile='scripts/csat/data/hakpyeong-source-repairs.json'
const recipes=fs.existsSync(recipeFile)?JSON.parse(fs.readFileSync(recipeFile,'utf8')).repairs:[]
const byId=new Map(recipes.map(r=>[r.item_id,r]))
for(const repair of plan.repairs)byId.set(repair.item_id,mergeSourceRepair(byId.get(repair.item_id),repair))
const corpusFile='scripts/csat/data/corpus-hakpyeong.json'
const corpus=JSON.parse(fs.readFileSync(corpusFile,'utf8'))
for(const {old} of patches)if(!corpus.items.some(r=>r.id===old.id))throw Error(`${old.id}: 로컬 원장 문항 없음 — 수리 전에 원장을 재생성한다`)
console.log(JSON.stringify({mode:argv.includes('--commit')?'commit':'preview',items:patches.length,changed:patches.filter(p=>p.changed).length,unchanged:patches.filter(p=>!p.changed).length,protected:['type_id','answer','answers','raw_block'],scope:patches.map(p=>({item:p.old.id,fields:Object.keys(p.patch)}))}))
if(argv.includes('--commit')) {
// Preserve every inspected transcription before the first DB write, including partial failures.
const recipeTemp=recipeFile+'.tmp'
fs.writeFileSync(recipeTemp,JSON.stringify({repairs:[...byId.values()]},null,1)+'\n')
fs.renameSync(recipeTemp,recipeFile)
for(const {old,patch,changed} of patches){
  if(!changed)continue
  let query=db.from('csat_items').update(patch).eq('id',old.id)
  for(const field of ['type_id','stem','passage','choices','answer','answers','body_ok']){
    const v=old[field]
    if(v==null)query=query.is(field,null)
    else if(field==='choices')query=query.filter(field,'eq',JSON.stringify(v))
    else if(field==='answers')query=query.filter(field,'eq',`{${v.join(',')}}`)
    else query=query.eq(field,v)
  }
  const {data:written,error:writeError}=await query.select('id')
  if(writeError||written?.length!==1)throw Error(`${old.id}: ${writeError?.message??'동시 변경 — 재대조 필요'}; 이미 처리한 문항은 유지하고 같은 계획으로 재실행한다`)
  await new Promise(resolve=>setTimeout(resolve,350))
}
for(const {old,patch} of patches){
  const item=corpus.items.find(r=>r.id===old.id)
  Object.assign(item,patch,{body_suspect:false})
}
fs.writeFileSync(corpusFile,JSON.stringify(corpus,null,1)+'\n')
console.log('정본 확인 수리 완료. 해당 단위 목록을 재생성하고 새 분석·독립 검수 전에는 발행하지 않는다.')
}
