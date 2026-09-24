-- supabase/migrations/20260924151000_csat_source_inventory_live.sql
-- 원천별 재고 표(상태별 편수·판정·학령 분석·법적 탈락·마지막 수집·상위 차단 사유)를
-- 커밋된 스냅샷이 아니라 DB 에서 바로 센다(읽기 전용). 정의는 scripts/textbook/source-inventory-scan.mjs 와 같다.
-- 실측 2026-09-24: library_articles 68,604행 한 번 훑기 약 1초(csat_fit jsonb 를 한 번만 풀도록 CTE 를 materialized).
create or replace function public.csat_source_inventory_live()
returns table (
  source text,
  status text,
  n bigint,
  judged bigint,          -- csat_fit.gate.verdict 가 있는 것
  raw_purpose bigint,     -- 미절단 원본(gate.purpose = 'raw')
  levelled bigint,        -- 학령 분석(article_v_level)이 붙은 것
  legal_blocked bigint,   -- display_only 또는 국내 저작권 안전 아님
  first_get timestamptz,
  last_get timestamptz,
  blocked_by jsonb        -- 원천 단위 {차단 사유: 편수} — 같은 원천의 행마다 같은 값
)
language sql
stable
security invoker
set search_path = public
as $$
  with base as materialized (
    select a.source, a.status, a.created_at, a.article_v_level,
           a.display_only, a.copyright_safe_in_kr, a.csat_fit->'gate' as g
    from library_articles a
  ),
  reasons as (
    select source, jsonb_object_agg(reason, c) as blocked_by
    from (
      select source,
             case jsonb_typeof(g->'blockedBy') when 'array' then g->'blockedBy'->>0 else g->>'blockedBy' end as reason,
             count(*) as c
      from base group by 1, 2
    ) x
    where reason is not null
    group by source
  )
  select b.source, b.status, count(*),
         count(*) filter (where b.g->>'verdict' is not null),
         count(*) filter (where b.g->>'purpose' = 'raw'),
         count(*) filter (where b.article_v_level is not null),
         count(*) filter (where b.display_only is true or b.copyright_safe_in_kr is false),
         min(b.created_at), max(b.created_at),
         max(r.blocked_by::text)::jsonb
  from base b left join reasons r using (source)
  group by b.source, b.status
$$;

revoke all on function public.csat_source_inventory_live() from public, anon;
grant execute on function public.csat_source_inventory_live() to authenticated, service_role;
