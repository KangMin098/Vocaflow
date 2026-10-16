// scripts/research/lm-g1-4-independent/loader-probe.mjs
// Exact loader functions with fixed query fixtures; actual annotation registry.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
import {sourceModule} from '../lm-g1-3a-independent/source-loader.mjs';
const root=path.resolve(import.meta.dirname,'../../..'),req=createRequire(root+'/apps/web/package.json'),ts=req('typescript'),original=process.argv.includes('--original'),file='apps/web/src/lib/csat/map/load.ts';
const source=original?execFileSync('git',['show','68b1541ff:'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(root+'/'+file,'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
process.chdir(root+'/apps/web');
const mod=sourceModule(file,{[path.resolve(root,file)]:source+'\nexport {loadLifecycleActivity,loadFindAttempts,loadPassageKeys};'}),results=[];
const data=Array.from({length:2505},(_,i)=>({id:i+1,user_id:'u',item_ref:'i'+i%6,task_key:'claim-support',phase:'practice',is_correct:i%2===0,answered_at:'2026-10-01T00:00:00Z',received_at:'2026-10-01T00:00:01Z',content_hash:'h',activity:'theater',help_level:'independent',synthetic:true}));
function database(rows,failPage=0){const calls=[];return {calls,from(table){let filters=[],limit=Infinity,order=null,selected='*';const q={select(s){selected=s;return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},lt(k,v){filters.push(r=>r[k]<Number(v));return q},order(k,o){order=[k,o?.ascending!==false];return q},limit(n){limit=n;return q},then(resolve,reject){calls.push({table,selected,limit});if(table==='learning_task_attempts'&&calls.filter(c=>c.table===table).length===failPage)return Promise.resolve({data:null,error:{message:'injected page failure'}}).then(resolve,reject);let out=table==='learning_task_attempts'?rows:table==='learning_first_attempts'?[{...rows[0],attempt_id:rows[0]?.id,after_viewed_first:false,after_explanation:false,timing_uncertain:false}].filter(r=>r.attempt_id):[];out=out.filter(r=>filters.every(f=>f(r)));if(order)out.sort((a,b)=>(a[order[0]]<b[order[0]]?-1:1)*(order[1]?1:-1));return Promise.resolve({data:out.slice(0,limit),error:null}).then(resolve,reject)}};return q}}}
const db=database(data),start=performance.now(),loaded=await mod.loadLifecycleActivity(db,'u',['claim-support'],{held:new Set(['i5']),failed:false});
results.push({name:'paged 2505 records, held filtered, exact ids',pass:loaded.length===data.filter(r=>r.item_ref!=='i5').length&&(!original?loaded.every(r=>r.attemptId):true),rows:loaded.length,pages:db.calls.length,ms:performance.now()-start,idsAvailable:loaded.every(r=>r.attemptId)});
let rejected=false;try{await mod.loadLifecycleActivity(database(data,2),'u',['claim-support'],{held:new Set(),failed:false})}catch{rejected=true}results.push({name:'page2 failure rejects, never empty success',pass:rejected});
const empty=await mod.loadLifecycleActivity(database([]),'u',['claim-support'],{held:new Set(),failed:false});results.push({name:'normal zero rows',pass:empty.length===0});
const first=await mod.loadFindAttempts(database(data.slice(0,1)),'u',['i0']);results.push({name:'first DTO preserves DB attempt_id',pass:first[0]?.attemptId==='1',actual:first[0]?.attemptId??null});
const {taskByKey,currentItemTask,ITEM_TASKS}=sourceModule('apps/web/src/lib/knowledge/item-tasks.ts'),{annotatedItemIds}=sourceModule('apps/web/src/lib/knowledge/claim-support.ts'),{instrumentHashesFor}=sourceModule('apps/web/src/lib/csat/map/v62/instrument-hashes.ts');
const items=annotatedItemIds().slice(0,6),keys=['claim-support','cohesion-link','option-restate','evidence-locate'],pairs=Array.from({length:12001},(_,i)=>({taskKey:keys[i%4],itemRef:items[Math.floor(i/4)%6]}));
const block=source.slice(source.indexOf('  let instrumentHashes:'),source.indexOf('  for (const [key, list] of Object.entries(transferTargets))'));
const code=ts.transpileModule('function hashBlock(lifecycleActivity,findAttempts,taskByKey,instrumentHashesFor,console){'+block+';return instrumentHashes}',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const runBlock=new Function(code+';return hashBlock')();
for(const injectFailure of [false,true]){
 let annCalls=0,hashCalls=0,errors=0;
 const saved=ITEM_TASKS.map(def=>({def,annotation:def.annotationFor,hash:def.hash}));
 for(const s of saved){s.def.annotationFor=item=>{annCalls++;if(injectFailure&&s.def.key==='claim-support'&&item===items[1])throw Error('injected annotation failure');return s.annotation(item)};s.def.hash=ann=>{hashCalls++;return s.hash(ann)}}
 try {const begin=performance.now(),out=runBlock(pairs,[],taskByKey,(p,_lookup,onError)=>instrumentHashesFor(p,currentItemTask,onError),{error(){errors++}});results.push({name:injectFailure?'one failed annotation retains healthy currentness':'12001 rows actual annotation registry',pass:injectFailure?!!out&&out['claim-support|'+items[0]]!==null&&out['claim-support|'+items[1]]===null:annCalls===(original?24:6),annCalls,hashCalls,errors,pairs:pairs.length,distinct:24,hashes:out?Object.keys(out).length:null,ms:performance.now()-begin})}
 finally{for(const s of saved){s.def.annotationFor=s.annotation;s.def.hash=s.hash}}
}
const passageDb=values=>({from(){return {select(){return this},in:async()=>({data:values,error:null})}}});
const samePassage=await mod.loadPassageKeys(passageDb([{exam_id:'E',no:1,passage:{text:'same'}},{exam_id:'E',no:2,passage:{text:'same'}}]),['E#1','E#2']);
const changedPassage=await mod.loadPassageKeys(passageDb([{exam_id:'E',no:1,passage:{text:'same'}},{exam_id:'E',no:2,passage:{text:'edit'}},{exam_id:'E',no:3,passage:null}]),['E#1','E#2','E#3']);
results.push({name:'canonical shared identity and changed source hash; absent source remains unknown',pass:samePassage['E#1']===samePassage['E#2']&&changedPassage['E#1']!==changedPassage['E#2']&&!changedPassage['E#3']});
const dependencies=Object.fromEntries(['apps/web/src/lib/csat/map/v62/instrument-hashes.ts','apps/web/src/lib/knowledge/item-tasks.ts','apps/web/src/lib/csat/skeleton.ts'].map(f=>[f,sha(fs.readFileSync(root+'/'+f))]));
const out={dependencies,source:original?'pinned':'revised',sourceSha256:sha(source),results};fs.writeFileSync(path.join(import.meta.dirname,'local/loader-current-tool-'+(original?'original':'revised')+'-web-cwd.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out));if(!original&&results.some(r=>!r.pass))process.exitCode=1;
