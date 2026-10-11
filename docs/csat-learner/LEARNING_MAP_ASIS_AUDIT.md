# 학습 지도 rev4.0 — As-Is 감사(2026-10-10)

> 범위: 정본 [LEARNING_MAP_VNEXT](./LEARNING_MAP_VNEXT.md) rev2.1 · [CROSSWALK](./LEARNING_MAP_VNEXT_CROSSWALK.md) · [MAP_GAP_LEDGER](./MAP_GAP_LEDGER.md) · [MAP_COMPLETION_CONTRACT](./MAP_COMPLETION_CONTRACT.md) · `apps/web/src/lib/csat/map/` · `apps/web/src/components/csat/diagnosis/map/` · 개발 DB `jajenrevcbmrpaliomxv`(읽기 전용).
> 기준 코드: `origin/main` `d5fea7ec7`(브랜치 `feat/map-v4-design`). DB 질의 시각: 2026-10-10.
> 표기: **[실측]** DB · 코드에서 직접 읽음 · **[정본]** rev2.1 승인 · **[추정]** 확인하지 않음.
> 전수 표(라인 54 · 활동 183): [LEARNING_MAP_DOMAIN_TASK_CODEBOOK](./LEARNING_MAP_DOMAIN_TASK_CODEBOOK.md) · 스냅샷 [v4/asis-snapshot.json](./v4/asis-snapshot.json)(`scripts/csat/map/v4/export-asis.mjs`).

## 1. 규모 — 보고서 기준값 vs 실측

| 항목 | 보고서 기준값 | 실측(2026-10-10) | 차이 · 주석 |
|---|---|---|---|
| 핵심축 | V/S/R/E/L/X 6 | DB 축 노드 **A · B · C · D · I · J 6** | **다른 6이다.** V/S/R/E/L/X 는 DB 노드가 아니라 `core.ts` 가 A1–A9 를 묶어 계산하는 표시 층(V=A1 · S=A2+A8 · R=A3+A6 · E=A4+A5 · L=A7 · X=A9) |
| 읽기 · 듣기 단계 | 7 · 4 | 7 · 4 (`curriculum.ts` `CURRICULUM` 11키) | 같음 |
| 지도 노드 | 72 | 72 = 목표 1 · 축 6 · 라인 54 · 원리 8 · 트랙 3 | 같음. `evidence_status` sourced 5 · pending 67 |
| 라인 | 54 (A/B/C/D/I/J) | A 9 · B 13 · C 8 · D 9 · I 10 · J 5 = 54 | 같음 |
| 연결선 | 160 | 160 — goal 6 · member 54 · reason 87 · route 13. **`basis` 전부 pending**(`basis_claimed` direct 84 · inferred 68 · pending 8) | 같음. 「주장한 근거」와 「확정 근거」가 다른 칸이다 |
| 학습 활동 | 183 | 183 = 라인 × ord1–3(162) + ord4 21 | 같음. 정본 §14 는 「182(FIND 20)」 — 이후 A2-4(S 직접 확인)가 더해져 21 |
| 라인↔문항 매핑 | 148 | 148 = item_no 102 · type 25 · attribute 8 · trap_family 7 · habit 6 | 같음. 문항 번호 연결은 102행뿐 — 나머지는 유형 · 속성 단위 |
| 원천 문헌 | — | `csat_map_source` verified 8 · needs_review 1 | |
| 학습자 데이터 | — | `csat_map_goal` 1행 · `csat_map_task_done` 1행 · `csat_dx_session` 2(사용자 1) · 응답 90 · 스냅샷 2 · `learning_task_attempts` 124(**전부 synthetic** — 실제 0) · `learning_decisions` 8 | 실제 학습자 효과 근거 0(MC-12 UNKNOWN 그대로) |
| 진단 반영 시험 | — | `csat_exams` 134회 중 `diagnosis_ready` **1(M2409)** | 정본 §목표 중심(10-07) 「0」 이후 1회 켜짐 |
| 문항 역량 태그 | — | `csat_dx_item_attribute` type_default 10,188 · admin 252(검수 252) | 252 = M2409 28문항 × 9역량 |
| 지식 적용 | — | `knowledge_applications` learning_map_find active 3(b6-3 · a4-4 · a5-4) · draft 1(a3-4) · csat_item_task active 20 · draft 1 | 앱 안 실행 활동의 실제 범위 |
| `learning_goals` | — | **테이블 없음**(`to_regclass` null) | 마이그레이션 `20260628160000_p1_learning_goals.sql` 은 저장소에 있으나 개발 DB 에 없다. 지도는 `csat_map_goal` 만 쓴다 |

## 2. 최우선 확인 질문 10

| # | 질문 | 판정 | 근거 |
|---|---|---|---|
| 1 | 시험기록 1개 입력 시 생성되는 지도 수준 | **부분 구현** | `load.ts loadMapPage` 가 최신 스냅샷 1개(`loadSnapshots(…,1)`)와 입력 신뢰도(`isDiagnosable`) 통과 세션을 읽는다 → `model.ts buildMapModel`(라인 목표율 · 성취율) → `learner-path.ts`(단계 근거 상태 · focus 하나) → `skill-diagnosis.ts`(원리 단위 직접 확인) → `prescription.ts`(verified 일 때만 처방). **시험이 `diagnosis_ready` 가 아니면 단계 관찰값이 생기지 않고 「분석 준비 중」**. 지금 ready 는 M2409 1회뿐 — 다른 시험 1회를 입력하면 축 · 단계 관찰은 비고 점수 흐름만 보인다. 근거 수준은 전부 `rule_proxy`(유형 상속) |
| 2 | 목표 점수가 영역 · TASK · 학습 요구량에 주는 영향 | **부분 구현** | `target.ts splitMust` 가 목표(G)로 「놓쳐도 되는 점수(100−G)」 예산을 정해 라인 목표율 · 집계 상태(met/near/short/hold)를 바꾼다. 그러나 **focus · 우선순위 · 처방은 목표와 무관**(`learner-path.ts` 주석 「관찰값 기준 · 목표 점수와 무관」, learner-path · prescription · axis-routing 에 goal 참조 0). 학습 요구량(정량 계획) 계산은 **미구현**. goal-view 는 「목표 − 최근 원점수」와 단계별 배점 사실만(역산 금지) |
| 3 | 54라인 중 실제 학습 수행 목표 | **부분 구현**(정의만) | 수행 목표 성격의 라인은 11이다. 지금 학습 요구를 만들 수 있는 것은 5(A1 · A2 · A3 · A5 · A8)이고, 6(A7 · A9 · J1 · J2 · J3 · J5)은 대상 TASK 가 전부 정본 보류(L · X)라 요구 0. 그중 앱 안 직접 확인이 도는 것은 A3 · A5(+ A4 facet) 계열뿐. B 13 은 문항 렌즈, C 8 은 선지 특성, D · I 는 습관 · 방법 · 퇴출, J4 는 맥락. 라인별 판단은 코드북 §4 |
| 4 | 183 활동 중 학습자가 실행 가능한 것 | **부분 구현** | 앱 안 채점 · 기록되는 활동: **3(B6-3 · A4-4 · A5-4, active)** + draft 1(A3-4). 나머지 179개는 완료 체크(`csat_map_task_done` 토글)만 — 실행 · 증거 기록 없음. 분류: DC 55 · LA 45 · LM 31 · MG 28 · MC 24 · **수행 목표 TASK 0** |
| 5 | pending 관계 160개의 UI · 추천 취급 | **부분 구현**(표시만) | UI: `LearningMap.tsx` 점선(`s.edgePending`) · 팝업 근거 탭 개수 칩. `graph.ts pathOf` 는 basis 구분 없이 경로에 포함(**하이라이트 경로에 pending 이 섞인다**). 추천(learner-path · prescription)은 edge 를 쓰지 않는다 → 추천에는 영향 0. (`held-links.test.ts` 는 pending 연결선이 아니라 보류 문항 제외 테스트) |
| 6 | 직접 확인 가능한 영역 · TASK | **부분 구현** | live: structure(claim-support 9문항) · option(option-restate 6) · evidence(evidence-locate 5). ready: relation(cohesion-link 1문항 — 2개 이상 필요). content_needed: vocab · sentence. blocked: integrate(X) · 듣기 4. 규칙: `skill-diagnosis.ts` — 서로 다른 2문항 독립 실패 = verified, 이후 다른 2문항 연속 정답 = resolved, 120일 만료, 도움 · 해설 뒤 · 시각 불확실 · 연습 화면 기록 제외. **실제 학습자 검증 0**(합성만) |
| 7 | PLAN · Workspace 재사용 기능 | **부분 구현** | 계획 객체(기간 · 분량 · 순서 · 버전) **없음**. 재사용: `learnerPath`(단계 + focus) · `prescription.ts`(4단계 · `activityFrame` · `groupByStage`) · `lifecycle-evidence.ts`(바로잡기 · 적용을 실제 수행 기록으로 판정) · `learning_sessions.review_at`(복습 예약) · `learning_decisions`(추천 · 근거 기록, fingerprint 멱등) · `useTaskDone` · StepSheet. funnel 이벤트 `csat_workspace_created/edited/opened/session_started/suggestion_applied` 는 DB 허용 목록(`20261008160000` CHECK)에만 있다 — `apps/web/src` 사용 0([실측] grep) |
| 8 | 교재 생성 파이프라인 ↔ TASK 연결 데이터 계약 | **미구현**(결속점은 있음) | 교재(`scripts/textbook/*` 드레인)의 단위에는 지도 · 원리 키가 없다([추정] — textbook 테이블에서 map/knowledge 키를 찾지 못함). 실제로 쓰이는 결속점은 `knowledge_applications(surface, surface_ref, status, audience.items)` → `loadMapPracticeLinks` → `MapPracticeLink` 와 `learning_task_attempts(task_key, item_ref, content_hash, phase)`. Workspace 는 이 두 계약에 붙인다(WORKSPACE_CONTRACT §5) |
| 9 | 새 시험 추가 시 이전 분석 · 계획 갱신 | **부분 구현** | 세션마다 스냅샷 생성(`diagnosis/server.ts`), 열 때 stale 이면 재계산(`stale.ts`: engine 버전 · 상태 · den). 목표율 · 성취율은 저장 안 함(조회 때 계산). **계획이 없어 「계획 갱신」 개념 없음**, 이전 분석과의 차이 · 이력 없음(learning_decisions 의 시점 기록뿐). 점수 흐름은 `taken_at`(시험일) 순, 동률 `created_at` |
| 10 | 필요한 신규 · 재사용 데이터 구조 | 설계 완료(이 1차) | [MIGRATION_PLAN](./LEARNING_MAP_MIGRATION_PLAN.md) §2 — 재사용 11 · 신규 제안 6(+ 보류 2) |

## 3. 시험 기록 입력의 현재 동작(코드 근거)

| 시나리오 | 현재 | 판정 |
|---|---|---|
| 최신 시험 1회 | 위 Q1 — ready 시험이면 단계 관찰, 아니면 「분석 준비 중」 | 부분 구현 |
| 과거 시험 1회 | 같은 경로 — `taken_at` 이 과거여도 「지금」 지도로 취급(시점 구분 없음) | 부분 구현 |
| 과거 여러 회 · 누적 | 스냅샷 trend 전체를 `taken_at` 순으로 · goal-view latest/previous 는 2회 이상일 때 | 부분 구현 |
| 기존 기록에 새 시험 추가 | 새 스냅샷 · 열 때 재계산 · 이력 비교 없음 | 부분 구현 |
| 과거 시점 지도 재현(as-of) | 경로 없음 — 최신 스냅샷만 읽고, `now` 는 기한 판정에만 | **미구현** |
| 목표 미설정 | 기본값 100 으로 계산하되 「정한 목표」로 보이지 않음(goal-view 상태 A) — 현재 상태 지도는 그대로 생성 | 구현됨 |
| 목표 신규 설정 · 변경 | `PUT /api/csat/diagnosis/map/goal` → `csat_map_goal` 덮어쓰기(이력 없음) | 부분 구현 |
| 시험 간 원점수 동등화 | 하지 않음 — 원점수 · 저장 등급을 그대로 나열 | 미구현(의도적으로 금지할 것) |

## 4. 기존 정본 · 장부와의 차이(새로 확인한 것)

1. **DB 축 ≠ 학생 축**: 보고서가 「6개 핵심축 V/S/R/E/L/X」 와 「A/B/C/D/I/J 54라인」 을 같은 계층처럼 적었다. DB 의 6축은 A–J 이고 V–X 는 계산 표시다 — rev4 는 둘을 이름부터 분리한다(ARCHITECTURE §2).
2. **`learning_goals` 테이블 부재** — 저장소 마이그레이션은 있으나 개발 DB 에 없다. rev4 목표 모델은 `csat_map_goal` 을 출발점으로 삼는다(MIGRATION_PLAN §2).
3. **`graph.ts pathOf` 가 pending 연결선을 경로 강조에 쓴다** — 추천엔 영향 없지만, 화면 경로가 확정 관계처럼 보일 수 있다. GAP-07 로 기록(MIGRATION_PLAN §5) · 이번엔 고치지 않는다(UI 변경 금지 범위).
4. **과제 183 중 같은 활동이 여러 라인에 복제** — 「끌린 이유 한 줄」 7개(C1-3…C7-3) · 「예상 답 먼저 쓰기」 계열(B10-1 · D1-2 · I10-2) · 「근거 번호 쓰기」(C7-1 · D3-1). rev4 에서는 활동 1개 · TASK 연결 N 으로 정규화 후보(데이터 삭제 아님).
5. **목표가 처방 · 우선순위에 쓰이지 않는다** — 정본 §목표 중심(10-08)이 의도적으로 「역산 금지」를 정했다. rev4 의 To-Be Map 은 이 금지를 지키면서 **목표 대비 「확인이 필요한 TASK」 우선순위**만 목표에서 끌어온다(EXAM_INPUT_CONTRACT §5 — 점수 상승 예측은 여전히 금지).
6. **as-of 재현 불가** — 스냅샷은 시점별로 쌓이지만 지도 정의(노드 · 과제 · 적용)는 버전이 없다. 과거 시점 재현에는 정의 버전이 필요하다.

## 5. 회귀 확인

- `pnpm --filter web exec vitest run src/lib/csat/map src/components/csat/diagnosis/map` — 결과는 [MIGRATION_PLAN](./LEARNING_MAP_MIGRATION_PLAN.md) §7 에 기록(이 작업은 앱 코드를 바꾸지 않았다).
- 구조화 산출물 무결성: `node --test scripts/csat/map/v4/__tests__/codebook.test.mjs` — 8/8.
