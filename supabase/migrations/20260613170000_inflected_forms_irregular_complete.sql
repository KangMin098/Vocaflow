-- supabase/migrations/20260613170000_inflected_forms_irregular_complete.sql
-- 굴절형 Phase C+ — 불규칙 완전성 보강 (authoritative english_irregular_forms 병합).
--
-- Phase A 부트스트랩이 일부 불규칙에 형태를 누락(forbid→forbidden 없음, swell→swollen 없음 등).
-- 권위 테이블 english_irregular_forms(form,base)의 비(非)base 형태를 inflected_forms 에 union.
--   · base==form (cut/put/let 등 과거=원형)은 제외 — matchSurface 가 lemma 를 항상 포함하므로 불요
--   · 'lie' 제외 — homograph 위험 (recline lie→lay/lain vs untruth lie→lied; lay 는 별도 동사)
--   · 멱등 (union · 누락 형태만 보강)

UPDATE shared_dictionary d
SET inflected_forms = (
  SELECT array_agg(DISTINCT f ORDER BY f)
  FROM (
    SELECT unnest(d.inflected_forms) AS f
    UNION
    SELECT lower(e.form)
    FROM english_irregular_forms e
    WHERE e.base = d.word AND lower(e.form) <> d.word
  ) u
)
WHERE d.word IN (SELECT DISTINCT base FROM english_irregular_forms WHERE base <> 'lie')
  AND d.inflected_forms IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM english_irregular_forms e
    WHERE e.base = d.word AND lower(e.form) <> d.word
      AND NOT (d.inflected_forms @> ARRAY[lower(e.form)])
  );
