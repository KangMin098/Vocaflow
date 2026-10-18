// apps/web/scripts/final-independent/audit-expansion-coverage.mjs
// Frozen candidate registry versus existing canonical TASK metadata and aggregate READ ONLY snapshot.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'../../../..'),folder=path.join(root,'docs/research/final-independent-20261018'),head='22b5e43c57b4895066fd360eb828ebbad0440569',baseline='c3a03d168'
const source=p=>execFileSync('git',['show',head+':'+p],{cwd:root,encoding:'utf8'})
const metadata=JSON.parse(fs.readFileSync(path.join(folder,'task-support.json'),'utf8')),snapshot=JSON.parse(fs.readFileSync(path.join(folder,'task-runtime-expansion-snapshot.json'),'utf8'))
assert.equal(snapshot.readOnly,'on')
const definition='apps/web/src/lib/csat/map/v4/definition.data.ts'
assert.equal(source(definition).replace(/\r\n/g,'\n'),execFileSync('git',['show',baseline+':'+definition],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'))
const keys=Object.fromEntries([...source('apps/web/src/lib/knowledge/authored/tasks.ts').matchAll(/'([a-z]\.[a-z_]+)'\s*:\s*'([a-z-]+)'/g)].map(m=>[m[1],m[2]]))
const files=execFileSync('git',['ls-tree','-r','--name-only',head,'apps/web/src/lib/knowledge/authored/'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.v1.json'))
const sets=files.map(file=>{const raw=source(file),s=JSON.parse(raw);assert.equal(keys[s.taskId],s.taskKey);return {file,sha256:crypto.createHash('sha256').update(raw).digest('hex'),taskId:s.taskId,taskKey:s.taskKey,set:s.set,format:s.format??'central_meaning',provenance:s.provenance,items:s.items.length,roles:Object.fromEntries([...new Set(s.items.map(i=>i.role))].map(role=>[role,s.items.filter(i=>i.role===role).length]))}})
assert.equal(sets.length,7);assert.equal(Object.keys(keys).length,7)
const rows=metadata.rows.map(t=>{const drafts=sets.filter(s=>s.taskId===t.id),evidenceKeys=[...t.checkKeys,...(keys[t.id]?[keys[t.id]]:[])],attempts=snapshot.attemptMetadata.filter(a=>evidenceKeys.includes(a.task_key));return {id:t.id,name:t.name,directCheckMetadata:t.directCheck,evidenceKeys,legacyMapping:t.checkKeys.length?'EXPLICIT':'UNMAPPED',authoredDraftItems:drafts.reduce((n,s)=>n+s.items,0),format:drafts.map(s=>s.format).join(', ')||'UNMAPPED',qualifiedRows:snapshot.qualifications.filter(x=>x.task_id===t.id).reduce((n,x)=>n+x.n,0),deliveryRows:snapshot.deliveries.filter(x=>x.task_id===t.id).reduce((n,x)=>n+x.n,0),boundEvidenceRows:snapshot.bindings.filter(x=>x.task_id===t.id&&x.evidence).reduce((n,x)=>n+x.n,0),attemptRows:attempts.reduce((n,a)=>n+a.n,0),syntheticFlaggedRows:attempts.reduce((n,a)=>n+a.synthetic_flagged,0)}})
const result={head,baseline,observedAt:snapshot.observedAt,scope:'Static candidate registry plus aggregate read-only DB; not human review, learner qualification, efficacy, or whole A-H E2E.',sets,rows}
fs.writeFileSync(path.join(folder,'task-expansion-coverage.json'),JSON.stringify(result,null,2)+'\n')
const lines=rows.map(r=>`| ${r.id} | ${r.directCheckMetadata} | ${r.evidenceKeys.join(', ')||'UNMAPPED'} | ${r.authoredDraftItems} | ${r.format} | ${r.qualifiedRows}/${r.deliveryRows}/${r.boundEvidenceRows} |`).join('\n')
fs.writeFileSync(path.join(folder,'TASK_EXPANSION_COVERAGE.md'),`<!-- docs/research/final-independent-20261018/TASK_EXPANSION_COVERAGE.md -->
# TASK 확장 후보와 실제 공급 증거

후보 ${head}, main ${baseline}. [기존30 TASK](./task-support.json)의 정의 바이트가 후보에서도 동일함을 확인했다. A~H를 TASK와 일대일 대응시키지 않는다. 이전 [0bd 관찰](./TASK_RUNTIME_COVERAGE.md)은 이력으로 보존한다.

[현재 READ ONLY 집계](./task-runtime-expansion-snapshot.json) 시각 ${snapshot.observedAt}: authored 표 미설치, FQ/납품/결속 근거0. [기계 대조 결과](./task-expansion-coverage.json)에 세트별 실제 SHA/작성 출처/역할 개수를 기록했다. 실제 학습자 ID나 응답은 읽거나 저장하지 않았다.

| TASK | 직접확인 메타 | 명시 근거 키 | 창작 초안 수 | 세트 형식 | 자격/납품/결속근거 |
|---|---|---|---:|---|---:|
${lines}

후보는7 TASK의45문항(R5 9 + 신규6세트 각6)이다. 신규36문항의 독립 판독/채점 대조는 [내용 검토](./EXPANSION_CONTENT_REVIEW.md)에 연결한다. 초안/AI 일치/정적 형식 레지스트리는 사람 Gold·권리·출시·실제 전이·PLAN 환류 증거가 아니다. 22b5e43c5에서 추가된4형식은 아직 세트 등록과 능력 수용을 증명하지 않는다.

나머지 비보류14 TASK는 창작 세트가 없다. L/X blocked9개도 지원 완료로 세지 않는다. 기존 legacy 직접 근거는 이름 추정으로 확장하지 않으며 UNMAPPED를 유지한다. claim-support 독립 모양125행 중124 synthetic, 나머지1행은 실제 학생/효과로 확정하지 않는다. viewed_first 4행은 독립 근거가 아니다. 전체 A~H PARTIAL/BLOCKED_EXTERNAL 및 REWORK를 유지한다.
`)
console.log(JSON.stringify({head,tasks:rows.length,authoredTasks:sets.length,items:sets.reduce((n,s)=>n+s.items,0),qualifiedTasks:rows.filter(r=>r.deliveryRows>0).length,observedAt:snapshot.observedAt},null,2))
