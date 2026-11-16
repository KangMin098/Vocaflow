-- article_practice_availability() — 연습 문항이 설치된 기사 id 와 문항 수만 한 번에 돌려준다.
-- 기존 article_practice_items(uuid) 와 같은 reviewed 허용 목록·같은 조건(로그인·정지/삭제 계정 제외·발행·KR 권리·
-- 본문/payload/정답 sha·gradeable)을 그대로 쓴다. 문항 본문·선택지·정답은 돌려주지 않는다.
-- 목적: 서가 목록이 「연습 있음」을 카드별 조회(N+1) 없이 한 번에 알 수 있게 한다.
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
      ('417b9e52-a732-40ab-ab07-973c14455533'::uuid, 'topic', '9c168596-028f-4517-a2f1-e97c942590a9'::uuid, '094e6793032672f3d8a4d9761841d8ff41303285a5eea0c4ef1ec67a9e0f4b3a', 'f26812fd074336ab898fe6e236b015b66575b4a19a12951bee7933b5f94412a0', '06f2e9b12f8c2f452ea27b2daade109d818d5f502b06d9d24998aa626dec86c7')
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

REVOKE ALL ON FUNCTION public.article_practice_availability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.article_practice_availability() TO authenticated, service_role;
