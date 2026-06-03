-- 20260528_140000_book_extract_spelling_variants.sql
-- B안 — 큐레이션 단어 추출에 US/UK 철자 정규화 + 미바인딩 진단 3분류.
--
-- ① en_spelling_variants(text)         철자 변형 후보 생성 (US↔UK)
-- ② extract_book_vocabulary_admin       lemma NULL 단어를 철자 변형으로 회수
-- ③ find_unbound_book_lemmas            noise / spelling_variant / genuine_miss 세분
--
-- 안전장치: 변형 후보는 반드시 shared_dictionary 실 히트일 때만 채택 →
--           rule 기반 오변환이 단어장에 새지 않음.

BEGIN;

-- 반환 타입 변경 (컬럼 추가) → 기존 함수 DROP 필수
DROP FUNCTION IF EXISTS extract_book_vocabulary_admin(UUID, SMALLINT);
DROP FUNCTION IF EXISTS find_unbound_book_lemmas(UUID, INT);

-- ─────────────────────────────────────────────
-- ① 철자 변형 후보 (US↔UK 양방향, 사전 히트 시에만 의미)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION en_spelling_variants(p TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY(
    SELECT DISTINCT v FROM (
      VALUES
        (regexp_replace(p, 'or$',       'our')),     -- ardor→ardour, color→colour
        (regexp_replace(p, 'our$',      'or')),
        (regexp_replace(p, 'er$',       're')),       -- somber→sombre, sepulcher→sepulchre
        (regexp_replace(p, 're$',       'er')),
        (regexp_replace(p, 'ize$',      'ise')),      -- anatomize→anatomise
        (regexp_replace(p, 'ise$',      'ize')),
        (regexp_replace(p, 'ization$',  'isation')),
        (regexp_replace(p, 'isation$',  'ization')),
        (regexp_replace(p, 'yze$',      'yse')),      -- analyze→analyse
        (regexp_replace(p, 'yse$',      'yze')),
        (regexp_replace(p, 'og$',       'ogue')),     -- catalog→catalogue
        (regexp_replace(p, 'ogue$',     'og')),
        (regexp_replace(p, 'ense$',     'ence')),     -- defense→defence
        (regexp_replace(p, 'ence$',     'ense')),
        (regexp_replace(p, 'eled$',     'elled')),    -- traveled→travelled
        (regexp_replace(p, 'elled$',    'eled')),
        (regexp_replace(p, 'eling$',    'elling')),
        (regexp_replace(p, 'elling$',   'eling'))
    ) AS t(v)
    WHERE v <> p AND length(v) >= 2
  );
$$;

-- ─────────────────────────────────────────────
-- ② 도서 단어 재추출 — 철자 변형 회수 추가
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION extract_book_vocabulary_admin(
  p_book_id UUID,
  p_percentile SMALLINT DEFAULT 75
)
RETURNS TABLE(
  book_v_level SMALLINT,
  v_threshold SMALLINT,
  percentile_used SMALLINT,
  total_candidates INT,
  word TEXT,
  meaning_ko TEXT,
  v_level SMALLINT,
  cefr_level TEXT,
  pos TEXT,
  example_en TEXT,
  frequency_rank INT,
  skill_level SMALLINT,
  composite_score NUMERIC,
  score_breakdown JSONB,
  rank INT,
  match_via TEXT,
  matched_from TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book RECORD;
  v_baseline INT;
  v_thresh INT;
  v_pct NUMERIC;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;
  IF p_percentile NOT IN (70, 75, 80) THEN
    RAISE EXCEPTION 'invalid p_percentile: % (allowed: 70, 75, 80)', p_percentile;
  END IF;
  v_pct := p_percentile::numeric / 100.0;

  SELECT id INTO v_book FROM library_books WHERE id = p_book_id;
  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not found: %', p_book_id;
  END IF;

  WITH book_levels AS (
    SELECT d.v_level::int AS vl
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary d ON d.word = lbv.lemma
    WHERE lbv.library_book_id = p_book_id
      AND d.v_level IS NOT NULL AND d.v_level < 11 AND d.classified_by IS NOT NULL
  )
  SELECT COALESCE(percentile_disc(v_pct) WITHIN GROUP (ORDER BY vl)::int, 5)
  INTO v_baseline FROM book_levels;

  v_thresh := GREATEST(1, LEAST(v_baseline, 11));

  RETURN QUERY
  WITH base AS (
    SELECT DISTINCT lbv.lemma AS lemma_s, lbv.word AS word_s
    FROM library_book_vocabularies lbv
    WHERE lbv.library_book_id = p_book_id
  ),
  -- L1: lemma 직접 매칭 (analyze 단계 결과)
  direct AS (
    SELECT
      d.word AS c_word, d.meaning_ko AS c_meaning, d.v_level AS c_vl,
      d.cefr_level AS c_cefr, d.pos AS c_pos, d.example_en AS c_ex,
      d.frequency_rank AS c_freq, d.skill_level AS c_skill,
      'lemma'::text AS c_via, NULL::text AS c_from
    FROM (SELECT DISTINCT lemma_s FROM base WHERE lemma_s IS NOT NULL) b
    JOIN shared_dictionary d ON d.word = b.lemma_s
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
      AND d.v_level >= v_thresh
  ),
  -- L3: lemma NULL 단어를 철자 변형으로 회수
  variant AS (
    SELECT DISTINCT ON (d.word)
      d.word AS c_word, d.meaning_ko AS c_meaning, d.v_level AS c_vl,
      d.cefr_level AS c_cefr, d.pos AS c_pos, d.example_en AS c_ex,
      d.frequency_rank AS c_freq, d.skill_level AS c_skill,
      'spelling_variant'::text AS c_via, b.word_s AS c_from
    FROM (SELECT DISTINCT word_s FROM base WHERE lemma_s IS NULL AND word_s IS NOT NULL) b
    CROSS JOIN LATERAL unnest(en_spelling_variants(b.word_s)) AS cand(c)
    JOIN shared_dictionary d ON d.word = cand.c
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
      AND d.v_level >= v_thresh
      AND NOT EXISTS (SELECT 1 FROM direct dx WHERE dx.c_word = d.word)
  ),
  candidates AS (
    SELECT DISTINCT ON (c_word) *
    FROM (SELECT * FROM direct UNION ALL SELECT * FROM variant) u
    ORDER BY c_word, (c_via = 'lemma') DESC
  ),
  scored AS (
    SELECT c.*,
      1.0 / LOG(10, COALESCE(c.c_freq, 50000)::numeric + 10) AS c_freqb,
      CASE WHEN c.c_skill = 4 AND v_baseline < 6 THEN -0.10 ELSE 0 END AS c_skillp
    FROM candidates c
  ),
  composite AS (
    SELECT s.*,
      ROUND(0.70 * s.c_freqb + s.c_skillp, 4) AS c_score,
      ROW_NUMBER() OVER (
        ORDER BY (0.70 * s.c_freqb + s.c_skillp) DESC, s.c_vl ASC, s.c_freq ASC NULLS LAST
      ) AS c_rn,
      COUNT(*) OVER () AS c_total
    FROM scored s
  )
  SELECT
    v_baseline::smallint, v_thresh::smallint, p_percentile, c.c_total::int,
    c.c_word, c.c_meaning, c.c_vl::smallint, c.c_cefr, c.c_pos, c.c_ex,
    c.c_freq, c.c_skill::smallint, c.c_score,
    jsonb_build_object(
      'book_v_level_at_p', v_baseline,
      'v_threshold', v_thresh,
      'frequency_boost', ROUND(c.c_freqb, 4),
      'skill_penalty', c.c_skillp,
      'weights', jsonb_build_object('frequency_boost', 0.70, 'track_boost', 0.0),
      'match_via', c.c_via,
      'matched_from', c.c_from,
      'reasoning',
        'V' || c.c_vl || ' ≥ threshold V' || v_thresh || ' (P' || p_percentile || ' of book)'
        || CASE WHEN c.c_via = 'spelling_variant'
                THEN ' · 철자 변형 회수 (' || c.c_from || '→' || c.c_word || ')'
                ELSE '' END
    ),
    c.c_rn::int,
    c.c_via,
    c.c_from
  FROM composite c
  ORDER BY c.c_rn;
END $$;

REVOKE ALL ON FUNCTION extract_book_vocabulary_admin(UUID, SMALLINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION extract_book_vocabulary_admin(UUID, SMALLINT) TO authenticated;

-- ─────────────────────────────────────────────
-- ③ 미바인딩 진단 — noise / spelling_variant / genuine_miss 세분
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_unbound_book_lemmas(
  p_book_id UUID,
  p_limit INT DEFAULT 500
)
RETURNS TABLE(
  lemma TEXT,
  reason TEXT,
  dict_v_level SMALLINT,
  dict_meaning_ko TEXT,
  dict_classified_by TEXT,
  book_occurrences INT,
  variant_hit TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  RETURN QUERY
  WITH book_lemmas AS (
    SELECT COALESCE(lbv.lemma, lbv.word) AS w,
           BOOL_OR(lbv.lemma IS NULL) AS no_lemma,
           SUM(COALESCE(lbv.frequency_in_book, 1))::int AS occ
    FROM library_book_vocabularies lbv
    WHERE lbv.library_book_id = p_book_id
      AND COALESCE(lbv.lemma, lbv.word) IS NOT NULL
    GROUP BY COALESCE(lbv.lemma, lbv.word)
  ),
  joined AS (
    SELECT bl.w, bl.no_lemma, bl.occ,
           d.v_level, d.meaning_ko, d.classified_by,
           -- 철자 변형 회수는 사전 미등재 행에서만 계산 (CASE 단락 평가로 비용 절감)
           CASE WHEN d.word IS NULL THEN (
             SELECT vd.word
               FROM unnest(en_spelling_variants(bl.w)) AS cand(c)
               JOIN shared_dictionary vd ON vd.word = cand.c
               WHERE vd.v_level IS NOT NULL AND vd.classified_by IS NOT NULL
                 AND vd.meaning_ko IS NOT NULL AND LENGTH(vd.meaning_ko) > 0
               LIMIT 1
           ) ELSE NULL END AS v_hit
    FROM book_lemmas bl
    LEFT JOIN shared_dictionary d ON d.word = bl.w
  ),
  classified AS (
    SELECT j.w AS lemma, j.occ, j.v_level, j.meaning_ko, j.classified_by, j.v_hit,
      CASE
        -- 사전에 있으나 메타 불완전
        WHEN j.v_level IS NOT NULL AND j.classified_by IS NULL THEN 'not_classified'
        WHEN j.v_level IS NULL AND (j.meaning_ko IS NOT NULL OR j.classified_by IS NOT NULL) THEN 'no_v_level'
        WHEN j.v_level IS NOT NULL AND (j.meaning_ko IS NULL OR LENGTH(j.meaning_ko)=0) THEN 'no_meaning'
        WHEN j.v_level IS NOT NULL THEN 'ok'
        -- 사전 미등재 → 3분류
        WHEN j.v_hit IS NOT NULL THEN 'spelling_variant'
        WHEN j.w ~ '^[ivxlcdm]+$' OR length(j.w) < 3 OR j.w LIKE '%''%' THEN 'noise'
        WHEN j.w ~ '(ness|ment|tion|sion|ity|ous|ful|less|able|ible|ance|ence|ish|ward|wards|hood|ship|man|men|house|land|side|bed|like|some|ory|ary)$'
             OR j.w ~ '^(un|in|im|ir|il|dis|mis|over|under|out|re|pre|non|fore|counter)'
             OR (length(j.w) >= 6 AND j.w ~ '(ed|ing)$')
             THEN 'genuine_miss'
        ELSE 'noise'
      END AS reason
    FROM joined j
  )
  SELECT c.lemma, c.reason, c.v_level::smallint, c.meaning_ko,
         c.classified_by, c.occ, c.v_hit
  FROM classified c
  WHERE c.reason <> 'ok'
  ORDER BY
    CASE c.reason
      WHEN 'spelling_variant' THEN 1
      WHEN 'genuine_miss' THEN 2
      WHEN 'no_meaning' THEN 3
      WHEN 'no_v_level' THEN 4
      WHEN 'not_classified' THEN 5
      ELSE 6
    END,
    c.occ DESC, c.lemma
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
END $$;

REVOKE ALL ON FUNCTION find_unbound_book_lemmas(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_unbound_book_lemmas(UUID, INT) TO authenticated;

COMMIT;
