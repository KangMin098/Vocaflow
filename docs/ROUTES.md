# Routes Map

> Next.js 14 App Router. 모든 page.tsx · route.ts · layout.tsx 직접 파일 스캔으로 검증. 작성 시점: 2026-06-08.
>
> **카운트**: page.tsx 77 · route.ts 23 · layout.tsx 11.

---

## 라우트 그룹 구조

| 그룹 | URL | 인증 | 레이아웃 |
|---|---|---|---|
| `(auth)` | `/login` / `/signup` / `/reset-password` / `/verify-email` | 미인증 | 헤더 없음 |
| `(marketing)` | `/about` / `/pricing` / `/privacy` / `/terms` | 공개 | 랜딩 |
| `(main)` | `/hub` / `/text/*` / `/wordvault/*` 등 | 인증 필요 | Sidebar + FlowNav + SessionFrame |
| `(app)` | `/play/wordblitz` / `/play/pirate-quest` | 인증 | 풀스크린 (Sidebar X · SessionFrame ✓) |
| `admin/*` | `/admin/*` | admin/curator only | AdminSidebar |
| `dev/*` | `/dev/components` | 개발 | 카탈로그 |

---

## (main) 사용자 앱 라우트

### 코어 진입

| 경로 | 파일 | 비고 |
|---|---|---|
| `/hub` | `(main)/hub/page.tsx` | Home + Dashboard 통합 진입점 |
| `/dashboard` | `(main)/dashboard/page.tsx` + `layout.tsx` | KPI · 28일 sparkline · ModuleAccuracyRing · RecentActivity |
| `/settings` | `(main)/settings/page.tsx` | 계정·테마·TTS·알림 |

### 스크립트 (TextViewer · L1 Acquire / L2 Comprehend)

| 경로 | 파일 | 비고 |
|---|---|---|
| `/text` | `(main)/text/page.tsx` | 허브 — 내 스크립트 라이브러리 |
| `/text/new` | `(main)/text/new/page.tsx` | 입력 — 단일 / 책 (챕터별) 모드 (v06.34) |
| `/text/[id]` | `(main)/text/[id]/page.tsx` + `layout.tsx` | 워크스페이스 (ReadingUniverse + ChapterSidebar) |
| `/text/[id]/echo` | `(main)/text/[id]/echo/page.tsx` | EchoMatch 따라읽기 (v06.33) |

### 라이브러리 (L0 Discover)

| 경로 | 파일 | 비고 |
|---|---|---|
| `/library` | `(main)/library/page.tsx` + `layout.tsx` | redirect → `/library/books` |
| `/library/books` | `(main)/library/books/page.tsx` | 도서 그리드 (BooksExplorer) |
| `/library/books/[bookId]` | `(main)/library/books/[bookId]/page.tsx` | 도서 상세 |
| `/library/vocab` | `(main)/library/vocab/page.tsx` | 공용 단어장 (8 카테고리) |
| `/library/scripts` | `(main)/library/scripts/page.tsx` | redirect → `/library/books` (v06.34) |
| `/library/scripts/[bookId]` | `(main)/library/scripts/[bookId]/page.tsx` | redirect → `/library/books/[bookId]` |

### 내 자산

| 경로 | 파일 | 비고 |
|---|---|---|
| `/my` | `(main)/my/page.tsx` | 내 라이브러리 hub |
| `/my/books` | `(main)/my/books/page.tsx` | 내 enrolled 도서 |
| `/my/books/[bookId]` | `(main)/my/books/[bookId]/page.tsx` | resume (1st in-progress chapter) |
| `/my/texts` | `(main)/my/texts/page.tsx` | 내 텍스트 |
| `/my/words` | `(main)/my/words/page.tsx` | 내 단어 |

### 단어장 (WordVault · L3 Encode)

| 경로 | 파일 | 비고 |
|---|---|---|
| `/wordvault` | `(main)/wordvault/page.tsx` | hub v6 (BookShelf · LearningDimension · WordPeek + CEFR Dist · FindAndMore) |
| `/wordvault/browse` | `(main)/wordvault/browse/page.tsx` | 풀스크린 브라우즈 세션 (v06.22) |

### 진단

| 경로 | 파일 | 비고 |
|---|---|---|
| `/diagnostic` | `(main)/diagnostic/page.tsx` | 5 진단 (base / csat / business / academic / comprehensive) |
| `/diagnostic/history` | `(main)/diagnostic/history/page.tsx` | user_level_snapshots audit timeline |

### 학습 모듈 hub + play

| 모듈 | hub | play | 결과 | 비고 |
|---|---|---|---|---|
| **Flashcard** (L4a 재인) | `/flashcard` | `/flashcard/play` | — | SM-2/FSRS · 3D flip |
| **SpellForge** (L4b 시각생성) | `/spellforge` | `/spellforge/play` | — | 타이핑 · IME 분리 |
| **WordBlitz** (L4a 자동화) | `/wordblitz` | `(app)/play/wordblitz` | — | 풀스크린 3D 정글 |
| **PairFlip** (L4a 공간기억) | `/pairflip` | `/pairflip/play` | `/pairflip/results` | 5단계 (8~20장 · 2줄 고정) |
| **ScriptQuiz** (L5 정복) | `/scriptquiz` | `/scriptquiz/play` | — | 3-screen 영어 immersion |
| **Dictation** (L6 완성) | `/dictate` | `/dictate/setup` → `/dictate/session` | `/dictate/results` | CEFR 자동감지 · 단어별 채점 |

### 베타

| 경로 | 파일 | 비고 |
|---|---|---|
| `/play/pirate-quest` | `(app)/play/pirate-quest/page.tsx` | 단어 모험 (R3F) |

---

## (auth) 인증 라우트 (4)

| 경로 | 비고 |
|---|---|
| `/login` | 로그인 |
| `/signup` | 회원가입 |
| `/reset-password` | 비밀번호 재설정 |
| `/verify-email` | 이메일 인증 |

---

## (marketing) 공개 페이지 (4)

| 경로 | 비고 |
|---|---|
| `/about` | 소개 |
| `/pricing` | 요금 |
| `/privacy` | 개인정보 |
| `/terms` | 약관 |

---

## admin/* 관리자 콘솔

### 메타 / 운영

| 경로 | 파일 | 비고 |
|---|---|---|
| `/admin` | `admin/page.tsx` + `layout.tsx` | KPI 4 + 섹션 + 활동 피드 |
| `/admin/users` | stub | 사용자 관리 |
| `/admin/analytics` | stub | 플랫폼 분석 |
| `/admin/reports` | stub | 신고/문의 (실 데이터 뱃지 — `reports.status='open'` count) |
| `/admin/billing` | stub | 결제 |
| `/admin/settings` | stub | 시스템 설정 |

### LCP — 도서 큐레이션

| 경로 | 파일 | 비고 |
|---|---|---|
| `/admin/curation` | `admin/curation/page.tsx` + `AdminCurationClient.tsx` | 8탭 (Sources · BulkFetch · Seed · ID 4종 · MyLibrary) |
| `/admin/curation/preview/[bookId]` | `admin/curation/preview/[bookId]/page.tsx` + `AdminReviewClient.tsx` | 도서 본문 검수 + LibriVox 매핑 패널 + 챕터 단어장 검수 |
| `/admin/library` | `admin/library/page.tsx` | 콘텐츠 관리 (예정) |
| `/admin/articles` | `admin/articles/page.tsx` | ACP Pipeline (짧은 글) — Curated 탭에서 제목/검수 클릭 → 검수 페이지 |
| `/admin/articles/preview/[id]` | `admin/articles/preview/[id]/page.tsx` + `AdminArticleReviewClient.tsx` | 글 본문 검수 (정독 + CEFR/단어 분석 + 게시/보관/처리) — LCP 책 검수 미러 |
| `/admin/pending-words` | `admin/pending-words/page.tsx` | 미바인딩 단어 검수 (v06.34 신규) |

### VCB — 공용 단어장 빌드

| 경로 | 파일 | 비고 |
|---|---|---|
| `/admin/vocab` | `admin/vocab/page.tsx` + `layout.tsx` | VCB 메인 |
| `/admin/vocab/curate/[run_id]` | curate hub | |
| `/admin/vocab/runs` | runs 목록 | |
| `/admin/vocab/runs/new` | 신규 run | |
| `/admin/vocab/runs/[id]` | run 상세 | |
| `/admin/vocab/runs/[id]/seed` | seed 입력 | |
| `/admin/vocab/runs/[id]/seed/preview` | seed 검증 | |
| `/admin/vocab/sources` | sources 목록 | |
| `/admin/vocab/sources/new` | 신규 source | |
| `/admin/vocabulary` | 단어장 마스터 (legacy stub) | |

### VRL — 어휘 분류·진단

| 경로 | 파일 | 비고 |
|---|---|---|
| `/admin/vrl` | `admin/vrl/page.tsx` | Dashboard — KPI 4 + V-Level 12 진행 |
| `/admin/vrl/taxonomy` | `admin/vrl/taxonomy/page.tsx` | Levels(12) / Tracks(6) / Domains(8) / Skills(5) read-only 4 tab |
| `/admin/vrl/concerns` | stub | data_integrity_concerns cleanup |
| `/admin/vrl/diagnostic` | stub | 진단 시드/문제 편집 |
| `/admin/vrl/users` | stub | user_profiles.current_v_level 분포 |
| `/admin/vrl/snapshots` | stub | snapshots audit chain |
| `/admin/vrl/automation` | `admin/vrl/automation/page.tsx` | pg_cron + V-Level 분포 + 진단 활용도 (v06.34) |

---

## API Routes (23)

### `/api/auth/*` (1)

| 경로 | 파일 |
|---|---|
| `POST /api/auth/callback` | `api/auth/callback/route.ts` (Supabase OAuth) |

### `/api/lcp/*` LCP Worker (4)

| 경로 | 비고 |
|---|---|
| `POST /api/lcp/process` | pg_cron worker target — X-LCP-Token + msg_id |
| `POST /api/lcp/dev-process` | dev 환경 admin 트리거 — book_id 단권 |
| `POST /api/lcp/dev-drain-queue` | v06.34 — status='queued' N권 → dev-process 순차 호출 |
| `POST /api/lcp/dev-validate` | dev 검증 |

### `/api/acp/*` ACP Worker (2)

| 경로 | 비고 |
|---|---|
| `POST /api/acp/dev-process` | article 단권 처리 |
| `POST /api/acp/enqueue` | article 큐 등록 |

### `/api/admin/library/*` (11)

| 경로 | 비고 |
|---|---|
| `POST /api/admin/library/fetch-seed-batch` | BulkFetch — 9 소스에서 N권 batch fetch |
| `POST /api/admin/library/preview-gutenberg` | Gutenberg ID 사전 검사 |
| `POST /api/admin/library/preview-openstax` | OpenStax 사전 검사 |
| `POST /api/admin/library/preview-wikisource` | Wikisource 사전 검사 |
| `POST /api/admin/library/preview-wikibooks` | Wikibooks 사전 검사 |
| `POST /api/admin/library/preview-librivox` | LibriVox 사전 검사 |
| `POST /api/admin/library/resolve-librivox-audio` | LibriVox 책 → audio 해결 |
| `POST /api/admin/library/save-librivox-audio` | LibriVox 보이스 매핑 저장 (chapter_parts / flat / 자동 폴백) |
| `POST /api/admin/library/enrich-seed` | seed 메타 enrichment |
| `POST /api/admin/library/convert-to-se` | Standard Ebooks 변환 |
| `POST /api/admin/library/delete-seed-catalog` | seed catalog 정리 |
| `POST /api/admin/library/backfill-covers` | cover_image_url backfill |

### `/api/admin/articles/*` (4)

| 경로 | 비고 |
|---|---|
| `GET /api/admin/articles/arxiv-feed` | arXiv feed |
| `GET /api/admin/articles/nasa-feed` | NASA feed |
| `GET /api/admin/articles/nih-feed` | NIH feed |
| `GET /api/admin/articles/voa-feed` | VOA Learning English feed |

---

## Layout 파일 (11)

| 파일 | scope |
|---|---|
| `app/layout.tsx` | Root — fonts + Toast Provider |
| `app/(auth)/layout.tsx` | 헤더 없음 |
| `app/(marketing)/layout.tsx` | 랜딩 |
| `app/(main)/layout.tsx` | Sidebar + FlowNav + SessionFrame 자동 주입 |
| `app/(main)/dashboard/layout.tsx` | metadata server layout (page.tsx 가 'use client') |
| `app/(main)/library/layout.tsx` | LibraryTabs (2탭 — 도서/단어장) + max-w-6xl |
| `app/(main)/my/layout.tsx` | 내 자산 wrapper |
| `app/(main)/text/[id]/layout.tsx` | 워크스페이스 RSC — v_text_content fetch + chapter context (library_book_id / user_book_group_id 분기) |
| `app/(app)/layout.tsx` | 풀스크린 게임 (WordBlitz / Pirate Quest) — SessionFrame 자동 주입 |
| `app/admin/layout.tsx` | AdminSidebar + 보라 액센트 + reports.status='open' count |
| `app/admin/vocab/layout.tsx` | VCB sub-nav |

---

## 풀스크린 라우트 정책

`isFullScreenRoute(pathname)` (`lib/layout/full-screen-routes.ts`) — Sidebar 와 FlowNav 가 공유:

| 페이지 유형 | URL | Sidebar | FlowNav | SessionFrame |
|---|---|:---:|:---:|:---:|
| 허브 / 메타 | `/hub`, `/text`, `/wordvault`, `/flashcard` 등 | ✅ | ✅ | ❌ |
| 워크스페이스 | `/text/[id]` | ✅ (focus 시 dim) | ✅ | ❌ |
| **게임 play** | `*/play` | ❌ | ❌ | ✅ |
| **Dictation session** | `/dictate/session` | ❌ | ❌ | ✅ |
| **WordVault Browse** | `/wordvault/browse` | ❌ | ❌ | ✅ |
| **(app) 풀스크린** | `/play/wordblitz`, `/play/pirate-quest` | ❌ | ❌ | ✅ ((app) layout 주입) |

---

## 경로 정합 추적 (v06.34 정리됨)

`/library/scripts*` → `/library/books*` redirect 처리:
- `(main)/library/scripts/page.tsx` 가 직접 redirect 함수 호출
- `(main)/library/scripts/[bookId]/page.tsx` 가 동일

이전 mock 데이터 폴더 / 미사용 컴포넌트들은 모두 삭제됨 (v06.34 청소).
