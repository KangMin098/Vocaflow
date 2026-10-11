-- supabase/migrations/20261011022148_reading_production_volume.sql
-- Prepared for review. Do not apply without explicit migration approval.
-- A multi-day student volume = an ordered list of published atomic production snapshots
-- (one per day). The DB, not the caller, proves that every day is currently published, that
-- its evidence is still current, and that its group holds exactly the volume's orders at their
-- currently registered revision/hash. No existing table or function is changed.
BEGIN;

CREATE TABLE public.reading_production_volume (
  volume_id text PRIMARY KEY CHECK (length(btrim(volume_id)) BETWEEN 1 AND 128),
  volume_revision integer NOT NULL CHECK (volume_revision > 0),
  orders jsonb NOT NULL CHECK (jsonb_typeof(orders) = 'array' AND jsonb_array_length(orders) BETWEEN 1 AND 8),
  sections jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array' AND jsonb_array_length(sections) BETWEEN 1 AND 366),
  volume_hash text NOT NULL CHECK (volume_hash ~ '^[a-f0-9]{64}$'),
  registered_by uuid NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.reading_production_volume ENABLE ROW LEVEL SECURITY;
CREATE POLICY reading_production_volume_deny ON public.reading_production_volume AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.reading_production_volume FROM PUBLIC, anon, authenticated, service_role;

-- Internal: validates orders + day sections and returns the DB-derived section list.
-- Raises on any missing, stale, unpublished, reused, gapped or foreign section.
CREATE FUNCTION public._reading_production_volume_check(p_orders jsonb, p_sections jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_section jsonb; v_day integer := 0; v_out jsonb := '[]'::jsonb; v_expected jsonb; v_actual jsonb;
  v_snapshot public.reading_production_snapshot%ROWTYPE; v_artifact public.reading_production_artifact%ROWTYPE;
  v_group public.reading_production_group%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_orders) IS DISTINCT FROM 'array' OR jsonb_array_length(p_orders) NOT BETWEEN 1 AND 8 OR
     jsonb_typeof(p_sections) IS DISTINCT FROM 'array' OR jsonb_array_length(p_sections) NOT BETWEEN 1 AND 366 OR
     EXISTS (SELECT 1 FROM jsonb_array_elements(p_orders) AS o(v) WHERE jsonb_typeof(o.v) <> 'object' OR
       (o.v ?& ARRAY['grade','order_id','order_revision','order_hash']) IS NOT TRUE) OR
     (SELECT count(DISTINCT o.v->>'order_id') FROM jsonb_array_elements(p_orders) AS o(v)) <> jsonb_array_length(p_orders) OR
     (SELECT count(DISTINCT o.v->>'grade') FROM jsonb_array_elements(p_orders) AS o(v)) <> jsonb_array_length(p_orders) THEN
    RAISE EXCEPTION 'volume orders invalid' USING ERRCODE = 'check_violation';
  END IF;
  -- Every order must be the currently registered revision/hash.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_orders) AS o(v)
      LEFT JOIN public.reading_product_order_revision r ON r.order_id = o.v->>'order_id'
      WHERE r.order_id IS NULL OR r.order_revision::text IS DISTINCT FROM o.v->>'order_revision' OR
        r.order_hash IS DISTINCT FROM o.v->>'order_hash') THEN
    RAISE EXCEPTION 'volume order missing or stale' USING ERRCODE = 'check_violation';
  END IF;
  v_expected := (SELECT jsonb_agg(jsonb_build_object('grade', o.v->>'grade', 'order_id', o.v->>'order_id',
      'order_revision', o.v->>'order_revision', 'order_hash', o.v->>'order_hash') ORDER BY o.v->>'order_id')
    FROM jsonb_array_elements(p_orders) AS o(v));
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_sections) AS s(v) WHERE jsonb_typeof(s.v) <> 'object' OR
       (s.v ?& ARRAY['day','snapshot_id']) IS NOT TRUE OR
       (s.v->>'snapshot_id') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR
       (s.v->>'day') !~ '^[1-9][0-9]{0,2}$') OR
     (SELECT count(DISTINCT s.v->>'snapshot_id') FROM jsonb_array_elements(p_sections) AS s(v)) <> jsonb_array_length(p_sections) THEN
    RAISE EXCEPTION 'volume sections invalid or snapshot reused' USING ERRCODE = 'check_violation';
  END IF;
  FOR v_section IN SELECT s.v FROM jsonb_array_elements(p_sections) AS s(v) ORDER BY (s.v->>'day')::integer LOOP
    v_day := v_day + 1;
    IF (v_section->>'day')::integer <> v_day THEN
      RAISE EXCEPTION 'volume day gap or duplicate' USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO v_snapshot FROM public.reading_production_snapshot
      WHERE snapshot_id = (v_section->>'snapshot_id')::uuid FOR SHARE;
    SELECT * INTO v_artifact FROM public.reading_production_artifact WHERE snapshot_id = v_snapshot.snapshot_id FOR SHARE;
    SELECT * INTO v_group FROM public.reading_production_group WHERE group_id = v_snapshot.group_id FOR SHARE;
    IF v_snapshot.snapshot_id IS NULL OR v_artifact.snapshot_id IS NULL OR v_group.group_id IS NULL OR
       v_group.approved_snapshot_id IS DISTINCT FROM v_snapshot.snapshot_id OR
       v_snapshot.group_revision IS DISTINCT FROM v_group.group_revision OR
       v_snapshot.output_hash IS DISTINCT FROM v_artifact.output_hash OR
       encode(extensions.digest(convert_to(v_artifact.html, 'UTF8'), 'sha256'), 'hex') IS DISTINCT FROM v_artifact.output_hash THEN
      RAISE EXCEPTION 'volume section not published current' USING ERRCODE = 'check_violation';
    END IF;
    IF public._reading_production_evidence(v_group.group_id) IS DISTINCT FROM v_snapshot.evidence THEN
      RAISE EXCEPTION 'volume section evidence changed' USING ERRCODE = 'check_violation';
    END IF;
    -- The group must hold exactly the volume's orders (grade, ID, revision, hash of the sealed order).
    v_actual := (SELECT jsonb_agg(jsonb_build_object('grade', o.v->>'grade',
        'order_id', o.v #>> '{order,product_order_id}', 'order_revision', o.v #>> '{order,order_revision}',
        'order_hash', public._reading_json_hash(o.v->'order')) ORDER BY o.v #>> '{order,product_order_id}')
      FROM jsonb_array_elements(v_group.group_document->'orders') AS o(v));
    IF v_actual IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'volume section belongs to different orders' USING ERRCODE = 'check_violation';
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('day', v_day, 'snapshot_id', v_snapshot.snapshot_id,
      'snapshot_hash', v_snapshot.evidence_hash, 'output_hash', v_artifact.output_hash,
      'group_id', v_group.group_id, 'group_revision', v_group.group_revision));
  END LOOP;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public._reading_production_volume_check(jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- An active administrator registers a volume revision; only a strictly newer revision replaces it.
CREATE FUNCTION public.register_reading_production_volume(p_volume_id text, p_volume_revision integer,
  p_orders jsonb, p_sections jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_checked jsonb; v_hash text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'authenticated' OR
     auth.uid() IS NULL OR public.is_admin() IS DISTINCT FROM true OR
     NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_volume_id IS NULL OR length(btrim(p_volume_id)) NOT BETWEEN 1 AND 128 OR p_volume_revision IS NULL OR p_volume_revision < 1 THEN
    RAISE EXCEPTION 'volume identity invalid' USING ERRCODE = 'check_violation';
  END IF;
  v_checked := public._reading_production_volume_check(p_orders, p_sections);
  v_hash := public._reading_json_hash(jsonb_build_object('volume_id', p_volume_id, 'volume_revision', p_volume_revision,
    'orders', p_orders, 'sections', v_checked));
  INSERT INTO public.reading_production_volume(volume_id, volume_revision, orders, sections, volume_hash, registered_by)
    VALUES (p_volume_id, p_volume_revision, p_orders, v_checked, v_hash, auth.uid())
    ON CONFLICT (volume_id) DO UPDATE SET volume_revision = EXCLUDED.volume_revision, orders = EXCLUDED.orders,
      sections = EXCLUDED.sections, volume_hash = EXCLUDED.volume_hash, registered_by = EXCLUDED.registered_by,
      registered_at = clock_timestamp()
    WHERE public.reading_production_volume.volume_revision < EXCLUDED.volume_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'volume revision replay or downgrade' USING ERRCODE = 'check_violation'; END IF;
  RETURN jsonb_build_object('volume_id', p_volume_id, 'volume_revision', p_volume_revision,
    'volume_hash', v_hash, 'sections', v_checked);
END $$;
REVOKE ALL ON FUNCTION public.register_reading_production_volume(text, integer, jsonb, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_reading_production_volume(text, integer, jsonb, jsonb) TO authenticated;

-- Serving re-runs the whole check now; any day that stopped being current fails the volume.
CREATE FUNCTION public.serve_reading_production_volume(p_volume_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_volume public.reading_production_volume%ROWTYPE; v_checked jsonb; v_html text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_volume FROM public.reading_production_volume WHERE volume_id = p_volume_id FOR SHARE;
  IF v_volume.volume_id IS NULL THEN
    RAISE EXCEPTION 'volume not registered' USING ERRCODE = 'check_violation';
  END IF;
  v_checked := public._reading_production_volume_check(v_volume.orders, v_volume.sections);
  IF v_checked IS DISTINCT FROM v_volume.sections THEN
    RAISE EXCEPTION 'volume sections changed since registration' USING ERRCODE = 'check_violation';
  END IF;
  SELECT string_agg('<!-- day ' || (s.v->>'day') || ' snapshot ' || (s.v->>'snapshot_id') || ' -->' || chr(10) || a.html,
      chr(10) ORDER BY (s.v->>'day')::integer)
    INTO v_html
    FROM jsonb_array_elements(v_checked) AS s(v)
    JOIN public.reading_production_artifact a ON a.snapshot_id = (s.v->>'snapshot_id')::uuid;
  v_html := '<!-- ATOMIC SNAPSHOT VOLUME; DB VERIFIED; NON-PRODUCTION UNTIL OPERATIONAL VERIFICATION -->' || chr(10) || v_html;
  RETURN jsonb_build_object('volume_id', v_volume.volume_id, 'volume_revision', v_volume.volume_revision,
    'volume_hash', v_volume.volume_hash, 'sections', v_checked, 'html', v_html,
    'output_hash', encode(extensions.digest(convert_to(v_html, 'UTF8'), 'sha256'), 'hex'));
END $$;
REVOKE ALL ON FUNCTION public.serve_reading_production_volume(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.serve_reading_production_volume(text) TO service_role;

COMMIT;
