-- supabase/migrations/20260813104500_foreign_citation_marking.sql
-- 괄호 병기 외국어 인용 자동 마킹 — 결정론적 룰(LLM 불요).
--
-- 문제: 저자가 외국어 대사를 원문 그대로 적고 곧바로 괄호로 번역을 단 경우,
--       그 토큰들이 어느 언어 자산에도 없어 genuine_miss("실단어 미등재")로 떨어진다.
--       Simplicissimus ch.46 의 보헤미아어 대사 9건이 그 책 genuine_miss 30건의 30% 였다.
--       본문이 이미 뜻을 밝혀 놓았는데도 "사전에 넣어야 할 영단어"로 보이는 것이 결함이다.
--
-- 규칙: <"인용문"> 바로 뒤에 <("> 가 오고, 대상 단어가 인용문 안에는 있고 번역문 안에는 없으면
--       외국어 인용으로 판정한다.
--
--       닫는 괄호를 요구하지 않는다 — library_book_vocabularies.first_sentence 는 문장 단위라
--       번역이 다음 문장으로 잘리는 실측 사례가 있다:
--         blasna : ... Oberstowi" ("Take we the fool: bring we him to our colonel").   ← 닫힘
--         rosumi : ... Kratock wille sebao" ("Yes, by God, set we him on the horse.    ← 잘림
--       닫힘을 요구하면 두 번째 대사 4건(nagonie·possadeime·rosumi·niemezki)을 놓친다.
--
-- 정밀도 실측 (전 카탈로그 79권 · lemma IS NULL 전량 대상):
--       마킹 17단어 / 1권 (Simplicissimus 뿐). 다른 78권 오탐 0건.
--       17건 = genuine_miss 9(werne·daho·blasna·sebao·gbabo·nagonie·possadeime·rosumi·niemezki)
--            + 이미 외국어/노이즈로 분류된 8(ano·bambo·bowe·bude·ho·mi·mit·wille).
--
-- 되돌리기: DROP FUNCTION is_quoted_foreign_citation + 앞 두 함수를 이전 정의로 복원,
--           UPDATE library_book_vocabularies SET noise_kind = NULL WHERE noise_kind='foreign_citation'.
-- 멱등: 재실행 안전 (CREATE OR REPLACE + 결정론적 판정).

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) 판정 함수
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_quoted_foreign_citation(
  p_sentence text,
  p_word     text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  m   text[];
  v_w text := lower(trim(coalesce(p_word, '')));
  v_s text := coalesce(p_sentence, '');
  v_b text;
BEGIN
  -- 아포스트로피·숫자 포함 토큰은 대상 밖 (구조적 노이즈가 이미 처리) +
  -- 정규식 메타문자 유입 차단.
  IF v_s = '' OR v_w !~ '^[a-z][a-z-]*[a-z]$' THEN
    RETURN false;
  END IF;

  v_b := '(^|[^a-z])' || v_w || '([^a-z]|$)';

  FOR m IN
    SELECT g FROM regexp_matches(
      v_s,
      '["“]([^"”]{8,})["”][[:space:]]*\([[:space:]]*["“]([^"”]*)',
      'g'
    ) AS g
  LOOP
    -- 인용문 안에 있고, 병기된 번역문 안에는 없어야 한다.
    IF lower(m[1]) ~ v_b AND lower(coalesce(m[2], '')) !~ v_b THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END $$;

COMMENT ON FUNCTION public.is_quoted_foreign_citation(text, text) IS
  '문장 안에서 <"인용문" ("번역> 패턴을 찾아, 대상 단어가 인용문에만 있고 번역문에 없으면 true. '
  '외국어 원문 인용 판정용 — 결정론적. 닫는 괄호는 요구하지 않는다(first_sentence 가 문장 단위라 잘림).';

-- ─────────────────────────────────────────────────────────────
-- 2) 백필 함수 — noise_kind 에 foreign_citation 반영
--    person_noise/geo_noise 가 더 강한 판정이므로 우선순위를 유지한다.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fill_lbv_resolution(
  p_book_id  uuid    DEFAULT NULL::uuid,
  p_only_new boolean DEFAULT true
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300000'
AS $$
DECLARE n integer;
BEGIN
  WITH tgt AS (
    SELECT bv.id, lower(trim(bv.word)) AS w, bv.first_sentence AS fs
    FROM library_book_vocabularies bv
    WHERE bv.lemma IS NULL
      AND (p_book_id IS NULL OR bv.library_book_id = p_book_id)
      AND (NOT p_only_new OR bv.resolved_via IS NULL)
  ),
  res AS (
    SELECT t.id, t.w, t.fs, l.match_via, l.lang, l.resolved_word
    FROM tgt t
    LEFT JOIN LATERAL lookup_word_meaning(t.w) l ON true
  ),
  upd AS (
    UPDATE library_book_vocabularies bv
    SET resolved_via  = COALESCE(r.match_via, 'not_found'),
        resolved_lang = r.lang,
        resolved_word = r.resolved_word,
        noise_kind    = COALESCE(
          (SELECT c.classification FROM archaic_candidates c
            WHERE c.word = r.w
              AND c.classification IN ('person_noise', 'geo_noise')
            LIMIT 1),
          CASE WHEN is_quoted_foreign_citation(r.fs, r.w) THEN 'foreign_citation' END
        )
    FROM res r
    WHERE bv.id = r.id
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3) INSERT 트리거 — 신규 적재분도 같은 statement 안에서 판정
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_lbv_fill_lemma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE library_book_vocabularies lbv
  SET lemma = COALESCE(
    (SELECT d.word FROM shared_dictionary d
       WHERE d.word = lower(trim(lbv.word))
         AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
         AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
       LIMIT 1),
    (SELECT id.word
       FROM unnest(en_inflection_bases(lower(trim(lbv.word)))) AS cand(c)
       JOIN shared_dictionary id ON id.word = cand.c
       WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
         AND id.meaning_ko IS NOT NULL AND LENGTH(id.meaning_ko) > 0
         AND en_negation_preserved(lower(trim(lbv.word)), id.word)
         AND COALESCE(id.word_register, 'standard') <> 'abbreviation'
       ORDER BY id.word LIMIT 1)
  )
  FROM new_rows nr
  WHERE lbv.id = nr.id AND lbv.lemma IS NULL;

  -- v06.35 — 결합 실패분 해석 진단 (lemma 는 건드리지 않음)
  -- v06.36 — 괄호 병기 외국어 인용 마킹 추가
  UPDATE library_book_vocabularies lbv
  SET resolved_via  = COALESCE(r.match_via, 'not_found'),
      resolved_lang = r.lang,
      resolved_word = r.resolved_word,
      noise_kind    = COALESCE(
        (SELECT c.classification FROM archaic_candidates c
          WHERE c.word = lower(trim(lbv.word))
            AND c.classification IN ('person_noise', 'geo_noise')
          LIMIT 1),
        CASE WHEN is_quoted_foreign_citation(lbv.first_sentence, lower(trim(lbv.word)))
             THEN 'foreign_citation' END
      )
  FROM new_rows nr
  LEFT JOIN LATERAL lookup_word_meaning(lower(trim(nr.word))) r ON true
  WHERE lbv.id = nr.id AND lbv.lemma IS NULL;

  RETURN NULL;
END $$;

COMMENT ON COLUMN public.library_book_vocabularies.noise_kind IS
  'archaic_candidates.classification 이 person_noise/geo_noise 인 경우 그 값, '
  '또는 괄호 병기 외국어 인용으로 판정된 경우 ''foreign_citation''. 학습 단어가 아니므로 분모에서 제외.';

-- ─────────────────────────────────────────────────────────────
-- 4) 진단 분류기 — foreign_citation 은 "노이즈"가 아니라 "외국어"로 보여준다.
--    본문이 스스로 밝힌 근거이므로 블랙리스트 휴리스틱보다 우선한다.
--    (그 외 로직은 20260810115154 정의와 동일)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.find_unbound_book_lemmas(p_book_id uuid, p_limit integer DEFAULT 500)
RETURNS TABLE(
  lemma text, reason text, dict_v_level smallint, dict_meaning_ko text, dict_classified_by text,
  book_occurrences integer, variant_hit text, cluster_base text, inflection_base text,
  deriv_base text, archaic_class text, resolved_via text, resolved_lang text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  RETURN QUERY
  WITH book_lemmas AS (
    SELECT COALESCE(lbv.lemma, lbv.word) AS w,
           SUM(COALESCE(lbv.frequency_in_book, 1))::int AS occ,
           MAX(lbv.resolved_via)  AS rvia,
           MAX(lbv.resolved_lang) AS rlang,
           MAX(lbv.noise_kind)    AS nkind
    FROM library_book_vocabularies lbv
    WHERE lbv.library_book_id = p_book_id
      AND COALESCE(lbv.lemma, lbv.word) IS NOT NULL
    GROUP BY COALESCE(lbv.lemma, lbv.word)
  ),
  unbound AS (
    SELECT bl.* FROM book_lemmas bl
    WHERE NOT (
      EXISTS (SELECT 1 FROM shared_dictionary d
              WHERE d.word = bl.w
                AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
                AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0)
      OR EXISTS (SELECT 1 FROM shared_dictionary sv
                 WHERE sv.spelling_variants @> ARRAY[bl.w]
                   AND sv.v_level IS NOT NULL AND sv.classified_by IS NOT NULL
                   AND sv.meaning_ko IS NOT NULL)
      OR EXISTS (SELECT 1 FROM unnest(en_inflection_bases(bl.w)) AS cand(c)
                 JOIN shared_dictionary id ON id.word = cand.c
                 WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
                   AND id.meaning_ko IS NOT NULL)
      OR EXISTS (SELECT 1 FROM archaic_dictionary ad WHERE ad.word = bl.w)
    )
  ),
  joined AS (
    SELECT u.w, u.occ, u.rvia, u.rlang, u.nkind,
           d.v_level, d.meaning_ko, d.classified_by,
           (nb.form IS NOT NULL) AS in_blacklist,
           ac.classification AS ac_class,
           (SELECT c.word FROM shared_dictionary c
              WHERE c.inflections @? format('$.forms[*].form ? (@ == "%s")', u.w)::jsonpath
                AND c.v_level IS NOT NULL AND c.classified_by IS NOT NULL
                AND c.meaning_ko IS NOT NULL
              ORDER BY c.frequency_rank NULLS LAST
              LIMIT 1) AS cl_base,
           (SELECT id2.word FROM unnest(en_inflection_bases(u.w)) AS cand2(c)
              JOIN shared_dictionary id2 ON id2.word = cand2.c
              ORDER BY (id2.v_level IS NOT NULL AND id2.meaning_ko IS NOT NULL
                        AND id2.classified_by IS NOT NULL) DESC, id2.word
              LIMIT 1) AS infl_base,
           (SELECT sd.word FROM unnest(en_derivational_bases(u.w)) AS cand3(c)
              JOIN shared_dictionary sd ON sd.word = cand3.c
              WHERE sd.v_level IS NOT NULL AND sd.classified_by IS NOT NULL
                AND sd.meaning_ko IS NOT NULL AND LENGTH(sd.meaning_ko) > 0
              LIMIT 1) AS deriv_base
    FROM unbound u
    LEFT JOIN shared_dictionary d ON d.word = u.w
    LEFT JOIN archaic_candidates ac ON ac.word = u.w
    LEFT JOIN noise_blacklist nb ON nb.form = u.w AND nb.is_blocking
  ),
  classified AS (
    SELECT j.w AS lemma, j.occ, j.v_level, j.meaning_ko, j.classified_by,
      NULL::text AS v_hit, j.cl_base, j.infl_base, j.deriv_base, j.ac_class,
      j.rvia, j.rlang,
      CASE
        -- v06.36 — 본문이 괄호로 번역을 병기한 외국어 인용. 가장 강한 근거라 최우선.
        WHEN j.nkind = 'foreign_citation' THEN 'foreign'
        WHEN j.in_blacklist THEN 'noise'
        WHEN j.nkind IS NOT NULL THEN 'noise'
        WHEN j.v_level IS NOT NULL AND j.classified_by IS NULL THEN 'not_classified'
        WHEN j.v_level IS NULL AND (j.meaning_ko IS NOT NULL OR j.classified_by IS NOT NULL) THEN 'no_v_level'
        WHEN j.v_level IS NOT NULL AND (j.meaning_ko IS NULL OR LENGTH(j.meaning_ko) = 0) THEN 'no_meaning'
        WHEN j.ac_class = 'processed' THEN 'ok'
        WHEN j.ac_class IN ('geo_noise', 'person_noise') THEN 'noise'
        WHEN COALESCE(j.rlang, 'en') <> 'en' THEN 'foreign'
        WHEN j.rvia IN ('dialect', 'spelling', 'variant') OR j.ac_class = 'spelling_variant'
          THEN 'spelling_variant'
        WHEN j.rvia IN ('derivation', 'normalized', 'normalized-coverage', 'cluster', 'inflection')
          THEN 'morphology'
        WHEN j.rvia IN ('coverage-clean', 'suggestion', 'direct') THEN 'lexicon_only'
        WHEN j.ac_class IN ('addable_modern', 'archaic') THEN 'genuine_miss'
        WHEN j.w ~ '^[ivxlcdm]+$' OR LENGTH(j.w) < 3 OR j.w LIKE '%''%' THEN 'noise'
        ELSE 'genuine_miss'
      END AS reason
    FROM joined j
  )
  SELECT c.lemma, c.reason, c.v_level::smallint, c.meaning_ko, c.classified_by,
         c.occ, c.v_hit, c.cl_base, c.infl_base, c.deriv_base, c.ac_class,
         c.rvia, c.rlang
  FROM classified c
  WHERE c.reason <> 'ok'
  ORDER BY
    CASE c.reason
      WHEN 'genuine_miss'     THEN 1
      WHEN 'no_meaning'       THEN 2
      WHEN 'no_v_level'       THEN 3
      WHEN 'not_classified'   THEN 4
      WHEN 'spelling_variant' THEN 5
      WHEN 'lexicon_only'     THEN 6
      WHEN 'morphology'       THEN 7
      WHEN 'foreign'          THEN 8
      ELSE 9
    END,
    c.occ DESC, c.lemma
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
END $$;

COMMIT;
