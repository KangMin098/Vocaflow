-- supabase/migrations/20261009193000_reading_order_production_trace.sql
-- Read-only, service-role-only observation. This is not an authorization gate.
BEGIN;

CREATE FUNCTION public.read_reading_order_production_trace(p_order_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_group public.reading_production_group%ROWTYPE;
  v_snapshot public.reading_production_snapshot%ROWTYPE;
  v_artifact public.reading_production_artifact%ROWTYPE;
  v_current jsonb;
  v_status text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_order_id IS NULL OR length(btrim(p_order_id)) = 0 OR length(p_order_id) > 128 THEN
    RAISE EXCEPTION 'invalid product order ID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT g.* INTO v_group FROM public.reading_production_group g
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(g.sections) AS s(value)
      WHERE s.value->>'order_id' = p_order_id)
    ORDER BY g.registered_at DESC, g.group_revision DESC, g.group_id DESC LIMIT 1;
  IF v_group.group_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_registered');
  END IF;

  SELECT s.* INTO v_snapshot FROM public.reading_production_snapshot s
    WHERE s.group_id = v_group.group_id AND s.group_revision = v_group.group_revision
    ORDER BY s.captured_at DESC, s.snapshot_id DESC LIMIT 1;
  IF v_snapshot.snapshot_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_group.sections) WITH ORDINALITY AS section(value, ordinal)
      LEFT JOIN public.reading_product_order_revision o ON o.order_id = section.value->>'order_id'
      WHERE o.order_id IS NULL OR
        v_group.group_document #>> ARRAY['orders', (section.ordinal - 1)::text, 'order', 'order_revision']
          IS DISTINCT FROM o.order_revision::text OR
        public._reading_json_hash(v_group.group_document #> ARRAY['orders', (section.ordinal - 1)::text, 'order'])
          IS DISTINCT FROM o.order_hash
    ) THEN
      RETURN jsonb_build_object('status', 'registered_stale',
        'group_id', v_group.group_id, 'group_revision', v_group.group_revision);
    END IF;
    RETURN jsonb_build_object('status', 'registered_unverified',
      'group_id', v_group.group_id, 'group_revision', v_group.group_revision);
  END IF;

  -- A past snapshot is never presented as current merely because its row exists.
  IF v_snapshot.expires_at <= clock_timestamp() OR
     v_snapshot.evidence_hash IS DISTINCT FROM
       encode(extensions.digest(convert_to(v_snapshot.evidence::text, 'UTF8'), 'sha256'), 'hex') THEN
    v_status := 'stale';
  ELSE
    BEGIN
      v_current := public._reading_production_evidence(v_group.group_id);
      v_status := CASE WHEN v_current IS NOT DISTINCT FROM v_snapshot.evidence
        THEN 'captured_current' ELSE 'stale' END;
    EXCEPTION WHEN others THEN
      v_status := 'unmeasured';
    END;
  END IF;

  IF v_status = 'captured_current' AND v_snapshot.finalized_at IS NOT NULL THEN
    v_status := 'rendered_current';
  END IF;
  SELECT a.* INTO v_artifact FROM public.reading_production_artifact a
    WHERE a.snapshot_id = v_snapshot.snapshot_id;
  IF v_artifact.snapshot_id IS NOT NULL THEN
    IF v_group.approved_snapshot_id IS DISTINCT FROM v_snapshot.snapshot_id OR
       v_snapshot.output_hash IS DISTINCT FROM v_artifact.output_hash OR
       v_artifact.output_hash IS DISTINCT FROM
         encode(extensions.digest(convert_to(v_artifact.html, 'UTF8'), 'sha256'), 'hex') THEN
      v_status := 'stale';
    ELSIF v_status = 'rendered_current' THEN
      v_status := 'published_current';
    END IF;
  END IF;
  RETURN jsonb_build_object('status', v_status,
    'group_id', v_group.group_id, 'group_revision', v_group.group_revision,
    'snapshot_id', v_snapshot.snapshot_id, 'snapshot_hash', v_snapshot.evidence_hash,
    'output_hash', v_snapshot.output_hash);
END $$;

REVOKE ALL ON FUNCTION public.read_reading_order_production_trace(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_reading_order_production_trace(text) TO service_role;
COMMIT;
