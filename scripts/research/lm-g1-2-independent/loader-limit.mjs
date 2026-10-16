// scripts/research/lm-g1-2-independent/loader-limit.mjs
// Extracts the actual loader function with TypeScript AST; no DB access.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const root=path.resolve(import.meta.dirname,'../../..')
const req=createRequire(path.join(root,'apps/web/package.json'))
const ts=req('typescript')
const src=fs.readFileSync(path.join(root,'apps/web/src/lib/csat/map/load.ts'),'utf8')
const ast=ts.createSourceFile('load.ts',src,ts.ScriptTarget.Latest,true)
const fn=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='loadLifecycleActivity')
const text=ts.transpileModule(fn.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const loader=new Function('transferKeysOf',text+';return loadLifecycleActivity')(k=>[k,k+'-skeleton'])
const records=Array.from({length:1002},(_,i)=>({id:i+1,item_ref:i===0?'repair-success':'repeat',task_key:'claim-support',phase:'practice',is_correct:i===0,answered_at:'2026-10-10T00:00:00Z'})).reverse()
let queries=[]
const db={from(table){let limit=1000,cursor=Infinity;const q={select(){return q},eq(k,v){queries.push({table,key:k,value:v});return q},in(){return q},order(){return q},limit(n){limit=n;return q},lt(k,v){cursor=Number(v);return q},then(ok){return Promise.resolve({data:records.filter(r=>r.id<cursor).slice(0,limit),error:null}).then(ok)}};return q}}
const got=await loader(db,'owned-fixture',['claim-support'],{held:new Set(),failed:false})
const result={id:'F-limit',status:got.length===1002&&got.some(x=>x.itemRef==='repair-success')?'PASS':'FAIL',expected:1002,actual:got.length,repairSuccessRetained:got.some(x=>x.itemRef==='repair-success'),userScoped:queries.every(x=>x.key==='user_id'&&x.value==='owned-fixture'),scope:'mock PostgREST / exact transpiled production function'}
fs.writeFileSync(path.join(import.meta.dirname,'local/loader-limit-results.json'),JSON.stringify(result,null,2))
console.log(JSON.stringify(result))

let calls=0
const broken={from(){let q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},lt(){return q},then(ok){calls++;return Promise.resolve(calls===1?{data:records.slice(0,1000),error:null}:{data:null,error:{message:'injected page2 failure'}}).then(ok)}};return q}}
let rejected=false
try{await loader(broken,'owned-fixture',['claim-support'],{held:new Set(),failed:false})}catch(e){rejected=String(e).includes('injected page2 failure')}
const held=await loader(db,'owned-fixture',['claim-support'],{held:new Set(['repair-success']),failed:false})
const blocked=await loader(db,'owned-fixture',['claim-support'],{held:new Set(),failed:true})
const rows=[result,{id:'F-page2',status:rejected?'PASS':'FAIL',partialRowsReturned:false},{id:'F-held',status:held.length===1001&&!held.some(a=>a.itemRef==='repair-success')?'PASS':'FAIL'},{id:'F-gate',status:blocked.length===0?'PASS':'FAIL'}]
fs.writeFileSync(path.join(import.meta.dirname,'local/loader-limit-results.json'),JSON.stringify({rows},null,2))
console.log(JSON.stringify(rows))
process.exitCode=rows.every(r=>r.status==='PASS')?0:1
