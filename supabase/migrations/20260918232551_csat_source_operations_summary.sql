-- supabase/migrations/20260918232551_csat_source_operations_summary.sql
-- One scan per summary request instead of fourteen concurrent full-view counts.
CREATE VIEW public.csat_source_operations_summary WITH (security_invoker = true) AS
WITH operations AS MATERIALIZED (
  SELECT cache_state, effective_status, can_use,
    result->>'analysisStatus' AS analysis_status,
    result->>'contentStatus' AS content_status,
    result->'blockers' AS blockers,
    cardinality(quality_flags) AS quality_count, linked_items, measured_at
  FROM public.csat_source_operations
)
SELECT jsonb_build_object(
  'all', count(*),
  'eligible', count(*) FILTER (WHERE effective_status='eligible'),
  'conditional', count(*) FILTER (WHERE effective_status='conditional'),
  'review', count(*) FILTER (WHERE effective_status='review'),
  'rejected', count(*) FILTER (WHERE effective_status='rejected'),
  'stale', count(*) FILTER (WHERE cache_state<>'current'),
  'unavailable', count(*) FILTER (WHERE NOT can_use),
  'analysis', count(*) FILTER (WHERE cache_state='current' AND analysis_status<>'complete'),
  'analyzed', count(*) FILTER (WHERE cache_state='current' AND analysis_status='complete'),
  'content', count(*) FILTER (WHERE cache_state='current' AND content_status='unjudged'),
  'cefr', count(*) FILTER (WHERE cache_state='current' AND blockers @> '["cefr_above_band"]'::jsonb),
  'excerpt', count(*) FILTER (WHERE cache_state='current' AND blockers @> '["excerpt_not_materialized"]'::jsonb),
  'quality', count(*) FILTER (WHERE cache_state='current' AND quality_count>0),
  'p0', count(*) FILTER (WHERE cache_state='current' AND blockers @> '["content_rejected"]'::jsonb AND linked_items>0)
) AS counts,
min(measured_at) FILTER (WHERE cache_state='current') AS measured_at,
3 AS policy_version
FROM operations;
REVOKE ALL ON public.csat_source_operations_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.csat_source_operations_summary TO service_role;
