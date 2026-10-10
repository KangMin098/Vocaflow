-- supabase/migrations/20261011120200_map_v4_plan_conflict_code.sql
--
-- 계획 버전 충돌을 SQLSTATE 40001 로 던지면 PostgREST 가 직렬화 실패로 보고 같은 요청을 계속 재시도한다 —
-- 실제 개발 DB 병렬 smoke(2026-10-11)에서 둘째 첫 확정이 125초 뒤 「upstream request timeout」으로 끝났다(데이터는 덮이지 않음).
-- 충돌을 PT409(PostgREST 가 HTTP 409 로 그대로 돌려준다 · 재시도 없음)로 바꾼다. 본문의 다른 줄은 20261011120000 과 같다.
-- 되돌리기: 20261011120000_map_v4_plan.sql 의 같은 함수 정의를 다시 실행.
create or replace function public.learner_workspace_plan_commit(
  p_user uuid, p_template text, p_template_tasks text[], p_canon text, p_plan jsonb, p_reason text, p_note text,
  p_as_of timestamptz, p_goal_version bigint, p_expected_version integer, p_client_key uuid, p_restore_of integer)
returns table (workspace_id uuid, plan_version integer, reused boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ws uuid; v_cur integer; v_bad integer; v_last_canon text; n_tpl integer; n_order integer; n_tasks integer;
begin
  if p_user is null or p_client_key is null or p_template is null then raise exception 'plan_invalid: user/client_key/template' using errcode = '22023'; end if;
  -- 같은 학습자 · 같은 템플릿은 한 줄로(첫 확정 경합 · 같은 키 동시 재전송)
  perform pg_advisory_xact_lock(hashtext('map_plan:' || p_user::text || ':' || p_template));
  select p.workspace_id, p.plan_version into v_ws, v_cur from public.learner_workspace_plan p where p.user_id = p_user and p.client_key = p_client_key;
  if found then return query select v_ws, v_cur, true; return; end if;

  -- 템플릿 TASK(서버가 정의에서 넘긴다): 비지 않고 중복 없음
  n_tpl := coalesce(array_length(p_template_tasks, 1), 0);
  if n_tpl = 0 or n_tpl > 50 or (select count(distinct t) from unnest(p_template_tasks) t) <> n_tpl then
    raise exception 'plan_invalid: template tasks' using errcode = '22023';
  end if;
  -- 순서 = 템플릿 TASK 의 순열(중복 · 누락 · 모르는 TASK 없음)
  select count(*), count(distinct o) into n_order, v_bad from jsonb_array_elements_text(p_plan -> 'order') o;
  if n_order <> n_tpl or v_bad <> n_tpl
     or exists (select 1 from jsonb_array_elements_text(p_plan -> 'order') o where o <> all (p_template_tasks)) then
    raise exception 'plan_invalid: order' using errcode = '22023';
  end if;
  -- tasks: 템플릿 TASK 마다 정확히 한 줄 · 경계값(planned null 또는 0 ≤ planned ≤ available ≤ 999)
  select count(*) into n_tasks from jsonb_array_elements(p_plan -> 'tasks');
  if n_tasks <> n_tpl
     or (select count(distinct t ->> 'task') from jsonb_array_elements(p_plan -> 'tasks') t) <> n_tpl
     or exists (select 1 from jsonb_array_elements(p_plan -> 'tasks') t where (t ->> 'task') is null or (t ->> 'task') <> all (p_template_tasks)) then
    raise exception 'plan_invalid: tasks' using errcode = '22023';
  end if;
  select count(*) into v_bad from jsonb_array_elements(p_plan -> 'tasks') t
   where not coalesce(
     ((t -> 'available') is null or jsonb_typeof(t -> 'available') = 'null' or (jsonb_typeof(t -> 'available') = 'number' and (t ->> 'available') ~ '^\d{1,3}$'))
     and ((t -> 'planned') is null or jsonb_typeof(t -> 'planned') = 'null'
          or (jsonb_typeof(t -> 'planned') = 'number' and (t ->> 'planned') ~ '^\d{1,3}$' and (t ->> 'available') ~ '^\d{1,3}$'
              and (t ->> 'planned')::int <= (t ->> 'available')::int)),
     false);
  if v_bad > 0 then raise exception 'plan_invalid: % task bound(s)', v_bad using errcode = '22023'; end if;

  if p_as_of is null or p_as_of > now() + interval '5 minutes' then raise exception 'as_of_future' using errcode = '22023'; end if;
  if p_goal_version is not null and not exists (select 1 from public.csat_map_goal_version g where g.id = p_goal_version and g.user_id = p_user) then
    raise exception 'goal_mismatch' using errcode = '42501';
  end if;

  select id into v_ws from public.learner_workspace where user_id = p_user and template_id = p_template and status <> 'closed';
  if not found then
    insert into public.learner_workspace (user_id, template_id, canon_version) values (p_user, p_template, p_canon) returning id into v_ws;
  end if;
  select coalesce(max(p.plan_version), 0) into v_cur from public.learner_workspace_plan p where p.workspace_id = v_ws;
  if v_cur <> coalesce(p_expected_version, -1) then
    raise exception 'plan_version_conflict: expected %, current %', p_expected_version, v_cur using errcode = 'PT409';
  end if;
  -- 정의 버전이 바뀌었으면 그 사실을 사유로 남겨야 한다(조용히 이어 쓰지 않는다)
  select p.canon_version into v_last_canon from public.learner_workspace_plan p where p.workspace_id = v_ws order by p.plan_version desc limit 1;
  if v_last_canon is not null and v_last_canon <> p_canon and p_reason not in ('definition_change', 'restore') then
    raise exception 'canon_mismatch: %, %', v_last_canon, p_canon using errcode = '22023';
  end if;
  if p_reason = 'restore' and (p_restore_of is null or not exists (select 1 from public.learner_workspace_plan p where p.workspace_id = v_ws and p.plan_version = p_restore_of)) then
    raise exception 'restore_missing' using errcode = '22023';
  end if;

  insert into public.learner_workspace_plan (workspace_id, user_id, plan_version, plan, reason, note, restored_from, as_of, canon_version, goal_version_id, client_key)
    values (v_ws, p_user, v_cur + 1, p_plan, p_reason, nullif(btrim(p_note), ''), case when p_reason = 'restore' then p_restore_of end, p_as_of, p_canon, p_goal_version, p_client_key);
  return query select v_ws, v_cur + 1, false;
end $$;
