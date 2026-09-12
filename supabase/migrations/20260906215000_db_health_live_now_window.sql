-- supabase/migrations/20260906215000_db_health_live_now_window.sql
--
-- 「지금」 계기판이 **과거를 지금으로 말하고 있었다.**
--
-- 실측 2026-09-06 12:40 UTC — 화면이 「장애」를 띄웠는데 근거 두 개가 모두 지난 일이었다:
--
--   ① 예약 실패 61 → 그중 **60건이 10:21 UTC 재시작 이전**이다. 재시작 후 2시간 20분 동안
--      성공 142 · 실패 1(11:51). 최근 1시간 실패 1건. 24시간 누적치를 「지금」 타일에 놓으면
--      아홉 시간 전에 끝난 사건이 오늘 내내 빨간 불로 남는다.
--   ② 캐시 적중 92.8% → `pg_stat_database` 는 **재시작 이후 누적**이다. 캐시가 빈 채로 시작한
--      2시간짜리 평균이라 낮은 것이 정상이고, 실제로 92.8 → 93.1 로 오르는 중이었다.
--      누적 평균은 「지금」이 아니다.
--
-- 그래서 두 가지를 더 돌려준다:
--   · `cron_fail_1h` — 판정은 이 창에서 한다. 24시간치는 맥락으로만 남긴다.
--   · `blks_hit` · `blks_read` 원시 카운터 — 화면이 **폴링 사이의 증분**으로 순간 적중률을
--     계산한다. 그게 진짜 「지금」이고, 그러면 「가동 몇 시간부터 믿을 만한가」 같은
--     근거 없는 임계값을 지어낼 필요도 없다(샘플이 하나뿐인 첫 페인트에서는 「모름」).
--   · `uptime_h` — 낮은 누적 적중률이 워밍업인지 구조 문제인지 사람이 판단할 근거.
--
-- 나머지 키는 그대로다 — 화면 타입(`LiveSnapshot`)이 이 함수와 한 벌이라 키를 빼면 화면이 굶는다.

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
  v_blks_hit      bigint;
  v_blks_read     bigint;
  v_db_mb         numeric;
  v_blocked       int;
  v_longest_s     numeric;
  v_longest_tx_s  numeric;
  v_oldest_idle_s numeric;
  v_cron_fail     int;
  v_cron_fail_1h  int;
  v_cron_running  int;
  v_deadlocks     bigint;
  v_rollbacks     bigint;
  v_uptime_h      numeric;
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

  select coalesce(sum(blks_hit), 0),
         coalesce(sum(blks_read), 0),
         round(100.0 * sum(blks_hit) / nullif(sum(blks_hit + blks_read), 0), 1),
         coalesce(sum(deadlocks), 0),
         coalesce(sum(xact_rollback), 0)
    into v_blks_hit, v_blks_read, v_cache_pct, v_deadlocks, v_rollbacks
    from pg_stat_database;

  v_db_mb := round(pg_database_size(current_database()) / 1048576.0, 1);
  v_uptime_h := round((extract(epoch from (now() - pg_postmaster_start_time())) / 3600.0)::numeric, 1);

  select count(*) into v_blocked from pg_locks where not granted;

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
         count(*) filter (where status = 'failed' and start_time > now() - interval '1 hour'),
         count(*) filter (where status = 'running')
    into v_cron_fail, v_cron_fail_1h, v_cron_running
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
    'blks_hit', v_blks_hit,
    'blks_read', v_blks_read,
    'uptime_h', v_uptime_h,
    'db_size_mb', v_db_mb,
    'blocked_locks', v_blocked,
    'longest_query_s', round(v_longest_s::numeric, 1),
    'longest_xact_s', round(v_longest_tx_s::numeric, 1),
    'oldest_idle_in_tx_s', round(v_oldest_idle_s::numeric, 1),
    'deadlocks', v_deadlocks,
    'rollbacks', v_rollbacks,
    'cron_fail_24h', v_cron_fail,
    'cron_fail_1h', v_cron_fail_1h,
    'cron_running', v_cron_running,
    'sessions', v_sessions,
    'blockers', v_blockers,
    'cron_recent', v_cron_recent
  );
end $function$;

comment on function public.db_health_live_snapshot() is
  '지금 시점 DB 계기판(권한 검사 없음 — 실행 권한 자체를 좁혀서 막는다). 카탈로그 뷰만 읽는다. 판정 창은 cron_fail_1h 와 blks_* 증분이고, 24시간 누적치는 맥락으로만 돌려준다.';

revoke execute on function public.db_health_live_snapshot() from public, anon, authenticated;
