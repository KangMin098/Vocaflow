// scripts/textbook/atomic-production-multi-grade-prepare.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const base = execFileSync(process.execPath,
  [fileURLToPath(new URL('./atomic-production-smoke-prepare.mjs', import.meta.url))],
  { encoding: 'utf8' }).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const replaceOnce = (input, marker, replacement) => {
  if (input.split(marker).length !== 2) throw new Error(`Expected one marker: ${marker.slice(0, 48)}`);
  return input.replace(marker, replacement);
};
let sql = replaceOnce(base,
  '  v_order_document jsonb; v_target_key text;\n',
  `  v_order_document jsonb; v_target_key text;
  v_second_child public.library_articles%ROWTYPE; v_second_order text := 'atomic-smoke:' || gen_random_uuid()::text;
  v_second_audit uuid := gen_random_uuid(); v_second_item uuid := gen_random_uuid();
  v_second_order_document jsonb; v_second_order_hash text; v_second_target_key text;
  v_second_certificate jsonb; v_second_eligibility_record jsonb;
  v_second_cert text; v_second_eligibility text; v_second_passage_hash text;
  v_second_content_hash text; v_second_request_hash text; v_second_payload jsonb;
  v_second_review_digest text;
`);

const second = `
  -- A distinct M2 child, signed Gold-S/seed bundle, promotion audit and item.
  INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,
    display_only,copyright_safe_in_kr,adapted_from_id)
    VALUES('manual','reading:atomic-smoke:'||gen_random_uuid(),'Atomic synthetic M2 child','CC BY 4.0','cc_by',
      'Synthetic middle-two student explanation.','queued',false,true,v_source.id)
    RETURNING * INTO v_second_child;
  v_second_order_document := jsonb_build_object('product_order_id',v_second_order,'order_revision',1,
    'grade_target','middle_2','target',jsonb_build_object('age_band','middle_2','resources','[]'::jsonb),
    'trust_policy_hash',v_trust);
  v_second_order_hash := public._reading_json_hash(v_second_order_document);
  v_second_target_key := public._reading_target_key(v_second_order_document->'target');
  v_second_passage_hash := public._reading_json_hash(to_jsonb(btrim(v_second_child.content)));
  v_second_content_hash := public._reading_json_hash(jsonb_build_object('source_id',v_source.id::text,
    'target_key',v_second_target_key,'passage_hash',v_second_passage_hash));
  v_second_certificate := jsonb_build_object('schema','frym-gold-s-certificate/1',
    'issuer_id','atomic-gold','source_id',v_source.id::text,'target_key',v_second_target_key,
    'passage_hash',v_second_passage_hash,'content_hash',v_second_content_hash,'rights_hash',v_rights,
    'certificate_id',gen_random_uuid()::text,'curator_id','atomic-curator','owner_id','atomic-owner',
    'benchmark_version','atomic-smoke-v1','benchmark_snapshot_hash',v_benchmark,
    'review_evidence_hash',repeat('3',64),'decision_hash',repeat('4',64),
    'distribution_hash',repeat('5',64),'review_hash',repeat('6',64),
    'admission_receipt_hash',repeat('7',64),'issued_at',v_issued);
  v_second_certificate := v_second_certificate || jsonb_build_object('signature',
    regexp_replace(encode(pgsodium.crypto_sign_detached(convert_to(public._reading_json_hash(v_second_certificate),'UTF8'),
      v_gold_secret),'base64'),'[[:space:]]','','g'));
  v_second_cert := public._reading_json_hash(v_second_certificate);
  v_second_eligibility_record := jsonb_build_object('schema','frym-seed-eligibility/1',
    'issuer_id','atomic-seed','certificate_hash',v_second_cert,'content_hash',v_second_content_hash,
    'rights_hash',v_rights,'eligibility_id',gen_random_uuid()::text,
    'operations_id','atomic-operations','approver_id','atomic-approver',
    'seed_evidence_hash',repeat('8',64),'operations_hash',repeat('9',64),
    'approval_hash',repeat('a',64),'issued_at',v_issued);
  v_second_eligibility_record := v_second_eligibility_record || jsonb_build_object('signature',
    regexp_replace(encode(pgsodium.crypto_sign_detached(convert_to(public._reading_json_hash(v_second_eligibility_record),'UTF8'),
      v_seed_secret),'base64'),'[[:space:]]','','g'));
  v_second_eligibility := public._reading_json_hash(v_second_eligibility_record);
  UPDATE public.library_articles SET composed_spec=jsonb_build_object('academic_reading',
    jsonb_build_object('provenance',jsonb_build_object('gold_s',jsonb_build_object(
      'state','gold_s','seed_eligible',true,'production',false,'source_id',v_source.id::text,
      'target_key',v_second_target_key,'certificate_hash',v_second_cert,'eligibility_hash',v_second_eligibility,
      'trust_policy_hash',v_trust,'benchmark_version','atomic-smoke-v1',
      'benchmark_snapshot_hash',v_benchmark,'rights_hash',v_rights,
      'evidence_valid_until',v_policy #>> '{gold_issuers,0,valid_until}',
      'proof_bundle',jsonb_build_object('certificate',v_second_certificate,'eligibility',v_second_eligibility_record),
      'operational_policy',v_policy)))) WHERE id=v_second_child.id RETURNING * INTO v_second_child;
  INSERT INTO public.reading_product_order_revision(order_id,order_revision,order_hash,registered_by)
    VALUES(v_second_order,1,v_second_order_hash,v_admin);
  v_second_payload := jsonb_build_object('source_content_sha256',
    encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex'),
    'child_content_sha256',encode(extensions.digest(convert_to(v_second_child.content,'UTF8'),'sha256'),'hex'),
    'source_updated_at',v_source.updated_at::text,'article_updated_at',v_second_child.updated_at::text,
    'rights_hash',v_rights,'target_key',v_second_target_key,'request_id',v_second_audit,
    'article_id',v_second_child.id,'child_source_id',v_second_child.source_id,'source_id',v_source.id,
    'product_order_id',v_second_order,'order_revision',1,'order_hash',v_second_order_hash,
    'evidence_hash',v_evidence,'certificate_hash',v_second_cert,'eligibility_hash',v_second_eligibility,
    'trust_policy_hash',v_trust,'benchmark_version','atomic-smoke-v1',
    'benchmark_snapshot_hash',v_benchmark,'requested_by','atomic-smoke',
    'intent_hash',repeat('4',64));
  v_second_request_hash := public._reading_json_hash(v_second_payload);
  v_second_payload := v_second_payload || jsonb_build_object('request_hash',v_second_request_hash);
  INSERT INTO public.reading_promotion_audit(request_id,article_id,source_id,request_hash,order_id,
    order_revision,order_hash,evidence_hash,certificate_hash,eligibility_hash,trust_policy_hash,
    benchmark_version,benchmark_snapshot_hash,requested_by,request_payload)
    VALUES(v_second_audit,v_second_child.id,v_source.id,v_second_request_hash,v_second_order,1,v_second_order_hash,v_evidence,
      v_second_cert,v_second_eligibility,v_trust,'atomic-smoke-v1',v_benchmark,'atomic-smoke',v_second_payload);
  INSERT INTO public.reading_promotion_permit(request_id,article_id,transaction_id)
    VALUES(v_second_audit,v_second_child.id,pg_catalog.txid_current());
  UPDATE public.library_articles SET status='ready' WHERE id=v_second_child.id;
  DELETE FROM public.reading_promotion_permit WHERE request_id=v_second_audit;
  SELECT * INTO v_second_child FROM public.library_articles WHERE id=v_second_child.id;
  INSERT INTO public.csat_dcp_items(id,kind,ref_id,type,payload,answer_key,paragraph_idx)
    VALUES(v_second_item,'article',v_second_child.id,'order',jsonb_build_object('passage',v_second_child.content,
      'factory_lineage',jsonb_build_object('product_order_id',v_second_order,'order_revision',1,
        'order_hash',v_second_order_hash,'promotion_request_id',v_second_audit,
        'promotion_request_hash',v_second_request_hash,'evidence_hash',v_evidence,
        'source_hash',v_second_payload->>'source_content_sha256',
        'adaptation_hash',v_second_payload->>'child_content_sha256','source_revision',v_source.updated_at,
        'adaptation_revision',v_second_child.updated_at,'rights_hash',v_rights,'certificate_hash',v_second_cert,
        'eligibility_hash',v_second_eligibility,'trust_policy_hash',v_trust,'benchmark_version','atomic-smoke-v1',
        'benchmark_snapshot_hash',v_benchmark)),
      jsonb_build_object('answer',1,'explanation_ko','Synthetic M2 explanation.'),0);
  SELECT public._reading_json_hash(jsonb_build_object('payload',payload,'answer_key',answer_key))
    INTO v_second_review_digest FROM public.csat_dcp_items WHERE id=v_second_item;
  INSERT INTO public.csat_item_reviews(item_id,persona,verdict,reviewed_digest)
    SELECT v_second_item,persona,'pass',v_second_review_digest
      FROM unnest(ARRAY['setter','analyst','tutor']) AS persona;
`;
sql = replaceOnce(sql, '  v_sections := jsonb_build_array(', second + '  v_sections := jsonb_build_array(');

const extend = `
  v_sections := v_sections || jsonb_build_array(jsonb_build_object('grade','middle_2','order_id',v_second_order,
    'article_id',v_second_child.id,'audit_id',v_second_audit,'item_ids',jsonb_build_array(v_second_item)));
  v_group_document := jsonb_set(v_group_document,'{grade_scope}',
    jsonb_build_object('mode','grade_range','grades',jsonb_build_array('middle_1','middle_2')));
  v_group_document := jsonb_set(v_group_document,'{orders}',(v_group_document->'orders') ||
    jsonb_build_array(jsonb_build_object('grade','middle_2','order',v_second_order_document)));
  v_evidence_document := jsonb_set(v_evidence_document,'{group_hash}',
    to_jsonb(public._reading_json_hash(v_group_document)));
  v_evidence_document := jsonb_set(v_evidence_document,'{variants}',
    (v_evidence_document->'variants') || jsonb_build_array(jsonb_build_object(
      'grade','middle_2','product_order_id',v_second_order,'order_revision',1,
      'order_hash',v_second_order_hash,'passage_hash',v_second_payload->>'child_content_sha256',
      'adaptation_hash',v_second_passage_hash,'benchmark_version','atomic-smoke-v1',
      'benchmark_snapshot_hash',v_benchmark,
      'item_set_hash',public._reading_json_hash(jsonb_build_array(jsonb_build_array(v_second_item,v_second_review_digest))))));
`;
if (!sql.includes("  PERFORM set_config('request.jwt.claim.role','authenticated',true);")) {
  throw new Error('Missing registration role marker');
}
sql = sql.replace("  PERFORM set_config('request.jwt.claim.role','authenticated',true);",
  extend + "  PERFORM set_config('request.jwt.claim.role','authenticated',true);");
if (!sql.includes("  v_capture := public.capture_reading_production_snapshot(v_group);")) {
  throw new Error('Missing first capture marker');
}
sql = sql.replace("  v_capture := public.capture_reading_production_snapshot(v_group);",
  `  BEGIN
    UPDATE public.reading_production_group SET evidence_document=jsonb_set(evidence_document,
      '{variants,1,order_hash}',to_jsonb(repeat('0',64))) WHERE group_id=v_group;
    PERFORM public.capture_reading_production_snapshot(v_group);
    RAISE EXCEPTION 'mixed M2 order evidence unexpectedly captured';
  EXCEPTION WHEN check_violation THEN NULL; END;
  v_capture := public.capture_reading_production_snapshot(v_group);`);
sql = replaceOnce(sql,
  "  IF v_capture->'evidence'->'sections'->0->>'article_id' <> v_child.id::text THEN",
  `  IF jsonb_array_length(v_capture->'evidence'->'sections') <> 2 OR
     v_capture->'evidence'->'sections'->1->>'article_id' <> v_second_child.id::text OR
     v_capture->'evidence'->'sections'->1->>'order_id' <> v_second_order THEN
    RAISE EXCEPTION 'DB-owned M2 section missing or mixed';
  END IF;
  BEGIN
    UPDATE public.csat_dcp_items SET answer_key=jsonb_set(answer_key,'{explanation_ko}',
      to_jsonb('Stale M2 explanation.'::text)) WHERE id=v_second_item;
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'stale M2 item unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.reading_product_order_revision SET order_revision=2 WHERE order_id=v_second_order;
    PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,
      v_capture->>'snapshot_hash',v_output_hash);
    RAISE EXCEPTION 'stale M2 order unexpectedly finalized';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF v_capture->'evidence'->'sections'->0->>'article_id' <> v_child.id::text THEN`);
process.stdout.write(sql);
