-- 20260620030000_extraction_fixed_learnable_floor.sql
-- ═══════════════════════════════════════════════════════════
-- P1 — 추출 게이트 디커플 (C3 해결 · D1=V6 확정)
--
-- 변경점 (handoff 1-2/1-3): WHERE 게이트 1줄만 교체.
--   book   AS-IS: WHERE sd.v_level >= bk.book_v_level
--   book   TO-BE: WHERE sd.v_level >= 6
--   article AS-IS: WHERE sd.v_level >= COALESCE(art.article_v_level, 4)
--   article TO-BE: WHERE sd.v_level >= 6
--
--   · composite / skill penalty / register exclude / 정렬 / cap 전부 보존 (P2/P3 분리)
--   · book_v_level (skill penalty CASE bvl) 보존 — 난이도 표시 compute_book_vrl 유지
--
-- 효과 (P0 측정 기반):
--   · V6~V8 학습밴드(CSAT 핵심)가 어려운 책(V9 7권 / V8 3권 / V7 5권)에서 복원
--   · 추정 회복 ~23,000 단어 인스턴스
--   · V≤6 책 (Alice / Wizard of Oz / Ammachi 등) 영향 0
--
-- 검증 (실측 2026-06-20):
--   · Les Misérables (V9) — V6=1,117 / V7=1,240 / V8=1,120 복원 (이전 0/0/0)
--   · Alice (V6) — V6=169 / V7=121 / V8=70 (변동 0)
--   · published 5권 전부 추출 회귀 0
--
-- 롤백:
--   docs/AI_CONTEXT/rollback/P1_select_book_chapter_vocab_원본.sql
--   docs/AI_CONTEXT/rollback/P1_select_article_vocab_원본.sql
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
    WHERE sd.v_level >= 6   -- P1 (D1=V6): 학습밴드 고정 floor
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard')
            NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY bv.chapter_idx, sd.word, bv.frequency_in_chapter DESC NULLS LAST
  ),
  scored AS (
    SELECT c.*,
      ROUND(
          0.70 * (1.0 / LOG(10, COALESCE(c.frequency_rank, 50000)::numeric + 10))
        + 0.10 * (1.0 - 1.0 / (COALESCE(c.frequency_in_chapter, 1) + 1))
        + CASE WHEN c.skill_level = 4 AND c.bvl < 6 THEN -0.10 ELSE 0 END
      , 4) AS composite_score
    FROM cand c
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
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank, av.frequency_in_article, sd.skill_level, av.first_sentence,
      art.article_v_level AS avl
    FROM art
    JOIN library_article_vocabularies av ON av.library_article_id = art.id
    JOIN shared_dictionary sd ON sd.word = COALESCE(av.lemma, av.word)
    WHERE sd.v_level >= 6   -- P1 (D1=V6): book 함수와 일치 (drift 차단)
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  scored AS (
    SELECT c.*,
      ROUND(
          0.70 * (1.0 / LOG(10, COALESCE(c.frequency_rank, 50000)::numeric + 10))
        + 0.10 * (1.0 - 1.0 / (COALESCE(c.frequency_in_article, 1) + 1))
        + CASE WHEN c.skill_level = 4 AND c.avl < 6 THEN -0.10 ELSE 0 END
      , 4) AS composite_score
    FROM cand c
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
