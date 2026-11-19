<!-- docs/implementation/learning-outcomes-20261021/00-AUDIT-RESULT.md -->
# 단계 0 결과 — 실제 호출 경로 · 연결 공백 · 미확인 상태

작성 2026-10-21 · 기준 HEAD `c2af9ad71` (branch `feat/learning-outcomes-20261021`) · 작성 세션: Claude Code (Opus 5.5), 새 세션.

## 근거와 한계

- 근거: `D:/workspace/Vocaflow-AI-Control/runtime/learning-outcomes-20261021/preserved-research.md`(이전 세션 조사자 2명의 Glob·Grep·Read 결과, **검수되지 않은 조사**). 이번 세션에서 추가로 직접 읽은 파일은 아래 표에 `직접 확인`으로 적었다.
- 이전 조사에서 일부 저장소 전역 grep이 시간 초과됐다. 그 범위의 "없음"은 `apps/web/src`·`supabase/migrations` 한정이다.
- **테스트: NOT_VERIFIED.** 이전 세션의 Vitest가 worker 초기화 오류로 실패했고, 이번 단계 0에서는 지시에 따라 시험을 다시 돌리지 않았다. 아래 "테스트 있음"은 파일이 있다는 뜻일 뿐 통과를 뜻하지 않는다.
- **실 DB 상태: UNKNOWN.** migration 파일이 있다고 개발 DB에 적용됐다고 보지 않는다. `_pending_*.sql`은 미적용 전제다.
- 표기: `코드` = 파일·심벌 존재 · `제품 호출` = 라우트/페이지까지 닿는 호출부 · `실행` = 이번 작업에서 실행 확인(전부 NOT_VERIFIED) · `DB` = 실 DB 반영(전부 UNKNOWN).

### Codex 후속 확인 (단계 1A 구현 뒤)

위 표의 NOT_VERIFIED/UNKNOWN은 최초 조사 시점 기록이다. 이후 읽기 전용 `to_regclass`·information_schema 질의로 factory_order, factory_product_order, learner_workspace(_plan), workspace_content_delivery, workspace_delivery_attempt, learning_task_attempts 및 서비스가 읽는 열의 존재를 확인했다. 수요 줄의 역할 집계는 guided_practice 1건이었다(기능 검증 입력 후보이며 실제 학습자 수가 아님). 기존 기준선 47개와 신규 API 관련 웹 회귀 전체 205개, 공장 설계 5개, Codex 독립 반례 6개가 통과했다. 범위·원시 로그는 [1A Codex 검토](./01A-CODEX-REVIEW.md)에 적었다. 발행 상태만으로 이용권한을 인증하지 않으며 공장 초안 API는 원천 적격성/배포를 인증하지 않는다.

## 1. 일반 독해(R0, SD-R0-01 중등 일반 독해) 경로

결론: **일반 독해에는 목표 → 활동 → 응답 → 평가 → 다음 계획의 연결이 없다.** 조각(가입·어휘 진단·자료×활동 계획·리더·챕터 퀴즈·점수)만 따로 있다.

| 단계 | 코드 · 제품 호출 | 저장 | 상태 |
|---|---|---|---|
| 비로그인 체험 | `(marketing)/fit/page.tsx`(저장 안 함 명시) · `/library` 공개 | 없음 | 체험→계정 결속 **없음**(`signInAnonymously`·storage 인계 0, `?next=`만 유지) |
| 가입 | `(auth)/signup/page.tsx` → `handle_new_user()` | `user_profiles` | 연결됨 |
| 학습 목표 | **없음.** `learning_goals`는 `20260628160000`에서 만들고 `20260628200000`에서 drop. `docs/LEARNER_MANAGEMENT.md:59` 가 목표 대신 「자료×활동」 계획으로 결정 | — | **공백** |
| 수준 | `(main)/diagnostic` → `DiagnosticClient.tsx` | `user_diagnostic_results` · `user_profiles.current_v_level` | 어휘 수준만. 독해 수준 아님 |
| 계획 | `(main)/plan` → `lib/learner/plan-actions.ts` `savePlanItem`/`removePlanItem` | `study_plan_items(user_id, material_type, material_id, modules[])` UNIQUE(user, type, id) — `20260628200000` 직접 확인 | 목표·근거·revision 없음, 재계획 없음 |
| 오늘 할 일 | `(main)/hub` · `prescription-actions.ts` RPC `prescribe_today` | 읽기 전용 | 연결됨(결과 피드백 없음) |
| 읽기 | `(main)/text/[id]`, `/library/books/[bookId]` · `personalize.ts`(`reading_sessions` insert) · `mark-progress.ts` | `reading_sessions`, `texts.status` | 연결됨 |
| 이해 확인 문항 | `(main)/scriptquiz/play` → `components/game/scriptquiz/ScriptQuiz.tsx` · 채점 `lib/scriptquiz/grade-actions.ts` `gradeScriptQuizAnswer`(직접 확인) — book 소스는 RPC `select_book_chapter_quiz`를 서버에서 다시 불러 **문항 하나만 판정**, 정답은 답한 뒤에만 내려감 | 문항 `library_chapter_quiz(library_book_id, chapter_idx, q_order, question, options, correct_index, source_snippet, updated_at)` — `20260702120000` 직접 확인. **판본·해시 컬럼 없음** | 채점은 서버. **문항별 응답은 저장 안 됨** |
| 결과 기록 | `lib/scores/record-score.ts` `recordGameScore`(직접 확인) — **`'use client'`에서 `scores`에 직접 insert**, 실패는 삼킴 | `scores(score, correct_count, accuracy, content_ref, metadata)` | 세션 합계만. 점수는 **클라이언트가 보낸 값**(서버 재계산 없음) |
| 텍스트북 연습 | `/library/textbooks/[series]/[step]/practice` → `dcp-actions.ts` RPC `grade_dcp_item` | `csat_item_attempts` | 일반 독해용이 아니라 CSAT 테이블에 씀 |
| 복습 | `(main)/wordvault/review` 단어 FSRS | `learning_records` | 낱말만. 지문·이해 복습 없음 |
| 신규 지문 전이 평가 | **없음**(전이·지연 역할은 CSAT `lib/knowledge/*`에만) | — | **공백** |
| 증거 기반 다음 계획 | **없음**(독해 결과가 `study_plan_items`로 돌아가지 않음) | — | **공백** |

### 재사용 판단

- **재사용(첫 구현의 뼈대):** 도서 챕터 리더 + `library_chapter_quiz` + `gradeScriptQuizAnswer`의 서버 채점 모양. 공개 도서·중등 수준 V-Level을 그대로 쓰므로 SD-R0-01을 바꾸지 않는다.
- **고쳐 쓸 것:** `recordGameScore`의 클라이언트 점수는 평가 증거로 쓸 수 없다(신뢰 경계 밖). 기존 `scores` 적재는 Hub·통계 호환으로 두고, 평가 증거는 서버/DB가 판정한 문항별 응답에서만 만든다.
- **없음 → 새로 필요:** 독해 목표 객체, 문항별 응답 기록, 노출 판정(이미 읽거나 푼 챕터인지), 다음 계획 기록. 모두 DB 객체가 필요하다 → L4 승인 대상(01-E2E-SPEC §7).

## 2. CSAT 특화 경로 (재사용 자산 — R0 완료 근거로 쓰지 않는다)

| 모듈 (`apps/web/src/lib/csat/map/v62/…`) | 코드 | 제품 호출 | 메모 |
|---|---|---|---|
| `map/load.ts` `loadMapPage` | 있음 | `(app)/csat/page.tsx`, `(app)/csat/diagnosis/page.tsx`, `map/plan`·`authored/supply` 라우트 | 지도 허브 |
| `target-goal.ts` · `lib/csat/map/server.ts` `setGoal` | 있음 | `api/csat/diagnosis/map/goal` PUT | goal version + client key, 재생 후 `sameGoal` 409 |
| plan-store `learner_workspace_plan_commit` | 있음 | `map/plan` 라우트(`expectedVersion`·`expectedGoalVersion`) | 낙관적 동시성 — **패턴 재사용 가치 높음** |
| `delivery-binding.ts` `bindDeliveryAttempt`·`bindingRequestKey` | 있음 | `api/csat/item/[slug]/task`, `api/csat/delivery/bind`, `authored/[id]/attempt` | 서버 유도 멱등 키(sha256(user, clientMutationId)) — **패턴 재사용** |
| `assessment-exposure.ts` `unexposedForAssessment`·`reservedPracticePool` | 있음(순수) | `load.ts`, `knowledge/practice-server.ts` | 미노출 판정 — 개념 재사용, 입력은 CSAT 원장 |
| `exposure-ledger.ts` `loadExposureLedger` | 있음 | `load.ts`, `practice-server.ts` | 원장 7개 · 잘림 시 fail-closed — **fail-closed 규칙 재사용** |
| `next-action.ts` `nextActionOf`·`replanNeeded` | 있음(순수) | `GoalRecordBar.tsx`, `TaskInspector.tsx` | **클라이언트에서 계산, 저장 안 됨** |
| `lib/knowledge/protocol.ts` `evaluateProtocol` | 있음(순수) | `(app)/csat/practice/[slug]/page.tsx` | 직접 테스트 파일 없음(조사 기준) |
| `supply-store.ts` `loadSupplyLedger` | 있음 | `load.ts`, `AdminWorkspaceSupply.tsx` | RPC `workspace_line_fulfillment`는 `_pending_*`에만 → null 폴백 |
| `factory-bridge/*`(crosswalk·material-unit·stock-resolver·production-need·lineage) · `factory-integration.ts` · `factory-mock.ts` · `order-spec.ts` · `production-pilot.ts` · `persist-contract.ts`(상태기계) | 있음 | **제품 호출 없음**(테스트·라이브러리 내부만, `lineage.ts`는 importer 0) | 계보·주문 타입만 있고 제품 연결 없음 |
| `factory-bridge/order-lineage.ts` | 있음 | `api/admin/csat/product-order-lineage` · `AdminWorkspaceSupply.tsx` | Admin 전용. RPC `factory_lineage_read` 등(`20261020063000`) |

교재공장(`packages/library-pipeline/src/textbook`, `scripts/textbook`): `assemble-unit`은 스크립트에서, `compose-unit`·`buildDossier`는 학습자 교재 페이지에서 호출. `factory-order*`·`academic-reading`은 export만 있고 앱 제품 호출 0(테스트 픽스처만). `scripts/` 전역 호출 여부는 **UNKNOWN**(grep 시간 초과). 렌더된 HTML 교재·factory_order 산출물을 학습자에게 보여주는 라우트는 없다.

## 3. 식별자·신뢰 경계 현황

| 개념 | CSAT 경로 | 일반 독해 경로 |
|---|---|---|
| 목표 id/revision | `csat_map_goal_version` (서버) | **없음** |
| 계획 revision | `learner_workspace_plan` + expectedVersion (서버) | `study_plan_items` revision 없음 |
| 요청 멱등 키 | client key + 서버 재검증, `bindingRequestKey` | **없음**(scores insert 재실행 시 중복 가능, StrictMode는 ref로만 막음) |
| Product Order revision/hash | Admin 입력, 서버·RPC 재계산 | 해당 없음(단계 1 비목표) |
| 콘텐츠 판본/해시 | `supply_artifact_revision`, `content_hash` | **없음** — `library_chapter_quiz.updated_at`뿐 |
| delivery id | 클라이언트 제출 → 서버 소유권 재검증 | 해당 없음(공개 도서) |
| attempt id | `learning_task_attempts` client_mutation_id | **없음**(문항 응답 미저장) |
| 노출/미노출 | 서버 fail-closed | **없음** |
| 다음 계획 | 클라이언트 계산, 미저장 | **없음** |

## 4. 테스트 자산 (파일 존재 · 실행 NOT_VERIFIED)

- CSAT 단위·PGlite: `lib/csat/map/v62/__tests__/*`(delivery-binding, r5-delivery-g2-binding.pglite, goal-*, next-action 등). PGlite 패턴은 일반 독해 신규 DB 객체 격리 검증에 재사용한다.
- 격리 Playwright: `apps/web/tests/e2e-isolated/*` — **전부 CSAT**. 일반 독해·체험·가입 격리 spec 0. CI(`.github/workflows/ci.yml:207-299`)는 로컬 Supabase에 migration을 파일별 적용 후 seed → build → Playwright.
- 공유 DB spec(일반 독해 관련): `05-learner-loop`(ScriptQuiz 완주→scores), `06-chapter-launch`, `05-plan-picker`, `23-word-web-reader`. 공유 DB 쓰기를 하므로 이번 작업에서 실행하지 않는다.

## 5. 미확인 목록

| 항목 | 상태 |
|---|---|
| 기존 Vitest 통과 여부 | NOT_VERIFIED (worker 초기화 오류, 재실행 안 함) |
| 개발 DB에 관련 migration 적용 여부 | UNKNOWN |
| `select_book_chapter_quiz` 반환 컬럼의 실 DB 형태 | 코드상 `id, correct_index, source_snippet …` · DB UNKNOWN |
| 중등 수준 도서 중 챕터 퀴즈가 2챕터 이상 있는 도서 수 | UNKNOWN — 단계 1 구현 첫 단계에서 읽기 전용 조회 또는 격리 시드로 대체 |
| `scripts/` 내 factory-order 호출 | UNKNOWN |
| 콘텐츠 이용권한(도서) | 이번 범위에서 재판정하지 않음 — 이미 published인 도서만 사용 |
