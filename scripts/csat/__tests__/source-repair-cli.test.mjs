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
