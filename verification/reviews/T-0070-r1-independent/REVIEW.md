<!-- verification/reviews/T-0070-r1-independent/REVIEW.md -->
# T-0070 rev1 independent review

HEAD `ce6f16eab0f25172b9b279a04cacfb07ed6e929a` · base `8905f321440abeaac6f7cdb74b8e38b50fa5ced8` · **REWORK**.

기존 원인 수정은 수용한다: readiness 4건+무시험 직접 근거의 기존 반례가 독립 재실행7/7(skip0) 통과했다. 정본/SQL/채점·G2 변경 없이13파일/1커밋이고, 제출 unit 증거 로그 SHA `cdc5c7366d187c5c7aa41b4253503cb85356a828b282b182e2ce1823dd76caeb`가 원장과 일치한다. 전체513파일·PGlite44 재실행은 하지 않았으며 작성자 증거다. 신규 독립 반례6개는4실패/2정상이다. 제품 원본은 수정하지 않았다.

## 같은 작업 최소 반환

- **P1 T0070-P1-1 · 계획 확인 경로 불일치.** 목표·실행 링크는 있고 저장 계획이 없는 경우 `nextActionOf(...).kind=plan`이지만 `goalPlanRows(...).rows[0].action`은 바로 학습 링크다. 자료가 바뀌어 `nextActionOf(...)=plan/replan:true`인 경우도 동일하다. 새 요약의 「지금 할 수 있어요」가 기존 T0061의 계획 확정/다시 확정 행동을 우회한다. 원인=`goal-plan.ts`가 ActionRank를 그대로 실행 링크로 옮기고 저장/planDrift 조건을 읽지 않음. 최소 수정=행별 행동에도 기존 계획 존재·재확정 판정을 재사용해 같은 Workspace 계획 탭으로 연결한다. 정상 최신 계획은 현재 링크·outgoingCtx를 유지한다. 새 판정/저장/API/서버 보호 변경은 필요 없다. 재검증=계획없음, 내용/단계 drift, 정상 저장 계획, 저장 조회 오류의 직접 실행/계획 CTA 일치.
- **P1 T0070-P1-2 · 관련성 미확인을 목표 필요로 집계.** To-Be needs가 비어 있고 relevanceUnknown에1개만 있는 입력에서 ranks.needRank는 RELEVANCE_UNKNOWN1행이다. 현재 렌더는 「목표에 필요한 TASK 1개」라고 말한다. 원인=`GoalPlanSummary.tsx`가 data.rows.length 전체를 확정된 목표 학습 요구처럼 제목에 사용한다. 최소 수정=필요 TASK와 목표 관련성 확인 전 TASK의 수/라벨을 구별하거나 확정되지 않은 목록임을 정확히 표현한다. unknown 행은 지우거나 목표 관련으로 승격하지 않는다. 새 관련도·가중치·점수 생성 금지. 재검증=unknown만, 실제need+unknown 혼합, 실제need만.
- **P1 T0070-P1-3 · 과거 기준 읽기 전용 경계 누락.** UnifiedLearningMap은 `past`를 기존 GoalRecordBar/Workspace 등에 전달하지만 새 GoalPlanSummary에는 전달하지 않는다. 새 컴포넌트에는 read-only 분기가 없고 과거 계산의 ActionRank로 학습 링크와 계획/자료 조작 버튼을 렌더한다. 같은 화면이 「보기 전용·학습은 지금 기준」이라고 알리는 계약과 충돌한다. 이 항목은 코드/배선 단언으로 확인했으며 실제 브라우저 재현을 주장하지 않는다. 최소 수정=과거 요약은 조회만 허용하고 학습 행동은 기존 currentHref로 현재 기준에 돌아가도록 한다. 읽기 전용 계획 조회를 남길 수 있지만 그 조회가 과거 상태/현 상태를 혼동시키지 않아야 한다. 재검증=동일 데이터 current는 실제 CTA, past는 현재 기준 복귀와 조회만.

신규 테스트의 첫 wiring 검사에서 JSX 화살표를 `>`로 잘못 잘라낸 probe regex를 줄 단위 읽기로 고쳤다. 그 harness 실패는 제품 결함으로 세지 않았고, 최종 결과의 실패는 새 요약에 past 입력이 없는 실제 배선이다.

인증 격리 브라우저/새 화면의 실제 렌더·키보드/1280·1440은 **NOT_VERIFIED**다. 이번 REWORK는 브라우저 미실행만을 이유로 하지 않는다. 먼저 위3개를 같은rev1/작업에서 최소 수정하고 관련 검사·새HEAD로 재제출한다. 작성된 A/B는 다음 공식 통합 묶음 격리CI에서 실행할 수 있다. 별도 작업PR/CI·worker·새worktree·정본·DB변경·전량재검증을 요구하지 않는다. 실제 DB/Gold/권리/효과는 계속 별도다.

```json
{
  "task_id":"T-0070",
  "design_revision":"rev1",
  "head":"ce6f16eab0f25172b9b279a04cacfb07ed6e929a",
  "verdict":"REQUEST_CHANGES",
  "decision":"REWORK",
  "ran_tests":true,
  "findings":[
    {"id":"T0070-P1-1","severity":"P1","scope":"in","claim":"새 요약이 저장 계획 없음/재확정 필요 상태에서 직접 학습 링크를 노출","evidence":"probe.test.ts 2 cases; nextActionOf plan/replan vs row.action nonnull"},
    {"id":"T0070-P1-2","severity":"P1","scope":"in","claim":"RELEVANCE_UNKNOWN을 목표 필요 TASK 수에 포함","evidence":"probe.test.ts unknown-only actual static render"},
    {"id":"T0070-P1-3","severity":"P1","scope":"in","claim":"과거 기준 읽기 전용 모드를 새 요약에 전달/적용하지 않음","evidence":"UnifiedLearningMap wiring + GoalPlanSummary unconditional CTA; source assertion, not browser"}
  ],
  "verification":{"original_counterexamples":{"passed":7,"failed":0,"skipped":0},"new_counterexamples":{"passed":2,"failed":4,"skipped":0},"browser":"NOT_VERIFIED","author_evidence_hash":"MATCH","full_suite":"author evidence reused; not independently rerun","db_writes":0},
  "provenance":{"contract":"local-roles/1","task_id":"T-0070","head":"ce6f16eab0f25172b9b279a04cacfb07ed6e929a","implementer":"claude","reviewer":"codex","owner":"final-independent-accept","process_id":31380,"session_id":"01a14de8-2485-7a53-b530-d5612f35e57a"}
}
```
