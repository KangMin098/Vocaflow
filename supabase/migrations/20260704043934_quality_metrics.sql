-- supabase/migrations/20260704043934_quality_metrics.sql
-- 품질평가 Q2 — quality_metrics nightly 집계 (v06.119)
-- 평가만 자동화. 개선 루프 없음 (handoff 명시 금지).
-- 롤백: docs/AI_CONTEXT/rollback/QE_quality_metrics_drop.sql

create table if not exists quality_metrics (
  id bigint generated always as identity primary key,
  measured_at timestamptz not null default now(),
  stage text not null check (stage in ('ingest','analyze','extract','publish','deliver')),
  metric text not null,
  value numeric not null,
  dims jsonb not null default '{}'::jsonb
);

comment on table quality_metrics is
  '파이프라인 품질 지표 nightly 스냅샷 — collect_quality_metrics() 가 INSERT (03:10 KST). 읽기는 admin 전용.';

create index quality_metrics_metric_time_idx on quality_metrics (metric, measured_at desc);

alter table quality_metrics enable row level security;

create policy quality_metrics_admin_read on quality_metrics
  for select to authenticated
  using (exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'admin'
  ));
-- INSERT/UPDATE/DELETE 정책 없음 — 쓰기는 SECURITY DEFINER collector 만.

create or replace function collect_quality_metrics()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_now timestamptz := now();
  v_rows integer := 0;
begin
  -- M1 (extract) — published 책의 챕터별 word set 보유율
  with pb as (
    select id, title from library_books where status = 'published'
  ),
  ch as (
    select m.library_book_id, count(*) as n
    from library_chapters_master m join pb on pb.id = m.library_book_id
    group by 1
  ),
  st as (
    select (s.curation_query->>'book_id')::uuid as book_id,
           count(distinct s.curation_query->>'chapter_idx') as n
    from shared_word_sets s
    where s.category = 'library_book'
      and (s.curation_query->>'book_id')::uuid in (select id from pb)
    group by 1
  ),
  agg as (
    select count(*)::int as books_total,
           coalesce(sum(ch.n), 0)::int as chapters_total,
           coalesce(sum(st.n), 0)::int as chapters_with_set,
           coalesce(jsonb_agg(pb.title) filter (where coalesce(st.n,0) < coalesce(ch.n,0)), '[]'::jsonb)
             as books_below_100
    from pb
    left join ch on ch.library_book_id = pb.id
    left join st on st.book_id = pb.id
  )
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'extract', 'published_chapter_set_coverage_pct',
         round(100.0 * chapters_with_set / nullif(chapters_total, 0), 2),
         jsonb_build_object('books_total', books_total, 'chapters_total', chapters_total,
                            'chapters_with_set', chapters_with_set, 'books_below_100', books_below_100)
  from agg where chapters_total > 0;

  -- M2 (publish) — set 크기 분포 (p50 / p90 행 2개, min·max·sets 는 dims)
  with sizes as (
    select s.id, count(w.set_id) as n
    from shared_word_sets s left join shared_words w on w.set_id = s.id
    where s.category = 'library_book'
    group by s.id
  ),
  stat as (
    select count(*)::int as sets,
           percentile_cont(0.5) within group (order by n) as p50,
           percentile_cont(0.9) within group (order by n) as p90,
           min(n)::int as min_n, max(n)::int as max_n
    from sizes
  )
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'publish', m.metric, m.val,
         jsonb_build_object('sets', sets, 'min', min_n, 'max', max_n)
  from stat,
  lateral (values ('set_size_p50', p50), ('set_size_p90', p90)) as m(metric, val)
  where sets > 0;

  -- M3 (publish) — shared_words meaning_ko 충전율 (library_book set 한정)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'publish', 'shared_words_meaning_ko_pct',
         round(100.0 * count(*) filter (where w.meaning_ko is not null and length(w.meaning_ko) > 0)
               / nullif(count(*), 0), 2),
         jsonb_build_object('total', count(*),
                            'filled', count(*) filter (where w.meaning_ko is not null and length(w.meaning_ko) > 0))
  from shared_words w join shared_word_sets s on s.id = w.set_id
  where s.category = 'library_book'
  having count(*) > 0;

  -- M4 (deliver) — 책 librivox 오디오 매핑률 (published / ready 각 1행)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'deliver', 'book_librivox_audio_pct',
         round(100.0 * count(*) filter (where librivox_audio is not null) / nullif(count(*), 0), 2),
         jsonb_build_object('status', status, 'books', count(*),
                            'with_librivox', count(*) filter (where librivox_audio is not null))
  from library_books
  where status in ('published', 'ready')
  group by status;

  -- M5 (analyze) — book_v_level V7+V8 쏠림 (published / ready 각 1행 · 분포는 dims)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'analyze', 'book_v7_v8_share_pct',
         round(100.0 * count(*) filter (where book_v_level in (7, 8)) / nullif(count(*), 0), 2),
         jsonb_build_object('status', status, 'books', count(*),
                            'v_dist', (select jsonb_object_agg(coalesce(v::text, 'null'), c)
                                       from (select book_v_level as v, count(*) as c
                                             from library_books b2
                                             where b2.status = b.status
                                             group by 1) d))
  from library_books b
  where status in ('published', 'ready')
  group by status;

  -- M6 (ingest) — 글 lexical_noise 분포 (books 에는 컬럼 없음 → 글 전용, P0 확정)
  insert into quality_metrics (measured_at, stage, metric, value, dims)
  select v_now, 'ingest', 'article_lexical_noise_p90',
         round((percentile_cont(0.9) within group (order by lexical_noise))::numeric, 3),
         jsonb_build_object('articles', count(*), 'with_noise', count(lexical_noise),
                            'p50', round((percentile_cont(0.5) within group (order by lexical_noise))::numeric, 3),
                            'max', max(lexical_noise))
  from library_articles
  having count(lexical_noise) > 0;

  select count(*)::int into v_rows from quality_metrics where measured_at = v_now;
  return v_rows;
end $$;

comment on function collect_quality_metrics() is
  '품질 지표 M1~M6 nightly 수집 → quality_metrics INSERT. 반환 = 이번 실행 INSERT 행 수.';

revoke execute on function collect_quality_metrics() from public, anon, authenticated;

-- pg_cron 등록 (2026-07-04 별도 실행됨 · jobid=12):
--   select cron.schedule('quality-metrics-nightly', '10 18 * * *',
--     $cron$select collect_quality_metrics()$cron$);
