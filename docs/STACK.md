# Tech Stack

> Vocaflow 모노레포 기술 스택 + 버전. `package.json` 직접 verified. 작성 시점: 2026-06-08.

---

## 모노레포 (Turborepo)

| 항목 | 버전 | 비고 |
|---|---|---|
| Node | >=20 | engines |
| pnpm | 9.0.0 | packageManager |
| turbo | 2.9.6 | turbo.json |
| TypeScript | 5.x (web 5.9.3) | strict |
| Prettier | 3.8.3 | + prettier-plugin-tailwindcss 0.7.3 |

### 워크스페이스 구조

```
vocaflow/
├── apps/
│   ├── web/         ← Next.js 14 (실 구현)
│   └── mobile/      ← React Native / Expo (기획)
├── packages/
│   ├── design-tokens/       ← CSS Vars + RN tokens
│   ├── ui-shared/           ← 플랫폼 무관 로직
│   ├── types/               ← 공유 TS 타입
│   ├── library-pipeline/    ← LCP fetchers + normalize/segment/analyze
│   ├── vcb-core/            ← VCB 핵심 로직
│   ├── vcb-curate-core/     ← VCB curation
│   └── wlp/                 ← Word Learning Pipeline
├── supabase/
│   ├── migrations/          ← 57 SQL migrations
│   └── functions/           ← Edge Functions
├── docs/                    ← 본 문서들
└── scripts/                 ← 워크스페이스 유틸 (VCB · dict · seed)
```

---

## Web App (`apps/web`)

### Framework

| 패키지 | 버전 | 용도 |
|---|---|---|
| `next` | 14.2.35 | App Router |
| `react` | 18.x | |
| `react-dom` | 18.x | |
| `eslint-config-next` | 14.2.35 | |
| `typescript` | 5.x | |
| `vitest` | 1.6.0 | 단위 테스트 |
| `@playwright/test` | 1.60.0 | E2E |
| `@axe-core/playwright` | 4.12.x | 접근성 자동 감사(WCAG 2.1 AA) — 14-learner-quality 게이트 |

### Supabase

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@supabase/supabase-js` | 2.104.1 | Client |
| `@supabase/ssr` | 0.10.2 | SSR 쿠키 |
| `supabase` (CLI) | 2.98.1 | 마이그레이션 |

### UI / 스타일

| 패키지 | 버전 | 용도 |
|---|---|---|
| `tailwindcss` | 3.4.1 | |
| `tailwind-merge` | 3.5.0 | className 병합 |
| `clsx` | 2.1.1 | conditional class |
| `lucide-react` | 1.11.0 | 아이콘 |
| `postcss` | 8.x | |

### State / Data

| 패키지 | 버전 | 용도 |
|---|---|---|
| `swr` | 2.4.1 | useTexts / useHubData 등 |
| `zustand` | 5.0.12 | Phase 3 wordVaultStore (예정) |
| `@tanstack/react-virtual` | 3.13.24 | 큰 리스트 가상화 |

### AI

| 패키지 | 버전 | 용도 |
|---|---|---|
| `@anthropic-ai/sdk` | 0.92.0 | Claude (analyzeBook · quiz 생성) |
| `openai` | 6.34.0 | OpenAI (fallback) |

### 학습 도메인

| 패키지 | 버전 | 용도 |
|---|---|---|
| `ts-fsrs` | 5.2.3 | FSRS 알고리즘 (Anki 23.10+ 검증) |
| `@mintplex-labs/piper-tts-web` | 1.0.4 | Piper TTS (브라우저) |
| `pitchfinder` | 2.3.4 | YIN 알고리즘 (EchoMatch) |
| `dynamic-time-warping-ts` | 1.0.0 | DTW (EchoMatch 3축 비교) |

### 3D / 비주얼

| 패키지 | 버전 | 용도 |
|---|---|---|
| `three` | 0.184.0 | WebGL |
| `@react-three/fiber` | 8.17.10 | React Three |
| `@react-three/drei` | 9.122.0 | R3F helpers |
| `recharts` | 3.8.1 | Dashboard 차트 |

### 기타

| 패키지 | 버전 | 용도 |
|---|---|---|
| `react-error-boundary` | 6.1.1 | 에러 바운더리 |
| `server-only` | 0.0.1 | 서버 전용 모듈 마킹 |

---

## Mobile App (`apps/mobile`)

기획 단계 — 실 구현은 Phase 2+.

타깃 스택:
- Expo SDK
- React Native
- Expo Router (file-based)
- `@expo-google-fonts/*` (Plus Jakarta Sans · DM Sans · Lora · JetBrains Mono)
- `expo-speech` (TTS)
- `expo-av` (오디오)
- `expo-secure-store`
- AsyncStorage 어댑터 (Supabase)
- EAS Build/Submit

---

## Workspace Packages

### `@vocaflow/design-tokens`

CSS Variables + RN tokens 동시 export.
```ts
export const tokens = {
  p: '#3B82F6', pHover: '#2563EB', ...
  s: { 1: 4, 2: 8, ..., 12: 48 },
  r: { sm: 6, md: 8, ..., '2xl': 24 },
}
```

### `@vocaflow/library-pipeline`

LCP 파이프라인 코어 — `ingestFromGutenberg` / `ingestFromStandardEbooks` / `ingestFromWikibooks` / `ingestFromWikisource` / `ingestFromLibriVox` / `ingestFromOpenStax` / `ingestFromSimpleWikipedia` / `normalizeBook` / `segmentBook` / `analyzeBook`.

### `@vocaflow/vcb-core` + `vcb-curate-core`

VCB 핵심 + curation 로직.

### `@vocaflow/wlp`

Word Learning Pipeline.

### `@vocaflow/types`

공유 TS 타입 — `Tables<'texts'>`, `Tables<'shared_dictionary'>` 등.

---

## 외부 인프라

| 영역 | 서비스 | 용도 |
|---|---|---|
| Hosting (Web) | Vercel | Next.js |
| Backend Worker | Railway | (예정 — pg_cron 대체) |
| DB | Supabase | PostgreSQL + RLS + Edge Functions |
| Auth | Supabase Auth | + Google OAuth |
| Storage | Supabase Storage | uploads/ bucket |
| LLM | Anthropic Claude | analyzeBook · 단어 분류 |
| LLM (fallback) | OpenAI | |
| TTS | Web Speech API | Dictation 기본 |
| TTS (브라우저 모델) | Piper | (Phase 2+) |
| 도서 소스 | Project Gutenberg | PD 전자책 |
| 도서 소스 | Standard Ebooks | 정제 EPUB |
| 도서 소스 | OpenStax | 교과서 |
| 도서 소스 | Wikibooks / Wikisource | 위키 |
| 도서 소스 | LibriVox | 오디오북 |
| Article 소스 | arXiv / NASA / NIH / VOA | |
| 분석 | (예정) | |

---

## 루트 스크립트 (package.json)

```bash
pnpm dev                    # turbo run dev
pnpm build                  # turbo run build
pnpm lint                   # turbo run lint
pnpm typecheck              # turbo run typecheck
pnpm test                   # turbo run test
pnpm test:wlp               # WLP 패키지 한정
pnpm format                 # prettier --write .

# DB
pnpm db:types               # supabase gen types → packages/types/src/database.ts
pnpm db:push                # supabase db push
pnpm db:diff                # supabase db diff --use-migra
pnpm db:new                 # supabase migration new

# Dictionary seed/fill
pnpm db:seed-dictionary     # scripts/seed-dictionary.mjs
pnpm db:seed-dictionary:dry # --dry-run
pnpm db:dict:fetch          # 50개 batch 추출
pnpm db:dict:update         # batch UPDATE (멱등)
pnpm db:dict:status         # CEFR별 진행률

# VCB 파이프라인
pnpm vcb:ingest             # 01
pnpm vcb:ingest-ai-seed     # 01b
pnpm vcb:validate-seed-list # 01c
pnpm vcb:normalize          # 02
pnpm vcb:extract            # 03
pnpm vcb:dict-lookup        # 04
pnpm vcb:export-job         # 05a
pnpm vcb:validate-output    # 05c
pnpm vcb:import-enriched    # 05d
pnpm vcb:qa                 # 06
pnpm vcb:curate             # 07
pnpm vcb:publish            # 08
pnpm vcb:publish-precheck   # 08b
```

---

## Web 스크립트 (apps/web/package.json)

```bash
pnpm --filter web dev           # next dev
pnpm --filter web build         # next build
pnpm --filter web start         # next start
pnpm --filter web lint          # next lint
pnpm --filter web typecheck     # tsc --noEmit
pnpm --filter web test          # vitest run
pnpm --filter web test:watch    # vitest
pnpm --filter web test:e2e      # playwright test
pnpm --filter web test:e2e:ui   # playwright test --ui
pnpm --filter web test:e2e:report
```

---

## Supabase 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL          # 클라이언트 + 서버
NEXT_PUBLIC_SUPABASE_ANON_KEY     # 클라이언트
SUPABASE_SERVICE_ROLE_KEY         # 서버 전용 (절대 클라이언트 노출 금지)
LCP_INTERNAL_TOKEN                # /api/lcp/process 인증 (X-LCP-Token)
ANTHROPIC_API_KEY                 # Vault 권장
OPENAI_API_KEY                    # Vault 권장
```

### Supabase MCP

Claude Code 에서 Supabase MCP 사용 시 `project_id=jajenrevcbmrpaliomxv` (vocaflow-dev).

---

## 폰트 (Google Fonts)

```
Plus Jakarta Sans  300/400/500/600/700/800  (Display / UI)
DM Sans            9..40 / 300/400/500/600  (Body)
Lora               400/500/600/700          (영어 본문)
JetBrains Mono     400/500/700              (코드 / 게임)
```

---

## VS Code 권장 확장 (참고)

- ESLint (eslint-plugin-react · plugin-tailwindcss)
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Importer
- Error Lens

---

## 검증 방법

```bash
# Node 버전
node -v   # >=20

# pnpm 버전
pnpm -v   # 9.0.0

# Turbo 버전
pnpm turbo --version  # 2.9.6

# 패키지 인벤토리
cat package.json | jq '.devDependencies, .dependencies'
cat apps/web/package.json | jq '.dependencies, .devDependencies'
```
