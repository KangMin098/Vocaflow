# Factory Integration v1.2 — 최종 독립 수용 검증

2026-10-15. **설계 종료 판정: ACCEPT.** 사용자가 지정한 학습지도·Workspace와 교재공장 사이의 **연계 계약 설계** 범위를 완료로 판정합니다. 실제 공장 연결·권리/출시 검증·교재 생산·학생 효과 검증의 완료는 아닙니다.

검토 main: **9ca696e1da1f6af8fb1c87614bf4c05a7693ca3a**. PR266 HEAD: **7194caab58475d37ac7a7be233a9961f260f3e32**. 제품 수정/E2E 실행 HEAD: **be97543e9058c1660bcae17739daeaccdee2b968**. 시작과 종료에 최신 HEAD를 확인했고24파일의 PR/main 해시를 결속했습니다. 코드 파일과 R5 실행 스크립트는 제품 HEAD와 동일했습니다. [revision 원장](data/revision.json)을 참조합니다.

최초 검토8e705307b와 v1.1 최종 검토aa73fac39의 첫 FAIL·연구·검사기 해시는 모두 그대로 보존했습니다. 이전 실패 결과를 성공으로 덮지 않았습니다.

## 게이트와 시험 결과

| 게이트 | 판정 | 범위 |
|---|---|---|
| A 형식·안전성 | **PASS** | 두 P1 종료, 지정 회귀와 추가 변이 통과. 실제 reader/권리 검증을 대신하지 않음 |
| B 기존 기능 보존 | **PASS** | 제출된 R5 원시6건·7장·테스트 명세·코드 HEAD 대조 범위. 저장 PLAN 복귀는 별도 NOT_TESTED |
| C 실제 공장 연결 | **MOCK_ONLY / NOT_CONNECTED** | 실제 주문API·manifest 반환·활동 생산 미연결 |

| 직접 실행한 묶음 | 결과 |
|---|---:|
| A 이전 정정82 | 82/82 PASS |
| B 이전 추가46 | 46/46 PASS |
| C v1.2 추가18 | 18/18 PASS |
| D 기존 계약19·JSON/Schema7 | 19/19·7/7 PASS |
| seed 동일성 교차 검사 | 1/1 PASS |
| 독립적으로 보존한 이전46 재실행 | 46/46 기대조건 PASS |
| 추가 독립 변이·경계 검사 | 63/63 PASS, 그중61개 안전 변이 행 |

총282개 실행 검사가 통과했습니다.46개 재실행은 중복 회귀이며282를 독립 문항·학습자 수로 해석하지 않습니다. 제품 테스트의65개는 이전46+추가18+seed1입니다. 테스트 실행 성공과 각 안전 기대조건 성공을 별도로 확인했습니다. [행렬](TEST-MATRIX.md)에 분모를 기록했습니다.

## 두 P1 종료

**P1-01 lifecycle:** ArtifactSubject에 lifecycle이 포함돼 선언만 product로 바꾸면 서버 주체와 불일치합니다. LifecycleSnapshot의 current/original 상태와 정확한 artifact ID·revision·hash·scope·철회를 검사합니다. 서버 정보 없음, 선언 불일치, 전환 기록 없음, 다른 대상/revision/hash, 철회, 잘못된 범위는 후보0입니다. 정상 product와 정확한 전환 승인의 양성 대조는 후보1을 유지했습니다. 합성 양성은 실제 제품 승인 수가 아닙니다.

**P1-02 기존 자산:** 고정7개 키를 own property 및 정확한 boolean true로 검사합니다. 객체 없음·빈 객체·각 필드 누락/false/null/undefined/문자열true/상속true를 독립적으로 시험했습니다. 불완전 객체는 모두 후보0이며7개 own true만 양성 대조를 유지했습니다. 이전 실패4개도 같은 fixture로 차단됐습니다. [독립 결과](data/independent.json)와 [이전46 결과](data/adversarial.json)를 보존했습니다.

지정한 수용 범위와 추가 변이에서 신규 확정 P1/P2는0입니다. 이것은 모든 가능한 입력이나 향후 실제 API의 보안을 증명한다는 뜻이 아닙니다.

## R5 원시 증거와 PLAN 공백

제출된 results.json의6 PASS/0 FAIL/0 SKIP를 테스트 명세와 대조하고 Inspector PNG7장을 직접 확인했습니다. R5의2022-20 공급, 첫 계정 응답 후2025-20 선택, 둘째 계정의2022-20 미노출 선택, V2/S5의 unsupported, L1 보류, no_workspace 상태의 learn_now 기록이 서로 일치했습니다. 합성 계정2개 생성 후 남은 계정0이라는 정리 기록도 확인했습니다. 이번 검토에서 브라우저를 재실행하거나 계정·DB 데이터를 만들지는 않았습니다.

동일 TASK는 view()로 Inspector를 다시 열어 확인했습니다. 저장된 PLAN 버전이 없는 계정이므로 **저장 PLAN 버전으로의 실제 복귀는 NOT_TESTED**입니다. 기존 설계 계약의 returnTo는 요청 PLAN/TASK를 전달하는 순수 결속이며 별도 검사에서 유지됐습니다. 사용자 확정 범위가 설계이고 B/C DB 적용·실제 납품은 범위 밖이므로 이 실제 복귀 공백은 이번 종료의 필수 실패 조건으로 보지 않습니다. 후속 저장 PLAN/납품 연동 E2E에 명시적으로 이관합니다. [R5 상세 검토](R5-EVIDENCE-REVIEW.md)를 참조합니다.

Gate B PASS는 기록된 기존 경로 보존 범위입니다. 모든 RLS/학습자 데이터 접근·복귀 버튼·현재 DB 정리를 전수 검증했다는 뜻이 아닙니다. HEAD는 실행 스크립트의 checkout 기록과tracked0, 동일 코드 blob으로 대조했으며 별도의 서버 런타임 attestation은 아닙니다.

## 실제 구현 경계와 종료

TrustedQualificationContext 생성자는 브랜드를 붙일 뿐 실제 승인·actor 권한·현재 자산·lifecycle 등록부·원문/Gold·실행 원장을 조회하지 않습니다. 제품 reader와 호출부는0입니다. 실제 reader는 **BLOCKED_NOT_IMPLEMENTED**인 후속 제품 연동 과제입니다. 이번 범위에서는 입력된 신뢰 문맥의 결속·차단 계약을 수용하며 reader 완료를 요구하지 않습니다.

콘텐츠 공통 후보와 학습자 G는 분리됩니다. learnerSuppliableCount 및 실제 납품 수는 원장을 읽지 않으면null이고 공급 시점 check_at_delivery가 남습니다. 테스트 교재는 미출시 상태이며 이번에 전환 승인·생산·적재·공개를 실행하지 않았습니다.

[종료와 후속 조건](CLOSURE.md)에 DB·공장 개발·실제 승인·저장 PLAN 복귀의 후속 요건을 분리했습니다. 이번에는 그 작업을 시작하지 않습니다. 제품 코드·DB/RPC/RLS/UI·공장 내부·교재 변경0, main 병합0, 학생 효과 검증0입니다.
