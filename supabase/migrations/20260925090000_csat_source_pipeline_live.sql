-- supabase/migrations/20260925090000_csat_source_pipeline_live.sql
-- 원천별 작업 진행표 — 원천마다 모음 → 원문 점검(보관) → 발췌 → 학년 분석 → 내용 판정 단계별 편수(읽기 전용).
-- 원본/조각 구분은 scripts/csat/gate-rules.mjs 의 derivativeKind, 보관 상태는 retentionOf 와 같은 규칙이다.
-- 실측 2026-09-25: PLOS 원본 보관·발췌 대기 4,077 · 폐기 1,040 · 판정 전 31,220 · 조각 11,602.
create or replace function public.csat_source_pipeline_live()
returns table (
  source text, total bigint, pieces bigint,
  keep bigint, keep_pending bigint, hold bigint, discard bigint, undecided bigint,
  levelled bigint, judged bigint, last_get timestamptz
)
language sql stable security invoker set search_path = public
as $$
  with a as (
    select a.source, a.article_v_level, a.created_at, a.csat_fit->'gate' as g,
      coalesce(
        (jsonb_typeof(a.csat_fit->'derived_from') = 'object'
          and (a.csat_fit->'derived_from' ? 'id' or a.csat_fit->'derived_from' ? 'source_id'))
        or coalesce(a.feed_id, '') in ('plos-extract', 'adapted')
        or coalesce(a.source_id, '') like 'adapt:%'
        or coalesce(a.source_id, '') ~ '#lead'
        or coalesce(a.source_id, '') ~ '#p\d+-\d+$', false) as piece
    from library_articles a
  ), r as (
    select *, case
      when coalesce(g->'retain'->>'retention', g->'retain'->>'verdict') in ('keep','use','narrative') then 'keep'
      when coalesce(g->'retain'->>'retention', g->'retain'->>'verdict') in ('discard','reject') then 'discard'
      when coalesce(g->'retain'->>'retention', g->'retain'->>'verdict') = 'hold' then 'hold' end as rv
    from a
  ), s as (
    select *, case
      when rv = 'hold' then 'hold'
      when g->>'purpose' = 'raw' then
        case coalesce(rv, case g->>'verdict' when 'reject' then 'discard' when 'use' then 'keep' when 'narrative' then 'keep' end)
          when 'discard' then 'discard' when 'keep' then 'keep-pending' else 'undecided' end
      else coalesce(rv, case g->>'verdict' when 'reject' then 'discard' when 'use' then 'keep' when 'narrative' then 'keep' end, 'undecided')
    end as retention
    from r
  )
  select source, count(*), count(*) filter (where piece),
    count(*) filter (where not piece and retention = 'keep'),
    count(*) filter (where not piece and retention = 'keep-pending'),
    count(*) filter (where not piece and retention = 'hold'),
    count(*) filter (where not piece and retention = 'discard'),
    count(*) filter (where not piece and retention = 'undecided'),
    count(*) filter (where article_v_level is not null),
    count(*) filter (where g->>'verdict' is not null),
    max(created_at)
  from s group by source
$$;

revoke all on function public.csat_source_pipeline_live() from public, anon;
grant execute on function public.csat_source_pipeline_live() to authenticated, service_role;
