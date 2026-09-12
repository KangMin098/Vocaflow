-- 20260811150000_abbrev_binding_and_ghost_purge.sql
-- 추출 품질 감사 R2 — 결함 02·04 처리.
--
-- ── 결함 02: 약어 표제어로의 굴절 결합 ──────────────────────────
-- v_extraction_quality_audit '02 register 노이즈 결합' 8단어. 대부분은 정상(bc·kg·rpm 이
-- 그대로 bc·kg·rpm 에 결합)이지만 두 건이 오결합이다:
--     dren → dr  "박사"      ther → th  "th (영어의 두 소리를 내는 철자 조합)"
-- 원인: en_inflection_bases 폴백이 짧은 약어 표제어에 닿았다. **약어는 굴절형을 갖지 않는다** —
-- 굴절 폴백에서 word_register='abbreviation' 표제어를 제외한다(직접 매칭은 그대로 허용).
--
-- ── 결함 04: 유령 어휘 ─────────────────────────────────────────
-- 본문 어디에도 단어 경계로 존재하지 않는 미해결 행. Sociology 정리(20260811035548)는
-- 그 책만 대상이었는데, 재감사에서 다른 책에도 있었다:
--     Ozma of Oz  tle(6) · peo(3) · cean · ture · ation      Pride and Prejudice  rs(2)
--     The Mysterious Affair at Styles  ture                  Sociology  ociety(4) · nly(2)
-- Gutenberg 소스라 HTML 엔티티가 아니라 드롭캡/줄바꿈 하이픈 등 다른 원인이지만,
-- **판정 방법은 동일하다** — 본문 대조. 원인을 몰라도 "본문에 없는 말"은 추출 산물이 아니다.
-- 책 단위 함수를 전 카탈로그용으로 일반화한다.

-- ─────────────────────────────────────────────────────────────
-- 결함 02 — 굴절 폴백에서 약어 제외
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

CREATE OR REPLACE FUNCTION public.backfill_book_lemmas(p_book_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_filled INT;
BEGIN
  UPDATE library_book_vocabularies lbv
  SET lemma = COALESCE(
    (SELECT d.word FROM shared_dictionary d
       WHERE d.word = lower(trim(lbv.word))
         AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
         AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
       LIMIT 1),
    (SELECT id.word FROM unnest(en_inflection_bases(lower(trim(lbv.word)))) AS cand(c)
       JOIN shared_dictionary id ON id.word = cand.c
       WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
         AND id.meaning_ko IS NOT NULL AND LENGTH(id.meaning_ko) > 0
         AND en_negation_preserved(lower(trim(lbv.word)), id.word)
         AND COALESCE(id.word_register, 'standard') <> 'abbreviation'
       ORDER BY id.word LIMIT 1)
  )
  WHERE lbv.library_book_id = p_book_id AND lbv.lemma IS NULL;
  GET DIAGNOSTICS v_filled = ROW_COUNT;
  RETURN v_filled;
END $function$;

-- 기존 오결합 수리 (직접 매칭분 bc·kg·rpm 등은 건드리지 않는다)
UPDATE public.library_book_vocabularies v
SET lemma = NULL, resolved_via = NULL, resolved_lang = NULL, resolved_word = NULL
WHERE v.lemma IS NOT NULL
  AND lower(trim(v.word)) <> v.lemma
  AND EXISTS (SELECT 1 FROM shared_dictionary d
              WHERE d.word = v.lemma AND d.word_register = 'abbreviation');

-- ─────────────────────────────────────────────────────────────
-- 결함 04 — 유령 어휘 정리 (전 카탈로그)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_ghost_vocab(p_book_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '300000'
AS $function$
DECLARE v_deleted integer;
BEGIN
  WITH ghost AS (
    SELECT v.id
    FROM library_book_vocabularies v
    WHERE (p_book_id IS NULL OR v.library_book_id = p_book_id)
      AND v.lemma IS NULL
      AND v.noise_kind IS NULL
      AND COALESCE(v.resolved_via, 'not_found') IN ('not_found', 'invalid')
      AND NOT EXISTS (
        SELECT 1
        FROM library_chapters_master m
        JOIN content_chunks c ON c.hash = m.content_hash
        WHERE m.library_book_id = v.library_book_id
          AND c.content ~* ('\m' || regexp_replace(lower(trim(v.word)), '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M')
      )
  )
  DELETE FROM library_book_vocabularies d USING ghost g WHERE d.id = g.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $function$;

COMMENT ON FUNCTION public.purge_ghost_vocab(uuid) IS
  '본문 어디에도 단어 경계로 없는 미해결 어휘 행 제거(본문 대조 판정). 원인(엔티티·드롭캡·줄바꿈 하이픈)과 무관하게 적용. p_book_id NULL 이면 전 카탈로그.';
