-- supabase/migrations/20260918140224_csat_source_eligibility_cache.sql
-- Phase 1: derived cache only. No source rows or existing RPCs are changed.
-- Seed with source-policy-refresh before activating Phase 2.
CREATE TABLE public.csat_source_eligibility (
  article_id uuid PRIMARY KEY REFERENCES public.library_articles(id),
  source text NOT NULL,
  source_updated_at timestamptz NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version > 0),
  input jsonb NOT NULL,
  result jsonb NOT NULL,
  quality_flags text[] NOT NULL DEFAULT '{}',
  excerpt_evidence jsonb NOT NULL DEFAULT '{}',
  linked_items integer NOT NULL DEFAULT 0 CHECK (linked_items >= 0),
  measured_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(result->'blockers') = 'array'),
  CHECK (result->>'grade' IN ('usable','excerpt','excerpt-blind','unjudged','unknown','blocked')),
  CHECK (result->>'grade' NOT IN ('usable','excerpt') OR result->'blockers' = '[]'::jsonb)
);
CREATE INDEX csat_source_eligibility_grade ON public.csat_source_eligibility ((result->>'grade'));
CREATE INDEX csat_source_eligibility_quality ON public.csat_source_eligibility USING gin (quality_flags);
CREATE INDEX csat_source_eligibility_blockers ON public.csat_source_eligibility USING gin ((result->'blockers'));
ALTER TABLE public.csat_source_eligibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_eligibility_admin_read ON public.csat_source_eligibility
  FOR SELECT TO authenticated USING (public.is_admin_or_curator());
GRANT SELECT ON public.csat_source_eligibility TO authenticated;
REVOKE ALL ON public.csat_source_eligibility FROM anon;
GRANT ALL ON public.csat_source_eligibility TO service_role;

CREATE TABLE public.csat_source_eligibility_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id uuid NOT NULL,
  previous jsonb NOT NULL,
  replaced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.csat_source_eligibility_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_eligibility_history_admin_read ON public.csat_source_eligibility_history
  FOR SELECT TO authenticated USING (public.is_admin_or_curator());
GRANT SELECT ON public.csat_source_eligibility_history TO authenticated;
GRANT ALL ON public.csat_source_eligibility_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.csat_source_eligibility_history_id_seq TO service_role;

CREATE FUNCTION public.retain_source_eligibility_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (OLD.source_updated_at, OLD.policy_version, OLD.input, OLD.result)
     IS DISTINCT FROM (NEW.source_updated_at, NEW.policy_version, NEW.input, NEW.result) THEN
    INSERT INTO public.csat_source_eligibility_history(article_id, previous)
    VALUES (OLD.article_id, to_jsonb(OLD));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER source_eligibility_history BEFORE UPDATE ON public.csat_source_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.retain_source_eligibility_history();

-- TypeScript evaluateSource is the policy. SQL validates freshness and its signed-off
-- derived result; it does not reimplement the seven axes/CEFR/genre rules.
CREATE FUNCTION public.csat_source_is_eligible(p_article_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.csat_source_eligibility e
    JOIN public.library_articles a ON a.id = e.article_id
    WHERE e.article_id = p_article_id
      AND e.policy_version = 3
      AND e.source_updated_at = a.updated_at
      AND e.result->>'grade' IN ('usable','excerpt')
      AND e.result->'blockers' = '[]'::jsonb
      AND a.status IN ('ready','published')
      AND (e.result->>'grade' <> 'excerpt' OR EXISTS (
        SELECT 1 FROM public.csat_dcp_items i WHERE i.kind='article' AND i.ref_id=a.id
      ))
  );
$$;
REVOKE ALL ON FUNCTION public.csat_source_is_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.csat_source_is_eligible(uuid) TO authenticated, service_role;
