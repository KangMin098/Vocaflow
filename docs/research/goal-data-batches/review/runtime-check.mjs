// docs/research/goal-data-batches/review/runtime-check.mjs
// 저장소 TS를 메모리에서 실행한다. 앱 파일·DB·빌드 캐시를 쓰지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
const nativeRequire=createRequire('D:/workspace/Vocaflow-main-serving/apps/web/package.json')
const ts=nativeRequire('typescript')
const cache=new Map()
function load(file) {
  file=path.resolve(file)
  if(cache.has(file)) return cache.get(file).exports
  if(file.endsWith('.json')) return JSON.parse(fs.readFileSync(file,'utf8'))
  const mod={exports:{}};cache.set(file,mod)
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText
  const req=id=> {
    if(!id.startsWith('.')&&!id.startsWith('@/')) return nativeRequire(id)
    const p=id.startsWith('@/')?path.resolve('apps/web/src',id.slice(2)):path.resolve(path.dirname(file),id)
    const f=[p,p+'.ts',p+'.json',p+'/index.ts'].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile())
    if(!f) throw Error('module unavailable: '+id)
    return load(f)
  }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file})(req,mod,mod.exports)
  return mod.exports
}
const {skillDiagnosis}=load('apps/web/src/lib/csat/map/skill-diagnosis.ts')
const targets=['a','b','c','d'].map(itemRef=>({itemRef,taskKey:'claim-support'}))
const attempt=(itemRef,isCorrect,i,extra={})=>({userId:'review-fixture',itemRef,taskKey:'claim-support',phase:'practice',isCorrect,synthetic:false,helpLevel:'independent',afterViewedFirst:false,afterExplanation:false,activity:'theater',sessionId:'review-session',contentHash:'current',expectedContentHash:'current',answeredAt:`2026-10-23T01:0${i}:00.000Z`,passageKey:'same-passage',...extra})
const now=new Date('2026-10-23T02:00:00.000Z')
const seq=[false,false,true,true].map((v,i)=>attempt(targets[i].itemRef,v,i))
const observations=[]
function check(id,actual,expected){assert.equal(actual,expected,id);observations.push({id,actual,expected,passed:true})}
check('M1-성공만4회',skillDiagnosis(targets,targets.map((t,i)=>attempt(t.itemRef,true,i)),now).status,'unverified')
check('M2-같은날같은지문역할없음2실패2성공',skillDiagnosis(targets,seq,now).status,'resolved')
check('M4-합성만',skillDiagnosis(targets,seq.map(a=>({...a,synthetic:true})),now).status,'resolved')
check('M4-연습화면만',skillDiagnosis(targets,seq.map(a=>({...a,activity:'practice'})),now).status,'unverified')
check('M4-해설후만',skillDiagnosis(targets,seq.map(a=>({...a,afterExplanation:true})),now).status,'unverified')
const {checkKeysOfTask,checkedTaskOfKey}=load('apps/web/src/lib/csat/map/v4/definition.ts')
check('M7-V4-정본키',checkKeysOfTask('v.semantic_relation').length,0)
check('M7-option-restate-중심',checkedTaskOfKey('option-restate'),'e.option_correspondence')
const {FORMAT_SPECS}=load('apps/web/src/lib/knowledge/authored/formats.ts')
const set=JSON.parse(fs.readFileSync('apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json','utf8'))
const it=set.items.find(i=>i.role==='independent_check')
const g=it.gold
const {RELATIONS}=load('apps/web/src/lib/knowledge/claim-support-labels.ts')
const raw={claim:g.claim,support:[g.claim],relation:RELATIONS.find(r=>r!==g.relationProbe.relation),choice:g.answer}
const grade=FORMAT_SPECS.central_meaning.grade(it.body,g,raw)
observations.push({id:'R5-채점범위-탐색',parsed:grade!==null,grade:grade?.grade??null,fixture:it.id})
assert.equal(grade?.grade.isCorrect,true)
assert.equal(grade?.grade.supportOk,false)
assert.equal(grade?.grade.relationOk,false)
const {AUTHORED_SETS,validateAuthoredSet}=load('apps/web/src/lib/knowledge/authored/authored-items.ts')
const items=AUTHORED_SETS.flatMap(s=>s.items)
const roles=Object.fromEntries([...new Set(items.map(i=>i.role))].map(role=>[role,items.filter(i=>i.role===role).length]))
const hashes=items.map(i=>crypto.createHash('sha256').update(i.body.sentences.join(' ').replace(/\s+/g,' ').trim().toLowerCase()).digest('hex'))
const inventory={sets:AUTHORED_SETS.length,tasks:new Set(AUTHORED_SETS.map(s=>s.taskId)).size,items:items.length,roles,duplicate_passages:hashes.length-new Set(hashes).size,validation_errors:AUTHORED_SETS.flatMap(s=>validateAuthoredSet(s).map(error=>({set:s.set,error})))}
assert.equal(inventory.sets,18);assert.equal(inventory.items,155);assert.equal(inventory.duplicate_passages,0);assert.equal(inventory.validation_errors.length,0)
fs.writeFileSync('docs/research/goal-data-batches/review/runtime-checks.json',JSON.stringify({code_sha:'80fa4454023c6b7086ac5cf4d7c12d459d26b0a0',method:'실제 저장소 TS 메모리 실행 · 고정 시각 · DB 없음',assertions_passed:14,observations,inventory},null,2)+'\n')
console.log(JSON.stringify(observations))
