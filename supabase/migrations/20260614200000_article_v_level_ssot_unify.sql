-- ACP article 추출 기준을 LCP book 과 동일하게 통일 (v06.51).
--
-- 점검 4축:
--   1. 재분석:    동일 (analyzeBook ↔ analyzeArticle 패턴 동일)
--   2. SSoT:      분기 → 통일 (preview page = library_article_vocabularies 직접 SELECT
--                          → select_article_vocab RPC 호출로 일원화)
--   3. V-Level:   결락 → 신설 (library_articles.article_v_level + compute_article_vrl,
--                              book_v_level 동일 알고리즘 = DISTINCT lemma P75, V11 제외)
--   4. Composite: 결락 → 추가 (V-Level 게이트 + skill penalty)
--
-- 본 migration 은:
--   A. library_articles 에 vrl 컬럼 3종 신설
--   B. compute_article_vrl(article_id) — compute_book_vrl 미러
--   C. select_article_vocab v2 — V-Level 게이트 + skill penalty
--   D. 기존 ready/published article backfill (compute_article_vrl 호출)
--   E. 기존 published article 단어장 재발행 (V<baseline 단어 제거 반영)

-- ─── A. library_articles 컬럼 ─────────────────────────────────────────
ALTER TABLE library_articles
  ADD COLUMN IF NOT EXISTS article_v_level   smallint,
  ADD COLUMN IF NOT EXISTS vrl_components    jsonb,
  ADD COLUMN IF NOT EXISTS vrl_calculated_at timestamptz;

COMMENT ON COLUMN library_articles.article_v_level IS
  'V-Level baseline (P75 DISTINCT lemma, V11 제외) — book_v_level 동일 알고리즘. select_article_vocab v_level 게이트.';
COMMENT ON COLUMN library_articles.vrl_components IS
  'compute_article_vrl 산출 메타 (p50/p75/p90/coverage/diversity/method)';

-- ─── B. compute_article_vrl(article_id) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_article_vrl(p_article_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_p50            INT;
  v_p75            INT;
  v_p90            INT;
  v_weighted_avg   NUMERIC;
  v_matched_lemmas INT;
  v_total_lav      INT;
  v_v_level_div    INT;
  v_coverage_pct   NUMERIC;
BEGIN
  IF p_article_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_total_lav
  FROM library_article_vocabularies
  WHERE library_article_id = p_article_id;

  IF v_total_lav = 0 THEN
    RAISE NOTICE 'Article % has no vocabularies; skipping VRL.', p_article_id;
    RETURN;
  END IF;

  -- DISTINCT lemma + V11(archaic) 제외 — compute_book_vrl 와 동일 알고리즘
  WITH joined AS (
    SELECT DISTINCT COALESCE(lav.lemma, lav.word) AS lemma, sd.v_level
    FROM library_article_vocabularies lav
    JOIN shared_dictionary sd ON sd.word = COALESCE(lav.lemma, lav.word)
    WHERE lav.library_article_id = p_article_id
      AND sd.v_level IS NOT NULL
      AND sd.v_level <> 11
  )
  SELECT
    PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY v_level)::int,
    PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY v_level)::int,
    PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY v_level)::int,
    ROUND(AVG(v_level)::numeric, 2)
  INTO v_p50, v_p75, v_p90, v_weighted_avg
  FROM joined;

  IF v_p75 IS NULL THEN
    RAISE NOTICE 'Article % vrl join produced no rows; skipping.', p_article_id;
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT COALESCE(lav.lemma, lav.word)),
         COUNT(DISTINCT sd.v_level)
    INTO v_matched_lemmas, v_v_level_div
  FROM library_article_vocabularies lav
  JOIN shared_dictionary sd ON sd.word = COALESCE(lav.lemma, lav.word)
  WHERE lav.library_article_id = p_article_id
    AND sd.v_level IS NOT NULL
    AND sd.v_level <> 11;

  v_coverage_pct := ROUND(100.0 * v_matched_lemmas / NULLIF(v_total_lav, 0), 2);

  UPDATE library_articles
  SET
    article_v_level = v_p75::smallint,
    vrl_components = jsonb_build_object(
      'p50', v_p50,
      'p75', v_p75,
      'p90', v_p90,
      'weighted_avg', v_weighted_avg,
      'matched_lemmas', v_matched_lemmas,
      'lemma_coverage_pct', v_coverage_pct,
      'v_level_diversity', v_v_level_div,
      'method', 'p75_type_v11_excluded_article',
      'computed_at', now()),
    vrl_calculated_at = now()
  WHERE id = p_article_id;
END;
$function$;

COMMENT ON FUNCTION public.compute_article_vrl(uuid) IS
  'compute_book_vrl 미러: DISTINCT lemma P75(v_level), V11 제외. library_articles.article_v_level UPDATE.';

-- ─── C. select_article_vocab v2 — V-Level 게이트 + skill penalty ────
CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
RETURNS TABLE(
  word text, lemma text, meaning_ko text, v_level smallint, cefr_level text,
  pos text, example_en text, word_register text,
  frequency_rank integer, frequency_in_article integer,
  skill_level smallint, composite_score numeric, sort_order integer,
  first_sentence text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH art AS (
    SELECT la.id, la.article_v_level FROM library_articles la WHERE la.id = p_article_id
  ),
  cand AS (
    SELECT DISTINCT ON (sd.word)
      sd.word                          AS word,
      sd.meaning_ko                    AS meaning_ko,
      sd.v_level                       AS v_level,
      sd.cefr_level                    AS cefr_level,
      sd.pos                           AS pos,
      sd.example_en                    AS example_en,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank                AS frequency_rank,
      av.frequency_in_article          AS frequency_in_article,
      sd.skill_level                   AS skill_level,
      av.first_sentence                AS first_sentence,
      art.article_v_level              AS avl
    FROM art
    JOIN library_article_vocabularies av ON av.library_article_id = art.id
    JOIN shared_dictionary sd ON sd.word = COALESCE(av.lemma, av.word)
    WHERE sd.v_level >= COALESCE(art.article_v_level, 4)          -- ★ V-Level 게이트 (없으면 V4 fallback)
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard')
            NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  scored AS (
    SELECT c.*,
      ROUND(
          0.70 * (1.0 / LOG(10, COALESCE(c.frequency_rank, 50000)::numeric + 10))
        + 0.10 * (1.0 - 1.0 / (COALESCE(c.frequency_in_article, 1) + 1))
        + CASE WHEN c.skill_level = 4 AND c.avl < 6 THEN -0.10 ELSE 0 END  -- ★ skill penalty
      , 4) AS composite_score
    FROM cand c
  )
  SELECT
    s.word,
    s.word                                                            AS lemma,
    s.meaning_ko,
    s.v_level,
    s.cefr_level,
    s.pos,
    s.example_en,
    s.word_register,
    s.frequency_rank,
    s.frequency_in_article,
    s.skill_level,
    s.composite_score,
    ROW_NUMBER() OVER (
      ORDER BY s.composite_score DESC, s.frequency_in_article DESC NULLS LAST,
               s.v_level ASC, s.word
    )::int AS sort_order,
    s.first_sentence
  FROM scored s
$function$;

COMMENT ON FUNCTION public.select_article_vocab(uuid) IS
  'v06.51 LCP book SSoT 동일: V-Level >= article_v_level (없으면 V4 fallback) + skill penalty + register filter + composite.';

-- ─── D. 기존 article backfill (compute_article_vrl) ──────────────────
DO $$
DECLARE r RECORD; v_done int := 0;
BEGIN
  FOR r IN
    SELECT id FROM library_articles
    WHERE status IN ('ready', 'published')
      AND EXISTS (
        SELECT 1 FROM library_article_vocabularies
        WHERE library_article_id = library_articles.id
      )
  LOOP
    PERFORM compute_article_vrl(r.id);
    v_done := v_done + 1;
  END LOOP;
  RAISE NOTICE 'compute_article_vrl backfilled % articles', v_done;
END $$;

-- ─── E. 기존 published article 단어장 재발행 ───────────────────────────
-- (V<baseline 단어가 게이트에서 제외되도록 단어장 INSERT 재실행)
DO $$
DECLARE r RECORD; v_done int := 0;
BEGIN
  FOR r IN
    SELECT id FROM library_articles WHERE status = 'published'
  LOOP
    -- 기존 set 삭제 (FK CASCADE 로 shared_words / subscriptions 정리)
    DELETE FROM shared_word_sets
     WHERE category = 'library_article'
       AND (curation_query->>'article_id') = r.id::text;

    -- 재발행 — V-Level 게이트 + skill penalty 반영된 select_article_vocab v2 사용
    PERFORM publish_article_word_set(r.id);
    v_done := v_done + 1;
  END LOOP;
  RAISE NOTICE 'republished % published articles', v_done;
END $$;
