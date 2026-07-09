-- 신규 적재 도서 chapter_v_level 자동 산출 (v06.174 wire-up)
--   compute_book_vrl(book_v_level) 과 동일 규칙을 챕터 단위로 — 별도 peer 함수(공유 함수 미수정).
--   process 라우트가 compute_book_vrl/cefrj/coverage 시퀀스에 이 함수를 추가 호출.
--   초기 백필은 20260709145433_lcm_chapter_v_level.sql (기존 25권). 본 함수는 이후 신규 도서용.
CREATE OR REPLACE FUNCTION public.compute_book_chapter_v_levels(p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF p_book_id IS NULL THEN RETURN; END IF;

  -- 챕터별 어휘 V-level — book_v_level(compute_book_vrl) 과 동일 규칙:
  --   distinct lemma 의 v_level PERCENTILE_DISC(0.75), V11(archaic) 제외.
  WITH ch_lemma AS (
    SELECT DISTINCT lbv.chapter_idx, lbv.lemma, sd.v_level
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary sd ON sd.word = lbv.lemma
    WHERE lbv.library_book_id = p_book_id
      AND lbv.chapter_idx IS NOT NULL
      AND sd.v_level IS NOT NULL
      AND sd.v_level <> 11
  ),
  ch AS (
    SELECT chapter_idx,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY v_level)::smallint AS ch_p75
    FROM ch_lemma GROUP BY chapter_idx
  )
  UPDATE library_chapters_master lcm
  SET chapter_v_level = ch.ch_p75
  FROM ch
  WHERE lcm.library_book_id = p_book_id
    AND lcm.chapter_idx = ch.chapter_idx;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compute_book_chapter_v_levels(uuid) TO authenticated, service_role;
