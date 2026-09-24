-- supabase/migrations/20260925100000_csat_source_pipeline_live_fix_pending.sql
-- 「발췌 대기」에서 옛 발췌로 이미 조각이 있는 원본을 뺀다.
-- 실측 2026-09-25: 대기로 센 4,077 중 3,821 이 이미 잘려 있었다(원본에 csat_fit.extract 표시가 없었을 뿐) → 실제 대기 256.
-- 발췌기 예행(--pending-only --v 7)이 263편 중 262편을 「이미 발췌 있음」으로 건너뛰며 드러났다.
create or replace function public.csat_source_pipeline_live()
returns table (
  source text, total bigint, pieces bigint,
  keep bigint, keep_pending bigint, hold bigint, discard bigint, undecided bigint,
  levelled bigint, judged bigint, last_get timestamptz
)
language sql stable security invoker set search_path = public
as $$
  with extracted as (
    select distinct source_url from library_articles where feed_id = 'plos-extract' and source_url is not null
  ), a as (
    select a.source, a.article_v_level, a.created_at, a.csat_fit->'gate' as g,
      (a.csat_fit ? 'extract' or ex.source_url is not null) as has_extract,
      coalesce(
        (jsonb_typeof(a.csat_fit->'derived_from') = 'object'
          and (a.csat_fit->'derived_from' ? 'id' or a.csat_fit->'derived_from' ? 'source_id'))
        or coalesce(a.feed_id, '') in ('plos-extract', 'adapted')
        or coalesce(a.source_id, '') like 'adapt:%'
        or coalesce(a.source_id, '') ~ '#lead'
        or coalesce(a.source_id, '') ~ '#p\d+-\d+$', false) as piece
    from library_articles a left join extracted ex on ex.source_url = a.source_url and coalesce(a.feed_id,'') <> 'plos-extract'
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
          when 'discard' then 'discard'
          when 'keep' then case when has_extract then 'keep' else 'keep-pending' end
          else 'undecided' end
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
