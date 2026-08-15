-- supabase/migrations/_pending_20260815_i7_phrase_unit_carveout.sql
--
-- ⚠️ **미적용 — 사용자 승인 대기** (CLAUDE.md: 마이그레이션 자동 적용 금지).
--    승인 시 파일명을 `20260815xxxxxx_i7_phrase_unit_carveout.sql` 로 바꿔 apply_migration 한다.
--
-- ── 무엇을 고치나 ────────────────────────────────────────────────────
-- I7("노이즈 register 발행 누출")이 `phrase_unit` 을 **모든 발행 세트에서** 노이즈로 센다.
-- 그 규칙은 낱말 단어장에는 옳다 — `(as) sick as a parrot` 같은 사전 변형이 섞이면 결함이다.
-- 그러나 **구동사·관용어 단어장은 표제어 자체가 구**다. 그 유형에서 phrase_unit 은 산출물이지
-- 누출이 아니다.
--
-- 실측(2026-08-15): 컴포저가 `phrasal-idiom` 유형으로 발행한 `cat-phrasal` 90단어 중 52건이
-- phrase_unit 이라 I7 이 critical FAIL 1 을 냈다. 게이트를 고칠 때까지 그 세트를 비공개로
-- 내려 두었다(발행하면 게이트가 빨개지고, 게이트를 무시하면 진짜 누출을 놓친다).
--
-- ── 어떻게 고치나 ────────────────────────────────────────────────────
-- "그 세트가 구를 다루는 유형인가" 를 레시피에서 읽는다. 컴포저는 `curation_query.blueprint`
-- 에 유형 id 를 남기므로 판정 근거가 데이터에 있다 — 카테고리 문자열 추측이 아니다.
--
-- 면제 대상: blueprint = 'phrasal-idiom' 인 세트의 `phrase_unit` **한 종류만**.
--   · archaic/brand/proper_noun 등 나머지 노이즈는 그 유형에서도 그대로 결함이다.
--   · 다른 유형에서는 phrase_unit 이 여전히 노이즈다.

CREATE OR REPLACE FUNCTION public.run_content_quality_gates(
  p_scope text DEFAULT 'global'::text,
  p_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(pipeline text, invariant text, severity text, fail_count bigint, verdict text, detail jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60000'
AS $function$
DECLARE
  v_noise text[] := ARRAY['archaic_literary','period_cultural','phrase_unit','brand','abbreviation','proper_noun'];
BEGIN
  -- ⚠️ 이 파일은 I7 두 곳(global · word_set)만 바꾼다. 나머지 본문은 현행 정의 그대로여야 하므로,
  --    적용 시 `pg_get_functiondef` 로 현행 정의를 받아 아래 두 블록만 치환할 것.
  --    (전체 본문을 여기 복사해 두면 그 사이 다른 세션이 고친 게이트를 조용히 되돌린다)
  RAISE EXCEPTION '이 파일은 치환 지침이다 — 현행 정의에 아래 두 블록만 반영해 적용할 것';
END;
$function$;

-- ── 치환 ① global scope 의 I7 ────────────────────────────────────────
--
--   기존:
--     FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id
--          JOIN shared_dictionary sd ON sd.word=lower(sw.word)
--     WHERE sws.is_published AND sd.word_register = ANY(v_noise);
--
--   변경:
--     FROM shared_words sw JOIN shared_word_sets sws ON sws.id=sw.set_id
--          JOIN shared_dictionary sd ON sd.word=lower(sw.word)
--     WHERE sws.is_published AND sd.word_register = ANY(v_noise)
--       AND NOT (sd.word_register = 'phrase_unit'
--                AND sws.curation_query->>'blueprint' = 'phrasal-idiom');

-- ── 치환 ② word_set scope 의 I7 ──────────────────────────────────────
--
--   기존:
--     FROM shared_words sw JOIN shared_dictionary sd ON sd.word=lower(sw.word)
--     WHERE sw.set_id=p_id AND sd.word_register = ANY(v_noise);
--
--   변경:
--     FROM shared_words sw
--          JOIN shared_dictionary sd ON sd.word=lower(sw.word)
--          JOIN shared_word_sets sws ON sws.id = sw.set_id
--     WHERE sw.set_id=p_id AND sd.word_register = ANY(v_noise)
--       AND NOT (sd.word_register = 'phrase_unit'
--                AND sws.curation_query->>'blueprint' = 'phrasal-idiom');

-- ── 적용 후 할 일 ────────────────────────────────────────────────────
--   1) `update shared_word_sets set is_published = true where slug = 'cat-phrasal';`
--   2) `pnpm --filter web exec vitest run content-quality-gate` — critical FAIL 0 확인
--   3) docs/VCB_REDESIGN.md 의 "게이트 충돌" 항목을 해소로 갱신
