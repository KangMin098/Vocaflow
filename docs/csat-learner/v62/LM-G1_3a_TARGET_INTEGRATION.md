# LM-G1.3a — 목표 시험 · 점수 · 등급 · 목표일과 학습지도 · Workspace · PLAN 통합

> 기준 main `4cba17a36`(PR #273 T2 수용 병합) · 브랜치 `feat/lm-g1-3a-target` · 코드 커밋 `085040e64`.
> 범위: 학습자가 정한 목표가 **저장 · 조회 · 계산 · 추천 · PLAN 버전**에 같은 값으로 묶이게 한다. DB/RPC/RLS 변경 없음(읽기 전용 감사만). 실제 학생 기록 변경 없음.
> 수용 판정은 [LM-G1_3a_ACCEPTANCE.md](./LM-G1_3a_ACCEPTANCE.md). 승인이 필요한 나머지는 [LM-G1_3b_PENDING_DELTA.md](./LM-G1_3b_PENDING_DELTA.md). Codex 독립 검증 전 — T3 ACCEPT 를 선언하지 않는다.

## 1. 감사 — 고치기 전 실제 상태

| 층 | 사실(2026-10-16 · 읽기 전용) |
|---|---|
| DB | `csat_map_goal`(최신 점수만 · `target_score` NOT NULL) · `csat_map_goal_version`(이력: `target_score` NOT NULL · `target_grade` 1–9 · `target_exam` ∈ {suneung, kice6, kice9, hakpyeong} · `target_date` · `client_key` · UNIQUE(user, client_key)) · `learner_workspace_plan.goal_version_id` |
| RPC | `csat_map_goal_set(p_user, p_score, p_grade, p_exam, p_date, p_client_key)` — SECURITY DEFINER · 사용자 advisory 잠금 · 같은 키면 처음 id 반환(**본문 비교 없음**) · 최신 표 upsert + 이력 insert 를 한 트랜잭션 |
| API | `PUT /api/csat/diagnosis/map/goal` 이 `{ target }` 만 받고 RPC 에 등급 · 시험 · 날짜를 **항상 null** 로 넘김 — 열은 있으나 저장 지원 아님 |
| 계산 | 기준 시험 = `csat_exams.organizer = 'kice'` 최근 N회(6월 · 9월 · 수능 혼합) — 목표 시험과 무관 |
| 화면 | 「수능 영어 80점 · 2등급」 — 2등급은 **점수에서 계산한 값**인데 목표 등급처럼 보였다 |
| PLAN | 저장 시 `goal_version_id` 는 기록되지만 읽기 모델(`SavedPlanVersion`)에 없었다 |

시험 자료(읽기 전용 집계): 평가원 수능(11월) 적격 12 · 6월 8 · 9월 7(전부 오답률 관측 있음). 교육청 학평 적격 110 · **오답률 관측 0**(학평 검수 보류 — 기존 결정).

## 2. TargetSpec 세 층과 이번 지원 범위

| 층 | 내용 | 이번 |
|---|---|---|
| A. Exam Outcome | 시험 · 점수 · 등급 · 목표일 · 목표 버전 | 저장 · 조회 · 이력 연결. 계산에 쓰는 것은 **점수(toBeMap)** 와 **시험(기준 시험 범위)** |
| B. Competency Criterion | TASK 별 직접 수행 · 독립 확인 · 전이 · 재확인 | 변경 없음 — 목표 점수를 TASK 숙달률로 바꾸지 않는다 |
| C. Learning Plan | Workspace · 단계별 학습량 · 계획 버전 · 조정 | 계획의 목표 버전을 읽기 모델 · 화면에 연결 |

## 3. 목표 필드별 지원 행렬

| 필드 | 입력 | 저장 | 과거 버전 조회 | 계산 사용 | UI 표시 | 상태 · 사유 | 승인 필요 |
|---|---|---|---|---|---|---|---|
| 점수 | ○(필수) | ○ 최신 표 + 이력 | ○ | ○ toBeMap · splitMust · NeedRank · ActionRank | ○ | **PASS** | — |
| 시험: 수능 · 6월 · 9월 모평 | ○ | ○ `target_exam` | ○ | ○ 기준 시험 후보 범위(평가원 그 달) | ○ 「수능 기준 6회」 | **PASS** | — |
| 시험: 교육청 학평 | ○ | ○ | ○ | ✕ 오답률 관측 0 → 기준 문항 0 · 평가원 대체 없음 · TASK 는 「연결 확인 전」 | ○ 「분석 자료 준비 중」 | **BLOCKED_CONTENT** | 자료(오답률 · 검수) — SQL 아님 |
| 시험 미지정 | ○ | ○(null) | ○ | ○ 기존 기본(평가원 최근 N회) | ○ 「평가원 최근 기준」 | **PASS**(점수-only 호환) | — |
| 목표 등급 | ○(선택) | ○ `target_grade` | ○ | ✕ **의도된 제한** — 등급 규칙 · 시험 체제 미검증 · 점수↔등급 변환 금지 | ○ 「목표 2등급」 + 참고 구간과 다르면 「바꾸지 않았어요」 | **PARTIAL**(저장 · 표시) | 계산에 쓰려면 등급 규칙 정본(LM-G1.3b) |
| 등급만(점수 없음) | ✕(400) | ✕ `target_score` NOT NULL | — | — | — | **BLOCKED_APPROVAL** | LM-G1.3b |
| 목표일 | ○(선택 · 오늘 이후) | ○ `target_date` | ○ | ✕ **의도된 제한** — 날짜 기반 학습량 · 일정 생성 금지 | ○ 「~2026-11-19」 | **PARTIAL**(저장 · 표시) | 시간 예산과 함께 LM-G1.3b |
| 회차 · 형 · 복합 범위 | ✕ | ✕ | — | — | — | **BLOCKED_APPROVAL** | LM-G1.3b |
| 주간 시간 예산 · 개인 초점 | ✕ | ✕ | — | — | — | **BLOCKED_APPROVAL** | LM-G1.3b |

「저장만 되고 계산에 안 쓰이는」 등급 · 목표일은 완료가 아니라 **PARTIAL** 이다(지시 §13). 계산에 쓰지 않는 것은 근거 없는 변환 · 학습량 생성을 막기 위한 의도된 제한이고, 화면은 그 값을 계산 근거처럼 보이지 않는다.

## 4. 계산 경로(같은 목표 하나)

```
PUT goal { target, exam, grade, date, clientKey }
  → server.setGoal: parseGoalInput(검증 · 오늘 이후) → findGoalByKey(같은 키 · 같은 본문 = reused · 다른 본문 = 409)
  → csat_map_goal_set RPC(최신 표 + 이력 한 트랜잭션)
loadMapPage
  → loadLatestGoal(최신 이력 행) → scopeCandidates(exam): 미지정 = 평가원 전체 · 수능 = 11월 · kice6 = 6월 · kice9 = 9월 · 학평 = 오답률 있는 교육청 회차(없으면 unsupported · 후보 0)
  → selectReferenceExams(같은 적격 규칙 45문항 · 100점 · 최근 N) → refItems · lineRefItems
  → v4.target = { goal(이력 행 그대로), scope(시험 · 상태 · 사유 · 실제 회차) }
composeV4 → toBeMap(점수 · refItems) → ranksOf(NeedRank · ActionRank) → planWorkspaces → workspacePlan → 화면
PLAN commit → goal_version_id = saved.goalVersionId(실제 최신 이력) · 복원도 지금 목표 버전으로 새 행(목표 되감기 없음)
```

새 추천 엔진 · 새 가중치 없음. 시험 종류는 **후보 회차 범위**만 바꾸고 관련도 계산(splitMust · 라인 연결)은 기존 그대로다.

## 5. 목표 변경 → 학습 요구 · 추천 변화(실측 — 합성 계정)

| 목표 | 기준 시험(실제 회차) | R5 요구 | 먼저 볼 순서 |
|---|---|---|---|
| 80 · 미지정 | 평가원 최근 6회(6 · 9 · 수능 혼합) | 추가 확인 · 순서 1 · 연결 문항 38 | R5 · E2 · E3 |
| 90 · 수능 | 수능 6회(2021–2026) | 측정 안 함(회차 범위만 실측) | 측정 안 함 |
| 90 · 9월 모평 | 9월 모평 6회(M2109–M2609) | 측정 안 함 | 측정 안 함 |
| 90 · 학평 | 0회(미지원 · 대체 없음) | 「목표 시험과의 연결 확인 전」 · 직접 확인 전(약점 아님) | 없음(ActionRank 비움) · 상단 다음 행동 없음 |

학평 미지원에서 ActionRank 가 비는 것은 「할 것 없음」이 아니라 「이 시험 기준으로 고를 근거가 없음」이다. 지도 · 기출 탐색 · TASK 직접 확인은 그대로 열려 있다.

## 6. 목표 버전과 PLAN

- `SavedPlanVersion.goalVersionId` = `learner_workspace_plan.goal_version_id`(기존 열 · 읽기만 보완).
- 목표 이력 최신 20행(`goalHistory`)으로 각 계획 버전에 「그때 목표 80점 · 수능」 / 「지금 목표 95점 · 수능」.
- 복원(restore)은 새 계획 행에 **지금 목표 버전**을 남기고(최신 목표 표 그대로) 이력에 「되돌려도 지금 목표는 바뀌지 않아요」.
- 정의 버전(`canon_version`)과 목표 버전은 다른 칸이다. 저장 안 된 팝업 입력은 저장 성공 전까지 목표로 보이지 않는다(실패 시 이전 값으로 되돌림).

## 7. 화면(LM-W1 유지)

- 상단 띠 「내 목표」: `영어 90점 · 참고 1등급 구간`(점수에서 계산 — 저장 등급 아님) + 한 줄 `수능 기준 6회 · 목표 2등급 (점수 구간과 달라요 — 바꾸지 않았어요) · ~2026-11-19`. 미지원은 `교육청 학력평가 기준 · 분석 자료 준비 중`(툴팁 · 접근성 이름에 사유).
- 목표 팝업: 기존 점수 칩 · 직접 입력 아래 「시험 · 등급 · 목표일 더 정하기」(접힘 · 44px). 새 카드 · 대시보드 없음.
- PLAN 탭 이력: 버전마다 그때/지금 목표.
- 과거 asof: 목표 편집 대신 「현재 기준에서 목표 바꾸기」(기존 PM4-P2-02).

## 8. 재사용 · 새로 고친 것

- 재사용(변경 없음): `csat_map_goal_set` RPC · 목표/계획 테이블 · RLS · `toBeMap` · `splitMust` · `ranksOf` · `planWorkspaces` · plan-commit RPC · 복귀 문맥(`goal_changed`).
- 고친 것: `v62/target-goal.ts`(신규 · 순수) · `v4/plan-store.ts`(loadLatestGoal · findGoalByKey · setGoal 확장 · goal_version_id · goalHistory) · `v4/plan-commit.ts`(SavedPlanVersion.goalVersionId) · `server.ts` · goal 라우트(409) · `load.ts`(범위) · `GoalBar` · `GoalRecordBar` · `PlanSection` · `map.module.css`.
