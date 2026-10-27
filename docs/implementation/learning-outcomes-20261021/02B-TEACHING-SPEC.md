<!-- docs/implementation/learning-outcomes-20261021/02B-TEACHING-SPEC.md -->
# 2B — 실제 자기 설명을 남기는 교수 활동과 다음 계획

2026-10-21 확정 · 기준 HEAD `e2918fd4b`. 2A 실제 결과를 반영해 한 TASK `r.central_meaning`의 기존 소프트웨어 경로를 완성한다. CSAT 경로 성공을 중등 일반 독해 R0 출시로 부르지 않는다. 사람 검수·교사·채점 역할은 Claude/Codex로 수행한다.

교수 자료는 runtime/source-lesson-v3.json의 정확한 바이트(SHA 0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0)를 사용한다. 실제 원천 content SHA와 1B 검토된 문항 묶음에만 결속하고 다른 지문에 일괄 적용하지 않는다. 독립 Claude a4b83165-d00f-4b98-a168-f5aab27de56e가 수락했다. 이 원천 파생 자료를 authored로 등록하지 않는다.

실제 AI 비교 24회에서는 두 조건 모두 전이 과제 만점으로 교수 우위 판정이 불가했다. 시범 제공은 확인했으나 시범과 자기 답의 명시적 비교 응답을 수집하지 않았다는 실행 한계를 발견했다. 이번 화면은 비교 설명을 직접 작성·저장하게 한다. 그 변경을 이미 효과 검증됐다고 말하지 않는다.

필수 구현:

1. 기존 납품 열기/목록/실제 grade/영수증을 사용해 한 원천의 요지→제목→주제 3단계를 연결한다. 문항 3개는 독립 지문 3개가 아니다. 같은 source/run/order의 승인·납품·현재 상태가 확인된 자료만 묶는다. 타인 자료/다른 주문/철회된 자료를 섞지 않는다.
2. 1차 답변 전에는 내용 중립 전략만 제공한다. 요지 답변이 실제 저장된 후 시범을 보여준다. 자기 답과 시범의 비교 설명, 주장·근거·관계의 직접 응답을 저장한다. 2차는 cue, 3차는 새 cue 없이 자신의 절차를 작성한다. 저장 확인 없이 다음 단계로 진행하지 않는다. 같은 내용 재시도는 같은 mutation key; 다른 내용은 새 키; 잘못된200은 완료가 아니다.
3. formative 피드백은 단계별 충분 근거 집합과 대체 주장(6/7)을 사용한다. 제목에는 route 근거3/4/8, 주제에는 [1,5]/[1,2]/[2,5]를 수락한다(내부0-based). 키워드가 없다는 이유로 자유 설명을 오답으로 만들지 않는다. 오프리스트 타당 가능성은 보류·검토로 표시한다. 선택 정오와 설명의 완성 여부를 분리한다. 안내 연습 기록은 항상 evidence=false이며 G2/실력 향상으로 승격하지 않는다.
4. 기존 authored 공급/Runner에서 검토된 미노출 독립 자료로 이동하고 실제 기존 채점·learning_task_attempts/G2 결속을 사용한다. 결과 후 load/composeV4→asIsMap→planWorkspaces/repairGate→nextActionOf를 거쳐 기존 계획 저장 UI/API/commitPlan로 현재 goal/plan 기대 버전에 `check_result` 재계획을 저장한다. 새 임계값·별도 목표 표·가짜 완료 링크는 금지한다. 이미 존재하는 실제 UI/서버 경로가 충분하면 재사용하고 종단 시험으로 확인한다.
5. 격리 Postgres에서 실제 승인된 5개 평가 자료 중 미노출2개를 공급·시도·결속하고, 실제 계산과 learner_workspace_plan_commit으로 새 계획 버전이 저장되는 것을 검증한다. 실 DB에 AI 계정/결과를 넣지 않는다. source guided 기록이 독립 평가 근거에 포함되지 않음을 단언한다. 실수/도움/노출/철회/새 goal/동시 plan 변경/응답 유실 반례.
6. 기존 3B 컴포넌트·셸·실제CSS, PC1440만. 공개 진입/핵심 상호작용 이벤트는 닫힌속성만. 반환은 같은 Workspace. `FactoryDcpCard`도 응답 모양을 닫아서 확인한다(현재 sources Number||0/rows cast는 미상을0으로 바꿀 수 있다).

새 저장이 필요하면 기존 pending learning SQL을 수정하거나 별도 pending overlay로 작성하고 실제 결합 설치 순서를 검증한다. 기존 학습 기록 표로 충분하면 우선 재사용한다. 새 append-only 원장에는 writer guard/RLS/default service_role revoke를 포함한다. 새 AI 판단은 에이전트가 직접 수행하며 API 키/사람을 기다리지 않는다.

검증: 좁은 기능·SQL 회귀, 타입/lint, 실제 컴포넌트 브라우저로 시범 타이밍/비교설명/도움축소/저장실패복구/신규평가이동 확인, 캡처직접확인. 대역·PGlite 한계/실로그인 NOT_RUN을 명시한다. docs/LEARNING_MODEL,MODULES,DB_SCHEMA,ROUTES,CHANGELOG,로드맵·결과 동반. 미적용 SQL은 사용자 승인 뒤 적용한다.
