-- supabase/migrations/20261011072230_reading_specialized_production_revalidate.sql
-- Prepared for review. Do not apply without explicit migration approval.
-- Replaces the blanket refusal of P13/P14/P18/P20 (20261009095727) with DB-side revalidation.
-- Only the guard function body changes; both triggers keep calling it.
--   group row:    the sealed order must carry what the family needs (licensed text / licensed data /
--                 exam target) and every sealed resource must still satisfy the rights fields.
--   snapshot row: every item must use exactly one sealed resource of its order (by canonical URL)
--                 and quote it exactly; P18 items need a printed time budget and no resource.
BEGIN;

CREATE OR REPLACE FUNCTION public._reading_specialized_production_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  v_orders jsonb; v_sections jsonb; v_index integer := 0; v_order jsonb; v_family text; v_kind text;
  v_resources jsonb; v_item jsonb; v_payload jsonb; v_resource jsonb; v_urls text[];
BEGIN
  v_orders := CASE TG_TABLE_NAME
    WHEN 'reading_production_group' THEN to_jsonb(NEW) #> '{group_document,orders}'
    WHEN 'reading_production_snapshot' THEN to_jsonb(NEW) #> '{evidence,group_document,orders}'
    ELSE NULL END;
  IF jsonb_typeof(v_orders) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'production order evidence missing' USING ERRCODE = 'check_violation';
  END IF;
  v_sections := CASE TG_TABLE_NAME WHEN 'reading_production_snapshot' THEN to_jsonb(NEW) #> '{evidence,sections}' ELSE NULL END;

  FOR v_order IN SELECT value FROM jsonb_array_elements(v_orders) LOOP
    v_family := v_order #>> '{order,product_family}';
    IF v_family IN ('P13','P14','P18','P20') THEN
      v_kind := CASE v_family WHEN 'P14' THEN 'data' WHEN 'P18' THEN NULL ELSE 'text' END;
      v_resources := COALESCE((SELECT jsonb_agg(value) FROM jsonb_array_elements(v_order #> '{order,target,resources}')
        WHERE value->>'kind' = v_kind), '[]'::jsonb);
      -- Order-level requirements.
      IF v_kind IS NOT NULL AND jsonb_array_length(v_resources) = 0 THEN
        RAISE EXCEPTION 'specialized order lacks its sealed % resource', v_kind USING ERRCODE = 'check_violation';
      END IF;
      IF v_family = 'P18' AND COALESCE(v_order #>> '{order,target,exam}', 'none') = 'none' THEN
        RAISE EXCEPTION 'timed judgment order lacks an exam target' USING ERRCODE = 'check_violation';
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_resources) AS r(value) WHERE
           length(btrim(COALESCE(r.value->>'content',''))) < 20 OR length(btrim(COALESCE(r.value->>'canonical_url',''))) = 0 OR
           r.value->>'commercial_use' IS DISTINCT FROM 'true' OR r.value->>'derivative_use' IS DISTINCT FROM 'true' OR
           r.value->>'ai_processing' IS DISTINCT FROM 'allowed' OR r.value->>'third_party_text' IS DISTINCT FROM 'false' OR
           length(btrim(COALESCE(r.value->>'attribution',''))) < 8) OR
         (SELECT count(DISTINCT r.value->>'canonical_url') FROM jsonb_array_elements(v_resources) AS r(value)) <> jsonb_array_length(v_resources) THEN
        RAISE EXCEPTION 'specialized resource rights or identity invalid' USING ERRCODE = 'check_violation';
      END IF;
      -- Item-level requirements, checked on the captured evidence.
      IF v_sections IS NOT NULL THEN
        IF jsonb_typeof(v_sections -> v_index) IS DISTINCT FROM 'object' OR
           jsonb_typeof(v_sections -> v_index -> 'items') IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION 'specialized section evidence missing' USING ERRCODE = 'check_violation';
        END IF;
        v_urls := ARRAY(SELECT DISTINCT i.value #>> '{payload,resource_url}' FROM jsonb_array_elements(v_sections -> v_index -> 'items') AS i(value));
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_sections -> v_index -> 'items') LOOP
          v_payload := v_item -> 'payload';
          IF v_kind IS NULL THEN
            IF jsonb_typeof(v_payload -> 'time_limit_seconds') IS DISTINCT FROM 'number' OR
               (v_payload ->> 'time_limit_seconds')::numeric <> trunc((v_payload ->> 'time_limit_seconds')::numeric) OR
               (v_payload ->> 'time_limit_seconds')::numeric NOT BETWEEN 1 AND 3600 OR
               v_payload ? 'resource_url' OR v_payload ? 'evidence_resource' THEN
              RAISE EXCEPTION 'timed item lacks a printed time budget' USING ERRCODE = 'check_violation';
            END IF;
          ELSE
            SELECT r.value INTO v_resource FROM jsonb_array_elements(v_resources) AS r(value)
              WHERE r.value->>'canonical_url' = v_payload->>'resource_url';
            IF v_resource IS NULL OR cardinality(v_urls) <> 1 OR
               length(btrim(COALESCE(v_payload->>'evidence_resource',''))) = 0 OR
               position(v_payload->>'evidence_resource' in v_resource->>'content') = 0 THEN
              RAISE EXCEPTION 'specialized item not grounded in its sealed resource' USING ERRCODE = 'check_violation';
            END IF;
            v_resource := NULL;
          END IF;
        END LOOP;
      END IF;
    END IF;
    v_index := v_index + 1;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._reading_specialized_production_guard() FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
