-- mc-voa-getter-prep.apply.sql (APPROVAL CANDIDATE — 미적용 · 사용자 승인 전 실행 금지)
-- 프로젝트 vocaflow-dev jajenrevcbmrpaliomxv · 경로: 승인된 단일 DB writer 의 apply_migration (한 트랜잭션)
-- 변경: article_practice_items(uuid) · article_practice_availability() 의 reviewed VALUES 에 VOA title 1행(f236272e…)만 추가.
-- 불변: 기존 Lincoln/Grass 4행·6열·순서·WHERE 조건·반환 projection·속성(SECURITY DEFINER/STABLE/sql/search_path)·ACL.
-- 쓰기: 함수 2개 CREATE OR REPLACE 외 INSERT/UPDATE/DELETE 0. CREATE OR REPLACE 는 ACL 을 보존한다(사후 가드가 확인).
-- 사전 가드: 원 prosrc sha items=7030885d1dea65f9e72dc5e9bb3f35c1d55b8511fd5be889b9bbcb1942707235 · availability=e9747709d2ac751485c2b8d242e058635786af08a1f81eb6073c6a773fc71c90 + 속성/ACL. 다르면 중단.
-- 사후 가드: 새 prosrc sha items=c00faf242bbf99397cfb1660b29d53acd769c50482549513a6ed2fa82cf90f4e · availability=667004d7799f3593d715f564d2fe429750dc3051ee72074217d526d65d448218 + 속성/ACL.
DO $guard$
DECLARE r record; v_expected jsonb := '{"article_practice_items":"7030885d1dea65f9e72dc5e9bb3f35c1d55b8511fd5be889b9bbcb1942707235","article_practice_availability":"e9747709d2ac751485c2b8d242e058635786af08a1f81eb6073c6a773fc71c90"}'::jsonb; v_n integer := 0;
BEGIN
  FOR r IN SELECT p.proname::text AS sig, encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex') AS src_sha,
                  p.prosecdef, p.provolatile, p.proconfig, l.lanname, pg_get_function_result(p.oid) AS res,
                  (SELECT array_agg(x ORDER BY x) FROM unnest(p.proacl::text[]) x) AS acl
             FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
            WHERE p.oid IN ('public.article_practice_items(uuid)'::regprocedure, 'public.article_practice_availability()'::regprocedure)
  LOOP
    v_n := v_n + 1;
    IF r.src_sha IS DISTINCT FROM v_expected ->> r.sig
       OR r.prosecdef IS NOT TRUE OR r.provolatile <> 's' OR r.lanname <> 'sql'
       OR r.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']
       OR r.acl IS DISTINCT FROM ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']
       OR r.res IS DISTINCT FROM (CASE WHEN r.sig = 'article_practice_items' THEN 'TABLE(id uuid, type text, paragraph_idx integer, payload jsonb)' ELSE 'TABLE(article_id uuid, item_count integer)' END) THEN
      RAISE EXCEPTION 'voa_getter_apply_pre: % state mismatch (src_sha=%) — 다른 변경을 덮지 않고 중단', r.sig, r.src_sha;
    END IF;
  END LOOP;
  IF v_n <> 2 THEN RAISE EXCEPTION 'voa_getter_apply_pre: expected 2 functions, found %', v_n; END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.article_practice_items(p_article_id uuid)
 RETURNS TABLE(id uuid, type text, paragraph_idx integer, payload jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH reviewed(item_id, item_type, article_id, body_sha, payload_sha, key_sha) AS (
    VALUES
      ('b69f287f-7d20-4770-8b88-8dfe0050ad0f'::uuid, 'title', '267ef969-2a3a-4dc9-b6b7-a85246df543f'::uuid, 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df', 'f00480d38a3a5042d7a70823886f193817d9d58114973b78b4cb3b89ccf9044d', '78594a08b016ccb1c269b79f6d01f8b2be856474379b0a3befa38fc85805cdb1'),
      ('b72011b0-91e1-46bc-bf35-d2ef20f1aaea'::uuid, 'topic', '267ef969-2a3a-4dc9-b6b7-a85246df543f'::uuid, 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df', '13c5414752828db377842a92afbd76674b5135e6df2fe18c91b56499b6aff4e2', '2b58349b5f86fbdd8466e71a6970ca4d7e63241aaeba0978bdd0cf1750e13817'),
      ('ee5a3e66-ee79-489f-b639-5a74c9b97a71'::uuid, 'title', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a', '2544914b779a736e3f2f8960d646d623cc07c0df6d594781c5363df61966ca01', '846c34400883a2fa747cde2cc7374ea29ba6466659b5e298c8c646b5e44d24df'),
      ('417b9e52-a732-40ab-ab07-973c14455533'::uuid, 'topic', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a', 'f26812fd074336ab898fe6e236b015b66575b4a19a12951bee7933b5f94412a0', '06f2e9b12f8c2f452ea27b2daade109d818d5f502b06d9d24998aa626dec86c7'),
      ('f236272e-e139-4a08-af64-dad4e59b76f5'::uuid, 'title', '9eb7e569-b9de-40ab-b45d-5e4eb1a77626'::uuid, '1bd1594063df20588d8ba9d2aecfb3187bed3659f5a3688ef5216f3481f54e13', 'e30e5724709c50215e46a9f7c840988cf6f8368a5a643d670970cd0cd540c4cd', 'd473f5382582ea6b11fa4ef0d383734d86e211970ed98fd9c056bec4de91747e')
  )
  SELECT d.id, d.type, d.paragraph_idx,
         jsonb_strip_nulls(jsonb_build_object(
           'passage', d.payload->'passage',
           'stem_ko', d.payload->'stem_ko',
           'choices', d.payload->'choices',
           'choice_language', d.payload->'choice_language'
         ))
    FROM reviewed r
    JOIN public.csat_dcp_items d ON d.id = r.item_id
    JOIN public.library_articles a ON a.id = d.ref_id
   WHERE auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = auth.uid() AND up.status IN ('suspended', 'deleted'))
     AND p_article_id = r.article_id
     AND d.ref_id = p_article_id
     AND d.kind = 'article'
     AND d.type = r.item_type
     AND a.status = 'published'
     AND a.copyright_safe_in_kr IS TRUE
     AND encode(sha256(convert_to(a.content, 'UTF8')), 'hex') = r.body_sha
     AND encode(sha256(convert_to(d.payload::text, 'UTF8')), 'hex') = r.payload_sha
     AND encode(sha256(convert_to(d.answer_key::text, 'UTF8')), 'hex') = r.key_sha
     AND public.csat_source_is_gradeable(d.ref_id)
   ORDER BY d.type, d.id
$function$;

CREATE OR REPLACE FUNCTION public.article_practice_availability()
 RETURNS TABLE(article_id uuid, item_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH reviewed(item_id, item_type, article_id, body_sha, payload_sha, key_sha) AS (
    VALUES
      ('b69f287f-7d20-4770-8b88-8dfe0050ad0f'::uuid, 'title', '267ef969-2a3a-4dc9-b6b7-a85246df543f'::uuid, 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df', 'f00480d38a3a5042d7a70823886f193817d9d58114973b78b4cb3b89ccf9044d', '78594a08b016ccb1c269b79f6d01f8b2be856474379b0a3befa38fc85805cdb1'),
      ('b72011b0-91e1-46bc-bf35-d2ef20f1aaea'::uuid, 'topic', '267ef969-2a3a-4dc9-b6b7-a85246df543f'::uuid, 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df', '13c5414752828db377842a92afbd76674b5135e6df2fe18c91b56499b6aff4e2', '2b58349b5f86fbdd8466e71a6970ca4d7e63241aaeba0978bdd0cf1750e13817'),
      ('ee5a3e66-ee79-489f-b639-5a74c9b97a71'::uuid, 'title', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a', '2544914b779a736e3f2f8960d646d623cc07c0df6d594781c5363df61966ca01', '846c34400883a2fa747cde2cc7374ea29ba6466659b5e298c8c646b5e44d24df'),
      ('417b9e52-a732-40ab-ab07-973c14455533'::uuid, 'topic', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a', 'f26812fd074336ab898fe6e236b015b66575b4a19a12951bee7933b5f94412a0', '06f2e9b12f8c2f452ea27b2daade109d818d5f502b06d9d24998aa626dec86c7'),
      ('f236272e-e139-4a08-af64-dad4e59b76f5'::uuid, 'title', '9eb7e569-b9de-40ab-b45d-5e4eb1a77626'::uuid, '1bd1594063df20588d8ba9d2aecfb3187bed3659f5a3688ef5216f3481f54e13', 'e30e5724709c50215e46a9f7c840988cf6f8368a5a643d670970cd0cd540c4cd', 'd473f5382582ea6b11fa4ef0d383734d86e211970ed98fd9c056bec4de91747e')
  )
  SELECT r.article_id, count(*)::integer AS item_count
    FROM reviewed r
    JOIN public.csat_dcp_items d ON d.id = r.item_id
    JOIN public.library_articles a ON a.id = d.ref_id
   WHERE auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.user_profiles up
        WHERE up.user_id = auth.uid() AND up.status IN ('suspended', 'deleted'))
     AND d.ref_id = r.article_id
     AND d.kind = 'article'
     AND d.type = r.item_type
     AND a.status = 'published'
     AND a.copyright_safe_in_kr IS TRUE
     AND encode(sha256(convert_to(a.content, 'UTF8')), 'hex') = r.body_sha
     AND encode(sha256(convert_to(d.payload::text, 'UTF8')), 'hex') = r.payload_sha
     AND encode(sha256(convert_to(d.answer_key::text, 'UTF8')), 'hex') = r.key_sha
     AND public.csat_source_is_gradeable(d.ref_id)
   GROUP BY r.article_id
   ORDER BY r.article_id
$function$;

DO $guard$
DECLARE r record; v_expected jsonb := '{"article_practice_items":"c00faf242bbf99397cfb1660b29d53acd769c50482549513a6ed2fa82cf90f4e","article_practice_availability":"667004d7799f3593d715f564d2fe429750dc3051ee72074217d526d65d448218"}'::jsonb; v_n integer := 0;
BEGIN
  FOR r IN SELECT p.proname::text AS sig, encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex') AS src_sha,
                  p.prosecdef, p.provolatile, p.proconfig, l.lanname, pg_get_function_result(p.oid) AS res,
                  (SELECT array_agg(x ORDER BY x) FROM unnest(p.proacl::text[]) x) AS acl
             FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
            WHERE p.oid IN ('public.article_practice_items(uuid)'::regprocedure, 'public.article_practice_availability()'::regprocedure)
  LOOP
    v_n := v_n + 1;
    IF r.src_sha IS DISTINCT FROM v_expected ->> r.sig
       OR r.prosecdef IS NOT TRUE OR r.provolatile <> 's' OR r.lanname <> 'sql'
       OR r.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']
       OR r.acl IS DISTINCT FROM ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']
       OR r.res IS DISTINCT FROM (CASE WHEN r.sig = 'article_practice_items' THEN 'TABLE(id uuid, type text, paragraph_idx integer, payload jsonb)' ELSE 'TABLE(article_id uuid, item_count integer)' END) THEN
      RAISE EXCEPTION 'voa_getter_apply_post: % state mismatch (src_sha=%) — 다른 변경을 덮지 않고 중단', r.sig, r.src_sha;
    END IF;
  END LOOP;
  IF v_n <> 2 THEN RAISE EXCEPTION 'voa_getter_apply_post: expected 2 functions, found %', v_n; END IF;
END
$guard$;
