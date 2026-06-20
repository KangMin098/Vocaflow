-- supabase/migrations/20260614130000_acp_article_audio_url.sql
-- v06.45 — ACP article audio_url (LCP librivox_audio 와 동일 연계 패턴)
--
-- 1) library_articles.audio_url TEXT 컬럼 추가
-- 2) admin_enqueue_article RPC 시그니처 확장 (p_audio_url TEXT DEFAULT NULL)
--    · 기존 호출자 호환 (DEFAULT NULL)
--    · 기 enqueue article 도 audio_url=NULL 이면 보강 UPDATE
--
-- 영향: 컬럼 추가 + RPC 확장만 — 기존 데이터/호출 영향 0

BEGIN;

ALTER TABLE library_articles ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN library_articles.audio_url IS
  'VOA Learning English (학습용 mp3) · Lit2Go (USF audiobook) 등 article 의 native audio URL. 도서 LCP librivox_audio 와 동일 연계 패턴 — /text/[id] 학습 화면에서 player 자동 노출';

DROP FUNCTION IF EXISTS public.admin_enqueue_article(text, text, text, text, text, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.admin_enqueue_article(
  p_source       TEXT,
  p_source_id    TEXT,
  p_title        TEXT,
  p_author       TEXT DEFAULT NULL,
  p_url          TEXT DEFAULT NULL,
  p_published_at TIMESTAMPTZ DEFAULT NULL,
  p_license      TEXT DEFAULT 'PD-Government',
  p_content      TEXT DEFAULT '',
  p_audio_url    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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
    RETURN v_existing;
  END IF;

  INSERT INTO library_articles (
    source, source_id, title, author, source_url, published_at,
    license, content, audio_url, status
  ) VALUES (
    p_source, p_source_id, p_title, p_author, p_url, p_published_at,
    p_license, COALESCE(p_content, ''), p_audio_url, 'queued'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

COMMIT;
