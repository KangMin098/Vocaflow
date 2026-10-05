// scripts/csat/__tests__/review-visual-cli.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import {createHash,randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const CLI=fileURLToPath(new URL('../review-drain.mjs',import.meta.url))
const run=randomUUID()
const work=fileURLToPath(new URL('../review-drain-hakpyeong/',import.meta.url))
const asset='20000000-0000-4000-8000-000000000001'
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.from('fictional-test-chart')])
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const hash=digest(png)
const snapshot={input_hash:'a'.repeat(64),units_hash:'b'.repeat(64),item:{id:'H2603G3#25',stem:'Current fictional task',passage:'Current text from the same image delivery.',choices:['one','two','three','four','five']},units:{units_version:3,list:[{n:1,text:'Current text from the same image delivery.'}]}}
async function fixture(action){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'csat-visual-'))
 const calls=[]
 let reply=(url)=>url.endsWith('/csat_item_text_input_hash')?'a'.repeat(64):null
 const server=http.createServer(async(req,res)=>{
  let text='';for await(const part of req)text+=part
  const url=decodeURIComponent(req.url);calls.push({url,body:JSON.parse(text||'{}')})
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(reply(url)))
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const invoke=async(args)=>{
  const child=spawn(process.execPath,[CLI,...args],{cwd:folder,windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${server.address().port}`,SUPABASE_SERVICE_ROLE_KEY:'test-only'}})
  let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data)
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve)})
  return {code,output}
 }
 try{await action({folder,calls,invoke,setReply:value=>{reply=value}})}
 finally{
  await new Promise(resolve=>server.close(resolve))
  assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep+'csat-visual-'))
  fs.rmSync(folder,{recursive:true,force:true})
  for(const extension of ['png','json'])fs.rmSync(path.join(work,`_visual-${run}.${extension}`),{force:true})
 }
}
test('image delivery saves bound private bytes and omits base64 from stdout',async()=>fixture(async({calls,invoke,setReply})=>{
 setReply(()=>[{...snapshot,asset_id:asset,image_sha256:hash,pdf_sha256:'b'.repeat(64),pdf_page:4,image_base64:png.toString('base64')}])
 const result=await invoke(['visual-input','--run',run])
 assert.equal(result.code,0,result.output)
 const out=JSON.parse(result.output)
 assert.equal(out.asset_id,asset);assert.equal(out.image_sha256,hash)
 assert.deepEqual(fs.readFileSync(out.png_file),png)
 assert.equal(path.dirname(out.png_file),path.resolve(work))
 assert.equal(out.image_base64,undefined)
 assert.deepEqual(out.item,snapshot.item);assert.deepEqual(out.units,snapshot.units);assert.equal(out.input_hash,snapshot.input_hash)
 assert.equal(calls.length,1);assert.deepEqual(calls[0].body,{p_run:run})
}))
test('mismatching delivered bytes are refused before saving an image',async()=>fixture(async({invoke,setReply})=>{
 setReply(()=>[{...snapshot,asset_id:asset,image_sha256:'0'.repeat(64),image_base64:png.toString('base64')}])
 const result=await invoke(['visual-input','--run',run])
 assert.equal(result.code,1);assert.match(result.output,/정본 해시/)
 assert.equal(fs.existsSync(path.join(work,`_visual-${run}.png`)),false)
}))
test('damaged observation is rejected locally; actual UTF8 observation is submitted unchanged',async()=>fixture(async({folder,calls,invoke})=>{
 const file=path.join(folder,'observation.txt')
 fs.writeFileSync(file,'도표 범례와 각 막대의 값을 직접 읽은 실제 관찰 기록입니다. 손상된 문자 \u0080가 포함돼 있습니다.')
 assert.equal((await invoke(['visual-ack','--run',run,'--asset',asset,'--sha256',hash,'--note-file',file])).code,1)
 assert.equal(calls.length,0)
 const note='도표를 직접 열어 범례의 세 연령 집단과 막대별 수치, 다섯 선지의 비교 대상을 차례로 확인했다.'
 fs.writeFileSync(file,note)
 const result=await invoke(['visual-ack','--run',run,'--asset',asset,'--sha256',hash,'--note-file',file])
 assert.equal(result.code,0,result.output);assert.deepEqual(calls[0].body,{p_run:run,p_asset:asset,p_sha256:hash,p_observation:note})
}))
test('registration previews verified PDF/PNG; hash mismatch refuses all writes',async()=>fixture(async({folder,calls,invoke})=>{
 const pdf=Buffer.from('%PDF-1.7 fictional fixture')
 const proof={item_id:'H2603G3#25',pdf_page:4,pdf_file:path.join(folder,'source.pdf'),png_file:path.join(folder,'source.png'),source_input_hash:'a'.repeat(64),pdf_sha256:digest(pdf),image_sha256:hash,inspected_by:'actual-test-inspector',inspection:'I inspected the entire fictional graph and legend directly before registering this evidence.'}
 fs.writeFileSync(proof.pdf_file,pdf);fs.writeFileSync(proof.png_file,png)
 const file=path.join(folder,'proof.json');fs.writeFileSync(file,JSON.stringify(proof))
 const preview=await invoke(['visual-register','--file',file])
 assert.equal(preview.code,0,preview.output);assert.equal(JSON.parse(preview.output).mode,'preview')
 assert.equal(calls.length,2);assert.ok(calls[0].url.endsWith('/csat_item_text_input_hash'))
 assert.equal(JSON.parse(preview.output).expected_asset,null)
 calls.length=0;fs.writeFileSync(proof.png_file,Buffer.concat([png,Buffer.from('tampered')]))
 const invalid=await invoke(['visual-register','--file',file,'--commit'])
 assert.equal(invalid.code,1);assert.equal(calls.length,0);assert.match(invalid.output,/PNG 해시/)
}))

test('replacement preview gives the head UUID and commit requires that explicit expectation',async()=>fixture(async({folder,calls,invoke,setReply})=>{
 const pdf=Buffer.from('%PDF-1.7 fictional fixture')
 const proof={item_id:'H2603G3#25',pdf_page:4,pdf_file:path.join(folder,'source.pdf'),png_file:path.join(folder,'source.png'),source_input_hash:'a'.repeat(64),pdf_sha256:digest(pdf),image_sha256:hash,inspected_by:'actual-test-inspector',inspection:'I inspected this replacement chart directly and verified all its labels and values.'}
 fs.writeFileSync(proof.pdf_file,pdf);fs.writeFileSync(proof.png_file,png)
 const file=path.join(folder,'proof.json');fs.writeFileSync(file,JSON.stringify(proof))
 setReply(url=>url.endsWith('/csat_item_text_input_hash')?'a'.repeat(64):url.includes('/csat_review_visual_heads')?{asset_id:asset}:asset)
 const preview=await invoke(['visual-register','--file',file]);assert.equal(preview.code,0,preview.output);assert.equal(JSON.parse(preview.output).expected_asset,asset)
 calls.length=0
 const refused=await invoke(['visual-register','--file',file,'--commit']);assert.equal(refused.code,1);assert.match(refused.output,/expected_asset/)
 assert.equal(calls.filter(c=>c.url.endsWith('/csat_review_visual_register')).length,0)
 proof.expected_asset=asset;fs.writeFileSync(file,JSON.stringify(proof));calls.length=0
 const committed=await invoke(['visual-register','--file',file,'--commit']);assert.equal(committed.code,0,committed.output)
 assert.equal(calls.find(c=>c.url.endsWith('/csat_review_visual_register')).body.p_expected_asset,asset)
}))

test('first registration with explicit null expectation can replay a lost response unchanged',async()=>fixture(async({folder,calls,invoke,setReply})=>{
 const pdf=Buffer.from('%PDF-1.7 fictional fixture')
 const proof={item_id:'H2603G3#25',expected_asset:null,pdf_page:4,pdf_file:path.join(folder,'source.pdf'),png_file:path.join(folder,'source.png'),source_input_hash:'a'.repeat(64),pdf_sha256:digest(pdf),image_sha256:hash,inspected_by:'actual-test-inspector',inspection:'I inspected the entire fictional chart before its initial registration and checked every value.'}
 fs.writeFileSync(proof.pdf_file,pdf);fs.writeFileSync(proof.png_file,png)
 const file=path.join(folder,'proof.json');fs.writeFileSync(file,JSON.stringify(proof))
 let registered=false
 setReply(url=>url.endsWith('/csat_item_text_input_hash')?'a'.repeat(64):url.includes('/csat_review_visual_heads')?(registered?{asset_id:asset}:null):(registered=true,asset))
 for(let n=0;n<2;n++){const result=await invoke(['visual-register','--file',file,'--commit']);assert.equal(result.code,0,result.output);assert.equal(JSON.parse(result.output).asset_id,asset)}
 const writes=calls.filter(c=>c.url.endsWith('/csat_review_visual_register'));assert.equal(writes.length,2);assert.deepEqual(writes[0].body,writes[1].body);assert.equal(writes[1].body.p_expected_asset,null)
}))

test('status counts a chart with an asset but no current analysis binding as held',async()=>fixture(async({calls,invoke,setReply})=>{
 const analysis={id:'30000000-0000-4000-8000-000000000001',item_id:'H2603G3#25',version:2,status:'in_review',analyst_run:'fictional-author'}
 setReply(url=>url.includes('/csat_item_analyses?')?[analysis]:url.includes('/csat_items?')?[{id:analysis.item_id}]:url.endsWith('/csat_current_chart_asset')?asset:url.endsWith('/csat_chart_analysis_ready')?false:[])
 const result=await invoke(['status']);assert.equal(result.code,0,result.output)
 const out=JSON.parse(result.output);assert.equal(out.held_chart_no_image,1)
 assert.deepEqual(calls.find(c=>c.url.endsWith('/csat_chart_analysis_ready')).body,{p_analysis:analysis.id})
}))
