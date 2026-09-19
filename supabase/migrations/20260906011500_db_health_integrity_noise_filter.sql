-- supabase/migrations/20260906011500_db_health_integrity_noise_filter.sql
--
-- `collect_db_health_integrity()` 의 `function_errors` 에 노이즈 필터를 넣는다.
--
-- 첫 실행 실측 (2026-09-06 · 함수 128개 검사, 건너뜀 0):
--   **25건 중 21건이 오탐**이었다. plpgsql_check 는 정적 분석이라
--   `create temp table _tc_words …` 로 **실행 시점에 만드는 임시 테이블**을 볼 수 없다.
--   `_tc_promote` · `_cur` · `_tc_words` · `_sel` · `_resel` · `_target` · `_asel` · `_gsel`
--   전부 그 경우다(18건). `record "v_chapter" is not assigned yet`(55000, 3건)도
--   루프 변수 분석의 한계에서 오는 같은 종류다.
--
--   이대로 두면 지표가 84% 노이즈다. **노이즈가 많은 감시는 곧 꺼진 감시가 된다** —
--   CLAUDE.md 가 「루프 애니메이션 금지」로 정당한 로더 20곳을 걸었던 것과 같은 실수를 반복하지 않는다.
--
-- 남은 4건 중 1건은 **진짜 버그**였다 (이 축을 만든 값어치가 첫 실행에서 나왔다):
--   `analyze_book_vrl` 이 `library_book_vocabularies.book_id` 를 읽는데
--   그 표의 실제 컬럼은 `library_book_id` 다. 호출하면 반드시 42703 으로 죽는다.
--   어떤 테스트도 이걸 잡지 못했다 — 부르는 곳이 없어서 실행된 적이 없기 때문이다.
--
-- 필터 규칙 (숨기지 않고 **분류**한다):
--   · `relation "_…" does not exist` — 이 저장소의 임시 테이블 명명 규칙(밑줄 접두)에 한해 제외
--   · sqlstate 55000 (record not assigned) — 정적 분석 한계
--   제외한 건수는 dims 에 그대로 남긴다. 규칙이 틀렸는지 나중에 되짚을 수 있어야 한다.

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
  v_suppressed jsonb := '[]'::jsonb;
  v_checked integer := 0;
  v_skipped integer := 0;
  v_is_noise boolean;
begin
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
        and p.prorettype <> 'trigger'::regtype
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
            -- 정적 분석이 볼 수 없는 것 = 코드의 결함이 아니다.
            v_is_noise := (c.sqlstate = '55000')
                       or (c.sqlstate = '42P01'
                           and coalesce(c.message, '') ~ 'relation "_[a-z0-9_]+" does not exist');

            if v_is_noise then
              v_suppressed := v_suppressed || jsonb_build_object(
                'function', r.proname, 'sqlstate', c.sqlstate,
                'message', left(coalesce(c.message, ''), 120));
            else
              v_findings := v_findings || jsonb_build_object(
                'function', r.proname,
                'args', r.args,
                'lineno', c.lineno,
                'sqlstate', c.sqlstate,
                'message', left(coalesce(c.message, ''), 200),
                'statement', left(coalesce(c.statement, ''), 120)
              );
            end if;
          end if;
        end loop;
      exception when others then
        -- 검사 자체가 실패한 함수는 "문제 없음" 이 아니다 — 별도로 센다.
        v_skipped := v_skipped + 1;
      end;
    end loop;

    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'integrity', 'function_errors', jsonb_array_length(v_findings),
            jsonb_build_object(
              'checked', v_checked,
              'skipped', v_skipped,
              'suppressed', jsonb_array_length(v_suppressed),
              'suppressed_reason', 'temp table (create temp table _x) · record-not-assigned — 정적 분석 한계',
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
  'DB 헬스 ⑥ integrity 주 1회 수집(함수 정적 분석·cron 명령 유효성·FK 인덱스·INVALID 객체) → db_health_metrics INSERT. 판정 없음. 정적 분석 한계로 인한 오탐(임시 테이블·record 미할당)은 suppressed 로 분리.';

revoke execute on function collect_db_health_integrity() from public, anon, authenticated;
