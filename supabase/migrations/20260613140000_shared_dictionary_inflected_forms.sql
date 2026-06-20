-- supabase/migrations/20260613140000_shared_dictionary_inflected_forms.sql
-- 굴절형 1급 데이터화 (Phase A) — 단어장 예문 하이라이트/빈칸의 불규칙 인식용.
--
-- 배경: 하이라이트/빈칸 matchSurface 가 규칙 기반이라 불규칙(be→was/were/been, go→went,
--   see→saw)을 못 잡음. shared_dictionary.inflections jsonb(freq corpus)는 불규칙을 담지만
--   파생어·축약 파편이 섞여 noisy → 그대로 못 씀.
--
-- 이 마이그레이션:
--   1) shared_dictionary.inflected_forms text[] + GIN (정제 굴절형 surface 집합 · 인식/표시 SSoT)
--   2) inflections jsonb → 정제 백필 (파생/축약 파편 제외 · 불규칙 보존)
--      ※ 학습대상은 항상 lemma — inflected_forms 는 그 lemma 의 인식/표시 메타데이터일 뿐.
--      ※ bootstrap (≈55% jsonb 보유분) · 잔여 noise 는 Phase C(Claude Code POS-aware)에서 정정.

-- 1) 스키마
ALTER TABLE shared_dictionary ADD COLUMN IF NOT EXISTS inflected_forms text[];

COMMENT ON COLUMN shared_dictionary.inflected_forms IS
  '정제 굴절형 surface 집합 (lemma 단위 인식/표시용 SSoT). inflections jsonb(freq corpus, noisy)에서 파생/축약 파편 제거. NULL/빈 배열이면 규칙 기반(matchSurface/en_inflection_bases) fallback. 학습대상은 항상 lemma — 굴절형은 별도 항목 아님.';

CREATE INDEX IF NOT EXISTS idx_shared_dictionary_inflected_forms
  ON shared_dictionary USING gin (inflected_forms);

-- 2) 백필 (멱등 · inflections jsonb 보유분만 영향)
WITH expanded AS (
  SELECT d.word AS lemma, lower(f.form) AS form
  FROM shared_dictionary d
  CROSS JOIN LATERAL jsonb_to_recordset(d.inflections->'forms') AS f(form text, freq bigint)
  WHERE d.inflections ? 'forms'
),
filtered AS (
  SELECT e.lemma, e.form
  FROM expanded e
  WHERE e.form ~ '^[a-z]+$'
    AND e.form <> e.lemma
    AND length(e.form) >= 2
    -- 축약 파편 (apostrophe-stripped artifacts)
    AND e.form <> ALL (ARRAY[
      's','d','m','t','re','ve','ll','nt','ain','o','y','ol','em',
      'isn','aren','wasn','weren','hasn','haven','hadn','didn','doesn','don','won',
      'can','couldn','wouldn','shouldn','mustn','needn','daren','shan','mightn','oughtn',
      'innit','tis','twas'
    ])
    -- 파생 접미 (다른 lexeme) — 굴절은 -s/-es/-ed/-ing/-er/-est 만 통과
    AND e.form !~ '(ness|ment|wise|wards?|able|ible|ially|fully|lessly|li?zation|li?sation|ist|ism|hood|ship|dom|ly)$'
    -- 파생 접두 (lemma 보다 길 때만)
    AND NOT (e.form ~ '^(un|re|dis|mis|non|pre|over|under|anti|inter|sub|super|de|fore|counter)'
             AND length(e.form) > length(e.lemma) + 1)
    -- form 자체가 별도 사전 표제어(6+자 파생어) → 별도 lexeme (짧은 불규칙 homograph 보호)
    AND NOT EXISTS (
      SELECT 1 FROM shared_dictionary e2
      WHERE e2.word = e.form AND e2.classified_by IS NOT NULL AND length(e.form) >= 6
    )
)
UPDATE shared_dictionary d
SET inflected_forms = sub.forms
FROM (
  SELECT lemma, array_agg(DISTINCT form ORDER BY form) AS forms
  FROM filtered GROUP BY lemma
) sub
WHERE d.word = sub.lemma AND array_length(sub.forms, 1) > 0;
