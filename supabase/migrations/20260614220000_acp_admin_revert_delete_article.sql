-- ACP article 에 LCP book 과 동등한 단계 이동 RPC 2종 추가 (v06.64).
--
-- 기존 ACP RPC: force_publish, requeue, archive 만.
-- 누락: revert_published (published → ready, 단어장 삭제), delete (영구 삭제).
--
-- LCP 동등 함수:
--   • admin_revert_published_book → admin_revert_published_article
--   • admin_delete_book → admin_delete_article
--
-- 외부 의존 (사전 확인):
--   • library_article_vocabularies → FK CASCADE (자동 삭제)
--   • library_article_seed_catalog.imported_article_id → FK SET NULL (자동 unlock)
--   • shared_word_sets (category='library_article') — FK 없음, JSONB 매칭으로 수동 DELETE
--   • texts.source_url='article:{id}' 마커 — 사용자 학습 기록 보존 차원에서 그대로
--     (layout.tsx 가 marker 보고 fetch 시 null → 단어장/보이스 미연결, 학습 진도는 보존)

-- ─── 1. admin_revert_published_article ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_revert_published_article(p_article_id uuid)
RETURNS TABLE(reverted_article_id uuid, deleted_word_sets integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_status TEXT;
  v_deleted INT;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  SELECT status INTO v_status
  FROM library_articles
  WHERE id = p_article_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Article not found: %', p_article_id;
  END IF;

  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'Article is not published (current status: %)', v_status;
  END IF;

  WITH del AS (
    DELETE FROM shared_word_sets
    WHERE category = 'library_article'
      AND curation_query->>'article_id' = p_article_id::text
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM del;

  UPDATE library_articles
  SET status = 'ready',
      published_at = NULL
  WHERE id = p_article_id;

  RETURN QUERY SELECT p_article_id, v_deleted;
END $function$;

COMMENT ON FUNCTION public.admin_revert_published_article(uuid) IS
  'LCP admin_revert_published_book 미러 — published → ready + shared_word_sets(library_article) 삭제.';

-- ─── 2. admin_delete_article ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_article(p_article_id uuid)
RETURNS TABLE(
  deleted_article_id uuid,
  status_was text,
  word_sets_deleted integer,
  seed_unlocked integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_status TEXT;
  v_word_sets INT := 0;
  v_seed INT := 0;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  SELECT status INTO v_status
  FROM library_articles
  WHERE id = p_article_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Article not found: %', p_article_id;
  END IF;

  -- LCP 와 동일 — ready/archived/failed 만 허용. published 는 revert 후 삭제.
  IF v_status NOT IN ('ready', 'archived', 'queued', 'failed') THEN
    RAISE EXCEPTION
      'Delete blocked: current status % (allowed: ready/archived/queued/failed). Revert published articles first.',
      v_status;
  END IF;

  -- 1) shared_word_sets (library_article) 삭제 (이전 발행분 잔존 가능성)
  WITH d AS (
    DELETE FROM shared_word_sets
    WHERE category = 'library_article'
      AND curation_query->>'article_id' = p_article_id::text
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_word_sets FROM d;

  -- 2) library_article_seed_catalog imported 해제 (SET NULL FK 가 자동 처리,
  --    카운트만 사전 집계)
  SELECT COUNT(*) INTO v_seed
  FROM library_article_seed_catalog
  WHERE imported_article_id = p_article_id;

  -- 3) 본체 삭제 (library_article_vocabularies CASCADE,
  --    library_article_seed_catalog.imported_article_id SET NULL)
  DELETE FROM library_articles WHERE id = p_article_id;

  -- texts.source_url='article:{id}' 마커는 그대로 (사용자 학습 진도 보존,
  --    layout.tsx 가 marker 보고 fetch 시 null → 보이스/단어장만 미연결)

  RETURN QUERY SELECT p_article_id, v_status, v_word_sets, v_seed;
END $function$;

COMMENT ON FUNCTION public.admin_delete_article(uuid) IS
  'LCP admin_delete_book 미러 — published 제외 모든 status 영구 삭제. CASCADE 로 vocabularies, SET NULL 로 seed unlock.';
