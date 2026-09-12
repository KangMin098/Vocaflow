-- supabase/migrations/20260906010500_db_health_integrity.sql
--
-- DB 헬스 6축 중 **⑥ integrity** — 주 1회 정밀. (일 1회 5축은 20260906010000)
--
-- 왜 별도 함수·별도 주기인가:
--   함수 368개를 전부 정적 분석하므로 일 1회 저비용 배치에 넣으면 그 배치가 무거워진다.
--   지금 야간 잡들이 죽는 이유가 정확히 "한 배치가 너무 많은 일을 한다" 이므로 같은 실수를 안 한다.
--
-- 무엇을 잡나 (2026-09-06 실측 근거):
--   · `cron.job` 이 없는 함수를 부르고 있었다 — jobid=1 이 `hot_dictionary` 를 참조해
--     매일 실패하다가 2026-08-31 에야 unschedule 됐다. 이런 건 실행되기 전엔 안 보인다.
--   · CLAUDE.md 가 "없는 테이블을 읽는 RPC" 를 상시 결함으로 적어 두고 **문서가 아니라
--     `to_regclass` 로 확인하라**고 못박았다. 그 확인을 사람이 기억하는 대신 배치가 한다.
--   · 30일간 마이그레이션 184건. 이 속도에서 FK 인덱스 누락·INVALID 인덱스는 반드시 생긴다.
--
-- 왜 정규식이 아니라 plpgsql_check 인가 (실측):
--   함수 본문을 `from|join|into` 정규식으로 훑어 `to_regclass` 로 확인해 봤더니
--   **CTE 이름이 전부 "없는 테이블" 로 잡혔다** — `set`(15개 함수) · `cand`(8) · `joined`(6) ·
--   `scored`(5) · `ranked`(4) … 상위 30개가 사실상 전부 오탐이었다.
--   CLAUDE.md 가 경고하는 바로 그 함정(「규칙이 틀렸지 코드가 틀린 게 아니다」)이라
--   목적 도구인 `plpgsql_check` 를 쓴다. 없으면 축을 **비우고 그렇다고 적는다** —
--   0 으로 적으면 "문제 없음" 으로 읽혀 구멍이 영영 남는다.

create extension if not exists plpgsql_check with schema extensions;

create or replace function collect_db_health_integrity()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_now timestamptz := now();
  v_rows integer := 0;
  v_available boolean;
  r record;
  c record;
  v_findings jsonb := '[]'::jsonb;
  v_checked integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
begin
  ------------------------------------------------------------------
  -- ⑥ integrity — 함수가 없는 릴레이션·컬럼을 참조하는가 (plpgsql_check)
  ------------------------------------------------------------------
  v_available := exists (select 1 from pg_extension where extname = 'plpgsql_check');

  if not v_available then
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'integrity', 'function_check_unavailable', 1,
            jsonb_build_object('reason', 'plpgsql_check extension not installed',
                               'note', '이 축은 측정되지 않았다 — 0 이 아니라 미측정이다'));
  else
    for r in
      select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
        and p.prorettype <> 'trigger'::regtype   -- 트리거 함수는 relid 없이는 검사 불가
      order by p.proname
    loop
      begin
        v_checked := v_checked + 1;
        for c in
          select * from extensions.plpgsql_check_function_tb(
            funcoid => r.oid::regprocedure,
            fatal_errors => false,
            without_warnings => true
          )
        loop
          if c.level = 'error' then
            v_errors := v_errors + 1;
            v_findings := v_findings || jsonb_build_object(
              'function', r.proname,
              'args', r.args,
              'lineno', c.lineno,
              'sqlstate', c.sqlstate,
              'message', left(coalesce(c.message, ''), 200),
              'statement', left(coalesce(c.statement, ''), 120)
            );
          end if;
        end loop;
      exception when others then
        -- 검사 자체가 실패한 함수(다형 인자·record 파라미터 등)는 "문제 없음" 이 아니다.
        v_skipped := v_skipped + 1;
      end;
    end loop;

    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'integrity', 'function_errors', v_errors,
            jsonb_build_object(
              'checked', v_checked,
              'skipped', v_skipped,
              'undefined_table', (select count(*) from jsonb_array_elements(v_findings) e
                                  where e->>'sqlstate' = '42P01'),
              'undefined_column', (select count(*) from jsonb_array_elements(v_findings) e
                                   where e->>'sqlstate' = '42703'),
              'findings', case when jsonb_array_length(v_findings) > 60
                               then (select jsonb_agg(e) from (
                                      select e from jsonb_array_elements(v_findings) e limit 60) s)
                               else v_findings end,
              'truncated', jsonb_array_length(v_findings) > 60
            ));
  end if;

  ------------------------------------------------------------------
  -- ⑥ integrity — cron 이 부르는 함수가 아직 존재하는가.
  --   jobid=1 이 없는 테이블을 읽다 매일 실패한 사고의 재발 방지.
  ------------------------------------------------------------------
  begin
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'integrity', 'cron_broken_commands', count(*) filter (where x.missing),
           jsonb_build_object(
             'jobs', count(*),
             'broken', coalesce(jsonb_agg(jsonb_build_object(
                         'job', x.jobname, 'command', left(x.command, 160))
                       ) filter (where x.missing), '[]'::jsonb)
           )
    from (
      select coalesce(j.jobname, j.jobid::text) as jobname,
             j.command,
             -- `select fn(...)` 형태만 판정한다. 그 외(DELETE 등)는 판정하지 않는다.
             case
               when j.command ~* '^\s*select\s+[a-z_][a-z0-9_]*\s*\('
               then to_regproc(lower((regexp_match(j.command, '^\s*select\s+([a-z_][a-z0-9_]*)\s*\(', 'i'))[1])) is null
               else false
             end as missing
      from cron.job j
      where j.active
    ) x;
  exception when others then
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'integrity', 'cron_command_check_failed', 1,
            jsonb_build_object('error', left(sqlerrm, 300)));
  end;

  ------------------------------------------------------------------
  -- ⑥ integrity — 스키마가 매일 바뀌는 저장소에서 반드시 생기는 것들
  ------------------------------------------------------------------
  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  select v_now, 'integrity', 'unindexed_fk', count(*),
         jsonb_build_object('fks', coalesce(jsonb_agg(jsonb_build_object(
           'table', x.tbl, 'constraint', x.conname, 'columns', x.cols) order by x.tbl), '[]'::jsonb))
  from (
    select con.conrelid::regclass::text as tbl,
           con.conname,
           (select array_agg(a.attname order by k.ord)
            from unnest(con.conkey) with ordinality k(attnum, ord)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as cols
    from pg_constraint con
    where con.contype = 'f'
      and con.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = con.conrelid
          and (i.indkey::smallint[])[0:array_length(con.conkey, 1) - 1] = con.conkey
      )
  ) x;

  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  select v_now, 'integrity', 'invalid_objects', count(*),
         jsonb_build_object('objects', coalesce(jsonb_agg(jsonb_build_object(
           'kind', x.kind, 'name', x.name) order by x.name), '[]'::jsonb))
  from (
    select 'index' as kind, ic.relname::text as name
    from pg_index i join pg_class ic on ic.oid = i.indexrelid
    where ic.relnamespace = 'public'::regnamespace and not i.indisvalid
    union all
    select 'constraint', con.conname::text
    from pg_constraint con
    where con.connamespace = 'public'::regnamespace and not con.convalidated
  ) x;

  select count(*)::int into v_rows from db_health_metrics
  where measured_at = v_now and axis = 'integrity';
  return v_rows;
end $function$;

comment on function collect_db_health_integrity() is
  'DB 헬스 ⑥ integrity 주 1회 수집(함수 정적 분석·cron 명령 유효성·FK 인덱스·INVALID 객체) → db_health_metrics INSERT. 판정 없음.';

revoke execute on function collect_db_health_integrity() from public, anon, authenticated;

create or replace function admin_collect_db_health_integrity()
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
  select collect_db_health_integrity() into v;
  return v;
end $function$;

comment on function admin_collect_db_health_integrity() is
  'admin 검사 후 collect_db_health_integrity() 실행. /admin/db 의 "정밀 점검" 버튼.';

revoke execute on function admin_collect_db_health_integrity() from public, anon;
grant execute on function admin_collect_db_health_integrity() to authenticated;

-- pg_cron 등록은 별도 실행:
-- ✅ 2026-09-06 등록 완료 · jobid=16:
--   select cron.schedule('db-health-integrity-weekly', '50 18 * * 0',
--     $cron$select collect_db_health_integrity()$cron$);
--   -- 일요일 KST 03:50.
