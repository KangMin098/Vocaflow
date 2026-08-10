-- 20260810100000_vocab_selection_relative_band.sql
-- ADR 0004 D1 + D2 — 도서 어휘 선정을 절대 V6 바닥에서 book_v_level 상대 밴드로.
--
-- 결함 (2026-08-10 실측):
--   select_book_chapter_vocab 의 유일한 레벨 조건이 `v_level >= 6` (하드코딩, 상한 없음)이고
--   book_v_level 은 게이트에 전혀 안 쓰였다. 카탈로그 40권 중 19권(48%)이 book_v_level 2~4 라
--     · Bed-Time Stories(V2) 후보 0개 → 세트 생성 불가
--     · The Mango Tree(V2) 후보 1개, 그것도 V10  = i+8
--     · Gibbon(V11) 에 V6~7 단어 2,179개  = 독자 수준보다 한참 아래
--   커버리지가 확증한다 — Ammachi(V2)는 V1 51.9% → V6 94.4%. 이 책을 읽게 만드는 단어는
--   V3~V6 인데 현행 게이트가 그 전부를 버린다.
--
-- D1 — 레벨 게이트: v_level BETWEEN book_v_level-1 AND book_v_level+3
--   하한 -1: book_v_level 은 타입 p75 라 학습자 기준선보다 높다. 바로 아래 한 칸은 아직
--            불안정한 회상 대상 (원칙 ① Active Recall · ③ Desirable Difficulty).
--   상한 +3: i+4 이상은 맥락 추론이 불가능해 작업기억을 초과 (원칙 ⑥ Cognitive Load).
--   폴백   : 코어 밴드 후보가 챕터당 5개 미만이면 그 챕터만 +4 까지 확장
--            (Les Misérables 364장 중 4장 해당).
--   book_v_level NULL 인 책(Huckleberry Finn)은 기존 `>= 6` 로 폴백 — compute_book_vrl 선행 필요.
--
-- D2 — 밴드 보너스(0.15 가중)를 절대 V6~9 고정에서 i+1 거리로 교체.
--   _extract_composite_score 는 select_article_vocab 도 쓴다. 거기도 자기 단위 레벨
--   (article_v_level)을 넘기므로 같은 상대 로직이 그대로 맞다 (현재 article vocab 0행).
--   나머지 3축(전역빈도 0.40 · 단위내빈도 0.35 · 검증 0.10)은 레벨과 독립이라 그대로 둔다.

-- ─────────────────────────────────────────────────────────────
-- D2 — composite score: 절대 밴드 → i+1 거리
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._extract_composite_score(
  p_frequency_rank integer,
  p_freq_in_unit   integer,
  p_unit_max_freq  integer,
  p_v_level        smallint,
  p_verified       boolean,
  p_example_en     text,
  p_skill_level    smallint,
  p_unit_v_level   smallint
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT ROUND(
      0.40 * CASE WHEN p_frequency_rank IS NULL THEN 0
                  ELSE 1.0 / LOG(10, p_frequency_rank::numeric + 10) END
    + 0.35 * COALESCE(p_freq_in_unit::numeric / NULLIF(p_unit_max_freq::numeric, 0), 0)
    -- ADR 0004 D2 — 목표는 unit_v_level + 1 (i+1). 정확히 i+1 이면 1.0, 4칸 벌어지면 0.
    --   단위 레벨이 없으면(구 데이터) 이전 절대 밴드로 폴백해 회귀를 만들지 않는다.
    + 0.15 * CASE
               WHEN p_v_level IS NULL THEN 0
               WHEN p_unit_v_level IS NULL THEN
                 CASE WHEN p_v_level BETWEEN 6 AND 9 THEN 1.0
                      WHEN p_v_level = 10 THEN 0.6
                      WHEN p_v_level = 11 THEN 0.4
                      ELSE 0 END
               ELSE GREATEST(
                      0,
                      1.0 - ABS(p_v_level::numeric - (p_unit_v_level::numeric + 1)) / 4
                    )
             END
    + 0.10 * CASE
               WHEN p_verified = true
                 OR (p_example_en IS NOT NULL AND length(p_example_en) > 0)
               THEN 1.0 ELSE 0 END
    -- 쉬운 책에 얹힌 고급 skill 단어는 감점 (상대 밴드 도입으로 이제 저레벨 책에서 실제 작동)
    + CASE WHEN p_skill_level = 4 AND p_unit_v_level < 6 THEN -0.10 ELSE 0 END
  , 4)
$function$;

COMMENT ON FUNCTION public._extract_composite_score(integer, integer, integer, smallint, boolean, text, smallint, smallint) IS
  'ADR 0004 D2 — 4축 composite. 레벨 축은 절대 밴드가 아니라 unit_v_level+1(i+1) 로부터의 거리.';

-- ─────────────────────────────────────────────────────────────
-- D1 — 레벨 게이트: 상대 밴드 + 얇은 챕터 폴백
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.select_book_chapter_vocab(p_book_id uuid)
RETURNS TABLE(
  chapter_idx integer, word text, lemma text, meaning_ko text, v_level smallint,
  cefr_level text, pos text, example_en text, word_register text, frequency_rank integer,
  frequency_in_chapter integer, skill_level smallint, composite_score numeric,
  sort_order integer, library_book_vocabulary_id uuid, first_sentence text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
SET statement_timeout TO '30000'
AS $function$
  WITH bk AS (SELECT lb.id, lb.book_v_level FROM library_books lb WHERE lb.id = p_book_id),
  cand AS (
    SELECT DISTINCT ON (bv.chapter_idx, sd.word)
      bv.chapter_idx::int AS chapter_idx, lower(bv.word) AS surface, sd.word AS headword,
      COALESCE(cs.sense_meaning, sd.meaning_ko) AS meaning_ko,
      COALESCE(cs.sense_v, sd.v_level) AS v_level,
      sd.cefr_level AS cefr_level, COALESCE(cs.sense_pos, sd.pos) AS pos,
      sd.example_en AS example_en, sd.verified AS verified,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank AS frequency_rank, bv.frequency_in_chapter AS frequency_in_chapter,
      sd.skill_level AS skill_level, bv.id AS library_book_vocabulary_id,
      bv.first_sentence AS first_sentence, bk.book_v_level AS bvl
    FROM bk
    JOIN library_book_vocabularies bv ON bv.library_book_id = bk.id
    JOIN shared_dictionary sd ON sd.word = CASE
      WHEN EXISTS (SELECT 1 FROM shared_dictionary x
                   WHERE x.word = lower(bv.word)
                     AND x.classified_by IS NOT NULL
                     AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko) > 0)
      THEN lower(bv.word)
      ELSE resolve_dict_headword(COALESCE(bv.lemma, bv.word))
    END
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      WHERE s->>'pos' = COALESCE(bv.context_pos, infer_form_pos(lower(bv.word), sd.word))
      ORDER BY ((s->>'v_level') IS NOT NULL) DESC LIMIT 1
    ) cs ON true
    WHERE
      -- ADR 0004 D1 — 상대 밴드. +4 까지 일단 담고 아래에서 코어(+3)만 남기되,
      --                얇은 챕터에 한해 +4 를 허용한다.
      CASE
        WHEN bk.book_v_level IS NULL
          THEN COALESCE(cs.sense_v, sd.v_level) >= 6
        ELSE COALESCE(cs.sense_v, sd.v_level)
               BETWEEN GREATEST(bk.book_v_level - 1, 1)
                   AND LEAST(bk.book_v_level + 4, 11)
      END
      AND sd.classified_by IS NOT NULL
      AND COALESCE(cs.sense_meaning, sd.meaning_ko) IS NOT NULL
      AND length(COALESCE(cs.sense_meaning, sd.meaning_ko)) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN
          ('archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun')
    ORDER BY bv.chapter_idx, sd.word, bv.frequency_in_chapter DESC NULLS LAST
  ),
  tagged AS (
    SELECT c.*,
           (c.bvl IS NULL OR c.v_level <= LEAST(c.bvl + 3, 11)) AS in_core
    FROM cand c
  ),
  core_cnt AS (
    SELECT t.chapter_idx AS ch, count(*) FILTER (WHERE t.in_core) AS n_core
    FROM tagged t GROUP BY t.chapter_idx
  ),
  kept AS (
    SELECT t.* FROM tagged t
    JOIN core_cnt k ON k.ch = t.chapter_idx
    WHERE t.in_core OR k.n_core < 5   -- 폴백: 코어가 5개 미만인 챕터만 +4 허용
  ),
  norm AS (
    SELECT k.*, MAX(k.frequency_in_chapter) OVER (PARTITION BY k.chapter_idx) AS chapter_max_freq
    FROM kept k
  ),
  scored AS (
    SELECT n.*, public._extract_composite_score(
      n.frequency_rank, n.frequency_in_chapter, n.chapter_max_freq::int,
      n.v_level, n.verified, n.example_en, n.skill_level, n.bvl
    ) AS composite_score
    FROM norm n
  )
  SELECT s.chapter_idx, s.surface AS word, s.headword AS lemma, s.meaning_ko, s.v_level,
    s.cefr_level, s.pos, s.example_en, s.word_register,
    s.frequency_rank, s.frequency_in_chapter, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (
      PARTITION BY s.chapter_idx
      ORDER BY s.composite_score DESC, s.frequency_in_chapter DESC NULLS LAST, s.v_level ASC, s.surface
    )::int AS sort_order,
    s.library_book_vocabulary_id, s.first_sentence
  FROM scored s
$function$;

COMMENT ON FUNCTION public.select_book_chapter_vocab(uuid) IS
  'ADR 0004 D1 — 레벨 게이트 = book_v_level 상대 밴드(-1 ~ +3, 얇은 챕터는 +4). 이전 하드코딩 v_level>=6 대체.';
