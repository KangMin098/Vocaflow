-- supabase/migrations/20261011120000_map_v4_plan.sql
--
-- **2026-10-11 개발 DB 적용 · 사용자 승인(sha256 83d0344f… — 작성 이름 _pending_map_v4_plan).** 학습 지도 rev4.0: 목표 이력 · 학습자 Workspace · 학습계획 버전. (3차 초안 → 4차 보완)
-- 이름 변경: 승인된 내용 그대로(본문 변경 없음 — 머리 주석만).
-- 검토 문서: docs/csat-learner/LEARNING_MAP_V4_PLAN_SCHEMA.md(신뢰 경계 · 영향 · 복구 · 검증 계획).
--
-- ── 신뢰 경계 ─────────────────────────────────────────────────────────
--   학습자 → 서버 API: template · order · planned(TASK 별) · reason · note · expected_version · client_key 만 보낸다.
--   서버(인증 세션의 user id) → RPC(service_role 전용): 템플릿 TASK 목록 · TASK 별 가용 문항 수(서버가 공개 콘텐츠에서 계산) ·
--     정의 버전 · 목표 버전 · 기준 시점을 **서버가** 채운다. 클라이언트가 보낸 가용량은 RPC 까지 오지 않는다.
--   RPC 는 받은 값끼리의 정합성을 다시 본다(순서 = 템플릿 TASK 의 순열 · 중복 · 누락 · 모르는 TASK · 경계값 · 목표 소유 · 정의 버전 · 시점).
--
-- ── 하지 않는 것 ──────────────────────────────────────────────────────
--   · learning_task_attempts 를 복제하지 않는다 — 계획은 수행 기록을 조회만 한다(plan jsonb 에 시도 · 정오 칸 없음)
--   · 근거 상태 · 직접 확인 판정을 저장하지 않는다(조회 때 계산)
--   · 학습자 RLS 클라이언트에 쓰기 권한을 주지 않는다
--
-- ── 복구 · 롤백(데이터 보존형) ────────────────────────────────────────
--   계획 되돌리기 = 이전 버전을 **새 버전으로 다시 추가**(reason 'restore' · restored_from). 이력을 지우거나 고치지 않는다.
--   스키마 롤백(적용 직후 문제가 있을 때만): 먼저 보존 사본 → 그다음 DROP.
--     CREATE TABLE public._bak_map_v4_goal_version AS TABLE public.csat_map_goal_version;
--     CREATE TABLE public._bak_map_v4_workspace AS TABLE public.learner_workspace;
--     CREATE TABLE public._bak_map_v4_plan AS TABLE public.learner_workspace_plan;
--   DROP FUNCTION public.learner_workspace_plan_commit(uuid, text, text[], text, jsonb, text, text, timestamptz, bigint, integer, uuid, integer);
--   DROP FUNCTION public.csat_map_goal_set(uuid, smallint, smallint, text, date, uuid);
--   DROP TABLE public.learner_workspace_plan, public.learner_workspace, public.csat_map_goal_version CASCADE;
--   DROP FUNCTION public.map_v4_append_only();
--   기존 테이블(csat_map_goal 등)의 정의는 바꾸지 않는다. csat_map_goal 의 값은 RPC 가 지금 API 와 같은 방식으로 갱신한다.
--   주의: learner_workspace 를 직접 DELETE 하면 계획 이력 cascade 를 추가 전용 가드가 거절한다(의도 — 이력은 계정 삭제로만 사라진다).

begin;

-- ── 0. 추가 전용 가드 ───────────────────────────────────────────────────
create function public.map_v4_append_only() returns trigger
language plpgsql as $$
begin
  -- 계정 삭제(auth.users cascade)만 허용 — 그 밖의 수정 · 삭제는 이력을 바꾼다
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  raise exception '%: 이력은 고칠 수 없다(추가 전용)', tg_table_name using errcode = '42501';
end $$;

-- ── 1. 목표 이력 ────────────────────────────────────────────────────────
create table public.csat_map_goal_version (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  target_score smallint not null check (target_score between 0 and 100),
  -- 절대평가 등급 목표(선택) — 점수와 따로 저장만 한다(점수에서 역산하지 않는다)
  target_grade smallint check (target_grade between 1 and 9),
  target_exam  text check (target_exam in ('suneung', 'kice6', 'kice9', 'hakpyeong')),
  target_date  date,
  client_key   uuid not null,
  created_at   timestamptz not null default now(),
  unique (user_id, client_key)
);
create index csat_map_goal_version_user on public.csat_map_goal_version (user_id, created_at desc, id desc);
create trigger csat_map_goal_version_append_only before update or delete on public.csat_map_goal_version
  for each row execute function public.map_v4_append_only();

-- 지금 목표를 첫 이력으로(2026-10-10 실측 1행). 시각은 원래 updated_at
insert into public.csat_map_goal_version (user_id, target_score, client_key, created_at)
select g.user_id, g.target_score, gen_random_uuid(), g.updated_at from public.csat_map_goal g;

-- ── 2. 학습자 Workspace ─────────────────────────────────────────────────
create table public.learner_workspace (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  template_id      text not null check (template_id ~ '^ws\.[a-z0-9-]{1,40}$'),
  -- 처음 확정한 정의 버전(codebook.version). 이후 버전은 계획 행마다 따로 기록
  canon_version    text not null check (canon_version ~ '^[A-Za-z0-9.\-]{1,64}$'),
  status           text not null default 'active' check (status in ('active', 'paused', 'closed')),
  created_at       timestamptz not null default now()
);
create unique index learner_workspace_open on public.learner_workspace (user_id, template_id) where status <> 'closed';

-- ── 3. 계획 버전(추가 전용) ─────────────────────────────────────────────
-- plan = { order: [task…](= 템플릿 TASK 의 순열), tasks: [{ task, stage, planned, available, rule }] }
--   available = 서버가 계산한 그 시점 가용 문항 수(없으면 null) · planned = null(계획 안 함) 또는 0 ≤ planned ≤ available
create table public.learner_workspace_plan (
  id              bigint generated always as identity primary key,
  workspace_id    uuid not null references public.learner_workspace (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  plan_version    integer not null check (plan_version between 1 and 100000),
  plan            jsonb not null check (jsonb_typeof(plan -> 'tasks') = 'array' and jsonb_typeof(plan -> 'order') = 'array'),
  reason          text not null check (reason in ('initial', 'learner_adjust', 'new_exam', 'check_result', 'goal_change', 'definition_change', 'content_change', 'restore')),
  note            text check (note is null or length(note) <= 500),
  restored_from   integer check (restored_from is null or restored_from >= 1),
  -- 결속: 계획을 정한 기준 시점 · 그때의 정의 버전 · 그때의 목표 버전
  as_of           timestamptz not null,
  canon_version   text not null check (canon_version ~ '^[A-Za-z0-9.\-]{1,64}$'),
  goal_version_id bigint references public.csat_map_goal_version (id),
  client_key      uuid not null,
  created_at      timestamptz not null default now(),
  unique (workspace_id, plan_version),
  unique (user_id, client_key),
  check ((reason = 'restore') = (restored_from is not null))
);
create index learner_workspace_plan_ws on public.learner_workspace_plan (workspace_id, plan_version desc);
create trigger learner_workspace_plan_append_only before update or delete on public.learner_workspace_plan
  for each row execute function public.map_v4_append_only();

-- ── 4. RLS · 권한 — 본인 SELECT 만, 쓰기는 service role RPC 만 ───────────
alter table public.csat_map_goal_version  enable row level security;
alter table public.learner_workspace       enable row level security;
alter table public.learner_workspace_plan  enable row level security;
create policy csat_map_goal_version_own_select  on public.csat_map_goal_version  for select to authenticated using (user_id = (select auth.uid()));
create policy learner_workspace_own_select      on public.learner_workspace      for select to authenticated using (user_id = (select auth.uid()));
create policy learner_workspace_plan_own_select on public.learner_workspace_plan for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.csat_map_goal_version, public.learner_workspace, public.learner_workspace_plan from public, anon, authenticated;
grant select on public.csat_map_goal_version, public.learner_workspace, public.learner_workspace_plan to authenticated;
-- service_role 도 이력 표는 고치지 못한다(추가 전용 가드와 이중). 직접 INSERT 도 막는다 — 쓰기는 아래 RPC 의 검증을 거친다
revoke insert, update, delete, truncate on public.csat_map_goal_version, public.learner_workspace_plan from service_role;
revoke insert, delete, truncate on public.learner_workspace from service_role;

-- ── 5. 목표 설정 RPC ────────────────────────────────────────────────────
-- 최신 값(csat_map_goal) 갱신 + 이력 한 줄을 한 트랜잭션으로. 같은 client_key 는 처음 결과(멱등).
-- 같은 학습자의 동시 요청은 자문 잠금으로 줄 세운다 — 최신 값과 마지막 이력이 항상 같은 요청에서 온다.
create function public.csat_map_goal_set(p_user uuid, p_score smallint, p_grade smallint, p_exam text, p_date date, p_client_key uuid)
returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id bigint;
begin
  if p_user is null or p_client_key is null then raise exception 'goal_invalid: user/client_key' using errcode = '22023'; end if;
  if p_score is null or p_score not between 0 and 100 then raise exception 'goal_invalid: score' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('map_goal:' || p_user::text));
  select id into v_id from public.csat_map_goal_version where user_id = p_user and client_key = p_client_key;
  if found then return v_id; end if;
  insert into public.csat_map_goal (user_id, target_score, updated_at) values (p_user, p_score, now())
    on conflict (user_id) do update set target_score = excluded.target_score, updated_at = now();
  insert into public.csat_map_goal_version (user_id, target_score, target_grade, target_exam, target_date, client_key)
    values (p_user, p_score, p_grade, p_exam, p_date, p_client_key) returning id into v_id;
  return v_id;
end $$;

-- ── 6. 계획 확정 · 수정 · 복원 RPC ──────────────────────────────────────
-- 반환: (workspace_id, plan_version, reused). 오류 코드:
--   plan_invalid(22023) 구조 · 경계 · 순서 · TASK 위반 / plan_version_conflict(40001) 보던 버전이 낡음 /
--   canon_mismatch(22023) 정의 버전이 바뀌었는데 사유가 definition_change 가 아님 / goal_mismatch(42501) 남의 목표 버전 /
--   restore_missing(22023) 복원할 버전 없음 / as_of_future(22023) 기준 시점이 미래
create function public.learner_workspace_plan_commit(
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
    raise exception 'plan_version_conflict: expected %, current %', p_expected_version, v_cur using errcode = '40001';
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

revoke all on function public.map_v4_append_only() from public, anon, authenticated;
revoke all on function public.csat_map_goal_set(uuid, smallint, smallint, text, date, uuid) from public, anon, authenticated;
revoke all on function public.learner_workspace_plan_commit(uuid, text, text[], text, jsonb, text, text, timestamptz, bigint, integer, uuid, integer) from public, anon, authenticated;
grant execute on function public.csat_map_goal_set(uuid, smallint, smallint, text, date, uuid) to service_role;
grant execute on function public.learner_workspace_plan_commit(uuid, text, text[], text, jsonb, text, text, timestamptz, bigint, integer, uuid, integer) to service_role;

commit;
