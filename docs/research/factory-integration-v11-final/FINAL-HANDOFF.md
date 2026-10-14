# Factory Integration v1.1 최종 검증 인수인계

제품 변경 없이 독립 검증을 마쳤다. 전체 수용 FAIL. 신규 P1 두 그룹을 닫은 후 같은 범위로 재검증하면 된다. 새 공장 개발·콘텐츠 연구·실행기/RPC를 시작할 필요는 없다.

## V11-P1-01 — lifecycle 선언 변경 우회

실제 함수 qualifyArtifact에서 test_fixture + lifecycleTransitionApproved=false는 보류였다. 동일 trusted subject에 대해 artifact.lifecycle만 product로 바꾸면 accept/후보1이다. ArtifactSubject와 context에는 서버가 확인한 원래/current lifecycle이 없고, guard는 호출자가 제시한 현재 lifecycle이 test_fixture일 때만 전환 승인을 요구한다.

최소 수정은 lifecycle의 권위 있는 현재 상태와 test_fixture 원천 상태/전환 승인을 서버 registry/context에 결속하는 것이다. caller/manifest product 선언으로 guard를 건너뛰지 않아야 한다. content hash만으로 정책상 lifecycle이 자동 결속된다고 가정하지 않는다. test_fixture→product 승인 부재는 실제 server state에 기초해 판정한다. 정상 product와 승인된 정확한 전환의 양성 대조는 보존한다.

## V11-P1-02 — 빠진 필수 자격 축의 통과

existingAssetManifest는 Object.keys(q)만 검사하므로 qualification={} 또는 rights 삭제 입력을 모두true처럼 통과시킨다. available·역할일치·synthetic hash의 다른 전제는 같고 결과accept/후보1이다. all_missing과empty_object는 같은 논리 실패의 반복 대조이며 별개 결함으로 세지 않는다.

고정 목록 producible/rights/content/teaching/assessment/learner/runnable의7개를 각각 q?.[key]===true로 검사한다. 누락은 unknown/보류다. 이를 서버가 검증한 기존 R5 reader의 정상 all7true 대조와 함께 검사한다. 현재 legacy R5 화면의 supplyFor를 바꾸거나 기존 승인 자산을 새 AI 검수 부재 때문에 폐기하지 않는다.

[재현 JSON](data/new-counterexample-fixtures.json)·[자동 진단](../../../scripts/research/factory-integration-v11-final/adversarial.test.ts)은 입력·기대·실제 결과를 보존한다. 합성 승인/context는 테스트 전제이며 실제 기록이 아니다. 현재 제품 호출부/reader0이므로 운영 사고가 확인됐다는 뜻은 아니다.

## 신뢰 문맥과 연결 상태

plain JSON/boolean/브랜드 문자열은 차단됐지만 exported trustedQualificationContext는 승인 검증기가 아니라 brand를 붙이는 생성자다. 임의 JSON을 이 생성자에 넣어 권한을 얻는 서버 endpoint를 만들면 안 된다. 지금 실제 reader가 없다는 상태는 BLOCKED_NOT_IMPLEMENTED로 기록한다. 실제 auth/승인 actor·정확한subject·규칙/evidence·범위/철회·source/analysis/Gold 원장·실행 기록의 확인은 향후 서버 책임이다. symbol/type만으로 이 책임을 충족했다고 주장하지 않는다.

학습자 G와delivery는 현재null/check_at_delivery다. 실제 주문API·manifest 반환·활동 생산은 MOCK_ONLY/NOT_CONNECTED이며 GateC PASS 아님. 보류 SQL B/C는 파일 변경을 확인했으나 이번에 적용/DB상태조회/이전한 데이터는0이다. 사용자 제공 미적용 상태와 static 계약을 구별한다.

canonicalDemand v2는 v1과 다른 본문/서명이며 지원TASK·중첩순서를 결속한다. pending B가v2를 요구한다는 변경을 확인했다. 미래 실제v1 원장이 존재한다면 별도 migration/호환 정책을 마련해야 하며 이번 순수 검사로 데이터 이전을 했다고 쓰지 않는다.

## 회귀와 재현

PR265 HEAD의 verify/build/isolated e2e 성공을 GitHub에서 확인했고, 현재main 필수21파일이PR HEAD와 같았다. 기존 R5의 TaskInspector→supplyFor는 새 래퍼를 호출하지 않으며 관련 화면/라우트/supply/demand/v4 파일 변경도 없다. 문서의R5 browser6/6 주장은 별도 보존 artifact로 확인하지 못했다. PR isolated e2e는 map-goal/csat-v31이며 R5 전용6건의 대체 증거로 표현하지 않는다. 전체 GateB는 그 증거 한계 때문에 HOLD, 정적호환·기록CI는PASS다.

Node와 lockfile에 맞는 설치된 Vitest/Ajv를 사용한다. 소스는 이 전용worktree에서만 읽고 VF_REVIEW_DEP_ROOT는 설치 의존성 위치만 가리킨다.

~~~powershell
$env:VF_REVIEW_DEP_ROOT='D:/workspace/Vocaflow-map-v62'
node scripts/research/factory-integration-v11-final/run.mjs
node scripts/research/factory-integration-v11-final/compare.mjs
node scripts/research/factory-integration-v11-final/check.mjs
node scripts/research/factory-integration-v11-final/run.mjs --acceptance
~~~

진단 실행 통과와 안전성 수용을 분리한다. 현재 --acceptance는 신규 기대조건4 FAIL 때문에 exit1이다. 최초 결과를 수정하거나 원본제품코드를 이worktree에 덮지 말고 새 검토revision으로 고정한다. DB/RLS/생산/권리·출시 승인은 이 설계 검증 범위에 추가하지 않는다.
