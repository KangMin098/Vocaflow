-- supabase/migrations/20260705101000_recommend_book_iplus1_tier.sql
-- v06.129 큐레이션 점검 후속: recommend_word_sets_for_user 에 6th tier 'book_iplus1' 추가.
-- lexical_coverage(레벨별 기지어 %) 가 사용자 V-Level 에서 85~95% (judgeIPlusOne 밴드) 인
-- published 도서 상위 2권의 입문(최저 챕터) 세트를 priority 6 으로 추천.
-- 시그니처·반환타입 불변, 기존 5-tier 본문 불변.

CREATE OR REPLACE FUNCTION public.recommend_word_sets_for_user(p_user_id uuid, p_interests text[] DEFAULT NULL::text[])
 RETURNS TABLE(set_id uuid, slug text, title text, category text, word_count integer, cover_emoji text, recommendation_type text, reason text, priority integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_level SMALLINT;
  v_primary_slug TEXT;
  v_stretch_slug TEXT;
  v_review_slug TEXT;
  v_track_levels JSONB;
  v_csat_level INT;
  v_business_level INT;
  v_academic_level INT;
BEGIN
  SELECT current_v_level, current_track_levels INTO v_current_level, v_track_levels
  FROM public.user_profiles WHERE user_id = p_user_id;

  v_csat_level     := COALESCE((v_track_levels->>'csat_korean')::int, 0);
  v_business_level := COALESCE((v_track_levels->>'business_english')::int, 0);
  v_academic_level := COALESCE((v_track_levels->>'academic_english')::int, 0);

  -- fallback (미진단)
  IF v_current_level IS NULL OR v_current_level = 0 THEN
    RETURN QUERY
    SELECT u.set_id, u.slug, u.title, u.category, u.word_count, u.cover_emoji,
           u.recommendation_type, u.reason, u.priority
    FROM (
      SELECT ws.id AS set_id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'fallback'::TEXT AS recommendation_type,
             '진단 미완료 — 한국 학습자 평균 entry point V3 추천'::TEXT AS reason,
             1 AS priority
      FROM public.shared_word_sets ws
      WHERE ws.slug = 'auto-vlevel-v3' AND ws.is_published
      UNION ALL
      -- interests opt-in (진단 전이라도 가능)
      SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'specialty'::TEXT,
             ('관심 도메인 — ' || ws.title)::TEXT,
             4
      FROM public.shared_word_sets ws
      WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
        AND ws.slug = ANY(SELECT 'specialty-' || unnest(p_interests))
        AND ws.is_published
    ) u
    ORDER BY u.priority;
    RETURN;
  END IF;

  v_current_level := LEAST(v_current_level, 9);
  v_primary_slug := 'auto-vlevel-v' || v_current_level::TEXT;
  IF v_current_level < 9 THEN v_stretch_slug := 'auto-vlevel-v' || (v_current_level + 1)::TEXT; END IF;
  IF v_current_level > 1 THEN v_review_slug := 'auto-vlevel-v' || (v_current_level - 1)::TEXT; END IF;

  RETURN QUERY
  SELECT u.set_id, u.slug, u.title, u.category, u.word_count, u.cover_emoji,
         u.recommendation_type, u.reason, u.priority
  FROM (
    -- 1. primary
    SELECT ws.id AS set_id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'primary'::TEXT AS recommendation_type,
           ('현재 V-Level (V' || v_current_level || ') 단어장 — 메인 학습')::TEXT AS reason,
           1 AS priority
    FROM public.shared_word_sets ws
    WHERE ws.slug = v_primary_slug AND ws.is_published
    UNION ALL
    -- 2. stretch
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'stretch'::TEXT,
           ('Krashen i+1 — V' || (v_current_level + 1) || ' 진입 도전')::TEXT,
           2
    FROM public.shared_word_sets ws
    WHERE v_stretch_slug IS NOT NULL AND ws.slug = v_stretch_slug AND ws.is_published
    UNION ALL
    -- 3. review
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'review'::TEXT,
           ('V' || (v_current_level - 1) || ' 보강 — 이전 단계 견고화')::TEXT,
           3
    FROM public.shared_word_sets ws
    WHERE v_review_slug IS NOT NULL AND ws.slug = v_review_slug AND ws.is_published
    UNION ALL
    -- 4. specialty opt-in (interests)
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'specialty'::TEXT,
           ('관심 도메인 — ' || ws.title)::TEXT,
           4
    FROM public.shared_word_sets ws
    WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
      AND ws.slug = ANY(SELECT 'specialty-' || unnest(p_interests))
      AND ws.is_published
    UNION ALL
    -- 5. track-based 자동 추가 (current_track_levels ≥6)
    -- 5a. csat_korean ≥6 → KICE 큐레이션 sets
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'track_csat'::TEXT,
           ('수능 강화 — csat_korean L' || v_csat_level || ' (수능 진단 결과)')::TEXT,
           5
    FROM public.shared_word_sets ws
    WHERE v_csat_level >= 6 AND ws.slug LIKE 'kice-%' AND ws.is_published
    UNION ALL
    -- 5b. business_english ≥6 → specialty-business
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'track_business'::TEXT,
           ('TOEIC 강화 — business_english L' || v_business_level || ' (비즈니스 진단 결과)')::TEXT,
           5
    FROM public.shared_word_sets ws
    WHERE v_business_level >= 6 AND ws.slug = 'specialty-business' AND ws.is_published
    UNION ALL
    -- 5c. academic_english ≥6 → specialty-academic
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'track_academic'::TEXT,
           ('TOEFL 강화 — academic_english L' || v_academic_level || ' (학술 진단 결과)')::TEXT,
           5
    FROM public.shared_word_sets ws
    WHERE v_academic_level >= 6 AND ws.slug = 'specialty-academic' AND ws.is_published
    UNION ALL
    -- 6. book i+1 — lexical_coverage 기반 도서 입문 챕터 세트 (상위 2권)
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'book_iplus1'::TEXT,
           ('i+1 도서 — ' || lb.title || ' (내 레벨 기지어 '
             || round((lb.lexical_coverage->>v_current_level::text)::numeric) || '%)')::TEXT,
           6
    FROM (
      SELECT b.id, b.title, b.lexical_coverage
      FROM public.library_books b
      WHERE b.status = 'published' AND b.copyright_safe_in_kr AND b.published_at IS NOT NULL
        AND (b.lexical_coverage->>v_current_level::text)::numeric >= 85
        AND (b.lexical_coverage->>v_current_level::text)::numeric < 95
      ORDER BY (b.lexical_coverage->>v_current_level::text)::numeric DESC
      LIMIT 2
    ) lb
    JOIN LATERAL (
      SELECT s.id, s.slug, s.title, s.category, s.word_count, s.cover_emoji
      FROM public.shared_word_sets s
      WHERE s.category = 'library_book'
        AND s.curation_query->>'book_id' = lb.id::text
        AND s.is_published
      ORDER BY (s.curation_query->>'chapter_idx')::int
      LIMIT 1
    ) ws ON TRUE
  ) u
  ORDER BY u.priority, u.slug;
END;
$function$;
