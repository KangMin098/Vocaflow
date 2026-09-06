-- supabase/migrations/20260906011000_db_health_advisor_fix.sql
--
-- `collect_db_health_metrics()` 수정 — Supabase advisor 실측과 대조해 나온 결함 2건 + 용량 지표 1건 추가.
--
-- 어떻게 찾았나: 수집기를 돌린 뒤 같은 항목을 Supabase advisor API 로 따로 재서 **숫자를 맞춰 봤다**.
--   지표가 "돌아간다" 와 "맞다" 는 다른 말이고, 감시 지표가 틀리면 감시하지 않는 것보다 나쁘다
--   (없으면 모른다는 걸 알지만, 틀리면 안다고 착각한다).
--
-- 결함 ① `mutable_search_path_funcs` 가 **0** 을 보고했다 — 실제 196.
--   `prosecdef` 로 걸러 SECURITY DEFINER 함수만 셌는데, 이 저장소의 SECURITY DEFINER 는
--   전부 `set search_path` 를 달고 있어서(0건) 조건에 걸리는 게 하나도 없었다.
--   advisor 는 API 로 노출된 함수 전체를 보므로 58건을 보고한다. 즉 **깨끗해서 0 이 아니라
--   엉뚱한 곳을 보고 있어서 0** 이었다. 필터를 없애고 secdef / API 노출 여부를 dims 로 쪼갠다.
--
-- 결함 ② `anon_exposed_tables` 가 110 인데 dims 의 목록은 비어 있었다.
--   값(110 = anon 이 SELECT 할 수 있는 표 전체)과 목록(RLS 없는 위험한 표)이 서로 다른 것을
--   세고 있었다. 읽는 사람은 "110개가 뚫렸다" 로 읽는다. 사실 두 개는 다른 지표다 —
--   **둘 다 적되 나누어 적는다**. 판정("110 이 위험한가")은 여전히 DB 밖의 몫이다.
--
-- 추가 `unused_index_bytes` — 한 번도 스캔되지 않은 인덱스의 총 용량.
--   30일간 마이그레이션 184건인 저장소에서 인덱스는 계속 늘고, 지운 기억은 아무도 못 한다.
--   전체 인덱스 1,622MB 중 얼마가 죽은 무게인지는 용량 관리의 직접적인 답이다.
--   ⚠️ `idx_scan = 0` 은 "필요 없다" 가 아니다 — 제약 보증용·저빈도 배치용일 수 있다.
--   그래서 여기서도 **판정하지 않고** 목록만 넘긴다.

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
  -- ① capacity — DB 총량
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

  -- ① capacity — 테이블별 상위 25 (이력이 쌓이면 증가 속도가 나온다)
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

  -- ① capacity — 통계 신선도
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

  -- ① capacity — 한 번도 안 쓰인 인덱스의 무게 (판정 아님 · 목록만)
  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  select v_now, 'capacity', 'unused_index_mb',
         round(coalesce(sum(x.bytes), 0) / 1048576.0, 1),
         jsonb_build_object(
           'count', count(*),
           'total_index_mb', (select round(coalesce(sum(pg_relation_size(i2.indexrelid)), 0) / 1048576.0, 1)
                              from pg_index i2 join pg_class ic2 on ic2.oid = i2.indexrelid
                              where ic2.relnamespace = 'public'::regnamespace),
           'indexes', coalesce(jsonb_agg(jsonb_build_object(
                        'index', x.idxname, 'table', x.tblname,
                        'mb', round(x.bytes / 1048576.0, 1))
                      order by x.bytes desc) filter (where x.bytes > 1048576), '[]'::jsonb)
         )
  from (
    select si.indexrelname as idxname, si.relname as tblname,
           pg_relation_size(si.indexrelid) as bytes
    from pg_stat_user_indexes si
    join pg_index i on i.indexrelid = si.indexrelid
    where si.schemaname = 'public'
      and si.idx_scan = 0
      and not i.indisprimary
      and not i.indisunique
  ) x;

  -- ② cron
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

  -- ③ latency
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

  -- ④ connections
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

  -- ⑤ advisor
  begin
    -- 결함② 수정 — 전체 노출 수와 RLS 없는 표를 **다른 지표로** 나눈다.
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'advisor', 'anon_exposed_tables', count(*),
           jsonb_build_object(
             'with_rls', count(*) filter (where c.relrowsecurity),
             'without_rls', count(*) filter (where not c.relrowsecurity)
           )
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'SELECT');

    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'advisor', 'anon_exposed_without_rls', count(*),
           jsonb_build_object('tables', coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb))
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      and has_table_privilege('anon', c.oid, 'SELECT')
      and not c.relrowsecurity;

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

    -- 결함① 수정 — prosecdef 필터 제거. advisor 와 같은 모수(공개 스키마 전체)를 본다.
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'advisor', 'mutable_search_path_funcs', count(*),
           jsonb_build_object(
             'secdef', count(*) filter (where p.prosecdef),
             'api_exposed', count(*) filter (
               where has_function_privilege('anon', p.oid, 'EXECUTE')
                  or has_function_privilege('authenticated', p.oid, 'EXECUTE')),
             'funcs', coalesce(jsonb_agg(p.proname order by p.proname) filter (
               where has_function_privilege('anon', p.oid, 'EXECUTE')
                  or has_function_privilege('authenticated', p.oid, 'EXECUTE')), '[]'::jsonb)
           )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
        where cfg like 'search\_path=%'
      );
  exception when others then
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'advisor', 'advisor_read_failed', 1,
            jsonb_build_object('error', left(sqlerrm, 300)));
  end;

  -- ① capacity — 회전 블로트 표본 (맨 마지막 · 로컬 타임아웃 25초)
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

  delete from db_health_metrics where measured_at < v_now - interval '180 days';

  select count(*)::int into v_rows from db_health_metrics where measured_at = v_now;
  return v_rows;
end $function$;

comment on function collect_db_health_metrics() is
  'DB 헬스 5축(capacity·cron·latency·connections·advisor) 일 1회 수집 → db_health_metrics INSERT. 판정 없음. 반환 = 이번 실행 INSERT 행 수.';

revoke execute on function collect_db_health_metrics() from public, anon, authenticated;
