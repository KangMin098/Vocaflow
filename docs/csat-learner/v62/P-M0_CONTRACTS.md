# 학습지도 v6.2 — P-M0 계약 · 가드 기록

> 정본 [LEARNING_MAP_V6_2_CANON.md](./LEARNING_MAP_V6_2_CANON.md) · 지시 [IMPLEMENTATION_HANDOFF.md](./IMPLEMENTATION_HANDOFF.md) · 기준 main `5e1415a91` · 실측 2026-10-14 개발 DB(읽기 전용).
> **합성 fixture 테스트와 DB 실측은 플랫폼 지원 상태이며 학생 능력 · 학습 효과가 아니다.** DB 스키마 · 데이터 변경 0.

## 1. 논리 계약 ↔ 기존 자산 대응

| v6.2 계약 | 구현(`apps/web/src/lib/csat/map/v62/`) | 재사용한 기존 자산 | 아직 없는 것(누락 지점) |
|---|---|---|---|
| `DomainTaskGraphDTO` | `graph.ts domainTaskGraph()` | `v4/definition` 30 TASK · 관계 34 · Template 9 그대로 | — (정의 변경 0) |
| `TaskInspectorDTO` | `graph.ts taskInspector()` | `composeV4` 결과(As-Is · To-Be · 계획) | 기출 출제 논리(G2) 슬롯 — P-M1 에서 v3 분석 링크로 |
| `NeedRank` / `ActionRank` | `rank.ts ranksOf()` | To-Be 요구 순서 · 계획 `next` | — |
| `GoalCoverageLedger` | `coverage.ts goalCoverageLedger()` | 확인 · 전이 링크 수 · 정의 | ReasoningCoverage 입력(문항별 공개 분석 범위) — 미조회면 unknown |
| `ExamInventoryCoverage` | `inventory.ts examInventoryCoverage()` | `csat_dx_answer_key` | 2013 이전 체제 메타데이터(→ unknown) |
| 관련성 4값 · `candidate_relevance` | `relevance.ts` | — | 제품의 문항 단위 검토 링크 0건(연구 46건은 R1 · 제품 승격 전) |
| `TargetSpec` | `target-spec.ts` | `ToBeGoal{score,set}` · `csat_map_goal_version` | 점수 외 필드 저장(`target_score NOT NULL` · 목표 종류 제한) — DB 감사 · 승인 대상 |

## 2. 소유권(판정은 한 곳)

| 계산 | 소유 | v6.2 모듈의 역할 |
|---|---|---|
| As-Is 근거 상태 · 직접 확인 판정 | `v4/as-is.ts`(+ `skill-diagnosis`) | 읽기만 |
| To-Be 요구 · 목표 관련도 | `v4/to-be.ts` | 읽기만 |
| Workspace 단계 · 계획량 · 다음 활동 | `v4/workspace.ts` · `v4/plan.ts` | 읽기만 |
| 단계별 다음 할 일(원리 사슬) | `lib/knowledge/learning-decision.ts decideStep` | 이 PR 에서 연결하지 않음 — P-M1 Inspector 어댑터에서 같은 입력을 공유 |
| NeedRank · ActionRank · 커버리지 | `v62/rank.ts` · `v62/coverage.ts` | 새 판정 없이 위 결과를 재배열 · 집계 |

회귀(`v62/__tests__/contracts.test.ts`): 같은 학습자 · TASK · 목표 · 기준 시점에서 As-Is 상태 = Inspector 근거 = 계획 요구 = Inspector 다음 행동(계획 `next`) — 확정 직후 · 해소 두 상태.

## 3. 바뀐 판정 하나 — `unknown ≠ not_applicable`

`v4/to-be.ts`: 목표 「반드시」 문항에 걸리지 않은 TASK 를 둘로 나눴다.
- `unrelated` — 기준 시험 문항과 라인 연결은 있지만 이 목표 점수 전략에서 「반드시」가 아님(기존 의미).
- `relevanceUnknown`(신규) — 기준 시험 문항과의 연결 자체가 없음 = 관련성 미확인. 이전에는 이것도 `unrelated` 로 들어가 「목표와 무관」처럼 읽혔다.
요구 · 순서 · 기존 판정은 그대로(이 목록은 화면 문구에 쓰이지 않았다 — `unrelated` 소비처 0, 테스트 1).

## 4. 가드(테스트로 고정)

- 30 TASK · 비보류 21(원자 18 · 통합 3) · 보류 9 · 영구 slug 순서 불변 · 관계 34(승인 14).
- 독해 28문항 · 63점 카탈로그는 45문항 · 100점 시험의 63 % · `partial`(100 % 아님). 체제 미확인은 분모 null · `unknown`.
- 검토되지 않은 출처(연구 AI 후보 · AI 검토)는 `relevance` 를 정할 수 없고 R2 이상으로 올릴 수 없다. 후보 수는 검토 수에 더하지 않는다.
- NeedRank = ActionRank + 실행 불가(이유 포함) — 콘텐츠 없는 TASK 를 지우지 않는다. 근거 부족은 `confirmed=false`.
- Assessment Ledger 는 루브릭 R3 검증 전이라 최대 `partial`. TaskLink(라인 수준)도 최대 `partial`. 보류 TASK 는 `unsupported`(학생 0점 아님). 모든 TASK 에 수준 해석 · 효과 측정 공백.
- TargetSpec: 저장되는 필드는 점수뿐 — 나머지는 `persisted=false`.

## 5. 제품 실측(`scripts/csat/map/v62/product-availability.mts` → [PRODUCT_AVAILABILITY.json](./PRODUCT_AVAILABILITY.json))

| Workspace | 정의 준비도 | 출시 확인 문항 | 출시 전이 문항 | 미출시 초안 |
|---|---|---|---|---|
| 글의 핵심 잡기 | live | 9 | 4 | 0 |
| 선지와 본문 맞대기 | live | 6 | 0 | 0 |
| 근거 문장 찾기 | live | 5 | 0 | 4(출시 승인 B7 대기) |
| 문장 잇기 | ready | 0 | 0 | 1 |
| 나머지 5 | content_needed · blocked | 0 | 0 | 0 |

평가원 시험 30 — 정답표 45문항 · 100점 일치 27 · 정답표 없음 3 · 진단 반영 5.
연구 `coverage.json` 의 `unsupported` 는 연구 산출물의 검사 범위이고, 위 표는 제품 실측이다 — 서로 복사하지 않는다.

## 6. 다음(P-M1)

`MapScreen` 의 `LearnerMap`/`LearningMap` 이중 렌더링을 단일 `UnifiedLearningMap`(6영역 개요 + 영역 확장 + TaskInspector)으로 — 위 DTO 만 읽는다. `/csat` 홈 · `?tab=map` · `&view=full` 수렴, 1280/1440 · 레일 64/220 실화면 검증.
