# Routes Map

> Next.js 14 App Router. 모든 page.tsx · route.ts · layout.tsx 직접 파일 스캔으로 검증. 작성 시점: 2026-06-08.
>
> **카운트**: page.tsx 123 · route.ts 75 · layout.tsx 11 (2026-08-17 실측). 이 밖에 `robots.ts`·`sitemap.ts`·`opengraph-image.tsx` 메타 라우트 3.

---

## 라우트 그룹 구조

| 그룹 | URL | 인증 | 레이아웃 |
|---|---|---|---|
| `(auth)` | `/login` / `/signup` / `/reset-password` / `/verify-email` | 미인증 | 헤더 없음 |
| `(marketing)` | `/about` / `/fit` / `/fit/s/[payload]` / `/join/[code]` / `/pricing` / `/privacy` / `/terms` | 공개 | 랜딩 + 지문 진단 + 학급 초대 |
| `(main)` | `/hub` / `/text/*` / `/wordvault/*` 등 | 인증 필요 | Sidebar + FlowNav + SessionFrame |
| `(app)` | `/play/wordblitz` / `/play/pirate-quest` | 인증 | 풀스크린 (Sidebar X · SessionFrame ✓) |
| `admin/*` | `/admin/*` | admin/curator only | AdminSidebar |
| `dev/*` | `/dev/components` | 개발 | 카탈로그 |

---

## (main) 사용자 앱 라우트

### 코어 진입

| 경로 | 파일 | 비고 |
|---|---|---|
| ~~`/manage`~~ | **삭제 (v06.108)** | 메타 4→2 통합으로 `/dashboard` 회고의 "학습 관리" 섹션(ManageSection)에 흡수. fetchManageOverview 는 dashboard 가 재사용 |
| `/plan` | `(main)/plan/page.tsx` + `components/plan/PlanClient.tsx` | **P1(컴포저+주간보드 2026-06-29)** 주간 보드(담은 자료를 요일 월~일 배치) + 컴포저 2-pane(좌:자료 고르기 4탭·V밴드·표지 / 우:선택 자료 챕터·활동·요일 한 화면). 자료 4종(도서/article/공용단어장/내 글) · study_plan_items(modules/chapters/weekdays). 회고 "학습 계획" 카드로 진입 |
| `/reports` | `(main)/reports/page.tsx` + `components/reports/ReportsClient.tsx` | **P2** 주간 Report Card(daily_activity 집계 + 격려 코멘트) + "이번 주 갱신" |
| `/teacher` | `(main)/teacher/page.tsx` + `components/teacher/TeacherClient.tsx` | **P4.2 L3 B2B** 교사 허브(클래스 개설·초대코드·참여·멤버수, classes/class_members) |
| `/hub` | `(main)/hub/page.tsx` | **메타 "Today"(forward)** — **TodayStage**(좌: 밀린 단어 지면(뜻+원문 예문) · 우: 처방 5블록 흐름, v06.200) + TodayPlanCard(수동계획 날의 정본) + TodayFocus(미진단). **단일 정본 유지** — 계획이 있으면 처방 흐름을 렌더하지 않는다(v06.108 META). async |
| `/hub-lab` | `(main)/hub-lab/page.tsx` | **내부 전용** 진입면 후보 랩 (`?v=a\|b\|c\|d`, `?t=<시각대>`). 어디에도 링크 없음. 실데이터를 렌더하므로 `PROTECTED_PREFIXES` 등록. 설계 근거·비교 점수 보존용 |
| `/dashboard` | `(main)/dashboard/page.tsx` + `layout.tsx` | **메타 "회고"(backward, L7 단독)** — known-word 성장 헤더 · MemoryStatus · WeeklyHeatmap · **학습 관리 3카드(ManageSection: 진단·계획·리포트)** · RecentActivity. /manage 흡수(v06.108) |
| `/settings` | `(main)/settings/page.tsx` | 계정·테마·TTS·알림 |
| `/sitemap` | `(main)/sitemap/page.tsx` | **전체 보기** — 학습자 화면 전체 지도. 목록은 `sidebar-config` 의 `META_ITEMS`·`NAV_GROUPS`·`ASIDE_GROUP`·`FOOTER_ITEMS` 를 그대로 읽는다(사본 금지). WCAG 2.2 §2.4.5 Multiple Ways(AA) 의 두 번째 길 — 계측 2026-09-01 에 학습자 52 측정 중 43 이 내비 외 경로가 없었다. 메타 라우트 `sitemap.ts`(→ `/sitemap.xml`) 와는 다른 라우트다 |

### 스크립트 (TextViewer · L1 Acquire / L2 Comprehend)

| 경로 | 파일 | 비고 |
|---|---|---|
| `/text` | `(main)/text/page.tsx` | 허브 — **My Library**. `?view=books\|scripts\|vocab` 로 세 면(Books·Texts·Decks) 직접 진입 (v08.4 · 사이드바 서브메뉴가 이 주소를 쓴다) |
| `/text/new` | `(main)/text/new/page.tsx` | 입력 — 단일 / 책 (챕터별) 모드 (v06.34) |
| `/text/[id]` | `(main)/text/[id]/page.tsx` + `layout.tsx` | 워크스페이스 (ReadingUniverse + ChapterSidebar) |
| `/text/[id]/echo` | `(main)/text/[id]/echo/page.tsx` | EchoMatch 따라읽기 (v06.33) |
| `/text/[id]/comic` | `(main)/text/[id]/comic/page.tsx` | Comic Reader (CCP) — 발행 만화 리더, 미발행 EmptyState degrade |

### 라이브러리 (L0 Discover)

| 경로 | 파일 | 비고 |
|---|---|---|
| `/library` | `(main)/library/page.tsx` + `layout.tsx` | redirect → `/library/books` |
| `/library/books` | `(main)/library/books/page.tsx` | 도서 그리드 (BooksExplorer) |
| `/library/books/[bookId]` | `(main)/library/books/[bookId]/page.tsx` | 도서 상세 |
| `/comics` | `(main)/comics/page.tsx` + `layout.tsx` | **만화 — 사이드바 Scripts 아래 별도 메뉴**. redirect → `/comics/adapted`. layout 에 ComicsTabs(Book Comics·Vintage Comics) |
| `/comics/adapted` | `(main)/comics/adapted/page.tsx` | **Book Comics(책 만화 · CCP)** — 라이브러리 도서를 만화로. 발행 카탈로그 + 이어서 보기 (ComicsBrowser) |
| `/comics/adapted/[bookId]` | `(main)/comics/adapted/[bookId]/page.tsx` | 만화 상세 — 미등록·비로그인 프리뷰 3컷 + 포맷 선택(ComicFormatChoice) |
| `/comics/restored` | `(main)/comics/restored/page.tsx` | **Vintage Comics(옛 영어 만화책 · PDCP)** — **유형 → 시리즈 2단 서가**. `?series=<key>` 로 시리즈 안 호 목록. 카드마다 콘텐츠 정보 팝업(`ComicInfoDialog`) |
| `/comics/restored/[slug]` | `(main)/comics/restored/[slug]/page.tsx` | 복원 만화 리더 (호 단위 · 세로 스크롤) |
| `/library/vocab` | `(main)/library/vocab/page.tsx` | 공용 단어장 (8 카테고리) |
| `/library/scripts` | `(main)/library/scripts/page.tsx` | redirect → `/library/books` (v06.34) |
| `/library/scripts/[bookId]` | `(main)/library/scripts/[bookId]/page.tsx` | redirect → `/library/books/[bookId]` |
| `/library/textbooks` | `(main)/library/textbooks/page.tsx` | 교재 서가 — 7계단 진열 + 3축 필터(학령·수준·유형) + 담기 |
| `/library/textbooks/[step]` | `(main)/library/textbooks/[step]/page.tsx` | 교재 한 권 상세 (수록 구성 · 분량 상한 · 담기) |

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
| `/wordvault` | `(main)/wordvault/page.tsx` | hub v6 (Identity · VLevelMap · **FacetProgress**(면 상태·실데이터) · Portfolio · RecommendedBooks · NextStep · Flow) |
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
| **WordBlitz** (L4a 자동화) | `/wordblitz` | `(app)/play/wordblitz` | — | 풀스크린 2D 속사 인지 |
| **PairFlip** (L4a 공간기억) | `/pairflip` | `/pairflip/play` | `/pairflip/results` | 5단계 (8~20장 · 2줄 고정) |
| **ScriptQuiz** (L5 정복) | `/scriptquiz` | `/scriptquiz/play` | — | **v08.6 재설계 — 진입면이 카탈로그가 아니라 "읽은 것의 확인 대기열"**. 이전엔 퀴즈 있는 챕터 129개를 전부 나열(5.57화면)했고 그중 41개는 학습자 미열람이라 **풀면 스포일러**였다. 지금은 `texts.status`(읽음)와 교차해 **읽은 챕터만** 내주고, 다음 한 걸음 하나(읽은 지 가장 오래된 미확인 챕터 · 간격 인출)를 크게 둔다. 데이터 `lib/scriptquiz/queue.ts` · 렌더 `components/game/scriptquiz/ScriptQuizQueue.tsx`. play 는 3-screen 영어 immersion 유지 |
| **Dictation** (L6 완성) | `/dictate` | `/dictate/setup` → `/dictate/session` | `/dictate/results` | CEFR 자동감지 · 단어별 채점 |
| **아케이드 스위트 — Game Lab** (v08.3) | `(main)/arcade` (허브) | `(app)/play/{19종}` | — | 카탈로그 SSoT `lib/game/catalog.tsx` · 브리핑 SSoT `lib/game/brief.ts`. 구역 3(Recall/Synthesis/Inference Bay) + 카드 `(?)` Protocol 다이얼로그. 스코프 3단: `?set=`/`?text=` → 내 due 큐 → 맛보기 |
| **Game Lab 랭킹** (v08.6) | `(main)/arcade/ranking` (`?period=week|month|all`) | — | — | 게임별 리더보드 + 내 랭크. RPC `game_leaderboard` · `game_rank_summary`(SECURITY DEFINER — `scores` RLS 는 자기 행뿐이라 집계 함수 없이는 순위가 불가). **원점수를 게임 사이로 합산하지 않는다**(단위가 다르고 풀 크기에 비례) — 종합은 게임별 백분위 평균. 표시 이름은 결정론적 별칭 기본, 실명은 `user_profiles.leaderboard_visibility` 로 opt-in |
| **Practice — 연습 단일 진입면** (v06.201) | `(main)/practice` | — | — | 사이드바 PRACTICE 5형제(Flashcard·WordBlitz·PairFlip·SpellForge·Game Lab) → 2개로 통폐합. **면(facet)으로 고른다** — `FACETS` 6개 카드 + 가장 무른 면 강조. 도구 = 모듈 4 + Game Lab 게임 17(`lib/learner/practice-map.ts` 가 `GAME_CATALOG.layer` 에서 파생) + 활성 시 `Syntax`. 게임 링크는 `from=/practice` 필수(없으면 종료가 `/arcade` 로 튕김) |
| **DCP 구문 연습** (CTP ⑥) | — | `(main)/practice/dcp` | — | hub 처방 ④ + **`/practice` Use 면**(v06.201 — 그전엔 처방이 유일 진입). order(순서 배열)/insert(위치 삽입) · `grade_dcp_item` 서버 채점 · 오답 error_cause 1-tap |

#### 아케이드 19종 (`(app)/play/<slug>`)

`source` = 학습자에게 보이는 1차 분류축 — "이 게임이 내 단어를 쓰는가".

| source | 게임 | 비고 |
|---|---|---|
| **mine** (8) | `cascade` · `ghost-race` · `word-economy` · `wordfall-cadence` · `letter-forge` · `wordsmith-vigil` · `morphmerge` · `wordblitz` | 스코프 없으면 사용자 due 큐로 플레이 → FSRS 갱신. 단어 부족 시 맛보기 폴백(라벨 명시) |
| **bank** (11) | `daily-blitz` · `connections` · `glyph-tongue` · `word-customs` · `morpheme-rules` · `silent-rule` · `lexicon-hands` · `lexicon-detective` · `lexicon-estate` · `word-orrery` · `pirate-quest` | 내장 큐레이션 뱅크(`minWords=0`) — 사용자 단어 미사용 |

`wordblitz` · `pirate-quest` 는 독립 3D(three.js) 페이지로 `GamePlayScaffold` 미사용. `pirate-quest` 는 베타(학습 기록 미연동).

---

## (auth) 인증 라우트 (4)

| 경로 | 비고 |
|---|---|
| `/login` | 로그인 |
| `/signup` | 회원가입 |
| `/reset-password` | 비밀번호 재설정 |
| `/verify-email` | 이메일 인증 |

---

## 루트 · 개발 (2)

| 경로 | 비고 |
|---|---|
| **`/`** | **랜딩** (`app/page.tsx`, 서버 컴포넌트) — 검색·공유의 정문. sitemap priority 1.0. 1차 CTA 는 가입이 아니라 `/fit`. 지어낸 지표 금지 · 수치는 `lib/marketing/trust-signals.ts` 가 DB 에서 읽는다. 2026-08-26 이전 이 자리는 개발용 화면 인덱스였다 |
| `/dev` | 화면 인덱스 + 진행 현황 (구 `/`). robots 가 막는다 — ⚠️ `'/dev/'` 만으로는 `/dev` 자체가 안 막히므로 목록에 둘 다 있다 |

---

## (marketing) 공개 페이지 (6)

| 경로 | 비고 |
|---|---|
| `/about` | 소개 |
| **`/fit`** | **지문 난이도 진단** — 로그인 없이 학년별 어휘 커버리지 곡선. 가입 전 가치 노출(교사 채널 CAC 0). 분석은 `/api/fit`(서버 메모리 맵 + IP 레이트리밋) · 입력 지문 미저장 · 학습자 표면 아님(F5 분모 제외) · 색인 대상. **교육과정 기본 어휘 축**(`curriculum_bands` RPC, 익명) + **인쇄 학습지**(A4 목록·빈칸, `document.body` portal — 결과 화면 안에 두면 빈 장이 딸려 나온다) |
| **`/fit/s/[payload]`** | **공유받은 결과** — 결과가 URL 에 통째로 담긴다(서버 저장 0). `opengraph-image.tsx` 가 학년별 곡선을 그린 미리보기 PNG 생성(edge 런타임). `noindex` + canonical→`/fit`. ⚠️ 쿼리(`?r=`)가 아니라 **경로 세그먼트**인 이유: `opengraph-image` 는 `searchParams` 를 못 받는다 |
| **`/join/[code]`** | **학급 초대 링크** — 교사가 복사하는 것이 코드가 아니라 이 주소다. 그전에는 맨 코드 6자였고, 받은 학생은 ①주소 찾기 ②가입 ③`클래스` 화면 찾기 ④붙여넣기 넷을 스스로 해야 했다(③은 도달할 이유가 없는 화면). 익명에게 학급 이름·인원을 **가입 전에** 보여준다(`peek_class_by_code`). 참여는 버튼 한 번 — 공개 GET 이 가입을 일으키면 링크 미리보기·prefetch 만으로 들어간다. `noindex, nofollow`(초대는 받은 사람의 것) · sitemap 제외 |
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
| `/admin/topic-corpus` | `admin/topic-corpus/page.tsx` + `TopicCorpusClient.tsx` | TCP — 주제 코퍼스 적재·드레인·승격 (원문 미저장, 어휘 통계만) |
| `/admin/textbook` | `admin/textbook/page.tsx` + `TextbookConsoleClient.tsx` | TBP — 교재. 학령 사다리·문항 건강·시중 대비 평가 우위 (조작 없음 · 생성은 Claude Code 드레인) |
| `/admin/quality` | `admin/quality/page.tsx` | 품질 지표 대시보드 (quality_metrics nightly, read-only) |
| `/admin/quality/gates` | `admin/quality/gates/page.tsx` + `GateCheckClient.tsx` | 콘텐츠 품질 게이트 — 파이프라인 정확성 결정론 불변식 red/green (`run_content_quality_gates`) + 콘텐츠별 게시전 체크 |
| `/admin/quality/judge` | `admin/quality/judge/page.tsx` + `JudgeClient.tsx` | 추출 품질 blind 판정 하네스 (Q3/Q5 골든 라벨 — `get_judgment_sample`/`save_extraction_judgment`) |
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
| `/admin/vocab` | `admin/vocab/page.tsx` + `layout.tsx` | VCB 메인 (→ runs redirect) |
| `/admin/vocab/studio` | `admin/vocab/studio/page.tsx` | **단어장 Studio** — blueprint 30종 조립·채점·발행 (보강 없는 경로) |
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
| `/admin/comic` | `admin/comic/page.tsx` + `AdminComicClient.tsx` | CCP — Catalog(큐 적재·작업순서) / Published(QC 게이트 발행) / 테스트(실험) |
| `/admin/comic/[bookId]` | `admin/comic/[bookId]/page.tsx` + `ComicReviewClient.tsx` | 검수 — 단계 stepper + QC + 컷 전수(썸네일) + 게시/보관/삭제/보완 |
| `/admin/comic/[bookId]/drain` | `admin/comic/[bookId]/drain/page.tsx` + `DrainConsole.tsx` | 드레인 관측 — 실행/진행/자기발전/평가이력/컷상태/발행차단 사유 |
| `/admin/pd-comics` | `admin/pd-comics/page.tsx` + `AdminPdComicsClient.tsx` | **PDCP 운영 콘솔** (CCP와 별도) — 소스·대량 적재 / 큐·드레인 / 도구. 어댑터 능력표 · 테스트 모드(앞 N장) · dry-run · 라이브 로그 · 실패 재시도 |

---

## API Routes (24)

### `/api/auth/*` (1)

| 경로 | 파일 |
|---|---|
| `POST /api/auth/callback` | `api/auth/callback/route.ts` (Supabase OAuth) |

### `/api/wordvault/*` (1)

| 경로 | 비고 |
|---|---|
| `GET /api/wordvault/facets` | 내 단어의 면 분포 + 가장 뒤처진 면. **세션 클라이언트(RLS 적용) · 비로그인 401**. 서버가 접어서 카운트만 내려보낸다 — 인출 이력 전량을 브라우저에 싣지 않기 위해서다 |

### `/api/lcp/*` LCP Worker (4)

| 경로 | 비고 |
|---|---|
| `POST /api/lcp/process` | pg_cron worker target — X-LCP-Token + msg_id |
| `POST /api/lcp/dev-process` | dev 환경 admin 트리거 — book_id 단권 |
| `POST /api/lcp/dev-drain-queue` | v06.34 — status='queued' N권 → dev-process 순차 호출 |

### `/api/pdcp/*` (10) — 퍼블릭도메인 만화 파이프라인 (전부 admin 게이트)

| 라우트 | 설명 |
|---|---|
| `GET/POST /api/pdcp/bulk-ingest` | **원본 전체 소스 GET** — 컬렉션 전량을 검색 응답만으로 훑어 유형·시리즈 분류까지 적재. GET=계획(DB 쓰기 0) · POST=실행. 재실행 멱등. enqueue(상한 50건)와 달리 969건을 IA 요청 11회로 넣는다 |
| `GET/POST /api/pdcp/pd-check` | **PD 근거 확인** — GET=시리즈별 확인 대상 + 갱신 확인 창(발행 27~28년 뒤) + 조회처. POST=**시리즈 단위** 근거 기록(갱신은 호가 아니라 간행물 단위로 등록됨). `no-renewal`·`explicit-license` 는 **근거 URL 없이 저장 거부** |
| `GET /api/pdcp/sources` | 어댑터 능력표 (`scripts/comic/pd/sources` 를 동적 import — 앱에 복제하지 않음) |
| `POST /api/pdcp/search` | 소스별 검색 + 필터(컬렉션·연도·정렬·페이지) + **PD 위험도 랭킹** + 기적재 표시. bulk 미지원 어댑터는 400 |
| `POST /api/pdcp/enqueue` | 대량 적재 → `status='queued'`. `pages` 로 테스트 모드(앞 N장) |
| `POST /api/pdcp/drain` | **dev 전용**(prod 403). 호출 1회 = 호 1개의 다음 단계 1개. `dryRun` 지원 |
| `POST /api/pdcp/retry` | 실패 표시(`last_error`)만 삭제 — 단계 보존, 멈춘 지점부터 재개 |
| `GET /api/pdcp/queue` | 큐 라이브 조회 (드레인 루프가 단계마다 재조회) |
| `GET /api/pdcp/doctor` | 외부 도구 점검 (ffmpeg · tesseract · 소스 접근) |
| `DELETE/PATCH /api/pdcp/issue` | 호 삭제(발행분 거부 · `purge=1` 시 작업 디렉터리 동반 삭제) / 단계 되돌리기 |
| `GET/POST /api/pdcp/assist` | **브라우저 보조 취득** — 방문 대상 사이트 목록 / 실제 크롬 창 세션 시작(dev 전용). 자동 수집이 금지·불가한 소스를 사람이 운전 |
| `POST /api/lcp/dev-validate` | dev 검증 |

### `/api/comics/*` (1) — 학습자 공개 (인증 불필요 · 카탈로그 공개 정책)

| 라우트 | 설명 |
|---|---|
| `GET /api/comics/pd/[slug]/info` | 콘텐츠 정보 팝업 데이터 — `select_pd_comic_info` 래핑. 발행본만 노출(RPC 게이트). 서가 카드마다 미리 싣지 않고 **팝업 열 때** 1건만 (5분 캐시) |

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

### `/api/admin/articles/*` (21)

> 실측 2026-08-21 (`find apps/web/src/app/api/admin/articles -name route.ts`).
> 이전 판은 **4개만 적고 있었고 그중 `arxiv-feed` 는 플랫폼에서 삭제된 소스**였다.

**소스 GET 피드 (15)** — 소스별 후보 목록. `?feed=<id>` 로 피드 선택.

| 경로 | 소스 | 라이선스 | register |
|---|---|---|---|
| `GET …/voa-feed` | VOA Learning English (13피드) | PD | news · expository · narrative |
| `GET …/nasa-feed` | NASA (3피드) | PD | expository |
| `GET …/nih-feed` | NIH (3피드 — 실측 전부 수확 0) | PD | expository |
| `GET …/usgs-feed` | USGS | PD | expository |
| `GET …/noaa-feed` | NOAA Climate.gov | PD | expository |
| `GET …/factbook-feed` | CIA World Factbook | PD | reference |
| `GET …/futurity-feed` | **Futurity (2026-08-21 신설)** | CC BY 4.0 | expository |
| `GET …/plos-feed` | PLOS — `?feed=recent|essay` | CC BY 4.0 | expository · **argumentative** |
| `GET …/elife-feed` | eLife digest | CC BY | expository |
| `GET …/owid-feed` | Our World in Data | CC BY | argumentative |
| `GET …/wikipedia-feed` | English Wikipedia FA/GA | CC BY-SA | expository |
| `GET …/simple_wikipedia-feed` | Simple English Wikipedia | CC BY-SA | expository |
| `GET …/wikivoyage-feed` | Wikivoyage | CC BY-SA | reference |
| `GET …/wikinews-feed` | Wikinews (소스 비활성 — 실측 0건) | CC BY | news |
| `GET …/the_conversation-feed` | The Conversation | **CC BY-ND → `display_only`** | argumentative |

⚠️ `the_conversation` 은 ND 라 본문을 변형할 수 없어 **문항이 0개** 나온다.
수집은 되지만 교재에는 못 실린다 — 자세한 것은 [LIBRARY_PIPELINE.md](./LIBRARY_PIPELINE.md).

**운영 (6)**

| 경로 | 비고 |
|---|---|
| `POST …/seed` · `GET …/seed-list` | seed_catalog 적재·조회 |
| `POST …/bulk-requeue` | 선택분 큐 재투입 |
| `POST …/force-publish` | 검수 건너뛰고 발행 |
| `POST …/revert` | 발행 되돌리기 |
| `POST …/delete` | 삭제 (+ seed unlock) |

---

## Layout 파일 (11)

| 파일 | scope |
|---|---|
| `app/layout.tsx` | Root — fonts + Toast Provider |
| `app/(auth)/layout.tsx` | 헤더 없음 |
| `app/(marketing)/layout.tsx` | 랜딩 |
| `app/(main)/layout.tsx` | Sidebar + FlowNav + SessionFrame 자동 주입 |
| `app/(main)/dashboard/layout.tsx` | metadata server layout (page.tsx 가 'use client') |
| `app/(main)/library/layout.tsx` | LibraryTabs (3탭 — 도서/스크립트/공용 단어장) + max-w-wide. 만화는 최상위 `/comics` 로 분리(2026-08-09) |
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
