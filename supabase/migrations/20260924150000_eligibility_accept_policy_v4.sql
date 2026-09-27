-- supabase/migrations/20260924150000_eligibility_accept_policy_v4.sql
--
-- 적격 판정 규격 4(V6+ CEFR 상한 B2 → C1) 전환의 **1단계 — 두 버전을 함께 받는다.**
--
-- 왜 두 단계인가: `csat_source_is_eligible` · `csat_source_is_gradeable` 이 캐시의 `policy_version` 을
-- 숫자로 고정해 읽는다(= 3). 캐시를 규격 4 로 다시 적재하는 동안(약 10.9만 행 · 약 35분) 이미 4 로 바뀐 행이
-- 함수에서 전부 부적격으로 읽히면 서빙·채점이 끊긴다. 그래서
--   ① 이 마이그레이션: 3 과 4 를 모두 받는다
--   ② `scripts/textbook/source-policy-refresh.mjs` 로 캐시를 규격 4 로 재적재
--   ③ 후속 마이그레이션: 4 만 받는다(재적재 완료 · 규격 3 행 0 확인 후)
-- 근거: packages/library-pipeline/src/textbook/assemble-unit.ts `UPPER_BAND_MAX_CEFR` 주석 ·
--       scripts/csat/measure-band-rulers.mts (기출 C1 17.8% · 시중 고2~고3 26~32% · C2 0%).
--
-- 되돌리기: 두 함수의 `IN (3, 4)` 를 `= 3` 으로 되돌린다(데이터 변경 없음).

CREATE OR REPLACE FUNCTION public.csat_source_is_eligible(p_article_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.csat_source_eligibility e
    JOIN public.library_articles a ON a.id = e.article_id
    WHERE e.article_id = p_article_id
      AND e.policy_version IN (3, 4)
      AND e.source_updated_at = a.updated_at
      AND e.result->>'grade' IN ('usable','excerpt')
      AND e.result->'blockers' = '[]'::jsonb
      AND a.status IN ('ready','published')
      AND (e.result->>'grade' <> 'excerpt' OR EXISTS (
        SELECT 1 FROM public.csat_dcp_items i WHERE i.kind='article' AND i.ref_id=a.id
      ))
  );
$function$;

CREATE OR REPLACE FUNCTION public.csat_source_is_gradeable(p_article_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.csat_source_eligibility e
    JOIN public.library_articles a ON a.id = e.article_id
    WHERE e.article_id = p_article_id
      AND e.policy_version IN (3, 4)
      AND e.source_updated_at = a.updated_at
      AND a.status IN ('ready', 'published')
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(e.result->'blockers') AS b(code)
        WHERE b.code <> 'cefr_above_band'
      )
  );
$function$;
