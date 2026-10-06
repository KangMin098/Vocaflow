// scripts/csat/reveal-gate/__tests__/verification-core.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { scanLoaders,scanClient,scanBundle,pagingLocations,secretLiterals } from '../verification-core.mjs'
function fixture(run){const prefix=path.join(os.tmpdir(),'reveal-verify-'),root=fs.mkdtempSync(prefix);try{return run(root,(name,text)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text)})}finally{if(!path.resolve(root).startsWith(path.resolve(prefix)))throw Error('Unexpected fixture path');fs.rmSync(root,{recursive:true,force:true})}}
const manifest={db_relations:{csat_items:{class:'ANSWER_SENSITIVE'}},db_functions:{},app_db_loaders:{},app_api:{}}
test('mutation: new DB loader, alias, unused import and comment calls fail closed',()=>fixture((root,write)=>{
  write('lib/csat/leak.ts','export const load = (db) => db.from("csat_items").select("answer")')
  assert.equal(scanLoaders(root,manifest).issues[0].kind,'unclassified_loader')
  const m={...manifest,app_db_loaders:{'lib/csat/leak.ts':{class:'ANSWER_SENSITIVE'}}}
  write('lib/csat/leak.ts','import {canRevealItem as gate} from "./embargo-gate"; // gate("x");\nexport const load=(db)=>db.from("csat_items").select("answer")')
  assert.ok(scanLoaders(root,m).issues.some(i=>i.kind==='ungated_loader'))
  write('lib/csat/leak.ts','import {canRevealItem as gate} from "./embargo-gate"; export const load=async(db)=>(await gate("x"))?db.from("csat_items").select("answer"):null')
  assert.deepEqual(scanLoaders(root,m).issues,[])
  const functions=scanLoaders(root,m).functions
  const policy={function_approvals:Object.fromEntries(functions.map(r=>[r.key,{sha256:r.sha256,class:r.class,review_basis:'fixture approved body'}]))}
  assert.deepEqual(scanLoaders(root,m,policy).issues,[])
  write('lib/csat/leak.ts','import {canRevealItem as gate} from "./other/embargo-gate"; export const load=async(db)=>(await gate("x"))?db.from("csat_items").select("answer"):null; export const bypass=(db)=>db.from("csat_items").select("answer")')
  assert.ok(scanLoaders(root,m,policy).issues.some(i=>i.kind==='unclassified_or_changed_sensitive_function'&&i.function==='bypass'))
  assert.ok(scanLoaders(root,m,policy).issues.some(i=>i.kind==='unclassified_or_changed_sensitive_function'&&i.function==='load'))
  write('app/api/csat/new/route.ts','export const GET=()=>({correctAnswer:2})')
  assert.ok(scanLoaders(root,m).issues.some(i=>i.kind==='unclassified_route'))
  write('lib/csat/from-file.ts','import fs from "node:fs"; export const load=()=>fs.readFileSync("private.json")')
  assert.ok(scanLoaders(root,m).issues.some(i=>i.kind==='unclassified_file_loader'))
  write('lib/csat/from-json.ts','import data from "./private.json"; export const load=()=>data')
  assert.ok(scanLoaders(root,m).issues.some(i=>i.kind==='unclassified_json_loader'))
  const classified={...m,app_api:{'csat/new':{class:'ANSWER_SENSITIVE'}}}
  assert.ok(scanLoaders(root,classified,{function_approvals:{}}).issues.some(i=>i.function==='GET'))
}))
test('mutation: renamed JSON and re-exported dynamic client imports expose answer literals',()=>fixture((root,write)=>{
  write('app/Client.tsx','"use client"; import("../lib/barrel");')
  write('lib/barrel.ts','export {default as data} from "./innocent.json"')
  write('lib/innocent.json',JSON.stringify({expectedAnswer:'KNOWN_SECRET_CANARY_01'}))
  const scanned=scanClient(root,['KNOWN_SECRET_CANARY_01'])
  assert.equal(scanned.files,3);assert.equal(scanned.unresolved.length,0)
  assert.ok(scanned.issues.some(i=>i.file==='lib/innocent.json'))
}))
test('mutation: production artifact and escaped literal canary detected; empty build is blocked',()=>fixture((root,write)=>{
  assert.ok(scanBundle(root).issues.some(i=>i.kind==='BUNDLE_NOT_EXECUTED'))
  write('static/chunk.js','const a={expectedAnswer:"KNOWN_SECRET_CANARY_02"}')
  assert.ok(scanBundle(root,['KNOWN_SECRET_CANARY_02']).issues.some(i=>i.kind==='CLIENT_SECRET_LEAK'))
  assert.deepEqual(secretLiterals('app.ts','// const data={correctAnswer:2};\nconst schema={correctAnswer:value};'),[])
  assert.ok(secretLiterals('app.js','const a="\\u004bNOWN_SECRET_CANARY_01"',['KNOWN_SECRET_CANARY_01']).includes('canary'))
  assert.ok(secretLiterals('chunk.js','const a=JSON.parse('+JSON.stringify(JSON.stringify({answerKey:4}))+')').includes('answerKey'))
}))
test('paging sites ignore comments and retain changed call identity rather than a global count',()=>{
  assert.deepEqual(pagingLocations('// db.range(offset, end)\nconst x=db.range(0,99)','x.ts'),[])
  const sites=pagingLocations('const x=db.range(offset, offset+99)','x.ts')
  assert.equal(sites.length,1);assert.equal(sites[0].line,1);assert.ok(sites[0].key.includes('offset'))
})
