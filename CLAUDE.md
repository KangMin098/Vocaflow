# Vocaflow — CLAUDE.md

> Vocaflow 프로젝트 인덱스. **항상 첨부** 되는 Claude 컨텍스트 핵심.
> 본 문서는 7원칙 + 4철학 + 절대 금지/지킬 것 + 문서 navigation 만 담는 슬림 인덱스.
> 영역별 상세는 [docs/](./docs/) 산하 12 개 파일 참조.

**문서 버전: v06.34** (2026-06-08) — 분리·재설계 완료.

---

## 🧭 문서 navigation

작업 영역에 따라 `docs/` 의 .md 들을 **선택적으로** Claude 에 첨부 (전체 첨부는 토큰 비효율):

| 영역 | 추가 attachment |
|---|---|
| UI / 컴포넌트 | [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) · [docs/MODULES.md](./docs/MODULES.md) |
| DB / 마이그레이션 | [docs/DB_SCHEMA.md](./docs/DB_SCHEMA.md) · [docs/LIBRARY_PIPELINE.md](./docs/LIBRARY_PIPELINE.md) |
| 라이브러리 큐레이션 | [docs/LIBRARY_PIPELINE.md](./docs/LIBRARY_PIPELINE.md) · [docs/ADMIN_CONSOLE.md](./docs/ADMIN_CONSOLE.md) |
| 만화(CCP) 카탈로그 편입 | [docs/CCP_LIBRARY_INTEGRATION.md](./docs/CCP_LIBRARY_INTEGRATION.md) · [scripts/comic/docs/COMIC_PIPELINE_DESIGN.md](./scripts/comic/docs/COMIC_PIPELINE_DESIGN.md) |
| 새 학습 모듈 | [docs/LEARNING_MODEL.md](./docs/LEARNING_MODEL.md) · [docs/MODULES.md](./docs/MODULES.md) |
| 학습자 관리 / 목표 / 리포트 / B2B | [docs/LEARNER_MANAGEMENT.md](./docs/LEARNER_MANAGEMENT.md) · [docs/VOCAB_LAYERS.md](./docs/VOCAB_LAYERS.md) |
| 라우트 설계 | [docs/ROUTES.md](./docs/ROUTES.md) · [docs/MODULES.md](./docs/MODULES.md) |
| **평가원 기출 분석 (CSAT)** | **[docs/CSAT_TYPE_ANALYSIS.md](./docs/CSAT_TYPE_ANALYSIS.md)** · [docs/CSAT_TYPE_BLUEPRINTS.md](./docs/CSAT_TYPE_BLUEPRINTS.md) |
| 코드 리뷰 | [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) · [docs/CHANGELOG.md](./docs/CHANGELOG.md) |
| 멀티 세션 / worktree | [docs/WORKTREE.md](./docs/WORKTREE.md) |
| **정기 플랫폼 진단 / 시장·경쟁·산술 재검증** | **[docs/PLATFORM_AUDIT.md](./docs/PLATFORM_AUDIT.md)** |
| 첫 진입 | [docs/PROJECT.md](./docs/PROJECT.md) · [docs/STACK.md](./docs/STACK.md) |

**모든 문서는 100% 검증된 사실** (DB direct query · 라우트 grep · package.json · migration 파일). 작성 시점 2026-06-08.

---

## 🎯 프로젝트 개요

- **서비스명**: Vocaflow
- **목적**: 영어 스크립트 기반 9 모듈 종합 학습 플랫폼
- **타겟**: 한국 고등학생~성인
- **플랫폼**: Web (Next.js 14) + iOS/Android (React Native Expo, Phase 2)
- **DB**: Supabase Cloud (`jajenrevcbmrpaliomxv` = vocaflow-dev)

### 9 핵심 모듈 + EchoMatch

| 모듈 | 계층 | 라우트 |
|---|---|---|
| TextViewer | L0~L2 | `/text*` |
| WordVault | L3 | `/wordvault*` |
| Flashcard | L4a 재인 | `/flashcard*` |
| WordBlitz | L4a 자동화 | `/wordblitz` `/play/wordblitz` |
| PairFlip | L4a 공간기억 | `/pairflip*` |
| SpellForge | L4b 시각생성 | `/spellforge*` |
| EchoMatch (v06.33) | L4c 청각생성 | `/text/[id]/echo` |
| ScriptQuiz | L5 정복 | `/scriptquiz*` |
| Dictation | L6 완성 | `/dictate*` |
| Dashboard | L7 회고 | `/dashboard` |

상세: [docs/MODULES.md](./docs/MODULES.md), [docs/LEARNING_MODEL.md](./docs/LEARNING_MODEL.md)

---

## 🧠 디자인 철학 4개 (always-on)

| # | 원칙 | 의미 |
|---|---|---|
| 1 | **Calm UI** | 학습 중 자극 최소화. 광고·뱃지 알림·과한 애니메이션 금지 |
| 2 | **Progressive Disclosure** | 본질만 먼저 노출, 깊이는 사용자 요청 시 |
| 3 | **Empathetic Feedback** | 비난·압박 대신 격려·맥락. Lora italic "사람의 말투" |
| 4 | **Implicit Progress** | 숫자 게이지보다 환경 변화로 성장 시각화 |

## 학습 과학 원칙 7개 (always-on)

| # | 원칙 | 근거 |
|---|---|---|
| 1 | **Active Recall** | Karpicke & Roediger 2008 — 인출이 재인보다 강한 기억 |
| 2 | **Spaced Repetition** | Ebbinghaus + FSRS (`ts-fsrs` 패키지) |
| 3 | **Desirable Difficulty** | Bjork — 약간의 인지적 분투 |
| 4 | **Dual Coding** | Paivio — 언어 + 시각·청각 |
| 5 | **Context-Dependent** | 단어를 학습한 맥락에서 인출 |
| 6 | **Cognitive Load** | Sweller — 작업기억 ~4 항목 |
| 7 | **Emotional Encoding** | 도파민 보상 + 자기효능감 → 해마 기억 |

상세 적용: [docs/LEARNING_MODEL.md](./docs/LEARNING_MODEL.md)

---

## 🎨 Memory Decay 4색 (always-on)

R(t) = `exp(ln(0.9) × t / S)` 동적 계산. **`memory_state` 컬럼 DB 저장 절대 금지**.

| 상태 | 색 | 조건 |
|---|---|---|
| stable | `#2E7D5A` (muted forest) | R ≥ 0.95 |
| shaky | `#B5803A` (deeper warm amber) | 0.70 ≤ R < 0.95 |
| risk | `#9C3A30` (deeper warm red) | R < 0.70 |
| new | `#8A8278` (warm gray) | 신규 등록 (D/S 미부여) |

---

## 🎯 첫인상 · 이탈 방지 (always-on · v06.42)

> **말하지 말고 증명하라.** 이 제품의 주장("내가 아는 비율")은 본질적으로 눈에 보이는 것인데,
> 산문으로 쓰면 증명이 사라진다. 공개 화면의 첫 화면은 **작동하는 결과**여야 한다.

| # | 규칙 | 검사 |
|---|---|---|
| I1 | 공개 화면 above-the-fold 에 **실제로 수행한 결과**가 1개 이상 | 히어로에 실데이터 렌더가 있는가 |
| I2 | 그 증명까지 클릭 **0** · 입력 **0** | 진입 직후 보이는가 |
| I3 | 증명은 **조작 가능** — 값을 바꾸면 즉시 반응 | 컨트롤 ≥1 · 200ms 내 |
| I4 | 히어로 부제 ≤ **90자** | 글자 수 |
| I5 | 수치는 DB 실측 또는 즉석 계산만 — 상수 금지 | `no-hardcoded-stats` 회귀 |
| I6 | 증명이 **서버 렌더 HTML** 에 남는다 | 크롤러가 읽을 것이 있는가 |
| I7 | 한글에 `break-keep` — 없으면 390px 에서 낱말이 쪼개진다 | 실측 "겁니 / 다" |
| I8 | 증명이 **접힌 위**에서 끝난다 — **데스크톱 1280×900 기준. 모바일은 제외** | 하단 좌표 실측 |
| D1 | 가치 확인 앞에 로그인·입력·모달을 두지 않는다 | `/fit` 이 공개인 이유 |
| D2 | 새 공개 화면은 **진입 + 내부 상호작용** 이벤트를 같은 커밋에 | `lib/analytics/events.ts` |
| D3 | 이벤트 속성은 숫자·불리언·닫힌 열거형만 (자유 문자열 금지) | 타입이 강제 |
| D4 | 빈 상태에 **다음 한 걸음**이 반드시 있다 | 막다른 화면 = 이탈 |
| D5 | 가입 후 첫 학습 1회 완료까지 화면 전환 ≤ **3** | 경로 계수 |

### 모션 예산 (숫자 고정)

마이크로 100–200ms(`--dur-fast`/`--dur-normal`) · 표준 200–300ms(`--dur-slow`) ·
스태거 50ms · 이동 마이크로 4–16px / 리빌 20–40px · **총 1초 초과 금지** ·
`transform`·`opacity` 만 애니메이트.

`prefers-reduced-motion` 은 **끄기가 아니라 낮추기** — 이동·회전·스케일은 제거하되
**페이드는 남긴다**(전부 0.01ms 로 죽이면 무엇이 바뀌었는지 알 수 없다).

**학습 중 모션 화이트리스트 7종 외 금지**: 카드 뒤집기 · 정답 scale · 오답 shake ·
진행률 바 · 점수 카운트업 · 페이지 페이드 · 포커스 링.
**항상 금지**: 폭죽 · 트로피 · 콘페티 · 루프 애니메이션 · 자동재생 캐러셀 · perpetual micro-motion.

### 설치된 외부 디자인 스킬과의 관계

`.claude/skills/` 에 13개 취향 스킬이 있고 **서로, 그리고 위 철학과 충돌한다**
(`stitch-design-taste` 의 perpetual micro-motion · `gpt-taste` 의 GSAP pinning ·
`stitch` 의 "세리프 금지" vs Lora 시그니처). **발명 엔진(§A–§F)** 과 판정표·라우팅은
**[.claude/skills/vocaflow-design/SKILL.md](./.claude/skills/vocaflow-design/SKILL.md)** 가 정본이다.
UI 작업 전 그 스킬을 먼저 읽는다. **Part 1(§A–§F)이 목표이고 Part 2(§0–§8)는 하한선이다** —
제약만 지킨 화면은 "위반 없는 평범한 화면"이지 혁신이 아니다.

---

## 🚫 절대 하지 않을 것

### Typography
- Inter · Roboto · Arial
- 한글에 Lora · 영어에 산세리프

### 색상
- `--color-primary` 등 v5 롱폼 (v6 이후 **`--p` 축약형만**)
- Quizlet 로고·아이콘·브랜드색 복사
- 색상만으로 정보 전달 (색맹 대응 위반)

### 학습 UX
- 정답률 빨간 글씨 압박
- 모달 오버레이로 학습 중단
- 진행률 100% 시 폭죽·트로피 (차분한 "오늘 잘 마쳤어요" 선호)

### 데이터
- `memory_state` / `mastery_progress` / `last_days` / `next_days` 컬럼
- 암호화되지 않은 API 키 (Supabase Vault 사용)
- `module_history` 정규화 (TEXT[] 그대로 유지)

### 접근성
- 44px 미만 터치 타겟
- placeholder 만으로 레이블 대체

상세 + 더 많은 안티패턴: [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)

---

## ✅ 항상 지킬 것

- 모든 인터랙티브 요소에 hover + active + focus + disabled 4상태
- 모든 카드·버튼에 transition (`--dur-normal`, `--ease`)
- 정답/오답: 색상 + 아이콘 + 애니메이션 3중 피드백
- 모바일 퍼스트 (390 → 768 → 1280px)
- CSS Variables 로 테마 제어 — 하드코딩 금지 (게임 전용 예외)
- `data-theme="dark"` 모든 컴포넌트 대응 필수
- 파일 첫 줄에 경로 주석 (`// apps/web/src/components/ui/Button.tsx`)
- 코드 완성형만 — TODO·생략·placeholder 절대 금지
- 마이그레이션 자동 적용 금지 — SQL 보여주고 사용자 승인 후 `apply_migration`
- **LLM 판단이 필요한 일은 Claude Code 배치로 직접 한다** — 아래 §🤖 참조

상세 + PR 체크리스트: [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)

---

## 🤖 LLM 작업 = Claude Code 배치 (사용자 명시 · 반복 지시)

**`ANTHROPIC_API_KEY` 를 기다리며 "막혔다" 고 보고하지 않는다. Claude Code(= 나)가 그 LLM이다.**

이 저장소의 주요 산출물이 이미 그렇게 만들어졌다 — ScriptQuiz 챕터 퀴즈 **1,292문항** ·
사전 드레인 **466낱말** · PDCP 만화 현대화. "LLM이 필요하다" 는 **작업 시작 신호**이지
차단 사유가 아니다.

### 3단 구조 (드레인)

| 단계 | 하는 일 |
|---|---|
| `*-drain-export.mjs` | 할 몫을 청크로 뽑는다 → `scripts/<pipeline>/<work>/chunk-NN.json` |
| **Claude Code** | 청크를 읽고 채워 `chunk-NN.out.json` 으로 저장 |
| `*-drain-import.mjs --commit` | DB 적재 |

### 반드시 지킬 것

- **export 는 이미 채워진 것을 건너뛴다** — 재실행 안전. 몇 번 돌려도 결과가 같아야 한다.
- **import 는 빈 값·너무 짧은 값을 넣지 않는다** — 빈 값이 들어가면 다음 export 가
  "완료" 로 세어 **구멍이 영영 남는다.** 건너뛴 수를 반드시 출력한다.
- **jsonb 컬럼에 키를 더하면 마이그레이션이 필요 없다**(`answer_key.explanation_ko` 등).
  통째로 덮지 말고 기존 값을 읽어 키 하나만 더한다 — 덮으면 정답 키가 날아간다.
- 절차를 `lib/admin/help/<pipeline>.ts` 의 `drain` 에 적는다 — **재실행 안전 여부를
  단계마다 명시**(위 §3️⃣ 화면도움말 동반 갱신).

---

## 🛠 기술 스택 핵심

- **Web**: Next.js 14.2.35 (App Router) + React 18 + TypeScript 5
- **DB / Auth**: Supabase (`@supabase/supabase-js` 2.104 + `ssr` 0.10)
- **State**: SWR 2.4 (현재) → Zustand 5.0 (Phase 3)
- **Style**: Tailwind 3.4 + lucide-react 1.11
- **AI**: `@anthropic-ai/sdk` 0.92 + `openai` 6.34
- **학습**: `ts-fsrs` 5.2 (Anki 검증) + `pitchfinder` 2.3 (EchoMatch) + `dynamic-time-warping-ts`
- **3D**: `three` 0.184 + `@react-three/fiber` 8.17 + `drei` 9.122
- **Monorepo**: pnpm 9 + turbo 2.9 + Node 20+

상세 + 모든 패키지: [docs/STACK.md](./docs/STACK.md)

---

## 📊 DB 핵심 통계

<!-- db-stats:start -->

> 이 블록은 `node scripts/docs/gen-db-stats.mjs` 가 DB 에서 생성한다 — **손으로 고치지 말 것.**
> 고쳐도 다음 실행에 덮어써지고, 그 사이에는 틀린 값이 근거로 쓰인다.
> 마지막 생성 **2026-09-05**. 낡았는지 확인만 하려면 `--check` (파일을 안 고치고 exit 1).

**수요 측** — 이 줄이 이 문서에서 가장 중요하다. 공급이 아무리 늘어도 여기가 안 늘면 진단은 `risk` 다.

- 가입자 **3** (프로필 3) · 학습기록 **665** · 읽기 세션 256 · 일별 활동 47 · 점수 78
- 교사 채널: 학급 **0** · 학급 구성원 0 · 학급 과제 **0** · 퍼널 이벤트 51

**공급 측**

- `shared_dictionary` **49,244** row · meaning_ko 100%
- `library_books` **401** — published 312 · failed 77 · archived 6 · queued 6
- `library_articles` **89,708** — queued 50,262 · archived 20,102 · ready 19,050 · published 293 · failed 1
- `shared_word_sets` 11,301 (published 11,099) · `library_chapter_quiz` 2,453
- `texts` 278 · `vocabularies` 2,216
- 만화: `pd_comic_issues` 969 · 시리즈 101 · 발행 `comic_books` 1

> **여기 없는 수치는 일부러 안 센다** — 테이블·함수·migration 개수와 DB 용량은 전용 RPC 가 있어야
> 읽히는데, 그 값들로 바뀌는 결정이 없다. 용량처럼 실제로 의미 있는 것은 분기 진단이 날짜와 함께
> 기록한다([PLATFORM_AUDIT.md](./docs/PLATFORM_AUDIT.md) §6-2). 스키마 자체는 [DB_SCHEMA.md](./docs/DB_SCHEMA.md).

<!-- db-stats:end -->

### 없는 테이블을 읽는 RPC = 0개 — 왜 목록이 아니라 `to_regclass` 인가

2026-08-16 실측으로 해소 완료.
  `20260719161409_drop_unused_empty_tables` 가 "빈 테이블"로 13개를 CASCADE 삭제했으나 함수는 CASCADE 대상이 아니어서 살아남았고, 오래 미해결로 남아 있었다. 처리 결과는 두 갈래다:
  - **복원**(6): `word_familiarity`(20260812093000) · `csat_item_attempts`(20260812113000) · `vocab_raw_texts` · `classes` · `class_members` · `pending_words`
  - **은퇴**(1): `word_lexicon` — **복원하면 안 되는 경우였다**(`20260816140000`).
    `regenerate_auto_curated_set` 본문이 `DELETE → INSERT` 순서라, 빈 `word_lexicon` 을 복원하면
    INSERT 가 0건으로 **정상 종료**하고 DELETE 만 커밋된다 → 오류 없이 `shared_words`
    **76,503행/1,333세트**(전체 81,413행의 94%)가 사라진다. 그래서 테이블을 되살리는 대신
    함수 본문을 `RAISE` 로 교체해 **나중에 복원되더라도 안전**하게 만들었다.
    (매핑 복원 자체도 불가능했다 — `lexicon_source_tags`·`word_frequency_stats` 각 5,421행에 lemma 가 없다.
     `auto_curated` 1,333세트 중 1,129 는 이미 도서-챕터 세트로 `deliver_chapter_vocab` 소관.)
  ⚠️ **이런 목록은 낡으면 멀쩡한 기능을 "고장" 으로 오해하게 만든다** — 2026-08-16 에 이 목록을 믿고
  `/hub` 구문 연습 블록을 "완료 관측 불가" 로 분모에서 빼는 코드를 넣었다가, DB 에 물어보고
  되돌렸다(복원된 지 나흘 된 테이블이었다). **문서가 아니라 `to_regclass` 로 확인할 것.**
  상세: [DB_SCHEMA.md](./docs/DB_SCHEMA.md)

전체 스키마·RPC 시그니처: [docs/DB_SCHEMA.md](./docs/DB_SCHEMA.md)

---

## 🔄 LCP / VCB / VRL / ACP 파이프라인

- **LCP** — 9 외부 소스 → 도서 큐레이션 (auto_curate_book 게이트 + 4축 난이도)
- **VCB** — seed → enrichment → shared_words (cast-2000 audit chain 보존)
- **VRL** — 4축 분류 (V-Level 0-11 + Track 6 + Domain 8 + Skill 5) + 진단 5종
- **ACP** — 4 feed (arXiv/NASA/NIH/VOA) 짧은 글

상세: [docs/LIBRARY_PIPELINE.md](./docs/LIBRARY_PIPELINE.md)

---

## 📝 최근 변경 (v06.34 진행)

### 이번 세션 (Unreleased)
- `/fit` 이 빈 폼이 아니라 **작동하는 결과**로 시작한다 — 서버가 예시 지문을 미리 분석해(`lib/textfit/sample-profile.ts`, `unstable_cache` 하루) 입력칸에 채운 채 결과까지 내려준다. 도착 후 `/api/fit` 호출 **0** · 예시 상태는 `fit_analyzed` 를 보내지 않음 · 자기 지문을 넣는 순간 예시 해제 · 공유 결과 우선 · 부제 95자 → 66자(I4) · 회귀 10 · axe 위반 0. 랜딩 1차 CTA 가 데려가는 유일한 화면인데 I1–I8 을 적용하지 않은 곳이었다
- 랜딩 히어로 「작동하는 증명」 — 서버가 실제 분석한 지문이 첫 화면에 칠해져 있고 레벨 슬라이더가 네트워크 없이 반응(49ms). 커버리지 곡선 초등 65% → 고1 89% → 학술 96%. `CoverageHero` · `lib/marketing/hero-demo.ts` · `lib/textfit/analyze.ts`(분석 코어 분리, `/api/fit` 159→81줄) · 계측 2종(`landing_demo_moved` · `landing_section_reached`) · 회귀 18 · axe WCAG2 A/AA 위반 0 · 외부 디자인 스킬 13개 평가(통째 설치 전량 반려, 판정표만 채택 — [design-skill-audit-2026-09-04.md](./docs/reports/design-skill-audit-2026-09-04.md))
- 공개 진단이 사전 해석기를 쓴다 (마이그레이션 `20260905084613` — `textfit_resolve_levels_public`, SECURITY DEFINER 3열 반환) — `/fit` 이 `shared_words` **681,021행**(distinct 표제어 29,308)을 전량 적재하느라 **콜드 88초**를 쓰고 `MAX_ROWS` 에서 잘려 커버리지를 낮게 답하던 것을 끝냈다. 원인은 권한이 아니라 **RLS** 였다(anon 은 `shared_dictionary` 0행 · INVOKER 함수가 오류 없이 빈 결과). 지문 한 편(표면형 112) **294ms** · 해석률 0.916 → **0.991** · 전량 적재 코드 삭제(`level-map.ts` 454 → 303줄) · 해석 경로를 `AnalyzeResult.mode` 로 노출
- PDCP 원본 전체 소스 GET + 유형·시리즈 분류 축 (마이그레이션 `20260816200000`) — 빈 서가(`pd_comic_issues` 0행)에 **969호·101시리즈·10유형** 적재(미분류 0). 발견 채널 정정: `classics illustrated` 제목 검색 208건 중 실제 만화는 9건뿐(나머지는 저작권 존속 산문·고서) → 큐레이션 컬렉션(`fawcett-comics` 811 · `ace-comics` 209)으로 전환 · **IA 페이지네이션이 정렬 없이 214건을 중복시키고 그만큼 누락**하던 것 `sort[]=identifier asc` 로 고정(811/811 실측 대조) · 분류 정본 `taxonomy.mjs` 순서 있는 규칙표 · 학습자 서가 유형→시리즈 2단 + 콘텐츠 정보 팝업 · 회귀 32
- I10 게이트 오탐 수정 (마이그레이션 `20260812160000`) — 제거된 챕터당 cap 40 을 비교 측에만 적용해 발행 도서 12권 전부 critical FAIL. 무제한 비교로 8권 PASS 복귀, 실드리프트 4권만 잔존 · `vitest.config` 가 없는 루트 `.env.local` 만 읽어 통합 테스트 전량 silent skip 하던 것 수정 (357 tests 실행)
- `/admin` 대시보드 실측화 — 목업 상수 3배열 제거 · `lib/admin/dashboard-stats.ts`(상태별 카운트 35 + 최근 변경 병합) · 파이프라인 8 큐 카드 · DB 미연동 6 화면에 `목업` 태그 · `count ?? 0` 함정(없는 테이블도 head 요청엔 204/count=null) 제거 · 회귀 2종(renderToString 5 + 실 DB 6)
- Admin 전 화면 화면도움말 71개 (37 화면 + 34 탭) — `lib/admin/help/*` 8 파일 + `AdminScreenHelp` 인라인 펼침 · Claude Code 드레인 절차 7종 (재실행 안전 여부 명시) · 캡처 31 라우트 근거 · 런타임 28/29 실측
- ScriptQuiz 큐레이션 챕터 퀴즈 (v06.114) — `library_chapter_quiz`+`book_quiz_jobs` +5 RPC · 도서 V-Level별 챕터당 문항 수(3~10) · `/scriptquiz` 실 카탈로그 · Admin "스크립트 퀴즈 큐" · Claude Code 드레인 생성 (Pride 488 + Marvelous Oz 168 + Huck Finn 154 + Wonderful Oz 141 + Sherlock 96 + Just So 84 + Wind in the Willows 80(진행 중) + Alice 72 + Ammachi 5 + Drone 4 = 1,292문항 · 카탈로그 10권)
- 큐레이션 "→ 소스 GET" DELETE 시맨틱 재정의 — library_books DELETE + seed unlock
- Dev 큐 드레인 — `/api/lcp/dev-drain-queue` 자동 반복 루프 UI
- 사용자 입력 책 (챕터별) 모드 — `texts.user_book_group_id` + Workspace 분기
- DB 디스크 회수 — 606 MB → 350 MB (VACUUM FULL 5종)
- LibriVox 챕터 매핑 알고리즘 재설계 — Roman + Arabic + 다권 Book/Chapter 통합

상세: [docs/CHANGELOG.md](./docs/CHANGELOG.md)

---

## 🤖 Supabase MCP

Claude Code 에서 Supabase 작업 시:
- Project ID: `jajenrevcbmrpaliomxv`
- 마이그레이션 자동 적용 금지 (memory rule) — SQL 보여주고 승인 받은 뒤 `apply_migration`
- 모델: 항상 Opus + xhigh effort (memory rule)

---

## 📁 워크스페이스 구조 (요약)

```
vocaflow/
├── apps/web/         ← Next.js 14 실 구현
├── apps/mobile/      ← Expo 기획
├── packages/         ← design-tokens · ui-shared · types · library-pipeline · vcb-core · vcb-curate-core · wlp
├── supabase/migrations/  ← 353 SQL (원격 적용 510)
├── scripts/          ← VCB CLI (01~08 step) · dict-* · seed-* · cefrj-import · book-readability
└── docs/             ← 본 가이드 + 12 영역별 문서
```

상세: [docs/PROJECT.md](./docs/PROJECT.md)

---

## 🛡 Admin Console

`/admin/*` 라우트 (route group 미사용). 보라 액센트 (#8B5CF6) + `ShieldCheck` 아이콘.

8 그룹 — 대시보드 / 사용자&콘텐츠 (7 항목 — LCP/ACP/VCB/VRL 포함) / 운영 / 시스템.

상세: [docs/ADMIN_CONSOLE.md](./docs/ADMIN_CONSOLE.md)

---

## 📑 작업 진입 — 권장 순서

1. **첫 진입** — 본 CLAUDE.md + [PROJECT.md](./docs/PROJECT.md) 읽기
2. **해당 영역 attachment** — 위 "문서 navigation" 표 기준 1-3개 추가
3. **사실 검증** — DB direct query (`mcp__supabase__execute_sql`) · 라우트 grep
4. **변경 시** — [CONVENTIONS.md](./docs/CONVENTIONS.md) PR 자가 점검
5. **머지 후** — [CHANGELOG.md](./docs/CHANGELOG.md) Unreleased 섹션 갱신

---

## 🤖 자동화 정책 (사용자 명시 standing authorization · 2026-06-08)

사용자가 다음 두 가지를 **standing authorization** 으로 부여:
1. 코드 변경 시 관련 .md 자동 갱신 (Claude 가 판단)
2. 논리적 milestone 마다 자동 git commit + push (Claude 가 판단)

### 1️⃣ .md 자동 갱신 매트릭스

같은 turn 에 다음 트리거 발생 시 해당 doc 도 갱신 (사용자 요청 없어도):

| 트리거 | 갱신 대상 | 갱신 내용 |
|---|---|---|
| 새 마이그레이션 적용 | [DB_SCHEMA.md](./docs/DB_SCHEMA.md) · [CHANGELOG.md](./docs/CHANGELOG.md) | 마이그레이션 추가 · 테이블/RPC 변경 · CHANGELOG Unreleased 한 줄 |
| 새 RPC / view / trigger | [DB_SCHEMA.md](./docs/DB_SCHEMA.md) | 함수 카운트·시그니처 추가 |
| 새 라우트 (`page.tsx` / `route.ts`) | [ROUTES.md](./docs/ROUTES.md) | 라우트 표에 행 추가 |
| 새 컴포넌트 (도메인 신설) | [MODULES.md](./docs/MODULES.md) | 모듈 컴포넌트 list 갱신 |
| 새 학습 모듈 또는 인지 계층 변경 | [LEARNING_MODEL.md](./docs/LEARNING_MODEL.md) · [MODULES.md](./docs/MODULES.md) | 9계층 매트릭스 갱신 |
| 디자인 토큰 / 컴포넌트 패턴 변경 | [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | 토큰 표 · 컴포넌트 패턴 갱신 |
| Admin 라우트 또는 일괄 액션 변경 | [ADMIN_CONSOLE.md](./docs/ADMIN_CONSOLE.md) | 액션 표 갱신 |
| 큐레이션 RPC / 파이프라인 변경 | [LIBRARY_PIPELINE.md](./docs/LIBRARY_PIPELINE.md) | 단계 / RPC 표 갱신 |
| **Admin 파이프라인 화면 / 기능 / 로직 / 프로세스 변경** | **`apps/web/src/lib/admin/help/<pipeline>.ts`** | **해당 화면·탭 도움말 (summary/steps/fields/cautions/drain) 을 같은 커밋에서 갱신 — 아래 3️⃣ 참조** |
| 코딩 패턴 / 안티패턴 추가 | [CONVENTIONS.md](./docs/CONVENTIONS.md) | 절대 금지 / 항상 지킬 것 |
| 패키지 추가/버전 변경 | [STACK.md](./docs/STACK.md) | 패키지 표 갱신 |
| 위 모든 변경 (요약) | [CHANGELOG.md](./docs/CHANGELOG.md) | Unreleased 섹션 한두 줄 추가 |
| **콘텐츠·수요 수치가 바뀌는 작업** (드레인 · 발행 · 마이그레이션) | **본 문서 §📊 DB 핵심 통계** | `pnpm docs:db-stats` **실행** — 손으로 고치지 않는다. 마커 안은 스크립트 생성물이다 |

**갱신 원칙**:
- 정확도 100% — DB direct query / grep 으로 검증 가능한 사실만
- 같은 turn 안에 코드와 .md 함께 변경 (drift 차단)
- 사용자에게 별도 알림 없이 자동 — 작업 결과 요약에만 "+ 관련 doc 갱신" 한 줄

### 2️⃣ Git 자동 commit / push 정책

**자동 트리거** (Claude 가 판단):
- 한 logical milestone 종료 시 (예: 큐레이션 시맨틱 재정의 / 새 모듈 추가 / 마이그레이션 적용 / 문서 정비 묶음 등)
- 또는 변경 파일 ≥5 개 누적 시
- 또는 사용자가 다음 작업으로 명확히 넘어가는 시점

**Commit 규칙**:
- Conventional commits: `feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `perf:`
- 첫 줄 ≤72자 한국어 OK
- 본문에 핵심 변경 list (3-5개)
- 마이그레이션 / 새 라우트 / 새 RPC 는 명시
- `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` 항상 첨부

**Push 규칙**:
- 현재 작업 브랜치 → 자동 push OK (사용자 명시 권한)
- **main 으로 직접 push 절대 금지** — PR 생성 권장
- force push 절대 금지 (사용자 명시 요청 시만)
- `--no-verify` 절대 금지 (hook 실패 시 root cause 찾기)

**Merge 규칙**:
- PR 생성 후 자동 merge: CI 통과 + main 보호 정책 준수 시만 (현재 정책 미확정 — 우선 보류)
- 현재 작업 브랜치 → main 자동 merge 는 사용자 확인 (위험)

**안전 안티패턴 (자동화 예외 — 항상 사용자 확인)**:
- `.env*` 파일 commit
- 새로 추가된 API 키 / secret 포함 변경
- 빌드/테스트 실패 상태 push
- DB 데이터 손실 변경 (DROP TABLE / TRUNCATE 등)
- 파일 ≥30 개 변경 (정상 milestone 아님 — 확인 필요)

이 정책은 별도 사용자 지시로 변경 가능. [feedback_auto_doc_and_git.md](C:\Users\kille\.claude\projects\c--Users-kille-Vocaflow\memory\feedback_auto_doc_and_git.md) 도 참조.

### 3️⃣ Admin 화면도움말 동반 갱신 (필수)

Admin 파이프라인 화면은 **화면마다(탭이 있으면 탭마다) 화면도움말을 갖는다**. 관리자는 이 도움말로 "여기서 뭘 하는 곳이고 다음에 뭘 눌러야 하는지"를 판단하므로, **도움말이 낡으면 잘못된 조작을 유발한다** — 코드보다 위험하다.

| 항목 | 위치 |
|---|---|
| 스키마 | `apps/web/src/lib/admin/help/types.ts` (`ScreenHelp` · `HelpStep` · `HelpField` · `HelpDrain`) |
| 데이터 | `apps/web/src/lib/admin/help/<pipeline>.ts` — 파이프라인별 파일 (articles · curation · comic · pd-comics · vocab · vrl · quality · ops) |
| 병합 | `apps/web/src/lib/admin/help/index.ts` → `HELP_REGISTRY` |
| 렌더 | `apps/web/src/components/admin/AdminScreenHelp.tsx` — 헤더 `화면 도움말` 버튼 → 인라인 펼침 패널 |

**같은 커밋에서 반드시 함께 갱신** (사용자 요청 없어도):

| Admin 변경 | 도움말에서 고칠 것 |
|---|---|
| 버튼 / 액션 추가·삭제·이름 변경 | `fields` · 관련 `steps` |
| 탭 추가·삭제, **탭 라벨 변경** | `tabs` 키 (렌더러가 라벨 문자열로 조회 — 라벨만 바꾸면 도움말이 조용히 사라진다) |
| 작업 순서 / 상태 전이 변경 | `steps` (+ 각 단계 `done` 완료 신호) |
| Claude Code 드레인 절차·API·큐 변경 | `drain.procedure` · `prerequisites` · `verify` · `recovery` — **재실행 안전 여부 명시 필수** |
| 되돌릴 수 없는 동작 추가 (DELETE · 외부 유료 호출 등) | `cautions` 에 추가 |
| 새 Admin 화면 추가 | 해당 `<pipeline>.ts` 에 항목 추가 + 화면에 `<AdminScreenHelp screen="<슬러그>" tab={활성탭} />` 배선 |

**작성 원칙**: 화면에 이미 쓰인 라벨을 반복하지 않는다 (도움말은 라벨이 말하지 않는 것 — 순서·전제·되돌리기 가능 여부·실패 시 결과·소요 시간을 말한다). 수치·임계값은 코드에서 확인한 실제 값만. 레지스트리 키는 라우트 슬러그.

### 4️⃣ 정기 플랫폼 진단 (분기 1회 · 필수)

이 프로젝트의 실패 모드는 **"공급망 비대 / 수요 검증 0"** 이다. 콘텐츠 파이프라인은 AI 페어로 무한히 늘지만
학습자 수·리텐션·지불 의사는 자동으로 늘지 않고, 그 격차는 **분기 단위로만 눈에 띈다**.
그래서 달력에 박아 둔다 — 절차·질의문·산술 모델·기록표는 **[docs/PLATFORM_AUDIT.md](./docs/PLATFORM_AUDIT.md)**.

| | |
|---|---|
| **주기** | 분기 1회 (1·4·7·10월 첫 주). 다음 예정 **2026-10 첫 주** |
| **즉시 트리거** | 새 학습 모듈 검토 · 모바일 앱 착수 검토 · 결제 PG 연동 직전 · 투자/지원사업 지원 직전 · 가입자 100/1,000/10,000 돌파 · 경쟁사 대형 이벤트 |
| **근거 규칙** | **문서(.md)의 수치를 근거로 쓰지 않는다.** DB 직접 질의 + 저장소 실계수 + 1차 공개자료만. (2026-08-16 실측 시 `CLAUDE.md` 는 `library_books 20`·`vocabularies 5,896` 이라 적고 있었으나 실제는 401·2,200 이었다) |
| **순서** | 측정 → 기록 → (별도 결정) → 수정. 같은 턴에 고치면 측정이 오염된다. **예외**: 공개 라우트의 목업/허위 수치는 발견 즉시 제거 (표시광고법 리스크) |
| **산출물** | 아티팩트 리포트 + `PLATFORM_AUDIT.md` §7 기록표에 한 행 + `CHANGELOG.md` 한 줄 |

**1회차 (2026-08-16) 기준선** — 앱 81,747 LOC · 어휘 데이터 253만 행 · **가입자 3 · 학습기록 604 · 발행 도서 13/401 · 학습자 표면 22 · 계측 없음 · 결제 없음**.
공급:수요 = **3,480 : 1**. 판정 `risk`. 상시 결함 F1–F7 은 `PLATFORM_AUDIT.md` §8 에서 해소될 때까지 매 회차 재확인.
핵심 산술: 가입 10만 → 유료 500~1,800 → **연매출 0.6~2.1억**, 허용 CAC 가입당 **₩400** → 광고로는 불가, **교사 3,500명 × 학급 30명** 경로만 성립.
리포트: <https://claude.ai/code/artifact/a36b68f6-5fdc-4395-b735-a9fd83fce574>

---

## 📌 보조 .md (워크스페이스별 짧은 가이드)

| 파일 | scope |
|---|---|
| [apps/web/CLAUDE.md](./apps/web/CLAUDE.md) | Next.js 14 App Router 보충 (45 lines) |
| [apps/mobile/CLAUDE.md](./apps/mobile/CLAUDE.md) | RN/Expo 보충 (15 lines) |
| [packages/design-tokens/CLAUDE.md](./packages/design-tokens/CLAUDE.md) | 토큰 패키지 (21 lines) |

---

*CLAUDE.md v06.34 — 슬림 인덱스. 영역별 상세는 [docs/](./docs/) 참조.*
