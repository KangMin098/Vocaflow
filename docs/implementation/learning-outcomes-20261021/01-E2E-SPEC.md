<!-- docs/implementation/learning-outcomes-20261021/01-E2E-SPEC.md -->
# 단계 1 — 일반 독해 한 목표의 E2E (최소 첫 구현)

> **Codex 검토: REJECTED — 구현하지 않는다.** 교재공장 주문·생산·Workspace 연결이 비목표로 빠져 원 요청에서 이탈했다. 정답률 0.8/0.5의 임의 처방도 검증되지 않았다. 후속 실행 계약은 `01A-DEMAND-ORDER-SPEC.md`다. 이 문서는 초안 검토 기록으로만 보존한다.

근거: [00-AUDIT-RESULT](./00-AUDIT-RESULT.md) · 목표 VG-L3-B2-02 · 위험도 **L3**(학습기록·평가·데이터 결속) + DB 객체 추가 **L4**(승인 대상).

## 1. 범위 한 줄

공개 도서 챕터를 읽은 학습자가 **「근거 문장으로 내용 이해 확인」 목표**를 세우고 → 그 챕터 ScriptQuiz로 연습(practice) → **아직 노출되지 않은 다음 챕터** 퀴즈로 전이 확인(transfer) → 서버가 판정한 응답만으로 다음 계획(계속·다시·한 단계 쉽게)을 기록하고 화면에 보여준다.

- 대상: SD-R0-01 중등 일반 독해 · PC 웹. 도서는 `library_books.status='published'` 중 챕터 퀴즈가 2챕터 이상인 것. 고2·수능 사례는 쓰지 않는다.
- CSAT 지도·Workspace·교재공장 경로는 **고치지 않고** 패턴만 빌린다(멱등 키 · expectedVersion · fail-closed 노출). CSAT 경로 통과를 이 단계 완료로 보고하지 않는다.

## 2. 최소 활동 계약 (단계 1에 포함)

| 항목 | 값 |
|---|---|
| objective_code | `reading.comprehension.evidence` — 「글의 내용을 근거 문장으로 확인한다」 하나만 |
| activity | `chapter_quiz` (기존 `library_chapter_quiz` 문항 그대로, multiple/truefalse/blank) |
| role | `practice` = 목표의 기준 챕터 · `transfer` = 같은 도서의 다음 챕터 중 **미노출** 챕터 |
| response | `selected_index`(int, 시간초과 -1) · `client_mutation_id`(uuid) |
| 평가 | DB가 `correct_index`로 판정 · 문항 `content_hash` 기록 · 답한 뒤 `source_snippet`(근거 문장) 피드백 |
| 다음 계획 결정 | 순수 규칙 `decideNextReading`: transfer 정답률 ≥ 0.8 → `advance`(다음 챕터) · 0.5–0.8 → `consolidate`(같은 수준 다른 챕터) · < 0.5 또는 transfer 문항 < 3 → `reteach`(기준 챕터 다시 + 근거 찾기) · 판정 불가 → `insufficient` |

자기 설명·구조화 응답·도움 축소는 **단계 2**. FAST 제작은 단계 3. AI 학습자 비교는 단계 4 — 단, 단계 4가 쓰도록 attempt 행에 `actor_kind`(`learner`|`ai_simulated`)와 `role`·`exposure_basis`를 지금 남긴다.

## 3. 데이터 모델 (새 migration 1개 — **미적용 파일로만 작성**)

파일: `supabase/migrations/_pending_reading_outcome_r0.sql` (`_pending_` 접두사 = 자동 적용 대상 아님, 기존 관례).

```
reading_goal(
  id uuid pk, user_id uuid not null → auth.users on delete cascade,
  objective_code text not null check (= 'reading.comprehension.evidence'),
  book_id uuid not null → library_books, base_chapter_idx int not null,
  revision int not null default 1, status text check in ('active','closed'),
  client_key uuid not null, created_at, updated_at,
  unique(user_id, client_key), partial unique(user_id, book_id) where status='active')

reading_goal_attempt(
  id uuid pk, user_id uuid not null, goal_id uuid → reading_goal, goal_revision int not null,
  role text check in ('practice','transfer'), book_id uuid, chapter_idx int,
  question_id uuid → library_chapter_quiz, content_hash text not null,
  selected_index int not null, correct boolean not null,
  exposure_basis text not null,            -- 'base_chapter' | 'unexposed_checked'
  actor_kind text not null default 'learner' check in ('learner','ai_simulated'),
  client_mutation_id uuid not null, created_at,
  unique(user_id, client_mutation_id), unique(goal_id, goal_revision, question_id))

reading_goal_plan(
  id uuid pk, user_id uuid, goal_id uuid → reading_goal, goal_revision int,
  plan_revision int not null, decision text check in ('advance','consolidate','reteach','insufficient'),
  next_book_id uuid, next_chapter_idx int, evidence jsonb not null,   -- {transfer_n, transfer_correct, practice_n, practice_correct, attempt_ids[]}
  created_at, unique(goal_id, plan_revision))
```

- RLS: 세 테이블 모두 `select` 본인만. **insert/update 정책 없음** — 쓰기는 아래 SECURITY DEFINER RPC만(`search_path=''`, `auth.uid()` 필수, anon 거부).
- `content_hash` = `md5(question || options::text || correct_index::text)` (RPC 안에서 계산).
- RPC
  - `reading_goal_open(p_book_id, p_base_chapter_idx, p_client_key)` → goal 행. 같은 client_key 재호출 = 같은 행. 같은 도서 active goal이 이미 있으면 그 행 반환(새로 만들지 않음).
  - `reading_attempt_record(p_goal_id, p_goal_revision, p_role, p_question_id, p_selected_index, p_client_mutation_id)` → `{attempt_id, correct, correct_index, source_snippet, replay}`.
    - 소유자 아님/없는 goal → `42501`. goal_revision ≠ 현재 → `40001`(구버전). 문항이 그 role의 챕터 소속이 아님 → `22023`.
    - transfer: 문항 챕터가 `base_chapter_idx`와 다르고, 그 사용자에게 해당 (book, chapter)의 `reading_sessions`·`scores`(content_ref)·`reading_goal_attempt(practice)` 기록이 없을 때만. 기록 조회 실패는 **거부**(fail-closed).
    - 같은 client_mutation_id 재전송: 인자 같으면 기존 결과 `replay=true`, 다르면 `23505`→앱 409.
  - `reading_plan_commit(p_goal_id, p_goal_revision, p_expected_plan_revision)` → DB가 attempt를 집계해 결정 저장. expected 불일치 → `40001`. 클라이언트는 결정값을 보내지 않는다.
- 결정 규칙은 RPC(SQL)와 TS `decideNextReading`에 같은 경계값으로 두고 **PGlite 시험이 두 결과의 일치를 고정**한다.

## 4. 신뢰 경계

| 값 | 출처 | 서버가 하는 일 |
|---|---|---|
| user_id | 세션(`auth.uid()`) | 인자로 받지 않음 |
| book_id/chapter/question_id | 클라이언트 | RPC가 소속·발행 상태 재검증 |
| selected_index | 클라이언트 | 유일하게 믿는 학습자 입력 |
| correct · content_hash · exposure_basis · decision | **DB 계산만** | 클라이언트 값 무시 |
| goal_revision · expected_plan_revision | 클라이언트(동시성 토큰) | 불일치 시 거부 |
| client_key · client_mutation_id | 클라이언트 | 사용자별 유일, 재생 시 인자 동일성 확인 |
| actor_kind | 서버 액션 기본 `learner` | `ai_simulated`는 서비스 역할 스크립트만(단계 4) |

정답·`correct_index`·다른 문항 근거는 답하기 전 RSC/응답에 싣지 않는다(기존 `grade-actions.ts` 규칙 유지).

## 5. 코드·화면 변경 (목표 ≤ 20파일, 상한 29)

| # | 경로 | 내용 |
|---|---|---|
| 1 | `supabase/migrations/_pending_reading_outcome_r0.sql` | §3 (미적용) |
| 2 | `apps/web/src/lib/reading-outcome/decide.ts` | `decideNextReading(summary)` 순수 |
| 3 | `apps/web/src/lib/reading-outcome/actions.ts` (`'use server'`) | `openReadingGoal`, `recordReadingAttempt`, `commitReadingPlan`, `loadReadingGoal` — RPC 호출, 오류 코드 → `{ok:false, code:'forbidden'|'stale'|'conflict'|'not_connected'|'invalid'}`. RPC 없음(`PGRST202`/`42883`) = `not_connected`, **성공으로 바꾸지 않음** |
| 4 | `apps/web/src/lib/reading-outcome/transfer-target.ts` (server-only) | 다음 미노출 챕터 후보 조회(읽기 전용, 조회 실패 → null = 전이 불가 표시) |
| 5 | `apps/web/src/lib/reading-outcome/types.ts` | 결과·코드 타입 |
| 6 | `apps/web/src/components/game/scriptquiz/ScriptQuiz.tsx` | book 소스일 때 goal 모드: 각 답을 `recordReadingAttempt`로(기존 `gradeScriptQuizAnswer` 대신, goal 없으면 기존 경로 그대로). 실패는 오답으로 바꾸지 않고 「기록하지 못했어요」 |
| 7 | `apps/web/src/components/reading-outcome/GoalStartPanel.tsx` | 퀴즈 시작 전 목표 한 문장 + 시작 버튼(44px, focus 표시, `break-keep`) |
| 8 | `apps/web/src/components/reading-outcome/OutcomeCard.tsx` | 완료 화면: 연습/전이 정답 수 · 결정 · 다음 행동 링크 · `not_connected`면 「학습 기록 저장소가 아직 연결되지 않았어요」 |
| 9 | `apps/web/src/app/(main)/scriptquiz/play/page.tsx` | `?goal=` / `?role=` 읽기, `loadReadingGoal` 결과 전달 |
| 10 | `apps/web/src/app/(main)/plan/page.tsx` (또는 그 하위 컴포넌트 1개) | active goal의 최신 plan 1줄 표시 |
| 11 | `apps/web/src/lib/analytics/events.ts` | D2: `reading_goal_open`·`reading_attempt_record`·`reading_plan_commit` (속성은 숫자·불리언·닫힌 열거형) — **DB funnel CHECK는 승인 SQL에 함께 포함** |
| 12–16 | `apps/web/src/lib/reading-outcome/__tests__/{decide.test.ts, actions.test.ts, reading-outcome.pglite.test.ts}` · `components/reading-outcome/__tests__/OutcomeCard.test.tsx` | 단위·PGlite·컴포넌트 |
| 17 | `apps/web/tests/e2e-isolated/reading-outcome-r0.spec.ts` | 격리 브라우저 E2E |
| 18 | `scripts/ci/reading-outcome-isolated-seed.mjs` | 격리 DB 전용 도서 1권·3챕터·챕터당 퀴즈 4문항 시드 |
| 19 | `docs/implementation/learning-outcomes-20261021/01-E2E-RESULT.md` | 결과·증거 |
| 20 | `docs/ROUTES.md` 또는 `docs/LEARNER_MANAGEMENT.md` 중 계약이 바뀐 정본 1곳 | 목표 객체 부활 사실 |

CI 워크플로(`.github/workflows/ci.yml`)에 pending SQL·시드를 넣는 것은 원격 CI 변경이므로 이번 구현에서는 **로컬 격리 실행 명령으로만** 붙이고, 워크플로 편집은 승인 뒤 별도.

## 6. 상태 전이

```
(none) --open--> goal(active, r1)
goal --record practice x N--> goal --record transfer x M (미노출만)--> goal
goal --commit(expected=k)--> plan(k+1, decision)
plan.advance  → 다음 챕터를 base로 새 goal open 링크
plan.reteach  → 같은 챕터 리더 + 퀴즈 재시도(같은 goal, 문항 unique로 중복 응답 거부 → 새 revision 필요: goal revision+1 은 commit 후 `reteach`일 때만 RPC가 올림)
```

## 7. DB 승인 경계 (L4 — 사용자 승인 전 하지 않음)

| 승인 대상 | 내용 |
|---|---|
| A1 | `_pending_reading_outcome_r0.sql` 전체(테이블 3 · RLS · RPC 3 · grant) 개발 DB `jajenrevcbmrpaliomxv` 적용 |
| A2 | `funnel_events` 이벤트 CHECK에 3개 이름 추가(같은 파일 또는 별도 파일) |
| A3 | 복구안: 새 객체만 `DROP FUNCTION …; DROP TABLE reading_goal_plan, reading_goal_attempt, reading_goal;` — 기존 테이블 변경·데이터 삭제 없음 |

승인 없이 할 수 있는 것: 코드 전부, PGlite에 SQL을 올린 통합 시험, 로컬 Supabase(가능하면) 격리 E2E. 승인 전 개발 DB 화면은 `not_connected` 상태를 정직하게 보여야 하며, 그것을 E2E 통과로 세지 않는다.

## 8. 수용 기준

PASS는 명령·HEAD·출력이 있는 것만. 미실행은 NOT_RUN, 환경 부재는 EXTERNAL_PENDING.

| ID | 기준 | 검증 |
|---|---|---|
| AC1 | 목표 열기 → 연습 4 → 전이 4 → 계획 확정 → 완료 카드에 결정·다음 링크 | 격리 E2E(브라우저, 실제 서버 액션·RPC) |
| AC2 | 정답·`correct_index`가 답하기 전 HTML/RSC에 없음 | E2E 페이지 소스 단언 + 단위 |
| AC3 | 클라이언트가 `correct`·decision을 보내도 무시 | PGlite: RPC 인자에 없음 확인, 위조 호출 시 DB 판정 유지 |
| AC4 | 같은 client_mutation_id 재전송 → 행 1개, `replay=true`; 인자 다르면 conflict | PGlite + actions 단위 |
| AC5 | 타인 goal에 기록/조회 → forbidden, 0행 | PGlite 두 사용자 |
| AC6 | 구 goal_revision / 구 expected_plan_revision → stale, 저장 없음 | PGlite |
| AC7 | 이미 읽은(reading_sessions) 챕터를 transfer로 → 거부; 노출 조회 실패 → 거부 | PGlite |
| AC8 | RPC 없음 → `not_connected` 표시, 성공·오답으로 보이지 않음 | actions 단위 + 컴포넌트 |
| AC9 | 네트워크/RPC 오류 시 오답 처리 안 함, 재시도 시 중복 행 없음 | 컴포넌트 + PGlite |
| AC10 | TS `decideNextReading` 와 SQL 결정이 경계값 표 전부에서 일치 | PGlite 표 시험 |
| AC11 | goal 없는 기존 ScriptQuiz(book/text/sample) 동작·`scores` 적재 그대로 | 기존 관련 단위 + related vitest |
| AC12 | 변경 파일 < 30, typecheck·lint 통과 | `git diff --stat`, dev-mode checks |

## 9. 검증 명령 (apps/web 기준)

```
pnpm exec tsc --noEmit -p .
pnpm exec eslint <changed files>
pnpm exec vitest run src/lib/reading-outcome src/components/reading-outcome src/lib/scriptquiz
pnpm exec vitest related --run <changed files>
pnpm exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/reading-outcome-r0.spec.ts
```

Vitest worker 초기화 오류가 다시 나면 원인(설정·풀·Node 버전)을 고쳐 실행하고, 고치지 못하면 FAIL/NOT_RUN으로 기록한다. 격리 E2E는 로컬 Supabase(`supabase start`)가 없으면 EXTERNAL_PENDING. 공유 DB spec은 돌리지 않는다.

## 10. 비목표

- 체험→가입 결속(SD-R0-02), 교재공장·Product Order·Workspace 연결, CSAT 지도 변경, 자기 설명 활동, FAST, AI 비교 실험, `study_plan_items` 스키마 변경, 기존 데이터 수정·삭제, push·PR·main 병합·배포.
