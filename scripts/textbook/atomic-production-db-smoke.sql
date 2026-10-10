-- scripts/textbook/atomic-production-db-smoke.sql
-- Run only after the reviewed migration is approved and applied to development DB.
-- Synthetic source, child, item, group, snapshot and artifact all roll back.
BEGIN;
DO $smoke$
DECLARE
  v_admin uuid; v_source public.library_articles%ROWTYPE; v_child public.library_articles%ROWTYPE;
  v_order text := 'atomic-smoke:' || gen_random_uuid()::text;
  v_group text := 'atomic-group:' || gen_random_uuid()::text;
  v_audit_id uuid := gen_random_uuid(); v_item_id uuid := gen_random_uuid();
  v_trust text := repeat('a',64); v_benchmark text := repeat('b',64);
  v_cert text := repeat('c',64); v_eligibility text := repeat('d',64);
  v_order_hash text := repeat('e',64); v_evidence text := repeat('f',64);
  v_request_hash text := repeat('1',64); v_rights text := repeat('2',64);
  v_output text := '<section>Atomic synthetic output</section>';
  v_output_hash text; v_payload jsonb; v_group_document jsonb; v_evidence_document jsonb;
  v_sections jsonb; v_capture jsonb; v_approved jsonb; v_result jsonb;
  v_gold_public bytea; v_gold_secret bytea; v_seed_public bytea; v_seed_secret bytea;
  v_policy jsonb; v_certificate jsonb; v_eligibility_record jsonb; v_passage_hash text; v_content_hash text;
  v_review_digest text;
  v_issued text; v_valid_from text; v_valid_until text;
  v_order_document jsonb; v_target_key text;
BEGIN
  IF public._reading_canonical_json('{"2":1,"10":2}'::jsonb) <> '{"2":1,"10":2}' THEN
    RAISE EXCEPTION 'numeric object-key canonicalization differs from JavaScript';
  END IF;
  BEGIN
    PERFORM public._reading_canonical_json('{"한글":1}'::jsonb);
    RAISE EXCEPTION 'non-ASCII key unexpectedly accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT user_id INTO STRICT v_admin FROM public.user_profiles WHERE role='admin' AND status='active';
  v_output_hash := encode(extensions.digest(convert_to(v_output,'UTF8'),'sha256'),'hex');
  INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,display_only,copyright_safe_in_kr)
    VALUES('manual','atomic-smoke:'||gen_random_uuid(),'Atomic synthetic source','CC BY 4.0','cc_by',
      'Synthetic source claim and evidence.','queued',false,true) RETURNING * INTO v_source;
  v_rights := public._reading_json_hash(jsonb_build_object('id',v_source.id,
    'source_id',v_source.source_id,'source_url',v_source.source_url,'content',v_source.content,
    'csat_fit',v_source.csat_fit,'license',v_source.license,'license_class',v_source.license_class,
    'display_only',v_source.display_only,'copyright_safe_in_kr',v_source.copyright_safe_in_kr,
    'status',v_source.status,'updated_at',v_source.updated_at));
  v_issued := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_valid_from := to_char((clock_timestamp()-interval '1 minute') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_valid_until := to_char((clock_timestamp()+interval '30 minutes') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,
    display_only,copyright_safe_in_kr,adapted_from_id)
    VALUES('manual','reading:atomic-smoke:'||gen_random_uuid(),'Atomic synthetic child','CC BY 4.0','cc_by',
      'Synthetic student explanation.','queued',false,true,v_source.id)
    RETURNING * INTO v_child;
  v_order_document := jsonb_build_object('product_order_id',v_order,'order_revision',1,
    'grade_target','middle_1','target',jsonb_build_object('age_band','middle_1','resources','[]'::jsonb));
  v_order_hash := public._reading_json_hash(v_order_document);
  v_target_key := public._reading_target_key(v_order_document->'target');
  SELECT public,secret INTO v_gold_public,v_gold_secret FROM pgsodium.crypto_sign_new_keypair();
  SELECT public,secret INTO v_seed_public,v_seed_secret FROM pgsodium.crypto_sign_new_keypair();
  v_policy := jsonb_build_object('schema','frym-gold-s-operational-policy/1','revision','atomic-smoke-v1',
    'gold_issuers',jsonb_build_array(jsonb_build_object('id','atomic-gold',
      'public_key','-----BEGIN PUBLIC KEY-----'||E'\n'||
        encode(decode('302a300506032b6570032100','hex')||v_gold_public,'base64')||E'\n'||
        '-----END PUBLIC KEY-----','valid_from',v_valid_from,
      'valid_until',v_valid_until)),
    'seed_issuers',jsonb_build_array(jsonb_build_object('id','atomic-seed',
      'public_key','-----BEGIN PUBLIC KEY-----'||E'\n'||
        encode(decode('302a300506032b6570032100','hex')||v_seed_public,'base64')||E'\n'||
        '-----END PUBLIC KEY-----','valid_from',v_valid_from,
      'valid_until',v_valid_until)),
    'gold_max_age_days',30,'seed_max_age_days',7,
    'revoked',jsonb_build_object('certificate_hashes','[]'::jsonb,
      'eligibility_hashes','[]'::jsonb,'issuer_ids','[]'::jsonb));
  v_trust := public._reading_json_hash(v_policy);
  v_order_document := v_order_document || jsonb_build_object('trust_policy_hash',v_trust);
  v_order_hash := public._reading_json_hash(v_order_document);
  v_passage_hash := public._reading_json_hash(to_jsonb(btrim(v_child.content)));
  v_content_hash := public._reading_json_hash(jsonb_build_object('source_id',v_source.id::text,
    'target_key',v_target_key,'passage_hash',v_passage_hash));
  v_certificate := jsonb_build_object('schema','frym-gold-s-certificate/1',
    'issuer_id','atomic-gold','source_id',v_source.id::text,'target_key',v_target_key,
    'passage_hash',v_passage_hash,'content_hash',v_content_hash,'rights_hash',v_rights,
    'certificate_id',gen_random_uuid()::text,'curator_id','atomic-curator','owner_id','atomic-owner',
    'benchmark_version','atomic-smoke-v1','benchmark_snapshot_hash',v_benchmark,
    'review_evidence_hash',repeat('3',64),'decision_hash',repeat('4',64),
    'distribution_hash',repeat('5',64),'review_hash',repeat('6',64),
    'admission_receipt_hash',repeat('7',64),'issued_at',v_issued);
  v_certificate := v_certificate || jsonb_build_object('signature',
    regexp_replace(encode(pgsodium.crypto_sign_detached(convert_to(public._reading_json_hash(v_certificate),'UTF8'),
      v_gold_secret),'base64'),'[[:space:]]','','g'));
  v_cert := public._reading_json_hash(v_certificate);
  v_eligibility_record := jsonb_build_object('schema','frym-seed-eligibility/1',
    'issuer_id','atomic-seed','certificate_hash',v_cert,'content_hash',v_content_hash,
    'rights_hash',v_rights,'eligibility_id',gen_random_uuid()::text,
    'operations_id','atomic-operations','approver_id','atomic-approver',
    'seed_evidence_hash',repeat('8',64),'operations_hash',repeat('9',64),
    'approval_hash',repeat('a',64),'issued_at',v_issued);
  v_eligibility_record := v_eligibility_record || jsonb_build_object('signature',
    regexp_replace(encode(pgsodium.crypto_sign_detached(convert_to(public._reading_json_hash(v_eligibility_record),'UTF8'),
      v_seed_secret),'base64'),'[[:space:]]','','g'));
  v_eligibility := public._reading_json_hash(v_eligibility_record);
  UPDATE public.library_articles SET composed_spec=jsonb_build_object('academic_reading',
    jsonb_build_object('provenance',jsonb_build_object('gold_s',jsonb_build_object(
      'state','gold_s','seed_eligible',true,'production',false,'source_id',v_source.id::text,
      'target_key',v_target_key,'certificate_hash',v_cert,'eligibility_hash',v_eligibility,
      'trust_policy_hash',v_trust,'benchmark_version','atomic-smoke-v1',
      'benchmark_snapshot_hash',v_benchmark,'rights_hash',v_rights,
      'evidence_valid_until',v_policy #>> '{gold_issuers,0,valid_until}',
      'proof_bundle',jsonb_build_object('certificate',v_certificate,'eligibility',v_eligibility_record),
       'operational_policy',v_policy)))) WHERE id=v_child.id RETURNING * INTO v_child;
  INSERT INTO public.reading_product_order_revision(order_id,order_revision,order_hash,registered_by)
    VALUES(v_order,1,v_order_hash,v_admin);
  INSERT INTO public.reading_promotion_authority(singleton,generation,trust_policy_hash,benchmark_version,
    benchmark_snapshot_hash,valid_until,registered_by)
    VALUES(true,1,v_trust,'atomic-smoke-v1',v_benchmark,clock_timestamp()+interval '30 minutes',v_admin);
  v_payload := jsonb_build_object('source_content_sha256',
    encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex'),
    'child_content_sha256',encode(extensions.digest(convert_to(v_child.content,'UTF8'),'sha256'),'hex'),
    'source_updated_at',v_source.updated_at::text,'article_updated_at',v_child.updated_at::text,
    'rights_hash',v_rights,'target_key',v_target_key,'request_id',v_audit_id,
    'article_id',v_child.id,'child_source_id',v_child.source_id,'source_id',v_source.id,
    'product_order_id',v_order,'order_revision',1,'order_hash',v_order_hash,
    'evidence_hash',v_evidence,'certificate_hash',v_cert,'eligibility_hash',v_eligibility,
    'trust_policy_hash',v_trust,'benchmark_version','atomic-smoke-v1',
    'benchmark_snapshot_hash',v_benchmark,'requested_by','atomic-smoke',
    'intent_hash',repeat('4',64));
  v_request_hash := public._reading_json_hash(v_payload);
  v_payload := v_payload || jsonb_build_object('request_hash',v_request_hash);
  INSERT INTO public.reading_promotion_audit(request_id,article_id,source_id,request_hash,order_id,
    order_revision,order_hash,evidence_hash,certificate_hash,eligibility_hash,trust_policy_hash,
    benchmark_version,benchmark_snapshot_hash,requested_by,request_payload)
    VALUES(v_audit_id,v_child.id,v_source.id,v_request_hash,v_order,1,v_order_hash,v_evidence,
      v_cert,v_eligibility,v_trust,'atomic-smoke-v1',v_benchmark,'atomic-smoke',v_payload);
  INSERT INTO public.reading_promotion_permit(request_id,article_id,transaction_id)
    VALUES(v_audit_id,v_child.id,pg_catalog.txid_current());
  UPDATE public.library_articles SET status='ready' WHERE id=v_child.id;
  DELETE FROM public.reading_promotion_permit WHERE request_id=v_audit_id;
  SELECT * INTO v_child FROM public.library_articles WHERE id=v_child.id;
  INSERT INTO public.csat_dcp_items(id,kind,ref_id,type,payload,answer_key,paragraph_idx)
    VALUES(v_item_id,'article',v_child.id,'order',jsonb_build_object('passage',v_child.content,
      'factory_lineage',jsonb_build_object('product_order_id',v_order,'order_revision',1,
        'order_hash',v_order_hash,'promotion_request_id',v_audit_id,'promotion_request_hash',v_request_hash,
        'evidence_hash',v_evidence,'source_hash',v_payload->>'source_content_sha256',
        'adaptation_hash',v_payload->>'child_content_sha256','source_revision',v_source.updated_at,
        'adaptation_revision',v_child.updated_at,'rights_hash',v_rights,'certificate_hash',v_cert,
        'eligibility_hash',v_eligibility,'trust_policy_hash',v_trust,'benchmark_version','atomic-smoke-v1',
        'benchmark_snapshot_hash',v_benchmark)),
      jsonb_build_object('answer',1,'explanation_ko','Synthetic explanation.'),0);
  SELECT public._reading_json_hash(jsonb_build_object('payload',payload,'answer_key',answer_key))
    INTO v_review_digest FROM public.csat_dcp_items WHERE id=v_item_id;
  INSERT INTO public.csat_item_reviews(item_id,persona,verdict,reviewed_digest)
    SELECT v_item_id,persona,'pass',v_review_digest
      FROM unnest(ARRAY['setter','analyst','tutor']) AS persona;
  IF public._reading_verify_ed25519(v_certificate || jsonb_build_object('source_id',gen_random_uuid()::text),
    v_policy #>> '{gold_issuers,0,public_key}') THEN
    RAISE EXCEPTION 'forged Gold-S signature accepted';
  END IF;
  IF public._reading_verify_ed25519(v_certificate || jsonb_build_object('signature',
    v_certificate->>'signature' || E'\n'),v_policy #>> '{gold_issuers,0,public_key}') THEN
    RAISE EXCEPTION 'noncanonical signature representation accepted';
  END IF;
  v_sections := jsonb_build_array(jsonb_build_object('grade','middle_1','order_id',v_order,
    'article_id',v_child.id,'audit_id',v_audit_id,'item_ids',jsonb_build_array(v_item_id)));
  v_group_document := jsonb_build_object('group_id',v_group,'group_revision',1,
    'grade_scope',jsonb_build_object('mode','single_grade','grades',jsonb_build_array('middle_1')),
    'orders',jsonb_build_array(jsonb_build_object('grade','middle_1','order',v_order_document)));
  v_evidence_document := jsonb_build_object('group_id',v_group,'group_revision',1,
    'group_hash',public._reading_json_hash(v_group_document),
    'source_id',v_source.id::text,'source_hash',v_payload->>'source_content_sha256',
    'rights_hash',v_rights,
    'variants',jsonb_build_array(jsonb_build_object('grade','middle_1','product_order_id',v_order,
      'order_revision',1,'order_hash',v_order_hash,
      'passage_hash',v_payload->>'child_content_sha256','adaptation_hash',v_passage_hash,
      'benchmark_version','atomic-smoke-v1','benchmark_snapshot_hash',v_benchmark,
      'item_set_hash',public._reading_json_hash(jsonb_build_array(jsonb_build_array(v_item_id,v_review_digest))))));
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM public.register_reading_production_group(v_group,1,v_sections,v_group_document,v_evidence_document);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  v_result := public.read_reading_order_production_trace(v_order);
  IF v_result->>'status' <> 'registered_unverified' OR v_result->>'group_id' <> v_group THEN
    RAISE EXCEPTION 'production group observation failed'; END IF;
  UPDATE public.reading_product_order_revision SET order_revision=2 WHERE order_id=v_order;
  v_result := public.read_reading_order_production_trace(v_order);
  IF v_result->>'status' <> 'registered_stale' THEN
    RAISE EXCEPTION 'stale registered order observed as current'; END IF;
  UPDATE public.reading_product_order_revision SET order_revision=1 WHERE order_id=v_order;
  v_capture := public.capture_reading_production_snapshot(v_group);
  v_result := public.read_reading_order_production_trace(v_order);
  IF v_result->>'status' <> 'captured_current' OR
     v_result->>'snapshot_id' <> v_capture->>'snapshot_id' THEN
    RAISE EXCEPTION 'captured production observation failed'; END IF;
  IF v_capture->'evidence'->'sections'->0->>'article_id' <> v_child.id::text THEN
    RAISE EXCEPTION 'atomic capture mixed article';
  END IF;
  BEGIN
    UPDATE public.library_articles SET display_only=true WHERE id=v_source.id;
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'rights revocation unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.csat_dcp_items SET answer_key=jsonb_set(answer_key,'{explanation_ko}',
      to_jsonb('Changed explanation.'::text)) WHERE id=v_item_id;
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'changed explanation unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.csat_item_reviews SET reviewed_digest=repeat('9',64) WHERE item_id=v_item_id;
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'stale item review unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.reading_promotion_authority SET valid_until=clock_timestamp()-interval '1 second'
      WHERE singleton=true;
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'expired authority unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.reading_product_order_revision SET order_revision=2 WHERE order_id=v_order;
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'changed order revision unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.csat_item_state(item_id,status,reason_code,reason)
      VALUES(v_item_id,'blocked','spec_stale','Atomic smoke blocked item');
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'blocked item unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
    v_capture->>'snapshot_hash',v_output_hash);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  BEGIN
    PERFORM public.approve_reading_production_output((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'self approval unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- Simulate a second administrator in this rollback-only fixture. The RPC
  -- above already demonstrated that the registrant cannot self-approve.
  UPDATE public.reading_production_group SET registered_by=gen_random_uuid() WHERE group_id=v_group;
  v_approved := public.approve_reading_production_output((v_capture->>'snapshot_id')::uuid,
    v_capture->>'snapshot_hash',v_output_hash);
  IF v_approved->>'approved_output_hash' <> v_output_hash THEN RAISE EXCEPTION 'approval failed'; END IF;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  BEGIN
    UPDATE public.csat_dcp_items SET answer_key=jsonb_set(answer_key,'{explanation_ko}',
      to_jsonb('New approved-looking explanation.'::text)) WHERE id=v_item_id;
    SELECT public._reading_json_hash(jsonb_build_object('payload',payload,'answer_key',answer_key))
      INTO v_review_digest FROM public.csat_dcp_items WHERE id=v_item_id;
    UPDATE public.csat_item_reviews SET reviewed_digest=v_review_digest WHERE item_id=v_item_id;
    v_capture := public.capture_reading_production_snapshot(v_group);
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    PERFORM public.publish_reading_production_artifact((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output);
    RAISE EXCEPTION 'old output approval accepted after evidence change';
  EXCEPTION WHEN check_violation THEN NULL; END;
  v_capture := public.capture_reading_production_snapshot(v_group);
  v_result := public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
    v_capture->>'snapshot_hash',v_output_hash);
  IF v_result->>'status' <> 'rendered_unpublished' THEN RAISE EXCEPTION 'finalization failed'; END IF;
  v_result := public.read_reading_order_production_trace(v_order);
  IF v_result->>'status' <> 'rendered_current' OR v_result->>'output_hash' <> v_output_hash THEN
    RAISE EXCEPTION 'rendered production observation failed'; END IF;
  BEGIN
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'finalization replay unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.publish_reading_production_artifact((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash','Different HTML');
    RAISE EXCEPTION 'unapproved HTML unexpectedly published';
  EXCEPTION WHEN check_violation THEN NULL; END;
  v_result := public.publish_reading_production_artifact((v_capture->>'snapshot_id')::uuid,
    v_capture->>'snapshot_hash',v_output);
  IF v_result->>'status' <> 'published_current' THEN RAISE EXCEPTION 'publication failed'; END IF;
  v_result := public.serve_reading_production_artifact((v_capture->>'snapshot_id')::uuid);
  IF v_result->>'html' <> v_output THEN RAISE EXCEPTION 'serve output mismatch'; END IF;
  v_result := public.read_reading_order_production_trace(v_order);
  IF v_result->>'status' <> 'published_current' THEN
    RAISE EXCEPTION 'published production observation failed'; END IF;
  UPDATE public.reading_production_group SET approved_snapshot_id=NULL WHERE group_id=v_group;
  v_result := public.read_reading_order_production_trace(v_order);
  IF v_result->>'status' <> 'stale' THEN
    RAISE EXCEPTION 'detached publication approval observed as current'; END IF;
  UPDATE public.reading_production_group SET approved_snapshot_id=(v_capture->>'snapshot_id')::uuid
    WHERE group_id=v_group;
  UPDATE public.reading_promotion_authority SET revoked_certificate_hashes=ARRAY[v_cert] WHERE singleton=true;
  v_result := public.read_reading_order_production_trace(v_order);
  IF v_result->>'status' <> 'unmeasured' THEN
    RAISE EXCEPTION 'revoked production observation unexpectedly current'; END IF;
  BEGIN
    PERFORM public.serve_reading_production_artifact((v_capture->>'snapshot_id')::uuid);
    RAISE EXCEPTION 'revoked certificate unexpectedly served';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $smoke$;
SET LOCAL ROLE anon;
DO $role_smoke$
BEGIN
  BEGIN
    PERFORM public.capture_reading_production_snapshot('nonexistent-atomic-smoke');
    RAISE EXCEPTION 'anon unexpectedly invoked production capture';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.read_reading_order_production_trace('nonexistent-atomic-smoke');
    RAISE EXCEPTION 'anon unexpectedly invoked production observation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $role_smoke$;
RESET ROLE;
ROLLBACK;
