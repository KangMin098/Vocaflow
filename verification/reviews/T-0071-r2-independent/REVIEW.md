<!-- verification/reviews/T-0071-r2-independent/REVIEW.md -->
# T-0071 rev1 R2 independent code acceptance

**HEAD f9d66f487072b56a64d76ebe70fb668920a8576e · ACCEPT_WITH_LIMITS (코드 범위).**

T0071-P1-1 **VERIFIED_FIXED**. 이전 R1 최초 실패는 그대로 보존한다. viewer/TASK/납품 id 집합으로 조회 범위를 나누고 원본 노트만 저장한다. 렌더 시 최신 납품으로 다시 결속·자격을 계산하므로 철회/미확인 링크가 남지 않는다. viewer는 중심·보조 카드 모두 기존 WorkspaceModal에서 전달한다. 요청 순번·범위 검사를 통해 이전 응답이 새 범위를 덮지 않는다. API/SQL/기기 저장·채점/G2/PLAN 계약 변경 없음.

독립 실행: 관련 단위·SSR **15/15, skip0**, 실제 React+Chromium 컴포넌트 **11/11, skip0**. 접힘 GET0/펼침 GET1/PUT0와 같은 범위 재열기, 철회·현재 미확인 읽기 전용, 납품 목록 error/not_installed/loading, 같은 TASK의 viewer+납품 교체, viewer만 교체, 지연 응답 역순 도착, TASK 재마운트, 동등한 rows 배열 참조 변경을 확인했다. viewer만 바뀌면 새 범위를 한 번 읽고, 자격/동등 배열만 바뀌면 불필요하게 재조회하지 않는다. 브라우저 서버와 Chromium은 종료했다. 작성자 E02 SHA `05112e78679a15892ab95c5ede6bdb943907d63cd1de35727ae060d687b0f3f9` 일치. 작성자 전체 csat2696·타입·lint 증거는 재사용하며 독립 전량 재실행으로 주장하지 않는다.

이 컴포넌트 검증은 실제 React·Chromium과 **합성 GET·viewer 전환/next-link shim**을 사용한다. 인증 Next+격리DB 종단이나 실제1440/1280 전체 화면 수용을 대신하지 않는다. 그 범위는 **NOT_VERIFIED**, 공식 작업은 **REVIEW 유지**다. task COMPLETED/LOCAL_INTEGRATED/제품 병합/FINAL_COMPLETE를 선언하지 않는다. 개발 DB 쓰기0, 제품 소스 수정0, 타인 audit2파일 보존.

**다음 실행:** 기존 final-product 세션·worktree·브랜치에서 **T0070+T0071 한 번의 공식 통합 묶음**을 제출한다. T0070의 7c8eefe21 정본 E02와 코드 수용은 재사용한다(해당 코드 diff0 확인). 실제 테스트할 묶음 HEAD를 기준으로 기존 goal-plan-summary A1440/B1280 및 map-return-recap의 노트 재조회·학습 재진입·같은 Workspace 복귀를 실행하고 per-task 인증·UI 증거를 반환한다. 원장·목표·PLAN·첫 독립 근거 불변도 포함한다. 공식 통합 CI·safe-merge는 기존 경로를 유지하며 공유 dev dispatch/DB 적용/Gold·권리 승인은 하지 않는다. 상세 합성 경계 반례는 LOCAL_ONLY다.

```json
{
  "task_id":"T-0071",
  "design_revision":"rev1",
  "head":"f9d66f487072b56a64d76ebe70fb668920a8576e",
  "verdict":"APPROVE",
  "decision":"ACCEPT_WITH_LIMITS",
  "acceptance_scope":"CODE_VERIFIED_ONLY; not whole task completion",
  "findings":[],
  "resolved":["T0071-P1-1"],
  "ran_tests":true,
  "verification":{"unit_ssr":{"passed":15,"failed":0,"skipped":0},"component_chromium":{"passed":11,"failed":0,"skipped":0,"authenticated_next_db":false,"full_visual_acceptance":false},"author_e02_hash":"MATCH","authenticated_browser":"NOT_VERIFIED","actual_screen_1440_1280":"NOT_VERIFIED","db_writes":0,"reviewer_product_changes":0},
  "formal_status":"REVIEW",
  "local_integrated":false,
  "official_merged":false,
  "provenance":{"contract":"local-roles/1","task_id":"T-0071","head":"f9d66f487072b56a64d76ebe70fb668920a8576e","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","process_id":31380,"session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"}
}
```
