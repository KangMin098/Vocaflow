# Vocaflow

> 영어 스크립트 기반 9 모듈 종합 학습 플랫폼. 한국 고등학생~성인 대상.
> Web (Next.js 14) + iOS/Android (React Native Expo, Phase 2).

---

## 🚀 Claude Project 첫 진입 — 이 순서로 읽으세요

본 repo 는 **Claude Project (chat) ↔ VS Code (Claude Code) ↔ GitHub** 가 한몸으로 작동하도록 구성됨. Project 채팅에서 작업을 시작할 때 아래 순서로 빠르게 맥락 확보:

| 단계 | 파일 | 무엇을 얻나 |
|---|---|---|
| 1 | [`docs/CONTEXT.md`](./docs/CONTEXT.md) | **현재 시각의 한 줄 상태** — 활성 branch / 최근 milestone / 작업 중 영역 |
| 2 | [`CLAUDE.md`](./CLAUDE.md) | 항상 적용되는 7 학습 원칙 + 4 디자인 철학 + 절대 금지 / 항상 지킬 것 |
| 3 | [`docs/PROJECT.md`](./docs/PROJECT.md) | 서비스 정체성 + 9 모듈 + 워크스페이스 구조 |
| 4 | [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) Unreleased | 가장 최근에 무엇이 바뀌었는지 |

이후 작업 영역에 따라 attachment 선택 (아래 §"Claude Project Attachment 권장 조합" 참조).

---

## 시작하기

```bash
# 의존성
pnpm install

# 환경 변수 (`.env.local`)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LCP_INTERNAL_TOKEN=
ANTHROPIC_API_KEY=

# 개발 서버
pnpm dev

# 빌드
pnpm build

# Type check / Lint / Test
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter web test:e2e
```

`.env.local` 파일은 git 추적 안 됨 — 환경별로 직접 설정.

---

## 워크스페이스 구조

```
apps/web/         ← Next.js 14 App Router (실 구현)
apps/mobile/      ← React Native Expo (Phase 2 기획)
packages/         ← design-tokens · ui-shared · types · library-pipeline · vcb-core · vcb-curate-core · wlp
supabase/         ← SQL migrations
scripts/          ← VCB CLI / Dictionary fill / seed scripts
docs/             ← Claude Project attachment 후보 (16 영역)
.github/workflows/← CI (sync-check 등)
```

상세: [`docs/PROJECT.md`](./docs/PROJECT.md).

---

## 문서 인덱스

| 문서 | 내용 |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | **항상 attached** — 7원칙 + 4철학 + 절대 금지 + 항상 지킬 것 + 문서 navigation |
| [docs/CONTEXT.md](./docs/CONTEXT.md) | **현재 시각 한 줄 상태** (Project 첫 진입 1초 안에 파악) |
| [docs/PROJECT.md](./docs/PROJECT.md) | 서비스 정체성 · 9 모듈 · 워크스페이스 |
| [docs/STACK.md](./docs/STACK.md) | 기술 스택 + 패키지 버전 (Next 14 / Supabase / ts-fsrs 등) |
| [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | CSS Variables · 컴포넌트 패턴 · 토큰 |
| [docs/LEARNING_MODEL.md](./docs/LEARNING_MODEL.md) | 9 계층 (L0~L7) + FSRS + 7 학습 원칙 |
| [docs/MODULES.md](./docs/MODULES.md) | 9 모듈 + EchoMatch (모듈별 컴포넌트 list) |
| [docs/ROUTES.md](./docs/ROUTES.md) | 라우트 전수 (page / API / layout) |
| [docs/DB_SCHEMA.md](./docs/DB_SCHEMA.md) | 57 테이블 · 5 view · 222 함수 · 57 migrations |
| [docs/LIBRARY_PIPELINE.md](./docs/LIBRARY_PIPELINE.md) | LCP · VCB · VRL · ACP 파이프라인 |
| [docs/ADMIN_CONSOLE.md](./docs/ADMIN_CONSOLE.md) | `/admin/*` 콘솔 |
| [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) | 코딩 규약 + 안티패턴 + PR 체크리스트 |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Unreleased + v06.32~ 누적 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 시스템 아키텍처 다이어그램 |
| [docs/DESIGN_DECISIONS.md](./docs/DESIGN_DECISIONS.md) | ADR 인덱스 |
| [docs/proposals/](./docs/proposals/) | 작업 제안 (미확정) |
| [docs/adr/](./docs/adr/) | ADR 본문 (append-only) |

---

## Claude Project Attachment 권장 조합

`docs/` 산하 .md 들을 Claude Project attachment 로 선택적 사용. 전체 첨부는 토큰 비효율 — 작업 영역에 따라 1~4 개만 골라 attach.

| 작업 영역 | 권장 attachments |
|---|---|
| 첫 진입 (어떤 작업이든) | `CLAUDE.md` (항상) + `docs/CONTEXT.md` |
| UI / 컴포넌트 | + `DESIGN_SYSTEM.md` + `MODULES.md` |
| DB / 마이그레이션 | + `DB_SCHEMA.md` + `LIBRARY_PIPELINE.md` |
| 라이브러리 큐레이션 | + `LIBRARY_PIPELINE.md` + `ADMIN_CONSOLE.md` + `DB_SCHEMA.md` |
| 학습 모듈 / 새 모듈 | + `LEARNING_MODEL.md` + `MODULES.md` |
| 라우트 설계 | + `ROUTES.md` + `MODULES.md` |
| 코드 리뷰 / 컨벤션 | + `CONVENTIONS.md` + `CHANGELOG.md` |
| 아키텍처 결정 | + `ARCHITECTURE.md` + `DESIGN_DECISIONS.md` |

---

## 동기화 모델 (한몸 작동)

```
 [Claude Project (chat)] ← 설계 / 점검 / 분석
        ↑ GitHub sync (push 후 자동)
 [GitHub origin]
        ↑ push (논리적 milestone)
 [VS Code + Claude Code] ← 코드 / DB migration / 테스트
```

핵심 원칙: **Project 가 봐야 할 것은 모두 git 안에 SSoT 로**. 머신/사용자별 설정 (`.env.local`, `.claude/settings.local.json`)은 추적 X.

자동화 (3 레이어):

**1. 매 commit — git pre-commit hook** (`.githooks/pre-commit`)
- Claude Code 외부 memory 를 `docs/AI_CONTEXT/` 로 자동 mirror
- `docs/CONTEXT.md` 자동 블록 갱신
- 변경분만 자동 stage (이번 commit 에 포함)
- `pnpm install` 시 `prepare` script 가 1회 활성화 (`git config core.hooksPath .githooks`)
- 수동 활성화: `node scripts/setup-git-hooks.mjs`
- 수동 실행: `pnpm sync:memory`

**2. push / PR — GitHub Actions** (`.github/workflows/sync-check.yml`)
- TypeScript 0 error 검증 (web + library-pipeline)
- `docs/*.md` 내 코드 경로 링크 실존 (warning)
- 새 supabase migration 추가 시 `docs/DB_SCHEMA.md` / `CHANGELOG.md` 갱신 함께 진행 검증 (PR block)
- CHANGELOG Unreleased 섹션 비어있지 않음 (PR block)

**3. 사람 갱신** (매 milestone 또는 월 1회)
- `docs/CONTEXT.md` §2~§3 (활성 영역 + 잔여 작업) — 자동화 불가, 큐레이션 필요

---

## 기여 가이드

1. PR 머지 전 [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) PR 자가 점검
2. 새 마이그레이션은 사용자 승인 후 `apply_migration` (자동 적용 금지)
3. 변경 이력은 [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) Unreleased 섹션에 한 줄 추가
4. 3개 버전 (v06.32~) 외 변경은 git 이력 참조

---

## 외부 참조

- Repository: https://github.com/KangMin098/Vocaflow
- Supabase project: `jajenrevcbmrpaliomxv` (vocaflow-dev)
- License: ISC
- CEFR-J Wordlist v1.6 Citation: Yukio Tono, Tokyo University of Foreign Studies
