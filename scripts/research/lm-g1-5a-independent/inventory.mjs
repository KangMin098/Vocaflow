// scripts/research/lm-g1-5a-independent/inventory.mjs
import fs from 'node:fs';import path from 'node:path';import {sourceModule} from '../lm-g1-3a-independent/source-loader.mjs'
const root=path.resolve(import.meta.dirname,'../../..');process.chdir(root+'/apps/web')
const {skeletonSiblings}=sourceModule('apps/web/src/lib/csat/skeleton.ts'),{currentItemTask,taskByKey}=sourceModule('apps/web/src/lib/knowledge/item-tasks.ts'),{CURATED}=sourceModule('apps/web/src/lib/knowledge/evidence-locate.ts'),{sameAttempt,responseOf}=sourceModule('apps/web/src/lib/knowledge/practice-writer.ts')
const candidates=['R-VOCAB','X-VOCAB'].flatMap(type=>skeletonSiblings(type).map(x=>({itemId:x.id,type,currentProvider:currentItemTask(x.id)?.def.key??null}))),cs=taskByKey('contextual-sense'),saved=cs.annotationFor,rows=[]
try{for(const id of Object.keys(CURATED)){
 const before=currentItemTask(id);if(!before)continue
 cs.annotationFor=x=>x===id?{...before.ann,itemId:id}:null
 const after=currentItemTask(id);rows.push({itemId:id,before:before.def.key,after:after?.def.key??null,pass:before.def.key===after?.def.key})
}}finally{cs.annotationFor=saved}
const w={userId:'u',taskKey:'contextual-sense',applicationId:'app',itemRef:'T#30',contentHash:'hash',activity:'theater',phase:'practice',helpLevel:'independent',synthetic:true,clientMutationId:'m',clientSessionId:'s',answeredAt:'2026-10-17T00:00:00Z',sec:1,isCorrect:true,answer:{misfit:3,sense:0,cue:[]},extra:{}}
// Real writer builds response JSON; task/item identity must not match another record even if response does.
const normal={item_ref:w.itemRef,phase:w.phase,task_key:w.taskKey,answered_at:w.answeredAt,response:responseOf(w)}
const normalMatches=sameAttempt(normal,w),otherTaskRejected=!sameAttempt({...normal,task_key:'option-restate'},w),otherItemRejected=!sameAttempt({...normal,item_ref:'T#31'},w)
const out={candidates,providerPreservation:rows,normalMatches,otherTaskRejected,otherItemRejected,sourceScope:'committed skeleton inventory; not DB content qualification'}
const outFile=path.join(import.meta.dirname,'local',(process.argv.find(a=>a.startsWith('--revision='))?.slice(11)??'inventory')+'.json');if(fs.existsSync(outFile))throw Error('Immutable output exists');fs.writeFileSync(outFile,JSON.stringify(out,null,2));console.log(JSON.stringify({candidates:candidates.length,providerPreservation:rows.length,allPreserved:rows.every(r=>r.pass),normalMatches,otherTaskRejected,otherItemRejected}));if(rows.some(r=>!r.pass)||!normalMatches||!otherTaskRejected||!otherItemRejected)process.exitCode=1
