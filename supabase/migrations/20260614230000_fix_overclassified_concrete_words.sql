-- supabase/migrations/20260614230000_fix_overclassified_concrete_words.sql
-- VRL V-Level 교정: 일상 구체어 과대분류 보정.
--
-- 발견 경위: StoryWeaver 어린이 그림책 "Ammachi's Amazing Machines"(Level 2, A2) 가
--   book_v_level V5(B1) 로 산정됨. 원인 분석 결과 — 대다수 단어는 V1-V4(A1-A2)인데
--   p75(상위 25%)가 일상 구체어 과대분류 단어들에 끌려 V5 로 부풀려짐:
--     coconut→C1/V8, tray→C1/V5, neat→C2/V7, shell→B2/V5, ripe→C1/V6,
--     toss→C1/V7, squeak→C1/V9, husk→C2/V10.
--   이들은 구체·picturable 일상어로 실제 CEFR 은 A2-B2. pure-semantic VRL 분류 오류.
--
-- 교정 (V-Level↔CEFR 매핑 V3-4≈A2 · V5-6≈B1 · V7≈B2 기준). 전역 적용 — 모든 도서/글 개선.
--   교정 후 해당 책 재산정: book_v_level V5→V4, centroid 2.85→2.46, CEFR-J A2.2→A2.1.
--   (classified_by 는 CHECK 제약상 기존값 유지 — v_level/cefr_level 만 보정.)

UPDATE shared_dictionary sd
SET v_level = c.vl, cefr_level = c.cefr
FROM (VALUES
  ('coconut', 4, 'A2'),
  ('tray',    4, 'A2'),
  ('neat',    4, 'A2'),
  ('shell',   4, 'A2'),
  ('ripe',    5, 'B1'),
  ('toss',    5, 'B1'),
  ('squeak',  6, 'B1'),
  ('husk',    7, 'B2')
) AS c(word, vl, cefr)
WHERE sd.word = c.word;
