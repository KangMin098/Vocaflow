-- scripts/textbook/atomic-production-race-cleanup.sql
-- Replace __GROUP_ID__ with the exact atomic-race UUID group ID. Synthetic fixture only.
BEGIN;
DO $cleanup$
DECLARE
  v_group public.reading_production_group%ROWTYPE;
  v_section jsonb; v_child public.library_articles%ROWTYPE;
  v_source public.library_articles%ROWTYPE;
  v_audit uuid; v_item uuid; v_order text; v_trust text;
BEGIN
  SELECT * INTO STRICT v_group FROM public.reading_production_group
    WHERE group_id='__GROUP_ID__' FOR UPDATE;
  IF v_group.group_id !~ '^atomic-race:[a-f0-9-]{36}$' OR
     jsonb_array_length(v_group.sections) <> 1 THEN
    RAISE EXCEPTION 'cleanup group does not match isolated fixture';
  END IF;
  v_section := v_group.sections->0;
  v_audit := (v_section->>'audit_id')::uuid;
  v_item := (v_section->'item_ids'->>0)::uuid;
  v_order := v_section->>'order_id';
  SELECT * INTO STRICT v_child FROM public.library_articles
    WHERE id=(v_section->>'article_id')::uuid FOR UPDATE;
  SELECT * INTO STRICT v_source FROM public.library_articles
    WHERE id=v_child.adapted_from_id FOR UPDATE;
  IF v_child.source_id NOT LIKE 'reading:atomic-smoke:%' OR
     v_source.source_id NOT LIKE 'atomic-smoke:%' OR
     v_order NOT LIKE 'atomic-smoke:%' OR
     (SELECT count(*) FROM public.reading_promotion_audit
       WHERE request_id=v_audit AND article_id=v_child.id AND source_id=v_source.id) <> 1 OR
     (SELECT count(*) FROM public.csat_dcp_items
       WHERE id=v_item AND ref_id=v_child.id) <> 1 THEN
    RAISE EXCEPTION 'cleanup ownership checks failed';
  END IF;
  v_trust := v_child.composed_spec #>> '{academic_reading,provenance,gold_s,trust_policy_hash}';
  DELETE FROM public.reading_production_artifact WHERE snapshot_id IN
    (SELECT snapshot_id FROM public.reading_production_snapshot WHERE group_id=v_group.group_id);
  DELETE FROM public.reading_production_snapshot WHERE group_id=v_group.group_id;
  DELETE FROM public.reading_production_group WHERE group_id=v_group.group_id;
  DELETE FROM public.csat_item_reviews WHERE item_id=v_item;
  DELETE FROM public.csat_item_state WHERE item_id=v_item;
  DELETE FROM public.csat_dcp_items WHERE id=v_item;
  DELETE FROM public.reading_promotion_permit WHERE request_id=v_audit;
  DELETE FROM public.reading_promotion_audit WHERE request_id=v_audit;
  DELETE FROM public.reading_product_order_revision WHERE order_id=v_order;
  DELETE FROM public.library_articles WHERE id=v_child.id;
  DELETE FROM public.library_articles WHERE id=v_source.id;
  DELETE FROM public.reading_promotion_authority
    WHERE singleton=true AND trust_policy_hash=v_trust AND benchmark_version='atomic-smoke-v1';
END $cleanup$;
COMMIT;
