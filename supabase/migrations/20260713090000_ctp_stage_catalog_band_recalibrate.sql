-- CTP: csat_stage_catalog 밴드 매핑 근본 재보정 (v06.232).
--
-- 문제(v06.229 에서 표면화): 기존 stage_band 매핑이
--   ① 아티클에 `register='argumentative' → S3` 특례를 둬 register(문체)가 난이도 밴드를 덮음(비정합),
--   ② 도서/비-argumentative 를 v≤4→S1·v5-6→S2·v≥7→S4 로만 3버킷 분할 → **S3 밴드가 사실상 부재**
--      (argumentative 아티클 전용 → 굶주림), CSAT 핵심대 v5-6 이 비활성 S2 로 밀림.
-- 재보정: articles·books 일관 4버킷(monotonic in v_level) + argumentative 특례 제거.
--   derive_learner_stage 의 coverage 게이트(stage S_n ≈ v_level [(n-1)*2, n*2))에 i+1 정합:
--     v≤2→S1(입문·콘텐츠 floor) · v3-4→S2 · v5-6→S3(CSAT 핵심·활성) · v7+→S4(killer band).
--   NULL v_level → S2(기존 기본값 보존). 컬럼 시그니처 불변(stage_band 로직만 교체) → grants/의존 안전.
-- 효과(실측): input 후보 S1:7·S2:50·S3:114·S4:12 (전 밴드 populated); at-band DCP S2:48·S3:762·S4:564
--   (S3 굶주림 해소, v5-6 활성화). 유일 소비처 prescribe_today(input 정확매칭·practice 누적) 재검증 완료.

CREATE OR REPLACE VIEW public.csat_stage_catalog AS
 SELECT 'article'::text AS kind,
    a.id,
    a.title,
    a.article_v_level AS v_level,
    a.register,
    a.cefr_level,
    a.license_class,
    a.display_only,
    a.lexical_noise,
    a.syntax_score,
        CASE
            WHEN a.article_v_level IS NULL THEN 'S2'::text
            WHEN a.article_v_level <= 2 THEN 'S1'::text
            WHEN a.article_v_level <= 4 THEN 'S2'::text
            WHEN a.article_v_level <= 6 THEN 'S3'::text
            ELSE 'S4'::text
        END AS stage_band
   FROM library_articles a
  WHERE a.status = 'published'::text
UNION ALL
 SELECT 'book'::text AS kind,
    b.id,
    b.title,
    b.book_v_level AS v_level,
        CASE
            WHEN b.source = 'pressbooks'::text THEN 'academic'::text
            ELSE 'narrative'::text
        END AS register,
    b.cefr_level,
        CASE
            WHEN b.copyright_safe_in_kr THEN 'public_domain'::text
            ELSE 'restricted'::text
        END AS license_class,
    false AS display_only,
    NULL::numeric AS lexical_noise,
    b.syntax_score,
        CASE
            WHEN b.book_v_level IS NULL THEN 'S2'::text
            WHEN b.book_v_level <= 2 THEN 'S1'::text
            WHEN b.book_v_level <= 4 THEN 'S2'::text
            WHEN b.book_v_level <= 6 THEN 'S3'::text
            ELSE 'S4'::text
        END AS stage_band
   FROM library_books b
  WHERE b.status = 'published'::text;
