-- 20260620050000_p2_composite_redesign.sql
-- ═══════════════════════════════════════════════════════════
-- P2 — composite 재설계 (C1·C2 해결 · v06.79)
--
-- 새 식 (handoff §P2-2, 가중치 합 1.0):
--   score =
--       0.40 * freq_global       -- 1/log10(rank+10), rank NULL → 0 (50000 폐지)
--     + 0.35 * salience_inbook    -- freq_in_chapter / MAX(freq) OVER (PARTITION BY chapter_idx)
--     + 0.15 * csat_band_fit      -- V6~9 → 1.0, V10 → 0.6, V11 → 0.4
--     + 0.10 * quality_bonus      -- verified OR example_en 존재 → 1, 아니면 0
--     - skill_penalty             -- 기존 유지 (skill_level=4 AND book_v_level<6 → -0.10)
--
-- 보존: 게이트 v_level >= 6 (P1), register exclude, DISTINCT/sort, cap 없음 (P3 분리)
--
-- 실측 효과 (Les Misérables 검증):
--   · NULL-rank 1,643 단어 distinct: 5 → 46 (9.2배 · C2 해결)
--   · 전체 distinct: 643 → 1,677 (2.6배 · 평균 동점 11.6 → 4.46)
--   · 챕터 1 상위: bishop V8 freq=4 (1장 핵심 = Monsieur Myriel 주교) ✓
--   · published 5권 추출 회귀 0
--
-- 롤백:
--   docs/AI_CONTEXT/rollback/P2_select_book_chapter_vocab_원본.sql
--   docs/AI_CONTEXT/rollback/P2_select_article_vocab_원본.sql
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.select_book_chapter_vocab(p_book_id uuid)
 RETURNS TABLE(chapter_idx integer, word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_chapter integer, skill_level smallint, composite_score numeric, sort_order integer, library_book_vocabulary_id uuid, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH bk AS (
    SELECT lb.id, lb.book_v_level FROM library_books lb WHERE lb.id = p_book_id
  ),
  cand AS (
    SELECT DISTINCT ON (bv.chapter_idx, sd.word)
      bv.chapter_idx::int            AS chapter_idx,
      sd.word                        AS word,
      sd.meaning_ko                  AS meaning_ko,
      sd.v_level                     AS v_level,
      sd.cefr_level                  AS cefr_level,
      sd.pos                         AS pos,
      sd.example_en                  AS example_en,
      sd.verified                    AS verified,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank              AS frequency_rank,
      bv.frequency_in_chapter        AS frequency_in_chapter,
      sd.skill_level                 AS skill_level,
      bv.id                          AS library_book_vocabulary_id,
      bv.first_sentence              AS first_sentence,
      bk.book_v_level                AS bvl
    FROM bk
    JOIN library_book_vocabularies bv ON bv.library_book_id = bk.id
    JOIN shared_dictionary sd ON sd.word = COALESCE(bv.lemma, bv.word)
    WHERE sd.v_level >= 6                                  -- P1 (D1=V6)
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard')
            NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY bv.chapter_idx, sd.word, bv.frequency_in_chapter DESC NULLS LAST
  ),
  norm AS (                                                -- P2: 챕터 max 정규화
    SELECT c.*,
      MAX(c.frequency_in_chapter) OVER (PARTITION BY c.chapter_idx) AS chapter_max_freq
    FROM cand c
  ),
  scored AS (
    SELECT n.*,
      ROUND(
          0.40 * CASE WHEN n.frequency_rank IS NULL THEN 0
                      ELSE 1.0 / LOG(10, n.frequency_rank::numeric + 10) END
        + 0.35 * COALESCE(
                   n.frequency_in_chapter::numeric / NULLIF(n.chapter_max_freq::numeric, 0),
                   0)
        + 0.15 * CASE
                   WHEN n.v_level BETWEEN 6 AND 9 THEN 1.0
                   WHEN n.v_level = 10 THEN 0.6
                   WHEN n.v_level = 11 THEN 0.4
                   ELSE 0
                 END
        + 0.10 * CASE
                   WHEN n.verified = true
                     OR (n.example_en IS NOT NULL AND length(n.example_en) > 0)
                   THEN 1.0 ELSE 0 END
        + CASE WHEN n.skill_level = 4 AND n.bvl < 6 THEN -0.10 ELSE 0 END
      , 4) AS composite_score
    FROM norm n
  )
  SELECT
    s.chapter_idx,
    s.word,
    s.word AS lemma,
    s.meaning_ko,
    s.v_level,
    s.cefr_level,
    s.pos,
    s.example_en,
    s.word_register,
    s.frequency_rank,
    s.frequency_in_chapter,
    s.skill_level,
    s.composite_score,
    ROW_NUMBER() OVER (
      PARTITION BY s.chapter_idx
      ORDER BY s.composite_score DESC, s.frequency_in_chapter DESC NULLS LAST,
               s.v_level ASC, s.word
    )::int AS sort_order,
    s.library_book_vocabulary_id,
    s.first_sentence
  FROM scored s
$function$;

CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
 RETURNS TABLE(word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_article integer, skill_level smallint, composite_score numeric, sort_order integer, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH art AS (
    SELECT la.id, la.article_v_level FROM library_articles la WHERE la.id = p_article_id
  ),
  cand AS (
    SELECT DISTINCT ON (sd.word)
      sd.word, sd.meaning_ko, sd.v_level, sd.cefr_level, sd.pos, sd.example_en,
      sd.verified AS verified,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank, av.frequency_in_article, sd.skill_level, av.first_sentence,
      art.article_v_level AS avl
    FROM art
    JOIN library_article_vocabularies av ON av.library_article_id = art.id
    JOIN shared_dictionary sd ON sd.word = COALESCE(av.lemma, av.word)
    WHERE sd.v_level >= 6
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  norm AS (                                                -- P2: 글 전체 max 정규화
    SELECT c.*,
      MAX(c.frequency_in_article) OVER () AS article_max_freq
    FROM cand c
  ),
  scored AS (
    SELECT n.*,
      ROUND(
          0.40 * CASE WHEN n.frequency_rank IS NULL THEN 0
                      ELSE 1.0 / LOG(10, n.frequency_rank::numeric + 10) END
        + 0.35 * COALESCE(
                   n.frequency_in_article::numeric / NULLIF(n.article_max_freq::numeric, 0),
                   0)
        + 0.15 * CASE
                   WHEN n.v_level BETWEEN 6 AND 9 THEN 1.0
                   WHEN n.v_level = 10 THEN 0.6
                   WHEN n.v_level = 11 THEN 0.4
                   ELSE 0
                 END
        + 0.10 * CASE
                   WHEN n.verified = true
                     OR (n.example_en IS NOT NULL AND length(n.example_en) > 0)
                   THEN 1.0 ELSE 0 END
        + CASE WHEN n.skill_level = 4 AND n.avl < 6 THEN -0.10 ELSE 0 END
      , 4) AS composite_score
    FROM norm n
  )
  SELECT
    s.word, s.word AS lemma, s.meaning_ko, s.v_level, s.cefr_level, s.pos, s.example_en,
    s.word_register, s.frequency_rank, s.frequency_in_article, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (
      ORDER BY s.composite_score DESC, s.frequency_in_article DESC NULLS LAST,
               s.v_level ASC, s.word
    )::int AS sort_order,
    s.first_sentence
  FROM scored s
$function$;
