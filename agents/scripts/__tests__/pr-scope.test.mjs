// agents/scripts/__tests__/pr-scope.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseScope, checkScope } from '../pr-scope.mjs'
const contract = {version:1,head_sha:'a'.repeat(40),base_sha:'b'.repeat(40),base_ref:'main',expected_commits:1,expected_paths:['AGENTS.md','.github/workflows/ci.yml']}
const pr = (over={}) => ({headRefOid:contract.head_sha,baseRefName:'main',baseSha:contract.base_sha,commitCount:1,files:contract.expected_paths.map(path=>({path})),...over})

test('승인 경로·HEAD·base·커밋 수가 일치하는 PR만 허용한다',()=>{
  assert.equal(checkScope(pr(),parseScope(JSON.stringify(contract))).ok,true)
})
test('24커밋160파일의 누적은 CI 성공이어도 거부한다',()=>{
  const files=[...pr().files,...Array.from({length:158},(_,i)=>({path:`apps/web/extra-${i}.tsx`}))]
  const result=checkScope(pr({commitCount:24,files}),contract)
  assert.equal(result.ok,false)
  assert.ok(result.reasons.some(reason=>reason.includes('커밋 24개')))
  assert.ok(result.reasons.some(reason=>reason.includes('범위 밖')))
})
test('파일 수가 같아도 경로 교체·누락·중복을 거부한다',()=>{
  for(const files of [[{path:'AGENTS.md'},{path:'apps/web/page.tsx'}],[{path:'AGENTS.md'}],[{path:'AGENTS.md'},{path:'AGENTS.md'}]])assert.equal(checkScope(pr({files}),contract).ok,false)
})
test('승인 뒤 HEAD·base 이동과 커밋 수 미확인을 거부한다',()=>{
  for(const over of [{headRefOid:'c'.repeat(40)},{baseSha:'c'.repeat(40)},{baseRefName:'other'},{commitCount:undefined}])assert.equal(checkScope(pr(over),contract).ok,false)
})
test('불완전한 계약과 모호한 경로를 거부한다',()=>{
  for(const over of [{head_sha:''},{base_sha:undefined},{expected_commits:0},{expected_paths:[]},{expected_paths:['AGENTS.md','AGENTS.md']},...['../x','/x','C:/x','apps/**','apps\\x','a//b'].map(path=>({expected_paths:[path]}))])assert.throws(()=>parseScope(JSON.stringify({...contract,...over})))
  assert.throws(()=>parseScope('{'))
})
test('GITHUB에서도 계약이 없으면 git·gh 호출 전에 종료한다',()=>{
  const script=fileURLToPath(new URL('../safe-merge.mjs',import.meta.url))
  const result=spawnSync(process.execPath,[script,'318','--dry-run'],{encoding:'utf8',timeout:5000,env:{...process.env,VFC_DEV_MODE:'GITHUB',PATH:'',Path:''}})
  assert.equal(result.status,3,result.stderr)
  assert.match(result.stderr,/PR_SCOPE_GUARD.*scope-file/)
  assert.doesNotMatch(result.stderr,/PR #318 를 읽|정책을 읽지/)
})
