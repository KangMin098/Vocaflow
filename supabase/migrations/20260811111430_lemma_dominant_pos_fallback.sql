-- 20260811111430_lemma_dominant_pos_fallback.sql
-- context_pos 결측 시 폴백을 형태론 추측에서 **코퍼스 실측 우세 POS** 로.
--
-- 문제: 결함 03(문맥POS 미대응 sense) 잔여 7,987 출현을 추적하니 원인이 사전이 아니라
--   **context_pos 결측**이었다. 이 컬럼은 Phase 3 에서 추가돼 그 이전 추출분(구 파이프라인 9권)이
--   전부 NULL 이다:
--       high  NULL 7행 1,220회  vs  adjective 13행 172회
--       lay   NULL 8행   330회  vs  verb      10행  93회
--       spring NULL 7행  375회  vs  verb 87 / noun 61
--   NULL 이면 select_book_chapter_vocab 의 sense 선택 LATERAL 이
--   infer_form_pos(surface, head) 형태론 휴리스틱으로 폴백하는데, 그게 high→noun 을 돌려줘
--   "황홀감, 들뜸; 약물 환각" 이 선택된다. 사전은 이미 고쳤는데 **선택 신호가 없어서** 틀린다.
--
-- 왜 context_pos 를 채우지 않는가:
--   백필 근거를 재보니 같은 책 안의 신호는 253행뿐이고 36,162행은 **다른 책**에서 온다
--   (구 파이프라인 책은 통째로 NULL 이라 자기 책엔 근거가 없다). 그건 "이 챕터 문맥의
--   지배 POS" 가 아니라 **코퍼스 전역 사전(prior)** 이다. 그 값을 context_pos 에 써 넣으면
--   컬럼 의미가 오염되고, 다음 사람이 측정값으로 오해한다.
--   → context_pos 는 NULL(=미측정) 그대로 두고, **폴백 순서만 바꾼다.**
--
-- 폴백 우선순위: context_pos(측정) → 코퍼스 우세 POS(실측 통계) → infer_form_pos(형태론 추측)
--   형태론 추측을 없애지는 않는다 — 코퍼스에 그 표제어가 처음 등장하면 여전히 필요하다.

-- ─────────────────────────────────────────────────────────────
-- 표제어별 코퍼스 우세 POS — context_pos 가 실제로 측정된 행만 근거로 삼는다.
--
-- ⚠️ 일반 뷰로 두면 안 된다: select_book_chapter_vocab 호출마다 91k행을 재집계하고,
--    재발행은 그 함수를 책당 2회(품질 게이트 + 본선정) 호출한다 → 게이트가 30s 타임아웃.
--    실제로 첫 적용에서 그렇게 터졌다. 물질화 + lemma 유니크 인덱스로 전환.
--    새 도서 추출/재추출 후 refresh_lemma_dominant_pos() 로 갱신.
-- ─────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_lemma_dominant_pos AS
SELECT DISTINCT ON (lemma)
       lemma,
       context_pos AS dominant_pos,
       occ         AS evidence_occurrences
FROM (
  SELECT lemma, context_pos, SUM(frequency_in_book)::int AS occ
  FROM library_book_vocabularies
  WHERE lemma IS NOT NULL AND context_pos IS NOT NULL
  GROUP BY 1, 2
) t
ORDER BY lemma, occ DESC, context_pos;

CREATE UNIQUE INDEX IF NOT EXISTS mv_lemma_dominant_pos_pk ON public.mv_lemma_dominant_pos (lemma);

COMMENT ON MATERIALIZED VIEW public.mv_lemma_dominant_pos IS
  '표제어별 코퍼스 우세 POS — context_pos 가 측정된 행만 근거. select_book_chapter_vocab 의 sense 선택 폴백(형태론 추측보다 우선).';

GRANT SELECT ON public.mv_lemma_dominant_pos TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_lemma_dominant_pos()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$ REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_lemma_dominant_pos $$;

COMMENT ON FUNCTION public.refresh_lemma_dominant_pos() IS
  '새 도서 추출/재추출 후 우세 POS 통계 갱신.';

-- ─────────────────────────────────────────────────────────────
-- select_book_chapter_vocab — sense 선택 폴백에 우세 POS 삽입.
--   나머지(상대 밴드 게이트·composite·정렬)는 ADR 0004 그대로.
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
    LEFT JOIN mv_lemma_dominant_pos ldp ON ldp.lemma = sd.word
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      -- ★ 폴백 순서: 측정된 문맥 POS → 코퍼스 우세 POS → 형태론 추측
      WHERE s->>'pos' = COALESCE(bv.context_pos, ldp.dominant_pos, infer_form_pos(lower(bv.word), sd.word))
      ORDER BY ((s->>'v_level') IS NOT NULL) DESC LIMIT 1
    ) cs ON true
    WHERE
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
    SELECT c.*, (c.bvl IS NULL OR c.v_level <= LEAST(c.bvl + 3, 11)) AS in_core FROM cand c
  ),
  core_cnt AS (
    SELECT t.chapter_idx AS ch, count(*) FILTER (WHERE t.in_core) AS n_core FROM tagged t GROUP BY t.chapter_idx
  ),
  kept AS (
    SELECT t.* FROM tagged t JOIN core_cnt k ON k.ch = t.chapter_idx WHERE t.in_core OR k.n_core < 5
  ),
  norm AS (
    SELECT k.*, MAX(k.frequency_in_chapter) OVER (PARTITION BY k.chapter_idx) AS chapter_max_freq FROM kept k
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
  'ADR 0004 D1 상대 밴드 + sense 선택 폴백(context_pos → 코퍼스 우세 POS → 형태론 추측).';
