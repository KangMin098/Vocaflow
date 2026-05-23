-- ════════════════════════════════════════════════════════════════════
-- Vocaflow Reading Level (VRL) v3 — Day 3: Mass Classification
-- ════════════════════════════════════════════════════════════════════
-- 작성: 2026-05-23
-- 범위: shared_dictionary 38,630 row 일괄 분류 UPDATE
--         + vocaflow_levels/tracks/domains/skills total_words 자동 재집계
-- 의존: Day 1 인프라 + Day 2 함수 5종 + over-tagging 패치
-- 안전: 단일 트랜잭션 (apply_migration 자동 wrapping). 실패 시 자동 ROLLBACK.
-- 멱등: WHERE vrl_calculated_at IS NULL 가드 — 재실행 시 미분류 row 만 처리.
-- 성능: 단일 UPDATE. 함수 호출 ~16/row × 38,630 = ~618k calls. 예상 1-3분.
-- ════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 0. 사전 검증 — 함수 5종 등록 확인
-- ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_pending INT;
BEGIN
  -- 함수 5종
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_v_level') THEN
    RAISE EXCEPTION 'calc_v_level 함수 누락 — Day 2 migration 먼저 적용 필요';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_track_level') THEN
    RAISE EXCEPTION 'calc_track_level 함수 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_domain_level') THEN
    RAISE EXCEPTION 'calc_domain_level 함수 누락';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='calc_skill_level') THEN
    RAISE EXCEPTION 'calc_skill_level 함수 누락';
  END IF;

  -- 컬럼 6종
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='shared_dictionary' AND column_name='vrl_calculated_at') THEN
    RAISE EXCEPTION 'shared_dictionary VRL 컬럼 누락 — Day 1 migration 먼저';
  END IF;

  SELECT COUNT(*) INTO v_pending FROM shared_dictionary WHERE vrl_calculated_at IS NULL;
  RAISE NOTICE '▶ Day 3 분류 시작 — 미분류 row: %', v_pending;
END $$;


-- ─────────────────────────────────────────────────────────────────
-- 1. 일괄 분류 UPDATE (멱등 — vrl_calculated_at IS NULL 만 처리)
-- ─────────────────────────────────────────────────────────────────

UPDATE shared_dictionary sd
SET
  v_level = calc_v_level(sd.word),

  track_levels = jsonb_build_object(
    'csat_korean',         calc_track_level(sd.word, 'csat_korean'),
    'business_english',    calc_track_level(sd.word, 'business_english'),
    'academic_english',    calc_track_level(sd.word, 'academic_english'),
    'general_proficiency', calc_track_level(sd.word, 'general_proficiency'),
    'conversational',      calc_track_level(sd.word, 'conversational'),
    'literary',            calc_track_level(sd.word, 'literary')
  ),

  domain_levels = jsonb_build_object(
    'general',        calc_domain_level(sd.word, 'general'),
    'business',       calc_domain_level(sd.word, 'business'),
    'academic',       calc_domain_level(sd.word, 'academic'),
    'literature',     calc_domain_level(sd.word, 'literature'),
    'news_media',     calc_domain_level(sd.word, 'news_media'),
    'entertainment',  calc_domain_level(sd.word, 'entertainment'),
    'science_tech',   calc_domain_level(sd.word, 'science_tech'),
    'travel_culture', calc_domain_level(sd.word, 'travel_culture')
  ),

  skill_type = CASE
    WHEN sd.primary_pos = 'idiom' THEN 'idiom'
    WHEN sd.primary_pos = 'phrasal_verb' THEN 'phrasal_verb'
    WHEN jsonb_array_length(COALESCE(sd.meanings_ko, '[]'::jsonb)) >= 3 THEN 'polysemy'
    WHEN sd.word ~ ' ' AND sd.primary_pos NOT IN ('idiom','phrasal_verb') THEN 'collocation'
    ELSE 'single_word'
  END,

  skill_level = calc_skill_level(sd.word),

  vrl_calculated_at = now()

WHERE sd.vrl_calculated_at IS NULL;


-- ─────────────────────────────────────────────────────────────────
-- 2. 사후 검증 ASSERT
-- ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_total INT;
  v_classified INT;
  v_null_v_with_cefr INT;
  v_null_skill_type INT;
  v_dist TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM shared_dictionary;
  SELECT COUNT(*) INTO v_classified FROM shared_dictionary WHERE vrl_calculated_at IS NOT NULL;
  SELECT COUNT(*) INTO v_null_v_with_cefr
    FROM shared_dictionary WHERE v_level IS NULL AND cefr_level IS NOT NULL;
  SELECT COUNT(*) INTO v_null_skill_type
    FROM shared_dictionary WHERE skill_type IS NULL;

  RAISE NOTICE '── Day 3 분류 결과 ──';
  RAISE NOTICE '  총 row             : %', v_total;
  RAISE NOTICE '  분류 완료          : %', v_classified;
  RAISE NOTICE '  v_level NULL + cefr 보유 (예상 0): %', v_null_v_with_cefr;
  RAISE NOTICE '  skill_type NULL (예상 0): %', v_null_skill_type;

  -- skill_type 은 ELSE 'single_word' 캐치오울이므로 NULL=0 이어야 함
  IF v_null_skill_type > 0 THEN
    RAISE EXCEPTION 'skill_type NULL row 발견 (% rows) — CASE 캐치오울 실패', v_null_skill_type;
  END IF;

  -- v_level NULL 이면 cefr 도 NULL 이어야 함 (이미 알려진 4 row)
  IF v_null_v_with_cefr > 0 THEN
    RAISE WARNING 'v_level NULL + cefr 보유 row %개 — 검토 필요', v_null_v_with_cefr;
  END IF;

  -- 분포 미리보기
  SELECT string_agg(format('L%s=%s', v_level, cnt), ', ' ORDER BY v_level NULLS LAST)
  INTO v_dist
  FROM (SELECT v_level, COUNT(*) AS cnt FROM shared_dictionary GROUP BY v_level) d;
  RAISE NOTICE '  분포: %', v_dist;
END $$;


-- ─────────────────────────────────────────────────────────────────
-- 3. 메타 테이블 total_words 재집계
--    Day 1 시드의 추정치 → 실측치로 교체
-- ─────────────────────────────────────────────────────────────────

-- 3.1 vocaflow_levels.cumulative_word_count + new_words_in_level
WITH level_counts AS (
  SELECT v_level, COUNT(*) AS cnt
  FROM shared_dictionary
  WHERE v_level IS NOT NULL
  GROUP BY v_level
),
cumulative AS (
  SELECT v_level, cnt AS new_words,
         SUM(cnt) OVER (ORDER BY v_level) AS cum_count
  FROM level_counts
)
UPDATE vocaflow_levels vl
SET cumulative_word_count = c.cum_count,
    new_words_in_level    = c.new_words
FROM cumulative c
WHERE vl.level = c.v_level;

-- 3.2 vocaflow_tracks.total_words
-- jsonb 키별 NULL 아닌 값 카운트
UPDATE vocaflow_tracks t
SET total_words = sub.cnt
FROM (
  SELECT
    'csat_korean' AS id, COUNT(*) FILTER (WHERE (track_levels->>'csat_korean') IS NOT NULL AND track_levels->>'csat_korean' <> 'null') AS cnt FROM shared_dictionary
  UNION ALL SELECT 'business_english', COUNT(*) FILTER (WHERE (track_levels->>'business_english') IS NOT NULL AND track_levels->>'business_english' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'academic_english', COUNT(*) FILTER (WHERE (track_levels->>'academic_english') IS NOT NULL AND track_levels->>'academic_english' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'general_proficiency', COUNT(*) FILTER (WHERE (track_levels->>'general_proficiency') IS NOT NULL AND track_levels->>'general_proficiency' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'conversational', COUNT(*) FILTER (WHERE (track_levels->>'conversational') IS NOT NULL AND track_levels->>'conversational' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'literary', COUNT(*) FILTER (WHERE (track_levels->>'literary') IS NOT NULL AND track_levels->>'literary' <> 'null') FROM shared_dictionary
) sub
WHERE t.id = sub.id;

-- 3.3 vocaflow_domains.total_words
UPDATE vocaflow_domains d
SET total_words = sub.cnt
FROM (
  SELECT 'general' AS id, COUNT(*) FILTER (WHERE (domain_levels->>'general') IS NOT NULL AND domain_levels->>'general' <> 'null') AS cnt FROM shared_dictionary
  UNION ALL SELECT 'business', COUNT(*) FILTER (WHERE (domain_levels->>'business') IS NOT NULL AND domain_levels->>'business' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'academic', COUNT(*) FILTER (WHERE (domain_levels->>'academic') IS NOT NULL AND domain_levels->>'academic' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'literature', COUNT(*) FILTER (WHERE (domain_levels->>'literature') IS NOT NULL AND domain_levels->>'literature' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'news_media', COUNT(*) FILTER (WHERE (domain_levels->>'news_media') IS NOT NULL AND domain_levels->>'news_media' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'entertainment', COUNT(*) FILTER (WHERE (domain_levels->>'entertainment') IS NOT NULL AND domain_levels->>'entertainment' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'science_tech', COUNT(*) FILTER (WHERE (domain_levels->>'science_tech') IS NOT NULL AND domain_levels->>'science_tech' <> 'null') FROM shared_dictionary
  UNION ALL SELECT 'travel_culture', COUNT(*) FILTER (WHERE (domain_levels->>'travel_culture') IS NOT NULL AND domain_levels->>'travel_culture' <> 'null') FROM shared_dictionary
) sub
WHERE d.id = sub.id;

-- 3.4 vocaflow_skills.total_words
UPDATE vocaflow_skills s
SET total_words = sub.cnt
FROM (
  SELECT skill_type AS id, COUNT(*) AS cnt
  FROM shared_dictionary
  WHERE skill_type IS NOT NULL
  GROUP BY skill_type
) sub
WHERE s.id = sub.id;


-- ─────────────────────────────────────────────────────────────────
-- 4. 최종 검증
-- ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_levels_total INT;
  v_dict_total INT;
BEGIN
  SELECT SUM(new_words_in_level) INTO v_levels_total FROM vocaflow_levels;
  SELECT COUNT(*) FILTER (WHERE v_level IS NOT NULL) INTO v_dict_total FROM shared_dictionary;

  IF v_levels_total <> v_dict_total THEN
    RAISE EXCEPTION 'vocaflow_levels.new_words_in_level 합계(%) <> shared_dictionary v_level NOT NULL(%)',
      v_levels_total, v_dict_total;
  END IF;

  RAISE NOTICE '✓ Day 3 분류 + 메타 재집계 완료';
  RAISE NOTICE '  Levels 합계: % = Dictionary 분류 row: %', v_levels_total, v_dict_total;
END $$;


-- ════════════════════════════════════════════════════════════════════
-- 다음 단계 (Day 4):
--   - scripts/vrl/calculate-book-vrl-v3.ts — library_books 책 VRL 산출
--   - analyze_book_vrl() 호출 후 book_vrl_score / book_v_level / vrl_components 저장
--   - MSL placeholder 12.0 → 본문 문장 분리로 실측치 교체 (책 본문 메타 가용 시)
-- ════════════════════════════════════════════════════════════════════
