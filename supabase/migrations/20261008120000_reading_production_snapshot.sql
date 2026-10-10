-- supabase/migrations/20261008120000_reading_production_snapshot.sql
-- Prepared for review. Do not apply without explicit migration approval.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Matches the application's recursive sorted-key JSON serializer for the
-- signed Gold-S bundle and current item digest. Numeric inputs are ordinary
-- finite JSON numbers; unsupported exponent/precision forms fail closed.
CREATE FUNCTION public._reading_canonical_json(p_value jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_result text; v_numeric numeric;
BEGIN
  CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_value) AS k(key_name)
          WHERE octet_length(k.key_name) <> length(k.key_name)) THEN
        RAISE EXCEPTION 'non-ASCII JSON key cannot be canonically verified' USING ERRCODE = 'check_violation';
      END IF;
      SELECT '{' || COALESCE(string_agg(to_jsonb(key)::text || ':' ||
        public._reading_canonical_json(value),',' ORDER BY
          CASE WHEN key ~ '^(0|[1-9][0-9]*)$' AND
            (length(key) < 10 OR (length(key)=10 AND key < '4294967295')) THEN 0 ELSE 1 END,
          CASE WHEN key ~ '^(0|[1-9][0-9]*)$' AND
            (length(key) < 10 OR (length(key)=10 AND key < '4294967295')) THEN key::numeric END,
          key COLLATE "C"),'') || '}' INTO v_result
        FROM jsonb_each(p_value);
      RETURN v_result;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(string_agg(public._reading_canonical_json(value),',' ORDER BY ordinality),'') || ']'
        INTO v_result FROM jsonb_array_elements(p_value) WITH ORDINALITY;
      RETURN v_result;
    WHEN 'number' THEN
      v_numeric := p_value::text::numeric;
      IF abs(v_numeric) >= 100000000000000000000 OR
         (v_numeric <> 0 AND abs(v_numeric) < 0.000001) THEN
        RAISE EXCEPTION 'unsupported signed JSON numeric form' USING ERRCODE = 'check_violation';
      END IF;
      RETURN trim_scale(v_numeric)::text;
    ELSE RETURN p_value::text;
  END CASE;
END $$;
REVOKE ALL ON FUNCTION public._reading_canonical_json(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public._reading_json_hash(p_value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT encode(extensions.digest(convert_to(public._reading_canonical_json(p_value),'UTF8'),'sha256'),'hex')
$$;
REVOKE ALL ON FUNCTION public._reading_json_hash(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public._reading_target_key(p_target jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_resources jsonb;
BEGIN
  IF jsonb_typeof(p_target) IS DISTINCT FROM 'object' OR
     jsonb_typeof(p_target->'resources') IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',value->>'kind',
    'canonical_source',value->>'canonical_source','canonical_url',value->>'canonical_url',
    'content_hash',encode(extensions.digest(convert_to(value->>'content','UTF8'),'sha256'),'hex'))
    ORDER BY ordinality),'[]'::jsonb) INTO v_resources
    FROM jsonb_array_elements(p_target->'resources') WITH ORDINALITY;
  RETURN substr(public._reading_json_hash(jsonb_build_object('version',1,
    'target',jsonb_set(p_target,'{resources}',v_resources))),1,24);
END $$;
REVOKE ALL ON FUNCTION public._reading_target_key(jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public._reading_verify_ed25519(p_record jsonb,p_public_key text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_der bytea; v_signature bytea; v_body_hash text;
BEGIN
  IF p_record IS NULL OR p_public_key IS NULL OR p_record->>'signature' IS NULL THEN RETURN false; END IF;
  IF p_record->>'signature' !~ '^[A-Za-z0-9+/]+={0,2}$' THEN RETURN false; END IF;
  v_der := decode(btrim(replace(replace(replace(replace(p_public_key,
    '-----BEGIN PUBLIC KEY-----',''),'-----END PUBLIC KEY-----',''),E'\n',''),E'\r','')),'base64');
  IF length(v_der) <> 44 OR substring(v_der FROM 1 FOR 12) <> decode('302a300506032b6570032100','hex') THEN
    RETURN false;
  END IF;
  v_signature := decode(p_record->>'signature','base64');
  IF length(v_signature) <> 64 OR
     regexp_replace(encode(v_signature,'base64'),'[[:space:]]','','g') IS DISTINCT FROM p_record->>'signature' THEN
    RETURN false;
  END IF;
  v_body_hash := public._reading_json_hash(p_record - 'signature');
  RETURN pgsodium.crypto_sign_verify_detached(v_signature,convert_to(v_body_hash,'UTF8'),
    substring(v_der FROM 13 FOR 32));
EXCEPTION WHEN others THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION public._reading_verify_ed25519(jsonb,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.reading_production_group (
  group_id text PRIMARY KEY CHECK (length(btrim(group_id)) > 0),
  group_revision integer NOT NULL CHECK (group_revision > 0),
  sections jsonb NOT NULL CHECK (jsonb_typeof(sections) = 'array' AND jsonb_array_length(sections) BETWEEN 1 AND 8),
  group_document jsonb NOT NULL CHECK (jsonb_typeof(group_document) = 'object'),
  evidence_document jsonb NOT NULL CHECK (jsonb_typeof(evidence_document) = 'object'),
  approved_output_hash text CHECK (approved_output_hash IS NULL OR approved_output_hash ~ '^[a-f0-9]{64}$'),
  approved_evidence_hash text CHECK (approved_evidence_hash IS NULL OR approved_evidence_hash ~ '^[a-f0-9]{64}$'),
  approved_snapshot_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  registered_by uuid NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.reading_production_snapshot (
  snapshot_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL REFERENCES public.reading_production_group(group_id),
  group_revision integer NOT NULL,
  evidence jsonb NOT NULL,
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  output_hash text CHECK (output_hash IS NULL OR output_hash ~ '^[a-f0-9]{64}$'),
  finalized_at timestamptz,
  CHECK ((output_hash IS NULL) = (finalized_at IS NULL))
);
CREATE TABLE public.reading_production_artifact (
  snapshot_id uuid PRIMARY KEY REFERENCES public.reading_production_snapshot(snapshot_id),
  output_hash text NOT NULL CHECK (output_hash ~ '^[a-f0-9]{64}$'),
  html text NOT NULL CHECK (length(html) BETWEEN 1 AND 5000000),
  published_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX reading_production_snapshot_group_idx ON public.reading_production_snapshot(group_id, captured_at DESC);
ALTER TABLE public.reading_production_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_production_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_production_artifact ENABLE ROW LEVEL SECURITY;
CREATE POLICY reading_production_group_deny ON public.reading_production_group AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY reading_production_snapshot_deny ON public.reading_production_snapshot AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY reading_production_artifact_deny ON public.reading_production_artifact AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.reading_production_group, public.reading_production_snapshot,
  public.reading_production_artifact FROM PUBLIC, anon, authenticated, service_role;

-- The group is the DB-owned selection of grade/order/article/item IDs. A revision
-- can be replaced only by a strictly newer revision; old snapshots then stale.
CREATE FUNCTION public.register_reading_production_group(p_group_id text, p_group_revision integer,
  p_sections jsonb, p_group_document jsonb, p_evidence_document jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_section jsonb; v_item text; v_order public.reading_product_order_revision%ROWTYPE;
  v_index integer := 0; v_band text; v_target jsonb;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'authenticated' OR
     auth.uid() IS NULL OR public.is_admin() IS DISTINCT FROM true OR
     NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id=auth.uid() AND status='active') THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_group_id IS NULL OR length(btrim(p_group_id)) = 0 OR p_group_revision < 1 OR
     jsonb_typeof(p_group_document) IS DISTINCT FROM 'object' OR
     jsonb_typeof(p_evidence_document) IS DISTINCT FROM 'object' OR
     p_group_document->>'group_id' IS DISTINCT FROM p_group_id OR
     p_evidence_document->>'group_id' IS DISTINCT FROM p_group_id OR
     p_evidence_document->>'group_hash' IS DISTINCT FROM public._reading_json_hash(p_group_document) OR
     p_group_document->>'group_revision' IS DISTINCT FROM p_group_revision::text OR
     p_evidence_document->>'group_revision' IS DISTINCT FROM p_group_revision::text OR
     jsonb_typeof(p_group_document->'orders') IS DISTINCT FROM 'array' OR
     jsonb_typeof(p_evidence_document->'variants') IS DISTINCT FROM 'array' OR
     jsonb_array_length(p_group_document->'orders') IS DISTINCT FROM jsonb_array_length(p_sections) OR
     jsonb_array_length(p_evidence_document->'variants') IS DISTINCT FROM jsonb_array_length(p_sections) OR
     jsonb_typeof(p_sections) IS DISTINCT FROM 'array' OR jsonb_array_length(p_sections) NOT BETWEEN 1 AND 8 OR
     (SELECT count(*) FROM jsonb_array_elements(p_sections) AS s(section) WHERE jsonb_typeof(s.section) <> 'object' OR
       (SELECT count(*) FROM jsonb_object_keys(s.section)) <> 5 OR
       (s.section ?& ARRAY['grade','order_id','article_id','audit_id','item_ids']) IS NOT TRUE OR
       jsonb_typeof(s.section->'item_ids') <> 'array' OR
       jsonb_array_length(s.section->'item_ids') NOT BETWEEN 1 AND 200) > 0 OR
     (SELECT count(DISTINCT s.section->>'grade') FROM jsonb_array_elements(p_sections) AS s(section)) <> jsonb_array_length(p_sections) OR
     (SELECT count(DISTINCT s.section->>'order_id') FROM jsonb_array_elements(p_sections) AS s(section)) <> jsonb_array_length(p_sections) OR
     (SELECT count(DISTINCT value) FROM jsonb_array_elements(p_sections) AS s(section),
       LATERAL jsonb_array_elements_text(s.section->'item_ids')) <>
       (SELECT sum(jsonb_array_length(s.section->'item_ids')) FROM jsonb_array_elements(p_sections) AS s(section)) THEN
    RAISE EXCEPTION 'invalid production group' USING ERRCODE = 'check_violation';
  END IF;
  FOR v_section IN SELECT value FROM jsonb_array_elements(p_sections) LOOP
    IF length(btrim(v_section->>'grade')) = 0 OR length(btrim(v_section->>'order_id')) = 0 OR
       (v_section->>'article_id') !~* '^[0-9a-f-]{36}$' OR
       (v_section->>'audit_id') !~* '^[0-9a-f-]{36}$' OR
       (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(v_section->'item_ids')) <> jsonb_array_length(v_section->'item_ids') THEN
      RAISE EXCEPTION 'invalid production group section' USING ERRCODE = 'check_violation';
    END IF;
    IF p_group_document #>> ARRAY['orders',v_index::text,'grade'] IS DISTINCT FROM v_section->>'grade' OR
       p_group_document #>> ARRAY['orders',v_index::text,'order','product_order_id'] IS DISTINCT FROM v_section->>'order_id' OR
       p_evidence_document #>> ARRAY['variants',v_index::text,'grade'] IS DISTINCT FROM v_section->>'grade' OR
       p_evidence_document #>> ARRAY['variants',v_index::text,'product_order_id'] IS DISTINCT FROM v_section->>'order_id' THEN
      RAISE EXCEPTION 'group section and evidence document mixed' USING ERRCODE = 'check_violation';
    END IF;
    v_band := CASE WHEN v_section->>'grade' IN ('elementary_5','elementary_6')
      THEN 'upper_elementary' ELSE v_section->>'grade' END;
    v_target := p_group_document #> ARRAY['orders',v_index::text,'order','target'];
    IF v_section->>'grade' NOT IN ('elementary_5','elementary_6','middle_1','middle_2',
        'middle_3','high_1','high_2','high_3') OR
       p_group_document #>> ARRAY['grade_scope','grades',v_index::text] IS DISTINCT FROM v_section->>'grade' OR
       p_group_document #>> ARRAY['orders',v_index::text,'order','grade_target'] IS DISTINCT FROM v_band OR
       v_target->>'age_band' IS DISTINCT FROM v_band OR
       (v_band='upper_elementary' AND p_group_document #>>
         ARRAY['orders',v_index::text,'order','grade_detail_target'] IS DISTINCT FROM v_section->>'grade') THEN
      RAISE EXCEPTION 'grade and target contract mixed' USING ERRCODE = 'check_violation';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements_text(v_section->'item_ids') LOOP
      IF v_item !~* '^[0-9a-f-]{36}$' THEN RAISE EXCEPTION 'invalid item id' USING ERRCODE = 'check_violation'; END IF;
    END LOOP;
    SELECT * INTO v_order FROM public.reading_product_order_revision WHERE order_id = v_section->>'order_id' FOR SHARE;
    IF v_order.order_id IS NULL OR
       public._reading_json_hash(p_group_document #> ARRAY['orders',v_index::text,'order'])
         IS DISTINCT FROM v_order.order_hash OR
       p_group_document #>> ARRAY['orders',v_index::text,'order','order_revision'] IS DISTINCT FROM v_order.order_revision::text OR
       p_evidence_document #>> ARRAY['variants',v_index::text,'order_revision'] IS DISTINCT FROM v_order.order_revision::text OR
       p_evidence_document #>> ARRAY['variants',v_index::text,'order_hash'] IS DISTINCT FROM v_order.order_hash THEN
      RAISE EXCEPTION 'group order revision missing or stale' USING ERRCODE = 'check_violation';
    END IF;
    v_index := v_index + 1;
  END LOOP;
  INSERT INTO public.reading_production_group(group_id,group_revision,sections,group_document,evidence_document,registered_by)
    VALUES(p_group_id,p_group_revision,p_sections,p_group_document,p_evidence_document,auth.uid())
    ON CONFLICT (group_id) DO UPDATE SET group_revision=EXCLUDED.group_revision,
      sections=EXCLUDED.sections,group_document=EXCLUDED.group_document,
      evidence_document=EXCLUDED.evidence_document,approved_output_hash=NULL,
      approved_evidence_hash=NULL,approved_snapshot_id=NULL,approved_by=NULL,
      approved_at=NULL,registered_by=EXCLUDED.registered_by,registered_at=clock_timestamp()
    WHERE public.reading_production_group.group_revision < EXCLUDED.group_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'group revision replay or downgrade' USING ERRCODE = 'check_violation'; END IF;
  RETURN jsonb_build_object('group_id',p_group_id,'group_revision',p_group_revision);
END $$;
REVOKE ALL ON FUNCTION public.register_reading_production_group(text,integer,jsonb,jsonb,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_reading_production_group(text,integer,jsonb,jsonb,jsonb) TO authenticated;

-- A different active administrator approves the exact editorial HTML digest.
-- A changed group revision requires a new approval and a fresh snapshot.
CREATE FUNCTION public.approve_reading_production_output(p_snapshot_id uuid,p_snapshot_hash text,p_output_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_group public.reading_production_group%ROWTYPE;
  v_snapshot public.reading_production_snapshot%ROWTYPE; v_current jsonb; v_basis_hash text;
  v_profile public.user_profiles%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_profile FROM public.user_profiles WHERE user_id=auth.uid() FOR SHARE;
  IF v_profile.user_id IS NULL OR v_profile.status IS DISTINCT FROM 'active' OR
     v_profile.role IS DISTINCT FROM 'admin' OR public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_output_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'output hash invalid' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO v_snapshot FROM public.reading_production_snapshot WHERE snapshot_id=p_snapshot_id FOR SHARE;
  IF v_snapshot.snapshot_id IS NULL OR v_snapshot.evidence_hash IS DISTINCT FROM p_snapshot_hash OR
     v_snapshot.output_hash IS DISTINCT FROM p_output_hash OR v_snapshot.finalized_at IS NULL OR
     v_snapshot.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'current rendered snapshot required' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_group FROM public.reading_production_group WHERE group_id=v_snapshot.group_id FOR UPDATE;
  IF v_group.group_id IS NULL OR v_group.group_revision IS DISTINCT FROM v_snapshot.group_revision OR
     v_group.registered_by = auth.uid() OR v_group.approved_output_hash IS NOT NULL THEN
    RAISE EXCEPTION 'independent current output approval required' USING ERRCODE = 'check_violation';
  END IF;
  v_current := public._reading_production_evidence(v_group.group_id);
  IF v_current IS DISTINCT FROM v_snapshot.evidence OR v_snapshot.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'approval evidence changed' USING ERRCODE = 'check_violation';
  END IF;
  v_basis_hash := encode(extensions.digest(convert_to((v_current - 'approved_output_hash' - 'approved_by')::text,'UTF8'),'sha256'),'hex');
  UPDATE public.reading_production_group SET approved_output_hash=p_output_hash,
    approved_evidence_hash=v_basis_hash,approved_snapshot_id=NULL,
    approved_by=auth.uid(),approved_at=clock_timestamp() WHERE group_id=v_group.group_id;
  RETURN jsonb_build_object('group_id',v_group.group_id,'group_revision',v_group.group_revision,
    'approved_output_hash',p_output_hash,'approved_evidence_hash',v_basis_hash);
END $$;
REVOKE ALL ON FUNCTION public.approve_reading_production_output(uuid,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.approve_reading_production_output(uuid,text,text) TO authenticated;

-- Internal collector. Row locks are acquired before any evidence is returned;
-- all mutable dependencies remain locked until capture/finalize transaction ends.
CREATE FUNCTION public._reading_production_evidence(p_group_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_group public.reading_production_group%ROWTYPE; v_authority public.reading_promotion_authority%ROWTYPE;
  v_section jsonb; v_order public.reading_product_order_revision%ROWTYPE;
  v_audit public.reading_promotion_audit%ROWTYPE; v_child public.library_articles%ROWTYPE;
  v_source public.library_articles%ROWTYPE; v_item public.csat_dcp_items%ROWTYPE;
  v_state public.csat_item_state%ROWTYPE; v_review public.csat_item_reviews%ROWTYPE;
  v_reviews jsonb; v_review_count integer;
  v_items jsonb; v_item_digest_pairs jsonb; v_sections jsonb := '[]'::jsonb;
  v_id text; v_now timestamptz; v_index integer := 0;
  v_evidence_valid_until timestamptz; v_section_valid_until timestamptz;
  v_gold jsonb; v_bundle jsonb; v_certificate jsonb; v_eligibility jsonb; v_policy jsonb;
  v_gold_key jsonb; v_seed_key jsonb; v_passage_hash text; v_content_hash text; v_rights_hash text;
  v_target jsonb; v_variant jsonb;
BEGIN
  -- Protect even the absence of a state/review row from concurrent inserts.
  LOCK TABLE public.csat_item_state, public.csat_item_reviews IN SHARE MODE;
  SELECT * INTO v_group FROM public.reading_production_group WHERE group_id=p_group_id FOR SHARE;
  v_now := clock_timestamp();
  IF v_group.group_id IS NULL THEN
    RAISE EXCEPTION 'production group or authority unavailable' USING ERRCODE = 'check_violation';
  END IF;
  -- Use the existing promotion RPC's order: audit, child, source, authority,
  -- order. Lock every grade in key order before inspecting any one grade.
  PERFORM 1 FROM public.reading_promotion_audit WHERE request_id IN
    (SELECT (value->>'audit_id')::uuid FROM jsonb_array_elements(v_group.sections))
    ORDER BY request_id FOR SHARE;
  PERFORM 1 FROM public.library_articles WHERE id IN
    (SELECT (value->>'article_id')::uuid FROM jsonb_array_elements(v_group.sections))
    ORDER BY id FOR SHARE;
  PERFORM 1 FROM public.library_articles WHERE id IN
    (SELECT adapted_from_id FROM public.library_articles WHERE id IN
      (SELECT (value->>'article_id')::uuid FROM jsonb_array_elements(v_group.sections)))
    ORDER BY id FOR SHARE;
  SELECT * INTO v_authority FROM public.reading_promotion_authority WHERE singleton=true FOR SHARE;
  PERFORM 1 FROM public.reading_product_order_revision WHERE order_id IN
    (SELECT value->>'order_id' FROM jsonb_array_elements(v_group.sections))
    ORDER BY order_id FOR SHARE;
  IF v_authority.singleton IS NULL OR v_authority.valid_until <= clock_timestamp() THEN
    RAISE EXCEPTION 'production authority unavailable' USING ERRCODE = 'check_violation';
  END IF;
  FOR v_section IN SELECT value FROM jsonb_array_elements(v_group.sections) LOOP
    SELECT * INTO v_audit FROM public.reading_promotion_audit WHERE request_id=(v_section->>'audit_id')::uuid FOR SHARE;
    SELECT * INTO v_child FROM public.library_articles WHERE id=(v_section->>'article_id')::uuid FOR SHARE;
    IF v_child.id IS NULL OR v_audit.request_id IS NULL THEN
      RAISE EXCEPTION 'production dependency missing' USING ERRCODE = 'check_violation';
    END IF;
    SELECT * INTO v_source FROM public.library_articles WHERE id=v_child.adapted_from_id FOR SHARE;
    SELECT * INTO v_authority FROM public.reading_promotion_authority WHERE singleton=true FOR SHARE;
    SELECT * INTO v_order FROM public.reading_product_order_revision WHERE order_id=v_section->>'order_id' FOR SHARE;
    IF v_authority.singleton IS NULL OR v_authority.valid_until <= clock_timestamp() OR v_order.order_id IS NULL THEN
      RAISE EXCEPTION 'production order or authority unavailable' USING ERRCODE = 'check_violation';
    END IF;
    v_gold := v_child.composed_spec #> '{academic_reading,provenance,gold_s}';
    v_bundle := v_gold->'proof_bundle'; v_policy := v_gold->'operational_policy';
    v_certificate := v_bundle->'certificate'; v_eligibility := v_bundle->'eligibility';
    v_section_valid_until := (v_gold->>'evidence_valid_until')::timestamptz;
    IF v_source.id IS NULL OR v_child.status IS DISTINCT FROM 'ready' OR v_child.source_id NOT LIKE 'reading:%' OR
       v_child.display_only IS DISTINCT FROM false OR v_child.copyright_safe_in_kr IS DISTINCT FROM true OR
       v_source.display_only IS DISTINCT FROM false OR v_source.copyright_safe_in_kr IS DISTINCT FROM true OR
       (v_source.status IS NULL OR v_source.status IN ('archived','failed')) OR
       v_source.license_class IS NULL OR v_source.license_class NOT IN ('cc_by','cc0','public_domain','cc_by_sa') OR
       (v_source.license_class='cc_by_sa' AND v_group.group_document #>>
         ARRAY['orders',v_index::text,'order','target','share_alike'] IS DISTINCT FROM 'true') OR
       v_child.source IS DISTINCT FROM v_source.source OR v_child.license IS DISTINCT FROM v_source.license OR
       v_child.license_class IS DISTINCT FROM v_source.license_class OR
       v_audit.article_id IS DISTINCT FROM v_child.id OR v_audit.source_id IS DISTINCT FROM v_source.id OR
       v_audit.order_id IS DISTINCT FROM v_order.order_id OR v_audit.order_revision IS DISTINCT FROM v_order.order_revision OR
       v_audit.order_hash IS DISTINCT FROM v_order.order_hash OR v_audit.result_status IS DISTINCT FROM 'ready' OR
       v_audit.trust_policy_hash IS DISTINCT FROM v_authority.trust_policy_hash OR
       v_audit.benchmark_version IS DISTINCT FROM v_authority.benchmark_version OR
       v_audit.benchmark_snapshot_hash IS DISTINCT FROM v_authority.benchmark_snapshot_hash OR
       v_audit.request_payload->>'request_hash' IS DISTINCT FROM v_audit.request_hash OR
       public._reading_json_hash(v_audit.request_payload - 'request_hash') IS DISTINCT FROM v_audit.request_hash OR
       v_audit.request_payload->>'request_id' IS DISTINCT FROM v_audit.request_id::text OR
       v_audit.request_payload->>'article_id' IS DISTINCT FROM v_child.id::text OR
       v_audit.request_payload->>'source_id' IS DISTINCT FROM v_source.id::text OR
       v_audit.request_payload->>'product_order_id' IS DISTINCT FROM v_order.order_id OR
       v_audit.request_payload->>'order_revision' IS DISTINCT FROM v_order.order_revision::text OR
       v_audit.request_payload->>'order_hash' IS DISTINCT FROM v_order.order_hash OR
       v_audit.request_payload->>'evidence_hash' IS DISTINCT FROM v_audit.evidence_hash OR
       v_audit.request_payload->>'certificate_hash' IS DISTINCT FROM v_audit.certificate_hash OR
       v_audit.request_payload->>'eligibility_hash' IS DISTINCT FROM v_audit.eligibility_hash OR
       v_audit.request_payload->>'trust_policy_hash' IS DISTINCT FROM v_audit.trust_policy_hash OR
       v_audit.request_payload->>'benchmark_version' IS DISTINCT FROM v_audit.benchmark_version OR
       v_audit.request_payload->>'benchmark_snapshot_hash' IS DISTINCT FROM v_audit.benchmark_snapshot_hash OR
       v_audit.request_payload->>'requested_by' IS DISTINCT FROM v_audit.requested_by OR
       COALESCE(v_audit.request_payload->>'intent_hash','') !~ '^[a-f0-9]{64}$' OR
       v_audit.certificate_hash = ANY(v_authority.revoked_certificate_hashes) OR
       v_audit.eligibility_hash = ANY(v_authority.revoked_eligibility_hashes) OR
       encode(extensions.digest(convert_to(v_child.content,'UTF8'),'sha256'),'hex') IS DISTINCT FROM v_audit.request_payload->>'child_content_sha256' OR
       encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex') IS DISTINCT FROM v_audit.request_payload->>'source_content_sha256' OR
       v_source.updated_at IS DISTINCT FROM (v_audit.request_payload->>'source_updated_at')::timestamptz OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,state}' IS DISTINCT FROM 'gold_s' OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,seed_eligible}' IS DISTINCT FROM 'true' OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,production}' IS DISTINCT FROM 'false' OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,source_id}' IS DISTINCT FROM v_source.id::text OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,target_key}' IS DISTINCT FROM v_audit.request_payload->>'target_key' OR
       v_section_valid_until IS NULL OR v_section_valid_until <= clock_timestamp() OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,certificate_hash}' IS DISTINCT FROM v_audit.certificate_hash OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,eligibility_hash}' IS DISTINCT FROM v_audit.eligibility_hash OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,rights_hash}' IS DISTINCT FROM v_audit.request_payload->>'rights_hash' OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,trust_policy_hash}' IS DISTINCT FROM v_audit.trust_policy_hash OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,benchmark_version}' IS DISTINCT FROM v_audit.benchmark_version OR
       v_child.composed_spec #>> '{academic_reading,provenance,gold_s,benchmark_snapshot_hash}' IS DISTINCT FROM v_audit.benchmark_snapshot_hash THEN
      RAISE EXCEPTION 'production evidence stale or rights blocked' USING ERRCODE = 'check_violation';
    END IF;
    SELECT value INTO v_gold_key FROM jsonb_array_elements(COALESCE(v_policy->'gold_issuers','[]'::jsonb))
      WHERE value->>'id'=v_certificate->>'issuer_id';
    SELECT value INTO v_seed_key FROM jsonb_array_elements(COALESCE(v_policy->'seed_issuers','[]'::jsonb))
      WHERE value->>'id'=v_eligibility->>'issuer_id';
    v_passage_hash := public._reading_json_hash(to_jsonb(btrim(v_child.content)));
    v_content_hash := public._reading_json_hash(jsonb_build_object('source_id',v_source.id::text,
      'target_key',v_audit.request_payload->>'target_key','passage_hash',v_passage_hash));
    v_rights_hash := public._reading_json_hash(jsonb_build_object('id',v_source.id,'source_id',v_source.source_id,
      'source_url',v_source.source_url,'content',v_source.content,'csat_fit',v_source.csat_fit,
      'license',v_source.license,'license_class',v_source.license_class,'display_only',v_source.display_only,
      'copyright_safe_in_kr',v_source.copyright_safe_in_kr,'status',v_source.status,
      'updated_at',v_source.updated_at));
    v_target := v_group.group_document #> ARRAY['orders',v_index::text,'order','target'];
    v_variant := v_group.evidence_document #> ARRAY['variants',v_index::text];
    IF v_group.evidence_document->>'group_hash' IS DISTINCT FROM
         public._reading_json_hash(v_group.group_document) OR
       v_group.group_document #>> ARRAY['orders',v_index::text,'order','trust_policy_hash']
         IS DISTINCT FROM v_authority.trust_policy_hash OR
       v_group.evidence_document->>'source_id' IS DISTINCT FROM v_source.id::text OR
       v_group.evidence_document->>'source_hash' IS DISTINCT FROM
         encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex') OR
       v_group.evidence_document->>'rights_hash' IS DISTINCT FROM v_rights_hash OR
       v_variant->>'grade' IS DISTINCT FROM v_section->>'grade' OR
       v_variant->>'product_order_id' IS DISTINCT FROM v_order.order_id OR
       v_variant->>'order_hash' IS DISTINCT FROM v_order.order_hash OR
       v_variant->>'passage_hash' IS DISTINCT FROM
         encode(extensions.digest(convert_to(v_child.content,'UTF8'),'sha256'),'hex') OR
       (v_variant->>'adaptation_hash' IS NOT NULL AND v_variant->>'adaptation_hash' IS DISTINCT FROM v_passage_hash) OR
       v_variant->>'benchmark_version' IS DISTINCT FROM v_authority.benchmark_version OR
       v_variant->>'benchmark_snapshot_hash' IS DISTINCT FROM v_authority.benchmark_snapshot_hash THEN
      RAISE EXCEPTION 'registered grade evidence mixed with current rows' USING ERRCODE = 'check_violation';
    END IF;
    IF v_policy->>'schema' IS DISTINCT FROM 'frym-gold-s-operational-policy/1' OR
       v_certificate->>'schema' IS DISTINCT FROM 'frym-gold-s-certificate/1' OR
       v_eligibility->>'schema' IS DISTINCT FROM 'frym-seed-eligibility/1' OR
       jsonb_typeof(v_policy->'gold_issuers') IS DISTINCT FROM 'array' OR
       jsonb_typeof(v_policy->'seed_issuers') IS DISTINCT FROM 'array' OR
       (SELECT count(*) FROM jsonb_array_elements(v_policy->'gold_issuers' || v_policy->'seed_issuers')) IS DISTINCT FROM
         (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(v_policy->'gold_issuers' || v_policy->'seed_issuers')) OR
       (SELECT count(*) FROM jsonb_array_elements(v_policy->'gold_issuers' || v_policy->'seed_issuers')) IS DISTINCT FROM
         (SELECT count(DISTINCT regexp_replace(value->>'public_key','[[:space:]]','','g'))
            FROM jsonb_array_elements(v_policy->'gold_issuers' || v_policy->'seed_issuers')) OR
       v_policy->>'gold_max_age_days' IS NULL OR
       (v_policy->>'gold_max_age_days')::integer NOT BETWEEN 1 AND 365 OR
       v_policy->>'seed_max_age_days' IS NULL OR
       (v_policy->>'seed_max_age_days')::integer NOT BETWEEN 1 AND 30 OR
       v_certificate->>'issued_at' IS NULL OR v_eligibility->>'issued_at' IS NULL OR
       v_gold_key->>'valid_from' IS NULL OR v_gold_key->>'valid_until' IS NULL OR
       v_seed_key->>'valid_from' IS NULL OR v_seed_key->>'valid_until' IS NULL OR
       v_certificate->>'revoked' = 'true' OR v_eligibility->>'revoked' = 'true' OR
       public._reading_json_hash(v_policy) IS DISTINCT FROM v_authority.trust_policy_hash OR
       public._reading_json_hash(v_certificate) IS DISTINCT FROM v_audit.certificate_hash OR
       public._reading_json_hash(v_eligibility) IS DISTINCT FROM v_audit.eligibility_hash OR
       v_certificate->>'source_id' IS DISTINCT FROM v_source.id::text OR
       v_certificate->>'target_key' IS DISTINCT FROM v_audit.request_payload->>'target_key' OR
       public._reading_target_key(v_target) IS DISTINCT FROM v_certificate->>'target_key' OR
       v_certificate->>'passage_hash' IS DISTINCT FROM v_passage_hash OR
       v_certificate->>'content_hash' IS DISTINCT FROM v_content_hash OR
       v_eligibility->>'certificate_hash' IS DISTINCT FROM v_audit.certificate_hash OR
       v_eligibility->>'content_hash' IS DISTINCT FROM v_content_hash OR
       v_rights_hash IS DISTINCT FROM v_audit.request_payload->>'rights_hash' OR
       v_certificate->>'rights_hash' IS DISTINCT FROM v_rights_hash OR
       v_eligibility->>'rights_hash' IS DISTINCT FROM v_rights_hash OR
       v_certificate->>'benchmark_version' IS DISTINCT FROM v_authority.benchmark_version OR
       v_certificate->>'benchmark_snapshot_hash' IS DISTINCT FROM v_authority.benchmark_snapshot_hash OR
       COALESCE(v_certificate->>'review_evidence_hash','') !~ '^[a-f0-9]{64}$' OR
       COALESCE(v_certificate->>'decision_hash','') !~ '^[a-f0-9]{64}$' OR
       COALESCE(v_certificate->>'distribution_hash','') !~ '^[a-f0-9]{64}$' OR
       COALESCE(v_certificate->>'review_hash','') !~ '^[a-f0-9]{64}$' OR
       COALESCE(v_certificate->>'admission_receipt_hash','') !~ '^[a-f0-9]{64}$' OR
       COALESCE(v_eligibility->>'seed_evidence_hash','') !~ '^[a-f0-9]{64}$' OR
       COALESCE(v_eligibility->>'operations_hash','') !~ '^[a-f0-9]{64}$' OR
       COALESCE(v_eligibility->>'approval_hash','') !~ '^[a-f0-9]{64}$' OR
       v_certificate->>'certificate_id' IS NULL OR
       v_eligibility->>'eligibility_id' IS NULL OR
       v_certificate->>'curator_id' IS NULL OR v_certificate->>'owner_id' IS NULL OR
       v_eligibility->>'operations_id' IS NULL OR v_eligibility->>'approver_id' IS NULL OR
       length(btrim(v_certificate->>'certificate_id')) = 0 OR
       length(btrim(v_eligibility->>'eligibility_id')) = 0 OR
       length(btrim(v_certificate->>'curator_id')) = 0 OR
       length(btrim(v_certificate->>'owner_id')) = 0 OR
       length(btrim(v_eligibility->>'operations_id')) = 0 OR
       length(btrim(v_eligibility->>'approver_id')) = 0 OR
       v_certificate->>'curator_id' IN (v_certificate->>'owner_id',v_certificate->>'issuer_id') OR
       v_certificate->>'owner_id' = v_certificate->>'issuer_id' OR
       v_eligibility->>'operations_id' IN (v_eligibility->>'approver_id',v_eligibility->>'issuer_id') OR
       v_eligibility->>'approver_id' = v_eligibility->>'issuer_id' OR
       v_gold_key IS NULL OR v_seed_key IS NULL OR
       (v_gold_key->>'valid_from')::timestamptz > (v_certificate->>'issued_at')::timestamptz OR
       (v_seed_key->>'valid_from')::timestamptz > (v_eligibility->>'issued_at')::timestamptz OR
       (v_gold_key->>'valid_until')::timestamptz <= (v_certificate->>'issued_at')::timestamptz OR
       (v_seed_key->>'valid_until')::timestamptz <= (v_eligibility->>'issued_at')::timestamptz OR
       (v_gold_key->>'valid_from')::timestamptz > clock_timestamp() OR
       (v_seed_key->>'valid_from')::timestamptz > clock_timestamp() OR
       (v_gold_key->>'valid_until')::timestamptz <= clock_timestamp() OR
       (v_seed_key->>'valid_until')::timestamptz <= clock_timestamp() OR
       (v_certificate->>'issued_at')::timestamptz > clock_timestamp() OR
       (v_eligibility->>'issued_at')::timestamptz > clock_timestamp() OR
       (v_certificate->>'issued_at')::timestamptz +
         ((v_policy->>'gold_max_age_days')::integer * interval '1 day') <= clock_timestamp() OR
       (v_eligibility->>'issued_at')::timestamptz +
         ((v_policy->>'seed_max_age_days')::integer * interval '1 day') <= clock_timestamp() OR
       v_section_valid_until > LEAST((v_gold_key->>'valid_until')::timestamptz,
         (v_seed_key->>'valid_until')::timestamptz,
         (v_certificate->>'issued_at')::timestamptz +
           ((v_policy->>'gold_max_age_days')::integer * interval '1 day'),
         (v_eligibility->>'issued_at')::timestamptz +
           ((v_policy->>'seed_max_age_days')::integer * interval '1 day')) OR
       v_certificate->>'issuer_id' IN (SELECT jsonb_array_elements_text(COALESCE(v_policy #> '{revoked,issuer_ids}','[]'::jsonb))) OR
       v_eligibility->>'issuer_id' IN (SELECT jsonb_array_elements_text(COALESCE(v_policy #> '{revoked,issuer_ids}','[]'::jsonb))) OR
       v_audit.certificate_hash IN (SELECT jsonb_array_elements_text(COALESCE(v_policy #> '{revoked,certificate_hashes}','[]'::jsonb))) OR
       v_audit.eligibility_hash IN (SELECT jsonb_array_elements_text(COALESCE(v_policy #> '{revoked,eligibility_hashes}','[]'::jsonb))) OR
       NOT public._reading_verify_ed25519(v_certificate,v_gold_key->>'public_key') OR
       NOT public._reading_verify_ed25519(v_eligibility,v_seed_key->>'public_key') THEN
      RAISE EXCEPTION 'signed Gold-S evidence stale or unverified' USING ERRCODE = 'check_violation';
    END IF;
    v_evidence_valid_until := LEAST(COALESCE(v_evidence_valid_until,v_section_valid_until),v_section_valid_until);
    v_items := '[]'::jsonb; v_item_digest_pairs := '[]'::jsonb;
    FOR v_id IN SELECT value FROM jsonb_array_elements_text(v_section->'item_ids') LOOP
      SELECT * INTO v_item FROM public.csat_dcp_items WHERE id=v_id::uuid FOR SHARE;
      SELECT * INTO v_state FROM public.csat_item_state WHERE item_id=v_id::uuid FOR SHARE;
      IF v_item.id IS NULL OR v_item.ref_id IS DISTINCT FROM v_child.id OR
         v_item.payload #>> '{factory_lineage,product_order_id}' IS DISTINCT FROM v_order.order_id OR
         v_item.payload #>> '{factory_lineage,order_revision}' IS DISTINCT FROM v_order.order_revision::text OR
         v_item.payload #>> '{factory_lineage,order_hash}' IS DISTINCT FROM v_order.order_hash OR
         v_item.payload #>> '{factory_lineage,promotion_request_id}' IS DISTINCT FROM v_audit.request_id::text OR
         v_item.payload #>> '{factory_lineage,promotion_request_hash}' IS DISTINCT FROM v_audit.request_hash OR
         v_item.payload #>> '{factory_lineage,evidence_hash}' IS DISTINCT FROM v_audit.evidence_hash OR
         v_item.payload #>> '{factory_lineage,source_hash}' IS DISTINCT FROM v_audit.request_payload->>'source_content_sha256' OR
         v_item.payload #>> '{factory_lineage,adaptation_hash}' IS DISTINCT FROM v_audit.request_payload->>'child_content_sha256' OR
         (v_item.payload #>> '{factory_lineage,source_revision}')::timestamptz IS DISTINCT FROM v_source.updated_at OR
         (v_item.payload #>> '{factory_lineage,adaptation_revision}')::timestamptz IS DISTINCT FROM v_child.updated_at OR
         v_item.payload #>> '{factory_lineage,rights_hash}' IS DISTINCT FROM v_audit.request_payload->>'rights_hash' OR
         v_item.payload #>> '{factory_lineage,certificate_hash}' IS DISTINCT FROM v_audit.certificate_hash OR
         v_item.payload #>> '{factory_lineage,eligibility_hash}' IS DISTINCT FROM v_audit.eligibility_hash OR
         v_item.payload #>> '{factory_lineage,trust_policy_hash}' IS DISTINCT FROM v_audit.trust_policy_hash OR
         v_item.payload #>> '{factory_lineage,benchmark_version}' IS DISTINCT FROM v_audit.benchmark_version OR
         v_item.payload #>> '{factory_lineage,benchmark_snapshot_hash}' IS DISTINCT FROM v_audit.benchmark_snapshot_hash OR
         (v_state.item_id IS NOT NULL AND v_state.status IS DISTINCT FROM 'usable') THEN
        RAISE EXCEPTION 'production item mixed or stale' USING ERRCODE = 'check_violation';
      END IF;
      v_reviews := '[]'::jsonb; v_review_count := 0;
      FOR v_review IN SELECT * FROM public.csat_item_reviews WHERE item_id=v_item.id ORDER BY persona FOR SHARE LOOP
        IF v_review.verdict IS DISTINCT FROM 'pass' OR v_review.reviewed_digest IS DISTINCT FROM
           public._reading_json_hash(jsonb_build_object('answer_key',v_item.answer_key,'payload',v_item.payload)) THEN
          RAISE EXCEPTION 'production item review missing or stale' USING ERRCODE = 'check_violation';
        END IF;
        v_review_count := v_review_count + 1;
        v_reviews := v_reviews || jsonb_build_array(to_jsonb(v_review));
      END LOOP;
      IF v_review_count <> 3 OR (SELECT count(DISTINCT value->>'persona') FROM jsonb_array_elements(v_reviews)) <> 3 THEN
        RAISE EXCEPTION 'three independent item reviews required' USING ERRCODE = 'check_violation';
      END IF;
      v_item_digest_pairs := v_item_digest_pairs || jsonb_build_array(jsonb_build_array(v_item.id,
        public._reading_json_hash(jsonb_build_object('answer_key',v_item.answer_key,'payload',v_item.payload))));
      v_items := v_items || jsonb_build_array(jsonb_build_object('id',v_item.id,'ref_id',v_item.ref_id,
        'kind',v_item.kind,'type',v_item.type,'item_role',v_item.item_role,
        'paragraph_idx',v_item.paragraph_idx,'v_level',v_item.v_level,
        'payload',v_item.payload,'answer_key',v_item.answer_key,
        'state',CASE WHEN v_state.item_id IS NULL THEN NULL ELSE to_jsonb(v_state) END,
        'reviews',v_reviews));
    END LOOP;
    IF public._reading_json_hash(v_item_digest_pairs) IS DISTINCT FROM
       v_group.evidence_document #>> ARRAY['variants',v_index::text,'item_set_hash'] THEN
      RAISE EXCEPTION 'production item set differs from sealed grade evidence' USING ERRCODE = 'check_violation';
    END IF;
    v_sections := v_sections || jsonb_build_array(jsonb_build_object('grade',v_section->>'grade',
      'order_id',v_order.order_id,'order_revision',v_order.order_revision,'order_hash',v_order.order_hash,
      'article_id',v_child.id,'article_updated_at',v_child.updated_at,'article_content',v_child.content,
      'article_source_id',v_child.source_id,'source_id',v_source.id,'source_updated_at',v_source.updated_at,
      'gold_s',v_child.composed_spec #> '{academic_reading,provenance,gold_s}',
      'source_content_hash',v_audit.request_payload->>'source_content_sha256',
      'source_evidence',jsonb_build_object('id',v_source.id,'source_id',v_source.source_id,
        'source_url',v_source.source_url,'content',v_source.content,'csat_fit',v_source.csat_fit,
        'license',v_source.license,'license_class',v_source.license_class,
        'display_only',v_source.display_only,'copyright_safe_in_kr',v_source.copyright_safe_in_kr,
        'status',v_source.status,'updated_at',v_source.updated_at),
      'rights',jsonb_build_object('source',v_source.source,'license',v_source.license,
        'license_class',v_source.license_class,'display_only',v_source.display_only,
        'copyright_safe_in_kr',v_source.copyright_safe_in_kr,'status',v_source.status),
      'audit_id',v_audit.request_id,'audit_hash',v_audit.request_hash,
      'audit_request_payload',v_audit.request_payload,
      'evidence_valid_until',v_section_valid_until,
      'certificate_hash',v_audit.certificate_hash,'eligibility_hash',v_audit.eligibility_hash,
      'benchmark_snapshot_hash',v_audit.benchmark_snapshot_hash,'items',v_items));
    v_index := v_index + 1;
  END LOOP;
  IF v_authority.valid_until <= clock_timestamp() OR v_evidence_valid_until <= clock_timestamp() THEN
    RAISE EXCEPTION 'production authority or certificate expired while locking' USING ERRCODE = 'check_violation';
  END IF;
  RETURN jsonb_build_object('schema','reading-production-evidence/1','group_id',v_group.group_id,
    'group_revision',v_group.group_revision,'approved_output_hash',v_group.approved_output_hash,
    'approved_by',v_group.approved_by,'authority_generation',v_authority.generation,
    'authority_valid_until',v_authority.valid_until,'evidence_valid_until',v_evidence_valid_until,
    'group_document',v_group.group_document,
    'evidence_document',v_group.evidence_document,'sections',v_sections);
END $$;
REVOKE ALL ON FUNCTION public._reading_production_evidence(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.capture_reading_production_snapshot(p_group_id text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_evidence jsonb; v_snapshot public.reading_production_snapshot%ROWTYPE;
  v_group public.reading_production_group%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_group FROM public.reading_production_group WHERE group_id=p_group_id FOR UPDATE;
  v_evidence := public._reading_production_evidence(p_group_id);
  INSERT INTO public.reading_production_snapshot(group_id,group_revision,evidence,evidence_hash,expires_at)
    VALUES(p_group_id,(v_evidence->>'group_revision')::integer,v_evidence,
      encode(extensions.digest(convert_to(v_evidence::text,'UTF8'),'sha256'),'hex'),
      LEAST((v_evidence->>'authority_valid_until')::timestamptz,
        (v_evidence->>'evidence_valid_until')::timestamptz,clock_timestamp()+interval '15 minutes'))
    RETURNING * INTO v_snapshot;
  IF v_group.approved_output_hash IS NOT NULL THEN
    IF v_group.approved_snapshot_id IS NOT NULL THEN
      RAISE EXCEPTION 'output approval already consumed' USING ERRCODE = 'check_violation';
    END IF;
    UPDATE public.reading_production_group SET approved_snapshot_id=v_snapshot.snapshot_id
      WHERE group_id=p_group_id;
  END IF;
  RETURN jsonb_build_object('snapshot_id',v_snapshot.snapshot_id,'snapshot_hash',v_snapshot.evidence_hash,
    'captured_at',v_snapshot.captured_at,'expires_at',v_snapshot.expires_at,'evidence',v_snapshot.evidence);
END $$;
REVOKE ALL ON FUNCTION public.capture_reading_production_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_reading_production_snapshot(text) TO service_role;

-- Finalize once, after rendering to a temporary artifact. This is an output
-- lineage record, not permission to publish an external file.
CREATE FUNCTION public.finalize_reading_production_snapshot(p_snapshot_id uuid,p_snapshot_hash text,p_output_hash text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_snapshot public.reading_production_snapshot%ROWTYPE; v_evidence jsonb;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_output_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid output hash' USING ERRCODE = 'check_violation'; END IF;
  SELECT * INTO v_snapshot FROM public.reading_production_snapshot WHERE snapshot_id=p_snapshot_id FOR UPDATE;
  IF v_snapshot.snapshot_id IS NULL OR v_snapshot.finalized_at IS NOT NULL OR v_snapshot.expires_at <= clock_timestamp() OR
     v_snapshot.evidence_hash IS DISTINCT FROM p_snapshot_hash OR
     encode(extensions.digest(convert_to(v_snapshot.evidence::text,'UTF8'),'sha256'),'hex') IS DISTINCT FROM p_snapshot_hash THEN
    RAISE EXCEPTION 'production snapshot stale or replayed' USING ERRCODE = 'check_violation';
  END IF;
  v_evidence := public._reading_production_evidence(v_snapshot.group_id);
  IF v_evidence IS DISTINCT FROM v_snapshot.evidence THEN
    RAISE EXCEPTION 'production evidence changed after capture' USING ERRCODE = 'check_violation';
  END IF;
  IF v_snapshot.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'production snapshot expired while locking' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reading_production_snapshot SET output_hash=p_output_hash,finalized_at=clock_timestamp()
    WHERE snapshot_id=p_snapshot_id;
  RETURN jsonb_build_object('snapshot_id',p_snapshot_id,'snapshot_hash',p_snapshot_hash,
    'output_hash',p_output_hash,'status','rendered_unpublished');
END $$;
REVOKE ALL ON FUNCTION public.finalize_reading_production_snapshot(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_reading_production_snapshot(uuid,text,text) TO service_role;

-- Publication writes the exact HTML in the same transaction as the current
-- evidence check. External files are not an authorized publication channel.
CREATE FUNCTION public.publish_reading_production_artifact(p_snapshot_id uuid,p_snapshot_hash text,p_html text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_snapshot public.reading_production_snapshot%ROWTYPE; v_evidence jsonb; v_output_hash text;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_html IS NULL OR length(p_html) NOT BETWEEN 1 AND 5000000 THEN
    RAISE EXCEPTION 'invalid artifact length' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_snapshot FROM public.reading_production_snapshot WHERE snapshot_id=p_snapshot_id FOR UPDATE;
  v_output_hash := encode(extensions.digest(convert_to(p_html,'UTF8'),'sha256'),'hex');
  IF v_snapshot.snapshot_id IS NULL OR v_snapshot.finalized_at IS NULL OR
     v_snapshot.expires_at <= clock_timestamp() OR v_snapshot.evidence_hash IS DISTINCT FROM p_snapshot_hash OR
     v_snapshot.output_hash IS DISTINCT FROM v_output_hash OR
     v_snapshot.evidence->>'approved_output_hash' IS DISTINCT FROM v_output_hash THEN
    RAISE EXCEPTION 'artifact or snapshot stale' USING ERRCODE = 'check_violation';
  END IF;
  v_evidence := public._reading_production_evidence(v_snapshot.group_id);
  IF NOT EXISTS (SELECT 1 FROM public.reading_production_group g WHERE g.group_id=v_snapshot.group_id
      AND g.approved_snapshot_id=p_snapshot_id AND g.approved_output_hash=v_output_hash AND g.approved_evidence_hash=
        encode(extensions.digest(convert_to((v_snapshot.evidence - 'approved_output_hash' - 'approved_by')::text,'UTF8'),'sha256'),'hex')) THEN
    RAISE EXCEPTION 'output approval bound to different evidence' USING ERRCODE = 'check_violation';
  END IF;
  IF v_evidence IS DISTINCT FROM v_snapshot.evidence THEN
    RAISE EXCEPTION 'production evidence changed before publication' USING ERRCODE = 'check_violation';
  END IF;
  IF v_snapshot.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'production snapshot expired while locking' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.reading_production_artifact(snapshot_id,output_hash,html)
    VALUES(p_snapshot_id,v_output_hash,p_html);
  RETURN jsonb_build_object('snapshot_id',p_snapshot_id,'snapshot_hash',p_snapshot_hash,
    'output_hash',v_output_hash,'status','published_current');
END $$;
REVOKE ALL ON FUNCTION public.publish_reading_production_artifact(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_reading_production_artifact(uuid,text,text) TO service_role;

-- Every serve rechecks current rights, certificate, order, group and items;
-- a previously published artifact becomes inaccessible when evidence changes.
CREATE FUNCTION public.serve_reading_production_artifact(p_snapshot_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_snapshot public.reading_production_snapshot%ROWTYPE;
  v_artifact public.reading_production_artifact%ROWTYPE; v_evidence jsonb;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_snapshot FROM public.reading_production_snapshot WHERE snapshot_id=p_snapshot_id FOR SHARE;
  SELECT * INTO v_artifact FROM public.reading_production_artifact WHERE snapshot_id=p_snapshot_id FOR SHARE;
  IF v_snapshot.snapshot_id IS NULL OR v_artifact.snapshot_id IS NULL OR
     v_snapshot.output_hash IS DISTINCT FROM v_artifact.output_hash OR
     NOT EXISTS (SELECT 1 FROM public.reading_production_group g
       WHERE g.group_id=v_snapshot.group_id AND g.approved_snapshot_id=p_snapshot_id) OR
     encode(extensions.digest(convert_to(v_artifact.html,'UTF8'),'sha256'),'hex') IS DISTINCT FROM v_artifact.output_hash THEN
    RAISE EXCEPTION 'published artifact missing or changed' USING ERRCODE = 'check_violation';
  END IF;
  v_evidence := public._reading_production_evidence(v_snapshot.group_id);
  IF v_evidence IS DISTINCT FROM v_snapshot.evidence THEN
    RAISE EXCEPTION 'published evidence no longer current' USING ERRCODE = 'check_violation';
  END IF;
  RETURN jsonb_build_object('snapshot_id',p_snapshot_id,'snapshot_hash',v_snapshot.evidence_hash,
    'output_hash',v_artifact.output_hash,'html',v_artifact.html);
END $$;
REVOKE ALL ON FUNCTION public.serve_reading_production_artifact(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.serve_reading_production_artifact(uuid) TO service_role;
COMMIT;
