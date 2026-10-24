<!-- docs/implementation/learning-outcomes-20261021/01A-CODEX-REVIEW.md -->
# 단계 1A Codex 독립 검토

2026-10-21 · 판정 **ACCEPT(1A 범위 한정, R1 보완 후)**. 작업 기준 main `c2af9ad71f906c661640a65ced3eb828368c449c`와 이번 신규 API·서비스/시험. 구현 세션 `dfe8165d-6172-40f0-baa8-89ddff8bae29`, 보완 세션 `7ddb5d3f-a56e-4901-9b5a-dce66233116d` 모두 정상 종료를 확인했다. 검토·독립 실행은 Codex가 직접 했다.

## 목적·코드 검토

최초 일반 독해 목표 시스템 초안은 공장 주문·생산·납품 연결을 제외하고 검증되지 않은 정답률 처방을 추가해 반려했다. 최종 1A는 저장 수요의 canonical/서명·소유·최신 목표/계획을 서버에서 검증하고 기존 공장의 실제 설계/봉인 함수를 호출한다. 권한 가드 이전 서비스 클라이언트를 만들지 않으며 조회만 한다. 대응 후보를 validated로 승격하지 않고 초안·등록·생산·납품을 구분한다.

**R1(P2), 해결:** `route-callers.test.ts`에서 새 factory-order-draft와 기존 product-order-lineage의 호출부 누락을 확인했다(5개 중 1실패). 새 운영 CLI의 초안 계산·계보 조회 기능으로 실제 HTTP 호출부를 제공한 뒤 Codex가 5/5 통과를 재확인했다. EXTERNAL 면제나 스캐너를 바꾸지 않았다. 보완 계약은 `01A-CALLER-REPAIR-SPEC.md`다. CLI는 관리자 Cookie를 env에서만 받고 http loopback·redirect 거부·새 출력만 생성하며, 쓰기 작업은 제공하지 않는다. 첫 줄 경로 주석도 확인했다.

## 직접 실행한 검증

| 검증 | 결과 | 원시 근거(저장소 외부 runtime) |
|---|---|---|
| 신규 API/서비스 + 기존 공장 연결·납품·평가 경계 웹 회귀 8파일 | 205 PASS, 0 FAIL | `D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/web-final-regression.log` |
| 실제 공장 product-planning package 회귀 | 5 PASS, 0 FAIL | 같은 runtime의 `package-regression.log` |
| Codex 별도 실행 스크립트 | 6 PASS, 0 FAIL | 같은 runtime의 `independent-probe.mts` · `independent-probe.log` |
| 실제 운영 CLI 보안·두 API 배선 | 9 PASS, 0 FAIL/SKIP | 같은 runtime의 `cli-final-tests.log` |
| 전역 API 호출부 회귀(보완 뒤) | 5 PASS, 0 FAIL | 같은 runtime의 `route-callers-final.log` |
| TypeScript·신규 5파일 ESLint | PASS | Claude 도구 원기록의 실제 exit 0를 확인; 결과 문서의 명령과 일치 |
| 실제 DB 카탈로그/열·수요 역할 집계 | 읽기 전용 조회 성공 | Supabase execute_sql 직접 결과. 코드 reader의 실DB 실행으로 대신 세지 않음 |

독립 6사례: 실제 planner 초안 정상 생성, user를 바꾸고 서명까지 재계산한 canonical 거절, 최신 계획이 바뀐 수요 거절, transfer를 guided 생산으로 낮추지 않음, 중심 의미 수요에 어휘 제품 거절, 현재 계획 원장 조회 오류를 빈 수요로 보지 않음. 교재공장 함수는 실제 코드이며 DB reader만 합성 읽기 대역이다. 원본/변조 양쪽을 확인했다.

Claude 제출 시 권한 설정 때문에 미실행이었던 package 회귀는 Codex가 실제로 실행해 통과했고, 웹 회귀 원시 로그도 직접 다시 보존했다. 이것은 사용자 승인이나 데이터 보호 게이트를 우회한 실행이 아니며 일반 로컬 읽기/시험만 수행했다.

## 범위와 다음 단계

- DB 쓰기·migration·계보 등록·공유 DB 시험·생산·발행·납품·원격 push/merge/배포는 수행하지 않았다.
- 브라우저 E2E 및 전체 단계 1은 아직 미실행이다. 205/5/6의 통과를 이를 대신하는 근거로 쓰지 않는다.
- 실제 DB 테이블·열 존재를 확인했지만 새 API를 실제 관리자 세션으로 HTTP 호출한 것은 아니다.
- 다음 1B는 실제 정책 근거·소량 생산과 manifest 연결, AI 교수 대응 검수다. [AI 역할 계약](./AI-VALIDATION-ROLES.md)을 따르며 사람 검수 대기는 추가하지 않는다.
