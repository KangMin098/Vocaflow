# LCP Story S3 — 코드 경로 · 노출 우회 감사

> 작성 2026-10-25 · T-0169(LCP Story S3) 코드 소비자 · 노출 감사.
> 방법: **저장소 코드 읽기, DB 미조회.** 이 worktree(`feat/lcp-story-20261025`)와 `D:/workspace/Vocaflow-main-serving`(읽기 전용)의 파일을 읽었다.
> SQL 정의 인용은 모두 「저장소 마이그레이션 — live DB 는 별도 감사(S3_DB_AUDIT.md)」다. 실 DB 의 정의 · 정책 · 권한과 다를 수 있다.
> 정본 계약은 [../LCP_STORY.md](../LCP_STORY.md), 단계 지시는 [IMPLEMENTATION.md](./IMPLEMENTATION.md) S3 이다.

## 진행 상태

| 절 | 상태 |
|---|---|
| C. 승인형 배포 러너 · 격리 하네스 관행 | 작성됨 |
| A. 노출 · 우회 경로 목록 | 작성됨 |
| B. 저장 방식 결정(제안) | 작성됨 |

## A. 노출 · 우회 경로 목록

판정 열 「Story 가 legacy 행이면 새는가」는 **Story 판본(발행본)을 `library_books` 의 새 행으로 저장했다고 가정**했을 때다.
legacy 게이트는 모두 `status='published'`(+ `copyright_safe_in_kr`, + `published_at`)만 본다 — Story 의 검수 결속 · 본문 권리 confirmed · 자기 승인 금지 · 철회를 모른다.
그래서 판정은 두 갈래다: **(가) 상태를 `published` 로 바꾸는 경로**는 Story 게이트를 우회해 발행한다. **(나) `published` 를 읽는 경로**는 일단 published 가 되면 Story 의 추가 조건과 무관하게 노출한다.
`copyright_safe_in_kr` 는 권리 확인이 아니라 `license` 자유 문자열의 `ILIKE '%public domain%' | 'PD%' | 'CC%'` 판정이다(`supabase/migrations/20260605120000_copyright_gate_us_license.sql:19-36`, 저장소 마이그레이션 — live DB 는 별도 감사). Story 행이 원천 도서의 license 문자열을 복사하면 자동으로 true 가 된다 — Story 의 `rights_status=confirmed`(근거 · 확인자 · 시각)와 무관하다.

### A-1. 자동 발행 · 파이프라인

| 경로 | file:line | 진입 | 인증/게이트 | Story 가 legacy 행이면 새는가 |
|---|---|---|---|---|
| INSERT 자동 큐 | `supabase/migrations/20260508120300_lcp_v2_worker.sql:24-43`(`trg_lb_enqueue` AFTER INSERT, `NEW.status='queued'` 이면 `pgmq.send`) · 기본값 `status DEFAULT 'queued'`(`20260508120000_lcp_v2.sql:97-98`) | 트리거 | 없음(모든 INSERT) | **샌다(가)** — 상태를 지정하지 않고 넣은 Story 행이 그대로 파이프라인 큐에 들어간다 |
| 재큐 트리거 | `20260826102742_lcp_requeue_failed.sql:30-34`(`trg_lb_requeue` AFTER UPDATE OF status, `queued` 로 바뀌면 enqueue) | 트리거 | 없음 | **샌다(가)** — 누가 Story 행을 `queued` 로 바꾸면 파이프라인이 다시 돈다 |
| 워커 | `20260508120300_lcp_v2_worker.sql:96-137`(재정의 `20260908035616_lcp_worker_loud_when_blocked.sql:19`) · cron 30초 `:211-215` → `net.http_post(<vault url>/api/lcp/process)` | cron · RPC | `service_role` 만 EXECUTE(`:139-140`) | 큐에 들어간 Story 행을 처리 경로로 넘긴다 |
| `/api/lcp/process` | `apps/web/src/app/api/lcp/process/route.ts:36`(POST) · `:56-58`(`X-LCP-Token` = `LCP_INTERNAL_TOKEN`) · `:77`(service role 클라이언트) · `:101-103`(단계마다 `status` UPDATE) · `:228-236`(`rpc('auto_curate_book')`) | API(cron 호출) | 내부 토큰 + service role(RLS 우회) | **샌다(가)** — Story 행의 status 를 덮고, 소스가 gutenberg/SE 가 아니면 failed 로, 조건을 채우면 자동 published |
| `auto_curate_book` | `20260508120300_lcp_v2_worker.sql:145-200`(`cefr_confidence>=0.85 AND copyright_safe_in_kr AND chapter 1–100 AND word_count>=1000 AND lbv>=50` → `status='published', published_at=now()` · `>=0.60` → `ready`) · EXECUTE `service_role`(`:199-200`) · anon/PUBLIC 회수(`20260903121358…:33` · `20260903121759…:66`) | RPC(SECURITY DEFINER) | service role 만 | **샌다(가)** — Story 검수 · 권리와 무관한 자동 발행 |
| `/api/lcp/dev-process` | `apps/web/src/app/api/lcp/dev-process/route.ts:45-50`(production 차단) · `:53-60`(토큰 또는 `requireAdminApi`) · `:83`(service role) · `:143-150`(auto_curate 없이 `ready` 로 정지) | API(dev) | dev 전용 + 토큰/admin | 조건부 — published 로는 안 올리지만 Story 행을 `ready` 로 덮어 아래 `publish-ready-books` 대상이 된다 |
| `/api/lcp/dev-enqueue-book` | `apps/web/src/app/api/lcp/dev-enqueue-book/route.ts:29-36`(production 차단 + admin) · `:58`(service role) · `:64-87`(library_books INSERT) | API(dev) | dev + admin | 새 원본 행 생성 경로 — Story 와 같은 표를 쓰면 구분이 필요하다 |
| `scripts/lcp/publish-ready-books.mjs` | `:33-41`(`status='ready'` 전량 조회) · `:62-66`(copyright 확인) · `:68`(`content_gate_publishable('book', id)`) · `:85-90`(`update status='published'`) | script(`--commit`) | service role(`scripts/dict-common.mjs:30` · `:45` `makeClient`) | **샌다(가)** — `ready` 인 Story 행을 일괄 발행 |
| `scripts/lcp/reprocess-book.mjs` · `reprocess-all-se.mjs` · `reprocess-many.mjs` | `reprocess-book.mjs:128-134`(`status:'ready'`) · `reprocess-all-se.mjs:95-101` · `reprocess-many.mjs:86-89`(`ready`·`published` 대상) | script | service role | 조건부 — Story 행 상태를 `ready` 로 덮는다(→ 일괄 발행 대상) |
| `scripts/lcp/republish-books.mjs` | `:131`(`republish_book_word_sets`) | script | service role | 발행된 행의 단어장을 다시 만든다 — Story 행이면 Story 와 무관한 단어장 발행 |
| 발행 트리거(단어장) | `20260606123000_reattach_publish_book_word_sets_trigger.sql:22-25`(`trg_publish_book_word_sets_t`, 뒤에 `20260826102742…:41` 에서 DROP) · 남은 `trg_lb_publish_word_sets` 와 함수 `trg_publish_book_word_sets()` 는 **저장소 마이그레이션에 정의가 없다**(`20260908042344_pin_search_path_public_funcs.sql:72` 의 ALTER 만 있음) | 트리거 | 없음 | **샌다(가)** — published 전이마다 `publish_book_word_sets` 가 챕터 단어장을 공개 카탈로그로 발행. 정의는 live DB 에서만 확인 가능(S3_DB_AUDIT) |

### A-2. 관리자 강제 발행 · 상태 변경

| 경로 | file:line | 진입 | 인증/게이트 | Story 가 legacy 행이면 새는가 |
|---|---|---|---|---|
| `POST /api/admin/library/force-publish-book` | `apps/web/src/app/api/admin/library/force-publish-book/route.ts:26-28`(`requireAdminApi`) · `:48-50`(service role) · `:52-55`(RPC 를 부르지 않고 같은 논리를 직접 실행) · `:69-74`(`copyright_safe_in_kr` 만 확인) · `:79-82`(`update status='published', published_at`) | API | admin 3층의 API 층 + service role | **샌다(가)** — 검수 결속 · 권리 confirmed 확인 없음 |
| UI 호출처 | `apps/web/src/lib/library/admin-queries.ts:712-730`(`forcePublishBook` → 위 API) · `apps/web/src/app/admin/curation/preview/[bookId]/AdminReviewClient.tsx:105` · `apps/web/src/components/admin/curation/BookDetailModal.tsx:203` | 클라이언트 버튼 | 위와 같음 | 위와 같음 |
| RPC `admin_force_publish_book` | `20260508120600_lcp_v2_source_catalogs.sql:291-321`(`is_admin_or_curator()` + `copyright_safe_in_kr` → published) · EXECUTE `authenticated`(`:320-321`) | RPC(브라우저에서 직접 호출 가능) | admin/curator 역할 | **샌다(가)** |
| **RLS `admin_curator_all_books`** | `20260508120600_lcp_v2_source_catalogs.sql:192-196`(`FOR ALL USING/WITH CHECK is_admin_or_curator()`) | PostgREST 직접 UPDATE | admin/curator 의 사용자 JWT | **샌다(가)** — curator 가 RPC 없이 `update library_books set status='published'` 를 직접 보낼 수 있다. 어떤 RPC 게이트도 이 문을 닫지 못한다 |
| `admin_archive_book` | `…source_catalogs.sql:326-345` · 호출 `admin-queries.ts:781-792` ← `BookDetailModal.tsx:221` · `AdminReviewClient.tsx:151` | RPC | admin/curator | 철회에 쓰면 목록 · 상세는 닫히지만 본문은 남는다(A-5 `get_chapter_content` · `content_chunks`) |
| `admin_revert_published_book` | `20260527_120000_admin_revert_published_book.sql:17-61`(published → `ready`, 단어장 삭제) · 호출 `admin-queries.ts:739-755` ← `BookDetailModal.tsx:455` | RPC | admin/curator | `ready` 로 내리면 `publish-ready-books` 로 다시 발행될 수 있다 |
| `admin_delete_book` | `20260529_120000_admin_delete_book.sql:13-84`(`:45` ready/archived 만 · `:68` `update texts set library_book_id = NULL`) · 호출 `admin-queries.ts:761-779` ← `BookDetailModal.tsx:470` · `app/admin/curation/actions.ts:31-37` | RPC · server action(`requireAdmin`) | admin/curator | 학습 이력의 도서 연결을 끊는다 — Story 철회(「이력 보존」) 계약과 반대 |
| `admin_requeue_book` · `admin_bulk_requeue_books` · `admin_bulk_set_books_curating` | 정의 `20260826103132_admin_requeue_book_single_enqueue.sql:25` · `20260614220000_fix_bulk_requeue_seed_unlock.sql:14` · `20260607150000_admin_bulk_book_rollback_cascade.sql:37` / 호출 `admin-queries.ts:375` · `:440` · `:409` ← `BookDetailModal.tsx:194` · `AdminReviewClient.tsx:142` · `app/admin/curation/actions.ts:76-128` ← `MyLibraryTab.tsx:388` | RPC · server action | admin/curator | **샌다(가)** — Story 행을 원본 파이프라인으로 되돌린다(→ `/api/lcp/process` → auto_curate) |
| `admin_enqueue_book` | `…source_catalogs.sql:213-257` · 호출 `admin-queries.ts:345` · `scripts/lcp/seed-enqueue.ts:83` | RPC · script | admin/curator | (source, source_id) 로 기존 행을 찾는다 — 같은 원천의 Story 행과 충돌할 수 있다 |

### A-3. 카탈로그 · 목록 · 검색 · SEO · 계수

| 경로 | file:line | 진입 | 인증/게이트 | Story 가 legacy 행이면 새는가 |
|---|---|---|---|---|
| `/library/books` 그리드 | `apps/web/src/app/(main)/library/books/page.tsx:97-117`(`applyBookCatalogGate`) · `:128-133`(오디오 id, status 만) | page(공개 — `apps/web/src/lib/auth/protected-routes.ts` PUBLIC `'/library'`) | 사용자 세션 RLS + 게이트 | **샌다(나)** — published Story 행이 원본 도서처럼 진열 |
| 게이트 함수 | `apps/web/src/lib/library/publish-gate.ts:30-35`(카탈로그: status · copyright · published_at) · `:38-40`(열람: status 만) | 조회 편의 | 보안 아님(정본 §15) | 사용처: `library/books/page.tsx:99` · `lib/learner/hub-portal-query.ts:83` · `:171` · `app/(main)/comics/adapted/[bookId]/page.tsx:54` · `:76` — 이 다섯 곳뿐이다 |
| 추천 점수 | `apps/web/src/lib/library/recommend-books.ts`(순수 함수, 이미 받은 published 집합에 점수) ← `components/library/browse/BooksExplorer.tsx:60` · `components/wordvault/hub/RecommendedBooks.tsx:21` | 순수 함수 | 입력 집합에 의존 | **샌다(나)** — 같은 작품의 원본과 Story 행이 따로 추천된다 |
| 전역 검색 | `apps/web/src/lib/search/global.ts:64-75`(`status='published'` 만, copyright 없음) | server | 사용자 세션 RLS | **샌다(나)** |
| sitemap | `apps/web/src/app/sitemap.ts:22` · `:114-128` ← `apps/web/src/lib/seo/content-entries.ts:45-49`(anon 클라이언트) · `:78-87`(published + copyright) | 공개 메타 라우트 | anon RLS | **샌다(나)** — `/library/books/<id>` 를 검색엔진에 광고 |
| OG 이미지 | `apps/web/src/lib/seo/og-queries.ts:42-46`(도서: published + copyright) · `:66-74`(각색 만화: status 만) | 공개 | anon REST | **샌다(나)** |
| 학습자 홈 포털 | `apps/web/src/lib/learner/hub-portal-query.ts:82-90`(카탈로그 게이트, 12권) · `:171`(도서 수 계수) | server | 사용자 RLS | **샌다(나)** — 도서 수 계수에 Story 행이 더해진다(작품 수 ≠ 행 수) |
| 사정권 계수 | `apps/web/src/lib/learner/library-reach.ts:52-60`(status 만) | server | 사용자 RLS | **샌다(나)** — 계수 오염 |
| 플랜 자료 | `apps/web/src/lib/learner/plan-material-queries.ts:34-41`(카탈로그 조건) · `apps/web/src/lib/learner/plan-actions.ts:170-176` · `:353-358`(`in('id', …)` — RLS 의존) | server · server action | 사용자 RLS | **샌다(나)** |
| 받아쓰기 카탈로그 | `apps/web/src/lib/dictation/catalog.ts:84-89`(`in('id', …)`, RLS 의존) | server | 사용자 RLS | **샌다(나)** |
| Vault 허브 | `apps/web/src/lib/wordvault/hub-query.ts:493-498` · `:632-640` · `apps/web/src/components/wordvault/hooks/useHubStats.ts:262-267` | server · client | 사용자 RLS | **샌다(나)** |
| 단어장 Studio | `apps/web/src/lib/vcb/server/compose-studio.ts:86-92`(status 만) | server(admin) | 관리자 | Story 행이 원본 도서 목록에 섞인다 |
| 만화 카탈로그 RPC | `20260808240000_comic_catalog_p1.sql:42-91`(`list_comic_catalog`: `comic_books.status` + `library_books.status='published'` 조인, anon/authenticated EXECUTE) · `:99-119`(`preview_book_comic`) · `20260808140000_comic_pipeline_fixes.sql:12-26`(`select_book_comic_all`) | RPC(SECURITY DEFINER) | 이중 published 게이트 | 조건부 — Story 행에 만화가 만들어지면 노출 |
| 장 퀴즈 카탈로그 | `20260705100000_quiz_catalog_published_gate.sql:6-25`(published + copyright + published_at) | RPC | 게이트 있음 | **샌다(나)** |
| 랜딩 신뢰 수치 | `apps/web/src/lib/marketing/trust-signals.ts:36-41`(service role) · `:124`(`library_book_vocabularies` 전 행 계수 — 발행 여부 무관) | server(공개 랜딩) | service role | 계수만 오염(본문 아님) |
| 관리자 계수 | `apps/web/src/lib/admin/dashboard-stats.ts:454-457` · `apps/web/src/lib/admin/video-console.ts:269` · `apps/web/src/lib/csat/source-console.ts:120` | server(admin) | 관리자 | 원본 도서 수가 Story 행만큼 부풀려진다 |

### A-4. 직접 링크 · 상세 · 리더

| 경로 | file:line | 진입 | 인증/게이트 | Story 가 legacy 행이면 새는가 |
|---|---|---|---|---|
| 도서 상세 `/library/books/[bookId]` | `apps/web/src/app/(main)/library/books/[bookId]/page.tsx:31-39`(metadata: published + copyright) · `:58-71`(본문 조회: published + copyright, 없으면 404) · `:82-87`(등록자는 `/text/<id>` 로 redirect) · `:108-113`(`listChapters` + 1장 본문 `getChapterContent` — **비로그인 미리보기 포함**) | page(공개) | 사용자/anon RLS | **샌다(나)** — published 면 1장 본문까지 공개 |
| 리더 본문 조회 | `apps/web/src/lib/library/reader-queries.ts:185-227`(`listChapters` — `library_chapters_master` RLS `read_via_published`) · `:233-277`(`getChapterContent`: master → `content_chunks` by hash) ← `components/library/reader/BookContentReader.tsx:125-139` | client · server | 장 RLS(`20260508120000_lcp_v2.sql:195-201`) + `content_chunks` RLS | **샌다(나)** |
| 워크스페이스 `/text/[id]` | `apps/web/src/app/(main)/text/[id]/layout.tsx:89-95`(`v_text_content`) · `:104`(없으면 404) · `:107-124`(진입만으로 `markChapterStarted` · `activateChapterLearning`) · `:139-152`(도서 메타 · 형제 `texts`) | page(보호 — `protected-routes.ts` `'/text'`) | 본인 `texts` RLS + 뷰 `security_invoker`(`20260614150000_views_security_invoker.sql:20`) | **샌다(나)** — `texts.library_book_id` 하나로 판본을 구분하지 못하고, 진입이 곧 진도 · 어휘 활성화 |
| EchoMatch `/text/[id]/echo` | `apps/web/src/app/(main)/text/[id]/echo/page.tsx:46-50`(`texts`) · `:76-87`(master) · `:101-105`(**`content_chunks` 를 hash 로 직접 조회**) | page(보호) | 사용자 RLS | **샌다(나)** |
| 만화 리더 `/text/[id]/comic` | `apps/web/src/app/(main)/text/[id]/comic/page.tsx:87-91`(`select_book_comic_all` · `get_comic_format`) | page(보호) | RPC 게이트 | 조건부(만화가 있으면) |
| 각색 만화 상세 `/comics/adapted/[bookId]` | `apps/web/src/app/(main)/comics/adapted/[bookId]/page.tsx:54-57` · `:76-80`(`applyBookReadGate`) | page(공개) | 사용자/anon RLS | 조건부 |
| ScriptQuiz 장 퀴즈 | `select_book_chapter_quiz` 정의 `20260702120000_scriptquiz_curated_chapter_quiz.sql:122-151` — **도서 상태 게이트 없음**, `source_snippet`(본문 발췌) 반환, EXECUTE `authenticated` · 호출 `apps/web/src/lib/scriptquiz/questions.ts:80` · `grade-actions.ts:86` | RPC(SECURITY DEFINER) | 로그인만 | **샌다** — 미발행 · 철회 도서의 발췌도 id 만 알면 읽힌다(Story 행에 퀴즈가 생기면 같음) |
| 보조 어휘 | `20260810234335_list_book_support_vocab.sql:31` · `:73`(INVOKER — `library_book_vocabularies` RLS 의존, anon/authenticated) ← `components/library/books/BookSupportVocabPanel.tsx:42` | RPC | RLS | **샌다(나)** |

### A-5. 등록 · 진도 · 본문 저장(`content_chunks`)

| 경로 | file:line | 진입 | 인증/게이트 | Story 가 legacy 행이면 새는가 |
|---|---|---|---|---|
| `enroll_library_book` | 정의 `20260606120000_enroll_book_auto_subscribe_word_sets.sql:22-110`(`:40-46` published + copyright · `:49-53` CEFR 가드 · `:63-72` 이미 등록이면 기존 id · `:76-104` 장마다 `texts` 복제(`library_book_id` · `chapter_idx`, content NULL) · `:70` · `:107` 단어장 자동 구독) · 호출 `apps/web/src/lib/library/enroll.ts:12-28` ← `app/(main)/library/books/[bookId]/UserPreviewClient.tsx:80` · `components/comic/ComicFormatChoice.tsx:65` | RPC(SECURITY DEFINER) · client | 로그인 + published | **샌다(나)** — 그리고 진도 키가 `library_book_id` 하나라 판본 · 작품 구분이 없다 |
| 단어장 자동 구독 | `_enroll_book_subscribe_word_sets` (`20260628130000_p6_6_enroll_v0_undiagnosed_guard.sql:12` 최종 정의) · 클라이언트 EXECUTE 회수 `20260814024656_rpc_inherit_book_gate.sql:129-131` | 내부 함수 | — | Story 행에 단어장이 발행돼 있으면 `vocabularies` 에 들어간다(`ON CONFLICT (user_id, word)` — 단어 상태는 사용자 단위로 공유) |
| `unenroll_library_book` | `20260607120000_unenroll_library_book.sql:20`(`:47` texts DELETE · `:57` 구독 DELETE · `:67` vocab DELETE) · 호출 `enroll.ts:42-62` ← `components/library/LibraryGrid.tsx:102` · `components/library/browse/BooksExplorer.tsx:413` · `app/(main)/text/actions.ts:106` | RPC · client · server action | 본인 | 학습 이력 삭제 경로 — Story 철회와 섞이면 안 된다 |
| 장 완료 | `apps/web/src/lib/library/complete-chapter.ts:16-117`(`:32-37` 본인 `texts` · `:58-66` completed · `:83-88` 같은 `library_book_id` 형제 · `:107-109` 모두 completed 면 `bookCompleted`) | server action | 본인 | 판본 · 작품 · 원문 완독 구분 없음(정본 §12 위반 소지) |
| 진입 · 활성화 | `apps/web/src/lib/library/mark-progress.ts:12-23` · `apps/web/src/lib/library/activate-chapter.ts:89` → `personalize.ts:43-65`(`reading_sessions` · `v_text_content`) · `adaptive-extract.ts:61-221`(`library_book_vocabularies` → `vocabularies` upsert `onConflict user_id,word`) | server(레이아웃 진입) | 본인 | 진입만으로 기록 · 어휘가 생긴다 — Story 의 「열람은 숙달이 아니다」와 충돌 |
| 이어하기 | `apps/web/src/lib/library/resume-queries.ts:30-45`(`texts` by `library_book_id`) | server | 본인 | 판본별 키 없음 |
| 내 서재 | `apps/web/src/app/(main)/my/books/page.tsx:100-111`(`texts` + `library_books!inner`) · `apps/web/src/hooks/useTexts.ts:309-316` · 뷰 `v_user_book_progress`(`20260508120000_lcp_v2.sql:351-369`) ← `lib/scriptquiz/queue.ts:35` | page · client | 본인 + RLS | 판본이 각각 「책 한 권」으로 집계 |
| **`get_chapter_content`** | `20260508120100_lcp_v2_helpers.sql:50-76`(**`texts` 소유자만 확인, 도서 상태를 보지 않음** · SECURITY DEFINER 라 `v_text_content` 의 장 · 청크 RLS 를 정의자 권한으로 통과) · EXECUTE `authenticated` · 호출 `apps/web/src/lib/library/content-storage.ts:37-47` · `apps/web/src/lib/dictation/source.ts:234` · `apps/web/src/lib/dictation/daily.ts:175` | RPC | 로그인 + 본인 texts | **샌다** — 철회(archived · ready 강등) 뒤에도 등록자는 본문 전체를 계속 받는다(정본 §11 「철회 = 열람 차단」 위반) |
| **`content_chunks` RLS** | `20260508120000_lcp_v2.sql:37-54`(`authenticated_read_chunks FOR SELECT USING (auth.role()='authenticated')` — **행 조건 없음**) · `service_role_all_chunks` 는 `20260923104726_rls_initplan_and_dead_policies.sql:27` 에서 DROP | PostgREST 직접 | 로그인만 | **샌다** — 로그인 사용자는 hash 를 몰라도 `select hash, content from content_chunks` 로 미발행 · 보류 · 철회 본문까지 읽을 수 있다(저장소 기준. live 정책 · GRANT 는 S3_DB_AUDIT 가 확인) |
| `content_chunks` 직접 조회 | `apps/web/src/lib/library/content-storage.ts:53-65`(`existsContentHash`) · `reader-queries.ts:260-264` · `echo/page.tsx:101-105` · `apps/web/src/lib/library/librivox-automap.ts:147` · 스크립트 다수(`scripts/lcp/generate-chapter-quiz.mjs:90` · `review-book.mjs:70` · `generate-comic.mjs:77` · `scripts/audit/*.mts`) | client · server · script | 로그인 RLS · service role | 위와 같음 |
| `store_content_chunk` | `20260508120100_lcp_v2_helpers.sql:17-43`(sha256 dedup, `ON CONFLICT DO NOTHING`, EXECUTE `service_role`) · 호출 `content-storage.ts:15-30` · `packages/library-pipeline/src/analyze/content-store.ts:17` | RPC | service role | 본문이 같은 두 판본(또는 원문과 같은 Story 단위)은 **같은 청크 한 행**을 공유한다 — 철회 · GC(`ref_count=0`, `:53-54` 주석)가 다른 판본 · 원본에 번진다 |

### A-6. 관리자 소비자

| 경로 | file:line | 진입 | 인증/게이트 | 비고 |
|---|---|---|---|---|
| `/admin/curation` | `apps/web/src/app/admin/curation/page.tsx:39-40`(`listAllAdminBooks` · `getCurationStats`) → `admin-queries.ts:182-200`(상태 무관 전 행) | page | admin 3층 + RLS `admin_curator_all_books` | Story 행이 원본 도서 목록에 섞여 「재처리 · 큐 · 강제 게시」 버튼을 받는다 |
| 검수 미리보기 `/admin/curation/preview/[bookId]` | `apps/web/src/app/admin/curation/preview/[bookId]/page.tsx:35-42`(`requireAdmin` + 전 상태 조회) · `AdminReviewClient.tsx:105` · `:142` · `:151` | page | admin | 같은 화면에서 원본 게시 버튼이 Story 행에 그대로 적용된다 |
| 도움말 | `apps/web/src/lib/admin/help/curation.ts:52-55`(게시 = 트리거로 단어장 생성) · `:73`(copyright = license 문자열) · `:145-146`(되돌리기 = DELETE · 재처리 = 검토 대기 강등) | 도움말 | — | Story 라인을 넣으면 화면과 같은 커밋에 고쳐야 한다(AGENTS ②) |
| 관리자 학습자 화면 | 학습자 화면의 `in('id', …)` 조회는 관리자 세션이면 `admin_curator_all_books` 로 **미발행 행도 보인다** | — | — | 관리자 계정의 화면 확인이 학습자 노출과 다르다(시험 계정 분리 필요) |

### A-7. service role 사용처(RLS 우회) 요약

| 진입 | 파일 | 하는 일 |
|---|---|---|
| API(cron 토큰) | `app/api/lcp/process/route.ts:77` | 파이프라인 · `auto_curate_book` |
| API(admin) | `app/api/admin/library/force-publish-book/route.ts:48-50` | 직접 published UPDATE |
| API(admin · dev) | `app/api/lcp/dev-process/route.ts:83` · `dev-enqueue-book/route.ts:58` · `dev-validate/route.ts:78` · `app/api/admin/library/{backfill-covers,convert-to-se,delete-seed-catalog,enrich-seed-batch,fetch-seed-batch,save-librivox-audio}/route.ts` | 처리 · 생성 · 메타 갱신 |
| server(공개 랜딩) | `lib/marketing/trust-signals.ts:36-41` | 계수 |
| script | `scripts/lcp/*.mjs`(`publish-ready-books` · `republish-books` · `reprocess-*` · `generate-*` · `review-book`) · `scripts/audit/*` | 발행 · 재처리 · 본문 조회 |

그 밖의 학습자 · 관리자 화면은 사용자 세션 클라이언트(`lib/supabase/server.ts` · `client.ts`)로 RLS 를 받는다.

### A-8. 정리 — 상위 위험

1. **상태 하나로 발행되는 문이 다섯 개다**: `auto_curate_book`(자동) · force-publish API(service role) · `admin_force_publish_book` RPC · RLS `admin_curator_all_books` 의 직접 UPDATE · `publish-ready-books.mjs`. 어느 것도 Story 의 검수 결속 · 권리 confirmed 를 모른다.
2. **published 를 읽는 곳이 30곳 이상**이고 대부분 RLS(`anyone_read_published_safe`)나 `status` 필터 하나에 기댄다 — Story 전용 조건을 더하려면 이 모두를 고쳐야 한다.
3. **철회가 본문을 막지 못한다**: `get_chapter_content`(소유자만 확인) · `content_chunks`(로그인이면 전 행) · `select_book_chapter_quiz`(상태 무관).
4. **진도 키가 `library_book_id` 하나**다: `enroll_library_book` · `complete-chapter.ts` · `resume-queries.ts` · `v_user_book_progress` · `my/books` 모두 「행 = 책 한 권」으로 센다 — 판본별 진도 · 작품 단위 묶음 · 각색 완독 ≠ 원문 완독을 표현할 자리가 없다.
5. **`copyright_safe_in_kr` 는 license 문자열 판정**이라 Story 의 본문 권리(원문 · 번역 confirmed) 계약을 대신할 수 없다.

## B. 저장 방식 결정(제안) — Story 전용 격리 표

### B-1. 결정

**(2) 격리된 Story 전용 표(`story_*`) + 자체 RLS · RPC + 발행본 단위 진도 키**를 제안한다. (1) `library_books` 에 행을 더하는 방식은 택하지 않는다.
원천 도서와의 대응은 Story 표가 원본 도서 id 를 **값으로 기록**하는 한 방향뿐이고, 원본 쪽 표 · 함수 · 정책은 Story 를 모른다.

### B-2. 근거(A 의 증거)

| 관점 | (1) `library_books` 행 추가 | (2) `story_*` 격리 표 |
|---|---|---|
| 발행 우회 문(A-1 · A-2) | 다섯 문(`auto_curate_book` · force-publish API · `admin_force_publish_book` · RLS `admin_curator_all_books` 직접 UPDATE · `publish-ready-books.mjs`) + 상태를 덮는 재처리 · 재큐 · 트리거(`trg_lb_enqueue` · `trg_lb_requeue` · 단어장 발행 트리거)를 **전부** 고쳐야 한다. 하나라도 놓치면 검수 없는 발행이 된다. 특히 RLS 직접 UPDATE 는 RPC 게이트로 못 닫는다 | 이 경로들은 `library_books` 만 만진다 — Story 발행본에 닿을 문이 처음부터 없다. 고칠 legacy 파일 0 |
| 노출 경로(A-3 · A-4) | `status='published'` 를 읽는 30곳 이상(검색 · sitemap · OG · 홈 포털 · 플랜 · 받아쓰기 · Vault · 추천 · 계수 · 만화 · 퀴즈)에 「Story 행 제외 또는 Story 조건 추가」를 넣어야 한다. 빠뜨린 곳은 같은 작품을 원본 도서로 진열하거나 계수를 부풀린다 | Story 는 자기 RPC 로만 목록에 오른다. legacy 목록 · 계수는 바뀌지 않는다(정본 §1 「원본 라인은 바꾸지 않는다」 · S4 `LS-S4-AC5`) |
| 철회(정본 §11) | `get_chapter_content`(소유자만 확인) · `content_chunks`(로그인이면 전 행) · `select_book_chapter_quiz`(상태 무관) 때문에 archived 로 내려도 등록자 · 로그인 사용자가 본문을 계속 읽는다. 이 셋은 원본 도서에도 걸려 있어 고치면 원본 동작이 바뀐다 | 본문 표를 따로 두고 **읽기 RPC 가 호출 시점에 발행본 상태를 다시 본다** → 철회 즉시 본문 차단, 진도 행은 남긴다. `content_chunks` · `library_chapters_master` · `texts` 를 쓰지 않으므로 legacy 의 약한 문을 상속하지 않는다 |
| 진도(정본 §12) | `texts.library_book_id` 하나가 진도 · 완료 · 이어하기 · 서재의 키다(`enroll_library_book` · `complete-chapter.ts:83-109` · `resume-queries.ts:30-45` · `v_user_book_progress`). 판본마다 행을 만들면 같은 작품이 여러 권으로 세지고, 각색 완독이 `bookCompleted` 로 원문 완독과 같은 이름을 받는다. `texts` 는 학습자 본인이 직접 UPDATE 할 수 있다(`20251101000006_triggers_and_rls.sql:74-75` `own data FOR ALL`) | 진도 키 = 발행본(`release_id` / `release_key`), 묶음 키 = 작품(`work_id`). 완료 이름 · `counts_as_original_text_completion=false` 를 발행본 행이 가진다. 진도는 RPC 로만 쓰고 다른 발행본에서 승계하지 않는다(`progress_inheritance:'none'`) |
| 어휘 · 숙달 | 진입만으로 `activateChapterLearning` → `vocabularies` upsert(`adaptive-extract.ts:212-221`) · 등록 시 단어장 자동 구독 — 열람이 어휘 기록을 만든다 | Story 리더는 legacy 레이아웃을 쓰지 않으므로 열람 · 펼침이 `vocabularies` · FSRS 에 닿지 않는다(정본 §13). 어휘 연결은 S6 에서 발행본 본문 구간만 가리키게 따로 설계 |
| 권리 | `copyright_safe_in_kr` = license 문자열 ILIKE 판정(자동 true) | 권리 기록 표에 자산별 `confirmed` · 근거 · 확인자(`auth.uid()`) · 시각을 서버가 기록 |
| 원본 도서 삭제 | `admin_delete_book` 이 `texts.library_book_id` 를 끊는다(`20260529_120000_admin_delete_book.sql:68`), 장 · 어휘는 `ON DELETE CASCADE`(`20260508120000_lcp_v2.sql:173` · `:214`) | Story 원천 스냅숏은 원본 도서 id 를 **FK cascade 없이** 값으로 기록한다(삭제가 Story 이력에 번지지 않게). FK 를 `RESTRICT` 로 걸면 원본 도서 삭제 동작이 바뀌므로 그 선택은 별도 승인 사항 |

### B-3. 진도 · 철회 설계 원칙

- **발행본 단위 진도**: `(user_id, release_id)` 가 기본 키. 작품 단위 화면은 `work_id` 로 묶어 보여 줄 뿐 진도를 합치지 않는다. 판본 전환 · 장면 이동은 새 발행본의 진도를 0 에서 시작한다(승계 없음).
- **완료 이름**: 발행본이 `coverage`(`complete_work` · `episode` · `excerpt`)와 `completion_label`(`adapted_full_work` · `adapted_partial`)을 갖고, 진도 행은 그 발행본 기준으로만 완료된다. 「작품 수」는 `distinct work_id`. 원문 완독은 Story 표에 기록하지 않는다.
- **숙달 아님**: 진도 표에는 열람 · 위치 · 완료 시각만 둔다. 숙달 · FSRS · 점수 표에 쓰는 함수가 Story RPC 안에 없어야 한다(grep 로 증명 가능).
- **철회**: 발행본 상태 `published → withdrawn` 은 RPC 만 · 되돌릴 수 없는 이벤트로 기록(누가 · 언제 · 사유). 학습자 읽기 RPC 는 매 호출마다 `status='published'` 를 확인하고 아니면 본문을 주지 않는다. 진도 행은 지우지 않고, 학습자는 「철회된 판본」이라는 메타만 본다. 철회는 새 발행본을 만들지 않으며 같은 `release_key` 를 다시 발행하지 않는다(정본 §10 불변).
- **관리자 초안 분리**: 초안 · 보류 판본 · 검수는 admin/curator 만 읽는 표(학습자 GRANT 없음, RLS `is_admin_or_curator()`)에 두고, 학습자 읽기 RPC 는 발행본 본문 표만 본다.
- **로컬 주장 재기록**: 적재 RPC 는 로컬 파일의 권리 · 생산자 · 검수자 값을 「주장」 열로만 보관하고, 권한 판단에 쓰는 확인자 · 발행자 · 시각은 `auth.uid()` · `now()` 로 서버가 기록한다.

### B-4. 격리 증명 방법

1. **저장소 grep(코드 · SQL)** — 새 이름 접두사 `story_` 를 legacy 가 참조하지 않음. 기준선(2026-10-25, 이 worktree)은 두 범위 모두 **0건**이다:
   `git grep -nE '(^|[^a-z_])story_[a-z_]+' -- supabase/migrations ':!supabase/migrations/*lcp_story*'` → 0건 유지,
   `git grep -nE '(^|[^a-z_])story_[a-z_]+' -- apps/web/src ':!apps/web/src/lib/library/story/**' ':!apps/web/src/app/**/story*/**'` → 0건 유지(새 화면 · 서버 코드 위치만 허용).
   **전용 스키마 `story` 에 표를 두는 경우**(부모 세션의 `_pending_lcp_story_s3_schema.sql` 초안이 이 형태다 — 이 감사는 그 SQL 을 검토하지 않았다) 같은 증명을 스키마 이름으로 한다:
   `git grep -nE '(^|[^a-z_])story\.[a-z_]+' -- supabase/migrations ':!supabase/migrations/_pending_lcp_story_*'` → 기준선 0건 유지,
   `git grep -nE "schema\(['\"]story['\"]\)|['\"]story\.[a-z_]+['\"]" -- apps/web/src` → 기준선 0건(새 Story 서버 코드 위치만 허용).
   전용 스키마는 격리를 더 단단하게 한다: Supabase 의 표 기본 권한(`ALTER DEFAULT PRIVILEGES … IN SCHEMA public`)이 걸리지 않고,
   저장소 설정의 PostgREST 노출 스키마가 `["public", "graphql_public"]`(`supabase/config.toml:13`, 로컬 설정 — live API 설정은 별도 확인)라 `story` 표에 REST 직접 경로가 없다. 그래도 `has_schema_privilege('anon'|'authenticated', 'story', 'USAGE')=false` 를 verify 에 넣는다.
   반대로 Story SQL 이 legacy 객체를 쓰는 곳은 허용 목록으로 고정: `is_admin_or_curator()` · `auth.uid()` · (값 대조용) `library_books.id` 읽기뿐. `library_books` 에 대한 INSERT/UPDATE/DELETE · `content_chunks` · `texts` · `vocabularies` 참조 0건.
2. **DB 카탈로그(적용 뒤 verify SQL, 읽기 전용)** —
   - Story 표를 참조하는 legacy 함수 0: `pg_proc` 중 Story RPC 허용 목록 밖에서 `prosrc ~ 'story_'` 0건.
   - Story 표에 의존하는 뷰 · 트리거 0: `pg_depend`/`pg_rewrite` · `pg_trigger` 에서 Story 표가 legacy 객체의 의존 대상이 아님.
   - `library_books` 트리거 목록 · `anyone_read_published_safe` · `admin_curator_all_books` 정의가 적용 전후 동일(정책 식 · 트리거 정의 지문 비교 — factory-i1 `catalog.mjs` 의 카탈로그 diff 관행).
   - 권한: Story 표 전부 `relrowsecurity=true` · `has_table_privilege('anon'|'authenticated', t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')=false`(읽기 · 쓰기 모두 RPC 경유). ⚠️ 개발 DB 의 public 스키마 기본 ACL 은 새 표에 anon/authenticated ALL 을 준다(2026-10-17 실측 기록 `scripts/db/factory-i1/isolated-db.mjs:7` · `:67`) — `CREATE TABLE` 뒤 명시적 `REVOKE ALL … FROM anon, authenticated` 가 없으면 RLS 정책 하나 실수로 표 전체가 열린다.
   - 함수: SECURITY DEFINER 전부 `search_path` 에 `pg_temp` 포함 · PUBLIC/anon EXECUTE 없음 · 관리자 RPC 는 첫 문에서 `is_admin_or_curator()` 확인.
3. **격리 시험(PGlite)** — legacy 스텁(`library_books` 최소 사본 + `anyone_read_published_safe` · `admin_curator_all_books` 정책 + `auto_curate_book` 같은 상태 전이 함수 사본) 위에 Story SQL 을 올리고:
   legacy 경로로 상태를 바꿔도(직접 UPDATE · `auto_curate_book` 사본) Story 발행본이 생기지 않음 · `set role authenticated` 로 Story 표 직접 SELECT/INSERT 거절 · 철회 뒤 읽기 RPC 거절 + 진도 행 유지 · 다른 발행본 진도 승계 없음 · 자기 승인 · 낡은 검수 · 권리 미확정 발행 거절 · legacy 카탈로그 질의(`status='published' AND copyright_safe_in_kr`) 결과에 Story 가 0건.

### B-5. S3 SQL 이 필요한 최소 객체(이름 · 목적만 — SQL 은 부모 세션 소유)

이름은 `public.story_*` 접두사로 적었다. 전용 스키마를 쓰면 `story.<이름>`(표)과 `public.story_*`(RPC 진입점)로 읽으면 된다 — 목적 · 경계는 같다.

| 종류 | 이름(제안) | 목적 |
|---|---|---|
| 표 | `story_work` | 작품(`work_key` · 원작 언어). 큐레이터가 만든다 — 제목으로 합치지 않는다 |
| 표 | `story_source` | 원천 판본 스냅숏 메타: `source_identity_sha256` · `source_text_sha256` · 원본 `library_book_id`(값, cascade 없음) · revision · 본문 언어 · 번역자 표기 · 확보 시각. 원천 전문은 DB 에 두지 않거나 관리자 전용 |
| 표 | `story_rights_record` | 자산별(`source_text` · `translation` · `audio` · `illustration`) 권리 상태 · 근거 · 확인자(`auth.uid()`) · 시각 · 로컬 주장 값(참고) — 추가 전용 |
| 표 | `story_edition_draft` | 관리자 전용 초안 · 보류 저장: 편집 기준 · 판본 결과물 JSON · `policy_sha256` · `target_sha256` · `edition_sha256` · `activities_sha256` · 결속 · 상태(draft/hold/candidate) |
| 표 | `story_review` | 검수 결과(결속 해시 · 검수자 종류 · 출처 · 판정 · 시각). 추가 전용, stale 은 보존 |
| 표 | `story_release` | 불변 발행본: `release_key`(고유) · `work_id` · `edition_key` · 모든 결속 해시 · 검수 해시 목록 · `coverage` · `completion_label` · `counts_as_work_completion` · 상태(`published`/`withdrawn`) · 발행자 · 시각 |
| 표 | `story_release_event` | 발행 · 철회 이벤트(누가 · 언제 · 사유) — 추가 전용 |
| 표 | `story_release_unit` | 학습자가 읽는 본문(발행본 · 단위 순서 · 본문 · 원문 앵커 메타). 직접 GRANT 없음 — 읽기 RPC 만 |
| 표 | `story_reading_progress` | `(user_id, release_id)` 진도 · 마지막 단위 · 완료 시각. 철회 뒤에도 보존. 쓰기는 RPC 만 |
| RPC(관리자) | `story_admin_register_source` · `story_admin_record_rights` · `story_admin_save_draft` · `story_admin_record_review` | 서버가 해시를 다시 계산 · 확인하고 관리자 신원으로 기록 |
| RPC(관리자) | `story_admin_publish_release` · `story_admin_withdraw_release` | 발행 게이트(현재 결속 검수 · 자기 승인 아님 · 합성 아님 · 본문 권리 confirmed) · 철회. 동시 호출은 행 잠금으로 한 상태에 수렴(`LS-S4-AC3`) |
| RPC(학습자) | `story_list_releases` · `story_read_release_units` · `story_record_progress` · `story_my_progress` | 발행본만 목록 · 본문, 호출 시점 상태 확인, 본인 진도만 |

합칠 수 있는 것: `story_release_event` 는 `story_release` 의 상태 열 + 감사 열로 줄일 수 있고, `story_review` 는 `story_edition_draft` 의 jsonb 이력으로 둘 수도 있다 — 단 추가 전용 보장(UPDATE/DELETE 거절)을 표 단위로 거는 편이 시험하기 쉽다.
이벤트 허용 목록(`funnel_events_event_check`)은 S5 범위다.

### B-6. S4/S5 에서 바뀌는 legacy 파일

- **안전을 위해 고쳐야 하는 legacy 파일: 없다**(B-2). legacy 경로는 Story 표를 모르고, Story 는 legacy 의 발행 · 본문 · 진도 표를 쓰지 않는다.
- 기능 연결을 위해 **추가로** 손대는 곳(모두 덧붙이기):
  - S4: `apps/web/src/app/admin/curation/**`(이야기 라인 탭) + `apps/web/src/lib/admin/help/curation.ts`(같은 커밋 · `tabs` 키) · `packages/library-pipeline/package.json`(`./story` exports).
  - S5: 학습자 라우트(새 경로 → `docs/ROUTES.md`) · `apps/web/src/lib/library/tabs.ts`(탭을 둔다면) · `apps/web/src/lib/analytics/events.ts` + `funnel_events_event_check` SQL · 공개 목록에 싣는다면 `apps/web/src/lib/seo/content-entries.ts`(sitemap) · `apps/web/src/lib/search/global.ts`(별도 그룹).
  - `apps/web/src/lib/library/complete-chapter.ts` · `enroll.ts` · `texts` 는 바꾸지 않는다(IMPLEMENTATION S5 의 「필요 시 기존 texts · 완료 코드」 변경이 (2)에서는 필요 없다).
- 별도 과제로 기록(Story 범위 밖, 원본 도서에 이미 있는 약점): `content_chunks` 로그인 전 행 SELECT · `get_chapter_content` 의 상태 무확인 · `select_book_chapter_quiz` 의 상태 무확인 · RLS `admin_curator_all_books` 의 직접 상태 UPDATE. live 상태 확인은 S3_DB_AUDIT 몫이다.

## C. 승인형 배포 러너 · 격리 하네스 관행 (읽기 전용 조사)

### C-1. 파일 목록과 두 저장소 차이

| 파일 | 이 worktree(`d11f3507c`) | main-serving(`c3f321445`) |
|---|---|---|
| `agents/scripts/db-approval.mjs` (티켓 발급 · 소비) | 있음 | 있음 — **바이트 동일**(sha256 `1b40d2d16673…`) |
| `agents/scripts/db-approval-hook.mjs` (PreToolUse 훅) | 있음 | 있음 — 바이트 동일(`8ff85c6e77bf…`) |
| `agents/scripts/guard.mjs` `deployApprovals()` (형식 판정 · deny) | 186–216행 | 같은 규약 |
| `agents/scripts/__tests__/db-approval.test.mjs` · `guard.test.mjs` | 있음 | 있음 |
| `scripts/db/factory-i1/deploy.mjs` (공용 헬퍼의 출처) | 있음 | 바이트 동일(`6a14aab574e7…`) |
| `scripts/db/r5-bind/deploy.mjs` + `deploy.test.mjs` (스키마 2단계) | 있음 | 바이트 동일 |
| `scripts/db/authored-supply/deploy.mjs` + `deploy.test.mjs` (스키마 1단계) | 있음 | 바이트 동일 |
| `scripts/db/csat-content-fix/deploy.mjs` + `deploy.test.mjs` (콘텐츠 DML, 2026-10-25 최신) | **없음** | 있음(`269e5965e` 등) |
| `scripts/db/apply-approved-sql.mjs` | 있음 | 있음 — 바이트 동일(`b5109f1ab697…`). 2026-10-08 의 단발 적용기(파일 · sha256 · 체크포인트 라벨 인자, 승인 티켓 없음). 2026-10-25 정책(승인형 러너만)에 따라 새 러너는 이것이 아니라 `deploy.mjs` 규약을 따른다 |
| `supabase/deploy/<runner>/` | `authored-supply/20261020090000_authored_supply.sql` · `r5-bind/20261018120100_r5_delivery_g2_binding.sql` · `factory-i1/{MANIFEST.json, preflight.sql, db1-verify.sql, db1-restore.sql, db2-*, checkpoint/, evidence/}` · `learning-outcomes-20261021/{manifest.json, *.sql, baseline.READ-ONLY.json}` | 같은 구성 + `csat-content-fix` 러너 |
| 훅 등록 | 프로젝트 `.claude/settings.json:77` 이 `db-approval-hook.mjs --agent claude` 를 건다 | 전역 `~/.claude/hooks/vocaflow-db-approval.mjs` 는 프로젝트 설정에 `db-approval-hook` 문자열이 있으면 건너뛰고(이중 난수 방지), 없으면 main-serving 정본 훅을 대신 부른다 |

새 러너는 **스키마 변경용 `authored-supply/deploy.mjs` 를 그대로 본뜨는 것**이 가장 가깝다(단일 단계 · 저장소 본문 · `schema_migrations` 이력 행 · `preflight|apply|verify`).
콘텐츠 DML 전용인 `csat-content-fix` 는 이력 행을 남기지 않고 본문을 저장소 밖(`--sql`)에 둔다 — 스키마인 Story S3 에는 맞지 않는다.

### C-2. CLI 형태

```bash
node scripts/db/<runner>/deploy.mjs preflight --stage <s> --deps <pg 설치 폴더> [--db-url-env KEY]   # 읽기 전용 · 차단 판정
node scripts/db/<runner>/deploy.mjs apply     --stage <s> --deps <pg 설치 폴더> [--db-url-env KEY] --confirm-sha <전체 sha256>
node scripts/db/<runner>/deploy.mjs verify    --stage <s> --deps <pg 설치 폴더> [--db-url-env KEY]   # 읽기 전용 · 사후 검증
```

- 근거: `scripts/db/authored-supply/deploy.mjs:10-12`(사용법) · `:149-153`(인자) · `:157`(명령은 `preflight|apply|verify` 셋, 그 밖은 종료 1). factory-i1 은 `check` · `dry-run --remote-history <파일>` 도 있다(`scripts/db/factory-i1/deploy.mjs:7-12`).
- 종료 코드(모든 러너 공통): `0` 성공 · `1` 사용법 · `2` 적용 전 차단(`DEPLOY_BLOCKED[...]`, 아무것도 쓰지 않음) · `3` 롤백됨 · `4` 결과 불명/커밋 뒤 검증 실패(재시도 금지 · `/db-incident`) — `authored-supply/deploy.mjs:14`.
- 러너 이름 규약: 경로가 `scripts/db/<runner>/deploy.mjs`, `<runner>` = `[a-z0-9][a-z0-9-]*`(`agents/scripts/db-approval.mjs:34` `RUNNER_RE`). 러너 안의 `RUNNER` 상수가 폴더 이름과 같아야 티켓이 맞는다(`authored-supply/deploy.mjs:28` · `:167`).
- 단계 이름 규약: `^[a-z0-9][a-z0-9-]{0,31}$`(`db-approval.mjs:32`). `--confirm-sha` 는 소문자 64자(`:30`).
- 훅이 인정하는 형식(`db-approval.mjs:53-67` `parseApply`): `apply` 가 러너 경로 **바로 다음**, `--stage` · `--confirm-sha` 는 한 번씩, 에이전트가 직접 붙인 `--approval-nonce` 는 거부.
  `guard.mjs:186-216` 은 `node` 가 아닌 동사(`for` · `bash -c` · `pnpm` 등)로 러너 apply 를 감싸면 deny, 한 명령에 apply 둘 이상 deny, `; && | > #` · 치환 · 줄바꿈이 섞인 복합 명령 deny.
  ⚠️ 조사 명령도 같은 판정을 받는다 — `for` 루프 안에서 `deploy.mjs` 와 `apply` 문자열을 함께 쓰면 읽기 명령이라도 거부된다(이 감사 중 실측).

### C-3. 단계 · SQL 고정(sha256)

- 단계는 러너 파일 안 `STAGES` 상수에 하드코딩: `{ version, name, path, sha256, after }`(`authored-supply/deploy.mjs:32-39` · `r5-bind/deploy.mjs:29-42`). 매니페스트 파일이 따로 있는 것은 factory-i1(`supabase/deploy/factory-i1/MANIFEST.json`, 생성기 `build.mjs`)뿐이다.
- 본문 위치: 승인본 사본을 `supabase/deploy/<runner>/<version>_<name>.sql` 에 두고(`authored-supply` 는 `_pending_authored_supply.sql` 과 바이트 동일 — 테스트가 확인), 이미 버전 파일이 있으면 `supabase/migrations/<version>_*.sql` 을 직접 가리킨다(`r5-bind` i2).
- 고정 방식: **파일 원시 바이트의 sha256**(`fs.readFileSync(abs)` → `crypto.createHash('sha256').update(buf)` — `authored-supply/deploy.mjs:41` · `:76-83`). 정규화 없음 — CRLF/LF · BOM 이 바뀌면 SHA 가 바뀌어 `DEPLOY_BLOCKED[sha]`(종료 2). `--confirm-sha` 가 `STAGES[stage].sha256` 과 다르면 차단(`:86-90`).
- 이력 대조식: `encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex')`(`:43-44`). 러너는 `statements = [본문 텍스트]` 한 원소로 넣으므로 이 값 = 파일 sha256(UTF-8 파일일 때). safe-merge 의 DB 증거도 이 식을 쓴다.

### C-4. 승인 티켓(1회용 난수)

| 단계 | 동작 | 근거 |
|---|---|---|
| 발급 | Claude 대화형 세션에서 정식 apply 명령을 실행하려 하면 PreToolUse 훅이 `issueTicket` → 티켓 파일 `<runner>-<stage>-<sha>-<id>.json`(v2: runner · stage · sha · `nonce_sha256` · session_id · issued_at · expires_at, `wx` 생성)을 쓰고, `permissionDecision:"ask"` 와 함께 명령의 `--confirm-sha <sha>` 바로 뒤에 `--approval-nonce <48 hex>` 를 넣은 `updatedInput` 을 낸다 | `db-approval-hook.mjs:24-46` · `db-approval.mjs:70-90` · `:135-143` |
| 보관 위치 | `VF_DB_APPROVAL_DIR` 또는 `~/.vocaflow/db-approvals`. 파일에는 난수의 **해시만**. 디렉터리를 읽기 외 동사로 만지면 guard 가 deny | `db-approval.mjs:36-38` · `guard.mjs:194-195` |
| TTL | 5분(`TICKET_TTL_MS`) | `db-approval.mjs:28` |
| 소비 | 러너가 argv 의 난수를 해시해 `(runner, stage, sha, nonce_sha256)` 이 맞는 티켓을 찾고 `rename → .consumed` 로 원자적 1회 소비(동시 실행은 하나만 성공) · 소비 기록 한 줄 덧붙임 | `db-approval.mjs:93-124` |
| 소비 전 차단 | `VFC_AUTOMATED_RUN=1` · `AGENT_GUARD_ASK=0` · `CI` 환경은 무조건 거절 · 비TTY 인데 난수 없음 거절 · `--confirm-sha` ≠ 승인값 거절 · 정본 경로(`<ROOT>/scripts/db/<runner>/deploy.mjs`)를 직접 실행한 것이 아니면 거절(복사본 · `node -e import` 차단) | `factory-i1/deploy.mjs:47-53` · `authored-supply/deploy.mjs:86-99` · `:162-171` |
| TTY 대체 경로 | 사람이 터미널에서 실행하면 `APPLY <stage> <sha>` 를 그대로 입력해야 한다 | `authored-supply/deploy.mjs:172-178` |
| 감사 기록 | `ticketApprovalRecord` = `claude-code-dialog <issued_at> ticket:<id>`(난수 · 비밀 없음) → 이력 `created_by` = `<runner>-deploy:<기록>` · 로그 `approved_by` | `factory-i1/deploy.mjs:88-90` · `authored-supply/deploy.mjs:135-136` |
| 한계(문서화됨) | 같은 OS 계정의 에이전트가 정책을 어기고 티켓 파일을 위조하는 것은 막지 못한다 — 막는 것은 「승인 없는 관성 적용 · 거부된 승인 재사용 · 다른 SHA/단계로의 전용」 | `db-approval.mjs:18-21` |

주의: 티켓은 DB 접속 **전에** 소비된다 — `--deps` 누락 · 접속 실패로 끝나면 승인 창을 다시 거쳐야 한다(`supabase/deploy/factory-i1/evidence/approval-path-runner-review-20261018.md:14`).

### C-5. DB 접속 · 트랜잭션 · 멱등 · 로그

- **환경 변수 이름**: 기본 `VF_DEPLOY_DB_URL`(`--db-url-env KEY` 로 이름만 바꿀 수 있음). 셸 환경 우선, 없으면 이 worktree 의 `.env.local` → git common dir 상위(메인 worktree)의 `.env.local` 에서 **그 키 한 줄만** 읽는다. 테스트는 `VF_DEPLOY_ENV_FILE` 로 파일을 지정한다(`factory-i1/deploy.mjs:65-85`). 값은 출력 · 로그에서 `redactText` 로 가린다(`:30-38`).
- **대상 검사** `targetOf`(`factory-i1/deploy.mjs:185-197`): `postgres(ql)://` 만 · 쿼리/프래그먼트 금지 · DB 이름 `/postgres` · 호스트가 `db.<PROJECT_REF>.supabase.co` 또는 session pooler(`postgres.<ref>` 사용자) · transaction pooler(6543) 거절 · 포트 5432 명시 필수.
- **드라이버**: `pg`(저장소 의존성 아님). `--deps <폴더>` 에서 `createRequire(<폴더>/package.json)('pg')`. TLS `rejectUnauthorized: true`(csat-content-fix 는 `--ca <파일>` 로 Supabase 루트 CA 지정 가능). 이 PC 에는 `D:/workspace/vf-pg-deps`(pg 8.13.1)가 있다(조사 시점 실측, 러너가 요구하는 폴더 형태).
- **트랜잭션**(`authored-supply/deploy.mjs:124-147`): `begin` → `set local lock_timeout='15s'; statement_timeout='120s'` → `lock table supabase_migrations.schema_migrations in share row exclusive mode` → 이력 재판정(`evaluate`) → 본문 1회 실행 → 이력 행 `insert (version, name, statements, created_by, idempotency_key=sha256)` → `commit`(서버가 COMMIT 을 확인하지 않으면 결과 불명). 실패는 `rollback`, 커밋 중 오류는 `unknown`(종료 4).
- **멱등 · 순서**(`:61-73`): 선행 이력 버전 존재 · 선행 SHA 일치 · 예상 밖 원격 이력 버전 차단 · 같은 버전이 이미 있으면 `DEPLOY_BLOCKED[already]`(재적용 없음) · verify 는 이력 SHA = 승인값 확인.
- **사후 검증**: `VERIFY_SQL[stage]` = `(check, ok, detail)` 한 행씩 돌려주는 SELECT 목록(RLS 켜짐 · anon/authenticated 쓰기 권한 없음 · 함수 존재 · 정의자 `search_path` 에 `pg_temp` · 행 0 등 — `:47-58`). 커밋 뒤 실패하면 종료 4.
- **로그**: `supabase/deploy/<runner>/logs/<stage>-<command>-<target>-<ISO시각>.json`(`:27` · `:102-108`) — 패키지 · 단계 · 대상 ref · `stage_sha256` · `git_head` · `runner_sha256` · 이력 · 차단 · `approved_by` · apply 결과 · verify. `logs/` 는 `.gitignore:66` 로 커밋되지 않는다. 커밋할 증거는 `supabase/deploy/<runner>/evidence/` 관행(factory-i1).
- **임의 SQL 차단**: apply 본문은 `STAGES[stage].path` 의 저장소 파일뿐이고 SHA 가 상수와 같아야 한다 — 사용자 입력으로 SQL 을 받지 않는다(csat-content-fix 의 `--sql` 도 SHA 고정). verify SQL 은 러너 상수.
- **러너 단위 시험**: `node --test scripts/db/authored-supply/deploy.test.mjs`(SHA = 승인값 · 배포 본문 = 보류 SQL 바이트 · 차단 판정 · 난수/TTY/자동화 거절), `node --test scripts/db/r5-bind/deploy.test.mjs`, `node --test agents/scripts/__tests__/db-approval.test.mjs agents/scripts/__tests__/guard.test.mjs`. CI 는 `factory-i1/deploy.test.mjs` 만 돈다(`.github/workflows/ci.yml:49`).
- 정책 메모: 중앙 `development_policy.db_apply` 는 「main-serving `scripts/db/<id>/deploy.mjs apply …`」로 적는다. 러너의 정본 경로 검사는 「그 러너 파일이 있는 저장소의 ROOT」 기준이라 어느 worktree 에서든 직접 실행하면 통과하지만, 정책 문구대로라면 러너 · 본문 SQL 이 main 에 통합된 뒤 main-serving 에서 실행한다.

### C-6. 격리 PostgreSQL 하네스

| 하네스 | 설치 · 버전 | 역할 · RLS | 쓰는 곳 |
|---|---|---|---|
| **PGlite**(프로세스 안 WASM) | `apps/web/package.json:76` devDependency `@electric-sql/pglite` **0.5.8**(`apps/web/node_modules/@electric-sql/pglite` → pnpm store 링크). 엔진 = **PostgreSQL 18.3**(이 감사의 메모리 프로브 실측) | 기본 세션은 슈퍼유저(RLS 무시). `set role anon/authenticated` 로 바꾸면 **RLS · 테이블/함수 권한이 실제로 적용된다**(프로브: 정책 select 1행/2행 · 비허용 INSERT `permission denied` · `revoke` 된 함수 `permission denied` · SECURITY DEFINER 는 RLS 우회 · `bypassrls` 역할은 전부 봄). `auth.uid()` 는 스텁 `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid` | `apps/web/src/lib/csat/**/__tests__/*.pglite.test.ts` 20여 개 · `apps/web/src/lib/learner/__tests__/grade-underline.pglite.test.ts` |
| embedded-postgres(실제 PostgreSQL 17 임시 클러스터) | 저장소 의존성 아님. `npm i embedded-postgres@17.10.0-beta.17 pg@8.13.1` 을 임시 폴더에 설치해 `--deps` 로 넘긴다(`scripts/db/factory-i1/isolated-db.mjs:9`). 이 PC 의 `%TEMP%/vf-i1-review-deps` 에 설치본이 있다(임시 위치) | 진짜 다중 연결 · 동시성 · 배포 러너 `applyStage` 를 그대로 시험 | `scripts/db/factory-i1/isolated.mjs` · `scripts/csat/map/v62/*-concurrency.mjs` |
| 로컬 Supabase(CI 전용) | `supabase start`(Docker) — 이 PC PATH 에 `supabase` · `docker` 없음 | 실제 PostgREST · Auth · RLS | `.github/workflows/ci.yml:205-299` `e2e` job: 빈 DB 에 `scripts/ci/apply-migrations.sh` 로 저장소 마이그레이션 파일별 적용(`_pending_*` 제외) → `_pending_authored_supply.sql` 같은 보류 SQL 은 `psql -1 -f` 로 러너 DB 에만 → `playwright test -c playwright.isolated.config.ts` |

PGlite 사용 관행(`apps/web/src/lib/csat/map/v62/__tests__/supply-sql-harness.ts`):
- `new PGlite()` → 스텁 SQL(`supply-stub.sql`: `auth` 스키마 · `auth.users` · `auth.uid()` · `create role anon nologin; create role authenticated nologin;` · `is_admin_or_curator()` 스텁) → 보류 SQL(`supabase/migrations/_pending_*.sql`)을 `db.exec` 로 적용.
- 사용자 전환: `select set_config('request.jwt.claim.sub', $1, false)`(`supply-sql-harness.ts:33-35` `as()`), RLS 시험은 `set role authenticated` … `reset role`(`r5-delivery-g2-binding.pglite.test.ts:313-324` · `final-assessment.pglite.test.ts:136-143`).
- `service_role` 은 스텁에 없다 — 필요하면 테스트가 `create role service_role nologin`(+ 기본 권한)을 만든다(`csat/authored/__tests__/ai-review.pglite.test.ts:76-78`). Supabase 와 같게 RLS 우회까지 흉내 내려면 `create role service_role bypassrls`(`scripts/methodology/schema-test.mjs:15` 관행).
- 권한 단언은 `has_table_privilege` · `has_function_privilege`(`authored-supply.pglite.test.ts:153-158`).
- supabase-js 흉내 클라이언트: `apps/web/src/lib/csat/authored/__tests__/pglite-supabase.ts`(`from().select/eq/in/order/limit/maybeSingle` · `rpc()` 만, 매 호출 `request.jwt.claim.sub` 설정, **슈퍼유저로 돌아 RLS 를 보지 않는다** — `:4-5`).
- 한계: 연결 하나라 진짜 동시 트랜잭션 없음(`supply-sql-harness.ts:5`) · `pgmq` · `pg_cron` · `pg_net` · `vault` 확장 없음 → `trg_lb_enqueue` · `process_library_pipeline_batch` 같은 기존 LCP 객체는 스텁 없이 못 올린다. Story 표가 기존 LCP 표에 FK 로 묶이면 `library_books` 최소 스텁이 필요하다.
- vitest 포함 범위: `apps/web/vitest.config.ts:34` `include: ['src/**/*.{test,spec}.{ts,tsx}']` — `*.pglite.test.ts` 는 기본 `vitest run` 에 포함된다.

시험 작성자가 쓸 명령(예):

```bash
pnpm --filter web exec vitest run src/lib/library/story/__tests__/<name>.pglite.test.ts
# 기존 예시 실행: pnpm --filter web exec vitest run src/lib/csat/map/v62/__tests__/authored-supply.pglite.test.ts
# 러너 단위 시험: node --test scripts/db/<runner>/deploy.test.mjs
# 실제 PG17 클러스터(선택): node <isolated 시험 스크립트> --deps <embedded-postgres · pg 설치 폴더>
```

⚠️ `playwright.isolated.config.ts` 는 DB 를 띄우지 않는다(`apps/web/playwright.isolated.config.ts:2` — 서버는 CI 단계가 띄운다). 로컬에서 그대로 돌리면 `PLAYWRIGHT_BASE_URL`(기본 `http://localhost:3000`)의 dev 서버가 쓰는 **공유 개발 DB** 를 친다 — 격리가 아니다. 로컬 격리 검증은 PGlite(또는 embedded-postgres)로 한다.

## 미확인 · 공백

- **live DB 미조회**: 이 문서의 SQL 인용은 전부 저장소 마이그레이션 기준이다. 다음은 live 정의로 확인해야 결론이 확정된다(S3_DB_AUDIT 몫):
  `content_chunks` 의 실제 정책 · GRANT(로그인 전 행 SELECT 가 live 에도 있는가) · `get_chapter_content` live 정의 · `trg_lb_publish_word_sets` 와 함수 `trg_publish_book_word_sets()`(저장소에 정의 없음) ·
  `admin_curator_all_books` 존재 · `select_book_chapter_quiz` live 정의 · public 스키마 기본 ACL(새 표 anon/authenticated ALL 이 지금도 맞는가).
- **실행하지 않은 것**: 기존 `*.pglite.test.ts` · `node --test scripts/db/*/deploy.test.mjs` · `agents/scripts/__tests__/db-approval.test.mjs` 는 돌리지 않았다. PGlite 는 메모리 프로브 1회만 실행했다(역할 전환 · RLS · 함수 권한 · SECURITY DEFINER 우회 · `bypassrls` 확인, 파일 쓰기 없음).
- **embedded-postgres**: `%TEMP%/vf-i1-review-deps` 의 설치본(17.10.0-beta.17)은 임시 위치라 남아 있다고 가정할 수 없고, 이번에 기동해 보지 않았다. 러너용 `D:/workspace/vf-pg-deps` 에는 `pg` 만 있다(embedded-postgres 없음).
- **로컬 Supabase 격리 E2E**: 이 PC PATH 에 `supabase` · `docker` 가 없어 CI `e2e` job 과 같은 경로를 로컬에서 재현할 수 없다.
- **`csat-content-fix` 러너**는 main-serving 에만 있다. 새 러너가 쓰는 공용 헬퍼(`scripts/db/factory-i1/deploy.mjs` 의 `redactText` · `resolveDbUrl` · `targetOf` · `ticketApprovalRecord` · `writeAuthorizationBlocks`)는 이 worktree 에도 바이트 동일하게 있다.
- **깊게 읽지 않은 곳**: `apps/web/src/app/api/admin/library/convert-to-se/route.ts`(원천 전환 — `library_books` 갱신 여부 미확인) · 관리자 큐레이션 클라이언트 컴포넌트 전체(`SeedTab` · `MyLibraryTab` 의 버튼 하나하나) · `packages/library-pipeline/src/analyze/analyze-book.ts` 의 `insert_book_analysis` 경로(장 · 어휘 적재). 판정(B)에는 영향이 없다 — 모두 `library_books` 행을 대상으로 하므로 (2)에서는 Story 에 닿지 않는다.
- `supabase/functions` 는 이 worktree 에 없고, `apps/mobile` 에 `library_books` 참조는 없다(검색 결과 0).
- 이 문서는 노출 우회를 **코드 경로로** 찾았다. 실제 계정으로 우회가 재현되는지(예: 로그인 사용자의 `content_chunks` 전 행 조회)는 실행하지 않았다 — live 재현은 읽기 전용이라도 공유 DB 를 치므로 S3_DB_AUDIT 의 정책 조회로 대신한다.
