-- supabase/migrations/20260826140000_curriculum_bands.sql
--
-- **교사가 실제로 행동하는 숫자를 공개 화면에 연다** — 2022 개정 교육과정 기본 어휘.
--
-- ── 데이터는 처음부터 있었다 (2026-08-26 실측) ──────────────────────
-- `shared_dictionary.list_tags` 에 들어 있었고 **어느 화면도 쓰지 않았다.**
--
--   kcurr2022_1   808개 · 평균 V 1.83 · be·in·have·it·he       → 고시 `*`  초등 권장 800
--   kcurr2022_2 1,211개 · 평균 V 3.68 · other·mean·through     → 고시 `**` 중·고 공통 1,200
--   kcurr2022_0 1,006개 · 평균 V 5.93 · accord·apparent·former → 고시      그 외 1,000
--                                                      합계 3,025 ≈ 고시 3,000
--   한 낱말이 두 계층을 갖는 경우 **0건** — 밴드가 유일하게 정해진다.
--   `kice-csat-13y` 5,254개(수능 13년치) 중 **3,108개가 교육과정 밖**이다.
--
-- 출처: 교육부 고시 제2022-33호 [별책 14] pp.254-290. 교과서 검정이 이 목록으로 이뤄진다
-- (KICE Word Lister) — 교사·출판사·평가원이 이미 같은 말을 쓰는 유일한 축이다.
--
-- ── 왜 RPC 인가 ─────────────────────────────────────────────────────
-- `/fit` 은 로그인 없이 쓰는 화면이고(교사 채널 CAC 0 의 유일한 후보) 익명은
-- `shared_dictionary` 를 못 읽는다(RLS: `authenticated read dictionary`).
-- 공개 경로는 `shared_words`+`lexicon_clean` 으로만 도는데 거기엔 이 태그가 없다.
--
-- ── 왜 파생형에 밴드를 물려주나 ─────────────────────────────────────
-- **고시의 목록은 원형만 싣는다.** 실측:
--     teach ✓ / teacher ✗ · compute ✓ / computer ✗ · differ ✓ / different·difference ✗
-- 파생어는 규칙으로 인정되는 것이 이 목록의 관행이다. 그대로 대조하면 교사가 보는
-- "교육과정 밖" 이 부풀려진다 — 표본 지문에서 **10개 → 실제 6개**였다.
-- 사전의 `derived_forms` 로만 물려준다. **접미사를 추측해 만들지 않는다.**
--
-- ⚠️ **수능 태그는 확장하지 않는다.** 밴드는 "이 목록에 속하는가" 라는 분류지만
--    출제는 **일어난 일**이다. `teacher` 가 나왔다고 `teach` 가 나온 것이 아니다.
--
-- ⚠️ 밴드 번호의 뜻은 `lib/textfit/curriculum.ts` 한 곳이 소유한다. 태그 이름의 숫자
--    (`_0`·`_1`·`_2`)는 **난이도 순서가 아니다** — 그대로 쓰면 초등이 3단계로 보인다.
--
-- 노출 범위: 낱말이 **관보로 공개된 목록에 있는지**와 수능 기출인지 뿐이다.
-- 뜻·예문·난이도는 돌려주지 않는다.
--
-- 되돌리기: `DROP FUNCTION public.curriculum_bands(text[]);` — 데이터는 건드리지 않는다.

DROP FUNCTION IF EXISTS public.curriculum_bands(text[]);

CREATE OR REPLACE FUNCTION public.curriculum_bands(p_words text[])
RETURNS TABLE(word text, curr_band smallint, csat boolean, via_derived boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15000'
AS $function$
  WITH input_words AS (
    SELECT DISTINCT lower(btrim(w)) AS w
    FROM unnest(p_words) AS w
    WHERE length(btrim(w)) >= 2
    -- 공개 화면이라 상한을 둔다. `textfit_resolve_levels` 와 같은 값.
    LIMIT 4000
  ),
  tagged AS (
    SELECT d.word,
           CASE
             WHEN 'kcurr2022_1' = ANY(d.list_tags) THEN 1::smallint  -- 초등 권장 (*)
             WHEN 'kcurr2022_2' = ANY(d.list_tags) THEN 2::smallint  -- 중·고 공통 (**)
             WHEN 'kcurr2022_0' = ANY(d.list_tags) THEN 3::smallint  -- 그 외 과목
           END AS band,
           d.derived_forms
    FROM public.shared_dictionary d
    WHERE d.list_tags && ARRAY['kcurr2022_0', 'kcurr2022_1', 'kcurr2022_2']
  ),
  direct AS (
    SELECT iw.w AS word, t.band, false AS via_derived
    FROM input_words iw JOIN tagged t ON t.word = iw.w
  ),
  derived AS (
    -- 태그 붙은 3,025개만 훑는다 — 사전 전체를 보지 않는다.
    SELECT iw.w AS word, min(t.band)::smallint AS band, true AS via_derived
    FROM tagged t
    CROSS JOIN LATERAL unnest(coalesce(t.derived_forms, ARRAY[]::text[])) AS df(form)
    JOIN input_words iw ON iw.w = lower(df.form)
    WHERE NOT EXISTS (SELECT 1 FROM direct dr WHERE dr.word = iw.w)
    GROUP BY iw.w
  ),
  banded AS (
    SELECT * FROM direct
    UNION ALL
    SELECT * FROM derived
  ),
  csat_words AS (
    SELECT iw.w AS word
    FROM input_words iw
    JOIN public.shared_dictionary d ON d.word = iw.w
    WHERE 'kice-csat-13y' = ANY(d.list_tags)
  )
  SELECT
    coalesce(b.word, c.word) AS word,
    b.band AS curr_band,
    (c.word IS NOT NULL) AS csat,
    coalesce(b.via_derived, false) AS via_derived
  FROM banded b
  FULL OUTER JOIN csat_words c ON c.word = b.word;
$function$;

COMMENT ON FUNCTION public.curriculum_bands(text[]) IS
  '표제어 → 2022 개정 교육과정 기본어휘 밴드(1=초등* / 2=중고** / 3=그 외)와 수능 기출 여부. 익명 허용. 목록은 원형 기준이라(teach O / teacher X) derived_forms 로 파생형에 밴드를 물려준다 — via_derived=true. 수능 태그는 확장하지 않는다: 실제 출제 여부는 사실 주장이라 파생형으로 늘리면 거짓이 된다. 밴드 번호의 뜻은 lib/textfit/curriculum.ts 가 소유한다.';

GRANT EXECUTE ON FUNCTION public.curriculum_bands(text[]) TO anon, authenticated;
