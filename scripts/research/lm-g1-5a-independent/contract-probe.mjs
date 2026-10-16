// scripts/research/lm-g1-5a-independent/contract-probe.mjs
// Fixed adversarial inputs. --pinned records failures without changing expectations.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {sourceModule} from '../lm-g1-3a-independent/source-loader.mjs'
const root=path.resolve(import.meta.dirname,'../../..');process.chdir(root+'/apps/web')
const pinned=process.argv.includes('--pinned'),out=path.join(import.meta.dirname,'local',pinned?'pinned-contract.json':'revised-contract-v2.json')
if(fs.existsSync(out))throw Error('Immutable output already exists')
const m=sourceModule('apps/web/src/lib/knowledge/contextual-sense.ts')
const ann=()=>({version:'test.v1',itemId:'T#30',skeletonSig:'sig',sentenceCount:8,sourceRevision:'a'.repeat(64),officialAnswer:4,targets:[1,2,3,5,6],misfit:3,sense:{options:['decrease','increase','same'],correct:0,rejectWhy:{1:'decreasing context',2:'change context'}},cue:{sentences:[4],accepted:[6],reviewed:true},review:{status:'accepted',annotator:'a',independentReviewer:'b',reviewerBlind:true,agreement:'3/3',reviewedAt:'2026-10-17'}})
const rows=[],rec=(id,expected,actual)=>rows.push({id,expected,actual,pass:JSON.stringify(expected)===JSON.stringify(actual)})
rec('B+D correct C wrong is bounded success',{misfitOk:true,senseOk:true,cueOk:false,isCorrect:true},m.gradeContextualSense(ann(),{misfit:3,sense:0,cue:[0]}))
rec('B wrong prevents D success',false,m.gradeContextualSense(ann(),{misfit:0,sense:0,cue:[4]}).senseOk)
const un=ann();un.cue.reviewed=false;rec('unreviewed cue null',null,m.gradeContextualSense(un,{misfit:3,sense:0,cue:[4]}).cueOk)
for(const [name,patch] of [['self reviewer',{independentReviewer:'a'}],['blank actor',{annotator:' '}],['missing agreement',{agreement:null}],['bad review date',{reviewedAt:'not-a-date'}],['nonboolean blind',{reviewerBlind:'yes'}]]){const a=ann();Object.assign(a.review,patch);rec(name,false,m.releasable(a))}
const registry=sourceModule('apps/web/src/lib/knowledge/item-tasks.ts'),ev=sourceModule('apps/web/src/lib/knowledge/evidence-locate.ts'),cs=registry.taskByKey('contextual-sense');
const ids=Object.keys(ev.CURATED),eligible=ids.map(id=>[id,registry.currentItemTask(id)]).filter(([,t])=>['evidence-locate','option-restate'].includes(t?.def.key));
if(!eligible.length)throw Error('No real E provider for collision test')
const [id,old]=eligible[0],save=cs.annotationFor;cs.annotationFor=x=>x===id?{...ann(),itemId:id,skeletonSig:old.ann.skeletonSig,sentenceCount:old.ann.sentenceCount}:null;
try{rec('adding V2 preserves existing E selected provider',old.def.key,registry.currentItemTask(id)?.def.key)}finally{cs.annotationFor=save}
rec('zero shipped V2 annotations',0,sourceModule('apps/web/src/lib/knowledge/contextual-sense-annotations.ts').contextualSenseAnnotationCount())
const result={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),mode:pinned?'pinned':'revised',rows};fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!pinned&&rows.some(x=>!x.pass))process.exitCode=1
