-- 추출 노이즈 제거 ①: word_register에 brand·abbreviation·proper_noun 카테고리 신설.
-- 고유명사·브랜드·약어가 study word로 추출되던 노이즈를 register로 분류 → 추출 제외(다음 마이그).
-- additive·비파괴. proper_noun은 값만 허용(분류는 후속 LLM 패스).

ALTER TABLE public.shared_dictionary DROP CONSTRAINT IF EXISTS sd_word_register_check;
ALTER TABLE public.shared_dictionary ADD CONSTRAINT sd_word_register_check
  CHECK (word_register = ANY (ARRAY[
    'standard'::text, 'modern_advanced'::text, 'period_cultural'::text,
    'archaic_literary'::text, 'phrase_unit'::text,
    'brand'::text, 'abbreviation'::text, 'proper_noun'::text
  ]));

-- 브랜드(™ 접미사) 96건
UPDATE public.shared_dictionary SET word_register='brand' WHERE word LIKE '%™';

-- 약어(2~5자 무모음, y 제외) 129건 — 이미 제외 register는 보존
UPDATE public.shared_dictionary SET word_register='abbreviation'
WHERE word ~ '^[a-z]{2,5}$' AND word !~ '[aeiouy]' AND word NOT LIKE '%™'
  AND word_register NOT IN ('archaic_literary','period_cultural','phrase_unit');
