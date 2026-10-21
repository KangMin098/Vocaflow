<!-- verification/reviews/T-0070-r2-independent/REVIEW.md -->
# T-0070 rev1 code acceptance, browser pending

**HEAD `7c8eefe21f6b6cbcf8b470888a7de33b9edbe14a` · ACCEPT_WITH_LIMITS (코드 범위).**

- T0070-P1-1 VERIFIED_FIXED: 행별 `wsForTask`와 기존 `replanNeeded`를 재사용해 계획 미확정/재확정이면 직접 실행을 없애고 같은 묶음 계획 안내를 표시한다. 정상 최신 저장 계획의 실행 링크·복귀 문맥은 유지한다.
- T0070-P1-2 VERIFIED_FIXED: 실제 요구와 RELEVANCE_UNKNOWN을 별도 집계·라벨로 표시하고 행은 보존한다.
- T0070-P1-3 VERIFIED_FIXED: 과거 모드를 새 요약에 전달하고 실행/계획/자료/관문 조작을 그리지 않는다. 실제 SSR 출력의 읽기 전용 대조도 확인했다.

직접 실행한 기존 독립 반례6/6·최초 반례7/7·관련 단위/SSR19/19, 모두 skip0. 같은 구현 HEAD를 확인했고 제출 E02 원본 로그 SHA `bb38d19ad6c9df2fe10423bcb18d2ea9871d7cd4e2b0d84bf2e351091006bfb6`도 일치했다. 작성자가 보고한16은 이번 독립 실행의3파일19개와 다른 집계다. 전체513파일/PGlite44/타입/lint는 작성자 증거 및 변경 영향에 따라 재사용하며 독립 전량 재실행으로 주장하지 않는다. 실제 main8905f3214 이후13파일/2커밋이며 이번 수정은 그중6파일/1커밋이다. DB/SQL/정본/채점/G2/권한 경계 변경 없음. 타인 audit2파일은 보존했다.

**공식 작업은 REVIEW 유지.** 수용 기준4의 실제 인증 격리 A/B·1440/1280 UI와 화면 검증은 NOT_VERIFIED다. 단위/SSR은 그 증거를 대신하지 않는다. 따라서 이 보고서는 task COMPLETED/LOCAL_INTEGRATED/공식 제품 병합/FINAL_COMPLETE의 근거가 아니다. 남은 브라우저 증거는 다음 공식 통합 묶음에서 기존 격리 경로로 실행한다. 개별 작업PR/CI·새worker·worktree·게이트를 추가하지 않는다. 코드의 P1 세 건 수정은 다시 구현할 필요 없다.

DB 적용 A, 사람 Gold B/B2, 권리 C 및 실제 학습 효과는 별도 미확인 경계를 유지한다. 현재 제한을 숨기거나 완료를 위해 UI/인증 검증을 생략하지 않는다. 이전 실패와 REWORK 보고서는 보존한다.

```json
{
  "task_id":"T-0070",
  "design_revision":"rev1",
  "head":"7c8eefe21f6b6cbcf8b470888a7de33b9edbe14a",
  "verdict":"APPROVE",
  "decision":"ACCEPT_WITH_LIMITS",
  "acceptance_scope":"CODE_VERIFIED_ONLY; not whole task completion",
  "findings":[],
  "resolved":["T0070-P1-1","T0070-P1-2","T0070-P1-3"],
  "ran_tests":true,
  "verification":{"prior_findings":{"passed":6,"failed":0,"skipped":0},"original_counterexamples":{"passed":7,"failed":0,"skipped":0},"related_unit_ssr":{"passed":19,"failed":0,"skipped":0},"evidence_hash":"MATCH","authenticated_browser":"NOT_VERIFIED","actual_screen_1440_1280":"NOT_VERIFIED","ui_evidence":"NOT_SUBMITTED","full_suite":"author evidence only; not independently rerun","db_writes":0},
  "formal_status":"REVIEW",
  "local_integrated":false,
  "official_merged":false,
  "provenance":{"contract":"local-roles/1","task_id":"T-0070","head":"7c8eefe21f6b6cbcf8b470888a7de33b9edbe14a","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","process_id":31380,"session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"}
}
```
