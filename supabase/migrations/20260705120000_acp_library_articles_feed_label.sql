-- ACP: library_articles 프로그램(feed) 라벨 + admin_enqueue_article 승계 (v06.135)
--   picker '소스 → 프로그램(feed) → 컨텐츠' 하위 분류의 근거.
--   시드(library_article_seed_catalog.feed_label)에만 있던 프로그램 라벨을 발행 아티클로 승계.
ALTER TABLE public.library_articles
  ADD COLUMN IF NOT EXISTS feed_id text,
  ADD COLUMN IF NOT EXISTS feed_label text;

COMMENT ON COLUMN public.library_articles.feed_label IS
  'ACP 소스 내 프로그램/시리즈 (예: VOA "Let''s Learn English (Level 1)") — 시드 feed_label 승계';

-- 기존 9-arg 시그니처 DROP 후 11-arg 로 재생성 (뒤 2개 optional → 기존 호출 호환)
DROP FUNCTION IF EXISTS public.admin_enqueue_article(
  text, text, text, text, text, timestamptz, text, text, text);

CREATE FUNCTION public.admin_enqueue_article(
  p_source text, p_source_id text, p_title text,
  p_author text DEFAULT NULL,
  p_url text DEFAULT NULL,
  p_published_at timestamptz DEFAULT NULL,
  p_license text DEFAULT 'PD-Government',
  p_content text DEFAULT '',
  p_audio_url text DEFAULT NULL,
  p_feed_id text DEFAULT NULL,
  p_feed_label text DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_id UUID;
  v_existing UUID;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  SELECT id INTO v_existing FROM library_articles
  WHERE source = p_source AND source_id = p_source_id LIMIT 1;
  IF v_existing IS NOT NULL THEN
    UPDATE library_articles SET audio_url = p_audio_url
      WHERE id = v_existing AND audio_url IS NULL AND p_audio_url IS NOT NULL;
    UPDATE library_articles
      SET feed_id = COALESCE(feed_id, p_feed_id),
          feed_label = COALESCE(feed_label, p_feed_label)
      WHERE id = v_existing AND feed_label IS NULL AND p_feed_label IS NOT NULL;
    RETURN v_existing;
  END IF;

  INSERT INTO library_articles (
    source, source_id, title, author, source_url, published_at,
    license, content, audio_url, status, feed_id, feed_label
  ) VALUES (
    p_source, p_source_id, p_title, p_author, p_url, p_published_at,
    p_license, COALESCE(p_content, ''), p_audio_url, 'queued', p_feed_id, p_feed_label
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.admin_enqueue_article(
  text, text, text, text, text, timestamptz, text, text, text, text, text)
  TO authenticated, service_role;
