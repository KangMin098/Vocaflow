// scripts/research/lm-g1-2-independent/passage-failure.mjs
// Evaluates the exact loader call expressions with rejected dependencies, no database access.
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
const root=path.resolve(import.meta.dirname,'../../..'),req=createRequire(root+'/apps/web/package.json'),ts=req('typescript')
const source=fs.readFileSync(root+'/apps/web/src/lib/csat/map/load.ts','utf8')
const ast=ts.createSourceFile('load.ts',source,ts.ScriptTarget.Latest,true)
const main=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='loadMapPage')
const declarations=main.body.statements.filter(ts.isVariableStatement).flatMap(n=>[...n.declarationList.declarations])
const rows=[]
for(const [id,fragment] of [['source','passageKeys'],['candidates','transferItems']]){
 const variable=declarations.find(n=>n.name.getText(ast).includes(fragment))
 const text=ts.transpileModule('async function probe(){return '+variable.initializer.getText(ast)+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
 const run=new Function('loadPassageKeys','loadTransferItems','db','lifecycleActivity','transferTargets','practiceLinks','console',text+';return probe()')
 const failure=async()=>{throw Error('INJECT_'+id)}
 let rejected=false
 try{await run(failure,failure,{},[],{},{},{error(){}})}catch(e){rejected=String(e).includes('INJECT_'+id)}
 rows.push({id,status:rejected?'PASS':'FAIL',propagatesQueryFailure:rejected,scope:'exact loader expression/isolated rejected dependency'})
}
const loop=main.body.statements.find(n=>ts.isForOfStatement(n)&&n.getText(ast).includes('Object.entries(transferTargets)'))
const loopText=ts.transpileModule(loop.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
for(const [id,list,keys,throws] of [['missing-identity',[{target:'item'}],{},true],['real-empty',[],{},false],['known-identity',[{target:'item'}],{item:'hash'},false]]){
 let failed=false
 try{new Function('transferTargets','passageKeys','transferItems',loopText)({k:list},keys,{k:list.length})}catch{failed=true}
 rows.push({id,status:failed===throws?'PASS':'FAIL',rejected:failed,scope:'exact loader candidate binding loop'})
}
const transferFn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='loadTransferItems')
const fnText=ts.transpileModule(transferFn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const runTransfer=new Function('PRACTICE_SLUG','loadPracticePool','selectSmall','parseItemTaskRef','isTransferRole','itemRevealDecision','toItemSlug',fnText+';return loadTransferItems')
let gateRejected=false
try{await runTransfer('claim-support',async()=>[{itemId:'2024#43',phase:'transfer'}],async()=>[],()=>({}),()=>false,async()=>({failed:true,held:new Set()}),x=>x)({}, {p:{confirm:[{taskKey:'claim-support',target:'bundle'}]}})}catch{gateRejected=true}
rows.push({id:'transfer-reveal-failure',status:gateRejected?'PASS':'FAIL',rejected:gateRejected,scope:'exact loadTransferItems/private production function'})
const gateDecl=declarations.find(n=>n.name.getText(ast)==='gate')
const gateStmt=gateDecl.parent.parent
const gateAt=main.body.statements.indexOf(gateStmt)
const gateText=ts.transpileModule('async function probe(){'+main.body.statements.slice(gateAt,gateAt+2).map(n=>n.getText(ast)).join('\n')+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
let initialRejected=false
try{await new Function('itemRevealDecision','allLinks','withoutHeld',gateText+';return probe()')(async()=>({failed:true,held:new Set()}),{p:{confirm:[]}},()=>({}))}catch{initialRejected=true}
rows.push({id:'initial-reveal-failure',status:initialRejected?'PASS':'FAIL',rejected:initialRejected,scope:'exact main loader gate statement and successor'})
fs.writeFileSync(path.join(import.meta.dirname,'local/passage-failure-results.json'),JSON.stringify({rows},null,2))
console.log(JSON.stringify(rows))
process.exitCode=rows.every(r=>r.status==='PASS')?0:1
