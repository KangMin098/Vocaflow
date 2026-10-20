// agents/scripts/__tests__/workflow-budget.test.mjs
// 원격 실행 없이 중복 트리거·취소 범위와 필수 체크 보존을 검사한다.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {format} from 'prettier'
const read=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url),'utf8').replace(/\r\n/g,'\n')
const workflows=['ci','sync-check'].map(name=>({name,source:read(`.github/workflows/${name}.yml`)}))

function block(source,key,indent=0) {
  const lines=source.split('\n'),prefix=' '.repeat(indent)+key+':'
  const start=lines.findIndex(line=>line.trimEnd()===prefix)
  if(start<0)return null
  const result=[]
  for(const line of lines.slice(start+1)) {
    if(!line.trim()||line.trimStart().startsWith('#'))continue
    if(line.length-line.trimStart().length<=indent)break
    result.push(line)
  }
  return result.join('\n').trim()
}

test('CI YAML의 문법이 유효하며 모든 base의 PR이 필수 검사에 진입한다',async()=>{
  for(const {name,source}of workflows){
    await assert.doesNotReject(()=>format(source,{parser:'yaml'}),name)
    const on=block(source,'on');assert.ok(on!==null,name)
    assert.equal(block(source,'pull_request',2),'',name+' PR에 branch/path 필터를 추가하지 않는다')
    assert.doesNotMatch(on,/paths(?:-ignore)?:/,name)
  }
})

test('작업 브랜치 push 중복은 제거하고 main push 검증은 유지한다',()=>{
  for(const{name,source}of workflows){
    const push=block(source,'push',2)
    assert.ok(push,name)
    assert.match(push,/^branches:\s*\[(?:'main'|main)\]$/,name)
  }
})

test('실행 그룹은 PR/브랜치별이며 main의 공유 DB 검사는 자동 취소하지 않는다',()=>{
  for(const{name,source}of workflows){
    const concurrency=block(source,'concurrency')
    assert.match(concurrency,/github\.event\.pull_request\.number\s*\|\|\s*github\.ref/,name)
    assert.match(concurrency,/cancel-in-progress:\s*\$\{\{ github\.event_name == 'pull_request' \}\}/,name)
  }
})

test('GitHub 토큰은 읽기 권한이고 기존 8개 필수 체크 이름은 모두 남는다',()=>{
  const policy=JSON.parse(read('agents/policies/pr-automation.json'))
  const names=new Set()
  for(const{name,source}of workflows){
    assert.equal(block(source,'permissions'),'contents: read',name)
    const jobs=source.slice(source.indexOf('\njobs:')+1)
    for(const match of jobs.matchAll(/^  ([\w-]+):\n(?:    name: ([^\n]+)\n)?/gm))names.add(match[2]??match[1])
  }
  assert.equal(policy.required_checks.length,8)
  for(const check of policy.required_checks)assert.ok(names.has(check),'필수 체크 누락: '+check)
})

test('정기 무결성 감사·배포와 격리 E2E 실행은 삭제하지 않는다',()=>{
  assert.match(read('.github/workflows/csat-source-audit.yml'),/cron: '20 19 \* \* \*'/)
  assert.ok(block(read('.github/workflows/deploy.yml'),'push',2))
  const ci=workflows.find(w=>w.name==='ci').source
  assert.match(ci,/playwright test -c playwright\.isolated\.config\.ts/)
  assert.match(ci,/e2e-shared-dev:\n\s+if: github\.event_name != 'pull_request'/)
})
