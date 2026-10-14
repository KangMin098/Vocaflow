# 연계 계약 설계 종료와 후속 조건

**검토자 판정 ACCEPT — 사용자 지정 연계 계약 설계 범위 완료.** 이는 사용자의 법적/권리/출시 승인이나 AI-Control의 사용자 최종 수용 상태를 대신하지 않습니다.

완료 범위는 WorkspaceDemand→FactoryRequest→FactoryResultManifest→콘텐츠 공통 자격→Workspace 후보 결속의 순수 계약과 안전 차단입니다. lifecycle·고정7자격 P1은 종료됐으며 지정/추가 검사에서 신규 확정P1/P2는 없습니다. Gate B는 제출된 기존 R5 보존 증거 범위에서 수용합니다.

| 후속 항목 | 상태/필요 조건 | 이번 수행 |
|---|---|---|
| 실제 주문 API/manifest 반환/활동 생산 | MOCK_ONLY/NOT_CONNECTED. 별도 공장 입출구 개발 |0|
| auth·권한·승인/철회·자산/lifecycle/실행 원장 reader | BLOCKED_NOT_IMPLEMENTED. 서버 원장 읽기와 정확한subject/범위 확인 |0|
| B/C 및 A3/A 승인안 DB 적용 | 별도 DB 승인·SQL 영향/되돌리기·적용 검증 |0|
| 학습자 G·실제납품·중복 방지 | 공급 시점 user/source/공유지문/도움·독립성/원자적 delivery 확인 |0|
| 저장 PLAN 버전으로 실제 복귀 | NOT_TESTED. 저장 Workspace/PLAN이 설치된 후 별도 수직 E2E |0|
| 테스트 교재→교육 상품 | 정확한 콘텐츠 revision의 실제 권리·내용·역할·전환·출시 승인 |0|
| 신규 실행기/채점기 | 기존 FQR1 계약에 따른 별도 제품 과제 |0|
| 실제 콘텐츠/학생/교육 효과 | 별도 적격 자료와 수행·효과 연구 |0|

생성자의 symbol/type은 실제 신뢰 검증이 아닙니다. 서버가 검증한 입력만 전달해야 합니다. subject.lifecycle이 제공하는 호환 정보와 explicit LifecycleSnapshot 모두 서버가 확인한 정보라는 전제를 유지합니다. 실제 origin/current/전환 이력을 읽지 않은 product 문자열로 과거 테스트성을 지우지 않습니다.

저장 PLAN 복귀의 공백은 이번 설계 완료를 막지 않지만 후속 실제 납품·복귀 제품 수용 기준에서 삭제하지 않습니다. 이번에 합성 계정이나 학생·콘텐츠를 새로 만들지 않습니다. 실제 교재 생산·적재·공개를 시작하라는 지시도 아닙니다.

재현은 [검사 행렬](TEST-MATRIX.md)과 scripts/research/factory-integration-v12-final/run.mjs·check.mjs를 따릅니다. VF_REVIEW_DEP_ROOT는 lockfile에 맞는 설치 의존성 위치만 지정합니다. 소스는 검토 worktree를 사용합니다.

~~~powershell
$env:VF_REVIEW_DEP_ROOT='D:/workspace/Vocaflow-map-v62'
node scripts/research/factory-integration-v12-final/run.mjs
node scripts/research/factory-integration-v12-final/evidence-audit.mjs
node scripts/research/factory-integration-v12-final/check.mjs
~~~

문서·스크립트·독립 검토 원장을 커밋/push하고 REVIEW에 제출합니다. main 병합, 제품 코드/DB/RPC/UI/공장 내부/교재 변경은 수행하지 않습니다.
