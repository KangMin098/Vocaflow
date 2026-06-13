-- 20260606140000_unify_book_vocab_selection.sql
-- ═══════════════════════════════════════════════════════════
-- v06.35 — 도서 단어 추출 ↔ 도서 단어장 발행 단일 출처(SSoT) 통일 + 학습 최적 선정
--
-- 배경/진단 (점검 결과):
--   기존엔 3중 분리였음 —
--     · extract_book_vocabulary_admin : book 단위 · percentile threshold ·
--       composite 계산 · classified_by 필터 · lemma-only 매칭  (admin 미리보기)
--     · publish_book_word_sets         : 챕터 단위 · v_level>=book_v_level strict ·
--       composite 버림(chapter freq 순) · classified_by 미적용         (실제 발행)
--     · BookExtractionPanel UI         : word_register/match_via 기대(함수 미반환)
--   → admin 이 보는 "학습 최적 추출" 이 실제 발행 단어장에 반영 안 됨 (preview ≠ publish).
--
-- 사용자 결정:
--   · 단어장 = 학습 가치 단어만. 고어(archaic_literary)/시대어(period_cultural)/
--     구단위(phrase_unit) 는 제외 → 본문 툴팁(lookup_word_meaning)으로 reading 지원.
--   · 챕터당 상한 없음 — threshold 이상 전부, 학습가치 순.
--
-- 해법:
--   select_book_chapter_vocab(book_id) 단일 선정 함수 신설.
--   publish_book_word_sets + extract_book_vocabulary_admin 둘 다 이 함수를 호출
--   → 정의상 preview == 발행 100% 일치.
--
-- 멱등: 기존 발행 세트는 건드리지 않음(재발행은 CONTINUE). 기존 2권 재큐레이션은
--   별도(admin revert→republish) — 본 마이그레이션은 함수 정의만 교체.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────
-- 1) SSoT — 도서 챕터별 학습 단어 선정
--    필터: v_level >= book_v_level (i+1 앵커) · classified_by 필수 · meaning_ko 필수
--          · register 제외(고어/시대어/구단위 — 학습 가치 낮음, 툴팁으로 회수)
--    점수: composite = 0.70·freq_boost(범용 유용성) + 0.10·챕터 salience(맥락 중요도)
--                      + skill_penalty(과전문)         ← 높을수록 학습 우선
--    정렬: 챕터 내 composite DESC (sort_order 1-based)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION select_book_chapter_vocab(p_book_id uuid)
RETURNS TABLE(
  chapter_idx integer,
  word text,
  lemma text,
  meaning_ko text,
  v_level smallint,
  cefr_level text,
  pos text,
  example_en text,
  word_register text,
  frequency_rank integer,
  frequency_in_chapter integer,
  skill_level smallint,
  composite_score numeric,
  sort_order integer,
  library_book_vocabulary_id uuid
)
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
      bk.book_v_level                AS bvl
    FROM bk
    JOIN library_book_vocabularies bv ON bv.library_book_id = bk.id
    JOIN shared_dictionary sd ON sd.word = COALESCE(bv.lemma, bv.word)
    WHERE sd.v_level >= bk.book_v_level
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard')
            NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    -- DISTINCT ON 대표행: 챕터 내 최다 빈도
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
    s.library_book_vocabulary_id
  FROM scored s
$function$;

COMMENT ON FUNCTION select_book_chapter_vocab(uuid) IS
  'v06.35 도서 챕터별 학습 단어 선정 SSoT. v_level>=book_v_level + classified + meaning_ko + register(고어/시대어/구단위) 제외 + composite 순. publish_book_word_sets / extract_book_vocabulary_admin 공용 → preview==publish 보장.';

GRANT EXECUTE ON FUNCTION select_book_chapter_vocab(uuid) TO authenticated;


-- ───────────────────────────────────────────────────────────
-- 2) 발행 — SSoT 사용 (composite sort_order 그대로 적재)
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION publish_book_word_sets(p_book_id uuid)
RETURNS TABLE(chapter_idx integer, set_id uuid, word_count integer)
LANGUAGE plpgsql
AS $function$
DECLARE
  v_book RECORD;
  v_set_id uuid;
  v_chapter RECORD;
  v_count int;
BEGIN
  SELECT id, title, book_v_level, cefr_level INTO v_book
  FROM library_books WHERE id = p_book_id;
  IF v_book IS NULL THEN RAISE EXCEPTION 'Book % not found', p_book_id; END IF;
  IF v_book.book_v_level IS NULL THEN
    RAISE EXCEPTION 'Book % has no book_v_level', p_book_id;
  END IF;

  -- SSoT 1회 계산 → temp (챕터 루프마다 재계산 회피)
  DROP TABLE IF EXISTS _sel;  -- 동일 tx 재진입 가드
  CREATE TEMP TABLE _sel ON COMMIT DROP AS
    SELECT * FROM select_book_chapter_vocab(p_book_id);

  FOR v_chapter IN
    SELECT DISTINCT s.chapter_idx FROM _sel s ORDER BY s.chapter_idx
  LOOP
    SELECT id INTO v_set_id FROM shared_word_sets
    WHERE (curation_query->>'book_id') = p_book_id::text
      AND (curation_query->>'chapter_idx')::int = v_chapter.chapter_idx;
    IF v_set_id IS NOT NULL THEN CONTINUE; END IF;  -- 멱등

    INSERT INTO shared_word_sets (
      title, description, category, cefr_level, is_published, auto_curated,
      slug, cover_emoji, version, curation_query
    ) VALUES (
      v_book.title || ' — Ch.' || v_chapter.chapter_idx,
      v_book.title || ' 챕터 ' || v_chapter.chapter_idx || ' 핵심 어휘 (V' || v_book.book_v_level || '+)',
      'library_book', v_book.cefr_level, true, true,
      'book-' || v_book.id::text || '-ch-' || v_chapter.chapter_idx,
      '📖', 2,
      jsonb_build_object(
        'book_id', v_book.id,
        'chapter_idx', v_chapter.chapter_idx,
        'filter', 'select_book_chapter_vocab',
        'book_v_level', v_book.book_v_level,
        'selection', 'v06.35 learning-optimal (register-filtered, composite-ranked)'
      )
    ) RETURNING id INTO v_set_id;

    INSERT INTO shared_words (
      set_id, word, lemma, meaning_ko, cefr_level, sort_order, library_book_vocabulary_id
    )
    SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order, s.library_book_vocabulary_id
    FROM _sel s
    WHERE s.chapter_idx = v_chapter.chapter_idx
    ORDER BY s.sort_order;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    UPDATE shared_word_sets SET word_count = v_count WHERE id = v_set_id;

    chapter_idx := v_chapter.chapter_idx;
    set_id := v_set_id;
    word_count := v_count;
    RETURN NEXT;
  END LOOP;

  DROP TABLE IF EXISTS _sel;
END;
$function$;

COMMENT ON FUNCTION publish_book_word_sets(uuid) IS
  'v06.35 — select_book_chapter_vocab(SSoT) 기반 챕터 단어장 발행. preview(extract_book_vocabulary_admin)와 동일 단어/순서. 멱등(기존 세트 SKIP).';


-- ───────────────────────────────────────────────────────────
-- 3) admin 미리보기 — SSoT 사용 (preview == publish)
--    signature 유지(uuid, smallint). p_percentile 는 echo 만(threshold 미변경 —
--    발행은 항상 book_v_level). 반환에 chapter_idx/word_register/frequency_in_chapter 추가.
--    반환 타입 변경 → DROP 후 재생성 (CREATE OR REPLACE 불가).
-- ───────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS extract_book_vocabulary_admin(uuid, smallint);

CREATE FUNCTION extract_book_vocabulary_admin(p_book_id uuid, p_percentile smallint DEFAULT 75)
RETURNS TABLE(
  book_v_level smallint,
  v_threshold smallint,
  percentile_used smallint,
  total_candidates integer,
  chapter_idx integer,
  word text,
  meaning_ko text,
  v_level smallint,
  cefr_level text,
  pos text,
  example_en text,
  word_register text,
  frequency_rank integer,
  skill_level smallint,
  frequency_in_chapter integer,
  composite_score numeric,
  score_breakdown jsonb,
  rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bvl smallint;
  v_total int;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;
  IF p_percentile NOT IN (70, 75, 80) THEN
    RAISE EXCEPTION 'invalid p_percentile: % (allowed: 70, 75, 80)', p_percentile;
  END IF;

  SELECT lb.book_v_level INTO v_bvl FROM library_books lb WHERE lb.id = p_book_id;
  IF v_bvl IS NULL THEN
    RAISE EXCEPTION 'Book % not found or has no book_v_level', p_book_id;
  END IF;

  SELECT count(*) INTO v_total FROM select_book_chapter_vocab(p_book_id);

  RETURN QUERY
  SELECT
    v_bvl AS book_v_level,
    v_bvl AS v_threshold,            -- 발행 threshold = book_v_level (percentile 무관)
    p_percentile AS percentile_used, -- echo only (deprecated — preview==publish)
    v_total AS total_candidates,
    s.chapter_idx,
    s.word,
    s.meaning_ko,
    s.v_level,
    s.cefr_level,
    s.pos,
    s.example_en,
    s.word_register,
    s.frequency_rank,
    s.skill_level,
    s.frequency_in_chapter,
    s.composite_score,
    jsonb_build_object(
      'book_v_level', v_bvl,
      'v_threshold', v_bvl,
      'chapter_idx', s.chapter_idx,
      'register', s.word_register,
      'frequency_in_chapter', s.frequency_in_chapter,
      'selection', 'select_book_chapter_vocab',
      'note', 'preview == publish · 고어/시대어 제외 · composite 순'
    ) AS score_breakdown,
    ROW_NUMBER() OVER (
      ORDER BY s.composite_score DESC, s.frequency_in_chapter DESC NULLS LAST,
               s.v_level ASC, s.word
    )::int AS rank
  FROM select_book_chapter_vocab(p_book_id) s;
END;
$function$;

COMMENT ON FUNCTION extract_book_vocabulary_admin(uuid, smallint) IS
  'v06.35 — select_book_chapter_vocab(SSoT) 그대로 반환. preview==publish. p_percentile deprecated(threshold 는 항상 book_v_level). chapter_idx/word_register/frequency_in_chapter 추가.';

COMMIT;
