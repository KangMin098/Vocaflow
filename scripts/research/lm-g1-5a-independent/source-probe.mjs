// scripts/research/lm-g1-5a-independent/source-probe.mjs
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {sourceModule} from '../lm-g1-3a-independent/source-loader.mjs'
const root=path.resolve(import.meta.dirname,'../../..'),pinned=process.argv.includes('--pinned'),rel='apps/web/src/lib/knowledge/product-server.ts',sha='4064c002bec87cedc3f4dece9d86172eed3d8fc0';process.chdir(root+'/apps/web')
const overrides=pinned?{[path.resolve(root,rel)]:execFileSync('git',['show',sha+':'+rel],{cwd:root,encoding:'utf8'})}:{}
const registry=sourceModule('apps/web/src/lib/knowledge/item-tasks.ts'),m=sourceModule(rel,overrides),{passageRevision}=sourceModule('apps/web/src/lib/knowledge/anchor-source.ts'),passage='Synthetic context decreases.'
const a={version:'test',itemId:'SYNTH#30',skeletonSig:'sig',sentenceCount:2,sourceRevision:passageRevision(passage),officialAnswer:4,targets:[0,0,0,1,1],misfit:3,sense:{options:['less','more'],correct:0,rejectWhy:{1:'less context'}},cue:{sentences:[0],accepted:[],reviewed:true},review:{status:'accepted',annotator:'A',independentReviewer:'B',reviewerBlind:true,agreement:'BD',reviewedAt:'2026-10-17'}}
registry.currentItemTask=()=>({def:{key:'contextual-sense'},ann:a})
const rows=[]
for(const [name,data,error,expected] of [['current',{passage,answer:4,answer_unknown:false},null,true],['equal length source edit',{passage:passage.replace('decreases','increases'),answer:4,answer_unknown:false},null,false],['official answer mismatch',{passage,answer:1,answer_unknown:false},null,false],['unknown answer',{passage,answer:4,answer_unknown:true},null,false],['source read failure',null,{message:'fixture failure'},false]]){
 const q={select(){return q},eq(){return q},maybeSingle:async()=>({data,error})};const actual=await m.anchorGate(a.itemId,{from:()=>q});rows.push({name,expected,actual,pass:actual===expected})
}
const out=path.join(import.meta.dirname,'local',pinned?'pinned-source.json':'revised-source.json');if(fs.existsSync(out))throw Error('Immutable output exists');fs.writeFileSync(out,JSON.stringify({source:pinned?sha:'working tree',rows},null,2));console.log(JSON.stringify(rows));if(!pinned&&rows.some(r=>!r.pass))process.exitCode=1
