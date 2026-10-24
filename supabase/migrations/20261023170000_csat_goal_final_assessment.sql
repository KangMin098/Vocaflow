-- supabase/migrations/20261023170000_csat_goal_final_assessment.sql
-- PROPOSED: user approval required before applying to the shared development DB.
-- Additive only: one new append-only table + one service_role writer. No existing row, trigger, policy or RPC changes.
-- Rollback without deletion: the app treats a missing table/RPC as "not installed" (final attainment stays unconfirmed); keep history.
--
-- Contract: a goal version may bind exactly one final assessment — the goal's own exam kind (target_exam) administered on
-- assessment_date. The learner states it explicitly; it is never inferred from exam kind or target date. A new goal version
-- starts unbound (bindings never carry over). Judgment (eligibility · comparability · grade) stays in the app (final-assessment.ts).

create table public.csat_map_goal_final_assessment (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  goal_version_id bigint not null references public.csat_map_goal_version (id),
  assessment_date date not null,
  client_key      uuid not null,
  created_at      timestamptz not null default now(),
  unique (goal_version_id),
  unique (user_id, client_key)
);
create trigger csat_map_goal_final_assessment_append_only before update or delete on public.csat_map_goal_final_assessment
  for each row execute function public.map_v4_append_only();

alter table public.csat_map_goal_final_assessment enable row level security;
create policy csat_map_goal_final_assessment_own_select on public.csat_map_goal_final_assessment
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.csat_map_goal_final_assessment from public, anon, authenticated;
grant select on public.csat_map_goal_final_assessment to authenticated;
grant select, insert on public.csat_map_goal_final_assessment to service_role;

create function public.csat_map_goal_final_assessment_bind(p_user uuid, p_goal bigint, p_date date, p_client_key uuid)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint; v_latest bigint; g record;
begin
  if p_user is null or p_goal is null or p_date is null or p_client_key is null
  then raise exception 'final_assessment_invalid' using errcode = '22023'; end if;
  -- Same serialization as goal and PLAN writers: a goal change and a binding cannot interleave.
  perform pg_advisory_xact_lock(hashtext('map_goal:' || p_user::text));
  select id into v_id from public.csat_map_goal_final_assessment where user_id = p_user and client_key = p_client_key;
  if found then return v_id; end if;
  select max(id) into v_latest from public.csat_map_goal_version where user_id = p_user;
  if v_latest is distinct from p_goal then raise exception 'goal_changed' using errcode = 'PT409'; end if;
  select target_exam, target_date, created_at into g from public.csat_map_goal_version where id = p_goal;
  -- Only the goal's own exam kind, after the goal day (Seoul) and no later than the goal date.
  if g.target_exam is null or g.target_date is null or p_date > g.target_date
     or p_date <= (g.created_at at time zone 'Asia/Seoul')::date
  then raise exception 'final_assessment_invalid' using errcode = '22023'; end if;
  if exists (select 1 from public.csat_map_goal_final_assessment where goal_version_id = p_goal)
  then raise exception 'final_assessment_bound' using errcode = 'PT409'; end if;
  insert into public.csat_map_goal_final_assessment (user_id, goal_version_id, assessment_date, client_key)
    values (p_user, p_goal, p_date, p_client_key) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.csat_map_goal_final_assessment_bind(uuid,bigint,date,uuid) from public, anon, authenticated;
grant execute on function public.csat_map_goal_final_assessment_bind(uuid,bigint,date,uuid) to service_role;
comment on table public.csat_map_goal_final_assessment is 'Learner-declared final assessment for one goal version (goal exam kind on assessment_date). Immutable. Not a prediction or learning-effect claim.';
