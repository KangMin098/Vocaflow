# 학습 지도 rev4.0 — 시험기록 기반 지도 생성 계약(설계 제안 · 2026-10-10)

> 현재 동작은 [ASIS_AUDIT](./LEARNING_MAP_ASIS_AUDIT.md) §3. 이 문서는 rev4 의 **입력 → As-Is Map → (목표) → To-Be Map** 계약이다.
> 원칙: 시험 정오만으로 세부 능력 · 오답 원인 · 숙달을 확정하지 않는다(정본 §10 · §11). 정오에서 나오는 것은 **근거 상태와 확인 우선순위**뿐이다.

## 1. 네 개의 시각 — 섞지 않는다

| 시각 | 뜻 | 원천 |
|---|---|---|
| `taken_at` | 시험 시행일(학습자가 그 시험을 본 날) | `csat_dx_session.taken_at` |
| `entered_at` | 기록 입력일 | `csat_dx_session.created_at` |
| `as_of` | 분석 기준 시점 — 이 시점까지 **알 수 있었던** 기록만 쓴다 | 요청 인자(기본 = now) |
| `computed_at` | 계산한 실제 시각 | 스냅샷 · 응답 |

버전 셋: `canon_version`(코드북 · 관계 · Workspace 정의, 예 `rev4.0-draft-1`) · `rule_version`(진단 규칙 — 지금 `engine_version` · `policy_version`) · `item_input_version`(문항 진단 입력 — 역량 검수 · Anchor 해시).

**as_of 필터 규칙**: 세션은 `taken_at ≤ as_of AND entered_at ≤ as_of`, 학습 시도는 `answered_at ≤ as_of`, 목표는 `as_of` 당시 유효했던 목표 버전. 과거 시점 재현은 **그 시점의 정의 버전**으로 계산한다(정의 버전 이력이 없으면 「현재 정의로 재계산함」 표시 — 재현이 아님을 밝힌다).

## 2. 입력 시나리오 8

| # | 시나리오 | As-Is 계산 | 출력 표시 | 금지 |
|---|---|---|---|---|
| 1 | 최신 시험 1회 | 그 세션 하나 · ready 시험이면 축 · 단계 근거 상태(rule_proxy), 아니면 점수만 | 「기록 1회 — 경향이 아닌 한 번의 관찰」 · 미측정 TASK 목록 | 1회로 「약점」 · 「취약」 |
| 2 | 과거 시험 1회 | 같은 계산 + `taken_at` 표기 | 「YYYY-MM 시점의 관찰 — 지금 상태가 아닐 수 있음」 · 최근성 경고(예: 120일 초과, skill-diagnosis 만료와 같은 창) | 과거 관찰을 현재 상태로 표시 |
| 3 | 과거 여러 회 | 회차별 관찰을 **나열** · 시험 종류별로 묶음 | 회차 수 · 기간 · 시험 종류 | 서로 다른 시험 원점수 평균 · 추세선(동등화 전) |
| 4 | 최신 · 과거 누적 | 근거 누적은 문항 단위(서로 다른 문항 수), 최근 가중 없음(규칙 미정) | 「최근 N회」 와 「전체」 를 나눠 보임 | 오래된 근거가 최근 근거를 덮기 |
| 5 | 기존 기록에 새 시험 추가 | 새 As-Is 계산 → 이전 As-Is 와 **차이(diff)** 계산 → 계획에 영향이 있으면 재편성 제안(자동 적용 아님) | 「새 기록으로 바뀐 것」 목록 | 학습자 계획을 말없이 덮어쓰기 |
| 6 | 과거 시점 지도 재현 | `as_of` 필터 + 그 시점 정의 버전 | 「YYYY-MM-DD 기준 재현 · 정의 버전 v」 | 이후 기록 혼입 |
| 7 | 목표 미설정 | As-Is 만. To-Be 없음 | 「목표를 정하면 우선순위가 생겨요」 | 기본값 100 을 목표로 표시(지금 규칙 유지) |
| 8 | 목표 설정 · 변경 | 목표 버전 추가(덮어쓰기 아님) → To-Be 재계산 → 계획 재편성 **제안** | 이전 목표 대비 바뀐 요구 | 목표에서 숙달도 · 점수 상승 역산 |

미측정과 측정 불가를 구분한다: **미측정**(그 TASK 를 관찰할 문항이 기록에 없었다) · **측정 불가**(관찰 도구 자체가 없다 — content_needed · blocked) · **근거 부족**(문항은 있으나 수가 적다).

## 3. 시험 간 비교 가능성

- 원점수는 같은 시험지(같은 `exam_id`)끼리만 직접 비교한다. 서로 다른 시험의 원점수 · 등급을 같은 척도로 합치지 않는다.
- 묶을 수 있는 단위: `organizer`(평가원 · 교육청) × `kind` · `grade`. 묶음 밖 비교는 「다른 시험 — 직접 비교 불가」 표시.
- 동등화(난이도 보정)는 **미구현 · 이번 범위 밖**. 필요해지면 `csat_map_item_rate`(오답률 450행) 기반 문항 난이도로 설계하되 공식 통계 출처(`official_stats_source`)가 있는 시험만.

## 4. As-Is Map 출력 계약(제안 타입)

```ts
interface AsIsMap {
  as_of: string; computed_at: string
  canon_version: string; rule_version: string
  sessions: { id: string; exam_id: string; taken_at: string; entered_at: string; diagnosable: boolean; ready: boolean }[]
  tasks: Record<TaskId, {
    basis: 'none' | 'rule_proxy' | 'item_tagged' | 'verified_diagnosis'
    status: 'unmeasured' | 'unmeasurable' | 'insufficient' | 'observed' | 'check_first' | 'verified_need' | 'resolved' | 'expired'
    evidence: { distinct_items: number; sessions: number; latest_taken_at: string | null }
    note: string   // 학습자 문구 키
  }>
  scores: { exam_id: string; taken_at: string; raw: number | null; grade: number | null }[]   // 나열만
}
```
- `status` 는 기존 `learner-path` 단계 상태(none · pending · more · observed)와 `skill-diagnosis` 판정(verified · still_needed · resolved · expired)을 TASK 단위로 옮긴 것 — 새 판정 규칙이 아니다.
- 축 · 단계 rule_proxy 를 TASK 로 내려 보낼 때는 **축의 상태를 그 축 TASK 전부에 같은 값으로 「관찰 근거: 축 proxy」 로만** 붙인다(세부 능력 근거로 표시 금지 — 정본 §11).

## 5. To-Be Map — 목표 대비 학습 요구

목표 모델(제안): `goal = { target_score, target_grade?, target_exam: {organizer, exam_month?, date?}, set_at, version }`. 지금 `csat_map_goal`(점수 하나 · 덮어쓰기)을 버전 행으로 확장(MIGRATION_PLAN §2).

요구 유형 6(지시서의 「추가 확인 · 보완 · 통합 · 전이 · 유지 · 실전」):

| 요구 | 발생 조건(As-Is 기준) | 계획 단계 |
|---|---|---|
| `confirm`(추가 확인) | unmeasured · insufficient · check_first · expired | FIND |
| `repair`(보완) | verified_need | REPAIR |
| `integrate`(통합) | 통합 관찰(*-O1)의 PART_OF 원자들이 resolved 인데 통합 관찰 근거가 없다 | 통합 Workspace 활동 |
| `transfer`(전이) | resolved 이지만 `phase=transfer` 기록 없음 | TRANSFER |
| `maintain`(유지) | resolved · 만료 창 안 | 다른 날 CHECK(간격) |
| `exam_practice`(실전) | X 보류 — 지금은 생성하지 않는다 | — |

**목표가 하는 일 — 우선순위만**: 목표 G 에 대해 `target.ts splitMust`(기존)가 정한 「반드시 맞힐 문항 집합」에서 각 TASK 가 걸린 서로 다른 문항 수 · 배점 합(= goal-view 단계 시트의 사실과 같은 계산)을 **TASK 의 목표 관련도**로 쓴다. 요구 우선순위 = (요구 유형 순서) → (목표 관련도) → (PREREQUISITE 낮춤, verified 일 때만). **목표에서 점수 상승 · 숙달도를 역산하지 않는다**(정본 목표 중심 절 유지).

목표 없음(시나리오 7): To-Be 를 만들지 않고, As-Is 의 `confirm` 후보만 「목표를 정하면 우선순위가 생겨요」와 함께 보인다.

## 6. 갱신 규칙

| 사건 | As-Is | To-Be | PLAN |
|---|---|---|---|
| 새 시험 | 재계산 + 이전과 diff | 재계산 | 영향 있는 Workspace 에 재편성 **제안** — 학습자 확인 뒤 `plan_version`+1 |
| 직접 확인 결과 | TASK 상태 갱신 | 요구 유형 이동(confirm → repair / resolved) | 같은 Workspace 안 다음 칸(자동 — 기존 생애주기 규칙) |
| 목표 변경 | 그대로 | 재계산 | 재편성 제안 |
| 정의 버전 변경 | 재계산(새 버전) · 이전 계산은 버전과 함께 보존 | 재계산 | 영향 표시 |

## 7. 이 계약이 정하지 않는 것(보류)

최근 가중 · 근거 감쇠 수치 · 동등화 · X 실행 근거 · 듣기 세부 · 오답 원인(EC) 연결(정본 §10-1 경로 그대로, EC 브랜치 통합 뒤).
