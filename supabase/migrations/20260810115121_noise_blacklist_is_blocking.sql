-- 20260810120000_noise_blacklist_is_blocking.sql
-- ADR 0004 D3 — noise_blacklist 를 "영구 차단"에서 "차단 여부가 명시된 라벨"로.
--
-- 결함: stage_book_dict_candidates 가 `NOT EXISTS (noise_blacklist)` 로 사전 등재 큐 진입을
--       막는데, 블랙리스트의 두 자동 sweep 이 실단어를 대량 오등록했다.
--
--   source / category            | 총     | lexicon_clean(en) 실단어 | 오탐률
--   -----------------------------|-------:|------------------------:|------:
--   auto-latin / foreign_word    |  1,546 |                      43 |  2.8%
--   auto-latin-broad/foreign_word|  4,563 |                     340 |  7.5%
--   auto-tail / foreign_word     | 11,002 |                   3,019 | 27%
--   final-sweep / foreign_word   |  4,672 |                   3,883 | **83%**
--
--   Treasure Island 의 `mutineer`(22회 — 이 책의 주제어)가 category='foreign_word' 로 등록돼
--   영원히 사전에 못 들어간다. `insubordinate`·`nimbleness`·`slyness`·`postmaster`·`guidebook`
--   ·`waxwork`·`remediable`·`telepathically` 도 같다.
--
-- 왜 DELETE 가 아니라 플래그인가: 판정 근거(source·note)를 지우면 되돌릴 수도, 감사할 수도 없다.
--   ADR 0002 가 같은 결함을 진단하고도 미적용으로 멈춘 사이 반대 방향 sweep 이 쌓인 전례가 있다.
--
-- 해제 대상 선정 (실측 6,902건 중):
--   · 고어 표지(gloss archaic/obsolete · 뜻 '고어/옛말' · `-eth` 어미)      81건 → 차단 유지
--     (archaic_dictionary 소관. enforce_archaic_not_in_shared/ADR D4 로 shared 등재 금지가 정상)
--   · 방언 표지(gloss dialect/nonstandard · 뜻 '방언/사투리')              18건 → 차단 유지
--     (dialect_map 소관)
--   · 코퍼스에서 대문자로만 등장 = 고유명사                                 20건 → 차단 유지
--   · 나머지                                                            6,783건 → **해제**
--
--   코퍼스 검증: 6,902건 중 현재 카탈로그에 등장하는 1,755건 가운데 고유명사는 20건뿐이고
--   1,735건이 소문자로 실제 출현한다 (= 실단어).

ALTER TABLE public.noise_blacklist
  ADD COLUMN IF NOT EXISTS is_blocking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS released_reason text;

COMMENT ON COLUMN public.noise_blacklist.is_blocking IS
  'ADR 0004 D3 — false 면 사전 등재 큐 진입을 막지 않는다(진단 라벨로만 남음). 오등록 회수용.';
COMMENT ON COLUMN public.noise_blacklist.released_reason IS
  'is_blocking=false 로 내린 근거.';

-- 오등록 해제 — 두 신뢰도 낮은 sweep 에서 실영단어로 확인된 것만.
WITH base AS MATERIALIZED (
  SELECT nb.form, COALESCE(l.meaning_ko, '') AS mk, COALESCE(l.gloss_en, '') AS ge
  FROM noise_blacklist nb
  JOIN lexicon_clean l ON l.word = nb.form AND l.lang = 'en' AND l.meaning_ko IS NOT NULL
  WHERE nb.source IN ('final-sweep', 'auto-tail') AND nb.category = 'foreign_word'
),
lbv AS MATERIALIZED (
  SELECT lower(trim(v.word)) AS w,
         bool_or(v.first_sentence ~ ('\m' || initcap(lower(trim(v.word))) || '\M')) AS capd,
         bool_or(v.first_sentence ~ ('\m' || lower(trim(v.word)) || '\M'))          AS lowerd
  FROM library_book_vocabularies v
  WHERE EXISTS (SELECT 1 FROM base b WHERE b.form = lower(trim(v.word)))
  GROUP BY 1
),
release AS (
  SELECT b.form
  FROM base b
  LEFT JOIN lbv l ON l.w = b.form
  WHERE NOT (b.ge ~* '\m(archaic|obsolete)\M' OR b.mk ~ '고어|옛말|고체' OR b.form ~ '(eth)$')
    AND NOT (b.ge ~* '\m(dialect|dialectal|nonstandard|non-standard)\M' OR b.mk ~ '방언|사투리')
    AND NOT COALESCE(l.capd AND NOT l.lowerd, false)
)
UPDATE noise_blacklist nb
SET is_blocking = false,
    released_reason = 'ADR 0004 D3 — final-sweep/auto-tail foreign_word 오등록. lexicon_clean(lang=en) 실단어이며 고어·방언·고유명사 표지 없음.'
FROM release r
WHERE nb.form = r.form
  AND nb.source IN ('final-sweep', 'auto-tail')
  AND nb.category = 'foreign_word';

-- 등재 큐 게이트가 is_blocking 을 존중하도록 — 나머지 로직은 그대로.
CREATE OR REPLACE FUNCTION public.stage_book_dict_candidates(p_book_id uuid)
RETURNS TABLE(staged integer, already_addable integer, book_pending_remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_staged INT;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  PERFORM collect_archaic_candidates(p_book_id);

  WITH book_unbound AS (
    SELECT DISTINCT lower(trim(word)) AS w
    FROM library_book_vocabularies
    WHERE library_book_id = p_book_id AND lemma IS NULL
      AND length(trim(word)) >= 3 AND word !~ '^[ivxlcdm]+$' AND word NOT LIKE '%''%'
  )
  UPDATE archaic_candidates ac
  SET classification = 'addable_modern', updated_at = now()
  FROM book_unbound b
  WHERE ac.word = b.w
    AND ac.classification = 'pending'
    AND NOT EXISTS (SELECT 1 FROM shared_dictionary d
                      WHERE d.word = ac.word AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0)
    -- ADR 0004 D3 — is_blocking 인 항목만 차단. 해제된 오등록은 통과.
    AND NOT EXISTS (SELECT 1 FROM noise_blacklist nb
                      WHERE nb.form = ac.word AND nb.is_blocking);
  GET DIAGNOSTICS v_staged = ROW_COUNT;

  RETURN QUERY SELECT
    v_staged,
    (SELECT count(*)::int FROM archaic_candidates ac JOIN library_book_vocabularies lbv
       ON lower(trim(lbv.word)) = ac.word
     WHERE lbv.library_book_id = p_book_id AND ac.classification = 'addable_modern'),
    (SELECT count(DISTINCT ac.word)::int FROM archaic_candidates ac JOIN library_book_vocabularies lbv
       ON lower(trim(lbv.word)) = ac.word
     WHERE lbv.library_book_id = p_book_id AND ac.classification = 'pending');
END $function$;

COMMENT ON FUNCTION public.stage_book_dict_candidates(uuid) IS
  'ADR 0004 D3 — 사전 등재 큐잉. noise_blacklist 는 is_blocking=true 인 항목만 차단.';

