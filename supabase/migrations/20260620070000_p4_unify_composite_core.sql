-- 20260620070000_p4_unify_composite_core.sql
-- ═══════════════════════════════════════════════════════════
-- P4 — book·article 추출 단일 코어로 통합 (C5 drift 차단 · v06.81)
--
-- 변경:
--   1. 신규 IMMUTABLE scalar helper: _extract_composite_score()
--      composite 식의 단일 SSoT. 식 변경 시 한 곳만 수정.
--   2. select_book_chapter_vocab: scored CTE 가 헬퍼 호출
--   3. select_article_vocab     : scored CTE 가 헬퍼 호출
--
-- 회귀: 0 (bit-identical) — 헬퍼 본문 = P2 식 그대로.
--   Les Misérables 검증 (실측):
--     total=7472 · distinct=1677 · null_rank=1643 · distinct_null=46 (P2 와 100% 일치)
--     챕터1 top5: bishop V8 4043 0.7109 / petty V9 6881 0.6167 /
--                 occupy V6 1930 0.5467 / portion V6 2229 0.5444 / fate V6 3131 0.5394
--
-- 호출자 호환: publish_*_word_set / 트리거 / 외부 호출 영향 0
--   (select_*_vocab 반환 타입·시그니처 변경 없음).
--
-- 보존: 게이트 (P1), composite 식 (P2), cap 발행 (P3), DISTINCT/sort 무변동.
--
-- 롤백: docs/AI_CONTEXT/rollback/P4_원본_및_롤백_절차.md
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public._extract_composite_score(
  p_frequency_rank int,
  p_freq_in_unit int,
  p_unit_max_freq int,
  p_v_level smallint,
  p_verified boolean,
  p_example_en text,
  p_skill_level smallint,
  p_unit_v_level smallint
) RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT ROUND(
      0.40 * CASE WHEN p_frequency_rank IS NULL THEN 0
                  ELSE 1.0 / LOG(10, p_frequency_rank::numeric + 10) END
    + 0.35 * COALESCE(
               p_freq_in_unit::numeric / NULLIF(p_unit_max_freq::numeric, 0),
               0)
    + 0.15 * CASE
               WHEN p_v_level BETWEEN 6 AND 9 THEN 1.0
               WHEN p_v_level = 10 THEN 0.6
               WHEN p_v_level = 11 THEN 0.4
               ELSE 0
             END
    + 0.10 * CASE
               WHEN p_verified = true
                 OR (p_example_en IS NOT NULL AND length(p_example_en) > 0)
               THEN 1.0 ELSE 0 END
    + CASE WHEN p_skill_level = 4 AND p_unit_v_level < 6 THEN -0.10 ELSE 0 END
  , 4)
$function$;

COMMENT ON FUNCTION public._extract_composite_score IS
  'P4 — book·article 추출 composite 식 단일 SSoT. 가중치 0.40+0.35+0.15+0.10 = 1.0, -0.10 skill_penalty.';

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
    WHERE sd.v_level >= 6
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard')
            NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY bv.chapter_idx, sd.word, bv.frequency_in_chapter DESC NULLS LAST
  ),
  norm AS (
    SELECT c.*,
      MAX(c.frequency_in_chapter) OVER (PARTITION BY c.chapter_idx) AS chapter_max_freq
    FROM cand c
  ),
  scored AS (
    SELECT n.*,
      public._extract_composite_score(
        n.frequency_rank,
        n.frequency_in_chapter,
        n.chapter_max_freq::int,
        n.v_level,
        n.verified,
        n.example_en,
        n.skill_level,
        n.bvl
      ) AS composite_score
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
  norm AS (
    SELECT c.*,
      MAX(c.frequency_in_article) OVER () AS article_max_freq
    FROM cand c
  ),
  scored AS (
    SELECT n.*,
      public._extract_composite_score(
        n.frequency_rank,
        n.frequency_in_article,
        n.article_max_freq::int,
        n.v_level,
        n.verified,
        n.example_en,
        n.skill_level,
        n.avl
      ) AS composite_score
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
