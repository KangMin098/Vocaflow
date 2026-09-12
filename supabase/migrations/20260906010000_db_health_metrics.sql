-- supabase/migrations/20260906010000_db_health_metrics.sql
--
-- DB 헬스 스냅샷 — 3층(수집·판정·조치) 중 **수집층**.
--
-- 왜 필요한가 (2026-09-06 실측):
--   · pg_cron 잡이 14일간 79회 실패했고 **아무 화면에도 뜨지 않았다**.
--     `refresh-textbook-shelf-stats` 46회 · `library-pipeline-worker` 31회 "job startup timeout" ·
--     `quality-metrics-nightly`·`content-gate-nightly` statement timeout.
--   · DB 6,253 MB. 30일간 마이그레이션 184건(하루 6개꼴) — 스키마가 매일 바뀌는데
--     바뀐 뒤 무엇이 나빠졌는지 재는 곳이 없다.
--   화면은 열 때만 계산하므로 안 연 시간의 사고를 영영 못 본다. 그래서 스냅샷을 남긴다.
--
-- 무엇을 재나 — 6축. 이 마이그레이션은 그중 5축(일 1회 저비용):
--   ① capacity    용량·블로트   ② cron   잡 성공률·마지막 성공 경과
--   ③ latency     느린 쿼리     ④ connections 연결 점유
--   ⑤ advisor     접근 안전(anon 노출·RLS 누락·SECURITY DEFINER)
--   ⑥ integrity 는 비싸므로 주 1회 — 20260906010500_db_health_integrity.sql
--
-- **판정하지 않는다.** 임계값을 SQL 에 굳히면 "6,253MB 가 위험한가" 를 상수가 답하게 된다.
--   이 함수는 사실만 적고, 위험 여부는 DB 밖 에이전트가 추세·원인과 함께 판단한다.
--   그래서 dims 에 목록·상위 표본을 통째로 실어 둔다 — 판정자가 다시 물어보지 않아도 되게.
--
-- 비용 설계 (실측 근거):
--   · pgstattuple_approx 를 상위 6개 테이블에 한 번에 돌리면 **120초 타임아웃**.
--     1,974MB 짜리 `library_article_vocabularies` 는 **단독으로도 초과**한다.
--     → 회전 샘플 1회 1테이블 · heap 200MB 이하만 · 로컬 타임아웃 25초 · 실패해도 나머지는 남긴다.
--     (`20260831130000_quality_drift_rotating_sample` 와 같은 패턴)
--   · 나머지 축은 전부 카탈로그·통계뷰 조회라 상수 시간.
--
-- ⚠️ 통계 뷰의 함정 (이 마이그레이션이 감시 대상으로 삼는 이유):
--   `pg_stat_user_tables.n_live_tup` 는 `library_book_vocabularies` 를 **0행**으로 보고하지만
--   `pgstattuple_approx` 실측은 **1,669,433행 · dead 3.6%** 다. 카운터가 낡은 것이지
--   테이블이 빈 게 아니다. 이 괴리를 `stats_stale_tables` 로 상시 센다 —
--   낡은 통계는 플래너 오판 → statement timeout 으로 이어지고, 실제로 이어졌다.

create table if not exists db_health_metrics (
  id bigint generated always as identity primary key,
  measured_at timestamptz not null default now(),
  axis text not null check (axis in ('capacity','cron','latency','connections','advisor','integrity')),
  metric text not null,
  value numeric not null,
  dims jsonb not null default '{}'::jsonb
);

comment on table db_health_metrics is
  'DB 인프라 헬스 스냅샷 — collect_db_health_metrics()(일 1회) 와 collect_db_health_integrity()(주 1회) 가 INSERT. 판정은 하지 않는다(임계값 없음). 읽기는 admin 전용.';

create index if not exists db_health_metrics_metric_time_idx
  on db_health_metrics (metric, measured_at desc);
create index if not exists db_health_metrics_axis_time_idx
  on db_health_metrics (axis, measured_at desc);
-- 테이블별 증가 추세를 뽑을 때 쓴다(용량 관리의 핵심 질의) — dims->>'table' 로 시계열을 자른다.
create index if not exists db_health_metrics_table_trend_idx
  on db_health_metrics (metric, (dims->>'table'), measured_at desc);

alter table db_health_metrics enable row level security;

drop policy if exists db_health_metrics_admin_read on db_health_metrics;
create policy db_health_metrics_admin_read on db_health_metrics
  for select to authenticated
  using (exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'admin'
  ));
-- INSERT/UPDATE/DELETE 정책 없음 — 쓰기는 SECURITY DEFINER collector 만.

create or replace function collect_db_health_metrics()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_now timestamptz := now();
  v_rows integer := 0;
  v_relid oid;
  v_relname text;
  v_heap bigint;
begin
  ------------------------------------------------------------------
  -- ① capacity — DB 총량
  ------------------------------------------------------------------
  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  select v_now, 'capacity', 'db_size_mb',
         round(pg_database_size(current_database()) / 1048576.0, 1),
         jsonb_build_object(
           'heap_mb', round(coalesce(s.heap, 0) / 1048576.0, 1),
           'index_mb', round(coalesce(s.idx, 0) / 1048576.0, 1),
           'toast_mb', round(coalesce(s.toast, 0) / 1048576.0, 1),
           'public_tables', s.n
         )
  from (
    select sum(pg_relation_size(c.oid)) as heap,
           sum(pg_indexes_size(c.oid)) as idx,
           sum(coalesce(pg_total_relation_size(c.reltoastrelid), 0)) as toast,
           count(*) as n
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  ) s;

  ------------------------------------------------------------------
  -- ① capacity — 테이블별 상위 25. 이력이 쌓이면 "어느 표가 얼마나 빨리 크는가" 가 나온다.
  ------------------------------------------------------------------
  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  select v_now, 'capacity', 'table_size_mb',
         round(pg_total_relation_size(c.oid) / 1048576.0, 1),
         jsonb_build_object(
           'table', c.relname,
           'heap_mb', round(pg_relation_size(c.oid) / 1048576.0, 1),
           'index_mb', round(pg_indexes_size(c.oid) / 1048576.0, 1),
           'rows_est', c.reltuples::bigint
         )
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  order by pg_total_relation_size(c.oid) desc
  limit 25;

  ------------------------------------------------------------------
  -- ① capacity — 통계 신선도. 낡은 통계는 조용히 플래너를 망가뜨린다.
  --   기준 8MB 이상 테이블 중 (analyze 이력이 아예 없음) 또는
  --   (n_live_tup 과 reltuples 가 50% 넘게 어긋남) — 둘 다 "카운터를 믿지 말라"는 신호.
  ------------------------------------------------------------------
  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  select v_now, 'capacity', 'stats_stale_tables', count(*),
         jsonb_build_object(
           'checked', (select count(*) from pg_stat_user_tables s2
                       where pg_total_relation_size(s2.relid) > 8388608),
           'tables', coalesce(jsonb_agg(jsonb_build_object(
                       'table', x.relname,
                       'total_mb', round(x.total_bytes / 1048576.0, 1),
                       'n_live_tup', x.n_live_tup,
                       'reltuples', x.reltuples,
                       'never_analyzed', x.never_analyzed
                     ) order by x.total_bytes desc), '[]'::jsonb)
         )
  from (
    select s.relname,
           pg_total_relation_size(s.relid) as total_bytes,
           coalesce(s.n_live_tup, 0) as n_live_tup,
           c.reltuples::bigint as reltuples,
           (s.last_analyze is null and s.last_autoanalyze is null) as never_analyzed
    from pg_stat_user_tables s
    join pg_class c on c.oid = s.relid
    where pg_total_relation_size(s.relid) > 8388608
      and (
        (s.last_analyze is null and s.last_autoanalyze is null)
        or abs(coalesce(s.n_live_tup, 0) - c.reltuples) > greatest(c.reltuples * 0.5, 10000)
      )
  ) x;

  ------------------------------------------------------------------
  -- ② cron — 24시간 실패 + 잡별 마지막 성공 경과
  ------------------------------------------------------------------
  begin
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'cron', 'cron_fail_24h',
           count(*) filter (where d.status <> 'succeeded'),
           jsonb_build_object(
             'runs', count(*),
             'fail_pct', coalesce(round(100.0 * count(*) filter (where d.status <> 'succeeded')
                                        / nullif(count(*), 0), 2), 0),
             'by_job', coalesce((
               select jsonb_object_agg(y.jobname, jsonb_build_object('fails', y.f, 'sample', y.msg))
               from (
                 select coalesce(j.jobname, d2.jobid::text) as jobname,
                        count(*) as f,
                        left(max(coalesce(d2.return_message, '')), 160) as msg
                 from cron.job_run_details d2
                 left join cron.job j on j.jobid = d2.jobid
                 where d2.start_time > v_now - interval '24 hours'
                   and d2.status <> 'succeeded'
                 group by 1
               ) y
             ), '{}'::jsonb)
           )
    from cron.job_run_details d
    where d.start_time > v_now - interval '24 hours';

    with jobs as (
      select coalesce(j.jobname, j.jobid::text) as jobname, j.schedule, j.active,
             (select max(d.start_time) from cron.job_run_details d
              where d.jobid = j.jobid and d.status = 'succeeded') as last_ok
      from cron.job j
    ), calc as (
      select jobname, schedule, active,
             case when last_ok is null then null
                  else round((extract(epoch from (v_now - last_ok)) / 3600)::numeric, 2) end as h
      from jobs
    )
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'cron', 'cron_stale_max_hours',
           coalesce(max(h) filter (where active), 0),
           jsonb_build_object(
             'jobs', coalesce(jsonb_object_agg(jobname, jsonb_build_object(
                       'schedule', schedule, 'active', active, 'hours_since_ok', h)), '{}'::jsonb),
             'never_succeeded', count(*) filter (where h is null and active),
             'inactive', count(*) filter (where not active)
           )
    from calc;
  exception when others then
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'cron', 'cron_read_failed', 1,
            jsonb_build_object('error', left(sqlerrm, 300)));
  end;

  ------------------------------------------------------------------
  -- ③ latency — pg_stat_statements. statement_timeout 은 120초이므로
  --   평균이 그 근처면 야간 배치가 죽는다(실제로 죽었다).
  ------------------------------------------------------------------
  begin
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'latency', 'slow_stmt_count',
           count(*) filter (where s.mean_exec_time > 5000),
           jsonb_build_object(
             'tracked', count(*),
             'max_mean_ms', coalesce(round(max(s.mean_exec_time)::numeric, 1), 0),
             'near_timeout', count(*) filter (where s.mean_exec_time > 60000),
             'timeout_budget_ms', current_setting('statement_timeout', true),
             'top', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'q', left(regexp_replace(t.query, '\s+', ' ', 'g'), 160),
                        'calls', t.calls,
                        'mean_ms', round(t.mean_exec_time::numeric, 1),
                        'total_min', round((t.total_exec_time / 60000.0)::numeric, 2)))
               from (
                 select query, calls, mean_exec_time, total_exec_time
                 from extensions.pg_stat_statements
                 order by mean_exec_time desc
                 limit 5
               ) t), '[]'::jsonb)
           )
    from extensions.pg_stat_statements s;
  exception when others then
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'latency', 'latency_read_failed', 1,
            jsonb_build_object('error', left(sqlerrm, 300)));
  end;

  ------------------------------------------------------------------
  -- ④ connections
  ------------------------------------------------------------------
  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  select v_now, 'connections', 'conn_used_pct',
         round(100.0 * count(*) / nullif(current_setting('max_connections')::int, 0), 1),
         jsonb_build_object(
           'total', count(*),
           'max', current_setting('max_connections')::int,
           'active', count(*) filter (where a.state = 'active'),
           'idle', count(*) filter (where a.state = 'idle'),
           'idle_in_tx', count(*) filter (where a.state = 'idle in transaction'),
           'longest_active_sec', coalesce(round((max(extract(epoch from (v_now - a.query_start)))
                                   filter (where a.state = 'active'))::numeric, 0), 0),
           'by_app', coalesce((
             select jsonb_object_agg(b.app, b.n)
             from (
               select coalesce(nullif(a2.application_name, ''), '(none)') as app, count(*) as n
               from pg_stat_activity a2 group by 1
             ) b), '{}'::jsonb)
         )
  from pg_stat_activity a;

  ------------------------------------------------------------------
  -- ⑤ advisor — 접근 안전. Supabase advisor API 는 DB 밖이라 야간 배치가 못 부른다.
  --   그래서 같은 판정을 카탈로그로 재구현한다(에이전트가 주 1회 실제 API 와 대조).
  ------------------------------------------------------------------
  begin
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'advisor', 'anon_exposed_tables', count(*),
           jsonb_build_object(
             'without_rls', count(*) filter (where not c.relrowsecurity),
             'tables', coalesce(jsonb_agg(c.relname order by c.relname)
                                filter (where not c.relrowsecurity), '[]'::jsonb)
           )
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'SELECT');

    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'advisor', 'rls_missing_tables', count(*),
           jsonb_build_object(
             'rls_off', count(*) filter (where not c.relrowsecurity),
             'no_policy', count(*) filter (where c.relrowsecurity),
             'tables', coalesce(jsonb_agg(jsonb_build_object(
                         'table', c.relname,
                         'reason', case when not c.relrowsecurity then 'rls_off' else 'no_policy' end
                       ) order by c.relname), '[]'::jsonb)
           )
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and (not c.relrowsecurity
           or not exists (select 1 from pg_policy p where p.polrelid = c.oid));

    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'advisor', 'exposed_secdef_funcs', count(*),
           jsonb_build_object(
             'anon', count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE')),
             'authenticated', count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE')),
             'anon_funcs', coalesce(jsonb_agg(p.proname order by p.proname)
                                    filter (where has_function_privilege('anon', p.oid, 'EXECUTE')), '[]'::jsonb)
           )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (has_function_privilege('anon', p.oid, 'EXECUTE')
           or has_function_privilege('authenticated', p.oid, 'EXECUTE'));

    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'advisor', 'mutable_search_path_funcs', count(*),
           jsonb_build_object(
             'funcs', coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
           )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        where cfg like 'search\_path=%'
      );
  exception when others then
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'advisor', 'advisor_read_failed', 1,
            jsonb_build_object('error', left(sqlerrm, 300)));
  end;

  ------------------------------------------------------------------
  -- ① capacity — 회전 블로트 표본. **맨 마지막**에 둔다: 로컬 타임아웃을 낮추므로
  --   앞 축들이 그 값에 걸리지 않게 하고, 실패해도 이미 적힌 행은 남는다.
  ------------------------------------------------------------------
  begin
    select c.oid, c.relname, pg_relation_size(c.oid)
      into v_relid, v_relname, v_heap
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind = 'r'
      and pg_relation_size(c.oid) between 1048576 and 209715200
    order by coalesce((
               select max(m.measured_at) from db_health_metrics m
               where m.metric = 'bloat_sampled_pct' and m.dims->>'table' = c.relname
             ), 'epoch'::timestamptz) asc,
             pg_relation_size(c.oid) desc
    limit 1;

    if v_relid is not null then
      set local statement_timeout = '25s';
      insert into db_health_metrics (measured_at, axis, metric, value, dims)
      select v_now, 'capacity', 'bloat_sampled_pct',
             round(a.dead_tuple_percent::numeric, 2),
             jsonb_build_object(
               'table', v_relname,
               'heap_mb', round(v_heap / 1048576.0, 1),
               'free_pct', round(a.approx_free_percent::numeric, 2),
               'reclaimable_mb', round((a.approx_free_space + a.dead_tuple_len) / 1048576.0, 1),
               'live_rows', a.approx_tuple_count::bigint,
               'scanned_pct', round(a.scanned_percent::numeric, 1)
             )
      from pgstattuple_approx(v_relid) a;
    end if;
  exception when others then
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'capacity', 'bloat_sample_failed', 1,
            jsonb_build_object('table', coalesce(v_relname, '?'), 'error', left(sqlerrm, 300)));
  end;

  ------------------------------------------------------------------
  -- 보존 180일. 스냅샷 자체가 용량 문제가 되면 본말전도다.
  ------------------------------------------------------------------
  delete from db_health_metrics where measured_at < v_now - interval '180 days';

  select count(*)::int into v_rows from db_health_metrics where measured_at = v_now;
  return v_rows;
end $function$;

comment on function collect_db_health_metrics() is
  'DB 헬스 5축(capacity·cron·latency·connections·advisor) 일 1회 수집 → db_health_metrics INSERT. 판정 없음. 반환 = 이번 실행 INSERT 행 수.';

revoke execute on function collect_db_health_metrics() from public, anon, authenticated;

-- admin 이 화면에서 "지금 수집" 을 누를 때 쓰는 wrapper (admin_collect_quality_metrics 와 같은 형태).
create or replace function admin_collect_db_health_metrics()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v integer;
begin
  if not exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  select collect_db_health_metrics() into v;
  return v;
end $function$;

comment on function admin_collect_db_health_metrics() is
  'admin 검사 후 collect_db_health_metrics() 실행. /admin/db 의 "지금 수집" 버튼.';

revoke execute on function admin_collect_db_health_metrics() from public, anon;
grant execute on function admin_collect_db_health_metrics() to authenticated;

-- pg_cron 등록은 **별도 실행**한다(마이그레이션에 넣으면 브랜치/복원 때 중복 등록된다):
-- ✅ 2026-09-06 등록 완료 · jobid=15:
--   select cron.schedule('db-health-daily', '40 18 * * *',
--     $cron$select collect_db_health_metrics()$cron$);
--   -- KST 03:40. quality-metrics(18:10)·content-gate(18:25) 뒤에 둬서 겹치지 않게 한다.
