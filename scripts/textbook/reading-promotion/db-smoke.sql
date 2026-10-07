-- scripts/textbook/reading-promotion/db-smoke.sql
-- Development-DB test only. The entire synthetic fixture is rolled back.
-- Run only after the controlled-promotion migration is applied.
BEGIN;
DO $smoke$
DECLARE
  v_admin uuid;
  v_source public.library_articles%ROWTYPE;
  v_child public.library_articles%ROWTYPE;
  v_request jsonb;
  v_response jsonb;
  v_order text := 'phase2-smoke:' || gen_random_uuid()::text;
  v_cert text := repeat('c',64);
  v_eligibility text := repeat('d',64);
  v_trust text := repeat('e',64);
  v_benchmark text := repeat('f',64);
BEGIN
  SELECT user_id INTO STRICT v_admin FROM public.user_profiles WHERE role='admin' AND status='active';
  INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,display_only,copyright_safe_in_kr)
  VALUES ('manual','phase2-smoke:'||gen_random_uuid(),'Synthetic source','CC BY 4.0','cc_by','Synthetic source claim and evidence.','queued',false,true)
  RETURNING * INTO v_source;
  INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,display_only,copyright_safe_in_kr,adapted_from_id,composed_spec)
  VALUES ('manual','reading:phase2-smoke:'||gen_random_uuid(),'Synthetic adaptation','CC BY 4.0','cc_by','Synthetic adaptation preserving the claim.','queued',false,true,v_source.id,
    jsonb_build_object('academic_reading',jsonb_build_object('provenance',jsonb_build_object('gold_s',
      jsonb_build_object('state','gold_s','seed_eligible',true,'production',false,'source_id',v_source.id::text,
      'target_key','middle_1','certificate_hash',v_cert,'eligibility_hash',v_eligibility,
      'trust_policy_hash',v_trust,'benchmark_version','phase2-smoke-v1',
      'benchmark_snapshot_hash',v_benchmark,'rights_hash',repeat('1',64))))))
  RETURNING * INTO v_child;

  BEGIN
    UPDATE public.library_articles SET status='ready' WHERE id=v_child.id;
    RAISE EXCEPTION 'direct ready UPDATE unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.library_articles SET status='published' WHERE id=v_child.id;
    RAISE EXCEPTION 'direct published UPDATE unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;

  v_request := jsonb_build_object(
    'request_id',gen_random_uuid()::text,'request_hash',repeat('a',64),'article_id',v_child.id::text,
    'child_source_id',v_child.source_id,'source_id',v_source.id::text,
    'source_content_sha256',encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex'),
    'child_content_sha256',encode(extensions.digest(convert_to(v_child.content,'UTF8'),'sha256'),'hex'),
    'source_updated_at',v_source.updated_at::text,'article_updated_at',v_child.updated_at::text,
    'product_order_id',v_order,'order_revision','1','order_hash',repeat('2',64),
    'evidence_hash',repeat('3',64),'certificate_hash',v_cert,'eligibility_hash',v_eligibility,
    'trust_policy_hash',v_trust,'benchmark_version','phase2-smoke-v1','benchmark_snapshot_hash',v_benchmark,
    'target_key','middle_1','rights_hash',repeat('1',64),'requested_by','phase2-smoke','intent_hash',repeat('4',64));

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  BEGIN
    PERFORM public.promote_reading_adaptation(v_request);
    RAISE EXCEPTION 'promotion without approval unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM public.register_reading_product_order(v_order,1,repeat('2',64));
  PERFORM public.register_reading_promotion_authority(1,v_trust,'phase2-smoke-v1',v_benchmark,ARRAY[]::text[],ARRAY[]::text[],clock_timestamp()+interval '1 hour');
  PERFORM public.approve_reading_promotion(v_request,'Synthetic Phase 2 rollback-only smoke approval.');
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  BEGIN
    PERFORM public.promote_reading_adaptation(jsonb_set(v_request,'{evidence_hash}',to_jsonb(repeat('9',64))));
    RAISE EXCEPTION 'mixed evidence unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.reading_promotion_approval SET expires_at=clock_timestamp()-interval '1 second'
    WHERE request_id=(v_request->>'request_id')::uuid;
  BEGIN
    PERFORM public.promote_reading_adaptation(v_request);
    RAISE EXCEPTION 'expired approval unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.reading_promotion_approval SET expires_at=clock_timestamp()+interval '15 minutes'
    WHERE request_id=(v_request->>'request_id')::uuid;
  v_response := public.promote_reading_adaptation(v_request);
  IF v_response->>'status' <> 'ready' OR v_response->>'replayed' <> 'false' THEN
    RAISE EXCEPTION 'first promotion response invalid';
  END IF;
  SELECT * INTO v_child FROM public.library_articles WHERE id=v_child.id;
  IF v_child.status <> 'ready' OR
     (SELECT count(*) FROM public.reading_promotion_audit WHERE article_id=v_child.id) <> 1 OR
     (SELECT count(*) FROM public.reading_promotion_permit WHERE article_id=v_child.id) <> 0 THEN
    RAISE EXCEPTION 'atomic ready/audit/permit invariant failed';
  END IF;
  v_response := public.promote_reading_adaptation(v_request);
  IF v_response->>'replayed' <> 'true' OR
     (SELECT count(*) FROM public.reading_promotion_audit WHERE article_id=v_child.id) <> 1 THEN
    RAISE EXCEPTION 'idempotent replay failed';
  END IF;
  BEGIN
    UPDATE public.library_articles SET status='published' WHERE id=v_child.id;
    RAISE EXCEPTION 'generic publish unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.reading_promotion_authority SET revoked_certificate_hashes=ARRAY[v_cert] WHERE singleton=true;
  BEGIN
    PERFORM public.promote_reading_adaptation(v_request);
    RAISE EXCEPTION 'revoked replay unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.reading_promotion_authority SET revoked_certificate_hashes=ARRAY[]::text[] WHERE singleton=true;
  UPDATE public.reading_product_order_revision SET order_revision=2,order_hash=repeat('8',64) WHERE order_id=v_order;
  BEGIN
    PERFORM public.promote_reading_adaptation(v_request);
    RAISE EXCEPTION 'stale order replay unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.reading_product_order_revision SET order_revision=1,order_hash=repeat('2',64) WHERE order_id=v_order;
  UPDATE public.reading_promotion_authority SET valid_until=clock_timestamp()-interval '1 second' WHERE singleton=true;
  BEGIN
    PERFORM public.promote_reading_adaptation(v_request);
    RAISE EXCEPTION 'expired authority replay unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.reading_promotion_authority SET valid_until=clock_timestamp()+interval '1 hour' WHERE singleton=true;
  UPDATE public.library_articles SET display_only=true WHERE id=v_source.id;
  BEGIN
    PERFORM public.promote_reading_adaptation(v_request);
    RAISE EXCEPTION 'stale replay unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'Phase 2 synthetic DB smoke passed; transaction will roll back';
END $smoke$;
ROLLBACK;
