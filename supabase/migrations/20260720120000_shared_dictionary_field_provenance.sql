-- shared_dictionary 필드별 출처(provenance) 추적 — kaikki→WordNet 대체 감사용
-- 설계: docs/proposals/wordnet-replacement-design.md
-- 근본 원인 수정: 기존엔 source 가 행 단위라 어떤 '필드'가 어느 소스인지 알 수 없었음.
--   이제 각 enrich 필드(synonyms/antonyms/derived_forms/related_terms/example_en/ipa/homophones/rhyme_key)의
--   출처를 JSONB 로 기록 → 라이선스 감사·선택적 원복 가능.
-- 예: {"synonyms":"wordnet-3.1","antonyms":"wordnet-3.1","ipa":"cmudict-0.7b","example_en":"cleared"}

ALTER TABLE shared_dictionary
  ADD COLUMN IF NOT EXISTS field_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN shared_dictionary.field_provenance IS
  '필드별 데이터 출처 맵. enrich 스크립트(wordnet-enrich/cmudict-enrich)가 스탬프. '
  '값 예: wordnet-3.1 · oewn-2024 · cmudict-0.7b · cleared(미수록으로 제거) · unverified(레거시 kaikki 잔여).';

-- 감사 편의 인덱스 — 특정 소스로 채워진 행 조회 (예: 아직 kaikki 잔여 = provenance 에 wordnet 없음)
CREATE INDEX IF NOT EXISTS idx_shared_dictionary_field_provenance
  ON shared_dictionary USING gin (field_provenance);
