// scripts/csat/__tests__/source-repair-cli.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {sourceDigest} from '../lib-source-repair.mjs'

test('a later CAS conflict retains every inspected recipe before any DB commit',async()=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'csat-repair-cli-'))
 const source=Buffer.from('fictional PDF bytes'),pdf='fixture.pdf'
 const rows=['H9903G1#26','H9903G1#27'].map(id=>({id,type_id:'R-NOTICE',stem:'Synthetic notice question',passage:'Old synthetic passage',choices:['a','b','c','d','e'],answer:2,answers:[2],body_ok:false}))
 const repairs=rows.map(r=>({item_id:r.id,pdf_file:pdf,pdf_sha256:sourceDigest(source),before:{passage:r.passage},after:{passage:'Verified synthetic passage'}}))
 let writes=0
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json')
  if(req.method==='GET'){res.end(JSON.stringify(rows));return}
  if(req.method==='PATCH'){
   writes++
   assert.ok(fs.existsSync(path.join(fixture,'scripts/csat/data/hakpyeong-source-repairs.json')))
   assert.equal(JSON.parse(fs.readFileSync(path.join(fixture,'scripts/csat/data/hakpyeong-source-repairs.json'),'utf8')).repairs.length,2)
   req.resume();res.end(JSON.stringify(writes===1?[{id:rows[0].id}]:[]));return
  }
  res.statusCode=405;res.end('{}')
 })
 try{
  fs.mkdirSync(path.join(fixture,'scripts/csat/data'),{recursive:true})
  fs.writeFileSync(path.join(fixture,pdf),source)
  fs.writeFileSync(path.join(fixture,'plan.json'),JSON.stringify({repairs}))
  fs.writeFileSync(path.join(fixture,'scripts/csat/data/corpus-hakpyeong.json'),JSON.stringify({items:rows}))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const address=`http://127.0.0.1:${server.address().port}`
  const script=fileURLToPath(new URL('../source-repair.mjs',import.meta.url))
  const child=spawn(process.execPath,[script,'--file','plan.json','--commit'],{cwd:fixture,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:address,SUPABASE_URL:address,SUPABASE_SERVICE_ROLE_KEY:'synthetic-key',SUPABASE_SERVICE_KEY:'synthetic-key',CSAT_HAKPYEONG_DIR:fixture}})
  let log='';child.stdout.on('data',b=>{log+=b});child.stderr.on('data',b=>{log+=b})
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
  assert.notEqual(code,0)
  assert.match(log,/동시 변경/)
  assert.equal(writes,2)
  const stored=JSON.parse(fs.readFileSync(path.join(fixture,'scripts/csat/data/hakpyeong-source-repairs.json'),'utf8'))
  assert.deepEqual(stored.repairs,repairs)
  assert.equal(fs.existsSync(path.join(fixture,'scripts/csat/data/hakpyeong-source-repairs.json.tmp')),false)
 }finally{
  await new Promise(resolve=>server.close(resolve))
  assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir())+path.sep))
  assert.ok(path.basename(fixture).startsWith('csat-repair-cli-'))
  fs.rmSync(fixture,{recursive:true,force:true})
 }
})

async function repairFixture(row,local,fields){
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'csat-repair-fields-'))
 const bytes=Buffer.from('Synthetic PDF fixture'),requests=[]
 const repair={item_id:row.id,pdf_file:'fixture.pdf',pdf_sha256:sourceDigest(bytes),before:Object.fromEntries(Object.keys(fields).map(k=>[k,row[k]])),after:fields}
 const server=http.createServer(async(req,res)=>{
  let body='';for await(const part of req)body+=part
  requests.push({method:req.method,body:body?JSON.parse(body):null})
  res.setHeader('Content-Type','application/json')
  res.end(JSON.stringify(req.method==='GET'?[row]:[{id:row.id}]))
 })
 try{
  fs.mkdirSync(path.join(fixture,'scripts/csat/data'),{recursive:true})
  fs.writeFileSync(path.join(fixture,'fixture.pdf'),bytes)
  fs.writeFileSync(path.join(fixture,'plan.json'),JSON.stringify({repairs:[repair]}))
  fs.writeFileSync(path.join(fixture,'scripts/csat/data/corpus-hakpyeong.json'),JSON.stringify({items:[local]}))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const url=`http://127.0.0.1:${server.address().port}`
  const child=spawn(process.execPath,[fileURLToPath(new URL('../source-repair.mjs',import.meta.url)),'--file','plan.json','--commit'],{cwd:fixture,windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:'synthetic-key',CSAT_HAKPYEONG_DIR:fixture}})
  let output='';child.stdout.on('data',b=>{output+=b});child.stderr.on('data',b=>{output+=b})
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
  assert.equal(code,0,output)
  return {requests,item:JSON.parse(fs.readFileSync(path.join(fixture,'scripts/csat/data/corpus-hakpyeong.json'),'utf8')).items[0]}
 }finally{
  await new Promise(resolve=>server.close(resolve))
  assert.ok(path.resolve(fixture).startsWith(path.resolve(os.tmpdir())+path.sep))
  assert.ok(path.basename(fixture).startsWith('csat-repair-fields-'))
  fs.rmSync(fixture,{recursive:true,force:true})
 }
}
const base={id:'H9903G1#26',type_id:'R-NOTICE',stem:'Synthetic question',passage:'Verified synthetic passage',choices:['a','b','c','d','e'],answer:2,answers:[2],body_ok:true}
test('a stem-only repair cannot mark missing passage or choices as complete or dismiss warnings',async()=>{
 const row={...base,passage:null,choices:null,body_ok:false}
 const r=await repairFixture(row,{...row,body_suspect:true},{stem:'Repaired synthetic question'})
 assert.equal(r.requests.find(q=>q.method==='PATCH').body.body_ok,false)
 assert.equal(r.item.body_ok,false)
 assert.equal(r.item.body_suspect,true)
 assert.equal(r.item.passage,null)
})
test('local corpus input is fully aligned to validated DB fields without changing original answers/raw text',async()=>{
 const local={...base,passage:'Stale local passage',choices:['stale'],body_suspect:true,raw_block:'Original local block'}
 const r=await repairFixture(base,local,{stem:'Repaired synthetic question'})
 assert.deepEqual(r.item.choices,base.choices)
 assert.equal(r.item.passage,base.passage)
 assert.equal(r.item.body_suspect,true)
 assert.equal(r.item.answer,local.answer)
 assert.equal(r.item.raw_block,local.raw_block)
})

test('a partial repair preserves a defective flag even when all source fields are nonempty',async()=>{
 const row={...base,passage:'Truncated but nonempty source.',body_ok:false}
 const r=await repairFixture(row,{...row,body_suspect:true},{stem:'Repaired synthetic question'})
 assert.equal(r.requests.find(q=>q.method==='PATCH').body.body_ok,false)
 assert.equal(r.item.body_ok,false)
 assert.equal(r.item.body_suspect,true)
})

test('a full inspected source plan may clear a defective flag without erasing local warnings',async()=>{
 const row={...base,body_ok:false}
 const r=await repairFixture(row,{...row,body_suspect:true},{stem:'Repaired synthetic question',passage:base.passage,choices:base.choices})
 assert.equal(r.requests.find(q=>q.method==='PATCH').body.body_ok,true)
 assert.equal(r.item.body_ok,true)
 assert.equal(r.item.body_suspect,true)
})
