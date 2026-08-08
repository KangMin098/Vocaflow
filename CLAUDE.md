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
| 코드 리뷰 | [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) · [docs/CHANGELOG.md](./docs/CHANGELOG.md) |
| 멀티 세션 / worktree | [docs/WORKTREE.md](./docs/WORKTREE.md) |
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

상세 + PR 체크리스트: [docs/CONVENTIONS.md](./docs/CONVENTIONS.md)

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

## 📊 DB 핵심 통계 (2026-06-08)

- **59 테이블** · **5 view** · **227 함수** · **58 migrations**
- 전체 DB: **350 MB** (v06.34 VACUUM FULL 후, 이전 606 MB)
- `shared_dictionary` 45,292 row · meaning_ko 100%
- `library_books` 20 · `texts` 238 · `vocabularies` 5,896

상세: [docs/DB_SCHEMA.md](./docs/DB_SCHEMA.md)

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
├── supabase/migrations/  ← 57 SQL
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
| 코딩 패턴 / 안티패턴 추가 | [CONVENTIONS.md](./docs/CONVENTIONS.md) | 절대 금지 / 항상 지킬 것 |
| 패키지 추가/버전 변경 | [STACK.md](./docs/STACK.md) | 패키지 표 갱신 |
| 위 모든 변경 (요약) | [CHANGELOG.md](./docs/CHANGELOG.md) | Unreleased 섹션 한두 줄 추가 |

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

---

## 📌 보조 .md (워크스페이스별 짧은 가이드)

| 파일 | scope |
|---|---|
| [apps/web/CLAUDE.md](./apps/web/CLAUDE.md) | Next.js 14 App Router 보충 (45 lines) |
| [apps/mobile/CLAUDE.md](./apps/mobile/CLAUDE.md) | RN/Expo 보충 (15 lines) |
| [packages/design-tokens/CLAUDE.md](./packages/design-tokens/CLAUDE.md) | 토큰 패키지 (21 lines) |

---

*CLAUDE.md v06.34 — 슬림 인덱스. 영역별 상세는 [docs/](./docs/) 참조.*
