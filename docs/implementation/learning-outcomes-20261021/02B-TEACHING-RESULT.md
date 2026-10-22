<!-- docs/implementation/learning-outcomes-20261021/02B-TEACHING-RESULT.md -->
# 2B 결과 — 원문 교수 자기 설명(부분 완료)

2026-10-21 · 구현 세션 Claude Code(Opus 5.5) · worktree `D:/workspace/Vocaflow-learning-outcomes-20261021-work` · 브랜치 `feat/learning-outcomes-20261021`(HEAD `ca5f18d13` 위 미커밋 변경). 커밋 · push · 병합 · 공유 DB 조회/쓰기 · 마이그레이션 적용 · 계정 생성 · 사람 진술은 하지 않았다. 새 AI 리뷰를 만들지 않았다(기존 수락 영수증만 사용).

**판정: 교수 활동(사양 필수 1·2·3·6)은 구현·격리 검증 PASS. 독립 평가 이동 → 실제 재계획 저장 종단(필수 4·5)은 NOT_RUN — 남은 일.** 학습 효과 · 실제 학생 향상 · validated_learning · 일반 독해 R0 · 달력 기억 유지는 주장하지 않는다.

## 바뀐 파일(26 — 증거 원본 3 · 문서 7 포함)

| 파일 | 내용 |
|---|---|
| `apps/web/src/lib/knowledge/authored/source-lesson-title-route.v3.json` | runtime `source-lesson-v3.json` **정확한 바이트 복사** — SHA-256 `0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0`(실측 · 시험이 파일 바이트로 대조). 원천 파생 · authored 로 등록하지 않음 |
| `docs/implementation/learning-outcomes-20261021/evidence/2b-teaching/claude-a4b83165/{input,result}.txt,session.json` | 독립 Claude 검토 원본 복사. SHA input `770f6520…0229` · result `792faefd…a871` · session `599dfcf5…5f86`. result `verdict: accept` · session `a4b83165-…` `exited`. 교수 자료 작성자는 Codex(provenance) |
| `supabase/migrations/_pending_source_lesson_reflection.sql` | **신규 · 미적용** — 아래 |
| `apps/web/src/lib/csat/map/v62/factory-bridge/source-lesson.ts` | 신규 — 답변 전 지원 · 시범(진행 확인 뒤) · 형성 피드백 · 닫힌 본문 파서 · 진행/저장 서비스(닫힌 DTO, 모르는 모양 = bad_shape) |
| `apps/web/src/app/api/csat/factory/[deliveryId]/lesson/route.ts` | 신규 GET(진행 + 조건부 시범) · POST(자기 설명) |
| `apps/web/src/components/csat/factory/SourceLessonPanel.tsx` | 신규 — 문장 목록 · 주장/근거 · 관계 · 비교(요지) · 절차(주제) · 저장/재시도/다음 단계 |
| `apps/web/src/components/csat/factory/FactoryDcpRunner.tsx` | 영수증 id 보존 · 답변 전 지원 표시 · 저장된 풀이 뒤 패널 |
| `apps/web/src/app/(app)/csat/factory/[deliveryId]/page.tsx` | 교수 자료 원문 납품일 때만 단계 지원 props |
| `apps/web/src/components/csat/diagnosis/map/FactoryDcpCard.tsx` | `readFactoryList` — 목록 응답 닫힌 모양(`Number(x)\|\|0` · rows cast 제거) |
| `apps/web/src/lib/analytics/events.ts` · `__tests__/events.test.ts` | `csat_source_lesson_reflected { step, support: sufficient\|discussable, replayed }` |
| `…/__tests__/dcp-learning.pglite.test.ts` | 결합 설치 끝에 2B SQL · 2B 시험 7개 |
| `…/map/__tests__/factory-dcp-card.test.ts` · `…/factory/__tests__/factory-dcp-runner.test.ts` | 목록 모양 반례 · 영수증 id |
| `apps/web/scripts/build-factory-dcp-harness.mts` · `tests/e2e-isolated/source-lesson.isolated.spec.ts` | 하네스 `#lesson=` 단계 선택 · 브라우저 3시나리오 |
| `docs/DB_SCHEMA.md` · `ROUTES.md` · `LEARNING_MODEL.md` · `MODULES.md` · `CHANGELOG.md` · `00-ROADMAP.md` · 이 파일 | 계약 갱신 |

⚠️ 루트에 이 세션의 임시 파일 `.tmp-2b-patch.cjs`(실행되지 않은 편집 스크립트)가 남았다 — `node`/`rm` 실행 권한이 거절됐다. 커밋하지 말고 지울 것. 생성 HTML `apps/web/tests/fixtures/factory-dcp-harness.html` 과 캡처도 커밋 대상이 아니다.

## SQL `_pending_source_lesson_reflection.sql`(1D 뒤)

- `source_lesson_reflection` 추가 전용: 교수 자료 id/SHA CHECK 고정 · 원문 id/content SHA(등록 후보 값 복사) · `attempt_id` FK→`factory_dcp_attempt` · delivery/workspace/order/artifact_revision · step · 닫힌 본문 + `body_hash` · `evidence=false`/`guided_reflection` CHECK · (user,mutation)·(user,delivery,lesson) 유일 · `forbid_ledger_mutation` · `supply_writer_guard` · RLS 본인 SELECT · anon/authenticated/service_role 쓰기 회수.
- `source_lesson_check` — 1D `factory_dcp_delivery_state` + 원문 결속(id `003946dd…` · content SHA `33dc4880…`) → 아니면 `lesson_mismatch`. 다른 지문에 적용되지 않는다.
- `source_lesson_progress` — 같은 학습자 · 같은 Workspace · **같은 개인 주문(order_id)** 의 세 단계와 attempted/reflected. 세 문항을 지문 하나로 묶는다.
- `source_lesson_reflect` — auth.uid() 본인 영수증만(남의 것 = not_found) · 1D와 같은 잠금 순서(map_goal→map_plan→Workspace→주문→납품→승인→등록) 뒤 현재성 · 같은 판본 · 영수증 문항 단계와 본문 step 일치 · 요지→제목→주제 순서 · 단계당 하나 · 같은 키+같은 본문 = 저장 결과, 다르면 23505. 자유 설명은 길이 · 모양만 검사(채점 안 함).
- 계측 허용 목록에 이름 하나 추가. 1D가 제약을 `'{…}'::text[]` 모양으로 다시 만들기 때문에 두 모양을 모두 읽도록 했다(처음 버전은 결합 설치에서 실패 — 실측 후 수정).

**결합 설치 순서(실제 PGlite 적용)**: C → B → I1-S → I1-P → I2 → G2 → D3 → grade_dcp_item 정의 → `_pending_authored_supply` → `_pending_authored_ai_review` → `_pending_factory_dcp_admission` → `_pending_factory_dcp_learning` → **`_pending_source_lesson_reflection`**. 기존 래퍼는 그대로 살아 있다(1D 27 + 기존 시험 전부 같은 DB에서 통과).

## 명령 · 결과

| 명령 | 결과 |
|---|---|
| `pnpm --filter web exec vitest run src/lib/csat/map/v62/factory-bridge/__tests__/dcp-learning.pglite.test.ts` | **PASS 34/34**(기존 27 + 2B 7) |
| `pnpm --filter web exec vitest run src/components/csat/factory src/components/csat/diagnosis/map src/app/api/csat/factory src/lib/analytics src/lib/csat/map/v62/factory-bridge` | **PASS** 25 파일 · 419 시험 · **SKIP** 2 파일/5 시험(기존 조건부 skip — PASS 로 세지 않음) |
| `pnpm --filter web exec tsc --noEmit -p .` | PASS |
| `pnpm --filter web exec eslint <변경 ts/tsx 13개>` | PASS |
| `pnpm --dir apps/web exec tsx scripts/build-factory-dcp-harness.mts` | 구움 723 KB · CSS `globals.css → tailwind` 332 KB + CsatShell root(`space.module.css .root`) |
| `pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/source-lesson.isolated.spec.ts tests/e2e-isolated/factory-dcp-runner.isolated.spec.ts`(Chromium 1440) | **4 passed · 0 skip**(2B 3 + 1D 회귀 1) |

2B PGlite 시험이 실제 서비스(`lessonProgress` · `submitReflection` · `submitFactoryAttempt`)와 실제 SQL로 단언한 것: 교수 자료 파일 바이트 SHA · 풀이 전 attempted=false/시범 null · 같은 주문의 세 단계 · 저장된 요지 풀이 뒤에만 시범(제목 · 주제는 없음) · 요지 전 제목 설명 = out_of_order · 저장 · 같은 키 재전송 = 같은 id/행 수 불변 · 같은 키 다른 본문 = conflict · 새 키 같은 단계 = conflict · 주제 절차 누락/단계 불일치 = invalid_input(DB 직접) · 세 단계 reflected · `learning_task_attempts`/`workspace_delivery_attempt` 0행(안내 기록이 독립 근거를 만들지 않음) · 타인 영수증/진행 = not_found · 판본 SHA 불일치 = lesson_mismatch · 닫힌 Workspace · 승인 철회(`content_release_revoke`) = not_current · 직접 INSERT 거절 · 형성 피드백 표(요지 2/3/4/5 · 주장 6/7 · 제목 3/4/8 · 주제 [1,5]/[1,2]/[2,5] · 목록 밖 = discussable) · 닫힌 요청 키.

브라우저(실제 `FactoryDcpRunner → DcpPlayer + SourceLessonPanel` · 실제 앱 CSS · CsatShell root 토큰): 요지 답변 전 전략만 · 시범 없음 · GET 0회 → 제출 → 시범 3부분 → 주장7/근거4/관계/비교 → 저장 502 → 오류 · 쓴 글 유지 · 다음 링크 없음 → 재시도 같은 요청(같은 mutationId) → 저장 · 「다음: 같은 글의 제목」 링크 · 향상 아님 문구 · 계측 1건(닫힌 속성). 제목: cue 만 · 시범 없음 · 목록 밖 근거 「틀렸다는 뜻이 아니라」. 주제: 단서 없음 · 절차 없으면 저장 버튼 비활성 · 저장 뒤 Workspace 복귀 링크.
캡처 `apps/web/playwright-auth/shots-2b/01-main-before.png`·`02-main-save-failed.png`·`03-main-saved.png`·`04-title-saved.png`·`05-topic-saved.png` — 01·03·05 를 직접 봤다. 첫 확인에서 채점 뒤 지문이 접혀 문장 번호만으로 근거를 골라야 하는 문제를 발견해 패널에 번호 붙은 문장 목록을 추가했고 05에서 확인했다. 참조 화면과의 일치 비교는 하지 않았다(주장 없음).
대역: next/link → `<a>` · 서버 액션 · 계측 → `window.__vfEvents` · `/attempt` · `/lesson` 응답은 `page.route`(시범 본문은 교수 자료 파일 그대로). 레일 · 상단 바 · 웹폰트(대체 서체) · 실로그인 · 실 DB는 하네스 밖.

## NOT_RUN · 남은 일(정확히)

Codex 후속 검증에서 다른 납품 경로와 본인 영수증을 섞으면 저장한 뒤에야502를 반환하는 문제를 재현했다(반례1실패/34통과, runtime `production-2b-route-before.log`). RPC에 선택적 기대 납품 `p_delivery`를 추가하고 HTTP 경로에서 반드시 전달해 **저장·멱등 응답 전에** 대조하도록 고쳤다. 최종 함수 서명은 `source_lesson_reflect(uuid,text,jsonb,uuid,uuid)`이며 미적용 SQL의 권한/복구 서명도 갱신했다. 직접 영수증 대상 RPC의 기존4인자 호출은 기본값으로 호환된다.

클라이언트도 reflectionId/deliveryId/attemptId/step/replayed와 형성 피드백을 모두 검사한다. 불완전한200을 완료로 처리하지 않는 브라우저 재시도를 추가했다. 시범 GET 재시도는 쓴 설명을 유지하고, 방금 제출한 선택 번호·문구를 비교 화면에 함께 표시한다. 신규 함수에 실제 운영 기본 EXECUTE 권한을 재현하고 service_role/anon 우회 권한을 회수·확인했다. 사람 검수 대기라는 현재 화면 문구를 중립적인 검수/설명 문구로 고쳤다(과거 원장·wire 코드는 보존).

Codex 최종 직접 실행은 관련 **79/79**, web 타입·변경 lint, 격리 Chromium **4/4 통과**(1D 회귀 포함)다. 수정된 실제 캡처도 직접 확인했다. 하네스는 서버용 교수 JSON 전체를 브라우저에 번들하지 않고 답변 전 투영만 전하며, 해당 파일이 브라우저 입력 그래프에 들어오면 빌드를 실패시킨다. 세 유형도 실제1B 문항/정답으로 분리해 검증했다. 저장한 설명의 재진입 복원과 독립 평가→실제 계획 저장은 다음 2C에서 끝낸다. 임시 편집 스크립트는 삭제했다.

1. **독립 평가 이동 → 재계획 저장 종단(사양 4·5)** — NOT_RUN. 남은 작업: 결합 설치 DB(이 파일 순서 + authored ai-review)에서 같은 학습자에게 2A AI 검토 5문항 중 미노출 2개를 `server.ts` 공급 → `gradeAuthored` → `learning_task_attempts`/G2 결속 → `composeV4 → asIsMap → planWorkspaces/repairGate → nextActionOf` → `buildCommitPayload` → `learner_workspace_plan_commit`(현재 goal/plan 기대 버전)으로 `check_result` 새 plan_version 저장을 단언하고, 반례(낡은 goal/plan · 반복 노출 · 같은 mutation 다른 본문 · 응답 유실 재시도 · source guided 기록이 입력에 섞이지 않음)를 넣는다. 현재 화면은 주제 저장 뒤 같은 Workspace(지도)로 돌려보내고, 그 다음 행동은 기존 `nextActionOf`/계획 UI가 정한다 — 이 연결이 실제로 독립 평가로 이어지는지는 **검증하지 않았다**.
2. 실제 Supabase RLS · 두 연결 동시성(철회 vs 저장) · 실로그인 E2E · 공유 DB 적용 — NOT_RUN(PGlite 는 슈퍼유저 단일 연결).
3. 1C `dcp-admission` · 2A `ai-review` PGlite 스위트에는 2B SQL을 얹지 않았다(2B는 1D 결합 스위트에서만 설치 확인).
4. `pnpm turbo` 전체 · `next build` — NOT_RUN.
5. 세션 잠금 `lock.mjs acquire/release claude-code` — 실행하지 않았다(이 세션은 node 스크립트 실행 권한이 일부 거절됨). 다른 쓰기 세션과 겹치지 않았는지 확인 후 커밋할 것.

## 결정 · 한계

- 새 원장을 둔 이유: `factory_dcp_attempt`는 선택 응답 영수증이라 자유 설명 칸이 없고, G2 `workspace_delivery_attempt`는 Gold 해시를 요구한다. Gold/G2를 만들지 않고 영수증에 FK로 묶은 설명 원장을 따로 뒀다.
- 단계당 설명 하나(같은 단계 다른 내용 재저장 = conflict). 고쳐 쓰기를 허용할지는 제품 결정.
- 형성 피드백은 TS 순수 함수(교수 자료 표 그대로)로 계산하고 저장하지 않는다 — 저장되는 것은 학습자 본문과 recorded 뿐.
- AI 비교 24회(12 교수 + 12 평가) + 사전 2회는 두 조건 모두 전이 만점이라 판정 불가였다. 이번 변경은 그때 빠진 「첫 답과 시범의 명시적 비교」를 수집해 저장하는 절차 보완이며 효과가 검증된 것이 아니다.

## 실패 · 복구

- SQL 미적용: `/lesson` GET/POST 는 `not_installed`(503) — 패널은 시범을 못 불러온다고 말하고 저장을 완료로 보이지 않는다. 1D 풀이는 그대로 동작한다.
- 적용 후 중단: `source_lesson_reflect` EXECUTE 회수(설명 저장만 멈춤). 되돌리기는 행 0 일 때만 · 별도 승인(SQL 머리말).
- 교수 자료 바이트를 고치면 SHA 가 바뀌어 SQL CHECK · 서비스 상수 · 독립 검토가 모두 무효 — 새 검토 필요.
