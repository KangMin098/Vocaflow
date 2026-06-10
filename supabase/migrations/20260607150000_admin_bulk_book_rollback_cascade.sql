-- 20260607150000_admin_bulk_book_rollback_cascade.sql
--
-- Curated Books bulk rollback — 단계에 따라 파생 데이터(단어장 draft / 추출 / 챕터 마스터) 삭제.
-- 이전(20260607130000)의 status-only wrapper 2개를 **cascading cleanup** 버전으로 교체.
--
-- 두 함수 모두 SECURITY DEFINER + is_admin_or_curator() + 안전 가드:
--   (a) 이미 published 된 챕터 단어장(is_published=true) 이 1개라도 있으면 row 스킵
--   (b) texts.library_book_id 가 가리키는 사용자 데이터가 1개라도 있으면 row 스킵
--   → 두 보호장치는 사용자 학습 데이터 손상 차단. 스킵 카운트로 admin 에게 보고.
--
-- ── 1. ready → curating  (Roll back 1 단계)
--    삭제 대상: shared_word_sets drafts (auto_curate 산출 — is_published=false)
--               → shared_words / user_word_set_subscriptions 는 FK CASCADE 로 자동 정리.
--    보존: library_book_vocabularies (추출 결과) · library_chapters_master · content_chunks
--          · 모든 library_books 메타 (book_v_level, cefr_*, F-K, lexical_coverage, librivox_audio, cover_image_url)
--    pgmq 재발행 X — admin 이 다시 검수 작업 진행 (필요 시 큐 이전을 별도로 트리거)
--
-- ── 2. (ready ∪ in_progress) → queued  (소스 get / Hard reset)
--    삭제 대상: shared_word_sets drafts + library_book_vocabularies + library_chapters_master
--               → 위 두 테이블은 library_books FK CASCADE 가 있지만 명시적으로 DELETE 해서
--                 카운트 보고 + 부분 실패 시 의도 명확.
--    library_books 파생 컬럼 NULL 리셋: book_v_level / cefr_* / cefrj_* / F-K / lexical_coverage
--                                       / word_count / chapter_count / reading_minutes / vrl_components
--                                       / v_level_centroid_precise / published_at
--    보존: librivox_audio · cover_image_url (큐레이터 수동 매핑/이미지 — 재실행해도 동일)
--          · author/title/source/source_id/license/copyright_safe_in_kr 등 메타
--    pgmq.send → library-pipeline-worker (30s cron) 가 ingest 부터 다시 실행.

-- 기존 시그니처 제거 (반환 형식이 바뀌므로 DROP 필요)
DROP FUNCTION IF EXISTS public.admin_bulk_set_books_curating(uuid[]);
DROP FUNCTION IF EXISTS public.admin_bulk_requeue_books(uuid[]);


-- ────────────────────────────────────────────────────────────
-- 1. ready → curating + draft 단어장 삭제
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bulk_set_books_curating(p_book_ids uuid[])
RETURNS TABLE(
  updated_count           int,
  skipped_count           int,
  word_sets_deleted       int,
  blocked_by_users        int,
  blocked_by_published    int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq', 'extensions'
AS $function$
DECLARE
  v_id                UUID;
  v_total             INT := COALESCE(array_length(p_book_ids, 1), 0);
  v_updated           INT := 0;
  v_sets_deleted      INT := 0;
  v_blocked_users     INT := 0;
  v_blocked_published INT := 0;
  v_has_users         BOOLEAN;
  v_has_published     BOOLEAN;
  v_temp              INT;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF v_total = 0 THEN
    updated_count := 0; skipped_count := 0;
    word_sets_deleted := 0; blocked_by_users := 0; blocked_by_published := 0;
    RETURN NEXT; RETURN;
  END IF;

  FOR v_id IN
    SELECT id FROM library_books
     WHERE id = ANY(p_book_ids) AND status = 'ready'
  LOOP
    -- (a) 이미 published 된 챕터 단어장이 있으면 row 스킵 (학습자 노출 중)
    SELECT EXISTS(
      SELECT 1 FROM shared_word_sets
       WHERE category = 'library_book'
         AND curation_query->>'book_id' = v_id::text
         AND is_published = true
    ) INTO v_has_published;
    IF v_has_published THEN
      v_blocked_published := v_blocked_published + 1;
      CONTINUE;
    END IF;

    -- (b) 사용자 texts 가 이 도서를 참조하면 row 스킵 (개인 진도 손상 차단)
    SELECT EXISTS(SELECT 1 FROM texts WHERE library_book_id = v_id) INTO v_has_users;
    IF v_has_users THEN
      v_blocked_users := v_blocked_users + 1;
      CONTINUE;
    END IF;

    -- draft 단어장 삭제 (shared_words / subscriptions 는 FK CASCADE)
    WITH del AS (
      DELETE FROM shared_word_sets
       WHERE category = 'library_book'
         AND curation_query->>'book_id' = v_id::text
         AND is_published = false
       RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_temp FROM del;
    v_sets_deleted := v_sets_deleted + v_temp;

    -- status reclassify (curating)
    UPDATE library_books
       SET status = 'curating',
           status_message = NULL,
           updated_at = now()
     WHERE id = v_id;

    v_updated := v_updated + 1;
  END LOOP;

  updated_count        := v_updated;
  skipped_count        := v_total - v_updated;
  word_sets_deleted    := v_sets_deleted;
  blocked_by_users     := v_blocked_users;
  blocked_by_published := v_blocked_published;
  RETURN NEXT;
END $function$;

REVOKE ALL ON FUNCTION public.admin_bulk_set_books_curating(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_set_books_curating(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_set_books_curating(uuid[]) IS
'Curated Books bulk: ready -> curating + draft chapter word sets delete. Guards: published sets / user texts. Admin or curator only.';


-- ────────────────────────────────────────────────────────────
-- 2. (ready ∪ in_progress) → queued  +  파생 데이터 전체 삭제  +  pgmq 재발행
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bulk_requeue_books(p_book_ids uuid[])
RETURNS TABLE(
  updated_count           int,
  skipped_count           int,
  word_sets_deleted       int,
  vocabs_deleted          int,
  chapters_deleted        int,
  blocked_by_users        int,
  blocked_by_published    int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq', 'extensions'
AS $function$
DECLARE
  v_id                UUID;
  v_total             INT := COALESCE(array_length(p_book_ids, 1), 0);
  v_updated           INT := 0;
  v_sets_deleted      INT := 0;
  v_vocabs_deleted    INT := 0;
  v_chapters_deleted  INT := 0;
  v_blocked_users     INT := 0;
  v_blocked_published INT := 0;
  v_has_users         BOOLEAN;
  v_has_published     BOOLEAN;
  v_temp              INT;
  v_eligible          CONSTANT TEXT[] := ARRAY[
    'queued','ingesting','normalizing','segmenting','analyzing','curating','ready'
  ];
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF v_total = 0 THEN
    updated_count := 0; skipped_count := 0;
    word_sets_deleted := 0; vocabs_deleted := 0; chapters_deleted := 0;
    blocked_by_users := 0; blocked_by_published := 0;
    RETURN NEXT; RETURN;
  END IF;

  FOR v_id IN
    SELECT id FROM library_books
     WHERE id = ANY(p_book_ids) AND status = ANY(v_eligible)
  LOOP
    -- 안전 가드: published 단어장
    SELECT EXISTS(
      SELECT 1 FROM shared_word_sets
       WHERE category = 'library_book'
         AND curation_query->>'book_id' = v_id::text
         AND is_published = true
    ) INTO v_has_published;
    IF v_has_published THEN
      v_blocked_published := v_blocked_published + 1;
      CONTINUE;
    END IF;

    -- 안전 가드: 사용자 진도
    SELECT EXISTS(SELECT 1 FROM texts WHERE library_book_id = v_id) INTO v_has_users;
    IF v_has_users THEN
      v_blocked_users := v_blocked_users + 1;
      CONTINUE;
    END IF;

    -- 1) draft 단어장 삭제 (cascade)
    WITH del AS (
      DELETE FROM shared_word_sets
       WHERE category = 'library_book'
         AND curation_query->>'book_id' = v_id::text
         AND is_published = false
       RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_temp FROM del;
    v_sets_deleted := v_sets_deleted + v_temp;

    -- 2) 추출 어휘 삭제
    WITH del AS (
      DELETE FROM library_book_vocabularies WHERE library_book_id = v_id RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_temp FROM del;
    v_vocabs_deleted := v_vocabs_deleted + v_temp;

    -- 3) 챕터 마스터 삭제 (content_chunks 는 hash 공유 가능성 — GC 별도)
    WITH del AS (
      DELETE FROM library_chapters_master WHERE library_book_id = v_id RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_temp FROM del;
    v_chapters_deleted := v_chapters_deleted + v_temp;

    -- 4) library_books 파생 컬럼 NULL 리셋 + status=queued
    --    (cefr_band 는 GENERATED — cefrj_level 통해서만 영향)
    UPDATE library_books
       SET status                   = 'queued',
           status_message           = NULL,
           updated_at               = now(),
           word_count               = NULL,
           chapter_count            = NULL,
           reading_minutes          = NULL,
           cefr_level               = NULL,
           cefr_confidence          = NULL,
           book_v_level             = NULL,
           v_level_centroid_precise = NULL,
           vrl_components           = NULL,
           cefrj_level              = NULL,
           cefrj_confidence         = NULL,
           flesch_kincaid_grade     = NULL,
           flesch_reading_ease      = NULL,
           readability_computed_at  = NULL,
           lexical_coverage         = NULL,
           published_at             = NULL
     WHERE id = v_id;

    -- 5) pgmq 재발행 (cron worker 가 ingest 부터 다시 실행)
    PERFORM pgmq.send(
      'library_pipeline',
      jsonb_build_object('book_id', v_id, 'enqueued_at', now(), 'requeued', true)
    );

    v_updated := v_updated + 1;
  END LOOP;

  updated_count        := v_updated;
  skipped_count        := v_total - v_updated;
  word_sets_deleted    := v_sets_deleted;
  vocabs_deleted       := v_vocabs_deleted;
  chapters_deleted     := v_chapters_deleted;
  blocked_by_users     := v_blocked_users;
  blocked_by_published := v_blocked_published;
  RETURN NEXT;
END $function$;

REVOKE ALL ON FUNCTION public.admin_bulk_requeue_books(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_requeue_books(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_requeue_books(uuid[]) IS
'Curated Books bulk: (ready or in_progress) -> queued + delete drafts/vocabs/chapters + reset derived cols + pgmq resend. Guards: published sets / user texts. Admin or curator only.';
