-- supabase/migrations/20260906190500_db_health_actions.sql
--
-- /admin/db 조치층 — 화면이 **실제로 실행하는** 것과 실행하지 않는 것을 가른다.
--
-- 지금까지 이 화면은 조치 SQL 을 보여 주기만 했다. 그 선택은 VACUUM FULL·DROP INDEX 같은
-- 되돌릴 수 없는 조작을 막기 위한 것이었고 그건 여전히 옳다. 하지만 장애 대응에는
-- **초 단위로 눌러야 하는 조치**가 따로 있다 — 폭주하는 잡을 끄고, 걸려 있는 세션을 끊고,
-- 통계를 다시 뜨는 일이다. 그걸 "SQL 을 복사해 다른 도구에서 붙여 넣으세요" 로 만들면
-- 장애 시간이 그만큼 길어진다.
--
-- 3단으로 가른다:
--   safe    — 즉시 실행. 되돌릴 것이 없다(ANALYZE · 낡은 통계 일괄 · 쿼리 취소 · 잡 재개).
--   guarded — 실행하되 **사유 문자열을 반드시 받는다**(세션 강제 종료 · idle-in-tx 일괄 종료 · 잡 정지).
--   manual  — 이 함수가 절대 실행하지 않는다. 화면은 SQL 만 보여 준다
--             (VACUUM FULL · DROP INDEX · ALTER SYSTEM · 마이그레이션).
--
-- 허용 목록은 **함수 본문에 박아 둔다.** 표로 빼면 표에 행을 하나 넣는 것으로 임의 SQL 실행이
-- 되고, 그 표에 쓸 수 있는 사람은 곧 DB 전체에 쓸 수 있는 사람이다.
--
-- ⚠️ 실패를 raise 로 올리면 **감사 로그가 함께 롤백된다.** PostgREST 는 오류 시 트랜잭션을
--    통째로 되돌리고 Postgres 에는 자율 트랜잭션이 없다. 실측(2026-09-06): 실패 5건을
--    일으켰더니 로그에 남은 것은 성공 1건뿐이었다. 그래서 실패는 예외가 아니라 **결과값**
--    (`ok=false`)으로 돌려준다. 화면이 그것을 오류로 그린다.

create table if not exists db_health_action_log (
  id bigint generated always as identity primary key,
  action text not null,
  tier text not null check (tier in ('safe', 'guarded')),
  target text,
  reason text,
  actor uuid,
  finding_id bigint,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  result text,
  error text
);

comment on table db_health_action_log is
  '/admin/db 에서 사람이 실행한 조치의 감사 기록. 성공·실패 모두 남는다. 쓰기는 db_health_run_action() 만.';

create index if not exists db_health_action_log_recent_idx
  on db_health_action_log (started_at desc);

alter table db_health_action_log enable row level security;

drop policy if exists db_health_action_log_admin_read on db_health_action_log;
create policy db_health_action_log_admin_read on db_health_action_log
  for select to authenticated
  using (exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'admin'
  ));
-- 쓰기 정책 없음 — SECURITY DEFINER RPC 로만 쓴다.

-- ── 조치 본체 (권한 검사 없음 — 실행 권한 자체를 회수해 막는다) ──────────
create or replace function public.db_health_run_action(
  p_action text,
  p_target text default null,
  p_reason text default null,
  p_finding_id bigint default null,
  p_actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tier   text;
  v_log_id bigint;
  v_result text;
  v_pid    int;
  v_reg    regclass;
  v_job_id bigint;
  v_n      int := 0;
  v_row    record;
begin
  v_tier := case p_action
    when 'analyze_table'        then 'safe'
    when 'analyze_stale_tables' then 'safe'
    when 'cancel_query'         then 'safe'
    when 'cron_enable_job'      then 'safe'
    when 'terminate_backend'    then 'guarded'
    when 'terminate_idle_in_tx' then 'guarded'
    when 'cron_disable_job'     then 'guarded'
    else null
  end;

  -- 허용 목록 밖은 로그도 남기지 않고 즉시 거절한다 — 실행 시도 자체가 없다.
  if v_tier is null then
    return jsonb_build_object('ok', false, 'log_id', null,
      'error', format('허용 목록에 없는 조치: %s', p_action));
  end if;

  if v_tier = 'guarded' and coalesce(length(btrim(p_reason)), 0) < 5 then
    return jsonb_build_object('ok', false, 'log_id', null, 'tier', v_tier,
      'error', '이 조치는 사유가 필요하다 (5자 이상)');
  end if;

  insert into db_health_action_log (action, tier, target, reason, actor, finding_id)
  values (p_action, v_tier, p_target, nullif(btrim(coalesce(p_reason, '')), ''), p_actor, p_finding_id)
  returning id into v_log_id;

  begin
    if p_action = 'analyze_table' then
      -- to_regclass 를 거치므로 존재하지 않는 이름은 여기서 죽는다 = SQL 주입 경로가 닫힌다.
      v_reg := to_regclass(p_target);
      if v_reg is null then
        raise exception '그런 표가 없다: %', p_target;
      end if;
      if not exists (
        select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where c.oid = v_reg and c.relkind in ('r', 'p') and n.nspname = 'public'
      ) then
        raise exception 'public 스키마의 일반 표만 ANALYZE 한다: %', p_target;
      end if;
      execute format('analyze %s', v_reg::text);
      v_result := format('ANALYZE %s', v_reg::text);

    elsif p_action = 'analyze_stale_tables' then
      -- 통계가 7일 넘게 낡았고 행이 1,000 이상인 표만. 상한 20 — 한 번에 DB 를 다 훑지 않는다.
      for v_row in
        select (quote_ident(schemaname) || '.' || quote_ident(relname)) as t
          from pg_stat_user_tables
         where schemaname = 'public'
           and n_live_tup > 1000
           and greatest(coalesce(last_analyze, 'epoch'::timestamptz),
                        coalesce(last_autoanalyze, 'epoch'::timestamptz)) < now() - interval '7 days'
         order by n_live_tup desc
         limit 20
      loop
        execute format('analyze %s', v_row.t);
        v_n := v_n + 1;
      end loop;
      v_result := format('ANALYZE %s개 표', v_n);

    elsif p_action in ('cancel_query', 'terminate_backend') then
      v_pid := p_target::int;
      if v_pid = pg_backend_pid() then
        raise exception '자기 자신은 끊지 않는다 (pid %)', v_pid;
      end if;
      if not exists (
        select 1 from pg_stat_activity where pid = v_pid and backend_type = 'client backend'
      ) then
        raise exception '그런 클라이언트 세션이 없다 (pid %) — 이미 끝났을 수 있다', v_pid;
      end if;
      if p_action = 'cancel_query' then
        perform pg_cancel_backend(v_pid);
        v_result := format('pg_cancel_backend(%s)', v_pid);
      else
        perform pg_terminate_backend(v_pid);
        v_result := format('pg_terminate_backend(%s)', v_pid);
      end if;

    elsif p_action = 'terminate_idle_in_tx' then
      -- 5분 넘게 트랜잭션을 열어 둔 채 노는 세션. 이것들이 VACUUM 을 막고 죽은 튜플을 쌓는다.
      select count(*) into v_n from (
        select pg_terminate_backend(pid)
          from pg_stat_activity
         where backend_type = 'client backend'
           and state = 'idle in transaction'
           and state_change < now() - interval '5 minutes'
           and pid <> pg_backend_pid()
      ) t;
      v_result := format('idle in transaction 5분 초과 %s개 종료', v_n);

    elsif p_action in ('cron_disable_job', 'cron_enable_job') then
      select jobid into v_job_id from cron.job where jobname = p_target;
      if v_job_id is null then
        raise exception '그런 cron 잡이 없다: %', p_target;
      end if;
      perform cron.alter_job(v_job_id, active := (p_action = 'cron_enable_job'));
      v_result := format('%s → active=%s', p_target, (p_action = 'cron_enable_job'));
    end if;

    update db_health_action_log
       set finished_at = now(), ok = true, result = v_result
     where id = v_log_id;

    return jsonb_build_object('ok', true, 'log_id', v_log_id, 'result', v_result, 'tier', v_tier);

  exception when others then
    -- 이 UPDATE 가 도는 시점에는 서브트랜잭션이 롤백된 뒤다. 로그 INSERT 는 그 밖이라 살아남는다.
    update db_health_action_log
       set finished_at = now(), ok = false, error = sqlerrm
     where id = v_log_id;
    return jsonb_build_object('ok', false, 'log_id', v_log_id, 'tier', v_tier, 'error', sqlerrm);
  end;
end $function$;

comment on function public.db_health_run_action(text, text, text, bigint, uuid) is
  '조치 본체. 허용 목록(safe 4 · guarded 3) 밖은 실행하지 않는다. 실패는 raise 가 아니라 ok=false 로 돌려준다 — raise 하면 감사 로그가 같이 롤백된다.';

revoke execute on function public.db_health_run_action(text, text, text, bigint, uuid)
  from public, anon, authenticated;

-- ── 화면이 부르는 wrapper ────────────────────────────────────────────────
create or replace function public.admin_run_db_health_action(
  p_action text,
  p_target text default null,
  p_reason text default null,
  p_finding_id bigint default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  return db_health_run_action(p_action, p_target, p_reason, p_finding_id, auth.uid());
end $function$;

comment on function public.admin_run_db_health_action(text, text, text, bigint) is
  '/admin/db 의 조치 실행. admin 검사 후 db_health_run_action() 위임. 모든 호출이 db_health_action_log 에 남는다.';

revoke execute on function public.admin_run_db_health_action(text, text, text, bigint) from public, anon;
grant execute on function public.admin_run_db_health_action(text, text, text, bigint) to authenticated;
