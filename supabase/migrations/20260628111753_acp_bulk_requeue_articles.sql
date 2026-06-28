-- 20260628111753_acp_bulk_requeue_articles.sql
--
-- admin_bulk_requeue_articles 신규 — LCP admin_bulk_requeue_books 미러(글 버전).
--   글 DELETE → library_article_vocabularies CASCADE + draft 단어장 DELETE + seed 완전 unlock.
--   가드: 발행 단어장 / 사용자 학습 텍스트(texts.source_url='article:{id}') 있으면 스킵.
-- 라우트 /api/admin/articles/bulk-requeue 는 동등 로직을 TS 로 수행(DEV_ADMIN_BYPASS 함정 회피) — 본 함수는 SSoT 정합.

CREATE OR REPLACE FUNCTION public.admin_bulk_requeue_articles(p_article_ids uuid[])
 RETURNS TABLE(deleted_count int, skipped_count int, word_sets_deleted int, seed_unlocked int, blocked_by_users int, blocked_by_published int)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE
  v_id UUID; v_total INT := COALESCE(array_length(p_article_ids,1),0);
  v_deleted INT:=0; v_sets INT:=0; v_seed INT:=0; v_busers INT:=0; v_bpub INT:=0;
  v_has_users BOOLEAN; v_has_pub BOOLEAN; v_temp INT;
  v_eligible CONSTANT TEXT[] := ARRAY['queued','ingesting','normalizing','analyzing','curating','ready','failed'];
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  IF v_total = 0 THEN
    deleted_count:=0; skipped_count:=0; word_sets_deleted:=0; seed_unlocked:=0; blocked_by_users:=0; blocked_by_published:=0;
    RETURN NEXT; RETURN;
  END IF;
  FOR v_id IN SELECT id FROM library_articles WHERE id = ANY(p_article_ids) AND status = ANY(v_eligible) LOOP
    SELECT EXISTS(SELECT 1 FROM shared_word_sets
      WHERE category='library_article' AND curation_query->>'article_id'=v_id::text AND is_published=true) INTO v_has_pub;
    IF v_has_pub THEN v_bpub := v_bpub+1; CONTINUE; END IF;
    SELECT EXISTS(SELECT 1 FROM texts WHERE source_url = 'article:'||v_id::text) INTO v_has_users;
    IF v_has_users THEN v_busers := v_busers+1; CONTINUE; END IF;
    WITH del AS (DELETE FROM shared_word_sets
      WHERE category='library_article' AND curation_query->>'article_id'=v_id::text AND is_published=false RETURNING 1)
    SELECT COUNT(*)::int INTO v_temp FROM del; v_sets := v_sets + v_temp;
    WITH u AS (UPDATE library_article_seed_catalog
        SET imported_to_articles=false, imported_article_id=NULL, curation_status='pending'
      WHERE imported_article_id = v_id RETURNING 1)
    SELECT COUNT(*)::int INTO v_temp FROM u; v_seed := v_seed + v_temp;
    DELETE FROM library_articles WHERE id = v_id; v_deleted := v_deleted + 1;
  END LOOP;
  deleted_count:=v_deleted; skipped_count:=v_total-v_deleted; word_sets_deleted:=v_sets;
  seed_unlocked:=v_seed; blocked_by_users:=v_busers; blocked_by_published:=v_bpub;
  RETURN NEXT;
END $function$;
