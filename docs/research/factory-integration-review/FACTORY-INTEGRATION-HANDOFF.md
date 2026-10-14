# PR264 — Claude Code 최소 수정 인수인계

2026-10-15. 최초 검토 HEAD 8b4289f8196be3c7e81ab6393f60eee46d243e88, 당시 main 70776bb0c5230a04fdac96068fa7c326efc62cd9. PR264는 이미 MERGED였다. 원본은 수정하지 않았다. 이 문서는 후속 contract repair 수용 조건이며 공장 내부/생산API/7실행기/채점RPC/DB 적용 지시가 아니다.

## 먼저 고칠 최소 코드

1. factory-integration.ts의 validateManifest: 전체 enum/ID/수량·단위/state별artifact/failure/provenance/run/role 충돌 검사. bindToWorkspace: valid usable 상태·failure 없음·nonmock·정확한 revision/hash verdict만 후보 계산. 중복은 거절하거나 명시 dedupe, 다중revision은 정책 전 HOLD.
2. requestBody: undefined 속성 문자열을 만들지 말고 requestId를 실제 생략한 표준 canonical JSON을 만든다. persist-contract.ts canonicalDemand의 requires를 고정 순서/공유canonical로 직렬화한다. support/교육목적/원천 조건 변경의 수요 revision/멱등 규칙도 명시한다. 같은 키·다른 본문을 거절하는 현재 보호는 유지한다.
3. qualifyArtifact의 FQ/approval boolean 경계와 existingAssetManifest의 SupplyLine available 경계를 아래 Trusted Qualification Context로 보강한다. factory manifest는 승인 기록이 아니다. 기존 자산의 revision=released를 실제 current revision/hash로 대체하고 legacy 승인 reader의 결과를 보존한다.
4. bindToWorkspace의 fulfillment 계산: 생산/검수/실행/공통 후보/학생 공급 가능/실제delivery를 각각 분리한다. fake delivered 배열은 DB납품 근거가 아니며 평가역할 assessment:null로 후보 수와 충족도가 충돌하는 현상을 고친다.
5. qualification.ts의 source_analysis D 기준을 FQ11과 맞춘다. 비지도 원문 열람을 별도 역할로 인정할 경우 D not_applicable의 근거/범위를 명시하며 D fail을 통과로 바꾸지 않는다.

[결함별 최소 제안](FACTORY-INTEGRATION-FINDINGS.md)의 I01–I11과 [82개 fixture](data/counterexamples.json)를 후속 revision에서 재실행한다. 원본19개는 계속 통과해야 한다. 이번 진단79개 첫 초안은 private local에, 확장82개는 공개 synthetic 원장에 별도로 보존했다.

## Trusted Qualification Context

신뢰 경계는 서버가 인증·원장·현재 자산을 읽은 단계다. 클라이언트/공장이 채운 verified:true, 권한 문자열, runId, approval ID 하나가 신뢰를 만들지 않는다. 순수 검사가 서명·DB권한·actor 진정성을 대신하지 않는다.

| 서버 내부 context | 결속·차단 조건 |
|---|---|
| authenticated principal / target | userId·Workspace ID·goal/PLAN revision·TASK·role·requestId·canonical body digest. 다른 사용자/이전 PLAN이면 공급 보류 |
| artifact subject | id·kind·current revision·hash·contentType·원래 lifecycle. test_fixture→product는 정확한 revision의 실제 전환 승인 필요 |
| provenance | REAL: 실제 execution/order event의 request/run/artifact/revision/hash. EXISTING: 실제 registry 존재·공개/권리·보류 없음·current revision. MOCK은 수량0 |
| qualification | qualification ID·rules version·review method·evidence IDs·A–H 각 상태와 이유·review subject digest·TASK·role. 같은태그/정답키만으로 C/E pass 금지 |
| source / analysis / Gold | source ID/revision/hash·생성 당시 결속·analysis revision/hash·Gold revision/hash·policy version. 해당 역할의 NA는 명시된 근거, null을 pass로 바꾸지 않음 |
| approval records | approval ID·qualification ID/subject digest·권한 있는 실제 actor·scope(public/assessment/역할/대상)·유효 시각·철회 상태. boolean은 이 검증의 파생 결과 |
| runner/scorer | 실제 type/version/role 입력·채점·노출 지원. vocab/grammar 후보를17독해 유형에 fallback하지 않음 |
| learner delivery gate | 공급 시점 user/artifact snapshot·같은 문항/공유지문/정규화 본문·원문/힌트/해설·회차 응시 노출·독립 첫 응답·transfer 다른 본문·delayed 실제경과. unknown은 평가역할 공급 보류 |
| delivery / reuse / return | 원자적 supply claim·동일 request/학생 중복 방지·실제 delivery row/ref/time·같은 Workspace/PLAN/TASK 복귀. 공통 artifact 재사용과 사용자별 기록을 분리 |

콘텐츠 공통 자격과 learner G를 섞지 않는다. qualifyArtifact의 공통 accept가 있어도 G가 아직 check_at_delivery면 learnerSuppliableCount는 unknown이지 이미 납품된 수가 아니다. producedCount, reviewPassedCount, runnableCount, commonQualifiedCandidateCount, learnerSuppliableCount, deliveredCount를 별도로 보존하고 범위가 불명확한 count를 다른 단계로 복사하지 않는다. 기존유효 R5는 새 AI 검토 부재 때문에 폐기하지 않되 실제 release/원천/current revision/TASK/role/학습자 미노출 결속을 재사용한다.

## 외부 호환성

[요청 Schema](data/request.schema.json)·[응답 Schema](data/manifest.schema.json)·[표준 JSON 예시](data/wire-examples.json)는 review 제안이다. 예시 requestId는 requestId를 생략하는 수정 canonical 방식을 사용했으며 원본 requestBody와 다르다. mock/test_fixture 예시에는 실제 공장 실행·제품 승인을 부여하지 않는다. Shape Schema만으로 state전이·교차run·승인·권리·학생노출을 검증할 수 없으므로 수용 guard와 trusted context가 별도로 필요하다.

source 요구, 교육 목적, 지원TASK, quantity와요청role 변경은 안정적으로 새 revision을 만들거나 같은키/다른본문을 거절해야 한다. identical samebody는 재사용한다. 현재 교육목표/지원TASK의 일부는 수요 서명에 빠져 있어 거절 경계는 동작하지만 어떤 변경을 새 수요로 취급할지 설계 확인이 남는다. 현재 표준JSON parse 실패 때문에 외부API 호환성을 PASS로 승인하지 않는다.

## 별도 승인·별도 공장 개발

이번 최소 pure 계약·시험·문서 수정은 생산/DB 승인이 아니다. 실제 생산 API·권 단위 입출구·활동 생산 단위·manifest 실제 export는 공장팀 별도 개발이다. DB/RLS/migration/원장 적용과 실제 권리·출시·test_fixture 전환은 해당 승인 절차가 필요하다. 사용자에게 mock 권을 승인된 교육 상품으로 보고하지 않는다. 현재 실제 자격/학생효과는 미확정이다.

## 재현

Node20+와 저장소의 설치된 Vitest1.6.x를 사용한다. 독립 worktree에 node_modules가 없으면 VF_REVIEW_DEP_ROOT에 같은 lockfile로 설치된 저장소 경로를 지정한다. 새 tests는 연구 경로에만 있다.

~~~powershell
$env:VF_REVIEW_DEP_ROOT='D:/workspace/Vocaflow'
node scripts/research/factory-integration-review/run-review.mjs
node scripts/research/factory-integration-review/check.mjs
node scripts/research/factory-integration-review/run-review.mjs --acceptance
~~~

첫 명령은 original19와 diagnostic82 실행 통과를 확인한다. 마지막 --acceptance는 현재40개 기대조건 실패 때문에 **의도적으로 exit1/contract FAIL**이며 연구 테스트의 실패를 숨기지 않는다. 후속 original code를 이 worktree에 덮지 말고 새 검토 revision/first ledger를 만든다. main 자동 병합이나 원본 수정은 이번 작업에 없다.
