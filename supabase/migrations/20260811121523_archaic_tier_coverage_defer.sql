-- 20260811121523_archaic_tier_coverage_defer.sql
-- archaic 티어 후속 — coverage-clean 이 archaic_dictionary 보유 형태를 양보하게.
--
-- 20260811121439 에서 archaic 티어를 `dialect` 티어 **앞**에 삽입했는데, 실측해보니
-- 596건 중 상당수가 여전히 coverage-clean 으로 빠졌다:
--     superintend → "보고 직접"        cabman → "생계를 위해 택시를 운전하는 사람"
--     yonder      → "멀리 있지만 눈에 보이는 곳에"
--
-- 원인: **티어 위치를 잘못 짚었다.** D4b(20260810135205) 이후 코드상 순서는
--     … derivation → coverage-clean → coverage-clean_en → dialect → spelling → …
-- 이라 "dialect 앞"은 곧 "coverage-clean 뒤"였다. dialect_map 에 겹치는 단어(whilst·hath)만
-- coverage-clean 이 양보해서 통과한 것이고, archaic 단독 보유분은 전부 가로채였다.
--
-- 수정: D4b 와 동일한 양보 패턴을 archaic 에도 적용한다 — coverage-clean / coverage-clean_en
-- 두 티어에 `AND NOT EXISTS (archaic_dictionary …)` 를 더해 뒤의 archaic 티어가 잡게 한다.
-- (티어 블록을 물리적으로 옮기는 것보다 조건 추가가 국소적이고, dialect 처리와 형태가 같다.)
--
-- 검증: superintend→"감독하다, 관리하다"(supervise) · cabman→"마차꾼, 마부"(cab driver)
--       · yonder→"저쪽의, 저편의"(over there) · unwearied→"지치지 않는"(tireless)
--       · footfall→"발소리"(footstep) · outskirt→"변두리, 교외"(outskirts)
--   회귀 없음: crosstrees·mutineer 는 archaic 미보유라 coverage-clean 유지.

DO $mig$
DECLARE def text; out text; defer text;
BEGIN
  def := pg_get_functiondef('public.lookup_word_meaning(text)'::regprocedure);

  defer := ' AND NOT EXISTS (SELECT 1 FROM archaic_dictionary ax WHERE ax.word = s AND ax.meaning_ko IS NOT NULL AND length(ax.meaning_ko) > 0)';

  out := replace(
    def,
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND NOT EXISTS (SELECT 1 FROM dialect_map dmx WHERE dmx.variant = ANY(ARRAY[s] || en_inflection_bases(s))) AND lc.meaning_ko IS NOT NULL',
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND NOT EXISTS (SELECT 1 FROM dialect_map dmx WHERE dmx.variant = ANY(ARRAY[s] || en_inflection_bases(s)))' || defer || ' AND lc.meaning_ko IS NOT NULL'
  );
  IF out = def THEN RAISE EXCEPTION 'coverage-clean 양보 패치 실패 — 앵커 불일치'; END IF;
  def := out;

  out := replace(
    def,
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND NOT EXISTS (SELECT 1 FROM dialect_map dmx WHERE dmx.variant = ANY(ARRAY[s] || en_inflection_bases(s))) AND lc.gloss_en IS NOT NULL',
    'FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND NOT EXISTS (SELECT 1 FROM dialect_map dmx WHERE dmx.variant = ANY(ARRAY[s] || en_inflection_bases(s)))' || defer || ' AND lc.gloss_en IS NOT NULL'
  );
  IF out = def THEN RAISE EXCEPTION 'coverage-clean_en 양보 패치 실패 — 앵커 불일치'; END IF;

  EXECUTE out;
END $mig$;
