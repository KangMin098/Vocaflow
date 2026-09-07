-- supabase/migrations/20260826102758_textfit_resolve_levels.sql
--
-- ✅ 적용 2026-08-26 (schema_migrations 20260826102758). 스모크: 8낱말 입력 →
--    happier→happy · studies→study 로 굴절이 붙고, 사전에 없는 xyzzy 는 빠졌다(7행).
--
-- 무엇을 하는가
--   표면형 배열을 받아 `resolve_dict_headword` 로 표제어를 붙이고 V-Level 을 돌려준다.
--   **필터가 없다** — 이것이 기존 `extract_vocabulary_for_user_v2` 와의 유일하고 결정적인 차이다.
--
-- 왜 필요한가
--   TextFit 커버리지는 "이 지문에서 학습자가 아는 비율" 이므로 **아는 단어도 세야 한다**.
--   v2 는 정확히 그 반대를 한다 — v_threshold 미만을 버리고, 이미 단어장에 있거나
--   known 으로 표시한 단어를 제외한다(= 배울 것만 남긴다). 그 결과로는 분자를 만들 수 없다.
--
-- 안전성
--   - 읽기 전용(STABLE). 쓰기·DDL 없음. 새 테이블 없음.
--   - SECURITY INVOKER — 호출자 권한 그대로. 학습자별 데이터를 만지지 않는다
--     (개인화는 전부 TS 쪽에서 user_id 로 건다).
--   - 입력 상한 4000 — 토크나이저 MAX_UNIQUE 와 같은 자리수. 초과분은 잘라 낸다.
--   - 재실행 안전(CREATE OR REPLACE). 롤백은 DROP FUNCTION 한 줄.

CREATE OR REPLACE FUNCTION public.textfit_resolve_levels(p_words text[])
RETURNS TABLE(surface text, headword text, v_level smallint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
SET statement_timeout TO '15000'
AS $function$
  WITH input_words AS (
    SELECT DISTINCT lower(trim(w)) AS w
    FROM unnest(p_words) AS w
    WHERE length(trim(w)) >= 2
    LIMIT 4000
  ),
  resolved AS (
    SELECT iw.w AS surface, public.resolve_dict_headword(iw.w) AS hw
    FROM input_words iw
  )
  SELECT
    r.surface,
    d.word AS headword,
    d.v_level
  FROM resolved r
  JOIN public.shared_dictionary d ON d.word = r.hw
  WHERE d.classified_by IS NOT NULL;
$function$;

COMMENT ON FUNCTION public.textfit_resolve_levels(text[]) IS
  'TextFit 커버리지용 — 표면형을 표제어·V-Level 로 해석. 필터 없음(아는 단어도 세야 한다). 읽기 전용.';

GRANT EXECUTE ON FUNCTION public.textfit_resolve_levels(text[]) TO authenticated;

-- 롤백:
--   DROP FUNCTION IF EXISTS public.textfit_resolve_levels(text[]);
