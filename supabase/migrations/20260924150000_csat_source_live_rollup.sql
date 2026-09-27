-- supabase/migrations/20260924150000_csat_source_live_rollup.sql
-- 원문 적격 화면의 합계·원천별 표를 커밋된 스냅샷이 아니라 DB 에서 바로 센다(읽기 전용).
--
-- 왜: /admin/csat/sources 의 합계(「교재에 실을 수 있는 원문」)와 원천별 표가 저장소에 커밋된
-- JSON 스냅샷을 읽어, gutenberg 40,519행 삭제·판정 규격 v4 이후에도 87,720편(실제 64,102)을
-- 말하고 있었다(실측 2026-09-24). 원문마다 판정은 이미 csat_source_eligibility 에 있으므로
-- 세기만 하면 된다 — 64,102행 원천×등급 묶음 0.09초. PostgREST 는 group by 를 못 하므로 RPC 로 연다.
create or replace function public.csat_source_live_rollup()
returns table (
  source text,
  grade text,
  n bigint,
  with_items bigint,        -- 문항이 붙은 원문 수
  measured_min timestamptz, -- 이 칸에서 가장 오래된 판정 시각
  measured_max timestamptz,
  policy_min int,           -- 판정 규격 버전(섞였는지 보인다)
  policy_max int
)
language sql
stable
security invoker
set search_path = public
as $$
  select e.source,
         coalesce(e.result->>'grade', 'unknown') as grade,
         count(*)                                as n,
         count(*) filter (where e.linked_items > 0) as with_items,
         min(e.measured_at), max(e.measured_at),
         min(e.policy_version), max(e.policy_version)
  from csat_source_eligibility e
  group by 1, 2
$$;

revoke all on function public.csat_source_live_rollup() from public, anon;
grant execute on function public.csat_source_live_rollup() to authenticated, service_role;
