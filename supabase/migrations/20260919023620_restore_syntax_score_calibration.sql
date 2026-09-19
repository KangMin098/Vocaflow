-- supabase/migrations/20260919023620_restore_syntax_score_calibration.sql
-- Approval required. Restore the checked-in 20260712120000 calibration only.
-- 2026-09-19 read-only probes found the live function still uses sent*2 + clauses*6.
-- Preserve the current search_path, signature and volatility. No article/book/cache
-- backfill occurs here; historical stored scores require a separately reviewed plan.

CREATE OR REPLACE FUNCTION public.compute_syntax_score(p_content text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  WITH sents AS (
    SELECT trim(s) AS s
    FROM regexp_split_to_table(coalesce(p_content, ''), '[.!?]+[\s"]') AS s
    WHERE length(trim(s)) > 2
  ),
  m AS (
    SELECT
      array_length(regexp_split_to_array(s, '\s+'), 1) AS wlen,
      (length(s) - length(regexp_replace(s, '[,;]', '', 'g')))
      + (SELECT count(*) FROM regexp_matches(lower(s),
           '\y(that|which|who|whom|whose|because|although|though|while|whereas|if|when|since|unless|before|after|as)\y', 'g')) AS clauses
    FROM sents
  )
  SELECT CASE WHEN (SELECT count(*) FROM m) = 0 THEN NULL
  ELSE jsonb_build_object(
    'sent_p90', coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY wlen) FROM m), 0)::int,
    'clause_depth_p90', round(coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY clauses) FROM m), 0)::numeric, 1),
    'score', GREATEST(0, LEAST(100, round(
        (coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY wlen) FROM m), 0) - 10) * 0.75
      + (coalesce((SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY clauses) FROM m), 0) - 1) * 5.0
    )))::int
  ) END
$function$;

COMMENT ON FUNCTION public.compute_syntax_score(text) IS
  'CTP syntax score v2 calibration restored. Existing stored scores are not backfilled by this migration.';
