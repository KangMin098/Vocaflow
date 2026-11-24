<!-- docs/implementation/learning-outcomes-20261021/02C-REASSESS-PLAN-RESULT.md -->
# 2C 결과 — 설명 재진입 복원 · 독립 확인 → 실제 계획 버전 저장

2026-10-21 · 기준 HEAD `9a35d7060`(미커밋 작업 트리) · Claude Code(Opus 5.5) · 새 SQL 없음 · 공유 DB 조회/쓰기 0 · 커밋/push 없음.

## 결론

- **재계획 저장: PASS(격리 PGlite, 정본 SQL)** — 같은 학습자 A 의 `ws.central-meaning` Workspace 에서 계획 v1(initial) → 원문 안내 연습 3단계 설명 저장 → 2A AI 검토 5문항 등록(사람 결정 0) → 계산된 계획 보기(stage `check`)로 공급 = 미노출 `r5-cm-ind-2`·`ind-3` 만 → 실제 `recordAuthoredAttempt` 채점(오답 2 · 합성 회귀) · `learning_task_attempts` 2행 · G2 결속 evidence=true 2 → 기존 asIsMap(`verified_need`) → workspacePlan(stage `repair`) → `buildCommitPayload` → `commitPlan` → **`learner_workspace_plan_commit` 이 plan_version 2 · reason `check_result` · goal_version_id = 현재 목표를 DB 에 저장**. v2 의 `plan.tasks[r.central_meaning].stage = 'repair'`, v1 은 `check` 그대로(추가 전용).
- **재진입 복원: PASS** — `savedReflection` 이 저장된 본문 · 형성 피드백 · 다음 단계를 읽고, 그 동안 `factory_dcp_attempt` · `csat_item_attempts` · `source_lesson_reflection` 행 수 불변.
- 효과 주장 없음: 일반 독해 R0 완성 · 실제 학생 효능 · 모델 학습 지속 · 달력 기억 유지를 주장하지 않는다. 오답 응답은 Gold 로 만든 **합성 회귀**이며 AI 학습자 관측이 아니다.

## 변경(9 파일 + 이 문서)

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/csat/map/v62/factory-bridge/source-lesson.ts` | `savedReflection(c, userId, deliveryId)` · `SavedReflection` · `ReflectionReader`. 먼저 `source_lesson_progress`(현재성 · 소유 · 판본)가 ok 이고 이 납품 단계가 reflected 일 때만, `user_id`·`delivery_id`·`workspace_id`(진행이 확인한 값)·`lesson_sha256` 로 좁혀 `source_lesson_reflection` 1행을 읽는다(RLS 본인 SELECT 와 이중). 본문은 `parseReflectionRequest` 로 닫힌 모양 재검사 · 행 0/2 = bad_shape. INSERT · 채점 호출 없음 |
| `apps/web/src/app/(app)/csat/factory/[deliveryId]/page.tsx` | 교수 자료 납품이면 서버에서 `savedReflection` → `lesson.restored` / `restoreFailed`(미설치는 실패로 보지 않음) |
| `apps/web/src/components/csat/factory/FactoryDcpRunner.tsx` | 복원이면 `DcpPlayer`(풀이 · 제출) 대신 「이미 풀고 설명을 저장했어요」 안내 + 저장값 패널 · 읽기 실패면 경고만(새 풀이로 덮지 않음). source-lesson import 는 계속 type-only |
| `apps/web/src/components/csat/factory/SourceLessonPanel.tsx` | `restored` 로 칸 초기화 · 잠금 · 저장 버튼 없음 · 「앞서 저장한 설명이에요」 · 다음 단계/Workspace 링크. 요지 시범은 기존 GET(저장된 풀이 확인 뒤) 그대로 |
| `apps/web/src/lib/csat/map/v62/factory-bridge/__tests__/reassess-plan.pglite.test.ts` | 신규 결합 설치 종단 9 시험 |
| `apps/web/scripts/build-factory-dcp-harness.mts` · `apps/web/tests/e2e-isolated/source-lesson.isolated.spec.ts` | 하네스 `#restore=1|fail`(닫힌 복원 값 — 빌드 시 `formativeFeedback` 으로 계산, 교수 JSON 은 브라우저에 안 들어감) · 브라우저 2 시나리오 |
| `docs/LEARNING_MODEL.md` · `docs/MODULES.md` · `docs/CHANGELOG.md` · `00-ROADMAP.md` | 계약 갱신. `ROUTES.md`(라우트 추가 · 응답 변경 없음) · `DB_SCHEMA.md`(SQL 변경 없음 — 기존 `slr_own_read` 를 읽기만)는 계약이 바뀌지 않아 고치지 않았다 |

## 결합 설치 순서(실제 PGlite 적용 · 한 DB)

시험 사본 `supply-stub.sql` 에서 `csat_map_goal_version`·`learner_workspace`·`learner_workspace_plan` 블록을 **빼고**(나머지 STUB 그대로) → `supply-i1-stub.sql` → PRE(G2 열 · grade 전제 · `service_role` · `funnel_events` · 최신 목표 표 `csat_map_goal` 최소 사본) → **정본 `20261010180218_map_v4_plan.sql` → `20261010181834_map_v4_plan_conflict_code.sql`** → C → B → `_pending_workspace_supply_i1_safety` → `_pending_workspace_supply_i1_partial` → `20261018120000_…c_annotation_binding` → `20261018120100_r5_delivery_g2_binding` → `20261020063000_factory_product_order_lineage_v1`(D3) → 실제 `grade_dcp_item` 정의(20260920120000) → `_pending_authored_supply` → `_pending_authored_ai_review` → `_pending_factory_dcp_admission` → `_pending_factory_dcp_learning` → (함수 기본 EXECUTE 재현) → `_pending_source_lesson_reflection`.
기존 스위트(dcp-learning · ai-review · authored-flow)는 시험 사본 계획 표를 쓰고, 이 스위트만 정본 계획 RPC 를 쓴다.

## 실행 명령 · 결과(Git Bash, 이 worktree)

| 명령 | 결과 |
|---|---|
| `pnpm --filter web exec vitest run src/lib/csat/map/v62/factory-bridge/__tests__/reassess-plan.pglite.test.ts` | **PASS 9/9** |
| `pnpm --filter web exec vitest run src/components/csat/factory src/app/api/csat/factory src/app/api/csat/diagnosis/map src/lib/csat/map/v62/factory-bridge src/lib/csat/map/v4 src/lib/csat/authored` | **PASS 30 파일 · 490 시험 · skip 0** |
| `pnpm --filter web exec tsc --noEmit -p .` | PASS(최종 편집 뒤 재실행) |
| `pnpm --filter web exec eslint <변경 ts/tsx/mts 7개>` | PASS(미사용 import 1건 수정 뒤) |
| `pnpm --dir apps/web exec tsx scripts/build-factory-dcp-harness.mts` | 구움 724 KB · CSS `globals.css → tailwind` 332 KB(교수 JSON 입력 그래프 가드 통과) |
| `pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/source-lesson.isolated.spec.ts tests/e2e-isolated/factory-dcp-runner.isolated.spec.ts` | **6 passed · 0 skip**(2B 3 + 1D 1 + 2C 2) · Chromium 1440 |

캡처(커밋 대상 아님) `apps/web/playwright-auth/shots-2b/06-main-restored.png` 를 직접 봤다: 복원 안내 · 시범 3부분 · 문장 목록 · 저장값(주장 7 · 근거 4, 0-based 6/3) 잠금 · 「앞서 저장한 설명이에요」 · 「다음: 같은 글의 제목」. `07-topic-restored.png` 는 보지 않았다.

## PGlite 단언(실제 SQL · 실제 서비스 함수)

1. 정본 `learner_workspace_plan_commit` 존재 · `csat_map_goal_set`(setGoal) → 목표 g1 · initial v1(Workspace 를 RPC 가 생성) · goal_version_id=g1.
2. 같은 Workspace(template `ws.central-meaning`, plan v1, goal g1)의 수요 줄로 1C 등록 → 승인 → 1D 납품 3 → 실제 `factory_dcp_attempt` 3 → `source_lesson_reflect` 3(납품 기대값 전달).
3. 복원: 요지 본문 동일 · claim accepted · next=title 납품 · 주제 procedure 복원 · next=null · DTO 키 6개만(정답 키 · 시범 없음) · 세 원장 행 수 불변.
4. 타인 B = `not_found` · 이 시점 `learning_task_attempts`=0 · `workspace_delivery_attempt`=0(안내 기록은 G2 아님).
5. `recordAiReviewedSupply` 실제 영수증/v3 바이트 → `content_ai_decision` 5 · `content_human_decision` 0 · 계산된 view(stage check)로 공급 = ind-2 · ind-3 · 재요청 새 납품 0.
6. 오답 2(합성) → 결속 bound/evidence=true · `learning_task_attempts` 는 authored 2행뿐(원문 3문항은 들어가지 않음 — 같은 원문 3문항을 독립 3지문으로 세지 않음) · As-Is `verified_need` · stage `repair`.
7. route.ts POST 순서(`postPlan`)로 `check_result` → v2 저장 · 같은 키 같은 본문(응답 유실 재시도) = reused v2 · 같은 키 다른 note = `client_key_reused` · 낡은 expectedVersion 1 = `conflict`(RPC `plan_version_conflict`) · 행 2.
8. 새 목표 g2 → 낡은 expectedGoalVersion = `goal_changed` · `goal_change` v3(goal g2) · B 가 A 기대 버전으로 = conflict · B 행 0 · `UPDATE` 계획 행 = 추가 전용 거절.
9. 새 계획 뒤 원문 연습 `openFactoryDelivery` = `lineage_not_current` · `lessonProgress`/`savedReflection` 실패(구계획은 현재 학습으로 보이지 않음) · 설명 3행 보존.

## 실제 vs 대역 경계

- **실제**: 위 SQL 전부 · `submitFactoryAttempt` · `submitReflection` · `lessonProgress` · `savedReflection` · `recordAiReviewedSupply` · `requestAuthoredSupply` · `recordAuthoredAttempt` · `applyAuthoredBindings` · `asIsMap` · `toBeMap` · `planWorkspaces` · `workspacePlan` · `parseCommitRequest` · `buildCommitPayload` · `sameCommitRequest` · `setGoal` · `storeStatus` · `loadSavedPlans` · `commitPlan` · 실제 PROD 컴포넌트 · 앱 CSS.
- **대역**: 인증 세션(`learnerContext`) · `loadMapPage`(시험 회차 · 축 대리 · 기준 45문항 · 확인 링크는 authored-flow 와 같은 합성값, 창작 납품만 링크로 사용) · `composeV4` 대신 같은 하위 함수 직접 호출(composeV4 의 opts/restoreTransfer 없음) · `findCommitByKey`(PostgREST 임베드라 같은 PriorCommit 을 SQL join 으로 읽음) · `nextActionOf`(ranks 입력이 필요해 호출하지 않음 — 단계 판정은 workspacePlan 의 stage 로 단언) · G2 쓰기 어댑터 시험 사본 · 브라우저의 `/attempt`·`/lesson` 응답과 복원 값(page.route · 하네스 고정 값).
- route 핸들러 자체(`/api/csat/diagnosis/map/plan` POST)를 HTTP 로 부르지 않았다 — 같은 함수 순서를 시험 함수가 재현했다.

## PASS / SKIP / NOT_RUN

- PASS: 위 표.
- SKIP: 없음.
- NOT_RUN: 실제 Supabase 인증 · RLS(PGlite 슈퍼유저) · 두 연결 동시성(철회 vs 저장 · 같은 키 동시 커밋) · 실로그인 E2E · 실제 route HTTP 호출 · `loadMapPage`/`composeV4`/`nextActionOf` 실입력 · 계획 저장 오류 → 재시도의 **브라우저** 화면(기존 계획 UI 는 이번에 바꾸지 않았고 브라우저로 확인하지 않음) · `pnpm turbo` 전체 · `next build` · 공유 DB 적용 · `lock.mjs acquire/release claude-code`(실행하지 않았다 — 다른 쓰기 세션과 겹치지 않았는지 커밋 전 확인 필요).

## 남은 위험

Codex가 직접 관련25개 시험을 재실행해 통과했다. 다만 목적 검토에서 **실제 전체 학습 순서의 누락**을 확인했다. source DCP 시도/설명은 기존 loadMapPage의 repairTargets/lifecycleActivity로 들어가지 않아 canonical repairGate를 진전시키지 않는다. 현재 종단 시험은 초기check 계획에 수동 guided 수요를 먼저 만든 뒤 오답 독립 확인으로 repair 계획을 저장하므로, 실제 `check→repair→transfer→recheck` 흐름의 증명이 아니다. route POST도 복사한 순서이고 composeV4/nextActionOf는 실행하지 않았다. 이 결과는 설명 복원·SQL 계획 저장의 부분 수용이며 **2D에서 실제 경로와 순서를 완성**한다.

- 복원 읽기는 `source_lesson_progress` 가 ok 일 때만 한다 — 구계획 뒤에는 저장한 설명을 「이력」으로 보여 주는 화면이 없다(보존은 됨). 이력 보기와 새 학습 허용의 구분 UI 는 제품 결정.
- 실 Supabase 에서 `source_lesson_reflection` SELECT 는 RLS `slr_own_read` 에 기대며 서비스는 `user_id` 조건도 건다. 실제 RLS 는 미검증.
- 복원이면 요지 단계의 선택 답(「방금 제출한 내 답」)은 다시 보이지 않는다 — 영수증의 선택 번호를 읽는 닫힌 경로가 없다(새 SQL 필요, 이번 범위 밖).
- 하네스 생성물 `apps/web/tests/fixtures/factory-dcp-harness.html` 과 캡처는 커밋 대상이 아니다.
