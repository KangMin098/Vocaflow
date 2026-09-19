-- supabase/migrations/20260919023610_acp_atomic_analysis.sql
-- Approval required before application. No source body, answer, or publication changes.
-- The caller first claims queued -> analyzing with an exact updated_at predicate.
CREATE OR REPLACE FUNCTION public.commit_article_analysis(
  p_article_id uuid,
  p_claimed_revision timestamptz,
  p_source_content text,
  p_analysis jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_article public.library_articles%ROWTYPE;
  v_word_count integer;
  v_revision timestamptz;
BEGIN
  -- Read-only deployment probe, run before claiming any queue row.
  IF p_article_id IS NULL AND p_claimed_revision IS NULL
     AND p_source_content IS NULL AND p_analysis IS NULL THEN
    RETURN jsonb_build_object('version', 1);
  END IF;
  IF p_article_id IS NULL OR p_claimed_revision IS NULL OR p_source_content IS NULL
     OR p_analysis IS NULL THEN
    RAISE EXCEPTION 'Missing claimed article analysis input' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_article FROM public.library_articles WHERE id = p_article_id FOR UPDATE;
  IF NOT FOUND OR v_article.status <> 'analyzing'
     OR v_article.updated_at IS DISTINCT FROM p_claimed_revision
     OR v_article.content IS DISTINCT FROM p_source_content THEN
    RAISE EXCEPTION 'Article claim lost or source revision changed' USING ERRCODE = '40001';
  END IF;
  IF NOT coalesce((v_article.compose_batch_id IS NULL OR
    (v_article.source = 'original' AND v_article.feed_id = 'compose-drain'
      AND v_article.composed_spec->>'kind' = 'csat-slot-fill')), false) THEN
    RAISE EXCEPTION 'Article belongs to another compose pipeline' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_analysis) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_analysis->'words') IS DISTINCT FROM 'array'
     OR NOT (p_analysis ?& ARRAY['cefr_level','cefr_confidence','word_count',
       'reading_minutes','llm_cost_usd','register','lexical_noise','content_hash']) THEN
    RAISE EXCEPTION 'Incomplete analysis payload' USING ERRCODE = '22023';
  END IF;
  v_word_count := (p_analysis->>'word_count')::integer;
  IF v_word_count IS NULL OR v_word_count < 1
     OR jsonb_array_length(p_analysis->'words') < 1
     OR p_analysis->>'cefr_level' IS NULL
     OR p_analysis->>'cefr_level' NOT IN ('A1','A2','B1','B2','C1','C2')
     OR p_analysis->>'content_hash' IS NULL
     OR p_analysis->>'content_hash' !~ '^[a-f0-9]{64}$'
     OR p_analysis->>'cefr_confidence' IS NULL
     OR p_analysis->>'reading_minutes' IS NULL
     OR p_analysis->>'llm_cost_usd' IS NULL
     OR p_analysis->>'lexical_noise' IS NULL
     OR (p_analysis->>'cefr_confidence')::real NOT BETWEEN 0 AND 1
     OR (p_analysis->>'reading_minutes')::integer < 1
     OR (p_analysis->>'llm_cost_usd')::numeric < 0
     OR (p_analysis->>'lexical_noise')::numeric NOT BETWEEN 0 AND 1 THEN
    RAISE EXCEPTION 'Invalid analysis values' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_analysis->'words') AS w(
      word text, frequency_in_article integer, base_learning_value double precision
    ) WHERE w.word IS NULL OR btrim(w.word) = '' OR w.frequency_in_article IS NULL
      OR w.frequency_in_article < 1 OR w.base_learning_value IS NULL
      OR w.base_learning_value < 0 OR w.base_learning_value = 'NaN'::float8
  ) THEN
    RAISE EXCEPTION 'Invalid vocabulary payload' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.library_article_vocabularies WHERE library_article_id = p_article_id;
  INSERT INTO public.library_article_vocabularies (
    library_article_id, word, frequency_in_article, first_sentence, base_learning_value, context_pos
  ) SELECT p_article_id, word, frequency_in_article, first_sentence, base_learning_value, context_pos
    FROM jsonb_to_recordset(p_analysis->'words') AS w(
      word text, frequency_in_article integer, first_sentence text,
      base_learning_value double precision, context_pos text
    );

  -- Clear old values: compute_article_vrl returns early when no dictionary level
  -- matches. Such a row must not inherit a former body's reading level.
  UPDATE public.library_articles SET article_v_level = NULL, vrl_components = NULL,
    vrl_calculated_at = NULL, syntax_score = NULL WHERE id = p_article_id;
  PERFORM public.compute_article_vrl(p_article_id);
  PERFORM public.compute_article_syntax(p_article_id);
  IF EXISTS (SELECT 1 FROM public.library_articles WHERE id = p_article_id
    AND (article_v_level IS NULL OR syntax_score IS NULL)) THEN
    RAISE EXCEPTION 'VRL or syntax analysis incomplete' USING ERRCODE = '22023';
  END IF;

  UPDATE public.library_articles SET
    cefr_level = p_analysis->>'cefr_level',
    cefr_confidence = (p_analysis->>'cefr_confidence')::real,
    word_count = v_word_count,
    reading_minutes = (p_analysis->>'reading_minutes')::integer,
    llm_cost_usd = (p_analysis->>'llm_cost_usd')::numeric,
    register = p_analysis->>'register',
    lexical_noise = (p_analysis->>'lexical_noise')::numeric,
    content_hash = p_analysis->>'content_hash',
    status_message = p_analysis->>'status_message', status = 'ready'
  WHERE id = p_article_id RETURNING updated_at INTO v_revision;
  RETURN jsonb_build_object('committed', true, 'article_id', p_article_id, 'updated_at', v_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_article_analysis(uuid,timestamptz,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_article_analysis(uuid,timestamptz,text,jsonb) TO service_role;
COMMENT ON FUNCTION public.commit_article_analysis(uuid,timestamptz,text,jsonb) IS
  'ACP queue only: exact claimed revision + body under row lock; vocabulary, VRL, syntax and ready commit or roll back together. All-null arguments probe version without writes.';
