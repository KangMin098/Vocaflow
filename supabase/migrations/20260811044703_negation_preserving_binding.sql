-- 20260811130000_negation_preserving_binding.sql
-- 표제어 바인딩 불변식: **부정 의미를 잃는 결합 금지**.
--
-- 발견 (2026-08-11, 전 카탈로그 추출 감사 R1):
--   학습대상(bound) 91,170행을 처음으로 감사했더니 표면형의 부정 의미를 잃고 반대말에
--   결합된 행이 **88단어 / 184회** 있었다.
--     imprudent(경솔한)   → prudent  "신중한, 분별 있는"
--     unwilling(꺼리는)   → willing  "기꺼이 ~하는"
--     insincere           → sincere  "진심의, 진실된"
--     mislead             → lead     "납; 흑연심"          (품사까지 어긋남)
--     needless·blameless·regardless·friendless → need·blame·regard·friend
--
--   경로 추적: 현재 바인딩 함수(trg_lbv_fill_lemma · backfill_book_lemmas)는 직접매칭 +
--   en_inflection_bases 만 쓰므로 이런 결합을 만들지 않는다. resolve_dict_headword 도
--   부정 보존이 정상이다(unreserved→unreserve). 즉 **레거시 행**이고, 문제는 그 값이
--   select_*_vocab 의 `COALESCE(bv.lemma, bv.word)` 를 타고 학습자에게 전파되는 것이다.
--
--   실제 도달 범위: 88단어 중 99행은 표면형 자체가 정식 표제어라 surface-first 규칙
--   (20260718100000)이 막아준다. 그러나 표면형 미등재 9건은 그대로 전파되고,
--   그 중 **4건은 이미 발행 단어장에 실려 있다**:
--     unreserved→"비축" · unshackled→"수갑, 족쇄" · unblemished→"흠, 얼룩"
--     · unacknowledged→"인정하다"   — 전부 의미 반전.
--
-- 조치 3층:
--   ① 불변식 함수 en_negation_preserved(surface, headword)
--   ② 바인딩·선정 경로가 불변식을 강제 (미래 재발 차단)
--   ③ 기존 오염 lemma 88단어 NULL 화 (표면형으로 재해석되게)
--
-- 판정 규칙 — 오탐을 피하려고 "접사를 벗긴 결과가 곧 표제어" 인 경우만 잡는다:
--   surface 가 부정 접두(un/in/im/il/ir/dis/non/mis)로 시작하고, headword 는 그 접두가 없으며,
--   headword 가 surface 안에 포함될 때. (instructed→instruct 처럼 headword 도 'in' 으로
--   시작하면 부정이 유지된 것으로 보고 통과시킨다.)
--   -less 계열(-less/-lessly/-lessness)도 같은 방식.

CREATE OR REPLACE FUNCTION public.en_negation_preserved(p_surface text, p_headword text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_surface IS NULL OR p_headword IS NULL THEN true
    ELSE NOT (
      -- 부정 접두가 사라진 결합
      ( lower(p_surface) ~ '^(un|in|im|il|ir|dis|non|mis)'
        AND lower(p_headword) !~ '^(un|in|im|il|ir|dis|non|mis)'
        AND position(lower(p_headword) in lower(p_surface)) > 0 )
      -- 부정 접미(-less)가 사라진 결합
      OR ( lower(p_surface) ~ 'less(ly|ness)?$'
        AND lower(p_headword) !~ 'less'
        AND position(lower(p_headword) in lower(p_surface)) > 0 )
    )
  END
$function$;

COMMENT ON FUNCTION public.en_negation_preserved(text, text) IS
  '표제어 바인딩 불변식 — 표면형의 부정 의미(un/in/im/il/ir/dis/non/mis 접두, -less 접미)를 headword 가 잃지 않았는지. false 면 반대말 결합이다.';

-- ─────────────────────────────────────────────────────────────
-- ② 바인딩 경로 강제 — 방어적. 현재 두 함수는 굴절 기반이라 위반을 만들지 않지만,
--    규칙이 코드에 없으면 다음 사람이 파생 기반을 넣는 순간 다시 깨진다.
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
       ORDER BY id.word LIMIT 1)
  )
  WHERE lbv.library_book_id = p_book_id AND lbv.lemma IS NULL;
  GET DIAGNOSTICS v_filled = ROW_COUNT;
  RETURN v_filled;
END $function$;

-- ─────────────────────────────────────────────────────────────
-- ③ 기존 오염 제거 — 표면형으로 재해석되도록 lemma 를 비운다.
--    (비운 뒤 resolve_dict_headword(surface) 가 부정 보존 표제어를 찾거나, 못 찾으면
--     "미등록" 으로 정직하게 남는다. 반대말을 가르치는 것보다 낫다.)
-- ─────────────────────────────────────────────────────────────
UPDATE public.library_book_vocabularies v
SET lemma = NULL, resolved_via = NULL, resolved_lang = NULL, resolved_word = NULL
WHERE v.lemma IS NOT NULL
  AND NOT public.en_negation_preserved(lower(trim(v.word)), v.lemma);

UPDATE public.library_article_vocabularies v
SET lemma = NULL
WHERE v.lemma IS NOT NULL
  AND NOT public.en_negation_preserved(lower(trim(v.word)), v.lemma);
