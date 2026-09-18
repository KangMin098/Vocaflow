-- supabase/migrations/20260918222517_csat_source_cache_freshness.sql
-- Derived-cache safeguards only; original content, answers and attempts are untouched.
CREATE FUNCTION public.enforce_source_eligibility_freshness() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_revision timestamptz;
BEGIN
  -- FOR SHARE also conflicts with non-key source updates; KEY SHARE does not.
  SELECT updated_at INTO current_revision FROM public.library_articles
    WHERE id = NEW.article_id FOR SHARE;
  IF NOT FOUND OR NEW.source_updated_at IS DISTINCT FROM current_revision THEN
    RAISE EXCEPTION 'Source revision changed; regenerate eligibility projection'
      USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.policy_version < OLD.policy_version OR
    (NEW.source_updated_at = OLD.source_updated_at AND NEW.policy_version = OLD.policy_version
      AND NEW.measured_at < OLD.measured_at)
  ) THEN
    RAISE EXCEPTION 'Newer eligibility projection already exists'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_source_eligibility_freshness() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER source_eligibility_freshness
  BEFORE INSERT OR UPDATE ON public.csat_source_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.enforce_source_eligibility_freshness();

-- Live readiness belongs to the source; cached judgments are not authoritative
-- after its revision changes. Missing cache rows remain visible for revalidation.
CREATE VIEW public.csat_source_operations WITH (security_invoker = true) AS
SELECT a.id AS article_id, a.source, a.title AS current_title,
  a.article_v_level AS current_v_level, a.cefr_level AS current_cefr,
  a.updated_at AS current_source_updated_at, a.status AS current_source_status,
  e.source_updated_at, e.policy_version, e.input, e.result, e.quality_flags,
  e.excerpt_evidence, e.linked_items, e.measured_at,
  CASE WHEN e.article_id IS NULL THEN 'missing'
    WHEN f.is_current THEN 'current' ELSE 'stale' END AS cache_state,
  CASE WHEN f.is_current THEN e.result->>'status' ELSE 'review' END AS effective_status,
  COALESCE(f.is_current AND e.result->>'grade' IN ('usable','excerpt')
    AND e.result->'blockers' = '[]'::jsonb, false) AS can_use
FROM public.library_articles a
LEFT JOIN public.csat_source_eligibility e ON e.article_id = a.id
CROSS JOIN LATERAL (
  SELECT COALESCE(e.policy_version = 3 AND e.source_updated_at = a.updated_at
    AND (e.result->>'grade' <> 'excerpt' OR EXISTS (
      SELECT 1 FROM public.csat_dcp_items i WHERE i.kind='article' AND i.ref_id=a.id
    )), false) AS is_current
) f
WHERE a.status IN ('ready','published');
REVOKE ALL ON public.csat_source_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.csat_source_operations TO service_role;
