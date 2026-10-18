// apps/web/scripts/final-independent/audit-runtime-coverage.mjs
// Compare frozen code/task inventory with aggregate READ ONLY DB evidence. No DB connection.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..')
const folder=path.join(root,'docs/research/final-independent-20261018')
const owner='0bd400526',baseline='c3a03d168'
const source=f=>execFileSync('git',['show',owner+':'+f],{cwd:root,encoding:'utf8'})
const metadata=JSON.parse(fs.readFileSync(path.join(folder,'task-support.json'),'utf8'))
const snapshot=JSON.parse(fs.readFileSync(path.join(folder,'task-runtime-snapshot.json'),'utf8'))
const definition='apps/web/src/lib/csat/map/v4/definition.data.ts'
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,definition))).digest('hex'),metadata.definitionSha256)
assert.equal(source(definition).replace(/\r\n/g,'\n'),execFileSync('git',['show',baseline+':'+definition],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'))
const authoredSource=source('apps/web/src/lib/knowledge/authored/tasks.ts')
const keys=Object.fromEntries([...authoredSource.matchAll(/'([a-z]\.[a-z_]+)'\s*:\s*'([a-z-]+)'/g)].map(m=>[m[1],m[2]]))
const set=JSON.parse(source('apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json'))
assert.equal(Object.keys(keys).length,1)
assert.equal(keys[set.taskId],set.taskKey)
assert.match(source('apps/web/src/lib/knowledge/authored/authored-items.ts'),/const SETS: AuthoredSet\[\] = \[R5_AUTHORED_SET\]/)
const rows=metadata.rows.map(t=>{
 const evidenceKeys=[...t.checkKeys,...(keys[t.id]?[keys[t.id]]:[])]
 const attempts=snapshot.attemptMetadata.filter(a=>evidenceKeys.includes(a.task_key))
 return {id:t.id,name:t.name,directCheckMetadata:t.directCheck,evidenceKeys,legacyMapping:t.checkKeys.length?'EXPLICIT':'UNMAPPED',authoredDraftItems:set.taskId===t.id?set.items.length:0,qualifiedRows:snapshot.qualifications.filter(x=>x.task_id===t.id).reduce((n,x)=>n+x.n,0),deliveryRows:snapshot.deliveries.filter(x=>x.task_id===t.id).reduce((n,x)=>n+x.n,0),boundEvidenceRows:snapshot.bindings.filter(x=>x.task_id===t.id&&x.evidence).reduce((n,x)=>n+x.n,0),attemptRows:attempts.reduce((n,a)=>n+a.n,0),syntheticFlaggedRows:attempts.reduce((n,a)=>n+a.synthetic_flagged,0)}
})
const artifact={scope:'Code registry + read-only aggregate metadata; not learner qualification or efficacy validation',ownerCommit:owner,baselineCommit:baseline,observedAt:snapshot.observedAt,definition:metadata.definition,rows}
fs.writeFileSync(path.join(folder,'task-runtime-coverage.json'),JSON.stringify(artifact,null,2)+'\n')
const cells=rows.map(r=>`| ${r.id} | ${r.directCheckMetadata} | ${r.evidenceKeys.join(', ')||'UNMAPPED'} | ${r.authoredDraftItems} | ${r.qualifiedRows}/${r.deliveryRows}/${r.boundEvidenceRows} | ${r.attemptRows}/${r.syntheticFlaggedRows} |`).join('\n')
const markdown=`<!-- docs/research/final-independent-20261018/TASK_RUNTIME_COVERAGE.md -->
# 전체 TASK의 현재 구현과 실제 증거 대조

기준 제품 main ${baseline}, 총괄의 커밋된 후보 ${owner}. DB 관찰 ${snapshot.observedAt}, READ ONLY. A~H나 VG/LM 정본을 새 분류로 바꾸지 않는다. 이 표는 새 로드맵/게이트가 아니라 사용자 지시의 전체 지원 TASK 범위를 확인하는 증거다.

기존 [30 TASK 메타데이터](./task-support.json)를 재사용하고 definition 원본이 후보에서도 동일함을 확인했다. [실제 DB 집계](./task-runtime-snapshot.json)와 [대조 결과](./task-runtime-coverage.json), [실행기](../../../apps/web/scripts/final-independent/audit-runtime-coverage.mjs)를 연결했다. 실제 학습자 ID/응답은 읽거나 저장하지 않았다.

| TASK | 코드 직접확인 표기 | 명시 근거 과제 키 | 창작 초안 문항 | 자격/납품/결속 근거 | 시도/그중 synthetic=true |
|---|---|---|---:|---:|---:|
${cells}

## 판독과 한계

- 현재 자격/납품/결속 근거는 전 TASK에서0이며 authored 표도 미설치다. 이 단계의 실제 공급→수행→환류 성공을 입증하는 TASK는 없다.
- 후보에서 명시적으로 추가한 창작 근거 키와 세트는 r.central_meaning 한 TASK의9문항뿐이다. 이 초안은 사람 승인/출시 완료가 아니며 FI-002~010 수정도 남아 있다. 일반 SQL의 task_id 인자가 임의 TASK를 받는다는 사실은 다른 능력의 내용·루브릭·화면·효과 검증을 뜻하지 않는다.
- 기존 과제 키와 직접 TASK의 명시 연결은 r.central_meaning/claim-support, r.relation/cohesion-link, e.evidence_location/evidence-locate, e.option_correspondence/option-restate다. 빈 칸은 UNMAPPED다. 자산 이름이 비슷하다는 이유로 다른 TASK의 직접 근거를 만들지 않았다.
- live/ready/content_needed/blocked는 정의의 메타데이터다. r.discourse_function/structure는 live 표기와 별개로 graph.ts에 independence_hold 연구 표지가 있고 직접 확인 키는 없다. r.reference의 assets에 cohesion-link가 있다고 해서 r.relation의 직접 판정을 복사하지 않는다. L/X의 blocked9개는 현재 독립 지원을 입증한 기능으로 계산하지 않는다.
- DB에는 claim-support/theater/independent125행이 있으나124행은 synthetic=true다. 남은1행은 그 플래그만으로 실제 학생·유효 독립 전이·효과 표본이라고 판정할 수 없다. evidence-locate3행과 option-restate1행은 viewed_first이며 독립 확인 근거로 세지 않는다. 단순 행 수와 미등록된 관측은 0의 적격 납품/결속을 대신하지 않는다.
- 시험 기록/목표/학습지도 자체의 구현 근거는 [A~H 통합 현황](./ACCEPTANCE.md)에서 유지한다. 이 표만으로 각 A~H 영역을 NOT_IMPLEMENTED라고 덮어쓰지 않는다. 실제 학습자의 관통 흐름·전체 지원 범위·학습 효과 완료는 아직 증명되지 않았다.
`
fs.writeFileSync(path.join(folder,'TASK_RUNTIME_COVERAGE.md'),markdown)
console.log(JSON.stringify({tasks:rows.length,tasksWithDraftAuthored:rows.filter(r=>r.authoredDraftItems>0).length,tasksWithQualifiedSupply:rows.filter(r=>r.deliveryRows>0).length,tasksWithBoundEvidence:rows.filter(r=>r.boundEvidenceRows>0).length,observedAt:snapshot.observedAt},null,2))
