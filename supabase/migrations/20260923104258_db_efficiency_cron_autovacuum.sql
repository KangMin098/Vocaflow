-- supabase/migrations/20260923104258_db_efficiency_cron_autovacuum.sql
--
-- **30분마다 도는 집계 크론 하나가 256 MB 버퍼 캐시를 하루 48번 비운다.** — **적용 2026-09-23** (사용자 승인 · 원장 20260923104258).
--
-- ── ① cron 14 — refresh_textbook_shelf_stats() 주기 (2026-09-23 실측) ──
--
-- pg_stat_statements: **총 7,853초 · 340회 · 평균 23,096 ms.** 함수는 MV 3개를 CONCURRENTLY 로 다시 만든다.
-- EXPLAIN (ANALYZE, BUFFERS) 로 23초의 출처를 쪼갰다:
--
--   textbook_shelf_inventory_mv : 10,348 ms · Parallel Seq Scan csat_dcp_items(880,337행) · read 159,971 블록
--   textbook_shelf_sources_mv   : 11,676 ms · Seq Scan + Hash Left Join library_articles(109,047) · read 177,141
--
-- `read` 가 거의 전부다 = 캐시에 없어서 디스크에서 읽는다. 한 번 갱신에 약 **1.25 GB + 1.38 GB**.
-- 이 인스턴스의 `shared_buffers` 는 **256 MB**(effective_cache_size 768 MB → RAM 약 1 GB)다.
-- 한 번의 갱신이 그 10배를 읽으므로 **버퍼 캐시가 통째로 비워진다.**
-- 30분 주기 = 하루 48회 · 약 **60 GB 디스크 읽기**. 그 사이 학습자·사전 조회
-- (`shared_dictionary` 인덱스 스캔 4,786만회)가 매번 차가운 캐시에서 다시 읽는다.
--
-- CHANGELOG 에 같은 함수가 인스턴스를 굶겨 죽인 기록이 두 번 있다(28.9초 · 14초 풀스캔).
-- 그때 고친 것은 `statement_timeout` 을 300s 로 올린 것뿐이고(20260906060000:110) 원인은 그대로다.
-- 7일 창에 `job startup timeout` 이 **14건**(373회 중 3.8%) 찍혀 있다.
--
-- 읽는 쪽은 관리자 화면 하나다. 드레인 import 스크립트가 끝나면 이 함수를 **직접 호출**하므로
-- 크론은 보조망이다. 화면은 「언제 센 값인지」를 이미 표시한다(`textbook_shelf_refreshed_at()`).
-- 30분 → 6시간이면 디스크 읽기가 **92% 준다**. 되돌리기는 같은 cron.schedule 한 줄.
--
-- (더 큰 고침 두 가지는 **일부러 하지 않는다**: sources_mv 의 library_articles 조인 제거,
--  inventory_mv 의 explanation 계산을 생성 컬럼으로 내리기. 둘 다 마이그레이션·백필이 필요한데
--  주기 완화 하나가 이득의 92% 를 가져간다.)

SELECT cron.schedule(
  'refresh-textbook-shelf-stats',
  '0 */6 * * *',
  $cron$SELECT public.refresh_textbook_shelf_stats()$cron$
);

-- ── ② 갱신 배선이 없는 머티리얼라이즈드뷰 ───────────────────────────
--
-- `public.mv_lemma_dominant_pos` 는 `select_book_chapter_vocab()` 이 읽는다(인덱스 스캔 785,826회).
-- 그런데 **갱신하는 것이 아무것도 없다** — `refresh_lemma_dominant_pos()` 함수는 존재하지만
-- 호출부가 0이고 cron.job 14개 중 이걸 도는 작업이 없다.
--
-- 지금 얼마나 낡았나(소스를 다시 계산해 대조 · 2026-09-23):
--   소스 재계산 27,828 lemma / MV 11,085행 → **16,759 누락(60.2%)** · 지배 품사가 달라진 것 773 · 유령 16
--
-- 다만 화면 영향은 60% 가 아니다. 이 MV 는 3순위 폴백 중 2번째다:
--   COALESCE(bv.context_pos, ldp.dominant_pos, infer_form_pos(...))
-- `library_book_vocabularies` 1,678,399행 중 `context_pos IS NULL` 은 **24,284행(1.4%)** 뿐이다.
-- 즉 실제 영향은 그 1.4% 에서 뜻·품사 선택이 코퍼스 기반 지배품사 대신 휴리스틱으로 떨어지는 것이다.
--
-- 소스(`library_book_vocabularies`)는 LCP 드레인 때만 바뀌므로 하루 1회로 충분하다.
-- 30분 주기로 걸면 ①과 같은 실수를 반복하게 된다.
-- MV 에 unique 인덱스(`mv_lemma_dominant_pos_pk (lemma)`)가 있으므로 CONCURRENTLY 가 가능하다.

SELECT public.refresh_lemma_dominant_pos();

SELECT cron.schedule(
  'refresh-lemma-dominant-pos',
  '30 17 * * *',
  $cron$SELECT public.refresh_lemma_dominant_pos()$cron$
);

-- ── ③ autovacuum — 삭제-재삽입으로 도는 표 ──────────────────────────
--
-- `library_article_vocabularies` (2026-09-23 실측)
--   힙 7,575 MB · 인덱스 2,391 MB · 33,888,793행 · dead 795,830
--   7.4일 창에 삽입 12,400,558 / **삭제 12,382,935** — 글 한 편을 다시 분석할 때마다 통째로 지우고 넣는다
--   reloptions 없음 → 기본 임계 `50 + 0.2 × 3,388만 = 약 678만` dead tuple. 지금 79.6만이니 한참 안 돈다.
--   그동안 힙과 인덱스가 계속 부푼다. 인덱스 2,391 MB 는 `_pending_reindex_lav_word_key.sql` 이
--   2026-09-16 에 적은 2,390 MB 와 **지금도 같다** — 그 계획은 아직 유효하다.
--
-- `csat_dcp_items`
--   힙 1,289 MB · 인덱스 214 MB(6개) · 880,760행 · dead 148,679 · 7.4일 창에 UPDATE **533,478**
--   insert/analyze 임계는 이미 조정돼 있으나 **update 쪽(vacuum_scale_factor)은 기본값**이다.
--   기본 임계 `50 + 0.2 × 88만 = 약 17.6만` — 지금 14.9만이라 아슬아슬하게 안 돈다.
--
-- 되돌리기: `alter table ... reset (autovacuum_vacuum_scale_factor);` 데이터는 바뀌지 않는다.
-- 적용 직후 한 번은 autovacuum 이 길게 돌 수 있다(읽기는 막지 않는다).

ALTER TABLE public.library_article_vocabularies
  SET (autovacuum_vacuum_scale_factor = 0.02);   -- 678만 → 68만

ALTER TABLE public.csat_dcp_items
  SET (autovacuum_vacuum_scale_factor = 0.05);   -- 17.6만 → 4.4만

-- ── 적용 뒤 확인 ────────────────────────────────────────────────────
--   SELECT jobid, jobname, schedule FROM cron.job WHERE jobname IN
--     ('refresh-textbook-shelf-stats','refresh-lemma-dominant-pos');
--   SELECT count(*) FROM public.mv_lemma_dominant_pos;   -- 27,828 근처여야 한다(전 11,085)
--   SELECT relname, reloptions FROM pg_class
--    WHERE relname IN ('library_article_vocabularies','csat_dcp_items');
