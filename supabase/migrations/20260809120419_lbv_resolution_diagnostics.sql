-- 20260809120000_lbv_resolution_diagnostics.sql
-- LBV 해석 진단 컬럼 — "추출 %" 가 shared_dictionary 한 장만 보던 문제 해소.
--
-- 배경 (2026-08-09 실측):
--   trg_lbv_fill_lemma 는 shared_dictionary 직접매칭 + en_inflection_bases 2단계만 시도한다.
--   그런데 프로젝트에는 이미 lexicon_clean(455,037 · en/la/fr/it/de/es) · spelling_norm(312,642) ·
--   archaic_dictionary(810) · dialect_map(147) 이 구축돼 있고, 이를 전부 순차 조회하는
--   lookup_word_meaning() 도 있다. 미매핑 4,882 단어를 그 해석기에 넣으면 4,362개(89.3%),
--   출현 기준 94.6% 가 해석된다 → 콘솔의 "추출 88~95%" 는 자산 미조회로 인한 착시였다.
--
-- 설계 결정 (중요):
--   lemma 는 **건드리지 않는다**. select_book_chapter_vocab 이 lemma/word → shared_dictionary 로
--   조인해 학습 단어를 고르기 때문에, lookup_word_meaning 결과를 lemma 에 써 넣으면
--   lexicon_clean 에 en 표제어로 들어있는 인명(elizabeth · darcy)이 학습 단어로 승격된다.
--   또 archaic_dictionary 는 enforce_archaic_not_in_shared(ADR D4)로 shared_dictionary 등재가
--   금지돼 있어 고어는 구조적으로 lemma 를 가질 수 없다.
--   → 해석 결과는 별도 진단 컬럼에만 기록하고, 지표는 그 컬럼으로 계산한다.

ALTER TABLE public.library_book_vocabularies
  ADD COLUMN IF NOT EXISTS resolved_via  text,
  ADD COLUMN IF NOT EXISTS resolved_lang text,
  ADD COLUMN IF NOT EXISTS resolved_word text,
  ADD COLUMN IF NOT EXISTS noise_kind    text;

COMMENT ON COLUMN public.library_book_vocabularies.resolved_via IS
  'lemma IS NULL 행의 lookup_word_meaning match_via (direct/inflection/variant/cluster/derivation/normalized/spelling/dialect/coverage-clean/suggestion/not_found). lemma 결합과 무관 — 진단 전용.';
COMMENT ON COLUMN public.library_book_vocabularies.resolved_lang IS
  'lookup_word_meaning 이 판정한 언어 (en/fr/la/it/de/es/...). 외국어 원문 인용 식별용.';
COMMENT ON COLUMN public.library_book_vocabularies.resolved_word IS
  '해석된 표제어 (고어 modern_equivalent · 방언 표준형 · 철자 정규형 포함).';
COMMENT ON COLUMN public.library_book_vocabularies.noise_kind IS
  'archaic_candidates.classification 이 person_noise/geo_noise 인 경우 그 값. 학습 단어가 아니므로 분모에서 제외.';

-- lemma IS NULL 행만 반복 조회 → 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_lbv_unbound_book
  ON public.library_book_vocabularies (library_book_id)
  WHERE lemma IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 해석 채움 함수 (백필 + 트리거 공용)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fill_lbv_resolution(
  p_book_id  uuid    DEFAULT NULL,
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
    SELECT bv.id, lower(trim(bv.word)) AS w
    FROM library_book_vocabularies bv
    WHERE bv.lemma IS NULL
      AND (p_book_id IS NULL OR bv.library_book_id = p_book_id)
      AND (NOT p_only_new OR bv.resolved_via IS NULL)
  ),
  res AS (
    SELECT t.id, t.w, l.match_via, l.lang, l.resolved_word
    FROM tgt t
    LEFT JOIN LATERAL lookup_word_meaning(t.w) l ON true
  ),
  upd AS (
    UPDATE library_book_vocabularies bv
    SET resolved_via  = COALESCE(r.match_via, 'not_found'),
        resolved_lang = r.lang,
        resolved_word = r.resolved_word,
        noise_kind    = (SELECT c.classification FROM archaic_candidates c
                          WHERE c.word = r.w
                            AND c.classification IN ('person_noise', 'geo_noise')
                          LIMIT 1)
    FROM res r
    WHERE bv.id = r.id
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.fill_lbv_resolution(uuid, boolean) IS
  'lemma IS NULL 행에 lookup_word_meaning 해석 결과 + noise 라벨을 채운다. p_only_new=false 면 기존 값도 재계산.';

-- ─────────────────────────────────────────────────────────────
-- INSERT 트리거 확장 — lemma 결합 실패분은 같은 statement 안에서 해석까지 기록
-- (기존 로직은 그대로. 뒤에 해석 채움만 추가.)
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
       ORDER BY id.word LIMIT 1)
  )
  FROM new_rows nr
  WHERE lbv.id = nr.id AND lbv.lemma IS NULL;

  -- v06.35 — 결합 실패분 해석 진단 (lemma 는 건드리지 않음)
  UPDATE library_book_vocabularies lbv
  SET resolved_via  = COALESCE(r.match_via, 'not_found'),
      resolved_lang = r.lang,
      resolved_word = r.resolved_word,
      noise_kind    = (SELECT c.classification FROM archaic_candidates c
                        WHERE c.word = lower(trim(lbv.word))
                          AND c.classification IN ('person_noise', 'geo_noise')
                        LIMIT 1)
  FROM new_rows nr
  LEFT JOIN LATERAL lookup_word_meaning(lower(trim(nr.word))) r ON true
  WHERE lbv.id = nr.id AND lbv.lemma IS NULL;

  RETURN NULL;
END $$;
