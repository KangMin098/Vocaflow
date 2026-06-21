-- 20260621120000_voa_publish_require_audio_gate.sql
-- P3/C5 — VOA 발행 시 audio_url 필수 게이트 (학습 정체성: VOA = listening-first).
-- 격리: source='voa' 한정. 타 소스(nasa/nih/wikinews/the_conversation/simple_wikipedia) 무영향.
-- BEFORE INSERT OR UPDATE OF status → force-publish route · admin_force_publish_article RPC · 직접 update 모든 경로 일괄 커버.
-- rollback: DROP TRIGGER trg_la_require_audio + DROP FUNCTION trg_require_article_audio.

CREATE OR REPLACE FUNCTION public.trg_require_article_audio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND NEW.source = 'voa'
     AND (NEW.audio_url IS NULL OR btrim(NEW.audio_url) = '')
  THEN
    RAISE EXCEPTION 'VOA article requires audio_url to publish (article_id=%)', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_la_require_audio
  BEFORE INSERT OR UPDATE OF status ON public.library_articles
  FOR EACH ROW EXECUTE FUNCTION public.trg_require_article_audio();
