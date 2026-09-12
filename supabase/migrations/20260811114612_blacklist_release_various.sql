-- 20260811114612_blacklist_release_various.sql
-- ADR 0004 D3 확장 — `various` 출처의 실단어 오등록 해제.
--
-- 발단: 신규 도서(The Jungle Book) 추출 테스트에서 `snarly`·`oozy`·`cross-legged`·`pignut` 이
--   실단어인데 차단됐다. D3(20260811115121)은 오탐률이 검증된 두 sweep(final-sweep 83%,
--   auto-tail 27%)만 해제했는데, 이들은 `various` 출처였다.
--
--   source / category            차단 중  실영단어  오탐률
--   various / proper_noun_marker      69       57    83%
--   various / corrupt_token          137       82    60%
--   various / interjection_noise     126       74    59%
--
-- ⚠️ 처음엔 "source 가 아니라 판정 규칙으로 일원화" 하려 했으나 **틀렸다**. 전체 적용 시
--   라틴어(centum·utinam·meum·receptaculum)와 코퍼스에 없어 대문자 검사를 못 타는
--   고유명사(artemis·apaches·henry·mccarthy)까지 풀린다. source 는 실제로 정보를 담고 있다
--   — auto-latin 계열(오탐 2.8~7.5%)은 신뢰할 만하고 그대로 둔다.
--
-- 그리고 `proper_noun_marker` 카테고리는 제외한다 — 사람이 의도적으로 붙인 라벨이고,
--   실제로 india·harry·jasper·alan·napoleons 처럼 "실단어이면서 고유명사" 인 것들이다.
--   → `various` × (interjection_noise | corrupt_token) 만 대상.
--
-- 판정(D3 와 동일 골격 + 강화):
--   · lexicon_clean(lang='en') 에 뜻이 있고
--   · 고어/방언 표지 없고
--   · 코퍼스에서 대문자로만 등장하지 않고
--   · 뜻이 신화/부족/공화국/인물 설명이 아니고
--   · 길이 4자 이상(짧은 파편 제외)
--   → 86건 해제. 예: snarly · oozy · cross-legged · pignut · smutty · whiny · slippy ·
--     southwestward · semi-conscious · uncapable · unmothered · suffumigating

ALTER TABLE public.noise_blacklist
  ADD COLUMN IF NOT EXISTS is_blocking boolean NOT NULL DEFAULT true;

WITH base AS MATERIALIZED (
  SELECT nb.form, COALESCE(l.meaning_ko, '') AS mk, COALESCE(l.gloss_en, '') AS ge
  FROM noise_blacklist nb
  JOIN lexicon_clean l ON l.word = nb.form AND l.lang = 'en' AND l.meaning_ko IS NOT NULL
  WHERE nb.is_blocking
    AND nb.source = 'various'
    AND nb.category IN ('interjection_noise', 'corrupt_token')
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
  WHERE NOT COALESCE(l.capd AND NOT l.lowerd, false)
    AND NOT (b.ge ~* '\m(archaic|obsolete|dialect|nonstandard)\M' OR b.mk ~ '고어|옛말|방언|사투리')
    AND NOT (b.mk ~ '(신화|여신|부족|물리학자|정치인|공화국|미국의|영국의|프랑스의|출신|왕|황제|도시)')
    AND length(b.form) > 3
)
UPDATE noise_blacklist nb
SET is_blocking = false,
    released_reason = 'ADR 0004 D3 확장 — various/(interjection_noise|corrupt_token) 오등록. lexicon_clean(en) 실단어이며 고어·방언·고유명사·짧은 파편 표지 없음. The Jungle Book 추출 테스트에서 발견.'
FROM release r
WHERE nb.form = r.form
  AND nb.source = 'various'
  AND nb.category IN ('interjection_noise', 'corrupt_token');
