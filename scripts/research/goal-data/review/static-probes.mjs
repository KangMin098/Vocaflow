// scripts/research/goal-data/review/static-probes.mjs
// Run the HEAD implementation in memory; aliases are supplied from the same HEAD source.
import fs from 'node:fs'
import vm from 'node:vm'
import {stripTypeScriptTypes} from 'node:module'
import {execFileSync} from 'node:child_process'
const compile=(p,deps={})=>{let js=stripTypeScriptTypes(fs.readFileSync(p,'utf8'),{mode:'transform'});const names=[...js.matchAll(/export (?:function|const) (\w+)/g)].map(x=>x[1]);js=js.replace(/^import \{([^}]+)\} from ['"]([^'"]+)['"];?$/gm,(_,names,key)=>`const {${names}} = deps[${JSON.stringify(key)}];`).replace(/export (?=function|const)/g,'');const result={};vm.runInNewContext(js+'\nObject.assign(result,{'+names.join(',')+'})',{result,deps,Date,Map,Set});return result}
const exposure=compile('apps/web/src/lib/csat/map/v62/assessment-exposure.ts')
const effects=compile('apps/web/src/lib/knowledge/effect-signals.ts',{'@/lib/csat/map/v62/assessment-exposure':exposure})
const skill=compile('apps/web/src/lib/csat/map/skill-diagnosis.ts',{'../../knowledge/effect-signals':effects})
const targets=['a','b','c','d'].map(itemRef=>({itemRef,taskKey:'test'}))
const attempt=(itemRef,i,isCorrect,extra={})=>({itemRef,taskKey:'test',userId:'probe',activity:'theater',phase:'practice',sessionId:'session',contentHash:'bound',expectedContentHash:'bound',synthetic:false,helpLevel:'independent',afterViewedFirst:false,afterExplanation:false,answeredAt:`2026-10-01T00:00:0${i}Z`,isCorrect,...extra})
const now=new Date('2026-10-02T00:00:00Z')
const cases={first_correct:targets.map((x,i)=>attempt(x.itemRef,i,true)),same_day:[false,false,true,true].map((x,i)=>attempt(targets[i].itemRef,i,x)),synthetic:[false,false,true,true].map((x,i)=>attempt(targets[i].itemRef,i,x,{synthetic:true})),practice:[false,false,true,true].map((x,i)=>attempt(targets[i].itemRef,i,x,{activity:'practice'}))}
const results=Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,skill.skillDiagnosis(targets,v,now)]))
const data=compile('apps/web/src/lib/csat/map/v4/definition.data.ts').V4_DATA
const refs={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),d4:execFileSync('git',['rev-parse','1b8f089e5'],{encoding:'utf8'}).trim(),goal_plan:execFileSync('git',['rev-parse','feat/goal-plan'],{encoding:'utf8'}).trim()}
const out={refs,results,criteria:data.tasks.filter(x=>x.status!=='hold').map(x=>({id:x.id,display:x.display,criterion:x.criterion,keys:data.templates.filter(w=>!w.hold&&w.core.length===1&&w.core[0]===x.id).flatMap(w=>w.content_keys)}))}
fs.writeFileSync('docs/research/goal-data-batches/review/static-probes.json',JSON.stringify(out,null,2)+'\n')
console.log(JSON.stringify(out,null,2))
