-- r0-article-practice apply — Lincoln delta 초안(**미적용 · 승인 전 적용 금지**). 원본 apply.proposal.sql(b3587ca74 · USGS)을 덮지 않는다.
-- 원본과 다른 곳: 검수 결속 주석 · reviewed VALUES 2행 · 기사 id · 본문 sha 세 군데뿐(나머지 경계 · ACL · 반환 모양 동일).
-- R0: 학습자가 읽은 같은 기사의 중심 의미 안내 연습 — **검수한 2문항만**, 정답 없이 조회.
--
-- 검수 결속(2026-10-27 읽기 전용 실측 · Codex 의미 검토 CODEX_REVIEW.md):
--   기사 267ef969-2a3a-4dc9-b6b7-a85246df543f(VOA Lincoln's Cottage) · 본문 sha256(content) f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df
--   title b69f287f-7d20-4770-8b88-8dfe0050ad0f · payload sha f00480d3… · answer_key sha 78594a08…
--   topic b72011b0-91e1-46bc-bf35-d2ef20f1aaea · payload sha 13c54147… · answer_key sha 2b58349b…
--   (PostgreSQL payload::text · answer_key::text 의 sha256 — canonical JSON sha 와 다르다. 2026-10-28 읽기 전용 재계산 일치)
-- 본문·payload·등록 키 중 하나라도 바뀌면 그 문항은 **자동으로 빠진다**(재검수 전 공개 안 함).
-- 다른 기사·미검수 문항은 이 함수로 열리지 않는다. 정답·해설은 반환하지 않고 화면 키만 다시 조립한다.
-- 서버 경계: 로그인 · 계정 정지/해지 아님 · 기사 발행 · 권리 flag · 원문 채점 가능(csat_source_is_gradeable) · 검수 type 결속.
-- 채점은 기존 grade_dcp_item 재사용(시도 기록). 쓰기 0 · 새 테이블 0.
BEGIN;
CREATE OR REPLACE FUNCTION public.article_practice_items(p_article_id uuid)
RETURNS TABLE(id uuid, type text, paragraph_idx int, payload jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH reviewed(item_id, item_type, payload_sha, key_sha) AS (
    VALUES
      ('b69f287f-7d20-4770-8b88-8dfe0050ad0f'::uuid, 'title', 'f00480d38a3a5042d7a70823886f193817d9d58114973b78b4cb3b89ccf9044d', '78594a08b016ccb1c269b79f6d01f8b2be856474379b0a3befa38fc85805cdb1'),
      ('b72011b0-91e1-46bc-bf35-d2ef20f1aaea'::uuid, 'topic', '13c5414752828db377842a92afbd76674b5135e6df2fe18c91b56499b6aff4e2', '2b58349b5f86fbdd8466e71a6970ca4d7e63241aaeba0978bdd0cf1750e13817')
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
     AND p_article_id = '267ef969-2a3a-4dc9-b6b7-a85246df543f'::uuid
     AND d.ref_id = p_article_id
     AND d.kind = 'article'
     AND d.type = r.item_type
     AND a.status = 'published'
     AND a.copyright_safe_in_kr IS TRUE -- csat_source_is_gradeable 는 권리 flag 를 보지 않는다(함수 원문) — 공개 기사 RLS 경계와 맞춘다
     AND encode(sha256(convert_to(a.content, 'UTF8')), 'hex') = 'f6fce3159b15c2c0cb8c6795d5e6e51f02240eb3725d14f40601b119c195f1df'
     AND encode(sha256(convert_to(d.payload::text, 'UTF8')), 'hex') = r.payload_sha
     AND encode(sha256(convert_to(d.answer_key::text, 'UTF8')), 'hex') = r.key_sha
     AND public.csat_source_is_gradeable(d.ref_id)
   ORDER BY d.type, d.id
$$;
REVOKE ALL ON FUNCTION public.article_practice_items(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.article_practice_items(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.article_practice_items(uuid) TO authenticated;
COMMIT;
