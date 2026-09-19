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
| worktree | `pnpm wt list` · `pnpm wt new <suffix>` · `pnpm wt remove <suffix>` |

## 문서 navigation — 작업 영역에 맞는 것만 읽는다

| 영역 | 문서 |
|---|---|
| UI / 컴포넌트 | **[DESIGN.md](./DESIGN.md) 필독**(방향·화면별 골격·서명) · [DESIGN_SYSTEM](./docs/DESIGN_SYSTEM.md) · [MODULES](./docs/MODULES.md) · 발명 정본 [vocaflow-design](./.claude/skills/vocaflow-design/SKILL.md) (UI 작업 전 필독) |
| DB / 마이그레이션 | [DB_SCHEMA](./docs/DB_SCHEMA.md) · [LIBRARY_PIPELINE](./docs/LIBRARY_PIPELINE.md) |
| 라이브러리 큐레이션 | [LIBRARY_PIPELINE](./docs/LIBRARY_PIPELINE.md) · [ADMIN_CONSOLE](./docs/ADMIN_CONSOLE.md) |
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

진입 순서: 이 파일 → 영역 문서 1–3개 → **사실 검증**(DB 직접 질의 · 라우트 grep) → 변경 시 CONVENTIONS 자가 점검 → 머지 후 CHANGELOG Unreleased 갱신.

## 디자인 철학 4 · 학습 과학 7 (항상)

- **Calm UI**(학습 중 자극 최소 — 광고·뱃지 알림·과한 애니메이션 금지) · **Progressive Disclosure**(본질 먼저, 깊이는 요청 시) · **Empathetic Feedback**(비난·압박 대신 격려·맥락. 한국어 Hahmlet 세리프·이탤릭 없음 / 영어 Lora italic) · **Implicit Progress**(숫자 게이지보다 환경 변화).
- Active Recall(Karpicke & Roediger 2008) · Spaced Repetition(FSRS, `ts-fsrs`) · Desirable Difficulty(Bjork) · Dual Coding(Paivio) · Context-Dependent(학습 맥락에서 인출) · Cognitive Load(작업기억 ~4) · Emotional Encoding(보상 + 자기효능감). 적용: [LEARNING_MODEL](./docs/LEARNING_MODEL.md).
- **Memory Decay 4색** — R(t) = `exp(ln(0.9) × t / S)` 를 **동적 계산**(`memory_state` 컬럼 저장 절대 금지): stable `#2E7D5A` R≥0.95 · shaky `#B5803A` 0.70≤R<0.95 · risk `#9C3A30` R<0.70 · new `#8A8278` 신규(D/S 미부여).

## 첫인상 · 이탈 방지 — 말하지 말고 증명하라

| # | 규칙 |
|---|---|
| I1–I2 | 공개 화면 above-the-fold 에 **실제로 수행한 결과** ≥1, 거기까지 클릭 0 · 입력 0 |
| I3 | 증명은 조작 가능 — 컨트롤 ≥1, 200ms 내 반응 |
| I4 | 히어로 부제 ≤ 90자 |
| I5 | 수치는 DB 실측 또는 즉석 계산만 — 상수 금지 (`no-hardcoded-stats` 회귀) |
| I6 | 증명이 서버 렌더 HTML 에 남는다 |
| I7 | 한글에 `break-keep` (없으면 390px 에서 낱말이 쪼개진다) |
| I8 | 증명이 접힌 위에서 끝난다 — 데스크톱 1280×900 기준, 모바일 제외 |
| D1 | 가치 확인 앞에 로그인·입력·모달을 두지 않는다 |
| D2 | 새 공개 화면은 진입 + 내부 상호작용 이벤트를 같은 커밋에 (`lib/analytics/events.ts`) |
| D3 | 이벤트 속성은 숫자·불리언·닫힌 열거형만 |
| D4 | 빈 상태에 다음 한 걸음이 반드시 있다 |
| D5 | 가입 후 첫 학습 완료까지 화면 전환 ≤ 3 (회귀 `app/__tests__/activation-path.test.ts`) |

**모션 예산**: 마이크로 100–200ms(`--dur-fast`/`--dur-normal`) · 표준 200–300ms(`--dur-slow`) · 스태거 50ms · 이동 4–16px / 리빌 20–40px · 총 1초 초과 금지 · `transform`·`opacity` 만.
`prefers-reduced-motion` 은 끄기가 아니라 낮추기(이동·회전·스케일 제거, 페이드는 남김).
학습 중 허용 7종: 카드 뒤집기 · 정답 scale · 오답 shake · 진행률 바 · 점수 카운트업 · 페이지 페이드 · 포커스 링.
항상 금지: 폭죽 · 콘페티 · 배지 팝업 · 자동재생 캐러셀 · 장식적 상시 모션. **로더·스켈레톤은 허용** — 기준은 "끝나는 상태가 있는가". 아케이드(`components/game/`)는 대상 아님. 회귀 `components/__tests__/learning-tone.test.ts`.
활성 외부 취향 스킬 2개(`design-taste-frontend` · `minimalist-ui`, + 내장 `dataviz`)는 위 철학과 충돌한다 — 판정은 vocaflow-design 스킬이 정본, 나머지 11개는 `_disabled/`([design/DECISIONS](./docs/design/DECISIONS.md)). **Part 1(§A–§G) 발명이 목표 — 화면은 §G 로 자산의 형태를 골격으로 세운다. Part 2(§0–§8) 제약은 하한선.**

## 절대 하지 않을 것

- **타이포**: Inter · Roboto · Arial · 한글에 Lora · 영어에 산세리프.
- **색**: `--color-primary` 등 v5 롱폼(v6 이후 `--p` 축약형만) · Quizlet 로고·아이콘·브랜드색 복사 · 색만으로 정보 전달.
- **학습 UX**: 정답률 빨간 글씨 압박 · 모달 오버레이로 학습 중단 · 진행률 100% 에 폭죽·트로피("오늘 잘 마쳤어요" 선호).
- **데이터**: `memory_state` / `mastery_progress` / `last_days` / `next_days` 컬럼 · 암호화 안 된 API 키(Supabase Vault) · `module_history` 정규화(TEXT[] 유지).
- **접근성**: 44px 미만 터치 타겟 · placeholder 만으로 레이블 대체.
- **비밀값**: `.env*` 밖(에이전트 설정·문서·코드)에 키·토큰·DB URL 을 적지 않는다. `.env*` 를 출력하지 않는다.
- 더 많은 안티패턴: [CONVENTIONS](./docs/CONVENTIONS.md).

## 항상 지킬 것

- 인터랙티브 요소 4상태(hover · active · focus · disabled) · 카드·버튼 transition(`--dur-normal`, `--ease`) · 정답/오답 3중 피드백(색 + 아이콘 + 애니메이션).
- 모바일 퍼스트(390 → 768 → 1280) · CSS Variables 로 테마(하드코딩 금지, 게임 전용 예외) · `data-theme="dark"` 전 컴포넌트 대응.
- 파일 첫 줄 경로 주석(`// apps/web/src/components/ui/Button.tsx`) · 코드 완성형만(TODO·생략·placeholder 금지).
- **평균 금지(혁신만 목표)**: 새 `page.tsx` 는 첫 20줄에 `// @form: <G1 축> — <서명>`(vocaflow-design §G) · 평균 신호(3열 균등·그림자·둥근 카드·그라디언트·AI-보라·glass·떠오르는 hover·무한 모션)는 늘리지 않는다. 회귀 `app/__tests__/form-declaration-ratchet.test.ts` · `components/__tests__/average-signal-ratchet.test.ts` — 기준선을 올려 통과시키지 않는다.
- **마이그레이션 자동 적용 금지** — SQL 을 보여주고 사용자 승인 후 적용.

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
> 마지막 생성 **2026-09-19**. 낡았는지 확인만 하려면 `--check` (파일을 안 고치고 exit 1).

**수요 측** — 이 줄이 이 문서에서 가장 중요하다. 공급이 아무리 늘어도 여기가 안 늘면 진단은 `risk` 다.

- 가입자 **3** (프로필 3) · 학습기록 **665** · 읽기 세션 287 · 일별 활동 61 · 점수 78
- 교사 채널: 학급 **1** · 학급 구성원 0 · 학급 과제 **0** · 퍼널 이벤트 9,184

**공급 측**

- `shared_dictionary` **49,244** row · meaning_ko 100%
- `library_books` **401** — published 312 · archived 83 · queued 6
- `library_articles` **109,043** — ready 87,466 · archived 20,385 · queued 937 · published 250 · failed 4 · analyzing 1
- `shared_word_sets` 11,312 (published 11,099) · `library_chapter_quiz` 2,453
- `texts` 278 · `vocabularies` 2,249
- 만화: `pd_comic_issues` 969 · 시리즈 101 · 발행 `comic_books` 1

> **여기 없는 수치는 일부러 안 센다** — 테이블·함수·migration 개수와 DB 용량은 전용 RPC 가 있어야
> 읽히는데, 그 값들로 바뀌는 결정이 없다. 용량처럼 실제로 의미 있는 것은 분기 진단이 날짜와 함께
> 기록한다([PLATFORM_AUDIT.md](./docs/PLATFORM_AUDIT.md) §6-2). 스키마 자체는 [DB_SCHEMA.md](./docs/DB_SCHEMA.md).

<!-- db-stats:end -->

- 없는 테이블을 읽는 RPC = 0개(2026-08-16). 테이블 존재는 **문서가 아니라 `to_regclass` 로** 확인한다 — 경위: CONTEXT_DETAIL §to_regclass. 스키마: [DB_SCHEMA](./docs/DB_SCHEMA.md).

## 파이프라인

- CSAT 원문 배치: 새 도구 전 기존 자산 검색 → `csat-sources-audit` → 사유별 대상·dry-run → 소량 검증 → 재감사. 적격 정본은 `evaluateSource`; 내용 판정은 UUID·본문 해시·revision에 묶는다. 상세 `.agents/skills/csat-source-audit/SKILL.md`.

**LCP** 9 외부 소스 → 도서 큐레이션(auto_curate_book 게이트 + 4축 난이도) · **VCB** seed → enrichment → shared_words(cast-2000 audit chain) · **VRL** 4축 분류(V-Level 0-11 · Track 6 · Domain 8 · Skill 5) + 진단 5종 · **ACP** 14 소스 수집(`scripts/acp/collect-daily.mjs`) → `library_articles`. **arXiv 는 없다**(`20260614240000_acp_remove_arxiv_source`, CHECK 제약이 재삽입 차단). 상세 [LIBRARY_PIPELINE](./docs/LIBRARY_PIPELINE.md).
Admin Console: `/admin/*`(route group 미사용) · 액센트 = Deep Ink `--p` + `ShieldCheck` + 「Admin」 텍스트(2026-09-18 결정 — 옛 보라 `#8B5CF6` 은 신규 사용 금지, 평균 신호 라쳇으로 감소만) · 상세 [ADMIN_CONSOLE](./docs/ADMIN_CONSOLE.md).

## 자동화 정책 (사용자 standing authorization · 2026-06-08)

**① 문서 동반 갱신** — 같은 작업 안에서 코드와 문서를 함께 바꾼다(사용자 요청 없어도). 검증 가능한 사실만.
마이그레이션 → DB_SCHEMA + CHANGELOG · RPC/view/trigger → DB_SCHEMA · 라우트 → ROUTES · 도메인 컴포넌트 → MODULES · 학습 모듈/계층 → LEARNING_MODEL + MODULES · 토큰/패턴 → DESIGN_SYSTEM · Admin 라우트/일괄 액션 → ADMIN_CONSOLE · 큐레이션 RPC/파이프라인 → LIBRARY_PIPELINE · 코딩 패턴 → CONVENTIONS · 패키지 → STACK · 전부 → CHANGELOG Unreleased 한두 줄 · 콘텐츠·수요 수치 변동(드레인·발행·마이그레이션) → `pnpm docs:db-stats` **실행**(마커 안을 손으로 고치지 않는다).

**② Admin 화면도움말** — Admin 파이프라인 화면(탭 포함)은 `apps/web/src/lib/admin/help/<pipeline>.ts` 에 도움말을 갖고, 화면을 바꾸는 **같은 커밋**에서 고친다(낡은 도움말은 잘못된 조작을 유발한다 — 코드보다 위험).
버튼/액션 → `fields`·`steps` · 탭 추가/삭제/**라벨 변경** → `tabs` 키(라벨 문자열로 조회 — 라벨만 바꾸면 도움말이 조용히 사라진다) · 순서/상태 전이 → `steps`(+`done`) · 드레인 절차 → `drain.procedure`·`prerequisites`·`verify`·`recovery`(재실행 안전 명시) · 되돌릴 수 없는 동작 → `cautions` · 새 화면 → 항목 추가 + `<AdminScreenHelp screen="<슬러그>" tab={활성탭} />`.
화면 라벨을 반복하지 말고 순서·전제·되돌리기 가능 여부·실패 결과·소요 시간을 쓴다. 파이프라인 수치가 나빠지면 코드보다 먼저 해당 도움말의 `cautions` 를 읽는다.

**③ Git** — 논리적 milestone 종료 · 변경 파일 ≥5 · 다음 작업으로 넘어갈 때 커밋 + 현재 브랜치 push.
- Conventional commits(`feat:` `fix:` `chore:` `docs:` `refactor:` `perf:`) · 첫 줄 ≤72자(한국어 가능) · 본문에 핵심 변경 3–5개 · 마이그레이션/라우트/RPC 명시 · 끝에 작성 에이전트의 `Co-Authored-By` 줄.
- **main 직접 push 금지**(PR) · force push 금지 · `--no-verify` 금지(훅 실패는 원인을 고친다) · main 머지는 사용자 확인.
- **작업 브랜치 수명 ≤ 2주, main 기준 분기** — 넘기면 main 에 먼저 합친다(2026-09-19 사용자 승인 · DD-41: 두 달 산 브랜치가 PR 을 커밋 2,413개로 만들었다).
- 항상 사용자 확인: `.env*` 커밋 · 새 키/secret 포함 · 빌드/테스트 실패 상태 push · 데이터 손실(DROP/TRUNCATE) · 파일 ≥30 변경.

**④ 분기 플랫폼 진단** — 1·4·7·10월 첫 주(다음 **2026-10**), 즉시 트리거는 PLATFORM_AUDIT 참조. 실패 모드는 "공급망 비대 / 수요 검증 0". **문서의 수치를 근거로 쓰지 않는다**(DB 질의 + 저장소 실계수 + 1차 공개자료). 측정 → 기록 → 결정 → 수정 순서(같은 턴에 고치면 측정이 오염 — 단 공개 라우트의 허위 수치는 즉시 제거). 산출물: 리포트 + PLATFORM_AUDIT §7 한 행 + CHANGELOG 한 줄. 기준선·산술은 [PLATFORM_AUDIT](./docs/PLATFORM_AUDIT.md).

## 공유 워크스페이스 · 두 에이전트 규약

- 이 저장소는 **여러 세션·두 종류 에이전트가 git 인덱스·DB·검증 계정을 공유**한다. 커밋은 `git commit --only <paths>` 로 자기 파일만. `git add` 와 commit 사이에 틈을 두지 않는다(남의 커밋에 흡수된다).
- 같은 워크트리 동시 쓰기 금지: 쓰기 전에 `lock.mjs acquire <agent>`, 끝나면 `release`. 잠금이 남의 것이면 읽기 전용으로만 일한다. 장기 병행은 `pnpm wt new <suffix>`.
- 한도·중단 시 `handoff.mjs <from> <to>` → `.agent-handoff/latest.md`. **받는 쪽의 첫 동작은 그 파일을 읽고 수용 기준부터 재확인.** 받은 기능은 받은 쪽이 끝낸다.
- MCP 정의는 `agents/mcp.source.json` 만 고친다 — `.mcp.json` · `.codex/config.toml` 의 `mcp_servers` 는 생성물.

## 하지 말 것 — 두 번 이상 고친 실수

- 문서에 적힌 수치·테이블 목록을 사실로 쓰기(낡은 목록이 멀쩡한 기능을 "고장" 으로 오해시켰다) → DB 에 직접 묻는다.
- 줄바꿈 정규화 없이 스크립트 치환 — 저장소는 CRLF/LF 혼재라 조용히 엉뚱한 데를 자른다.
- `node -e "…\`x\`…"` 처럼 백틱을 쌍따옴표 안에 넣기(Bash 가 실행해 글자가 빠진다) → quoted heredoc 파일로.
- jsonb 를 `JSON.stringify` 로 비교해 "변경 없음" 판정(DB 가 키 순서를 바꾼다 → 재실행마다 행이 늘었다).
- `count ?? 0` — 없는 테이블도 head 요청엔 204/count=null 이다. 오류를 0 으로 삼키지 않는다.
- 규칙이 정당한 코드를 걸면 코드가 아니라 **규칙을 고친다**(「루프 애니메이션 금지」가 로더 20곳을 걸었다).
- node 가 Supabase 에 TLS 로 못 붙으면 `node --tls-max-v1.2`.
- 구조적 결함을 보고만 하고 넘기기 — 그 작업 안에서 영향 측정 → 오탐 확인 → 가드까지 만든다.
