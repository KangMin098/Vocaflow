-- library_chapters_master 에 챕터별 어휘 V-level 추가 (P1 — 챕터 편차 노출)
--   근거: 단일 book_v_level 이 챕터 난이도 3~5레벨 편차를 뭉갬
--         (진단 docs/AI_CONTEXT/diagnostics/syntactic_axis_p0_20260709.md)
--   산정: 챕터 distinct lemma 의 v_level PERCENTILE_DISC(0.75), V11 제외
--         (compute_book_vrl type-based 동일 규칙)
--   정합: chapter_idx 1,295/1,296 매칭 (미매칭 1건 NULL 유지)
--   성격: 정적 콘텐츠 속성 (book_v_level·cefr_level 과 동일) — 동적 학습자 상태 아님, 재추출 시 갱신.

ALTER TABLE library_chapters_master
  ADD COLUMN IF NOT EXISTS chapter_v_level smallint;

COMMENT ON COLUMN library_chapters_master.chapter_v_level IS
  '챕터별 어휘 V-level (distinct lemma v_level p75, V11 제외). book_v_level 의 챕터 편차 노출용. 동적 상태 아님 — 재추출 시 갱신.';

WITH ch_v AS (
  SELECT lbv.library_book_id, lbv.chapter_idx,
    PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY sd.v_level) AS ch_p75
  FROM library_book_vocabularies lbv
  JOIN shared_dictionary sd ON sd.word = lbv.lemma
  WHERE lbv.lemma IS NOT NULL AND sd.v_level BETWEEN 0 AND 10
  GROUP BY lbv.library_book_id, lbv.chapter_idx
)
UPDATE library_chapters_master lcm
SET chapter_v_level = cv.ch_p75
FROM ch_v cv
WHERE cv.library_book_id = lcm.library_book_id
  AND cv.chapter_idx = lcm.chapter_idx;
