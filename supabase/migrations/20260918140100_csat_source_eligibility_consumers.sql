-- supabase/migrations/20260918140100_csat_source_eligibility_consumers.sql
-- Phase 2: apply only after cache seed and before/after impact comparison.
-- Existing source data, answers and attempts are preserved.

CREATE OR REPLACE FUNCTION public.textbook_practice_items(p_v_level smallint, p_limit integer DEFAULT 10)
 RETURNS TABLE(id uuid, type text, paragraph_idx integer, payload jsonb, ref_title text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.id, i.type, i.paragraph_idx, i.payload, a.title
  FROM csat_dcp_items i
  JOIN library_articles a ON a.id = i.ref_id
  WHERE i.kind = 'article'
    AND i.type IN ('order','insert',
                   'topic','blank','main_point','title','summary',
                   'purpose','implication','content_match','claim','mood',
                   'long_order','long_reference','long_match',
                   'long_title','long_vocab')
    AND i.v_level = p_v_level
    AND a.status IN ('ready','published')
    AND a.display_only = false
    AND public.csat_source_is_eligible(a.id)
    AND NOT EXISTS (
      SELECT 1 FROM csat_item_attempts t
      WHERE t.dcp_item_id = i.id AND t.user_id = auth.uid()
    )
  ORDER BY i.id
  LIMIT greatest(1, least(p_limit, 50));
$function$;

CREATE OR REPLACE FUNCTION public.prescribe_today(p_user_id uuid, p_v_levels integer[] DEFAULT NULL::integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage text; v_num int; v_band text; v_due int;
  v_input jsonb; v_practice jsonb; v_active boolean;
  v_steered boolean := false;
BEGIN
  IF auth.uid() IS NULL OR (p_user_id <> auth.uid() AND NOT public.is_admin_or_curator()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_stage := public.derive_learner_stage(p_user_id);
  v_num := substring(v_stage FROM 2)::int;
  v_band := 'S' || LEAST(v_num, 4);
  v_active := v_num >= 3;

  SELECT count(*) INTO v_due FROM vocabularies WHERE user_id=p_user_id AND next_review_at <= now();

  SELECT jsonb_agg(c) INTO v_input FROM (
    SELECT kind, id, title, v_level, register, cefr_level FROM csat_stage_catalog
    WHERE stage_band = v_band ORDER BY v_level ASC NULLS LAST, title LIMIT 5) c;

  IF v_active THEN
    IF p_v_levels IS NOT NULL AND array_length(p_v_levels, 1) > 0 THEN
      SELECT jsonb_agg(p) INTO v_practice FROM (
        SELECT i.id, i.type, i.paragraph_idx, i.payload FROM csat_dcp_items i
        JOIN csat_stage_catalog c ON c.id=i.ref_id AND c.kind=i.kind
        WHERE substring(c.stage_band FROM 2)::int <= LEAST(v_num, 4)
          AND i.type IN ('order', 'insert')
          AND (i.kind <> 'article' OR public.csat_source_is_eligible(i.ref_id))
          AND i.v_level = ANY(p_v_levels)
        ORDER BY md5(i.id::text || current_date::text) LIMIT 5) p;
      v_steered := v_practice IS NOT NULL AND jsonb_array_length(v_practice) > 0;
    END IF;

    IF NOT v_steered THEN
      SELECT jsonb_agg(p) INTO v_practice FROM (
        SELECT i.id, i.type, i.paragraph_idx, i.payload FROM csat_dcp_items i
        JOIN csat_stage_catalog c ON c.id=i.ref_id AND c.kind=i.kind
        WHERE substring(c.stage_band FROM 2)::int <= LEAST(v_num, 4)
          AND i.type IN ('order', 'insert')
          AND (i.kind <> 'article' OR public.csat_source_is_eligible(i.ref_id))
        ORDER BY md5(i.id::text || current_date::text) LIMIT 5) p;
    END IF;
  END IF;
  v_active := v_active AND v_practice IS NOT NULL AND jsonb_array_length(v_practice) > 0;

  RETURN jsonb_build_object(
    'stage', v_stage,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','fsrs_due','minutes',10,'due_count',v_due),
      jsonb_build_object('kind','listening','minutes',10,'module','echomatch'),
      jsonb_build_object('kind','input','minutes',30,'stage_band',v_band,'candidates',coalesce(v_input,'[]'::jsonb)),
      jsonb_build_object('kind','practice','minutes',CASE WHEN v_active THEN 15 ELSE 0 END,
                         'active',v_active,'steered',v_steered,'items',coalesce(v_practice,'[]'::jsonb)),
      jsonb_build_object('kind','verify','minutes',10,'module','scriptquiz')),
    'total_minutes', CASE WHEN v_active THEN 75 ELSE 60 END);
END $function$;

CREATE OR REPLACE FUNCTION public.grade_dcp_item(p_item_id uuid, p_answer jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE it record; v_correct boolean; v_uid uuid := auth.uid(); v_attempt_id uuid; v_choice int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT type, answer_key, ref_id, kind INTO it FROM csat_dcp_items WHERE id=p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF it.kind = 'article' AND NOT public.csat_source_is_eligible(it.ref_id) THEN
    RAISE EXCEPTION 'Source is unavailable for practice';
  END IF;

  IF it.type='insert' THEN
    v_correct := (p_answer->>'position')::int = (it.answer_key->>'position')::int;
  ELSIF it.type='order' THEN
    WITH la AS (SELECT (value)::int AS pidx, (ordinality-1) AS pos FROM jsonb_array_elements_text(p_answer->'order') WITH ORDINALITY),
         so AS (SELECT (value)::int AS orig, (ordinality-1) AS j    FROM jsonb_array_elements_text(it.answer_key->'source_order') WITH ORDINALITY)
    SELECT bool_and(so.orig = la.pos) INTO v_correct FROM la JOIN so ON so.j = la.pidx;
    v_correct := coalesce(v_correct, false);
  ELSIF it.type = ANY (ARRAY['topic','blank','main_point','title','summary',
                             'purpose','implication','content_match','claim','mood',
                             'long_order','long_reference','long_match',
                             'long_title','long_vocab']) THEN
    IF (p_answer->>'choice') !~ '^[1-5]$' THEN RAISE EXCEPTION 'Bad choice'; END IF;
    v_choice := (p_answer->>'choice')::int;
    v_correct := v_choice = (it.answer_key->>'answer')::int;
  ELSE RAISE EXCEPTION 'Unknown type'; END IF;

  INSERT INTO csat_item_attempts (user_id, dcp_item_id, text_id, is_correct, item_role)
  VALUES (v_uid, p_item_id, it.ref_id, v_correct, 'practice')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('correct', v_correct, 'attempt_id', v_attempt_id,
    'answer_key', CASE WHEN v_correct
      THEN jsonb_strip_nulls(jsonb_build_object(
             'explanation_ko',     it.answer_key->>'explanation_ko',
             'explanation_writer', it.answer_key->>'explanation_writer',
             'rationale_ko',       it.answer_key->>'rationale_ko'))
      ELSE it.answer_key END);
END $function$;
