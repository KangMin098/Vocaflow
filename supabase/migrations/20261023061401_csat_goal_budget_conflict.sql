-- supabase/migrations/20261023142000_csat_goal_budget_conflict.sql
-- PROPOSED: separate user approval required. Preserve the installed rev2 migration.
-- Change only the business-conflict SQLSTATE; retain rows, locks, RLS, grants and function identity.
-- 40001 triggers PostgREST transaction retries. PT409 returns a non-retryable HTTP 409.
do $patch$
declare
  definition text := pg_get_functiondef('public.csat_map_goal_budget_set(uuid,smallint,smallint,text,date,uuid,jsonb,bigint)'::regprocedure);
  old_raise text := 'raise exception ''goal_changed'' using errcode = ''40001'';';
  new_raise text := 'raise exception ''goal_changed'' using errcode = ''PT409'';';
begin
  -- Accept exactly the observed rev2 definition or its already-patched equivalent.
  if md5(definition) = '555ce3e705ec0432a12f389dfcc91072' then
    execute replace(definition, old_raise, new_raise);
  elsif md5(replace(definition, new_raise, old_raise)) = '555ce3e705ec0432a12f389dfcc91072' then
    null; -- Exact replay: no DDL or data writes.
  else
    raise exception 'goal_budget_writer_definition_changed' using errcode = '22023';
  end if;
end
$patch$;
