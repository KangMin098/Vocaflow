-- supabase/migrations/20260901040000_lav_drop_dead_columns.sql
--
-- **library_article_vocabularies 에서 죽은 컬럼 3개를 걷는다.**
--
-- ── 왜 (실측 2026-09-01) ──────────────────────────────────────────────
-- 이 테이블은 4,249 MB 로 DB(7,628 MB)의 **55.7%** 다. 그런데 내용은 전부
-- 재현 가능한 캐시다 — 보관 중인 `library_articles.content` 에
--   normalizePunctuation → reflowSoftHyphens → extractBookLemmas → computeLearningValue
-- 를 돌리면(전부 순수 동기 함수, LLM·네트워크 0) 낱말·빈도·first_sentence 가
-- **비트 단위로 일치**한다(6편 2,565행 대조, 불일치 0). 편당 46.5 ms.
--
-- 이 마이그레이션은 그 큰 이야기(보관 범위 축소)를 하지 않는다. 어느 쪽으로 가든
-- **틀림없이 낭비인 것만** 걷는다:
--
--   lemma       11,011,463행 **전부 NULL** (pg_stats.null_frac = 1.0).
--               증거 하나 더 — 부분 인덱스 `idx_lav_lemma` 가 16 kB(=빈 인덱스)다.
--               그런데 shared_dictionary(word) FK 가 걸려 있고 RPC 3개가
--               `COALESCE(lav.lemma, lav.word)` 로 매번 되짚는다.
--               ⚠️ `library_book_vocabularies.lemma` 는 **94.8% 채워진 살아있는 컬럼**이다
--                  (null_frac 0.05). 그쪽은 건드리지 않는다.
--
--   id          uuid 대리키. `pg_stat_user_indexes.idx_scan = 0` — 399 MB 인덱스가
--               한 번도 안 쓰였다. 이 컬럼을 참조하는 FK 0개, 코드의 `.select('id')` 0곳,
--               RLS 정책도 library_article_id 만 본다. 실제로 쓰이는 키는
--               `(library_article_id, word)` 유니크 인덱스로 **6,410,326 scans**.
--
--   created_at  읽는 코드 0곳. 한 기사의 행은 analyzeArticle 이 한 배치로 쓰므로
--               행마다 시각을 둘 이유가 없고, 기사 수준에 `vrl_calculated_at` 이 있다.
--
-- ── 절감 ──────────────────────────────────────────────────────────────
--   즉시   PK 인덱스 399 MB — DROP CONSTRAINT 하는 순간 반환된다.
--   재작성 heap 385 MB (305 → 268 B/행).
--          ⚠️ **DROP COLUMN 은 카탈로그만 고친다.** heap 은 VACUUM FULL 을
--             돌려야 실제로 준다 — 아래 §3 안내. 그때까지 heap 은 3,199 MB 그대로다.
--   합계   4,249 → 약 3,464 MB
--
-- ── 재실행 안전 ────────────────────────────────────────────────────────
-- IF EXISTS / IF NOT EXISTS 로 감쌌다. 두 번 돌려도 결과가 같다. RPC 는 CREATE OR REPLACE.
--
-- ── 되돌리기 ──────────────────────────────────────────────────────────
-- ADD COLUMN 으로 컬럼은 되살아나지만 **값은 안 돌아온다.** 다만 lemma 는 전량 NULL,
-- id 는 아무도 안 읽으므로 실제로 잃는 정보는 created_at(행별 분석 시각) 하나다.

-- ─────────────────────────────────────────────────────────────────────
-- 1) RPC 3개에서 av.lemma 참조를 걷는다 — 컬럼을 지우기 **전에** 해야 한다.
--    SQL 문자열 본문($function$)은 의존성 추적이 안 되므로 DROP COLUMN 이
--    막아주지 않는다. 그대로 두면 런타임에 42703 으로 터진다.
--    ⚠️ 동작은 안 바뀐다 — lemma 가 전부 NULL 이라 COALESCE 는 이미 항상
--       오른쪽(word)을 골라 왔다.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_article_vrl(p_article_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_p50 INT; v_p75 INT; v_p90 INT; v_weighted_avg NUMERIC;
  v_matched_lemmas INT; v_total_lav INT; v_v_level_div INT; v_coverage_pct NUMERIC;
BEGIN
  IF p_article_id IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO v_total_lav FROM library_article_vocabularies WHERE library_article_id = p_article_id;
  IF v_total_lav = 0 THEN RETURN; END IF;

  WITH joined AS (
    SELECT DISTINCT lav.word AS lemma, sd.v_level
    FROM library_article_vocabularies lav
    JOIN shared_dictionary sd ON sd.word = lav.word
    WHERE lav.library_article_id = p_article_id
      AND sd.v_level IS NOT NULL AND sd.v_level <> 11
  )
  SELECT
    PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY v_level)::int,
    PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY v_level)::int,
    PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY v_level)::int,
    ROUND(AVG(v_level)::numeric, 2)
  INTO v_p50, v_p75, v_p90, v_weighted_avg
  FROM joined;
  IF v_p75 IS NULL THEN RETURN; END IF;

  SELECT COUNT(DISTINCT lav.word), COUNT(DISTINCT sd.v_level)
    INTO v_matched_lemmas, v_v_level_div
  FROM library_article_vocabularies lav
  JOIN shared_dictionary sd ON sd.word = lav.word
  WHERE lav.library_article_id = p_article_id
    AND sd.v_level IS NOT NULL AND sd.v_level <> 11;
  v_coverage_pct := ROUND(100.0 * v_matched_lemmas / NULLIF(v_total_lav, 0), 2);

  UPDATE library_articles SET
    article_v_level = v_p75::smallint,
    vrl_components = jsonb_build_object(
      'p50', v_p50, 'p75', v_p75, 'p90', v_p90,
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

CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
 RETURNS TABLE(word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_article integer, skill_level smallint, composite_score numeric, sort_order integer, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
 SET statement_timeout TO '30000'
AS $function$
  WITH art AS (SELECT la.id, la.article_v_level FROM library_articles la WHERE la.id = p_article_id),
  cand AS (
    SELECT DISTINCT ON (sd.word)
      lower(av.word) AS surface, sd.word AS headword,
      COALESCE(cs.sense_meaning, sd.meaning_ko) AS meaning_ko,
      COALESCE(cs.sense_v, sd.v_level) AS v_level,
      sd.cefr_level AS cefr_level, COALESCE(cs.sense_pos, sd.pos) AS pos,
      sd.example_en AS example_en, sd.verified AS verified,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank AS frequency_rank, av.frequency_in_article AS frequency_in_article,
      sd.skill_level AS skill_level, av.first_sentence AS first_sentence,
      art.article_v_level AS avl
    FROM art
    JOIN library_article_vocabularies av ON av.library_article_id = art.id
    JOIN shared_dictionary sd ON sd.word = CASE
      WHEN EXISTS (SELECT 1 FROM shared_dictionary x
                   WHERE x.word = lower(av.word)
                     AND x.classified_by IS NOT NULL
                     AND NOT x.archived   -- ① 보관된 표면형은 고르지 않는다 → 표제어로 되짚는다
                     AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko) > 0)
      THEN lower(av.word)
      ELSE resolve_dict_headword(av.word)
    END
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      WHERE s->>'pos' = COALESCE(av.context_pos, infer_form_pos(lower(av.word), sd.word))
      ORDER BY ((s->>'v_level') IS NOT NULL) DESC LIMIT 1
    ) cs ON true
    WHERE COALESCE(cs.sense_v, sd.v_level) >= 6
      AND sd.classified_by IS NOT NULL
      AND NOT sd.archived   -- ② 표제어 자체가 보관된 경우
      AND COALESCE(cs.sense_meaning, sd.meaning_ko) IS NOT NULL
      AND length(COALESCE(cs.sense_meaning, sd.meaning_ko)) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  norm AS (SELECT c.*, MAX(c.frequency_in_article) OVER () AS article_max_freq FROM cand c),
  scored AS (SELECT n.*, public._extract_composite_score(n.frequency_rank, n.frequency_in_article, n.article_max_freq::int, n.v_level, n.verified, n.example_en, n.skill_level, n.avl) AS composite_score FROM norm n)
  SELECT s.surface AS word, s.headword AS lemma, s.meaning_ko, s.v_level, s.cefr_level, s.pos, s.example_en, s.word_register,
    s.frequency_rank, s.frequency_in_article, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (ORDER BY s.composite_score DESC, s.frequency_in_article DESC NULLS LAST, s.v_level ASC, s.surface)::int AS sort_order,
    s.first_sentence
  FROM scored s
$function$;

-- ⚠️ 이 함수는 도서(library_book_vocabularies)와 기사를 UNION 한다.
--    **도서 쪽 coalesce(lemma,word) 는 그대로 둔다** — 그 lemma 는 94.8% 채워진 살아있는 값이다.
--    기사 쪽만 word 로 바꾼다.
CREATE OR REPLACE FUNCTION public.select_extraction_residual()
 RETURNS TABLE(word text, context text, freq integer, sources text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
 SET statement_timeout TO '60000'
AS $function$
  WITH tok AS (
    SELECT lower(coalesce(lemma,word)) AS w, first_sentence AS fs, frequency_in_chapter AS freq, 'book' AS src
    FROM library_book_vocabularies WHERE coalesce(lemma,word) ~ '^[a-z]+$'
    UNION ALL
    SELECT lower(word) AS w, first_sentence, frequency_in_article, 'article'
    FROM library_article_vocabularies WHERE word ~ '^[a-z]+$'
  ),
  agg AS (
    SELECT w, max(freq) AS freq,
      (array_agg(fs ORDER BY length(fs) DESC) FILTER (WHERE fs ~ ('\m'||w||'\M')))[1] AS ctx,
      string_agg(DISTINCT src, ',') AS sources,
      bool_or(fs IS NOT NULL AND fs ~ ('\m'||w||'\M')) AS appears_lower
    FROM tok WHERE length(w) >= 4
    GROUP BY w
  )
  SELECT a.w, left(a.ctx, 300), a.freq, a.sources
  FROM agg a
  WHERE a.appears_lower
    AND NOT EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word=a.w AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0)
    AND NOT EXISTS (SELECT 1 FROM lexicon_clean c WHERE c.word=a.w AND (c.meaning_ko IS NOT NULL OR c.gloss_en IS NOT NULL))
  ORDER BY a.freq DESC NULLS LAST, a.w
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) 죽은 컬럼을 걷는다.
--    DROP CONSTRAINT pkey 가 399 MB 인덱스를 즉시 반환한다.
--    DROP COLUMN lemma 가 FK(library_article_vocabularies_lemma_fkey)와
--    부분 인덱스 idx_lav_lemma 를 함께 데려간다.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.library_article_vocabularies
  DROP CONSTRAINT IF EXISTS library_article_vocabularies_pkey,
  DROP COLUMN IF EXISTS id,
  DROP COLUMN IF EXISTS lemma,
  DROP COLUMN IF EXISTS created_at;

-- 기본키는 **세우지 않는다.** 실제로 쓰이는 키
-- `library_article_vocabularies_library_article_id_word_key` (UNIQUE, 두 컬럼 다 NOT NULL,
-- 6,410,326 scans) 를 그대로 둔다.
--
-- ⚠️ 왜 PK 로 승격하지 않는가 — 승격하려면 유니크 제약을 떨구고 다시 만들어야 하는데
--   (Postgres 는 이미 제약이 소유한 인덱스를 `ADD CONSTRAINT … USING INDEX` 로 못 가져온다)
--   그게 11,011,463행에 대한 **650 MB 인덱스 재빌드**다. 그 값을 치를 이유가 없다:
--     · PostgREST 는 PK 없이도 이 표의 경로를 다 처리한다 — 쓰기 경로(`analyze-article.ts`)는
--       delete + insert 이고 upsert 가 아니라 ON CONFLICT 추론이 필요 없다.
--     · 논리 복제 대상이 아니다 — `pg_publication_rel` 에 이 표가 없다(실측). 그래서
--       REPLICA IDENTITY 도 문제되지 않는다.
--   NOT NULL + UNIQUE 는 이 표가 쓰는 범위에서 PK 와 기능적으로 같다.

COMMENT ON TABLE public.library_article_vocabularies IS
  '기사별 어휘 색인. **원문에서 재현 가능한 캐시다** — content 에 normalizePunctuation → '
  'reflowSoftHyphens → extractBookLemmas → computeLearningValue 를 돌리면 비트 단위로 같다'
  '(편당 46.5 ms, 실측 2026-09-01). 고유 정보가 없으므로 보관 범위는 비용 문제이지 '
  '데이터 손실 문제가 아니다.';

-- ─────────────────────────────────────────────────────────────────────
-- 3) heap 385 MB 는 이 파일이 반환하지 못한다 — 마이그레이션 밖에서 따로 돌린다.
--    (VACUUM FULL 은 트랜잭션 안에서 못 돈다. Supabase 는 마이그레이션을
--     트랜잭션으로 감싸므로 여기 넣으면 25001 로 실패한다.)
--
--      VACUUM FULL ANALYZE public.library_article_vocabularies;
--
--    ⚠️ ACCESS EXCLUSIVE 락을 잡고 새 사본을 쓴다 — 약 2.8 GB 여유 디스크가 필요하고
--       그동안 이 테이블을 읽는 모든 경로(조판·발행·Admin 미리보기)가 멈춘다.
--       DB 는 현재 7,665 MB 다. 여유를 확인하고 한산할 때 돌릴 것.
--    ⚠️ 안 돌려도 기능은 정상이다. 399 MB 는 이미 반환됐고 heap 만 나중에 준다.
-- ─────────────────────────────────────────────────────────────────────
