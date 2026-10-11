// scripts/textbook/run-db-measure.mjs
// Turns a completed, family-reviewed order-production run into ONE rollback-only SQL script that
// pushes the run's own orders, passages, items, explanations and unit HTML through the real DB
// RPCs: promotion → group → capture → approval → finalize → publish → volume register/serve.
// The run is re-sealed under a fresh synthetic trust root (the trust policy is part of the order);
// passages/items are unchanged and the existing family review must still pass.
// Usage: pnpm exec tsx scripts/textbook/run-db-measure.mjs <run-input.json> <run-dir> > out.sql
import fs from 'node:fs'
import path from 'node:path'
import { generateKeyPairSync } from 'node:crypto'
import { exportOrderProductionDrain, importOrderProductionDrain } from '../../packages/library-pipeline/src/textbook/order-production-run.ts'
import { importFamilyReview } from '../../packages/library-pipeline/src/textbook/family-semantic-review.ts'
import { hash } from './frym-benchmark/benchmark.mjs'

const [inputPath, runDir] = process.argv.slice(2)
if (!inputPath || !runDir) throw Error('Usage: run-db-measure.mjs <run-input.json> <run-dir>')
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const filled = JSON.parse(fs.readFileSync(path.join(runDir, 'drain.out.json'), 'utf8'))
const reviewOut = JSON.parse(fs.readFileSync(path.join(runDir, 'review.out.json'), 'utf8'))
if (!fs.existsSync(path.join(runDir, 'complete.json'))) throw Error('RUN_NOT_COMPLETE')

// Fresh ed25519 trust root (postgres cannot generate keys); policy hashed exactly as the DB does.
const keys = {}
const pem = raw => `-----BEGIN PUBLIC KEY-----\n${Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]).toString('base64')}\n-----END PUBLIC KEY-----`
for (const name of ['gold', 'seed']) {
  const pair = generateKeyPairSync('ed25519')
  const pub = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
  const seed = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32)
  keys[name] = { pub, secret: Buffer.concat([seed, pub]) }
}
const iso = ms => new Date(ms).toISOString()
const now = Date.now()
const policy = { schema: 'frym-gold-s-operational-policy/1', revision: 'run-db-measure-v1',
  gold_issuers: [{ id: 'run-gold', public_key: pem(keys.gold.pub), valid_from: iso(now - 3600e3), valid_until: iso(now + 7200e3) }],
  seed_issuers: [{ id: 'run-seed', public_key: pem(keys.seed.pub), valid_from: iso(now - 3600e3), valid_until: iso(now + 7200e3) }],
  gold_max_age_days: 30, seed_max_age_days: 7,
  revoked: { certificate_hashes: [], eligibility_hashes: [], issuer_ids: [] } }
const trust = hash(policy)

// Re-seal the same drafts under this trust root, map the reviewed fill onto the new cells.
for (const draft of input.drafts) draft.policies.trust = { version: 'run-db-measure', hash: trust }
const drain = exportOrderProductionDrain(input)
const byCell = new Map(filled.cells.map(cell => [cell.cell_id, cell]))
// The reviewed fill may move to the re-sealed cell only if that cell's plan is unchanged; the trust root
// changes only the order hash and the cell hash.
const reviewedDrain = JSON.parse(fs.readFileSync(path.join(runDir, 'drain.json'), 'utf8'))
const planOf = cell => { const { order_hash: _o, cell_hash: _c, ...plan } = cell; return JSON.stringify(plan) }
const remapped = { cells: drain.cells.map(cell => {
  const old = byCell.get(cell.cell_id)
  const reviewedCell = reviewedDrain.cells.find(row => row.cell_id === cell.cell_id)
  if (!old || !reviewedCell) throw Error(`RUN_CELL_MISSING:${cell.cell_id}`)
  if (planOf(reviewedCell) !== planOf(cell)) throw Error(`RUN_CELL_PLAN_CHANGED:${cell.cell_id}`)
  return { ...old, cell_hash: cell.cell_hash }
}) }
const run = importOrderProductionDrain(input, remapped)
if (run.status !== 'assembled') throw Error(`RUN_NOT_ASSEMBLED:${JSON.stringify(run.blockers)}`)
const reviewed = importFamilyReview(run, reviewOut)
if (reviewed.status !== 'passed') throw Error(`RUN_REVIEW_NOT_PASSED:${JSON.stringify(reviewed.blockers)}`)

// Same escaping as the unit HTML, so served-volume checks match the printed text.
const escHtml = text => text.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;')
const lit = value => {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (text.includes('$q$')) throw Error('LITERAL_DELIMITER_IN_CONTENT')
  return `$q$${text}$q$`
}
const orders = run.volumeInput.orders
const gradeScope = run.volumeInput.brief.grade_scope
const days = [...new Set(run.volumeInput.units.map(unit => unit.day))].sort((a, b) => a - b)
const itemsOf = unit => run.gatedItems.find(row => row.unit_id === unit.unit_id).items.map((item, index) => ({ type: item.item_type, index,
  payload: { item_type: item.item_type, question: item.question, choices: item.choices, evidence_primary: item.evidence_primary,
    ...(item.evidence_secondary ? { evidence_secondary: item.evidence_secondary } : {}),
    ...(item.focus_text ? { focus_text: item.focus_text } : {}) },
  answer_key: { answer: item.answer, explanation_ko: item.explanation } }))
// One group per day; its sections follow the brief's grade order, each grade with its own adaptation and items.
const dayUnits = day => gradeScope.grades.map(grade => run.volumeInput.units.find(unit => unit.day === day && unit.grade === grade))
const dayBlocks = days.map(day => {
  const units = dayUnits(day)
  const payload = units.map(unit => ({ grade: unit.grade, passage: unit.passage, items: itemsOf(unit) }))
  return `
  -- day ${day}: ${units.map(unit => unit.unit_id).join(', ')}
  PERFORM pg_temp.run_measure_one(${day}, ${lit(units.map(unit => unit.unit_html).join('\n'))}, ${lit(payload)}::jsonb);`
}).join('\n')
const orderRows = orders.map(entry => ({ grade: entry.grade, order: entry.order, js_hash: entry.order_hash }))
const delivery = orders.length === 1 ? 'single_grade' : 'grade_specific_adaptations'

const sql = `-- Generated by scripts/textbook/run-db-measure.mjs for ${path.basename(runDir)} (${orders[0].order.product_family}, ${gradeScope.grades.join('/')}).
-- Rollback-only: pushes a reviewed run through the real promotion/production/volume RPCs.
BEGIN;
CREATE TEMP TABLE _run_measure(step text, ok boolean, detail text) ON COMMIT DROP;
CREATE TEMP TABLE _run_ctx(k text PRIMARY KEY, v jsonb) ON COMMIT DROP;
CREATE FUNCTION pg_temp.ctx(p_k text) RETURNS jsonb LANGUAGE sql AS $f$ SELECT v FROM _run_ctx WHERE k = p_k $f$;
DO $run$
DECLARE
  v_admin uuid; v_source public.library_articles%ROWTYPE; v_policy jsonb := ${lit(policy)}::jsonb;
  v_orders jsonb := ${lit(orderRows)}::jsonb; v_row jsonb; v_hash text; v_hashed jsonb := '[]'::jsonb;
  v_trust text; v_rights text; v_benchmark text := repeat('b',64);
BEGIN
  SELECT user_id INTO STRICT v_admin FROM public.user_profiles WHERE role='admin' AND status='active';
  v_trust := public._reading_json_hash(v_policy);
  INSERT INTO _run_measure VALUES ('DB trust hash = JS trust hash', v_trust = ${lit(trust)}, v_trust);
  FOR v_row IN SELECT value FROM jsonb_array_elements(v_orders) LOOP
    v_hash := public._reading_json_hash(v_row->'order');
    INSERT INTO _run_measure VALUES ('DB order hash = JS run order hash (' || (v_row->>'grade') || ')', v_hash = v_row->>'js_hash', v_hash);
    INSERT INTO public.reading_product_order_revision(order_id,order_revision,order_hash,registered_by)
      VALUES(v_row #>> '{order,product_order_id}',(v_row #>> '{order,order_revision}')::int,v_hash,v_admin);
    v_hashed := v_hashed || jsonb_build_array(v_row || jsonb_build_object('order_hash',v_hash,
      'target_key',public._reading_target_key(v_row #> '{order,target}')));
  END LOOP;
  INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,display_only,copyright_safe_in_kr)
    VALUES('manual','run-db-measure:'||gen_random_uuid(),'Run DB measure source','CC BY 4.0','cc_by',
      'Synthetic source for the reviewed run.','queued',false,true) RETURNING * INTO v_source;
  v_rights := public._reading_json_hash(jsonb_build_object('id',v_source.id,'source_id',v_source.source_id,'source_url',v_source.source_url,
    'content',v_source.content,'csat_fit',v_source.csat_fit,'license',v_source.license,'license_class',v_source.license_class,
    'display_only',v_source.display_only,'copyright_safe_in_kr',v_source.copyright_safe_in_kr,'status',v_source.status,'updated_at',v_source.updated_at));
  INSERT INTO public.reading_promotion_authority(singleton,generation,trust_policy_hash,benchmark_version,benchmark_snapshot_hash,valid_until,registered_by)
    VALUES(true,1,v_trust,'run-db-measure-v1',v_benchmark,clock_timestamp()+interval '30 minutes',v_admin);
  INSERT INTO _run_ctx VALUES ('admin',to_jsonb(v_admin)),('source',to_jsonb(v_source.id)),('policy',v_policy),('orders',v_hashed),
    ('trust',to_jsonb(v_trust)),('rights',to_jsonb(v_rights)),('benchmark',to_jsonb(v_benchmark)),
    ('grade_scope',${lit(gradeScope)}::jsonb),('delivery',to_jsonb(${lit(delivery)}::text)),('sections','[]'::jsonb);
END $run$;

CREATE FUNCTION pg_temp.run_measure_one(p_day int, p_output text, p_units jsonb) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  v_admin uuid := (pg_temp.ctx('admin')#>>'{}')::uuid; v_source public.library_articles%ROWTYPE; v_child public.library_articles%ROWTYPE;
  v_policy jsonb := pg_temp.ctx('policy'); v_trust text := pg_temp.ctx('trust')#>>'{}'; v_rights text := pg_temp.ctx('rights')#>>'{}';
  v_benchmark text := pg_temp.ctx('benchmark')#>>'{}';
  v_gold_secret bytea := decode(${lit(keys.gold.secret.toString('hex'))},'hex'); v_seed_secret bytea := decode(${lit(keys.seed.secret.toString('hex'))},'hex');
  v_evidence text := repeat('f',64); v_issued text := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_group text := 'run-db-measure:d' || p_day || ':' || gen_random_uuid()::text;
  v_output_hash text := encode(extensions.digest(convert_to(p_output,'UTF8'),'sha256'),'hex');
  v_unit jsonb; v_ord jsonb; v_order text; v_revision int; v_order_hash text; v_target_key text; v_grade text; v_audit_id uuid;
  v_passage_hash text; v_content_hash text; v_certificate jsonb; v_cert text; v_eligibility_record jsonb; v_eligibility text;
  v_payload jsonb; v_request_hash text; v_item jsonb; v_item_id uuid; v_digest text; v_item_ids jsonb; v_digests jsonb; v_lineage jsonb;
  v_sections jsonb := '[]'::jsonb; v_group_orders jsonb := '[]'::jsonb; v_variants jsonb := '[]'::jsonb;
  v_group_document jsonb; v_evidence_document jsonb; v_capture jsonb; v_result jsonb; v_items_total int := 0;
BEGIN
  SELECT * INTO STRICT v_source FROM public.library_articles WHERE id = (pg_temp.ctx('source')#>>'{}')::uuid;
  FOR v_unit IN SELECT value FROM jsonb_array_elements(p_units) LOOP
    v_grade := v_unit->>'grade';
    SELECT value INTO STRICT v_ord FROM jsonb_array_elements(pg_temp.ctx('orders')) WHERE value->>'grade' = v_grade;
    v_order := v_ord #>> '{order,product_order_id}'; v_revision := (v_ord #>> '{order,order_revision}')::int;
    v_order_hash := v_ord->>'order_hash'; v_target_key := v_ord->>'target_key'; v_audit_id := gen_random_uuid();
    INSERT INTO public.library_articles(source,source_id,title,license,license_class,content,status,display_only,copyright_safe_in_kr,adapted_from_id)
      VALUES('manual','reading:run-db-measure:'||gen_random_uuid(),'Run DB measure day '||p_day||' '||v_grade,'CC BY 4.0','cc_by',
        v_unit->>'passage','queued',false,true,v_source.id) RETURNING * INTO v_child;
    v_passage_hash := public._reading_json_hash(to_jsonb(btrim(v_child.content)));
    v_content_hash := public._reading_json_hash(jsonb_build_object('source_id',v_source.id::text,'target_key',v_target_key,'passage_hash',v_passage_hash));
    v_certificate := jsonb_build_object('schema','frym-gold-s-certificate/1','issuer_id','run-gold','source_id',v_source.id::text,'target_key',v_target_key,
      'passage_hash',v_passage_hash,'content_hash',v_content_hash,'rights_hash',v_rights,'certificate_id',gen_random_uuid()::text,
      'curator_id','run-curator','owner_id','run-owner','benchmark_version','run-db-measure-v1','benchmark_snapshot_hash',v_benchmark,
      'review_evidence_hash',repeat('3',64),'decision_hash',repeat('4',64),'distribution_hash',repeat('5',64),'review_hash',repeat('6',64),
      'admission_receipt_hash',repeat('7',64),'issued_at',v_issued);
    v_certificate := v_certificate || jsonb_build_object('signature',regexp_replace(encode(pgsodium.crypto_sign_detached(
      convert_to(public._reading_json_hash(v_certificate),'UTF8'),v_gold_secret),'base64'),'[[:space:]]','','g'));
    v_cert := public._reading_json_hash(v_certificate);
    v_eligibility_record := jsonb_build_object('schema','frym-seed-eligibility/1','issuer_id','run-seed','certificate_hash',v_cert,
      'content_hash',v_content_hash,'rights_hash',v_rights,'eligibility_id',gen_random_uuid()::text,'operations_id','run-operations',
      'approver_id','run-approver','seed_evidence_hash',repeat('8',64),'operations_hash',repeat('9',64),'approval_hash',repeat('a',64),'issued_at',v_issued);
    v_eligibility_record := v_eligibility_record || jsonb_build_object('signature',regexp_replace(encode(pgsodium.crypto_sign_detached(
      convert_to(public._reading_json_hash(v_eligibility_record),'UTF8'),v_seed_secret),'base64'),'[[:space:]]','','g'));
    v_eligibility := public._reading_json_hash(v_eligibility_record);
    UPDATE public.library_articles SET composed_spec=jsonb_build_object('academic_reading',jsonb_build_object('provenance',jsonb_build_object('gold_s',
      jsonb_build_object('state','gold_s','seed_eligible',true,'production',false,'source_id',v_source.id::text,'target_key',v_target_key,
        'certificate_hash',v_cert,'eligibility_hash',v_eligibility,'trust_policy_hash',v_trust,'benchmark_version','run-db-measure-v1',
        'benchmark_snapshot_hash',v_benchmark,'rights_hash',v_rights,'evidence_valid_until',v_policy #>> '{gold_issuers,0,valid_until}',
        'proof_bundle',jsonb_build_object('certificate',v_certificate,'eligibility',v_eligibility_record),'operational_policy',v_policy))))
      WHERE id=v_child.id RETURNING * INTO v_child;
    v_payload := jsonb_build_object('source_content_sha256',encode(extensions.digest(convert_to(v_source.content,'UTF8'),'sha256'),'hex'),
      'child_content_sha256',encode(extensions.digest(convert_to(v_child.content,'UTF8'),'sha256'),'hex'),
      'source_updated_at',v_source.updated_at::text,'article_updated_at',v_child.updated_at::text,'rights_hash',v_rights,'target_key',v_target_key,
      'request_id',v_audit_id,'article_id',v_child.id,'child_source_id',v_child.source_id,'source_id',v_source.id,'product_order_id',v_order,
      'order_revision',v_revision,'order_hash',v_order_hash,'evidence_hash',v_evidence,'certificate_hash',v_cert,'eligibility_hash',v_eligibility,
      'trust_policy_hash',v_trust,'benchmark_version','run-db-measure-v1','benchmark_snapshot_hash',v_benchmark,'requested_by','run-db-measure',
      'intent_hash',repeat('4',64));
    v_request_hash := public._reading_json_hash(v_payload);
    v_payload := v_payload || jsonb_build_object('request_hash',v_request_hash);
    INSERT INTO public.reading_promotion_audit(request_id,article_id,source_id,request_hash,order_id,order_revision,order_hash,evidence_hash,
      certificate_hash,eligibility_hash,trust_policy_hash,benchmark_version,benchmark_snapshot_hash,requested_by,request_payload)
      VALUES(v_audit_id,v_child.id,v_source.id,v_request_hash,v_order,v_revision,v_order_hash,v_evidence,v_cert,v_eligibility,v_trust,
        'run-db-measure-v1',v_benchmark,'run-db-measure',v_payload);
    INSERT INTO public.reading_promotion_permit(request_id,article_id,transaction_id) VALUES(v_audit_id,v_child.id,pg_catalog.txid_current());
    UPDATE public.library_articles SET status='ready' WHERE id=v_child.id;
    DELETE FROM public.reading_promotion_permit WHERE request_id=v_audit_id;
    SELECT * INTO v_child FROM public.library_articles WHERE id=v_child.id;
    v_lineage := jsonb_build_object('product_order_id',v_order,'order_revision',v_revision,'order_hash',v_order_hash,
      'promotion_request_id',v_audit_id,'promotion_request_hash',v_request_hash,'evidence_hash',v_evidence,
      'source_hash',v_payload->>'source_content_sha256','adaptation_hash',v_payload->>'child_content_sha256',
      'source_revision',v_source.updated_at,'adaptation_revision',v_child.updated_at,'rights_hash',v_rights,'certificate_hash',v_cert,
      'eligibility_hash',v_eligibility,'trust_policy_hash',v_trust,'benchmark_version','run-db-measure-v1','benchmark_snapshot_hash',v_benchmark);
    v_item_ids := '[]'::jsonb; v_digests := '[]'::jsonb;
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_unit->'items') LOOP
      v_item_id := gen_random_uuid();
      INSERT INTO public.csat_dcp_items(id,kind,ref_id,type,payload,answer_key,paragraph_idx)
        VALUES(v_item_id,'article',v_child.id,v_item->>'type',
          (v_item->'payload') || jsonb_build_object('passage',v_child.content,'factory_lineage',v_lineage),v_item->'answer_key',(v_item->>'index')::int);
      SELECT public._reading_json_hash(jsonb_build_object('payload',payload,'answer_key',answer_key)) INTO v_digest FROM public.csat_dcp_items WHERE id=v_item_id;
      INSERT INTO public.csat_item_reviews(item_id,persona,verdict,reviewed_digest)
        SELECT v_item_id,persona,'pass',v_digest FROM unnest(ARRAY['setter','analyst','tutor']) AS persona;
      v_item_ids := v_item_ids || to_jsonb(v_item_id); v_digests := v_digests || jsonb_build_array(jsonb_build_array(v_item_id,v_digest));
      v_items_total := v_items_total + 1;
    END LOOP;
    v_sections := v_sections || jsonb_build_array(jsonb_build_object('grade',v_grade,'order_id',v_order,
      'article_id',v_child.id,'audit_id',v_audit_id,'item_ids',v_item_ids));
    v_group_orders := v_group_orders || jsonb_build_array(jsonb_build_object('grade',v_grade,'order',v_ord->'order'));
    v_variants := v_variants || jsonb_build_array(jsonb_build_object('grade',v_grade,'product_order_id',v_order,'order_revision',v_revision,
      'order_hash',v_order_hash,'passage_hash',v_payload->>'child_content_sha256','adaptation_hash',v_passage_hash,
      'benchmark_version','run-db-measure-v1','benchmark_snapshot_hash',v_benchmark,'item_set_hash',public._reading_json_hash(v_digests)));
  END LOOP;
  v_group_document := jsonb_build_object('group_id',v_group,'group_revision',1,'grade_scope',pg_temp.ctx('grade_scope'),
    'delivery_mode',pg_temp.ctx('delivery')#>>'{}','orders',v_group_orders);
  v_evidence_document := jsonb_build_object('group_id',v_group,'group_revision',1,'group_hash',public._reading_json_hash(v_group_document),
    'source_id',v_source.id::text,'source_hash',v_payload->>'source_content_sha256','rights_hash',v_rights,'variants',v_variants);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
  PERFORM public.register_reading_production_group(v_group,1,v_sections,v_group_document,v_evidence_document);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  v_capture := public.capture_reading_production_snapshot(v_group);
  PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',v_output_hash);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  -- Dev has one active admin; simulate the required second approver (same as the existing smoke).
  UPDATE public.reading_production_group SET registered_by=gen_random_uuid() WHERE group_id=v_group;
  PERFORM public.approve_reading_production_output((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',v_output_hash);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  v_capture := public.capture_reading_production_snapshot(v_group);
  PERFORM public.finalize_reading_production_snapshot((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',v_output_hash);
  v_result := public.publish_reading_production_artifact((v_capture->>'snapshot_id')::uuid,v_capture->>'snapshot_hash',p_output);
  INSERT INTO _run_measure VALUES ('day '||p_day||' published ('||jsonb_array_length(v_sections)||' grades, '||v_items_total||' items)',
    v_result->>'status'='published_current', v_result->>'snapshot_id');
  UPDATE _run_ctx SET v = v || jsonb_build_array(jsonb_build_object('day',p_day,'snapshot_id',v_capture->>'snapshot_id')) WHERE k='sections';
END $f$;

DO $days$
BEGIN
${dayBlocks}
END $days$;

DO $volume$
DECLARE v_result jsonb; v_served jsonb; v_orders jsonb; v_id text := 'run-db-measure:' || ${lit(orders.map(entry => entry.order.product_order_id).join('+'))};
BEGIN
  SELECT jsonb_agg(jsonb_build_object('grade',value->>'grade','order_id',value #>> '{order,product_order_id}',
    'order_revision',(value #>> '{order,order_revision}')::int,'order_hash',value->>'order_hash')) INTO v_orders
    FROM jsonb_array_elements(pg_temp.ctx('orders'));
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claim.sub',pg_temp.ctx('admin')#>>'{}',true);
  v_result := public.register_reading_production_volume(v_id,1,v_orders,pg_temp.ctx('sections'));
  INSERT INTO _run_measure VALUES ('volume registered', jsonb_array_length(v_result->'sections') = ${days.length}, v_result->>'volume_hash');
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  v_served := public.serve_reading_production_volume(v_id);
  INSERT INTO _run_measure VALUES ('volume served with every reviewed unit',
    ${run.volumeInput.units.map(unit => {
      const first = unit.passage.split(/(?<=[.!?])\s+/u)[0], question = run.gatedItems.find(row => row.unit_id === unit.unit_id).items[0].question
      return [first, question].map(text => `position(${lit(escHtml(text))} in v_served->>'html') > 0`).join(' AND ') }).join('\n      AND ')},
    v_served->>'output_hash');
END $volume$;
SELECT * FROM _run_measure;
ROLLBACK;
`
process.stdout.write(sql)
