-- supabase/migrations/20260924170000_eligibility_policy_v4_only.sql
--
-- 적격 판정 규격 4 전환의 **3단계 — 4만 받는다.**
--
-- 1단계(20260924150000)가 두 함수를 policy_version IN (3, 4) 로 열었고, 2단계로 캐시 64,102행을 규격 4로 재적재했다
-- (규격 3 행 0 확인 · 2026-09-24). 이제 옛 규격 행이 적격으로 읽힐 길을 닫는다 — 새 규격으로 다시 재지 않은 행이
-- 옛 상한(V6+ B2)으로 매겨진 채 서빙되는 것을 막는다.
--
-- 되돌리기: 두 함수의 = 4 를 IN (3, 4) 로 되돌린다(데이터 변경 없음).

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
      AND e.policy_version = 4
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
      AND e.policy_version = 4
      AND e.source_updated_at = a.updated_at
      AND a.status IN ('ready', 'published')
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(e.result->'blockers') AS b(code)
        WHERE b.code <> 'cefr_above_band'
      )
  );
$function$;
