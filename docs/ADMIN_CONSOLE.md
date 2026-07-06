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
   VRL Pipeline ⭐NEW
   = 총 7 항목
[ 운영 ]     (accent: var(--info))
   플랫폼 분석
   품질 지표 (Gauge, v06.140)
   신고·문의 (실 데이터 뱃지)
   결제
[ 시스템 ]   (accent: var(--active))
   시스템 설정
```

### 신고 뱃지 (v06.28)

`admin/layout.tsx` Server fetch `reports.status='open'` COUNT → AdminSidebar `reportsBadge` prop.
- 0건 자동 숨김
- 이전 mock `badge: 7` → DB 실측 연동 완료

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
| **소스로 되돌리기 (삭제)** | `admin_bulk_requeue_books(uuid[])` | 처리중 ∪ 검토대기 선택분 → library_books DELETE → BulkFetchTab 복귀. (구 `처리중→소스GET`+`검토대기→소스GET` 2버튼이 동일 RPC 라 1버튼으로 통합) |

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

## /admin/quality (v06.140 신규 — 품질평가 Q3)

`quality_metrics` (nightly pg_cron jobid=12, KST 03:10 `collect_quality_metrics`) 읽기 전용 대시보드.

- Server Component 단일 파일 (`admin/quality/page.tsx`), 마이그레이션 0
- 파이프라인 단계(ingest→analyze→extract→publish→deliver)별 지표 카드 — 최신값 + 전회 대비 + 스파크라인(SVG) + dims 상세
- 도서 지표는 `dims.status`(published/ready) 세그먼트 분리
- RLS read=admin — dev-bypass 브라우징은 빈 상태(정상). 데이터 분기는 `__tests__/page.test.tsx` renderToString 픽스처로 검증
- "지금 수집" 버튼 (`CollectNowButton.tsx`, v06.142) — `admin_collect_quality_metrics()` wrapper RPC(role='admin' 검사 후 `collect_quality_metrics()` 위임) 호출 → `router.refresh()`. dev-bypass(anon)에선 'admin only' 거부 → 오류 상태 노출(정상)

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
