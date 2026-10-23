-- supabase/migrations/20261023090000_csat_goal_budget.sql
-- PROPOSED: user approval required before applying to the shared development DB.
-- Additive only: no data rewrite, deletion, trigger removal, or legacy RPC replacement.
-- Rollback without deletion: switch application back to the legacy RPC; preserve new history.

create function public.csat_goal_budget_valid(p_budget jsonb)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare n numeric; total numeric := 0; v jsonb;
begin
  if p_budget is null then return true; end if;
  if jsonb_typeof(p_budget) is distinct from 'object' then return false; end if;
  if (p_budget - array['weeklyMinutes','dailyMinutes','minutesPerUnit','priorities']) <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(p_budget->'weeklyMinutes') is distinct from 'number' or
     jsonb_typeof(p_budget->'minutesPerUnit') is distinct from 'number' then return false; end if;
  n := (p_budget->>'weeklyMinutes')::numeric;
  if n <> trunc(n) or n < 1 or n > 10080 then return false; end if;
  n := (p_budget->>'minutesPerUnit')::numeric;
  if n <> trunc(n) or n < 1 or n > 240 then return false; end if;
  if not (p_budget ? 'dailyMinutes') then return false; end if;
  if p_budget->'dailyMinutes' <> 'null'::jsonb then
    if jsonb_typeof(p_budget->'dailyMinutes') is distinct from 'array' then return false; end if;
    if jsonb_array_length(p_budget->'dailyMinutes') <> 7 then return false; end if;
    for v in select value from jsonb_array_elements(p_budget->'dailyMinutes') loop
      if jsonb_typeof(v) <> 'number' then return false; end if;
      n := v::text::numeric;
      if n <> trunc(n) or n < 0 or n > 1440 then return false; end if;
      total := total + n;
    end loop;
    if total > (p_budget->>'weeklyMinutes')::numeric then return false; end if;
  end if;
  if jsonb_typeof(p_budget->'priorities') is distinct from 'array' then return false; end if;
  if jsonb_array_length(p_budget->'priorities') > 21 then return false; end if;
  for v in select value from jsonb_array_elements(p_budget->'priorities') loop
    if jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 64 then return false; end if;
  end loop;
  if (select count(*) <> count(distinct value) from jsonb_array_elements(p_budget->'priorities')) then return false; end if;
  return true;
end $$;

alter table public.csat_map_goal_version add column planning_budget jsonb;
alter table public.csat_map_goal_version add constraint csat_goal_budget_valid
  check (public.csat_goal_budget_valid(planning_budget));
alter table public.csat_map_goal_version add constraint csat_goal_budget_scope
  check (planning_budget is null or (target_exam is not null and target_date is not null));

create function public.csat_map_goal_budget_set(
  p_user uuid, p_score smallint, p_grade smallint, p_exam text, p_date date, p_client_key uuid, p_budget jsonb, p_expected_goal bigint default null
) returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint; v_latest bigint;
begin
  if p_user is null or p_client_key is null or p_score is null or p_score not between 0 and 100
     or p_exam is null or p_date is null or p_budget is null or not public.csat_goal_budget_valid(p_budget)
  then raise exception 'goal_budget_invalid' using errcode = '22023'; end if;
  -- Same serialization as the existing goal setter and PLAN commits.
  perform pg_advisory_xact_lock(hashtext('map_goal:' || p_user::text));
  select id into v_id from public.csat_map_goal_version where user_id = p_user and client_key = p_client_key;
  if found then return v_id; end if;
  select max(id) into v_latest from public.csat_map_goal_version where user_id = p_user;
  if v_latest is distinct from p_expected_goal then raise exception 'goal_changed' using errcode = '40001'; end if;
  insert into public.csat_map_goal (user_id, target_score, updated_at) values (p_user, p_score, now())
    on conflict (user_id) do update set target_score = excluded.target_score, updated_at = now();
  insert into public.csat_map_goal_version (user_id, target_score, target_grade, target_exam, target_date, client_key, planning_budget)
    values (p_user, p_score, p_grade, p_exam, p_date, p_client_key, p_budget) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.csat_goal_budget_valid(jsonb) from public, anon, authenticated;
grant execute on function public.csat_goal_budget_valid(jsonb) to service_role;
revoke all on function public.csat_map_goal_budget_set(uuid,smallint,smallint,text,date,uuid,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.csat_map_goal_budget_set(uuid,smallint,smallint,text,date,uuid,jsonb,bigint) to service_role;
comment on column public.csat_map_goal_version.planning_budget is 'Immutable scheduling allocation inputs for this goal version. Not a score/grade prediction or learning-effect estimate.';
