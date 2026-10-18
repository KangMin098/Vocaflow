// apps/web/scripts/final-independent/probe-authored-grader.ts
// Sealed Codex reading vs immutable owner grader; no DB/remote network.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import * as claimSupport from '../../src/lib/knowledge/claim-support'
import * as labels from '../../src/lib/knowledge/claim-support-labels'
const root=path.resolve(__dirname,'../../../..'),v2=process.argv.includes('--v2'),ref=v2?'c4b9f434e':'6b988d0f5'
const read=(file:string)=>execFileSync('git',['show',`${ref}:${file}`],{cwd:root,encoding:'utf8'})
const set=JSON.parse(read('apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json'))
const code=ts.transpileModule(read('apps/web/src/lib/knowledge/authored/authored-items.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
const exposed:Record<string,unknown>={}
const dependency=(specifier:string)=>{if(specifier==='../claim-support')return claimSupport;if(specifier==='../claim-support-labels')return labels;if(specifier==='./r5-central-meaning.v1.json')return set;throw new Error(`Unexpected frozen dependency ${specifier}`)}
// Execute only the inspected pure module; fixed dependency allowlist prevents loading other owner files.
new Function('exports','require',code)(exposed,dependency)
const grade=exposed.gradeAuthored as (s:unknown,it:unknown,r:unknown)=>{grade:{isCorrect:boolean;choiceOk:boolean;claimOk:boolean;claimRestated:boolean;supportOk:boolean;relationOk:boolean}}|null
const rawReading=JSON.parse(fs.readFileSync(path.join(root,'docs/research/final-independent-20261018',v2?'authored-v2-codex-reading.json':'authored-blind-codex.json'),'utf8'))
const blind=v2?{items:rawReading.items.map((b:{id:string;answer:number;mainClaim:number})=>({id:b.id,choice:b.answer,primaryClaim:b.mainClaim,acceptableRestatement:[],directSupport:undefined}))}:rawReading
const observations=blind.items.map((b:{id:string;choice:number;primaryClaim:number;acceptableRestatement:number[];directSupport:number[]},index:number)=>{
 const item=set.items[index],g=item.gold
 const response={claim:b.primaryClaim,support:g.support,relation:g.relationProbe.relation,choice:b.choice}
 const result=grade(set,item,response)
 const alternatives=b.acceptableRestatement.map(claim=>({claim,grade:grade(set,item,{...response,claim})?.grade}))
 return{blindId:b.id,itemRef:`authored:${item.id}`,role:item.role,choiceAgreement:b.choice===g.answer,primaryClaim:b.primaryClaim,ownerClaim:g.claim,primaryGrade:result?.grade,alternatives,directSupportFeedback:grade(set,item,{...response,support:b.directSupport??g.support})?.grade}
})
console.log(JSON.stringify({scope:v2?'INDEPENDENT_V2_DELTA_READING_PRIOR_V1_KNOWN':'SEALED_AI_REVIEW_VS_FROZEN_GRADER',ownerCommit:ref,items:observations.length,allChoicesAgree:observations.every((x:{choiceAgreement:boolean})=>x.choiceAgreement),allPrimaryClaimsAccepted:observations.every((x:{primaryGrade?:{isCorrect:boolean}})=>x.primaryGrade?.isCorrect===true),observations},null,2))
