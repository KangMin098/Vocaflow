-- supabase/migrations/20261007120000_reading_controlled_promotion.sql
-- Phase 2: only the service-role promotion RPC may create a one-transaction
-- permit for one queued reading child. Existing generic routes remain blocked.
-- Apply to development DB only after explicit user approval and checkpoint.

BEGIN;

CREATE TABLE public.reading_promotion_audit (
  request_id uuid PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.library_articles(id),
  source_id uuid NOT NULL REFERENCES public.library_articles(id),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  order_id text NOT NULL,
  order_revision integer NOT NULL CHECK (order_revision > 0),
  order_hash text NOT NULL CHECK (order_hash ~ '^[a-f0-9]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  certificate_hash text NOT NULL CHECK (certificate_hash ~ '^[a-f0-9]{64}$'),
  eligibility_hash text NOT NULL CHECK (eligibility_hash ~ '^[a-f0-9]{64}$'),
  trust_policy_hash text NOT NULL CHECK (trust_policy_hash ~ '^[a-f0-9]{64}$'),
  benchmark_version text NOT NULL CHECK (length(btrim(benchmark_version)) > 0),
  benchmark_snapshot_hash text NOT NULL CHECK (benchmark_snapshot_hash ~ '^[a-f0-9]{64}$'),
  requested_by text NOT NULL CHECK (length(btrim(requested_by)) > 0),
  request_payload jsonb NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  result_status text NOT NULL DEFAULT 'ready' CHECK (result_status = 'ready')
);
CREATE INDEX reading_promotion_audit_article_idx ON public.reading_promotion_audit(article_id);

-- The permit is inaccessible to API roles. The trigger reads it as postgres.
-- It exists only between the audit insert and the status UPDATE in one xact.
CREATE TABLE public.reading_promotion_permit (
  request_id uuid PRIMARY KEY REFERENCES public.reading_promotion_audit(request_id) ON DELETE CASCADE,
  article_id uuid NOT NULL,
  transaction_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- No initial row: deployment alone never opens promotion. An authenticated
-- administrator must register the current external benchmark/trust revisions.
CREATE TABLE public.reading_promotion_authority (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  generation bigint NOT NULL CHECK (generation > 0),
  trust_policy_hash text NOT NULL CHECK (trust_policy_hash ~ '^[a-f0-9]{64}$'),
  benchmark_version text NOT NULL CHECK (length(btrim(benchmark_version)) > 0),
  benchmark_snapshot_hash text NOT NULL CHECK (benchmark_snapshot_hash ~ '^[a-f0-9]{64}$'),
  revoked_certificate_hashes text[] NOT NULL DEFAULT '{}',
  revoked_eligibility_hashes text[] NOT NULL DEFAULT '{}',
  previous_trust_policy_hashes text[] NOT NULL DEFAULT '{}',
  previous_benchmark_snapshot_hashes text[] NOT NULL DEFAULT '{}',
  valid_until timestamptz NOT NULL,
  registered_by uuid NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reading_product_order_revision (
  order_id text PRIMARY KEY,
  order_revision integer NOT NULL CHECK (order_revision > 0),
  order_hash text NOT NULL CHECK (order_hash ~ '^[a-f0-9]{64}$'),
  registered_by uuid NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.reading_promotion_approval (
  request_id uuid PRIMARY KEY,
  article_id uuid NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  order_id text NOT NULL,
  order_revision integer NOT NULL CHECK (order_revision > 0),
  order_hash text NOT NULL CHECK (order_hash ~ '^[a-f0-9]{64}$'),
  evidence_hash text NOT NULL CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  certificate_hash text NOT NULL CHECK (certificate_hash ~ '^[a-f0-9]{64}$'),
  eligibility_hash text NOT NULL CHECK (eligibility_hash ~ '^[a-f0-9]{64}$'),
  trust_policy_hash text NOT NULL CHECK (trust_policy_hash ~ '^[a-f0-9]{64}$'),
  benchmark_snapshot_hash text NOT NULL CHECK (benchmark_snapshot_hash ~ '^[a-f0-9]{64}$'),
  approved_by uuid NOT NULL,
  rationale text NOT NULL CHECK (length(btrim(rationale)) >= 20),
  request_payload jsonb NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '15 minutes'),
  consumed_at timestamptz
);
REVOKE ALL ON public.reading_promotion_audit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.reading_promotion_permit FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.reading_promotion_authority FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.reading_product_order_revision FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.reading_promotion_approval FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.reading_promotion_audit TO service_role;
GRANT SELECT ON public.reading_promotion_approval TO service_role;
GRANT SELECT ON public.reading_promotion_authority TO service_role;
GRANT SELECT ON public.reading_product_order_revision TO service_role;

CREATE FUNCTION public.register_reading_product_order(p_order_id text, p_order_revision integer, p_order_hash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_rows integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'authenticated' OR
     auth.uid() IS NULL OR public.is_admin() IS DISTINCT FROM true OR
     NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_order_id IS NULL OR length(btrim(p_order_id)) = 0 OR p_order_revision IS NULL OR p_order_revision < 1 OR
     p_order_hash IS NULL OR p_order_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'product order revision invalid' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.reading_product_order_revision(order_id,order_revision,order_hash,registered_by,registered_at)
  VALUES (p_order_id,p_order_revision,p_order_hash,auth.uid(),clock_timestamp())
  ON CONFLICT (order_id) DO UPDATE SET
    order_revision = EXCLUDED.order_revision, order_hash = EXCLUDED.order_hash,
    registered_by = EXCLUDED.registered_by, registered_at = EXCLUDED.registered_at
  WHERE EXCLUDED.order_revision > public.reading_product_order_revision.order_revision OR
    (EXCLUDED.order_revision = public.reading_product_order_revision.order_revision AND
     EXCLUDED.order_hash = public.reading_product_order_revision.order_hash);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'product order revision rollback or hash replacement denied' USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE FUNCTION public.register_reading_promotion_authority(
  p_generation bigint, p_trust_policy_hash text, p_benchmark_version text, p_benchmark_snapshot_hash text,
  p_revoked_certificate_hashes text[], p_revoked_eligibility_hashes text[], p_valid_until timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_current public.reading_promotion_authority%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'authenticated' OR
     auth.uid() IS NULL OR public.is_admin() IS DISTINCT FROM true OR
     NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_generation IS NULL OR p_generation < 1 OR
     p_trust_policy_hash !~ '^[a-f0-9]{64}$' OR p_benchmark_snapshot_hash !~ '^[a-f0-9]{64}$' OR
     length(btrim(p_benchmark_version)) = 0 OR p_valid_until <= clock_timestamp() OR p_valid_until > clock_timestamp() + interval '1 day' OR
     p_revoked_certificate_hashes IS NULL OR p_revoked_eligibility_hashes IS NULL OR
     EXISTS (SELECT 1 FROM unnest(p_revoked_certificate_hashes || p_revoked_eligibility_hashes) AS x(value) WHERE value IS NULL OR value !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'authority revision invalid' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_current FROM public.reading_promotion_authority WHERE singleton = true FOR UPDATE;
  IF v_current.singleton IS NULL THEN
    IF p_generation <> 1 THEN RAISE EXCEPTION 'first authority generation must be one' USING ERRCODE = 'check_violation'; END IF;
    INSERT INTO public.reading_promotion_authority (
      singleton,generation,trust_policy_hash,benchmark_version,benchmark_snapshot_hash,
      revoked_certificate_hashes,revoked_eligibility_hashes,valid_until,registered_by,registered_at
    ) VALUES (
      true,p_generation,p_trust_policy_hash,p_benchmark_version,p_benchmark_snapshot_hash,
      p_revoked_certificate_hashes,p_revoked_eligibility_hashes,p_valid_until,auth.uid(),clock_timestamp()
    );
    RETURN;
  END IF;
  IF p_generation = v_current.generation AND p_trust_policy_hash = v_current.trust_policy_hash AND
     p_benchmark_version = v_current.benchmark_version AND p_benchmark_snapshot_hash = v_current.benchmark_snapshot_hash AND
     p_revoked_certificate_hashes = v_current.revoked_certificate_hashes AND
     p_revoked_eligibility_hashes = v_current.revoked_eligibility_hashes AND p_valid_until = v_current.valid_until THEN
    RETURN;
  END IF;
  IF p_generation <> v_current.generation + 1 OR
     p_trust_policy_hash = ANY(v_current.previous_trust_policy_hashes) OR
     p_benchmark_snapshot_hash = ANY(v_current.previous_benchmark_snapshot_hashes) OR
     (p_trust_policy_hash = v_current.trust_policy_hash AND p_benchmark_snapshot_hash = v_current.benchmark_snapshot_hash AND
      (p_benchmark_version IS DISTINCT FROM v_current.benchmark_version OR
       p_revoked_certificate_hashes IS DISTINCT FROM v_current.revoked_certificate_hashes OR
       p_revoked_eligibility_hashes IS DISTINCT FROM v_current.revoked_eligibility_hashes)) OR
     EXISTS (SELECT 1 FROM unnest(v_current.revoked_certificate_hashes) AS x(value) WHERE value <> ALL(p_revoked_certificate_hashes)) OR
     EXISTS (SELECT 1 FROM unnest(v_current.revoked_eligibility_hashes) AS x(value) WHERE value <> ALL(p_revoked_eligibility_hashes)) THEN
    RAISE EXCEPTION 'authority generation rollback or revocation removal denied' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.reading_promotion_authority SET
    generation = p_generation, trust_policy_hash = p_trust_policy_hash,
    benchmark_version = p_benchmark_version, benchmark_snapshot_hash = p_benchmark_snapshot_hash,
    revoked_certificate_hashes = p_revoked_certificate_hashes,
    revoked_eligibility_hashes = p_revoked_eligibility_hashes,
    previous_trust_policy_hashes = CASE WHEN p_trust_policy_hash = v_current.trust_policy_hash
      THEN v_current.previous_trust_policy_hashes
      ELSE array_append(v_current.previous_trust_policy_hashes, v_current.trust_policy_hash) END,
    previous_benchmark_snapshot_hashes = CASE WHEN p_benchmark_snapshot_hash = v_current.benchmark_snapshot_hash
      THEN v_current.previous_benchmark_snapshot_hashes
      ELSE array_append(v_current.previous_benchmark_snapshot_hashes, v_current.benchmark_snapshot_hash) END,
    valid_until = p_valid_until, registered_by = auth.uid(), registered_at = clock_timestamp()
  WHERE singleton = true;
END $$;

CREATE FUNCTION public.approve_reading_promotion(p_request jsonb, p_rationale text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_authority public.reading_promotion_authority%ROWTYPE;
  v_order public.reading_product_order_revision%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'authenticated' OR
     auth.uid() IS NULL OR public.is_admin() IS DISTINCT FROM true OR
     NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND status = 'active') THEN
    RAISE EXCEPTION 'administrator identity required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_request IS NULL OR p_request->>'request_id' IS NULL OR p_request->>'article_id' IS NULL OR
     p_request->>'request_hash' !~ '^[a-f0-9]{64}$' OR
     p_request->>'order_hash' !~ '^[a-f0-9]{64}$' OR
     p_request->>'evidence_hash' !~ '^[a-f0-9]{64}$' OR
     p_request->>'certificate_hash' !~ '^[a-f0-9]{64}$' OR
     p_request->>'eligibility_hash' !~ '^[a-f0-9]{64}$' OR
     p_request->>'trust_policy_hash' !~ '^[a-f0-9]{64}$' OR
     p_request->>'benchmark_snapshot_hash' !~ '^[a-f0-9]{64}$' OR
     length(btrim(p_rationale)) < 20 THEN
    RAISE EXCEPTION 'promotion approval invalid' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_authority FROM public.reading_promotion_authority WHERE singleton = true FOR UPDATE;
  SELECT * INTO v_order FROM public.reading_product_order_revision WHERE order_id = p_request->>'product_order_id' FOR UPDATE;
  IF v_authority.singleton IS NULL OR v_authority.valid_until <= clock_timestamp() OR
     v_order.order_id IS NULL OR v_order.order_revision IS DISTINCT FROM (p_request->>'order_revision')::integer OR
     v_order.order_hash IS DISTINCT FROM p_request->>'order_hash' OR
     v_authority.trust_policy_hash IS DISTINCT FROM p_request->>'trust_policy_hash' OR
     v_authority.benchmark_version IS DISTINCT FROM p_request->>'benchmark_version' OR
     v_authority.benchmark_snapshot_hash IS DISTINCT FROM p_request->>'benchmark_snapshot_hash' OR
     p_request->>'certificate_hash' = ANY(v_authority.revoked_certificate_hashes) OR
     p_request->>'eligibility_hash' = ANY(v_authority.revoked_eligibility_hashes) THEN
    RAISE EXCEPTION 'promotion authority revision stale or revoked' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.reading_promotion_approval (
    request_id,article_id,request_hash,order_id,order_revision,order_hash,evidence_hash,
    certificate_hash,eligibility_hash,trust_policy_hash,benchmark_snapshot_hash,approved_by,rationale,request_payload
  ) VALUES (
    (p_request->>'request_id')::uuid,(p_request->>'article_id')::uuid,p_request->>'request_hash',
    p_request->>'product_order_id',(p_request->>'order_revision')::integer,p_request->>'order_hash',
    p_request->>'evidence_hash',p_request->>'certificate_hash',p_request->>'eligibility_hash',
    p_request->>'trust_policy_hash',p_request->>'benchmark_snapshot_hash',auth.uid(),p_rationale,p_request
  );
  RETURN jsonb_build_object('status','approved','request_id',p_request->>'request_id','approved_by',auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.trg_hold_reading_adaptation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.source_id LIKE 'reading:%' THEN
    IF NEW.source_id IS DISTINCT FROM OLD.source_id OR NEW.adapted_from_id IS DISTINCT FROM OLD.adapted_from_id THEN
      RAISE EXCEPTION 'Reading adaptation source identity is immutable (article_id=%)', NEW.id USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.status IN ('ready', 'published') AND
      (NEW.content IS DISTINCT FROM OLD.content OR NEW.composed_spec IS DISTINCT FROM OLD.composed_spec) THEN
      RAISE EXCEPTION 'Reviewed reading content is immutable (article_id=%)', NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.source_id LIKE 'reading:%' AND NEW.status IN ('ready', 'published') THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'queued' AND NEW.status = 'ready' AND
      EXISTS (
        SELECT 1 FROM public.reading_promotion_permit p
        WHERE p.article_id = NEW.id AND p.transaction_id = pg_catalog.txid_current()
      ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Reading adaptation requires separate promotion gate (article_id=%)', NEW.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_la_hold_reading_adaptation ON public.library_articles;
CREATE TRIGGER trg_la_hold_reading_adaptation
  BEFORE INSERT OR UPDATE OF status, source_id, adapted_from_id, content, composed_spec
  ON public.library_articles
  FOR EACH ROW EXECUTE FUNCTION public.trg_hold_reading_adaptation();

CREATE FUNCTION public.promote_reading_adaptation(p_request jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_request_id uuid;
  v_article_id uuid;
  v_source_id uuid;
  v_prior public.reading_promotion_audit%ROWTYPE;
  v_child public.library_articles%ROWTYPE;
  v_source public.library_articles%ROWTYPE;
  v_gold jsonb;
  v_authority public.reading_promotion_authority%ROWTYPE;
  v_order public.reading_product_order_revision%ROWTYPE;
  v_approval public.reading_promotion_approval%ROWTYPE;
  v_gate_at timestamptz;
  v_replay boolean;
  v_promoted integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR
     (SELECT count(*) FROM jsonb_object_keys(p_request)) <> 22 OR
     (p_request ?& ARRAY['request_id','request_hash','article_id','child_source_id','source_id',
       'source_content_sha256','child_content_sha256','source_updated_at','article_updated_at',
       'product_order_id','order_revision','order_hash','evidence_hash','certificate_hash',
       'eligibility_hash','trust_policy_hash','benchmark_version','benchmark_snapshot_hash','target_key',
       'rights_hash','requested_by','intent_hash']) IS NOT TRUE OR
     EXISTS (SELECT 1 FROM jsonb_each_text(p_request) AS e(k,v) WHERE v IS NULL OR length(btrim(v)) = 0) THEN
    RAISE EXCEPTION 'invalid promotion request shape' USING ERRCODE = 'check_violation';
  END IF;
  IF (p_request->>'request_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR
     (p_request->>'article_id') !~* '^[0-9a-f-]{36}$' OR
     (p_request->>'source_id') !~* '^[0-9a-f-]{36}$' OR
     (p_request->>'order_revision') !~ '^[1-9][0-9]*$' OR
     length(btrim(p_request->>'product_order_id')) = 0 OR
     length(btrim(p_request->>'requested_by')) = 0 THEN
    RAISE EXCEPTION 'invalid promotion request identity' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each_text(p_request) AS e(k,v)
    WHERE (k LIKE '%hash%' OR k LIKE '%sha256%') AND v !~ '^[a-f0-9]{64}$'
  ) THEN
    RAISE EXCEPTION 'invalid promotion request digest' USING ERRCODE = 'check_violation';
  END IF;
  v_request_id := (p_request->>'request_id')::uuid;
  v_article_id := (p_request->>'article_id')::uuid;
  v_source_id := (p_request->>'source_id')::uuid;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request_id::text, 0));
  SELECT * INTO v_prior FROM public.reading_promotion_audit WHERE request_id = v_request_id FOR UPDATE;
  v_replay := FOUND;
  IF v_replay AND (v_prior.request_payload IS DISTINCT FROM p_request OR v_prior.request_hash IS DISTINCT FROM p_request->>'request_hash') THEN
    RAISE EXCEPTION 'promotion replay conflict' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_child FROM public.library_articles WHERE id = v_article_id FOR UPDATE;
  SELECT * INTO v_source FROM public.library_articles WHERE id = v_source_id FOR UPDATE;
  IF v_child.id IS NULL OR v_source.id IS NULL OR
     v_child.status IS DISTINCT FROM (CASE WHEN v_replay THEN 'ready' ELSE 'queued' END) OR
     v_child.source_id NOT LIKE 'reading:%' OR v_child.source_id <> p_request->>'child_source_id' OR
     v_child.adapted_from_id IS DISTINCT FROM v_source.id THEN
    RAISE EXCEPTION 'queued reading child or source changed' USING ERRCODE = 'check_violation';
  END IF;
  IF v_source.status IN ('archived','failed') OR v_source.license_class IS NULL OR v_source.license_class NOT IN ('cc_by','cc0','public_domain','cc_by_sa') OR
     v_source.display_only IS DISTINCT FROM false OR v_source.copyright_safe_in_kr IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current source rights blocked' USING ERRCODE = 'check_violation';
  END IF;
  IF v_child.source IS DISTINCT FROM v_source.source OR v_child.license IS DISTINCT FROM v_source.license OR
     v_child.license_class IS DISTINCT FROM v_source.license_class OR
     v_child.display_only IS DISTINCT FROM false OR v_child.copyright_safe_in_kr IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current child rights blocked' USING ERRCODE = 'check_violation';
  END IF;
  IF encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex') IS DISTINCT FROM p_request->>'source_content_sha256' OR
     encode(extensions.digest(convert_to(v_child.content,'UTF8'),'sha256'),'hex') IS DISTINCT FROM p_request->>'child_content_sha256' OR
     v_source.updated_at IS DISTINCT FROM (p_request->>'source_updated_at')::timestamptz OR
     (NOT v_replay AND v_child.updated_at IS DISTINCT FROM (p_request->>'article_updated_at')::timestamptz) THEN
    RAISE EXCEPTION 'live source or adaptation changed' USING ERRCODE = 'check_violation';
  END IF;
  v_gold := v_child.composed_spec #> '{academic_reading,provenance,gold_s}';
  IF v_gold IS NULL OR v_gold->>'state' IS DISTINCT FROM 'gold_s' OR v_gold->>'seed_eligible' IS DISTINCT FROM 'true' OR
     v_gold->>'production' IS DISTINCT FROM 'false' OR v_gold->>'source_id' IS DISTINCT FROM v_source.id::text OR
     v_gold->>'target_key' IS DISTINCT FROM p_request->>'target_key' OR
     v_gold->>'certificate_hash' IS DISTINCT FROM p_request->>'certificate_hash' OR
     v_gold->>'eligibility_hash' IS DISTINCT FROM p_request->>'eligibility_hash' OR
     v_gold->>'trust_policy_hash' IS DISTINCT FROM p_request->>'trust_policy_hash' OR
     v_gold->>'benchmark_version' IS DISTINCT FROM p_request->>'benchmark_version' OR
     v_gold->>'benchmark_snapshot_hash' IS DISTINCT FROM p_request->>'benchmark_snapshot_hash' OR
     v_gold->>'rights_hash' IS DISTINCT FROM p_request->>'rights_hash' THEN
    RAISE EXCEPTION 'seeded Gold-S evidence changed' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO v_authority FROM public.reading_promotion_authority WHERE singleton = true FOR UPDATE;
  SELECT * INTO v_order FROM public.reading_product_order_revision WHERE order_id = p_request->>'product_order_id' FOR UPDATE;
  IF NOT v_replay THEN
    SELECT * INTO v_approval FROM public.reading_promotion_approval WHERE request_id = v_request_id FOR UPDATE;
  END IF;
  v_gate_at := clock_timestamp();
  IF v_authority.singleton IS NULL OR v_authority.valid_until <= v_gate_at OR
     v_order.order_id IS NULL OR v_order.order_revision IS DISTINCT FROM (p_request->>'order_revision')::integer OR
     v_order.order_hash IS DISTINCT FROM p_request->>'order_hash' OR
     v_authority.trust_policy_hash IS DISTINCT FROM p_request->>'trust_policy_hash' OR
     v_authority.benchmark_version IS DISTINCT FROM p_request->>'benchmark_version' OR
     v_authority.benchmark_snapshot_hash IS DISTINCT FROM p_request->>'benchmark_snapshot_hash' OR
     p_request->>'certificate_hash' = ANY(v_authority.revoked_certificate_hashes) OR
     p_request->>'eligibility_hash' = ANY(v_authority.revoked_eligibility_hashes) THEN
    RAISE EXCEPTION 'current promotion authority changed or revoked' USING ERRCODE = 'check_violation';
  END IF;
  IF v_replay THEN
    RETURN jsonb_build_object('status','ready','request_id',v_request_id,'article_id',v_article_id,'replayed',true,'evidence_current',true);
  END IF;
  IF v_approval.request_id IS NULL OR v_approval.consumed_at IS NOT NULL OR v_approval.expires_at <= v_gate_at OR
     v_approval.request_payload IS DISTINCT FROM p_request OR
     v_approval.article_id IS DISTINCT FROM v_article_id OR
     v_approval.request_hash IS DISTINCT FROM p_request->>'request_hash' OR
     v_approval.order_id IS DISTINCT FROM p_request->>'product_order_id' OR
     v_approval.order_revision IS DISTINCT FROM (p_request->>'order_revision')::integer OR
     v_approval.order_hash IS DISTINCT FROM p_request->>'order_hash' OR
     v_approval.evidence_hash IS DISTINCT FROM p_request->>'evidence_hash' OR
     v_approval.certificate_hash IS DISTINCT FROM p_request->>'certificate_hash' OR
     v_approval.eligibility_hash IS DISTINCT FROM p_request->>'eligibility_hash' OR
     v_approval.trust_policy_hash IS DISTINCT FROM p_request->>'trust_policy_hash' OR
     v_approval.benchmark_snapshot_hash IS DISTINCT FROM p_request->>'benchmark_snapshot_hash' THEN
    RAISE EXCEPTION 'current order-specific promotion approval required' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.reading_promotion_audit (
    request_id,article_id,source_id,request_hash,order_id,order_revision,order_hash,evidence_hash,
    certificate_hash,eligibility_hash,trust_policy_hash,benchmark_version,benchmark_snapshot_hash,requested_by,request_payload
  ) VALUES (
    v_request_id,v_article_id,v_source_id,p_request->>'request_hash',p_request->>'product_order_id',
    (p_request->>'order_revision')::integer,p_request->>'order_hash',p_request->>'evidence_hash',
    p_request->>'certificate_hash',p_request->>'eligibility_hash',p_request->>'trust_policy_hash',
    p_request->>'benchmark_version',p_request->>'benchmark_snapshot_hash',p_request->>'requested_by',p_request
  );
  INSERT INTO public.reading_promotion_permit(request_id,article_id,transaction_id)
    VALUES (v_request_id,v_article_id,pg_catalog.txid_current());
  UPDATE public.library_articles SET status = 'ready' WHERE id = v_article_id AND status = 'queued';
  GET DIAGNOSTICS v_promoted = ROW_COUNT;
  IF v_promoted <> 1 THEN RAISE EXCEPTION 'promotion update lost race' USING ERRCODE = 'check_violation'; END IF;
  UPDATE public.reading_promotion_approval SET consumed_at = v_gate_at WHERE request_id = v_request_id;
  DELETE FROM public.reading_promotion_permit WHERE request_id = v_request_id;
  RETURN jsonb_build_object('status','ready','request_id',v_request_id,'article_id',v_article_id,'replayed',false,'evidence_current',true);
END $$;

REVOKE ALL ON FUNCTION public.promote_reading_adaptation(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_reading_adaptation(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.register_reading_product_order(text,integer,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_reading_product_order(text,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION public.register_reading_promotion_authority(bigint,text,text,text,text[],text[],timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.register_reading_promotion_authority(bigint,text,text,text,text[],text[],timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.approve_reading_promotion(jsonb,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.approve_reading_promotion(jsonb,text) TO authenticated;

COMMIT;
