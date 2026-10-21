# Vocaflow — AGENTS.md

> **모든 코딩 에이전트(Claude Code · Codex CLI)의 단일 지시 출처.** `CLAUDE.md` 는 이 파일을 `@AGENTS.md` 로 읽고 Claude 전용만 덧붙인다.
> 긴 배경·사례·과거 결정 원문: [docs/agents/CONTEXT_DETAIL.md](./docs/agents/CONTEXT_DETAIL.md) · 두 에이전트 분담·인수인계: [agents/router.md](./agents/router.md).
> 한도 **≤ 200줄 · ≤ 32 KiB**(Codex `project_doc_max_bytes` 기본값). `node agents/scripts/check.mjs` 가 검사한다 — 넘치면 원문을 CONTEXT_DETAIL 로 옮긴다.

## 프로젝트

- **Vocaflow** — 영어 스크립트 기반 9 모듈 학습 플랫폼 · 타겟 한국 고등학생~성인 · Web(Next.js 14) + 모바일(Expo, Phase 2) · DB Supabase `jajenrevcbmrpaliomxv`(vocaflow-dev).
- 모듈(계층): TextViewer `/text*`(L0~L2) · WordVault `/wordvault*`(L3) · Flashcard `/flashcard*`(L4a 재인) · WordBlitz `/wordblitz` `/play/wordblitz`(L4a 자동화) · PairFlip `/pairflip*`(L4a 공간기억) · SpellForge `/spellforge*`(L4b) · EchoMatch `/text/[id]/echo`(L4c) · ScriptQuiz `/scriptquiz*`(L5) · Dictation `/dictate*`(L6) · Dashboard `/dashboard`(L7).
- 스택: Next.js 14.2 App Router · React 18 · TS 5 · `@supabase/supabase-js` 2.104 + `ssr` 0.10 · SWR 2.4(→ Zustand 5, Phase 3) · Tailwind 3.4 · lucide-react · `@anthropic-ai/sdk` 0.92 · `openai` 6.34 · `ts-fsrs` 5.2 · `pitchfinder` + `dynamic-time-warping-ts`(EchoMatch) · three + `@react-three/fiber` + drei · pnpm 9 + turbo 2.9 · Node 20+. 상세 [docs/STACK.md](./docs/STACK.md).
- 구조: `apps/web`(실구현) · `apps/mobile`(기획) · `packages/`(design-tokens · ui-shared · types · library-pipeline · vcb-core · vcb-curate-core · wlp · video-factory) · `supabase/migrations` · `scripts/` · `docs/` · `agents/`(에이전트 공용 설정 출처).
- 하위 지시: `apps/web/CLAUDE.md` · `apps/mobile/CLAUDE.md` · `packages/design-tokens/CLAUDE.md` — 그 디렉터리를 만질 때 읽는다.

## 플랫폼 목표 정본 · 작업 범위 (Claude · Codex · ChatGPT 공통)

- 개발 절차의 최신 공용 정책은 `D:/workspace/Vocaflow-AI-Control/config/dev-mode.json`의 `development_policy`(`dev-minimal-20261020`)다. 오래된 작업 절차보다 우선하며 제품 정본·DB 승인·권한 보호는 그대로다.

- **최상위 목표 = 승인 정본 v1.1.0**(2026-10-09): `D:/workspace/Vocaflow-AI-Control/goals/PROJECT_GOAL.md`(VG-L0~L4) · `GOAL_ACCEPTANCE_CRITERIA.json` — 원격은 브랜치 `ai-control`. 사본을 만들지 않는다(봉인 `CANON_MANIFEST.json`). 이 파일의 제품 서술(「9 모듈」·「모바일 Phase 2」 등)과 다르면 정본이 우선한다.
- 확정 전략 SD-R0-01~04(중등 일반 독해 · 비로그인 체험→가입 · PC 웹 우선 · 교실/결제 후순위)는 다시 묻지 않는다. 바꿀 필요는 제안으로만.
- **작업 범위는 작업 단위마다 따로다**: `node D:/workspace/Vocaflow-AI-Control/bin/vfc.mjs task show <id>` 의 goal_id · allowed/forbidden_paths · db_scope · approval 과 worktree 의 `.agent-goal.md`. 한 작업의 「하지 않을 것」을 다른 작업이나 전역 규칙으로 적용하지 않는다(리뷰도 같다 — 범위 밖 지적은 별도 티켓).
- 여러 세션이 나누는 등록 작업만 owner_id와 `vfc task start`로 추적한다. 단일 세션의 일반 개발에는 큐·worker·handoff 등록을 요구하지 않는다. VFC가 잠금을 잡았으면 수동으로 중복 획득하지 않는다. skip과 미실행은 통과가 아니다.

## 명령

| 목적 | 명령 |
|---|---|
| 설치 | `pnpm install --frozen-lockfile` |
| lint · 타입 · 테스트 (CI 와 동일) | `pnpm turbo run lint typecheck test` |
| web 테스트 한 파일 | `pnpm --filter web exec vitest run <path>` |
| e2e · 빌드 | `pnpm --filter web test:e2e` (스모크 `test:e2e:smoke`) · `pnpm --filter web build` |
| DB 통계 블록 | `pnpm docs:db-stats` (확인만 `pnpm docs:db-stats:check`) |
| 에이전트 설정 | `node agents/scripts/sync.mjs` (생성) · `node agents/scripts/check.mjs` (검사) · `node --test agents/scripts/__tests__/*.test.mjs` (스크립트 회귀) |
| 잠금 · 인수인계 | `node agents/scripts/lock.mjs acquire\|release\|status <agent>` · `node agents/scripts/handoff.mjs <from> <to>` |
| 통합 | 기본 LOCAL_FAST: `node D:/workspace/Vocaflow-AI-Control/bin/local-integrate.mjs --task <ID>` · 명시적 GITHUB 모드의 원격 병합만 `safe-merge.mjs`(직접 `gh pr merge` 금지) |
| worktree | `pnpm wt list` · `pnpm wt new <suffix>` · `pnpm wt remove <suffix>` |

## 문서 navigation — 작업 영역에 맞는 것만 읽는다

| 영역 | 문서 |
|---|---|
| UI / 컴포넌트 | [DESIGN.md](./DESIGN.md)(방향·화면별 골격·서명) · [DESIGN_SYSTEM](./docs/DESIGN_SYSTEM.md) · [MODULES](./docs/MODULES.md) · 발명 참고 [vocaflow-design](./.claude/skills/vocaflow-design/SKILL.md) |
| DB / 마이그레이션 | [DB_SCHEMA](./docs/DB_SCHEMA.md) · [LIBRARY_PIPELINE](./docs/LIBRARY_PIPELINE.md) |
| 라이브러리 큐레이션 | [LIBRARY_PIPELINE](./docs/LIBRARY_PIPELINE.md) · [ADMIN_CONSOLE](./docs/ADMIN_CONSOLE.md) |
| 원문 점검·판정(보관·내용) | [source-check/criteria](./docs/source-check/criteria.md)(판정 기준 정본 · 버전) · [changelog](./docs/source-check/changelog.md) · 회차 `round-{n}.md` — 판정자 정의·청크 지시에 기준을 다시 쓰지 않는다 · 대량 판정은 회차 일치율 안정 후 승인 |
| 만화(CCP) | [CCP_LIBRARY_INTEGRATION](./docs/CCP_LIBRARY_INTEGRATION.md) · [COMIC_PIPELINE_DESIGN](./scripts/comic/docs/COMIC_PIPELINE_DESIGN.md) |
| 학습 모듈 | [LEARNING_MODEL](./docs/LEARNING_MODEL.md) · [MODULES](./docs/MODULES.md) |
| 학습자 관리 / 목표 / B2B | [LEARNER_MANAGEMENT](./docs/LEARNER_MANAGEMENT.md) · [VOCAB_LAYERS](./docs/VOCAB_LAYERS.md) |
| 라우트 | [ROUTES](./docs/ROUTES.md) · [MODULES](./docs/MODULES.md) |
| 평가원 기출 분석 | [CSAT_TYPE_ANALYSIS](./docs/CSAT_TYPE_ANALYSIS.md) · [CSAT_TYPE_BLUEPRINTS](./docs/CSAT_TYPE_BLUEPRINTS.md) |
| 기출 학습자 화면 | [csat-learner-brief](./docs/csat-learner-brief.md) · [DECISIONS](./docs/csat-learner/DECISIONS.md) · [CSAT_LEARNER_DELIVERY](./docs/CSAT_LEARNER_DELIVERY.md) |
| 영상 | [VIDEO_FACTORY](./docs/VIDEO_FACTORY.md) · [DESIGN_SYSTEM](./docs/DESIGN_SYSTEM.md) |
| 코드 리뷰 | [CONVENTIONS](./docs/CONVENTIONS.md) · [CHANGELOG](./docs/CHANGELOG.md) |
| 멀티 세션 / worktree | [WORKTREE](./docs/WORKTREE.md) · [agents/router.md](./agents/router.md) |
| 정기 진단 | [PLATFORM_AUDIT](./docs/PLATFORM_AUDIT.md) |
| 첫 진입 | [PROJECT](./docs/PROJECT.md) · [STACK](./docs/STACK.md) |

진입 순서: 이 파일 → 필요한 영역 문서 → 변경 영향 범위의 사실 검증. CHANGELOG는 기능 통합 때 한 줄만 갱신한다.
메모리 동기화는 `docs/AI_CONTEXT` 미러를 실제로 갱신할 때만 실행한다. 세션 시작·일반 커밋에는 실행하지 않는다.

## 디자인 방향 · 학습 과학 7

- 방향(강제 규칙 아님 — 디자인·UX 금지·제한은 DD-66 으로 전부 삭제): **Calm UI** · **Progressive Disclosure** · **Empathetic Feedback** · **Implicit Progress**. 현재 서체는 한국어 Hahmlet · 영어 Lora.
- Active Recall(Karpicke & Roediger 2008) · Spaced Repetition(FSRS, `ts-fsrs`) · Desirable Difficulty(Bjork) · Dual Coding(Paivio) · Context-Dependent(학습 맥락에서 인출) · Cognitive Load(작업기억 ~4) · Emotional Encoding(보상 + 자기효능감). 적용: [LEARNING_MODEL](./docs/LEARNING_MODEL.md).
- **Memory Decay 4색** — R(t) = `exp(ln(0.9) × t / S)` 를 **동적 계산**(`memory_state` 컬럼 저장 절대 금지): stable `#2E7D5A` R≥0.95 · shaky `#B5803A` 0.70≤R<0.95 · risk `#9C3A30` R<0.70 · new `#8A8278` 신규(D/S 미부여).

## 공개 화면 — 남은 규칙

| # | 규칙 |
|---|---|
| I5 | 수치는 DB 실측 또는 즉석 계산만 — 상수 금지 (`no-hardcoded-stats` 회귀) |
| I7 | 한글에 `break-keep` (없으면 390px 에서 낱말이 쪼개진다) |
| D2 | 새 공개 화면은 진입 + 내부 상호작용 이벤트를 같은 커밋에 (`lib/analytics/events.ts`) |
| D3 | 이벤트 속성은 숫자·불리언·닫힌 열거형만 |

I1–I4 · I6 · I8 · D1 · D4 · D5 는 DD-66 으로 삭제(회귀 `activation-path` 포함).

모션 토큰: `--dur-*` · `--ease*` · `--dur-loop*`(값은 `packages/design-tokens/src/tokens.css`). 모션 예산·허용 목록·금지 목록은 DD-66 으로 삭제.
`prefers-reduced-motion` 은 끄기가 아니라 낮추기(이동·회전·스케일 제거, 페이드는 남김).
외부 취향 스킬 `design-taste-frontend`(+ 내장 `dataviz`)와 `vocaflow-design` 은 참고용이다(`minimalist-ui` · 제약 판정표는 DD-65, 나머지 금지는 DD-66 으로 삭제).

## 절대 하지 않을 것

- **저작권**: Quizlet 로고·아이콘·브랜드색 복사.
- **데이터**: `memory_state` / `mastery_progress` / `last_days` / `next_days` 컬럼 · 암호화 안 된 API 키(Supabase Vault) · `module_history` 정규화(TEXT[] 유지).
- **접근성**: 44px 미만 터치 타겟 · placeholder 만으로 레이블 대체 · 색만으로 정보 전달.
- **비밀값**: `.env*` 밖(에이전트 설정·문서·코드)에 키·토큰·DB URL 을 적지 않는다. `.env*` 를 출력하지 않는다.
- 더 많은 안티패턴: [CONVENTIONS](./docs/CONVENTIONS.md).

## 항상 지킬 것

- 인터랙티브 요소에 보이는 focus 표시(접근성).
- 파일 첫 줄 경로 주석(`// apps/web/src/components/ui/Button.tsx`) · 코드 완성형만(TODO·생략·placeholder 금지).
- **마이그레이션 자동 적용 금지** — SQL 을 보여주고 사용자 승인 후 적용. 정식 경로는 승인형 배포 러너(`scripts/db/<id>/deploy.mjs apply --stage --confirm-sha`) — Claude Code 승인 창 클릭이 1회용 티켓이 된다(`agents/scripts/db-approval.mjs`). 이 명령에 allow 규칙을 두지 않는다.

## LLM 판단이 필요한 일 = 에이전트가 직접 하는 배치 드레인

API 키를 기다리며 "막혔다" 고 보고하지 않는다 — **지금 돌고 있는 에이전트가 그 LLM 이다**(ScriptQuiz 1,292문항 · 사전 466낱말 · PDCP 현대화가 이렇게 만들어졌다).
3단 구조: `*-drain-export.mjs`(청크 → `scripts/<pipeline>/<work>/chunk-NN.json`) → 에이전트가 채워 `chunk-NN.out.json` → `*-drain-import.mjs --commit`(DB 적재).
- export 는 이미 채워진 것을 건너뛴다(재실행 안전). import 는 빈 값·너무 짧은 값을 넣지 않고 **건너뛴 수를 출력**한다(빈 값이 들어가면 구멍이 영영 남는다).
- jsonb 에 키를 더하면 마이그레이션 불필요 — 통째로 덮지 말고 기존 값을 읽어 키 하나만 더한다(덮으면 정답 키가 날아간다).
- 절차는 `apps/web/src/lib/admin/help/<pipeline>.ts` 의 `drain` 에 적고, 단계마다 **재실행 안전 여부**를 명시한다.

## DB 핵심 통계

<!-- db-stats:start -->

> 이 블록은 `node scripts/docs/gen-db-stats.mjs` 가 DB 에서 생성한다 — **손으로 고치지 말 것.**
> 고쳐도 다음 실행에 덮어써지고, 그 사이에는 틀린 값이 근거로 쓰인다.
> 마지막 생성 **2026-10-21**. 낡았는지 확인만 하려면 `--check` (파일을 안 고치고 exit 1).

**수요 측** — 이 줄이 이 문서에서 가장 중요하다. 공급이 아무리 늘어도 여기가 안 늘면 진단은 `risk` 다.

- 가입자 **1** (합성 · 시험 계정 64 제외) (프로필 65 — 합성 포함) · 학습기록 **699** · 읽기 세션 287 · 일별 활동 92 · 점수 80
- 교사 채널: 학급 **1** · 학급 구성원 0 · 학급 과제 **0** · 퍼널 이벤트 49,227

**공급 측**

- `shared_dictionary` **49,244** row · meaning_ko 100%
- `library_books` **401** — published 312 · archived 83 · queued 6
- `library_articles` **91,793** — ready 84,715 · archived 3,655 · queued 3,165 · published 250 · failed 7 · analyzing 1
- `shared_word_sets` 11,312 (published 11,099) · `library_chapter_quiz` 2,453
- `texts` 278 · `vocabularies` 2,270
- 만화: `pd_comic_issues` 969 · 시리즈 101 · 발행 `comic_books` 1

> **여기 없는 수치는 일부러 안 센다** — 테이블·함수·migration 개수와 DB 용량은 전용 RPC 가 있어야
> 읽히는데, 그 값들로 바뀌는 결정이 없다. 용량처럼 실제로 의미 있는 것은 분기 진단이 날짜와 함께
> 기록한다([PLATFORM_AUDIT.md](./docs/PLATFORM_AUDIT.md) §6-2). 스키마 자체는 [DB_SCHEMA.md](./docs/DB_SCHEMA.md).

<!-- db-stats:end -->

- 없는 테이블을 읽는 RPC = 0개(2026-08-16). 테이블 존재는 **문서가 아니라 `to_regclass` 로** 확인한다 — 경위: CONTEXT_DETAIL §to_regclass. 스키마: [DB_SCHEMA](./docs/DB_SCHEMA.md).

## 파이프라인

- CSAT 원문 배치: 새 도구 전 기존 자산 검색 → `csat-sources-audit` → 사유별 대상·dry-run → 소량 검증 → 재감사. 적격 정본은 `evaluateSource`; 내용 판정은 UUID·본문 해시·revision에 묶는다. 상세 `.agents/skills/csat-source-audit/SKILL.md`.

**LCP** 9 외부 소스 → 도서 큐레이션(auto_curate_book 게이트 + 4축 난이도) · **VCB** seed → enrichment → shared_words(cast-2000 audit chain) · **VRL** 4축 분류(V-Level 0-11 · Track 6 · Domain 8 · Skill 5) + 진단 5종 · **ACP** 14 소스 수집(`scripts/acp/collect-daily.mjs`) → `library_articles`. **arXiv 는 없다**(`20260614240000_acp_remove_arxiv_source`, CHECK 제약이 재삽입 차단). 상세 [LIBRARY_PIPELINE](./docs/LIBRARY_PIPELINE.md).
Admin Console: `/admin/*`(route group 미사용) · 액센트 = `--p` + `ShieldCheck` + 「Admin」 텍스트 · 값은 앱 스킨 `skins/admin-app.css`(먹색 · Inter · 보라 0 — DD-82, 2026-09-24) · 상세 [ADMIN_CONSOLE](./docs/ADMIN_CONSOLE.md).

## 자동화 정책 (사용자 standing authorization · 2026-06-08)

**승인 정책: PR_AUTOMATION_POLICY v1.2(AUTO_CONTINUE)** — 정본 [agents/policies/PR_AUTOMATION_POLICY.md](./agents/policies/PR_AUTOMATION_POLICY.md) · [pr-automation.json](./agents/policies/pr-automation.json). 개발 단계 기획·설계·구현·테스트·평가·개선·커밋·push·PR·CI·범위/검증 게이트를 통과한 병합은 재승인 없이 이어간다. 데이터 삭제·DB 배포 승인·중대한 보안/인증정보 변경 통제는 유지한다. 이미 승인된 정확한 범위는 재질문하지 않는다. 실행 환경의 강제 권한은 우회하지 않는다.

**⓪ 위험도별 검증(2026-10-20 사용자 결정 · 개발 단계)** — 파일 수가 아니라 영향으로 판정하고, 더 높은 위험을 발견하면 올린다.
L1 문구·스타일·비기능 문서 → 관련 정적 검사 + 화면이 바뀌면 실제 렌더 확인 · L2 일반 기능 → 관련 단위 테스트 + 영향 범위 타입 · L3 인증·권한·학습기록·진단·공통 프레임워크·데이터 결속 → 단위·통합 + 영향받는 핵심 E2E(격리 DB), 필요 시 독립 검토 · L4 DB 구조·마이그레이션·실데이터 삭제 → 사용자 승인 + 영향·복구 확인 후 승인 범위만.
같은 커밋에서 이미 통과한 검사는 다시 돌리지 않는다 · CI 는 병합 전 한 번(같은 PR 앞선 실행은 자동 취소).

**① 문서 갱신 — 계약이 바뀔 때만** — 단순 UI·스타일·내부 리팩터링은 문서 불필요. 기능 계약 → 그 영역 정본 한 곳 · 라우트 추가/삭제 → ROUTES · 공개 API → 그 계약 문서 · DB 스키마(승인 후) → DB_SCHEMA · 제품 방향·중요 결정 → 결정 정본. CHANGELOG 는 병합되는 기능 단위로 한 줄. 작업 완료의 증거는 커밋 + 검증 결과다(별도 보고서·로그 파일 만들지 않는다). 콘텐츠·수요 수치 변동 → `pnpm docs:db-stats` 실행(마커 안을 손으로 고치지 않는다).

**② Admin 화면도움말** — Admin 파이프라인 화면(탭 포함)은 `apps/web/src/lib/admin/help/<pipeline>.ts` 에 도움말을 갖고, 화면을 바꾸는 **같은 커밋**에서 고친다(낡은 도움말은 잘못된 조작을 유발한다 — 코드보다 위험).
버튼/액션 → `fields`·`steps` · 탭 추가/삭제/**라벨 변경** → `tabs` 키(라벨 문자열로 조회 — 라벨만 바꾸면 도움말이 조용히 사라진다) · 순서/상태 전이 → `steps`(+`done`) · 드레인 절차 → `drain.procedure`·`prerequisites`·`verify`·`recovery`(재실행 안전 명시) · 되돌릴 수 없는 동작 → `cautions` · 새 화면 → 항목 추가 + `<AdminScreenHelp screen="<슬러그>" tab={활성탭} />`.
화면 라벨을 반복하지 말고 순서·전제·되돌리기 가능 여부·실패 결과·소요 시간을 쓴다. 파이프라인 수치가 나빠지면 코드보다 먼저 해당 도움말의 `cautions` 를 읽는다.

**③ Git** — 논리적 변경 완료 시 자기 파일만 커밋한다. LOCAL_FAST 일반 개발은 로컬 통합하며 작업별 push·PR·CI 대기를 요구하지 않는다. 원격은 백업 또는 공식 제품 통합 시에만 사용한다. 범위 계약(HEAD/base SHA·정확한 경로·커밋 수)을 확인하고 공식 원격 납품에는 `VFC_DEV_MODE=GITHUB`를 명시한다.
- Conventional commits(`feat:` `fix:` `chore:` `docs:` `refactor:` `perf:`) · 첫 줄 ≤72자(한국어 가능) · 본문에 핵심 변경 3–5개 · 마이그레이션/라우트/RPC 명시 · 끝에 작성 에이전트의 `Co-Authored-By` 줄.
- **main 직접 push 금지**(PR) · force push 금지 · `--no-verify` 금지(훅 실패는 원인을 고친다) · main 병합은 `safe-merge.mjs` 정책 게이트로만(자동 병합 활성화 조건은 정본 §4).
- **작업 브랜치 수명 ≤ 2주, main 기준 분기** — 넘기면 main 에 먼저 합친다(2026-09-19 사용자 승인 · DD-41: 두 달 산 브랜치가 PR 을 커밋 2,413개로 만들었다).
- 하지 않는다(안전 중단): `.env*` 커밋 · 새 키/secret 포함 · 빌드/테스트 실패 상태 push. 데이터 손실(DROP/TRUNCATE)은 승인 대상. PR 은 그 작업 범위만 담는다(무관한 커밋을 섞지 않는다) · 파일 ≥30 PR 은 본문에 `## 검증` 한 단락(safe-merge 가 확인 — CI 결과를 옮기면 된다).

**④ 분기 플랫폼 진단** — 1·4·7·10월 첫 주(다음 **2026-10**), 즉시 트리거는 PLATFORM_AUDIT 참조. 실패 모드는 "공급망 비대 / 수요 검증 0". **문서의 수치를 근거로 쓰지 않는다**(DB 질의 + 저장소 실계수 + 1차 공개자료). 측정 → 기록 → 결정 → 수정 순서(같은 턴에 고치면 측정이 오염 — 단 공개 라우트의 허위 수치는 즉시 제거). 산출물: 리포트 + PLATFORM_AUDIT §7 한 행 + CHANGELOG 한 줄. 기준선·산술은 [PLATFORM_AUDIT](./docs/PLATFORM_AUDIT.md).

## 공유 워크스페이스 · 두 에이전트 규약

- 이 저장소는 **여러 세션·두 종류 에이전트가 git 인덱스·DB·검증 계정을 공유**한다. 커밋은 `git commit --only <paths>` 로 자기 파일만. `git add` 와 commit 사이에 틈을 두지 않는다(남의 커밋에 흡수된다).
- 같은 워크트리 동시 쓰기 금지(남의 `lock.mjs` 잠금이 있으면 읽기 전용). 새 worktree · worker · subagent 는 **실제 병렬 이득이 있을 때만** — 단독 작업은 지금 환경을 재사용하고, 한 에이전트가 끝낼 수 있는 일은 다른 에이전트를 부르지 않는다.
- 실제 담당자가 바뀔 때만 변경·남은 일·검증 결과를 전달한다. 같은 세션의 일반 작업에는 handoff 양식·ACK·별도 보고서가 필요 없다. 전달을 받았다면 수용 기준과 현재 Git 상태부터 확인한다.
- MCP 정의는 `agents/mcp.source.json` 만 고친다 — `.mcp.json` · `.codex/config.toml` 의 `mcp_servers` 는 생성물.
- 독립 리뷰는 L3 이상 고위험 변경이나 요청이 있을 때만(결함 + 목적 이탈 · [goal-review](./agents/goal-review.md)). `.agent-goal.md` 는 DB 승인(마이그레이션 sha 기록)이나 여러 세션이 나눠 하는 큰 작업에만 쓴다. **자동 Codex 리뷰는 없다**(2026-10-10 사용자 결정 · RP-2026-10-10.2): Stop·커밋·submit·DB 게이트·머지 어디서도 Codex 를 부르지 않는다. 완료 판단은 테스트·타입·lint·수용 기준 증거·Goal Check 로 한다. `node agents/scripts/review.mjs` 는 사용자가 요청할 때만 쓴다.
- **git 훅은 인덱스를 고치지 않는다**(검사·안내만) — 훅의 `git add` 는 `--only` 를 깨고 커밋 뒤에도 남는다(DD-49).

## 하지 말 것 — 두 번 이상 고친 실수

- 문서에 적힌 수치·테이블 목록을 사실로 쓰기(낡은 목록이 멀쩡한 기능을 "고장" 으로 오해시켰다) → DB 에 직접 묻는다.
- 줄바꿈 정규화 없이 스크립트 치환 — 저장소는 CRLF/LF 혼재라 조용히 엉뚱한 데를 자른다.
- `node -e "…\`x\`…"` 처럼 백틱을 쌍따옴표 안에 넣기(Bash 가 실행해 글자가 빠진다) → quoted heredoc 파일로. **heredoc 도 역슬래시를 한 겹 먹는다** — `\s`·`\b` 가 `s`·백스페이스가 돼 정규식이 조용히 0건을 낸다(2026-09-23 세 번). 정규식은 리터럴(`/…/`)로 쓰거나 **Write 도구로 파일을 만든다**.
- jsonb 를 `JSON.stringify` 로 비교해 "변경 없음" 판정(DB 가 키 순서를 바꾼다 → 재실행마다 행이 늘었다).
- `count ?? 0` — 없는 테이블도 head 요청엔 204/count=null 이다. 오류를 0 으로 삼키지 않는다.
- 시계를 직접 읽는 코드·테스트 — `Date.now()` · `new Date()` 를 로직 안에서 부르면 고정 날짜 픽스처가 시간이 지나며 **저절로** 떨어진다(`feed-discovery` 2026-09-19). 시각은 주입(`now` 인자·deps)하고, 테스트는 고정 시각을 넘기거나 `vi.useFakeTimers()`+`setSystemTime`.
- 규칙이 정당한 코드를 걸면 코드가 아니라 **규칙을 고친다**(「루프 애니메이션 금지」가 로더 20곳을 걸었다).
- node 가 Supabase 에 TLS 로 못 붙으면 `node --tls-max-v1.2`.
- 구조적 결함을 보고만 하고 넘기기 — 그 작업 안에서 영향 측정 → 오탐 확인 → 가드까지 만든다.
- **일화를 근거로 다음 작업을 권고하기** — 사례 두셋을 보고 "이렇게 하면 크게 준다/살아난다" 고 적으면 재 볼 때마다 틀렸다(2026-09-23 한 세션에서 셋: 하베스트 사전 필터 18.9% · 꼭지 분할 472→100편 · 「본문 중복」 실측 1편). **권고 전에 전량에 대 보고, 자동 분류는 표본을 눈으로 본다**(정확도 지표만 보면 `(MUSIC)` 처럼 조각 수가 많아 그럴듯한 오분류를 못 잡는다).
