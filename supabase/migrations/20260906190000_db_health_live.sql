-- supabase/migrations/20260906190000_db_health_live.sql
--
-- /admin/db 라이브 계기판 — **지금**을 읽는 유일한 경로.
--
-- 왜 필요한가: db_health_metrics 는 일 1회 스냅샷이다. 그건 "어제 어땠나" 에 답하지
-- "지금 무슨 일이 벌어지고 있나" 에는 답하지 못한다. 이 저장소의 실제 장애 두 건
-- (2026-09-06 08:06 UTC 55분 전면 정지 · 09-05 단건 PATCH 폭주)은 둘 다 스냅샷 사이에서
-- 시작돼 스냅샷 사이에서 끝났다 — 화면은 그때 아무것도 보여 주지 못했다.
--
-- 비용: 전부 카탈로그 뷰 읽기(pg_stat_activity · pg_locks · pg_stat_database · cron.job_run_details).
-- 테이블 스캔이 없다. 15초 폴링 화면 하나가 붙어도 읽기 부하는 무시할 수준이다
-- (직전 장애 원인이 "읽기 포화" 였으므로 못 박아 둔다 — 여기에 집계 쿼리를 더하고 싶어지면
--  스냅샷 수집기로 보낼 것).
--
-- 반환은 jsonb 한 덩어리다. 열 여섯 개짜리 composite 을 만들면 지표를 하나 더할 때마다
-- 마이그레이션이 필요해지고, 그러면 화면이 먼저 굶는다.
--
-- 본체와 admin 검사를 가른 이유: 본체(db_health_live_snapshot)는 실행 권한을 전부 회수해
-- 막고, 화면은 wrapper 만 부른다. 이렇게 갈라야 본체를 실 DB 에서 그대로 검증할 수 있다.
--
-- ⚠️ cron.job_run_details 에는 **jobname 컬럼이 없다**(jobid 만). 첫 정의는 그 컬럼을 읽어
--    호출 즉시 42703 으로 죽었다 — 잡 이름은 cron.job 을 jobid 로 조인해서 얻는다.

create or replace function public.db_health_live_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_max_conn      int;
  v_total         int;
  v_active        int;
  v_idle          int;
  v_idle_tx       int;
  v_waiting       int;
  v_cache_pct     numeric;
  v_db_mb         numeric;
  v_blocked       int;
  v_longest_s     numeric;
  v_longest_tx_s  numeric;
  v_oldest_idle_s numeric;
  v_cron_fail     int;
  v_cron_running  int;
  v_deadlocks     bigint;
  v_rollbacks     bigint;
  v_sessions      jsonb;
  v_blockers      jsonb;
  v_cron_recent   jsonb;
begin
  select setting::int into v_max_conn from pg_settings where name = 'max_connections';

  select count(*),
         count(*) filter (where state = 'active'),
         count(*) filter (where state = 'idle'),
         count(*) filter (where state = 'idle in transaction'),
         count(*) filter (where state = 'active' and wait_event_type is not null),
         coalesce(max(extract(epoch from (now() - query_start))) filter (where state = 'active'), 0),
         coalesce(max(extract(epoch from (now() - xact_start))) filter (where xact_start is not null), 0),
         coalesce(max(extract(epoch from (now() - state_change))) filter (where state = 'idle in transaction'), 0)
    into v_total, v_active, v_idle, v_idle_tx, v_waiting, v_longest_s, v_longest_tx_s, v_oldest_idle_s
    from pg_stat_activity
   where backend_type = 'client backend';

  select round(100.0 * sum(blks_hit) / nullif(sum(blks_hit + blks_read), 0), 1),
         coalesce(sum(deadlocks), 0),
         coalesce(sum(xact_rollback), 0)
    into v_cache_pct, v_deadlocks, v_rollbacks
    from pg_stat_database;

  v_db_mb := round(pg_database_size(current_database()) / 1048576.0, 1);

  select count(*) into v_blocked from pg_locks where not granted;

  -- 지금 도는 세션 상위 12 — 쿼리 본문은 200자에서 자른다(화면이 못 읽는 길이는 증거가 아니다).
  select coalesce(jsonb_agg(s order by (s->>'dur_s')::numeric desc), '[]'::jsonb) into v_sessions
    from (
      select jsonb_build_object(
               'pid', pid,
               'state', state,
               'wait', coalesce(wait_event_type || ':' || wait_event, ''),
               'dur_s', round(extract(epoch from (now() - coalesce(query_start, xact_start, state_change)))::numeric, 1),
               'app', coalesce(application_name, ''),
               'usename', coalesce(usename::text, ''),
               'query', left(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g'), 200)
             ) as s
        from pg_stat_activity
       where backend_type = 'client backend'
         and pid <> pg_backend_pid()
         and state is distinct from 'idle'
       order by coalesce(query_start, xact_start, state_change) asc
       limit 12
    ) t;

  -- 잠금 대기 — 누가 누구를 막고 있는가. 없으면 빈 배열이지 null 이 아니다.
  select coalesce(jsonb_agg(jsonb_build_object(
           'blocked_pid', a.pid,
           'blocking_pid', bp,
           'dur_s', round(extract(epoch from (now() - a.query_start))::numeric, 1),
           'query', left(regexp_replace(coalesce(a.query, ''), '\s+', ' ', 'g'), 160)
         )), '[]'::jsonb) into v_blockers
    from pg_stat_activity a
    cross join lateral unnest(pg_blocking_pids(a.pid)) as bp
   where cardinality(pg_blocking_pids(a.pid)) > 0;

  select count(*) filter (where status = 'failed' and start_time > now() - interval '24 hours'),
         count(*) filter (where status = 'running')
    into v_cron_fail, v_cron_running
    from cron.job_run_details;

  select coalesce(jsonb_agg(r order by (r->>'at') desc), '[]'::jsonb) into v_cron_recent
    from (
      select jsonb_build_object(
               'job', coalesce(j.jobname, d.jobid::text),
               'status', d.status,
               'at', d.start_time,
               'dur_s', round(extract(epoch from (coalesce(d.end_time, now()) - d.start_time))::numeric, 1),
               'msg', left(coalesce(d.return_message, ''), 160),
               'active', j.active
             ) as r
        from cron.job_run_details d
        left join cron.job j on j.jobid = d.jobid
       where d.start_time > now() - interval '24 hours'
         and d.status <> 'succeeded'
       order by d.start_time desc
       limit 10
    ) t;

  return jsonb_build_object(
    'at', now(),
    'conn', jsonb_build_object('max', v_max_conn, 'total', v_total, 'active', v_active,
      'idle', v_idle, 'idle_in_tx', v_idle_tx, 'waiting', v_waiting,
      'used_pct', round(100.0 * v_total / nullif(v_max_conn, 0), 1)),
    'cache_hit_pct', v_cache_pct,
    'db_size_mb', v_db_mb,
    'blocked_locks', v_blocked,
    'longest_query_s', round(v_longest_s::numeric, 1),
    'longest_xact_s', round(v_longest_tx_s::numeric, 1),
    'oldest_idle_in_tx_s', round(v_oldest_idle_s::numeric, 1),
    'deadlocks', v_deadlocks,
    'rollbacks', v_rollbacks,
    'cron_fail_24h', v_cron_fail,
    'cron_running', v_cron_running,
    'sessions', v_sessions,
    'blockers', v_blockers,
    'cron_recent', v_cron_recent
  );
end $function$;

comment on function public.db_health_live_snapshot() is
  '지금 시점 DB 계기판(권한 검사 없음 — 실행 권한 자체를 좁혀서 막는다). 카탈로그 뷰만 읽는다.';

revoke execute on function public.db_health_live_snapshot() from public, anon, authenticated;

-- 화면이 부르는 wrapper. admin 검사만 하고 위 함수를 그대로 돌려준다.
create or replace function public.admin_db_health_live()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  return db_health_live_snapshot();
end $function$;

comment on function public.admin_db_health_live() is
  '/admin/db 라이브 계기판 — admin 검사 후 db_health_live_snapshot() 반환. 쓰기 없음.';

revoke execute on function public.admin_db_health_live() from public, anon;
grant execute on function public.admin_db_health_live() to authenticated;
