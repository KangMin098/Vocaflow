-- supabase/migrations/20260815150000_recommend_by_blueprint.sql
--
-- hub 추천이 **슬러그를 하드코딩**하고 있었다.
--
-- `auto-vlevel-v1..v9` · `specialty-<관심사>` · `topic-<관심사>` · `etymology-core` · `kice-%`.
-- 컴포저(단어장 Studio)가 발행하는 세트는 `cat-*` 슬러그라 어느 조건에도 걸리지 않는다 —
-- 실측 2026-08-15: 발행 29세트 · 유형 26종이 hub 추천에 **단 하나도 뜨지 않았다**.
-- 학습자 카탈로그(/library/vocab)에는 멀쩡히 있는데 "오늘 뭘 할까" 자리에서만 없었다.
--
-- 슬러그를 몇 개 더 넣는 것은 같은 사고를 다음 세트에서 반복한다. 그래서 판정 근거를
-- **세트가 스스로 선언한 것**으로 옮긴다:
--   · `curation_query.blueprint`                          — 어떤 유형인가
--   · `curation_query.recipe.select.filters.v_level_min/max` — 어느 레벨대를 겨냥했나
--   · `curation_query.source_book_id`                     — 어느 책에 딸렸나
-- 새 유형·새 세트가 늘어도 추천이 따라온다. 유형 카탈로그가 곧 추천 규칙이 된다.
--
-- 함께 고치는 것 2가지:
--   ① 중복 — 한 세트가 두 블록에 걸리면 카드가 두 번 떴다. `DISTINCT ON (set_id)` 로 낮은
--      priority 만 남긴다(기존에도 있던 잠재 결함).
--   ② 개수 — 블록이 늘면 hub 가 카드로 뒤덮인다. 화면은 잘라 내지 않으므로(전량 렌더)
--      여기서 `LIMIT 8` 로 막는다. Calm UI — "오늘 할 일" 자리가 목록이 되면 안 된다.
--
-- 레거시 슬러그 블록은 **그대로 둔다**. `auto-vlevel-*` 은 실재하고 레벨별로 정렬된
-- 유일한 세트군이라 지우면 진단 직후 추천이 비어 버린다.

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
    WITH cand AS (
      SELECT ws.id AS set_id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'fallback'::TEXT AS recommendation_type,
             '진단 미완료 — 한국 학습자 평균 entry point V3 추천'::TEXT AS reason,
             1 AS priority
      FROM public.shared_word_sets ws
      WHERE ws.slug = 'auto-vlevel-v3' AND ws.is_published
      UNION ALL
      SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'specialty'::TEXT,
             ('관심 도메인 — ' || ws.title)::TEXT,
             4
      FROM public.shared_word_sets ws
      WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
        AND ws.slug = ANY(SELECT 'specialty-' || unnest(p_interests))
        AND ws.is_published
      UNION ALL
      -- 관심 주제(topic) opt-in — 진단 전이라도 가능
      SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
             'topic'::TEXT,
             ('관심 주제 — ' || ws.title)::TEXT,
             5
      FROM public.shared_word_sets ws
      WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
        AND ws.slug = ANY(SELECT 'topic-' || unnest(p_interests))
        AND ws.subcategory = 'topic' AND ws.is_published
    ),
    dedup AS (
      SELECT DISTINCT ON (c.set_id) c.* FROM cand c ORDER BY c.set_id, c.priority
    )
    SELECT d.set_id, d.slug, d.title, d.category, d.word_count, d.cover_emoji,
           d.recommendation_type, d.reason, d.priority
    FROM dedup d ORDER BY d.priority, d.slug LIMIT 8;
    RETURN;
  END IF;

  v_current_level := LEAST(v_current_level, 9);
  v_primary_slug := 'auto-vlevel-v' || v_current_level::TEXT;
  IF v_current_level < 9 THEN v_stretch_slug := 'auto-vlevel-v' || (v_current_level + 1)::TEXT; END IF;
  IF v_current_level > 1 THEN v_review_slug := 'auto-vlevel-v' || (v_current_level - 1)::TEXT; END IF;

  RETURN QUERY
  WITH cand AS (
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
    UNION ALL
    -- 7. 어원 계열 확장 (V5+ — 어근=중급+ 학술어, avg V7.6)
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'etymology'::TEXT,
           '어근으로 어휘 계열 확장 — 하나의 어근에서 여러 단어를 묶어 기억'::TEXT,
           7
    FROM public.shared_word_sets ws
    WHERE v_current_level >= 5 AND ws.slug = 'etymology-core' AND ws.is_published
    UNION ALL
    -- 8. 관심 주제(topic) opt-in
    SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
           'topic'::TEXT,
           ('관심 주제 — ' || ws.title)::TEXT,
           8
    FROM public.shared_word_sets ws
    WHERE p_interests IS NOT NULL AND array_length(p_interests, 1) > 0
      AND ws.slug = ANY(SELECT 'topic-' || unnest(p_interests))
      AND ws.subcategory = 'topic' AND ws.is_published

    -- ── 여기부터 컴포저 산출물 (2026-08-15) ─────────────────────────
    -- 슬러그가 아니라 **세트가 선언한 것**으로 고른다.
    --
    -- 각 분기는 괄호로 감싼다 — `UNION ALL` 안에서 괄호 없이 ORDER BY·LIMIT 을 쓰면
    -- 그것이 분기가 아니라 **union 전체**에 걸려, 의도한 "유형마다 1개" 가 "전체 1개" 가 된다.
    -- 유형이 26종이라 제한하지 않으면 hub 가 카드로 뒤덮인다(화면은 전량 렌더한다).

    UNION ALL
    -- 9. 레벨대 선언 세트 — 내 레벨을 품는 밴드
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'composer_level'::TEXT,
            ('내 레벨(V' || v_current_level || ')을 포함한 단어장 — 지금 딱 맞는 난이도')::TEXT,
            2
     FROM public.shared_word_sets ws
     WHERE ws.is_published
       AND ws.curation_query->>'blueprint' = 'level-band'
       AND (ws.curation_query->'recipe'->'select'->'filters'->>'v_level_min')::int <= v_current_level
       AND (ws.curation_query->'recipe'->'select'->'filters'->>'v_level_max')::int >= v_current_level
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    -- 10. 수능 트랙 — 기출 출제 근거가 있는 유형 우선
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'track_csat'::TEXT,
            ('수능 강화 — 기출 출제 근거로 뽑은 어휘 (csat_korean L' || v_csat_level || ')')::TEXT,
            5
     FROM public.shared_word_sets ws
     WHERE v_csat_level >= 6 AND ws.is_published
       AND ws.curation_query->>'blueprint' IN ('exam-items', 'exam-list')
     ORDER BY (ws.curation_query->>'blueprint' = 'exam-items') DESC, ws.word_count DESC
     LIMIT 1)

    UNION ALL
    -- 11. 학술 트랙
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'track_academic'::TEXT,
            ('학술 강화 — 논문·교재에 반복되는 어휘 (academic_english L' || v_academic_level || ')')::TEXT,
            5
     FROM public.shared_word_sets ws
     WHERE v_academic_level >= 6 AND ws.is_published
       AND ws.curation_query->>'blueprint' = 'academic-awl'
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    -- 12. 실무 트랙
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'track_business'::TEXT,
            ('실무 강화 — 분야 전문 어휘 (business_english L' || v_business_level || ')')::TEXT,
            5
     FROM public.shared_word_sets ws
     WHERE v_business_level >= 6 AND ws.is_published
       AND ws.curation_query->>'blueprint' = 'domain-specialty'
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    -- 13. 어원 계열 (V5+) — 어근/파생어 유형
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'etymology'::TEXT,
            '어근 하나에서 여러 단어로 — 조각을 알면 처음 보는 단어도 읽힌다'::TEXT,
            7
     FROM public.shared_word_sets ws
     WHERE v_current_level >= 5 AND ws.is_published
       AND ws.curation_query->>'blueprint' IN ('root-etymology', 'word-family')
     ORDER BY ws.word_count DESC
     LIMIT 1)

    UNION ALL
    -- 14. 해금 — i+1 도서의 문장을 가장 많이 여는 단어. 지면이 원리적으로 못 만드는 유형이라
    --     같은 책이라도 챕터 세트(6번)보다 값이 크고, 그래서 같은 priority 6 안에서 함께 뜬다.
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'unlock'::TEXT,
            ('이 단어들을 알면 「' || lb.title || '」의 문장이 열린다')::TEXT,
            6
     FROM (
       SELECT b.id, b.title
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
       WHERE s.is_published
         AND s.curation_query->>'blueprint' = 'unlock'
         AND s.curation_query->>'source_book_id' = lb.id::text
       LIMIT 1
     ) ws ON TRUE
     LIMIT 1)

    UNION ALL
    -- 15. 미수록 어휘 — 다른 단어장이 다루지 않는 말. 여러 세트를 끝낸 학습자에게
    --     "이제 뭘 하지" 의 답이 된다.
    (SELECT ws.id, ws.slug, ws.title, ws.category, ws.word_count, ws.cover_emoji,
            'uncovered'::TEXT,
            '다른 단어장이 다루지 않는 말 — 남들이 비워 둔 자리를 메운다'::TEXT,
            9
     FROM public.shared_word_sets ws
     WHERE ws.is_published
       AND ws.curation_query->>'blueprint' = 'uncovered'
     ORDER BY ws.word_count DESC
     LIMIT 1)
  ),
  dedup AS (
    -- 한 세트가 두 블록에 걸리면 카드가 두 번 떴다 — 낮은 priority 만 남긴다.
    SELECT DISTINCT ON (c.set_id) c.* FROM cand c ORDER BY c.set_id, c.priority
  )
  SELECT d.set_id, d.slug, d.title, d.category, d.word_count, d.cover_emoji,
         d.recommendation_type, d.reason, d.priority
  FROM dedup d
  ORDER BY d.priority, d.slug
  LIMIT 8;
END;
$function$;
