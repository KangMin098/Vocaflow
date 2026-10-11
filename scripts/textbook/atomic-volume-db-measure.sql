-- scripts/textbook/atomic-volume-db-measure.sql
-- Rollback-only live measurement of the DB-proven volume (migration 20261011022148).
-- Two days of ONE registered order are promoted, grouped, captured, approved, finalized and
-- published through the real RPCs, then registered and served as one volume. Revoking day 2's
-- certificate must make the volume unservable. Keys are injected by atomic-volume-db-measure.mjs
-- (__GOLD_PUBLIC__ ...). Everything rolls back; nothing persists.
BEGIN;
CREATE TEMP TABLE _volume_measure(step text, ok boolean, detail text) ON COMMIT DROP;
DO $measure$
DECLARE
  v_admin uuid; v_source public.library_articles%ROWTYPE; v_child public.library_articles%ROWTYPE;
  v_order text := 'atomic-volume-measure:' || gen_random_uuid()::text;
  v_benchmark text := repeat('b',64); v_evidence text := repeat('f',64);
  v_gold_public bytea := decode('__GOLD_PUBLIC__','hex'); v_gold_secret bytea := decode('__GOLD_SECRET__','hex');
  v_seed_public bytea := decode('__SEED_PUBLIC__','hex'); v_seed_secret bytea := decode('__SEED_SECRET__','hex');
  v_policy jsonb; v_trust text; v_order_document jsonb; v_order_hash text; v_target_key text; v_rights text;
  v_issued text; v_valid_from text; v_valid_until text; v_day integer;
  v_audit_id uuid; v_item_id uuid; v_group text; v_passage_hash text; v_content_hash text;
  v_certificate jsonb; v_cert text; v_eligibility_record jsonb; v_eligibility text;
  v_payload jsonb; v_request_hash text; v_review_digest text; v_output text; v_output_hash text;
  v_sections jsonb; v_group_document jsonb; v_evidence_document jsonb; v_capture jsonb; v_result jsonb;
  v_volume_sections jsonb := '[]'::jsonb; v_day2_cert text; v_served jsonb;
BEGIN
  SELECT user_id INTO STRICT v_admin FROM public.user_profiles WHERE role='admin' AND status='active';
  v_issued := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_valid_from := to_char((clock_timestamp()-interval '1 minute') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_valid_until := to_char((clock_timestamp()+interval '30 minutes') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,display_only,copyright_safe_in_kr)
    VALUES('manual','atomic-volume-measure:'||gen_random_uuid(),'Volume measure source','CC BY 4.0','cc_by',
      'Synthetic source claim and evidence for two days.','queued',false,true) RETURNING * INTO v_source;
  v_rights := public._reading_json_hash(jsonb_build_object('id',v_source.id,
    'source_id',v_source.source_id,'source_url',v_source.source_url,'content',v_source.content,
    'csat_fit',v_source.csat_fit,'license',v_source.license,'license_class',v_source.license_class,
    'display_only',v_source.display_only,'copyright_safe_in_kr',v_source.copyright_safe_in_kr,
    'status',v_source.status,'updated_at',v_source.updated_at));
  v_policy := jsonb_build_object('schema','frym-gold-s-operational-policy/1','revision','atomic-volume-measure-v1',
    'gold_issuers',jsonb_build_array(jsonb_build_object('id','measure-gold',
      'public_key','-----BEGIN PUBLIC KEY-----'||E'\n'||encode(decode('302a300506032b6570032100','hex')||v_gold_public,'base64')||E'\n'||'-----END PUBLIC KEY-----',
      'valid_from',v_valid_from,'valid_until',v_valid_until)),
    'seed_issuers',jsonb_build_array(jsonb_build_object('id','measure-seed',
      'public_key','-----BEGIN PUBLIC KEY-----'||E'\n'||encode(decode('302a300506032b6570032100','hex')||v_seed_public,'base64')||E'\n'||'-----END PUBLIC KEY-----',
      'valid_from',v_valid_from,'valid_until',v_valid_until)),
    'gold_max_age_days',30,'seed_max_age_days',7,
    'revoked',jsonb_build_object('certificate_hashes','[]'::jsonb,'eligibility_hashes','[]'::jsonb,'issuer_ids','[]'::jsonb));
  v_trust := public._reading_json_hash(v_policy);
  v_order_document := jsonb_build_object('product_order_id',v_order,'order_revision',1,'grade_target','middle_1',
    'target',jsonb_build_object('age_band','middle_1','resources','[]'::jsonb),'trust_policy_hash',v_trust);
  v_order_hash := public._reading_json_hash(v_order_document);
  v_target_key := public._reading_target_key(v_order_document->'target');
  INSERT INTO public.reading_product_order_revision(order_id,order_revision,order_hash,registered_by)
    VALUES(v_order,1,v_order_hash,v_admin);
  INSERT INTO public.reading_promotion_authority(singleton,generation,trust_policy_hash,benchmark_version,
    benchmark_snapshot_hash,valid_until,registered_by)
    VALUES(true,1,v_trust,'atomic-volume-measure-v1',v_benchmark,clock_timestamp()+interval '30 minutes',v_admin);

  FOR v_day IN 1..2 LOOP
    v_audit_id := gen_random_uuid(); v_item_id := gen_random_uuid();
    v_group := 'atomic-volume-measure-day' || v_day || ':' || gen_random_uuid()::text;
    v_output := '<section>Volume measure day ' || v_day || '</section>';
    v_output_hash := encode(extensions.digest(convert_to(v_output,'UTF8'),'sha256'),'hex');
    INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,
      display_only,copyright_safe_in_kr,adapted_from_id)
      VALUES('manual','reading:atomic-volume-measure:'||gen_random_uuid(),'Volume measure child '||v_day,'CC BY 4.0','cc_by',
        'Synthetic student explanation for day '||v_day||'.','queued',false,true,v_source.id)
      RETURNING * INTO v_child;
    v_passage_hash := public._reading_json_hash(to_jsonb(btrim(v_child.content)));
    v_content_hash := public._reading_json_hash(jsonb_build_object('source_id',v_source.id::text,
      'target_key',v_target_key,'passage_hash',v_passage_hash));
    v_certificate := jsonb_build_object('schema','frym-gold-s-certificate/1','issuer_id','measure-gold',
      'source_id',v_source.id::text,'target_key',v_target_key,'passage_hash',v_passage_hash,'content_hash',v_content_hash,
      'rights_hash',v_rights,'certificate_id',gen_random_uuid()::text,'curator_id','measure-curator','owner_id','measure-owner',
      'benchmark_version','atomic-volume-measure-v1','benchmark_snapshot_hash',v_benchmark,
      'review_evidence_hash',repeat('3',64),'decision_hash',repeat('4',64),'distribution_hash',repeat('5',64),
      'review_hash',repeat('6',64),'admission_receipt_hash',repeat('7',64),'issued_at',v_issued);
    v_certificate := v_certificate || jsonb_build_object('signature',
      regexp_replace(encode(pgsodium.crypto_sign_detached(convert_to(public._reading_json_hash(v_certificate),'UTF8'),
        v_gold_secret),'base64'),'[[:space:]]','','g'));
    v_cert := public._reading_json_hash(v_certificate);
    IF v_day = 2 THEN v_day2_cert := v_cert; END IF;
    v_eligibility_record := jsonb_build_object('schema','frym-seed-eligibility/1','issuer_id','measure-seed',
      'certificate_hash',v_cert,'content_hash',v_content_hash,'rights_hash',v_rights,'eligibility_id',gen_random_uuid()::text,
      'operations_id','measure-operations','approver_id','measure-approver','seed_evidence_hash',repeat('8',64),
      'operations_hash',repeat('9',64),'approval_hash',repeat('a',64),'issued_at',v_issued);
    v_eligibility_record := v_eligibility_record || jsonb_build_object('signature',
      regexp_replace(encode(pgsodium.crypto_sign_detached(convert_to(public._reading_json_hash(v_eligibility_record),'UTF8'),
        v_seed_secret),'base64'),'[[:space:]]','','g'));
    v_eligibility := public._reading_json_hash(v_eligibility_record);
    UPDATE public.library_articles SET composed_spec=jsonb_build_object('academic_reading',
      jsonb_build_object('provenance',jsonb_build_object('gold_s',jsonb_build_object(
        'state','gold_s','seed_eligible',true,'production',false,'source_id',v_source.id::text,
        'target_key',v_target_key,'certificate_hash',v_cert,'eligibility_hash',v_eligibility,
        'trust_policy_hash',v_trust,'benchmark_version','atomic-volume-measure-v1',
        'benchmark_snapshot_hash',v_benchmark,'rights_hash',v_rights,
        'evidence_valid_until',v_policy #>> '{gold_issuers,0,valid_until}',
        'proof_bundle',jsonb_build_object('certificate',v_certificate,'eligibility',v_eligibility_record),
        'operational_policy',v_policy)))) WHERE id=v_child.id RETURNING * INTO v_child;
    v_payload := jsonb_build_object('source_content_sha256',encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex'),
      'child_content_sha256',encode(extensions.digest(convert_to(v_child.content,'UTF8'),'sha256'),'hex'),
      'source_updated_at',v_source.updated_at::text,'article_updated_at',v_child.updated_at::text,
      'rights_hash',v_rights,'target_key',v_target_key,'request_id',v_audit_id,'article_id',v_child.id,
      'child_source_id',v_child.source_id,'source_id',v_source.id,'product_order_id',v_order,'order_revision',1,
      'order_hash',v_order_hash,'evidence_hash',v_evidence,'certificate_hash',v_cert,'eligibility_hash',v_eligibility,
      'trust_policy_hash',v_trust,'benchmark_version','atomic-volume-measure-v1','benchmark_snapshot_hash',v_benchmark,
      'requested_by','atomic-volume-measure','intent_hash',repeat('4',64));
    v_request_hash := public._reading_json_hash(v_payload);
    v_payload := v_payload || jsonb_build_object('request_hash',v_request_hash);
    INSERT INTO public.reading_promotion_audit(request_id,article_id,source_id,request_hash,order_id,order_revision,order_hash,
      evidence_hash,certificate_hash,eligibility_hash,trust_policy_hash,benchmark_version,benchmark_snapshot_hash,requested_by,request_payload)
      VALUES(v_audit_id,v_child.id,v_source.id,v_request_hash,v_order,1,v_order_hash,v_evidence,v_cert,v_eligibility,v_trust,
        'atomic-volume-measure-v1',v_benchmark,'atomic-volume-measure',v_payload);
    INSERT INTO public.reading_promotion_permit(request_id,article_id,transaction_id) VALUES(v_audit_id,v_child.id,pg_catalog.txid_current());
    UPDATE public.library_articles SET status='ready' WHERE id=v_child.id;
    DELETE FROM public.reading_promotion_permit WHERE request_id=v_audit_id;
    SELECT * INTO v_child FROM public.library_articles WHERE id=v_child.id;
    INSERT INTO public.csat_dcp_items(id,kind,ref_id,type,payload,answer_key,paragraph_idx)
      VALUES(v_item_id,'article',v_child.id,'order',jsonb_build_object('passage',v_child.content,
        'factory_lineage',jsonb_build_object('product_order_id',v_order,'order_revision',1,'order_hash',v_order_hash,
          'promotion_request_id',v_audit_id,'promotion_request_hash',v_request_hash,'evidence_hash',v_evidence,
          'source_hash',v_payload->>'source_content_sha256','adaptation_hash',v_payload->>'child_content_sha256',
          'source_revision',v_source.updated_at,'adaptation_revision',v_child.updated_at,'rights_hash',v_rights,
          'certificate_hash',v_cert,'eligibility_hash',v_eligibility,'trust_policy_hash',v_trust,
          'benchmark_version','atomic-volume-measure-v1','benchmark_snapshot_hash',v_benchmark)),
        jsonb_build_object('answer',1,'explanation_ko','Synthetic explanation day '||v_day||'.'),0);
    SELECT public._reading_json_hash(jsonb_build_object('payload',payload,'answer_key',answer_key))
      INTO v_review_digest FROM public.csat_dcp_items WHERE id=v_item_id;
    INSERT INTO public.csat_item_reviews(item_id,persona,verdict,reviewed_digest)
      SELECT v_item_id,persona,'pass',v_review_digest FROM unnest(ARRAY['setter','analyst','tutor']) AS persona;
    v_sections := jsonb_build_array(jsonb_build_object('grade','middle_1','order_id',v_order,
      'article_id',v_child.id,'audit_id',v_audit_id,'item_ids',jsonb_build_array(v_item_id)));
    v_group_document := jsonb_build_object('group_id',v_group,'group_revision',1,
      'grade_scope',jsonb_build_object('mode','single_grade','grades',jsonb_build_array('middle_1')),
      'orders',jsonb_build_array(jsonb_build_object('grade','middle_1','order',v_order_document)));
    v_evidence_document := jsonb_build_object('group_id',v_group,'group_revision',1,
      'group_hash',public._reading_json_hash(v_group_document),'source_id',v_source.id::text,
      'source_hash',v_payload->>'source_content_sha256','rights_hash',v_rights,
      'variants',jsonb_build_array(jsonb_build_object('grade','middle_1','product_order_id',v_order,
        'order_revision',1,'order_hash',v_order_hash,'passage_hash',v_payload->>'child_content_sha256',
        'adaptation_hash',v_passage_hash,'benchmark_version','atomic-volume-measure-v1','benchmark_snapshot_hash',v_benchmark,
        'item_set_hash',public._reading_json_hash(jsonb_build_array(jsonb_build_array(v_item_id,v_review_digest))))));
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
    PERFORM public.register_reading_production_group(v_group,1,v_sections,v_group_document,v_evidence_document);
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    v_capture := public.capture_reading_production_snapshot(v_group);
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',v_output_hash);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    -- Dev has one active admin; simulate the required second administrator (same as the existing smoke).
    UPDATE public.reading_production_group SET registered_by=gen_random_uuid() WHERE group_id=v_group;
    PERFORM public.approve_reading_production_output((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',v_output_hash);
    PERFORM set_config('request.jwt.claim.role','service_role',true);
    v_capture := public.capture_reading_production_snapshot(v_group);
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',v_output_hash);
    v_result := public.publish_reading_production_artifact((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',v_output);
    INSERT INTO _volume_measure VALUES ('day '||v_day||' published', v_result->>'status'='published_current', v_result->>'snapshot_id');
    v_volume_sections := v_volume_sections || jsonb_build_array(jsonb_build_object('day',v_day,'snapshot_id',v_capture->>'snapshot_id'));
  END LOOP;

  -- Register and serve the volume through the new RPCs.
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  v_result := public.register_reading_production_volume('atomic-volume-measure', 1,
    jsonb_build_array(jsonb_build_object('grade','middle_1','order_id',v_order,'order_revision',1,'order_hash',v_order_hash)),
    v_volume_sections);
  INSERT INTO _volume_measure VALUES ('volume registered', jsonb_array_length(v_result->'sections')=2, v_result->>'volume_hash');
  BEGIN
    PERFORM public.register_reading_production_volume('atomic-volume-measure', 1,
      jsonb_build_array(jsonb_build_object('grade','middle_1','order_id',v_order,'order_revision',1,'order_hash',v_order_hash)),
      v_volume_sections);
    INSERT INTO _volume_measure VALUES ('same revision replay refused', false, 'accepted');
  EXCEPTION WHEN check_violation THEN INSERT INTO _volume_measure VALUES ('same revision replay refused', true, SQLERRM); END;
  BEGIN
    PERFORM public.register_reading_production_volume('atomic-volume-measure-foreign', 1,
      jsonb_build_array(jsonb_build_object('grade','middle_1','order_id',v_order,'order_revision',1,'order_hash',repeat('0',64))),
      v_volume_sections);
    INSERT INTO _volume_measure VALUES ('wrong order hash refused', false, 'accepted');
  EXCEPTION WHEN check_violation THEN INSERT INTO _volume_measure VALUES ('wrong order hash refused', true, SQLERRM); END;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  v_served := public.serve_reading_production_volume('atomic-volume-measure');
  INSERT INTO _volume_measure VALUES ('volume served with both days',
    position('Volume measure day 1' in v_served->>'html') > 0 AND position('Volume measure day 2' in v_served->>'html') > 0
      AND v_served->>'output_hash' = encode(extensions.digest(convert_to(v_served->>'html','UTF8'),'sha256'),'hex'),
    v_served->>'output_hash');
  -- Revoke day 2's certificate: the whole volume must stop serving.
  UPDATE public.reading_promotion_authority SET revoked_certificate_hashes=ARRAY[v_day2_cert] WHERE singleton=true;
  BEGIN
    PERFORM public.serve_reading_production_volume('atomic-volume-measure');
    INSERT INTO _volume_measure VALUES ('revoked day blocks volume', false, 'served');
  EXCEPTION WHEN others THEN INSERT INTO _volume_measure VALUES ('revoked day blocks volume', true, SQLERRM); END;
END $measure$;
SELECT * FROM _volume_measure;
ROLLBACK;
