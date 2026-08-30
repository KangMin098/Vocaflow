# Admin Console

> 플랫폼 운영 영역 — `/admin/*`. 사용자 앱과 라우트/레이아웃/시각 컨텍스트 모두 분리.
> 작성 시점: 2026-06-08 (v06.34).

---

## 시각 컨텍스트 분리

| 요소 | 사용자 앱 | Admin Console |
|---|---|---|
| 액센트 | `var(--p)` `#3B82F6` | **#8B5CF6 → #6D28D9** (보라 그라디언트) |
| 로고 아이콘 | `V` (Plus Jakarta) | `ShieldCheck` |
| Sidebar 헤더 | "Vocaflow" | "Vocaflow" + **"Admin"** mono 배지 |
| 알림 박스 | Streak | **"관리자 모드 · 시스템 데이터 접근 중"** |
| Sidebar 하단 | 사용자 프로필 → /settings | **"사용자 앱으로 ← /hub"** |

---

## 라우트 구조 (route group 미사용)

평문 `/admin/*` 사용 — URL 명시성 + 단일 layout scope.

### AdminSidebar 그룹

```
[ 단독 ]    대시보드 (LayoutDashboard)
[ 사용자 & 콘텐츠 ] (accent: #8B5CF6)
   사용자
   콘텐츠
   LCP Pipeline
   ACP Pipeline
   단어장 마스터
   VCB Pipeline
   VRL Pipeline
   VRL Automation
   Comic Pipeline
   PD Comic Pipeline
   Pending Words
   = 총 11 항목
[ 운영 ]     (accent: var(--info))
   플랫폼 분석
   품질 지표 (Gauge, v06.140)
   품질 게이트 (ShieldCheck, v06.271 — 파이프라인 정확성 불변식)
   추출 판정 (Scale, v06.270 — blind 판정 하네스)
   신고·문의 (실 데이터 뱃지)
   결제
[ 시스템 ]   (accent: var(--active))
   시스템 설정
```

### 신고 뱃지 (v06.28 · ⚠️ 무효)

`admin/layout.tsx` Server fetch `reports.status='open'` COUNT → AdminSidebar `reportsBadge` prop.
- 0건 자동 숨김
- ⚠️ **`reports` 테이블이 DB 에 없다** (2026-08-12 실측 — `PGRST205`). `fetchPendingReportsCount`
  의 `try/catch` 가 이를 삼키고 0 을 반환해 배지는 영구히 숨겨진다. 배지 부재 = "신고 0건" 이
  아니라 "집계할 테이블 없음".

---

## /admin — 대시보드 (v06.35 실측화)

`page.tsx` (RSC · `dynamic = 'force-dynamic'`) — `requireAdmin('/admin')` → `createAdminClient()`
(service_role, dev-bypass 에서도 조회 가능) → `lib/admin/dashboard-stats.ts`.

| 블록 | 출처 |
|---|---|
| KPI 4 (공개 콘텐츠 · 검수 대기 · 실패 · 오늘 학습자) | 카운트 합산 (`sum` — 하나라도 null 이면 null) |
| 파이프라인 8 큐 (LCP · ACP · 드레인 큐 · VCB · VRL · CCP · PDCP · Pending Words) | 상태별 `count: 'exact', head: true` |
| 운영·관리 10 링크 | 실측 수치 + DB 미연동 화면에 `목업` 태그 |
| 최근 파이프라인 변경 8건 | `library_books`·`library_articles`·`book_curation_jobs`·`pd_comic_issues`·`vocab_runs` 의 `updated_at` 병합 |

**`count ?? 0` 금지** — `head: true` 요청은 없는 테이블에도 `204 / error=null / count=null` 을
돌려준다 (404 는 non-head 에서만). 0 으로 채우면 미구현 화면이 "0건" 으로 보인다. `null` 은 화면에 `—`.

**목업 태그가 붙는 화면** (DB 를 전혀 읽지 않고 코드 상수를 렌더 — 2026-08-12 grep 실측):
`/admin/users` · `/admin/library` · `/admin/analytics` · `/admin/reports` · `/admin/billing` · `/admin/settings`

회귀: `src/app/admin/__tests__/page.test.tsx` (renderToString · 5) +
`src/lib/admin/__tests__/dashboard-stats.integration.test.ts` (실 DB · 6).

---

## /admin/curation — LCP

### 8탭

| 탭 | 컴포넌트 | 기능 |
|---|---|---|
| Sources | `SourceCatalogTab.tsx` | 9 외부 소스 카탈로그 (composite_score) |
| BulkFetch | `BulkFetchTab.tsx` | 일괄 fetch + "Dev 일괄 처리" 버튼 (v06.34) |
| Seed | `SeedTab.tsx` | gutenberg/SE 시드 카드 |
| Gutenberg ID | `GutenbergIdTab.tsx` | ID 입력 → preview-gutenberg |
| Wikibooks ID | `WikibooksIdTab.tsx` | preview-wikibooks |
| Wikisource ID | `WikisourceIdTab.tsx` | preview-wikisource |
| OpenStax ID | `OpenStaxIdTab.tsx` | preview-openstax |
| My Library | `MyLibraryTab.tsx` | Curated Books 테이블 |

### Curated Books — 테이블 + 일괄 액션 (v06.34)

13 컬럼: 제목 · 저자 · 소스 · 상태 · CEFR · V·Cent · CEFR-J · F-K · 추출 · 단어장 · 단어 · 갱신 · 상세.

**"추출" 셀 = 해석률 (v06.35 재정의)** — 이전에는 `lemma_coverage_pct`(shared_dictionary 결합률)를 그대로 보여줘, 결합돼선 안 되는 고어·외국어 원문 인용·인명/지명이 전부 "추출 실패"로 표시됐다(Les Misérables 89.5% → 실제 98.7%). 지금 배지 숫자는 `resolved_pct`(결합 + 고어/방언/외국어 해석 + 인명·지명 제외), 옆 `·N↑` 은 **어떤 자산으로도 해석 안 된 진짜 공백**(`unresolved_count`). 툴팁에 사전 결합률·타사전 해석 수·노이즈 제외 수를 함께 노출. 상태: `unresolved=0` → `✓ 완료`(success) · 해석률 ≥99% → info · 미만 → warning.

#### 필터
- 소스 필터 (composite_score 기반 9 카탈로그)
- 레벨 필터 (V-Level 0-11)
- 상태 필터 (전체 / 처리 중 / 검토 대기 / 게시됨 / 실패 / 보관됨)
- 제목/저자 검색

#### 일괄 액션 (체크박스 + Toolbar)

| 버튼 | RPC / 엔드포인트 | 효과 |
|---|---|---|
| **Dev 일괄 처리** | `/api/lcp/dev-process` (순차) | 처리중+검토대기 선택분을 로직 파이프라인으로 dev 처리 — 수집·정규화·분절·분석·추출·V-Level·**LibriVox 자동매핑**까지. 배너에 `🔊 매핑 N · ⏳ 매핑큐 M` 집계 |
| **스크립트 퀴즈 큐** (v06.114) | `enqueue_quiz_jobs(uuid[])` | ready/published+챕터 존재 선택분을 `book_curation_jobs`(`task_type='quiz_gen'` — v06.x 매핑 큐와 통합, 구 `book_quiz_jobs` DROP)로 적재. 챕터별 스토리 퀴즈(문항 수 = `quiz_target_per_chapter(book_v_level)` 곡선 3~10) 생성 큐. 실 생성=Claude Code 드레인(`scripts/lcp/generate-chapter-quiz.mjs`) → `QuizJobsBanner` 진행률(chapters_done/total·문항수) |
| **레벨 검토 큐** (v06.x Phase 1) | `enqueue_review_jobs(uuid[],'level_verify')` | ready/published 선택분을 `book_curation_jobs`(`task_type='level_verify'`)로 적재. Claude Code 드레인(`scripts/lcp/review-book.mjs`)이 본문을 읽어 CEFR/V-Level 재판정 → `result` verdict 기록 + 승인 시(`--correct`) `library_books` 교정. 저신뢰 CEFR(<0.85) 도서 품질 검토용 |
| **어휘 감사 큐** (v06.x Phase 1) | `enqueue_review_jobs(uuid[],'vocab_audit')` | **published**(발행 단어장 존재) 선택분을 `task_type='vocab_audit'`로 적재. Claude Code 드레인(`scripts/lcp/audit-vocab.mjs`)이 발행 단어장의 뜻·품사·레벨·register 를 문맥 근거로 점검 → `result.flagged[]` 기록. 실 교정은 `dict-*` 스크립트로 별도(감사=식별) |
| **소스로 되돌리기 (삭제)** | `admin_bulk_requeue_books(uuid[])` | 처리중 ∪ 검토대기 선택분 → library_books DELETE → BulkFetchTab 복귀. (구 `처리중→소스GET`+`검토대기→소스GET` 2버튼이 동일 RPC 라 1버튼으로 통합) |

> 드레인 큐 통합 (v06.x): 생성/매핑(quiz_gen·voice_map) + 검토(level_verify·vocab_audit) 를 `book_curation_jobs` 단일 큐 + `DrainQueueBanner` 단일 배너(🔊 매핑 / 📝 퀴즈 / 🔬 검토)로. 드레인 오케스트레이터 `scripts/lcp/drain.mjs`: `list`(미완 잡 대시보드) · `next [book_id]`(책별 task 실행 런북 — 4 helper 로 라우팅). 4 task 모두 Claude Code(LLM) 판단 필요라 자동 실행 X, "무엇을·어떻게" 단일 진입점.
> 통합 정리 (v06.x): 구 `검토대기 → 처리중`(draft 삭제 reclassify) 버튼은 제거 — 재처리(Dev 일괄 처리)로 대체. RPC `admin_bulk_set_books_curating` 자체는 DB 에 잔존.

**LibriVox 매핑 자동화 (v06.35)**: 이전의 수동 "매핑 큐 등록(Claude)" 버튼은 제거. `dev-process` 가 분석 직후 `autoMapLibriVoxForBook` 를 호출해 **count-gate 통과 시 즉시 `librivox_audio` 저장**. 정합 실패본만 `book_curation_jobs` 큐에 자동 등록(Claude Code 수동 정합 대상) → 리스트 행에 `JobQueueBadge` 노출. 성공/녹음없음은 큐 잡 자동 삭제.

안전 가드 (자동 스킵):
- `is_published=true` 단어장 존재 (학습자 노출)
- `texts.library_book_id` 참조 (사용자 진도)

#### 도서 처리 엔진 (통합, v06.x)

큐 전체 처리와 선택분 처리가 **단일 엔진**(`runProcess`) + **단일 진행 배너**로 통합:
- **큐 처리** — `status='queued'` 도서 ≥1 일 때 노출. **헤더 `▶ 큐 처리 (dev · N권)` 노란 배지** + "작업 순서" 가이드 콜아웃 두 곳(동일 동작). 큐 도서 전량을 순차 처리.
- **선택분 처리** — 체크박스 선택 후 Toolbar 의 `Dev 일괄 처리` (처리중 ∪ 검토대기 ∪ 실패).
- 둘 다 `/api/lcp/dev-process` 를 도서별 순차 호출 (유한 목록 → 무한 루프 불가). 진행 배너: 성공/실패/남음/경과 + `🔊 매핑 · ⏳ 매핑큐` 집계 + `중지`/`계속`. **완료 시 `검토 대기 보기 →` 액션**(목록을 처리 결과로 필터해 검수로 연결).
- **`⟳ 새로고침`** (헤더) — 상단 통계 + 목록(RSC) + 매핑/퀴즈 큐 배너 일괄 갱신 (소스 GET·큐레이션·Claude Code 드레인 후 out-of-band 변경 반영).
- (구: `dev-drain-queue` 5권/라운드 루프 → 단일 엔진으로 대체. 라우트는 잔존하나 UI 미사용.)

#### 도서 상태 흐름 표시

`StatusPill` (5 tone): success(게시됨) / warning(검토대기) / info(처리중) / danger(실패) / neutral(보관됨)

`ExtractionCell` (4-state):
- extracted=0 → "—"
- coverage=100% + unbound=0 → "✓ 완료"
- coverage≥95% → "{n}% · {unbound}↑" info
- coverage<95% → "{n}% · {unbound}↑" warning

### /admin/curation/preview/[bookId]

`AdminReviewClient.tsx` — 도서 본문 검수 + 챕터 nav + LibriVox 매핑 패널 + 챕터 단어장 검수 + 추출 패널 + **챕터 퀴즈 검수**.

#### LibriVoxAudioPanel (v06.34)

`chapter_parts` + `flat` 두 모드 모두 connected 인식. legacy `mode === null + aligned === true` 도 flat 으로 자동 격상.

`POST /api/admin/library/save-librivox-audio`:
- `build_chapter_map: true` — Roman 파서 시도
- 실패 시 단권 + section_count match → 자동 `flat` 폴백
- 응답: `fallback: 'flat_from_chapter_parts'`

#### ChapterWordSetsAdminSection (v06.32)

Client 전환. 표 행 `role="button"` + Enter/Space 키보드 + `ChapterWordSetPreviewModal` (admin 전용 — 구독 CTA 없음, 단어 전수 fetch + sort_order DESC + 발음 듣기 + 추출 메타 JSONB).

#### ChapterQuizAdminSection (v06.117)

챕터별 퀴즈(`library_chapter_quiz`) 검수. 서버 `fetchBookChapterQuizzes`(authed admin 직접 read — 발행 상태 무관, 미발행 검수 가능) → 챕터별 문항수 표 + 커버리지/저문항(<3) 경고 + 생성 잡 배지(`book_quiz_jobs` done/running/failed·chapters_done/total). 행 클릭 → `ChapterQuizPreviewModal` (문항 EN+KO·4지선다 **정답 초록+아이콘**·본문 근거 snippet Lora italic — 검수용 정답·근거 노출, 학습자 플레이는 숨김). 데이터는 서버 pre-fetch → props(모달 client fetch 없음, RLS 안전).

#### BookExtractionPanel

`extract_vocabulary_for_user_v2(uuid, text[], text='auto')` 테스트 UI.
- composite scoring preview (P70/75/80)
- meta cells (적용/글/본인/gap/N)

---

## /admin/articles — ACP 큐레이션 콘솔

**`CurationConsole` (v06.87)** — 소스별 탭 → **4단계 파이프라인 + SourcePolicy 분기 단일 화면**. VOA/The Conversation 등 소스 차이는 정책 4축(supply/media/derivation/attribution)으로만 분기 — `if(source==='voa')` 하드코딩 금지(`useSourcePolicy`/`resolveSourcePolicy` 단일 출처).

| 단계 | 컴포넌트 | 내용 |
|---|---|---|
| ① 커버리지 | `CoverageMatrix` + `SourceFeedList` | register×CEFR 발행 gap(빗금)/filled · 소스/feed별 후보 현황(`listSourceFeedHealth`) |
| ② 소스 GET | `CandidateTable` (+ `BulkArticlesTab` 대량) | seed-list 6컬럼 + score 막대 + audio(policy.media) + 다중선택 → `/api/acp/enqueue` · 라이브 RSS(`VoaFeedTab`/`RssFeedTab`) 보조 |
| ③ 검수 | `ReviewPanel` (3패널) | 큐 상태 dot / 에디터·player / `computeGateItems(policy)` 동적 게이트 + 발행 |
| ④ 발행 | `CuratedArticlesTab` | published 목록 관리(보관/되돌리기/삭제) |

`PolicyBar` — 소스 선택 시 정책 4축 라이브 렌더. SourcePolicy 정의는 `@vocaflow/library-pipeline/curation-spec`(C2 공유 자산 · drift-lock vitest 18). 피드: `/api/admin/articles/{nasa|nih|voa|wikinews|the_conversation|simple_wikipedia}-feed`(arxiv 제거 v06.69) → seed_catalog/큐 → `/api/acp/dev-process`.

**딥 검수 (v06.51 · 본문·단어 편집 — ReviewPanel "딥 검수" 링크로 재사용)** — `/admin/articles/preview/[id]` (LCP 책 검수 4패널 1:1 미러):

| 패널 | 글 버전 | 책 대응 |
|---|---|---|
| 본문 리더 + 게시 게이트 | 단일 섹션 리더 + 상단바(상태/신뢰도/게시) + 푸터(지금 처리·재분석/재처리/보관) | AdminReviewClient |
| 보이스 연결 | `audio_url` 검증/미리듣기/연결·해제 (`/api/acp/set-audio`) | LibriVoxAudioPanel |
| 학습 단어 추출 | meta cells + LV 랭킹 테이블 + RegisterBadge | BookExtractionPanel |
| 검수 팝업 | 단어 전수 + 뜻 + 발음 + 첫 문장 모달 | ChapterWordSetPreviewModal |

액션 RPC: 게시 `admin_force_publish_article`(copyright_safe 강제 + media='audio' 소스 audio 게이트) / 보관 `admin_archive_article` / 재처리 `admin_requeue_article` / 처리 `dev-process`. vocab 은 service-role 로 로드(테이블 admin RLS 없음).

---

## /admin/vocab/* — VCB

| 경로 | 내용 |
|---|---|
| `/admin/vocab` | VCB 메인 |
| `/admin/vocab/studio` | **단어장 Studio** — 유형 30종(시중 26 + 고유 4) 조립 · 7지표 채점 · 발행. 채점 통과선 0.80 미달이면 발행 버튼이 잠긴다 |
| `/admin/vocab/runs` | runs 목록 |
| `/admin/vocab/runs/new` | 신규 run |
| `/admin/vocab/runs/[id]` | run 상세 |
| `/admin/vocab/runs/[id]/seed` | seed 입력 |
| `/admin/vocab/runs/[id]/seed/preview` | seed 검증 |
| `/admin/vocab/sources` | sources 목록 |
| `/admin/vocab/sources/new` | 신규 source |
| `/admin/vocab/curate/[run_id]` | curate hub |
| `/admin/vocabulary` | (legacy stub) |

컴포넌트 (`components/admin/vcb/`):
- 8 step 워크플로우
- `VcbSeedFlow.tsx` / `VcbStep4LookupCard.tsx` 등
- `studio/StudioClient.tsx` + `studio/ScorecardPanel.tsx` — Studio (blueprint 갤러리 · 채점 결과 · 목차 미리보기)

Studio 는 보강(LLM)을 거치지 않고 **이미 있는 사전·코퍼스 데이터를 조합**한다. 사전에 없는 단어를
새로 채워야 하면 Runs(8-step)로 간다. 발행은 서버가 같은 레시피로 다시 조립해서 하므로
화면이 들고 있던 결과가 그대로 쓰이지 않는다(사이에 사전이 바뀌면 결과도 바뀐다).
CLI 동등물: `pnpm vcb:compose --blueprint <id> [--commit]` · 평가: `pnpm vcb:compose-eval`

---

## /admin/vrl/* — VRL (v06.28 신설)

| 경로 | 상태 | 책임 |
|---|---|---|
| `/admin/vrl` | ★ 실 구현 | Dashboard — KPI 4 (의심/진단/사용자/snapshot) + V-Level 12 진행 |
| `/admin/vrl/taxonomy` | ★ 실 구현 | 4 tab (Levels/Tracks/Domains/Skills) read-only |
| `/admin/vrl/automation` | ★ 실 구현 (v06.34) | pg_cron + V-Level 분포 + 진단 활용도 + track 분포 |
| `/admin/vrl/concerns` | stub | `vrl_data_integrity_concerns` cleanup |
| `/admin/vrl/diagnostic` | stub | 진단 시드/문제 편집 |
| `/admin/vrl/users` | stub | `user_profiles.current_v_level` 분포 |
| `/admin/vrl/snapshots` | stub | `user_level_snapshots` audit chain |

### 데이터 쿼리

`apps/web/src/lib/admin/vrl/queries.ts`:
- `fetchVrlDashboard` — revalidate 60s
- `fetchVrlTaxonomy` — revalidate 300s

### Phase 2J Automation 대시보드

5 admin RPC:
- `cron_jobs` 
- `cron_runs` (최근 10)
- `snapshot_counts` (by reason/scope)
- `v_level_distribution`
- `diagnostic_use`

Phase 2K Polish:
- middleware `/admin/*` RBAC guard (`user_profiles.role` check + redirect)
- cron alert (`pg_notify 'vrl_cron_alert'` when failed>0)
- track distribution RPC + dashboard 섹션 (3 track × L1-L10 bar)

---

## /admin/comic — CCP (Comic Curation Pipeline · 신설)

도서 → 만화 큐레이션·생성·QC·발행. AdminSidebar 사용자&콘텐츠 그룹 등재(`BookImage`).

| 탭 | 기능 |
|---|---|
| **Catalog** | 만화화 대상 도서(ready/published) + 만화 상태(없음/초안/발행)·컷수·큐 상태. 체크박스 → **만화 생성 큐**(`enqueue_comic_jobs`) |
| **Published** | 생성된 만화(초안/발행) 관리 — QC 게이트(`panels_pass`) 통과분만 **발행**(`admin_set_comic_published`) · 회수 |

- KPI 4: 대상 도서 / 초안 / 발행됨 / 큐 대기.
- 데이터: `listComicCatalog`(library_books + comic_books 헤더 + comic_gen 잡 병합). 마이그레이션 미적용 시 빈 목록 안내로 degrade.
- 생성 드레인: Claude Code `scripts/lcp/generate-comic.mjs` (drain.mjs 🎞 등록). QC 판정(`qc_verdict`: verbatim_mismatch·rule_violations)은 헤더에 지속 저장(job.result는 재적재 시 소실 → 런 로그 전용).
- 발행 강제 게이트: `admin_set_comic_published` 가 `panels_pass=true` + 컷 존재 검증 후에만 published.

상세 설계: `scripts/comic/docs/COMIC_PIPELINE_DESIGN.md`.

---

## /admin (대시보드)

```
┌──────────────────────────────────────────┐
│ [ShieldCheck]  Admin Console             │
│                대시보드                    │
├──────────────────────────────────────────┤
│ KPI ×4 — 총 사용자 / 활성 / 콘텐츠 / 신고  │
├──────────────────────────────────────────┤
│ 관리 섹션 ×7 — 카드 그리드 (3열)          │
├──────────────────────────────────────────┤
│ 최근 활동 — 타임라인 (실시간 마커)         │
└──────────────────────────────────────────┘
```

KPI 카드는 §13 StatCard 와 다른 디자인 — delta 변화율 (`▲ 12%`) 강조 + 작은 아이콘 박스. 모듈별 색상 액센트로 빠른 스캔.

---

## /admin/pending-words (v06.34 신규)

미바인딩 단어 검수 — Phase 3B 부산물.

- Server Component
- KPI 4
- 200 row read-only
- AdminSidebar 등재

---

## /admin/textbook — TBP (교재)

**조작 버튼이 없는 관측 화면.** 생성·적재·조판은 전부 Claude Code 드레인이다(웹 요청 시간 안에
안 끝나고, 규칙이 바뀌면 이미 넣은 것까지 다시 재야 한다). 절차는 화면도움말에 있다.

- Server Component + `force-dynamic` · 집계는 `lib/textbook/console-stats.ts`
- KPI 5 — 저장 문항 · 사다리 계단 · **조판된 권** · 평가 우위 · 학습자 관측
- 블록 5 — 유형별 문항(정답 번호 χ²) · **브랜드 규격** · **조판된 권** · 학령 사다리 7단 · 시중 대비 평가 요소
- AdminSidebar 등재 (`사용자 & 콘텐츠` → `TBP Pipeline`)

### 브랜드 규격 · 조판된 권 (2026-08-30 신설)

브랜딩이 코드에만 있고 조판 결과가 로컬 HTML 파일에만 있어 **화면이 아무것도 못 말하던 것**을 메꾼다.

| 블록 | 출처 | 말하는 것 |
|---|---|---|
| 브랜드 규격 | `brandSpecRows()` · `VOLUME_FONTS` (순수 함수) | 조판 팔레트 6색 × 라이트/다크 + 서체 3. 값은 `@vocaflow/design-tokens` 에서 읽는다 |
| 조판된 권 | `textbook_volume_renders` | 권별 단원·문항·자동 검수·해설 없음·겹치지 않는 권수·**규격 최신 여부**·마지막 조판 |

- 색 칸에는 hex 를 **글자로 함께** 적는다 (색상만으로 정보 전달 금지).
- 규격 지문이 다르면 그 권은 `⚠️ 옛 규격 — 재조판`. 실패가 아니라 재조판 대상이라는 뜻.
- **빈 표와 못 읽은 표를 구별한다** — 조회가 깨지면 표 대신 이유를 말한다(관리자가 할 일이 갈린다).

---

## /admin/quality (v06.140 신규 — 품질평가 Q3)

`quality_metrics` (nightly pg_cron jobid=12, KST 03:10 `collect_quality_metrics`) 읽기 전용 대시보드.

- Server Component 단일 파일 (`admin/quality/page.tsx`), 마이그레이션 0
- 파이프라인 단계(ingest→analyze→extract→publish→deliver)별 지표 카드 — 최신값 + 전회 대비 + 스파크라인(SVG) + dims 상세
- 도서 지표는 `dims.status`(published/ready) 세그먼트 분리
- RLS read=admin — dev-bypass 브라우징은 빈 상태(정상). 데이터 분기는 `__tests__/page.test.tsx` renderToString 픽스처로 검증
- "지금 수집" 버튼 (`CollectNowButton.tsx`, v06.142) — `admin_collect_quality_metrics()` wrapper RPC(role='admin' 검사 후 `collect_quality_metrics()` 위임) 호출 → `router.refresh()`. dev-bypass(anon)에선 'admin only' 거부 → 오류 상태 노출(정상)

## /admin/quality/judge (v06.270 — 추출 품질 판정 하네스 Q3/Q5)

추출 결과의 "탁월함"(cap 40 안에 최고 가치가 들어갔는가)을 인간 blind 판정으로 축적하는 골든 라벨 하네스. 근거: `docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`.

- 표본 = in-cap 상위 8 + out-of-cap 경계 8(sort_order 41–48), **서버에서 셔플·출처 은닉** (`get_judgment_sample` DEFINER, in_cap/sort_order/composite 미반환)
- **blind 보존**: 판정 중 시스템 선택을 알 수 없음. `save_extraction_judgment`(DEFINER)이 저장 시점 `select_*_vocab` 재조회로 스냅샷(in_cap·sort_order·composite·v_level) 서버-권위 기록 → 확증편향 차단, 이후 가중 변경 회귀 대조
- 모드 2종: **절대 판정**(가치 있음/애매/제외) + **쌍대 비교**(A vs B). 제출 후 reveal — precision(내 선택 ∩ in-cap)·recall + 단어별 나 vs 시스템 대조
- `extraction_judgments` 테이블(RLS `ej_admin_all` = is_admin_or_curator) · RPC 2종 anon REVOKE + authenticated GRANT
- Calm UI: 붉은 압박 없이 초록(가치)/앰버(애매) + 아이콘. 회차당 1챕터 ~16단어 5분

---

## 화면도움말 (v06.34 신설 — 전 화면·전 탭)

관리자가 파이프라인 화면에서 "여기서 뭘 하는 곳이고 다음에 뭘 눌러야 하는지"를 즉시 판단하게 하는 인라인 도움말. **모든 Admin 화면·탭에 존재** (37 화면 + 34 탭 = **도움말 71개**, 2026-08-10 실측).

| 항목 | 위치 |
|---|---|
| 스키마 | `apps/web/src/lib/admin/help/types.ts` — `ScreenHelp {summary · when · steps · fields · cautions · drain · seeAlso}` |
| 데이터 | `apps/web/src/lib/admin/help/<pipeline>.ts` — 8 파일 (articles · curation · comic · pd-comics · vocab · vrl · quality · ops) |
| 병합 | `apps/web/src/lib/admin/help/index.ts` → `HELP_REGISTRY` (키 = 라우트 슬러그) |
| 렌더 | `apps/web/src/components/admin/AdminScreenHelp.tsx` — 헤더 `화면 도움말` 버튼 → 인라인 펼침 (모달 아님 · 열어 둔 채 조작 가능 · 열림 상태 화면별 localStorage 기억) |

**탭 연동** — `<AdminScreenHelp screen="curation" tab={활성탭라벨} />`. 조회 키가 **화면에 보이는 라벨 문자열** 이라 탭 라벨만 바꾸면 도움말이 조용히 사라진다 (루트 CLAUDE.md §자동화 정책 3️⃣ 참조).

**Claude Code 드레인 절차 (7 곳)** — 화면만 봐서는 다음 행동을 알 수 없는 반자동 작업이라 `drain {what · prerequisites · procedure · verify · recovery}` 로 따로 렌더 (앰버 박스). **재실행 안전 여부 명시 필수**.

| 드레인 | 위치 |
|---|---|
| 도서 큐레이션 | `curation` → Curated Books 탭 (`drain.mjs list → next`) |
| 만화 컷 생성 | `comic-drain` (`generate-comic.mjs plan → content → gen-verified → insert --commit`) |
| PD 만화 큐 | `pd-comics` → 큐 · 드레인 탭 |
| PD 만화 현대화 | `pd-comics` → 테스트 · 모니터 탭 (Claude Code 오퍼레이터 루프) |
| VCB 보강 | `vocab-run-detail` (`/vcb-batch-enrich`) |
| VCB 시드 | `vocab-run-seed` (`/vcb-seed-list`) |
| VCB 재보강 | `vocab-curate` (`/vcb-reenrich`) |

---

## 권한·보안 (Phase 2~3 예정)

- `middleware.ts` `/admin/*` RBAC guard — `user_profiles.role = 'admin'` 또는 `'curator'` 검증 (Phase 2K)
- 관리자 액션 별도 `audit_logs` 테이블 기록 (예정)
- 관리자 전용 로그인 분리 검토 (`/admin/login` — 2FA · Phase 3)

`is_admin_or_curator()` SECURITY DEFINER RPC 게이트 — 모든 admin_* RPC 의 첫 분기.

---

## 접근성 / UX 원칙

- 보라 액센트는 **색상 + 형태(ShieldCheck) + 텍스트("Admin")** 3중 표현
- "사용자 앱으로" 링크 항상 visible — 컨텍스트 전환 비용 최소화
- 신고 뱃지 색상 + 숫자 + `aria-label` 3중 (색맹 대응)
- 모든 stub 페이지 `components/dev/StubPage` 통일 — 일관된 검증 경험

---

## Server Action 인벤토리

### `/app/admin/curation/actions.ts`

| Action | 효과 |
|---|---|
| `deleteFailedBookAction(bookId)` | 실패 도서 영구 삭제 (admin_delete_book RPC) |
| `bulkSetBooksToInProgressAction(bookIds)` | ready → curating · draft 단어장 삭제 |
| `bulkRequeueBooksAction(bookIds)` | library_books DELETE · seed unlock (v06.34) |
| `fetchCurationJobsAction()` | 큐 상태 뷰 |

### `/app/(main)/text/actions.ts`

| Action | 효과 |
|---|---|
| `deleteUserTextAction(textId)` | 단일 텍스트 삭제 (그룹 chapter 거부) |
| `unenrollBookAction(bookId)` | 라이브러리 도서 unenroll RPC |
| `deleteUserBookGroupAction(groupId)` | v06.34 — 사용자 책 그룹 일괄 DELETE |
