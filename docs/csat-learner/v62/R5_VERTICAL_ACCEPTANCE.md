# LM-G1 — R5 수직 연결 수용 계약

2026-10-15 · **향후 구현의 인수 조건**. 이번 감사의 실제 결과는 순수 함수 83/83 PASS 및 G01~G04 관찰이다. 아래 live 시나리오는 실행하지 않았으며 NOT_TESTED다. 현재 테스트 계정을 학생 효과 표본으로 삼지 않는다.

## 1. 수용할 대상

기존 R5 `r.central_meaning`와 `claim-support` 경로를 사용한다. 저장/읽기/재계산기를 새로 만들지 않는다. 같은 학생의 유효 수행이 원자 저장되고, 같은 기준 시각의 다음 요청에서 상태/NeedRank/ActionRank/Workspace/PLAN에 반영되는지 검증한다. 명시 저장 PLAN의 순서·수량·과거 버전은 새 추천과 구별해 보존한다.

수용 층위는 ① 순수 정책 ② 실제 API/DB/권한 ③ PC 화면/복귀 ④ 실제 학생 효과다. ①~③을 통과해도 ④의 증거가 생기지는 않는다. 교수 단계를 생략하고 독립 CHECK를 통과한 학생의 현행 `resolved`는 유지하며, 교수 경로 완주로 자동 해석하지 않는다.

## 2. 고정 입력과 실행 안전 범위

- 격리 환경과 실행별 소유권을 확인한 계정 A/B를 사용한다. 공유 실제 학생 기록을 수정/삭제하지 않는다. 필요한 자료가 실물로 없으면 BLOCKED이며 mock은 정책 층위에만 사용한다.
- run ID·검토 SHA·계정 가명·기준 시각·목표/PLAN 버전·source/annotation/rubric/policy 버전·item/공유지문 ID·도움/노출·phase·요청키·응답·행수 차이·제외 이유를 증거로 남긴다. 인증값/개인 응답 전문은 공개하지 않는다.
- 시각은 주입하거나 고정한다. CHECK의 유효 기간과 지연 최소 간격을 혼동하지 않는다. 지연 정책 미정이면 지연 성과는 NOT_TESTED이며 가짜 시각으로 실제 지연 효과를 주장하지 않는다.
- 실제 endpoint 테스트는 별도 승인된 실행 범위에서 한다. 현재 LM-G1 감사에는 DB/RPC 호출에 의한 쓰기·계정 생성·기존 데이터 변경을 허용하지 않았다.

## 3. 정책 및 실제 저장 시나리오

| ID | 입력/행동 | 수용 기대 | 층위·현재 증거 |
|---|---|---|---|
| R01 | 현재 적격·독립·미노출 FIND 2개 실패 | 같은 학생 R5가 현행 정책의 verified_need/REPAIR; unknown은 약점으로 복제하지 않음 | G01 순수 재계산 확인; live NOT_TESTED |
| R02 | 확인에서 막힌 항목의 실패 repair 2개 | 진행 시도량은 2로 유지; 성공 repair 근거가 없으면 해당 교수 경로 next는 repair. PLAN·Inspector·lifecycle 일치 | G02 현행 불일치 재현; 수정 필요 |
| R03 | 기존 정책의 적격 성공 repair 근거 입력 | 같은 판정 함수를 거쳐 transfer 준비. 성공 기준 강화는 별도 policy version이며 묵시 변경 금지 | 기존 lifecycle 테스트, 결합 live NOT_TESTED |
| R04 | 새 적격 지문 transfer 1개, 이후 필요한 운영량까지 수행 | progress와 충분성 구별. 현행 2개 운영량을 쓰면 서로 다른 적격 지문인지 확인; 완료 후 같은 next 정책 | full live NOT_TESTED; 자료 부족 시 BLOCKED |
| R05 | 새로운 독립 CHECK 2개(현행 규칙), 실패·도움·중복 대조군 | 적격 CHECK만 상태 갱신. 실패/도움은 독립 성공으로 처리하지 않음 | 기존 skill 테스트; full live NOT_TESTED |
| R06 | repair/transfer 없이 새 독립 CHECK 통과 | 현행 resolved는 보존. 교수 경로 완료/전이/지연 증거로 자동 승격 금지 | G03 현행 상태 재현; 별도 표시/기준 필요 |
| R07 | 성공 응답 직후 새 MAP 요청/화면 복귀 | 실제 저장된 attempt→동일 사용자 load→compose→새 상태/랭크/추천; 새 창/뒤로가기도 최신 읽기 | 연결 코드 있음; live NOT_TESTED |
| R08 | 저장 PLAN 존재 후 새 수행 기록 | 현재 상태/진행/다음 행동은 재계산; 저장된 순서/수량/주석은 무단 덮어쓰지 않음. 변경 필요는 설명하고 명시 commit | applySaved/기존 plan 테스트; live NOT_TESTED |
| R09 | 새 PLAN 저장→같은 요청키 재전송→다른 본문 재사용 | 정확 재시도는 중복 버전 없음; 다른 본문은 API 충돌. 네트워크 응답 유실 후 재시도도 같음 | plan-retry/store 순수 테스트; live NOT_TESTED |
| R10 | 이전 PLAN의 명시 복원·구 URL 복귀·목표 변경 | 복원은 append-only 새 버전, restore_of/goal 기준 추적. 구 URL은 현 계약대로 최신 상태와 변경 안내, 옛 목표 자동 되감기 금지 | return-ctx/commit 테스트; 저장 복귀 NOT_TESTED |
| R11 | A가 B의 workspace/plan/attempt 대상으로 요청 | 서버 사용자와 ownership 검증, 타인 읽기/수정 없음; authenticated 직접 쓰기 RPC 불가 | 카탈로그/RLS 확인, 공격 API NOT_TESTED |
| R12 | 인증 만료·RPC 실패·version conflict·중간 실패 | 성공으로 표시하지 않고 기존 PLAN/증거 보존; 안전 재시도, 부분 원자 기록 없음 | 기본 원자 RPC 설치/오류 코드 확인; live NOT_TESTED |
| R13 | 동일 지문 다른 item·과거 시험/해설·practice 노출 | 단순 item ID 변경으로 독립 미노출을 만들지 않음. 필요한 식별/기록 부족은 unknown/제외 | 통합 적격성 검증 부족 |
| R14 | annotation/revision/rubric/policy 변경·옛 제출 | 현재성 검증과 명시 버전 경계; 옛 기록 덮기/현행 적격 증거로 자동 승격 금지 | 전체 결속 계약 부분 완료 |
| R15 | 즉시 CHECK와 고정된 지연 조건 뒤 CHECK 비교 | 즉시 독립 성공과 지연 유지 분리. 120일 만료를 지연 충족으로 처리하지 않음 | 현행 최소 지연 없음; 지연 검증 미구현 |
| R16 | 자료 없음/hold/Factory MOCK·test_fixture·EXISTING 래퍼 | content_needed/대기, 안전 우회 없음. 기존 R5 경로는 유지하지만 새 래퍼 승인 완료로 주장하지 않음 | Factory 계약 수용 재사용; 실제 공급 NOT_CONNECTED |

## 4. 함수·저장·화면별 증거 연결

| 구간 | 기존 책임 | 다음 구현/수용에서 확인할 것 |
|---|---|---|
| 제출 | item task route→recordItemTaskAttempt, practice route→submitPractice | 사용자·자료 현재성·phase·독립/도움·요청키 검증 |
| 저장 | practice-writer 기본 atomic→learning_attempt_submit | learning_sessions/learning_task_attempts 원자 결과 inserted/duplicate/conflict; 같은 기록 1개 |
| 읽기 | loadMapPage/loadFindAttempts, learning_first_attempts + raw lifecycle activity | 동일 학생·같은 기준 시각; 도움 정책/한도/현재성 경계. loader는 decision log 쓰기 존재 |
| 계산 | composeV4/asIsMap/skillDiagnosis/toBeMap | 기존 Task ID·status 유지, 근거 부족과 미지원 구별 |
| 행동 | lifecycleEvidence + taskPlan/stageNow/ranksOf | **공통 readiness**; 시도량은 그대로, 성공/준비 조건은 별도 |
| 화면 | MAP/TaskInspector/PlanSection, ClaimPractice 복귀 | 같은 next·상태·설명, 새 요청/뒤로가기 stale cache 없음 |
| 저장 PLAN | plan-commit/plan-store + learner_workspace_plan_commit | append-only, goal_version/restore_of, 재시도·권한·버전 충돌, 기존 내용 보존 |

## 5. 지원량과 평가 타당도 판정

active 자료 개수로 수용하지 않는다. 실행 run에서 각 후보의 source/annotation/skeleton/anchor·공유 지문·노출·phase 적격성을 검사한 뒤 **서로 다른 지문 단위**로 확인/연습/전이/재확인 도구 수를 낸다. 제외 이유와 부족한 역할을 같이 보고한다. 확인 자료를 연습한 뒤 다시 독립 확인으로 재사용하지 않는다.

claim-support의 제한된 claim/support/relation 응답이 무엇을 관찰하는지 명시한다. 그 정답만으로 자유 요약·조건/범위 전체 이해·다른 유형 전이·잠재 R5 능력 전체를 입증하지 않는다. 교수 설명을 읽었다는 사실과 독립 수행은 별도다.

## 6. 재현 및 종료 기준

순수 감사 재현: `scripts/research/lm-g1/vitest.config.mjs`의 의존성 root에 설치된 web 패키지를 지정한다. 다른 환경에서는 저장소와 같은 lockfile의 설치본을 사용한다.

```powershell
$env:VF_REVIEW_DEP_ROOT = 'D:/workspace/Vocaflow-map-v62'
pnpm --dir $env:VF_REVIEW_DEP_ROOT --filter web exec vitest run --config D:/workspace/Vocaflow-lm-g1-goal-gap/scripts/research/lm-g1/vitest.config.mjs
node scripts/research/lm-g1/verify.mjs
```

고정 감사 결과를 덮어쓰지 않도록 향후 수정 검증은 새 출력 디렉터리/새 revision을 쓴다. G02/G03은 최초 main의 관찰이며 제품 수정 후 기대와 구별한다. 소스 hash가 다르면 동일 감사 재현이라고 부르지 않는다.

**R5 소프트웨어 수직 수용:** R01~R12의 적용 가능한 정상/공격 경로를 실제 환경에서 확인하고, R13~R16 경계를 솔직하게 표시하며, 필요한 지문 부족을 숨기지 않았을 때만 판정한다. 지연 기능/루브릭 범위가 미완료면 그 게이트는 별도 HOLD다. PC 회귀는 기존 화면 수용 기준으로 재검증한다. 실제 Factory 연결/학습 효과는 이 수용과 별개다.
