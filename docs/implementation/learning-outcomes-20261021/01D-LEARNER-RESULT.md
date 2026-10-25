<!-- docs/implementation/learning-outcomes-20261021/01D-LEARNER-RESULT.md -->
# 1D 결과 — 받은 공장 교재를 열고 수행 기록으로 돌아오기

기준 `c78bf9bbd` · 작성 Claude Code(Opus 5.5) · 2026-10-21 · **커밋·push·SQL 적용·공유 DB 접속 없음.**

## 경과

1. **최초 세션** — 구현했지만 실행 권한이 없어 시험·타입·브라우저 모두 NOT_RUN 으로 넘겼다.
2. **Codex 실행** — 최초 새 시험 **34/34 통과**, 웹 타입 통과. 독립 추가 시험에서 **5개 실패**(Codex 로그 `production-1d-codex-before.log` — 이 작업공간에서는 찾지 못해 원문을 다시 보지 못했다. 실패 시험 자체는 파일에 남아 있어 그대로 유지했다):
   - PGlite: `factory_order_transition` 으로 requested→stock_search→delivered 뒤 받은 자료 열기가 false.
   - DTO: 다른 납품을 돌려준 열기 · `attempts` null/음수/비숫자가 성공으로 읽힘(`Number(x)||0`).
3. **수리 세션(이 문서)** — 아래 수정 후 그 5개를 포함해 전부 통과. 음성 대조로 시험이 실제로 결함을 잡는지 확인했다.

## 수정

| # | 무엇 | 어디 |
|---|---|---|
| 1 | 학습용 현재성 `factory_dcp_learning_current` 신설 — 같은 active Workspace · 최신 goal/plan · 수요 plan 결속은 그대로, 주문 상태는 delivered/partial · 진행 중 허용, **failed 거절**. 생산용 `factory_lineage_personal_current` 는 바꾸지 않았다(시험이 완료 주문에서 여전히 false 임을 단언). | SQL |
| 2 | `countOf` — 0 이상 정수 숫자만. 열기 · 목록 모두 null/음수/문자열/소수 → `bad_shape`. 열기 반환 납품 ≠ 요청 납품 → `bad_shape`. 제출 `csat_attempt_id` UUID · `replayed` boolean 확인. 목록 `last_correct` 는 boolean/null 만. | `dcp-learning.ts` |
| 3 | `csat_attempt_id uuid` FK→`csat_item_attempts(id)` · 채점 후 그 행의 user/dcp_item/is_correct 일치 확인(불일치 · 누락 · 비 UUID 는 예외 → 채점 시도 행까지 롤백) · `supply_writer_guard` 트리거 + 제출 함수의 `vocaflow.supply_writer='rpc'` · 현재성 조회 **전** 1C 와 같은 순서로 `map_goal`→`map_plan` 자문 잠금 → Workspace → 주문 → 납품 → 승인 → 등록 행 잠금(FOR SHARE). private helper · 원본 RPC 실행권은 학습자에게 열지 않았다. | SQL |
| 4 | 계측 `csat_factory_dcp_opened`(type·attempts) · `_submitted`(type·correct·replayed) · `_returned`(finished) — `events.ts` 계약 + 보류 SQL 에 `funnel_events_event_check` 확장(적용 시점 제약에서 기존 이름을 읽어 3개만 더함). `DcpPlayer` 에 선택 prop `doneCopy`·`onGraded`·`onBack` 추가(기본 동작 불변) — 공장 연습은 「연습 기록 · 목표 달성/향상 근거 아님 · 혼자 확인은 Workspace 의 다음 할 일」 로 끝나고 돌아가기는 같은 Workspace 의 기존 다음 행동. LEARNING_MODEL · MODULES 갱신. | Runner · DcpPlayer · events · docs |
| 5 | 키 = `crypto.randomUUID` 또는 `getRandomValues` v4, 실패 시 제출 안 함(시계 대체 제거) · 200 이어도 영수증 · 납품 · 실제 시도 UUID · evidence=false · replayed 가 없으면 완료 아님 · API Origin 은 스킴·host·포트 전체 비교(`null`·경로 붙은 Origin 거절) · 상한은 UTF-8 바이트 · 비로그인 진입은 `?next=` 에 검증한 지도 문맥을 실어 같은 Workspace 로 복귀. | Runner · route · page |
| 6 | 하네스: 빌드 CSS 가 없으면 실제 `src/app/globals.css` 를 앱 `tailwind.config.ts` 로 컴파일(@import 를 실제 패키지 파일로 펼침, dev 산출물 미사용) · esbuild 는 설치된 vitest→vite 의 것을 빌림(새 의존성 없음) · 계측 대역 추가 · 스펙은 하네스 없으면 **실패**(skip 제거). | 하네스 · 스펙 |

## 실행한 검증(이 세션 · 실제 실행)

| 명령 | 결과 |
|---|---|
| `pnpm --filter web exec vitest run --pool=forks --maxWorkers=1 --minWorkers=1` dcp-learning.pglite · dcp-learning · `src/app/api/csat/factory` · `src/components/csat/factory` · analytics wired/events | **6 파일 181/181 통과** (PGlite 27 · DTO 32 · route 16 · Runner 14 · events 34 · wired 58) |
| 같은 옵션으로 넓은 회귀: `factory-bridge` · `map/v62/__tests__` · `lib/csat/__tests__` · `diagnosis/map` · `csat/factory` · `api/csat/factory` · analytics 2 · `components/practice` | **136 파일 통과 · 1949 통과 · 50 skip**(skip 은 공유 DB 환경 키가 필요한 기존 `*.integration.test.ts` 7 파일 — 1D 와 무관, **미실행이지 통과 아님**) |
| 음성 대조: 열기 판정을 `factory_lineage_personal_current` 로 · 시도 일치 확인을 무력화해 실행 → 원복 | 완료 주문 시험 + 다른 사용자/다른 문항/정오 불일치 **4건 실패**(없는 id 는 FK 가 따로 막아 통과) → 원복 후 다시 통과 |
| `pnpm --filter web exec tsc --noEmit -p .` | 통과(출력 없음) |
| `pnpm --filter web exec eslint` 변경 파일 전부(서비스 · 시험 · route · page · Runner · DcpPlayer · Card · Modal · map-return · events · 하네스 · 스펙) | 0 경고 |
| `pnpm --filter web exec tsx scripts/build-factory-dcp-harness.mts` | 구움 671 KB · CSS = globals.css→tailwind 332 KB |
| `pnpm --filter web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/factory-dcp-runner.isolated.spec.ts` (Chromium 1440) | **1 passed · 0 skip** |

PGlite 시험 내용(실제 1B core + C→B→I1→I2→G2→D3→lineage→실제 `grade_dcp_item` 본문→1C→1D SQL): 완료 주문 열기·실제 채점 성공 / 같은 완료 주문에서 새 plan 판본 → `lineage_not_current` · 재전송은 저장 결과 / 닫힌 Workspace 거절 / failed 주문 거절 / 직접 insert writer 가드 거절 / 가짜·비UUID·정오 누락·다른 사용자·다른 문항·정오 불일치 → `query_failed` + 영수증·시도 행 증가 0 / 영수증 실패 주입 롤백 + 같은 키 복구 / 손상된 과거 납품(역할·TASK·구 판본·비DCP — PGlite 에서만 `session_replication_role=replica` 로 모사) → 열기·제출 모두 그 코드 / funnel CHECK(기존 이름 유지 · 3종 추가 · 모르는 이름 거절) / 기존 D1~D4.

브라우저 캡처 `apps/web/playwright-auth/shots-1d/01-read.png` · `02-save-failed.png` · `03-graded.png` · `04-done.png` — 03·04 를 눈으로 봤다: 앱 토큰(배경·테두리·주 버튼색) 적용, 완료 문구에 향상 주장 없음. 웹폰트는 layout.tsx 가 따로 불러 하네스에 없다(대체 서체). 기존 DcpPlayer 진행 막대가 1/1 에서 절반으로 보이는 것은 1D 이전 동작이라 손대지 않았다.

**대역(명시)**: 하네스는 `next/link`·`dcp-actions`·`analytics/client` 심, 제출 응답은 `page.route` — **실제 `/csat/factory/[id]` 서버 페이지 · 쿠키 인증 · DB 를 거친 E2E 가 아니다.** route 시험은 `learnerContext` 와 supabase `rpc` 대역.

## Codex 최종 확인

수리 후 직접 실행한 SQL·DTO·API·Runner 4파일 **89/89 통과**. 브라우저 하네스에 실제 CsatShell CSS module의 root 선택자를 결속해 3B 토큰 범위 누락을 수정했다(토큰 값 복제 없음). 하네스 재생성 후 Chromium **1/1 통과**, 완료 캡처를 직접 확인했다. 레일·상단 바·웹폰트·실로그인/DB는 여전히 하네스 범위 밖이며 참조 일치 검증을 했다는 의미는 아니다. 생성 HTML은 저장소에 커밋하지 않고 명령으로 재생성한다.

## 남은 2 경계(미실행 · 사실대로)

1. **실제 두 연결 동시성 · RLS · 쿠키 인증 · 공유 DB** — PGlite 는 슈퍼유저 단일 연결이다. 잠금 순서는 코드로 1C 와 맞췄지만 동시 실행은 NOT_RUN. 보류 SQL 적용(L4 사용자 승인) 뒤 실제 auth/DB E2E 가 필요하다. 계측도 SQL 적용 전에는 서버가 거절해 0건이며 `db-allowlist.integration.test.ts`(공유 DB)는 실행하지 않았다.
2. **단계 2** — 계획 전체 재평가 · 저장, G2 `learning_sessions`/`learning_task_attempts` 결합, 독립 미노출 자료, authored SQL 의 사람 판단 요구를 AI 판정 기록 호환 경로로 대체하는 일. 이번 단계는 그것을 완료하지 않았고 human-reviewed 를 위조·우회하지 않았다. authored JSON 은 건드리지 않았다.

## 바뀐 파일(이 수리 세션)

SQL `_pending_factory_dcp_learning.sql` · `dcp-learning.ts` · 시험 `dcp-learning.pglite.test.ts` · `dcp-learning.test.ts` · 새 `app/api/csat/factory/__tests__/factory-routes.test.ts` · 새 `components/csat/factory/__tests__/factory-dcp-runner.test.ts` · `FactoryDcpRunner.tsx` · `components/practice/DcpPlayer.tsx`(선택 prop) · attempt `route.ts` · `page.tsx` · `lib/analytics/events.ts` · `analytics/__tests__/events.test.ts` · 하네스 · 스펙 · 문서 DB_SCHEMA · ROUTES · CHANGELOG · LEARNING_MODEL · MODULES. 생성물 `tests/fixtures/factory-dcp-harness.html` · `playwright-auth/shots-1d/*`.
