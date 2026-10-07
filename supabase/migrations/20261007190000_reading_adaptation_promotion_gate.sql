-- supabase/migrations/20261007190000_reading_adaptation_promotion_gate.sql
-- Gold-S seed admission stores reading children as queued. Generic ACP/RPC/direct
-- updates must not make them learner-visible before a separate promotion contract.
-- Apply only after explicit user approval; no promotion function is installed here.

CREATE OR REPLACE FUNCTION public.trg_hold_reading_adaptation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('ready', 'published') AND NEW.source_id LIKE 'reading:%' THEN
    RAISE EXCEPTION 'Reading adaptation requires separate promotion gate (article_id=%)', NEW.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.source_id LIKE 'reading:%' AND NEW.source_id IS DISTINCT FROM OLD.source_id THEN
      RAISE EXCEPTION 'Reading adaptation source_id is immutable (article_id=%)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IN ('ready', 'published') AND OLD.source_id LIKE 'reading:%' THEN
      RAISE EXCEPTION 'Reading adaptation requires separate promotion gate (article_id=%)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_la_hold_reading_adaptation
  BEFORE INSERT OR UPDATE OF status, source_id ON public.library_articles
  FOR EACH ROW EXECUTE FUNCTION public.trg_hold_reading_adaptation();
