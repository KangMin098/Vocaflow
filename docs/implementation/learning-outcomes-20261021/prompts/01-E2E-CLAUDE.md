<!-- docs/implementation/learning-outcomes-20261021/prompts/01-E2E-CLAUDE.md -->
# Claude Code 새 세션 — 단계 1 일반 독해 E2E 구현

> **REJECTED — 실행하지 않는다.** Codex 목적 검토에서 별도 목표 시스템 신설과 공장 연결 제외가 확인됐다. 실제 구현 지시는 `01A-DEMAND-ORDER-CLAUDE.md`다.

새 세션이다. resume/continue하지 않는다. 작업 공간 `D:/workspace/Vocaflow-learning-outcomes-20261021-work`, branch `feat/learning-outcomes-20261021`.

## 먼저 읽기 (이것만)

1. `AGENTS.md`, `CLAUDE.md`, `apps/web/CLAUDE.md`, `D:/workspace/Vocaflow-AI-Control/config/dev-mode.json`의 `development_policy`.
2. `docs/implementation/learning-outcomes-20261021/00-ROADMAP.md`, `00-AUDIT-RESULT.md`, **`01-E2E-SPEC.md`(이 작업의 계약)**.
3. 구현에 필요한 파일만: `lib/scriptquiz/grade-actions.ts`, `components/game/scriptquiz/ScriptQuiz.tsx`·`types.ts`, `app/(main)/scriptquiz/play/page.tsx`, `lib/scores/record-score.ts`, `lib/csat/map/v62/delivery-binding.ts`(멱등 키 패턴), PGlite 시험 하나(`lib/csat/map/v62/__tests__/r5-delivery-g2-binding.pglite.test.ts`), `playwright.isolated.config.ts`, `tests/e2e-isolated/` spec 하나.

넓은 조사를 다시 하지 않는다. 00-AUDIT-RESULT와 다른 사실을 발견하면 01-E2E-RESULT에 적고 설계를 최소한으로 고친다.

## 할 일 (순서대로, 끝까지)

1. `git status`·HEAD 확인. 남의 미커밋 변경은 건드리지 않는다.
2. `supabase/migrations/_pending_reading_outcome_r0.sql` 작성(SPEC §3). 개발 DB에 적용하지 않는다.
3. `lib/reading-outcome/*` · 컴포넌트 · ScriptQuiz goal 모드 · play 페이지 · plan 화면 한 줄 · 이벤트를 SPEC §5대로 **실제 제품 화면에 연결**한다. goal이 없는 기존 ScriptQuiz 동작은 바꾸지 않는다.
4. 시험 작성·실행: decide 단위, actions 단위(RPC 오류 코드 매핑·`not_connected`), PGlite 통합(SPEC AC3–AC7·AC9·AC10 — pending SQL을 PGlite에 올려 두 사용자로), 컴포넌트, 격리 Playwright(AC1·AC2).
5. SPEC §9 명령을 실행한다. Vitest worker 초기화 오류가 나면 원인을 찾아 고친다(설정 변경이 필요하면 최소로, 이유를 기록). 고치지 못하면 FAIL로 남긴다.
6. 결과 문서 `docs/implementation/learning-outcomes-20261021/01-E2E-RESULT.md`: AC별 PASS/FAIL/SKIP/NOT_RUN/EXTERNAL_PENDING, 명령, HEAD, 핵심 출력 발췌, 변경 파일 수, 남은 승인(A1–A3) SQL 경로.
7. 자기 파일만 `git add -N <새 파일>` 후 `git commit --only <paths> -F - <<'MSG'`로 커밋하고 `git show --stat`으로 확인한다. 커밋 서명은 실제 사용한 모델.

## AI 역할 검증 (사용자 최신 지시)

- 학습효과·사용성·교수·채점의 사람 역할은 Claude Code와 Codex가 대신한다. 사람 모집·검수·채점을 기다리거나 완료 조건으로 두지 않는다.
- 이번 단계 1에서는 **사용성·교수 검토 1회**를 이 세션이 직접 수행한다: 격리 E2E 스크린샷 기준으로 중등 학습자 역할(정답·해설을 미리 보지 않고 화면 문구만으로 진행 가능한가), 교사 역할(목표 문장·근거 피드백·다음 계획이 일관된가)을 점검하고, 발견을 고친 뒤 결과 문서에 「AI 검토(Claude Code, 실제 수행)」로 적는다.
- Codex 독립 검토는 이 세션이 부를 수 없으면 「Codex 검토: NOT_RUN — 다음 단계에서 수행」으로 적는다. 하지 않은 검토를 수행한 것처럼 쓰지 않는다.
- AI가 실제로 실행한 원시 근거(명령 출력·스크린샷 경로·응답 로그)와 시간 경과를 흉내 낸 값은 구분한다. 지연·유지 시험을 시각 주입으로 흉내 내면 `SIMULATED_DELAY`로 표기한다. 단계 1은 지연 평가를 하지 않는다.
- 합성·AI 응답을 실제 학생 성취로 세지 않는다. `actor_kind='ai_simulated'`로 구분한다.

## 금지

- 개발 DB 쓰기: migration 적용, `apply_migration`, 실데이터 변경·삭제, 공유 DB를 쓰는 e2e(`tests/e2e/*`) 실행.
- push, PR, main 병합, 로컬 통합(`local-integrate.mjs`), 발행, 배포, `.github/workflows` 수정.
- CSAT 지도·교재공장 코드 수정, 새 공통 프레임워크, 순수 함수·mock만으로 E2E 완료 보고.
- skip·미실행·`not_connected` 화면을 PASS로 적기. `.env*` 출력·커밋.
- 변경 파일 30개 이상(넘으면 범위를 줄인다).

## 막혔을 때

DB가 필요해 막히면 그 부분만 EXTERNAL_PENDING(승인 A1–A3)으로 두고 나머지 코드·PGlite·격리 검증을 끝까지 한다. 로컬 Supabase가 없어 격리 E2E를 못 돌리면 EXTERNAL_PENDING과 정확한 실행 명령을 남긴다.

## 최종 답

한국어로: 변경 파일, 실제 연결된 화면·흐름, AC 표(상태 그대로), 실패·미실행 이유, 사용자 승인이 필요한 SQL 경로와 복구안, 다음 단계 2(자기 설명·구조 활동) 착수 조건.
