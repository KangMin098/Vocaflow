# 학습 지도 rev4.0 — 전환 계획 · 2차 작업 계약(2026-10-10)

> 이 1차 작업은 문서 · 구조화 파일 · 검사만 만들었다. **DB 적용 · UI 변경 · 2차 구현은 승인 범위 밖이다.**

## 1. 원칙

1. 기존 54라인 · 183활동 · 160연결선 · 화면은 **그대로 둔다**(데이터 보존). rev4 는 옆에 얹는다.
2. 새 판정 규칙을 만들지 않는다 — `isDiagnosable` · `splitMust` · `learnerPath` · `skill-diagnosis` · `lifecycle-evidence` 를 TASK 단위로 **어댑트**한다.
3. 모든 계산은 `now`/`as_of` 주입 순수 함수(시계 직접 읽기 금지).
4. 마이그레이션은 SQL 을 보여 주고 승인 뒤 적용. 번호는 만들기 직전 `ls supabase/migrations` 로.

## 2. 데이터 구조 — 재사용 · 신규

**재사용(11)**: `csat_dx_session`(taken_at · created_at · exam_id) · `csat_dx_response` · `csat_dx_snapshot`(engine_version · inputs_as_of) · `csat_exams`(organizer · kind · grade · diagnosis_ready) · `csat_map_goal`(목표 시작점) · `csat_map_item_rate` · `csat_dx_item_attribute` · `knowledge_applications`(surface · surface_ref · audience) · `learning_sessions` · `learning_task_attempts`(task_key · item_ref · content_hash · phase) · `learning_decisions`(policy_version · fingerprint).

**신규 제안(6) — 2차 이후, 승인 필요**

| 구조 | 목적 | 형태 | 단계 |
|---|---|---|---|
| `map_v4_definition` | 코드북 · 관계 · Workspace 정의의 **버전** 저장(as-of 재현) | `(canon_version, kind, id, body jsonb, created_at)` · append-only | 2차는 **파일**(`docs/csat-learner/v4/*.json` → 빌드 시 TS 상수)로 대체 — DB 불필요 |
| `csat_map_goal_version` | 목표 버전(점수 · 등급 · 대상 시험 · 날짜) | append-only, 기존 `csat_map_goal` 은 최신 뷰로 유지 | 3차(목표 변경 이력이 필요해질 때) |
| `learner_workspace` | 학습자 Workspace 인스턴스 | `(id, user_id, template_id, template_version, goal_version_id?, status, created_at)` RLS 본인 | 3차 |
| `learner_workspace_plan` | 계획 확정 사본 · 변경 이력 | `(workspace_id, plan_version, plan jsonb, reason enum, as_of, created_at)` append-only | 3차 |
| `learning_task_attempts.v4_task_ids`(또는 매핑 뷰) | 시도 → TASK | **뷰 우선**: `task_key` → TASK 는 정의 파일에서 계산 — 컬럼 추가 없이 | 2차는 코드 매핑 |
| funnel 이벤트 | `csat_workspace_*`(이미 허용) · `csat_map_asis_viewed` · `csat_map_need_viewed` | events.ts + DB CHECK **둘 다**(funnel allowlist 함정) | 2차(화면을 만들면 같은 커밋 · D2) |

보류(2): 동등화 테이블 · X 실행 근거(문항별 시간 모델).

## 3. 단계

| 단계 | 내용 | DB | 승인 |
|---|---|---|---|
| 1차(이번) | 감사 · 코드북 · 관계 · Workspace · 시험 입력 · 전환 계약 · 무결성 테스트 | 읽기만 | 이 지시 |
| **2차** | **최소 수직 경로**(§4) — 순수 함수 + 읽기 전용 화면 1개 | 쓰기 없음(목표는 기존 `csat_map_goal`) | 착수 승인 |
| 3차 | Learner Workspace 저장 · PLAN 버전 · 목표 버전 | 마이그레이션 3 | SQL 승인 |
| 4차 | V · S 직접 확인 콘텐츠 · cohesion 확인 문항 2+ · 전이 문항 풀 | 시드 · 적용 | 활성화 승인 |
| 5차 | 파일럿(MAP_PILOT_PROTOCOL) — 효과 검증 | — | 동의 · 모집 |

## 4. 2차 — 최소 수직 경로 작업 계약

**경로**: 시험기록 입력(기존 화면) → As-Is Map → 목표 설정(기존 GoalBar) → TASK 학습 요구 → 대표 Workspace 1개(`ws.central-meaning` 또는 To-Be 1순위 live Workspace) 편성 표시.

**우선순위**
- **P0** `lib/csat/map/v4/definition.ts` — `docs/csat-learner/v4/*.json` 을 타입 있는 상수로(빌드 시 import · 런타임 파일 읽기 없음) + 기존 무결성 테스트를 vitest 로 이식.
- **P0** `lib/csat/map/v4/as-is.ts` — `asIsMap({ sessions, responses, snapshot, practiceVerdicts, asOf, definition })`. 입력은 `load.ts` 가 이미 읽는 값 재사용. `as_of` 필터 · 미측정/측정 불가/근거 부족 구분 · 축 proxy 를 TASK 에 「축 proxy」로만.
- **P0** `lib/csat/map/v4/to-be.ts` — `toBeMap(asIs, goal, splitMustResult, definition)` → 요구 6유형 · 목표 관련도 · 정렬. 목표 없음 = null.
- **P1** `lib/csat/map/v4/workspace.ts` — `proposeWorkspaces(toBe, templates)` → 준비 상태 live/ready 만 편성 후보, content_needed 는 「준비 중」 목록. 계획량은 WORKSPACE_CONTRACT §3 규칙(개수만).
- **P1** 읽기 전용 패널: 기존 지도 화면 안 「목표까지 필요한 확인」 섹션(별도 라우트 없이 — 대규모 UI 교체 금지). 3B 디자인 · 측정 절차(DESIGN.md) 준수, 이벤트 2개 같은 커밋.
- **P2** `needGraph()` · 시나리오 6(as-of 재현) 화면 · diff 표시.

**선행 조건**
1. 이 1차 산출물 승인(특히 코드북 TASK 30 · 라인 판단 · Workspace 9 의 「제안」 상태 수용).
2. 관계 34 중 2차가 쓰는 것(PART_OF 18 — 정본 §3)만 approved 로 올리는 사용자 결정. 나머지는 2차에서 쓰지 않는다.
3. 진단 반영 시험이 M2409 1회뿐 — 2차 E2E 는 M2409(+ 기존 TEST 시험 M2098 패턴)로. 다른 시험은 「분석 준비 중」 그대로 보여야 한다.
4. 실제 학습자 기록 0 — 검증은 합성 · 역할 학습자(실제 참가자 대기 금지).

**예상 변경 파일**: `apps/web/src/lib/csat/map/v4/{definition,as-is,to-be,workspace}.ts` + `__tests__/*.test.ts` · `apps/web/src/lib/csat/map/load.ts`(v4 계산 호출 추가 — 기존 반환 유지) · `apps/web/src/components/csat/diagnosis/map/NeedPanel.tsx`(신규) · `apps/web/src/lib/analytics/events.ts` + funnel CHECK 마이그레이션(승인) · `docs/csat-learner/LEARNING_MAP_V4_*`(동반 갱신) · `docs/ROUTES.md`(라우트 변경 없으면 불필요) · `docs/MODULES.md` · `CHANGELOG`.

**검증(수용 기준)**
- 단위: 시나리오 8 각각 픽스처(고정 `asOf`) — 특히 #2 과거 1회의 「지금 상태 아님」 표시, #6 이후 기록 혼입 0, #7 목표 없음 To-Be null, #3 서로 다른 시험 원점수 합산 0.
- 불변식: rule_proxy 만으로 TASK `verified_need` 0 · 목표 변경이 근거 상태를 바꾸지 않음 · 같은 시도가 두 Workspace 의 독립 증거로 2회 계산되지 않음 · hold TASK 에 요구 0.
- 회귀: `pnpm --filter web exec vitest run src/lib/csat/map src/components/csat/diagnosis/map` 264 통과 유지 · `scripts/csat/map/e2e-map-goal.mjs` · `e2e-map-states.mjs` 통과.
- 브라우저: 1440px 에서 M2409 기록 계정 · 목표 80 — 요구 목록에 live Workspace 1개 이상 · content_needed TASK 는 「준비 중」. `pnpm design:ref-compare` 표 첨부.

## 5. GAP · BLOCKED 목록

| ID | 내용 | 분류 | 다음 |
|---|---|---|---|
| GAP-01 | 진단 반영 시험 1/134 — 대부분 시험 기록은 단계 관찰을 못 만든다 | BLOCKED(사람 검수) | 대표 시험 검수 확대(정본 「진단 반영 판정」) |
| GAP-02 | V · S 직접 확인 도구 0 | GAP | 4차 콘텐츠 |
| GAP-03 | cohesion 확인 문항 1(2개 이상 필요) | GAP | 4차 |
| GAP-04 | evidence 전이 문항 0 | GAP | MC-07 그대로 |
| GAP-05 | 목표 이력 없음(덮어쓰기) | GAP | 3차 목표 버전 |
| GAP-06 | as-of 재현 · 정의 버전 없음 | GAP | 2차 파일 버전 → 3차 |
| GAP-07 | `graph.ts pathOf` 가 pending 간선을 강조 경로에 넣는다 | GAP(표현) | 별도 UI 승인 때 — pending 점선은 유지, 강조만 제외 검토 |
| GAP-08 | 같은 활동이 여러 라인에 복제(C*-3 7개 등) | GAP(정규화) | rev4 는 활동 1 · TASK N 으로 읽는다 — DB 정리는 하지 않음 |
| GAP-09 | `learning_goals` 마이그레이션이 개발 DB 에 없다 | 확인 필요 | 쓰는 코드 0 — 목표는 `csat_map_goal` 기준으로 결정, 남은 파일 처리는 사용자 결정 |
| GAP-10 | 교재 단위에 TASK 키 없음 | GAP | WORKSPACE_CONTRACT §5 제안 |
| GAP-11 | 실제 학습자 효과 근거 0 | UNKNOWN | 파일럿 |
| GAP-12 | 「36개 수행 TASK」 이전 설계 원문 미발견 | 확인 불가 | 원문 위치를 알려 주면 코드북과 대조 |

## 6. 위험

- 「TASK」 라는 이름 충돌(`csat_map_task` 활동 vs rev4 TASK) — 코드에서 `v4TaskId` 처럼 접두로 구분.
- 목표 관련도가 「점수 역산」처럼 읽힐 위험 — 화면 문구는 「목표와 관련된 문항 수」 사실만.
- 정본 rev2.1 과 rev4 문서가 동시에 근거가 되는 혼선 — rev4 문서는 「제안」 머리말 유지, 승인 시 정본에 rev3 로 병합(사용자 결정).

## 7. 1차 검증 결과(2026-10-10)

| 검사 | 결과 |
|---|---|
| 구조화 산출물 무결성 `node --test scripts/csat/map/v4/__tests__/codebook.test.mjs` | **8/8 통과** — 라인 54 · 활동 183 누락 0 · 중복 id 0 · 참조 오류 0 · 관계 전부 proposed · PREREQUISITE 순환 0 · Workspace 준비 상태 과장 0 · 연결선 종류별 개수 일치 · 생성 문서 최신 |
| 지도 vitest `src/lib/csat/map` + `components/csat/diagnosis/map` | **25 파일 · 264 통과 · 2 건너뜀**(`load.live` · `quality.live` — DB 연결 필요 live 테스트, 실행 안 함 → PASS 아님) |
| 앱 코드 변경 | 0 — 회귀 위험 없음 |
| `pnpm turbo run lint typecheck test` 전체 | 실행 안 함(앱 코드 무변경 · 범위 밖) |
| DB 쓰기 | 0(SELECT · 읽기 스냅샷만) |
