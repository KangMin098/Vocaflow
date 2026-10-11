-- supabase/migrations/_pending_map_v4_plan.sql
--
-- **승인 대기 — 적용하지 않았다.** 학습 지도 rev4.0 3차: 목표 이력 · 학습자 Workspace · 학습계획 버전.
-- 승인되면 `ls supabase/migrations` 로 겹치지 않는 버전 번호를 골라 `<ts>_map_v4_plan.sql` 로 이름을 바꿔 적용한다(AGENTS · D10).
-- 검토 문서: docs/csat-learner/LEARNING_MAP_V4_PLAN_SCHEMA.md(영향 · 롤백 · 검증 계획).
--
-- ── 무엇을 만드나 ─────────────────────────────────────────────────────
--   1. csat_map_goal_version   목표 변경 이력(추가 전용). 지금의 csat_map_goal(사용자당 1행 · 덮어쓰기)은 「최신 값」으로 그대로 둔다
--   2. learner_workspace        학습자 × Workspace Template(정의 버전 고정)
--   3. learner_workspace_plan   계획 버전(추가 전용) — 선택 TASK · 계획량 · 순서 · 일정 · 수정 사유 · 기준 시점
--   쓰기 RPC 2개(service role 전용 · SECURITY DEFINER · 멱등 키 · 기대 버전 검사)
--
-- ── 하지 않는 것 ──────────────────────────────────────────────────────
--   · learning_task_attempts 를 복제하지 않는다 — 계획은 수행 기록을 참조(조회)만 한다. plan jsonb 에 시도 · 정오를 넣지 않는다
--   · 근거 상태 · 직접 확인 판정을 저장하지 않는다(조회 때 계산 — skill-diagnosis 원칙 그대로)
--   · 학습자 RLS 클라이언트에 INSERT/UPDATE/DELETE 를 주지 않는다(쓰기는 서버 API → RPC)
--
-- ── 되돌리기(롤백) ────────────────────────────────────────────────────
--   DROP FUNCTION public.learner_workspace_plan_commit(uuid, text, text, text, jsonb, text, text, timestamptz, integer, uuid);
--   DROP FUNCTION public.csat_map_goal_set(uuid, smallint, smallint, text, date, uuid);
--   DROP TABLE public.learner_workspace_plan, public.learner_workspace, public.csat_map_goal_version CASCADE;
--   DROP FUNCTION public.map_v4_append_only();
--   기존 테이블(csat_map_goal 등)은 바꾸지 않으므로 되돌릴 것이 없다. 백필한 목표 이력은 위 DROP 으로 함께 사라진다.
--   주의: learner_workspace 를 직접 DELETE 하면 계획 이력 cascade 를 추가 전용 가드가 거절한다(의도 — 계획 이력은 계정 삭제로만 사라진다).
--   goal_version_id 는 ON DELETE 동작 없음 — SET NULL 은 UPDATE 라 추가 전용 가드와 부딪친다. 목표 이력은 계정 삭제로만 사라지고 같은 문장에서 계획도 사라진다.

begin;

-- ── 0. 추가 전용 가드 ───────────────────────────────────────────────────
create function public.map_v4_append_only() returns trigger
language plpgsql as $$
begin
  -- 계정 삭제(auth.users cascade)만 허용 — 그 밖의 수정 · 삭제는 이력을 바꾼다
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  raise exception '%: 이력은 고칠 수 없다(추가 전용)', tg_table_name;
end $$;

-- ── 1. 목표 이력 ────────────────────────────────────────────────────────
create table public.csat_map_goal_version (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  target_score smallint not null check (target_score between 0 and 100),
  -- 절대평가 등급 목표(선택) — 점수와 따로 저장만 한다(점수에서 역산하지 않는다)
  target_grade smallint check (target_grade between 1 and 9),
  -- 목표 시험(선택): 수능 · 평가원 6/9월 · 학평
  target_exam  text check (target_exam in ('suneung', 'kice6', 'kice9', 'hakpyeong')),
  target_date  date,
  client_key   uuid not null,
  created_at   timestamptz not null default now(),
  unique (user_id, client_key)
);
create index csat_map_goal_version_user on public.csat_map_goal_version (user_id, created_at desc);
create trigger csat_map_goal_version_append_only before update or delete on public.csat_map_goal_version
  for each row execute function public.map_v4_append_only();

-- 지금 목표를 첫 이력으로(사용자당 1행 — 2026-10-10 실측 1행). 시각은 원래 updated_at
insert into public.csat_map_goal_version (user_id, target_score, client_key, created_at)
select g.user_id, g.target_score, gen_random_uuid(), g.updated_at from public.csat_map_goal g;

-- ── 2. 학습자 Workspace ─────────────────────────────────────────────────
create table public.learner_workspace (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  template_id      text not null check (template_id ~ '^ws\.[a-z0-9-]+$'),
  -- 정의 버전(docs/csat-learner/v4 codebook.version) — 정의가 바뀌어도 당시 버전을 가리킨다
  canon_version    text not null check (length(canon_version) between 1 and 64),
  status           text not null default 'active' check (status in ('active', 'paused', 'closed')),
  goal_version_id  bigint references public.csat_map_goal_version (id),
  created_at       timestamptz not null default now()
);
-- 같은 템플릿의 열린 Workspace 는 학습자당 하나
create unique index learner_workspace_open on public.learner_workspace (user_id, template_id) where status <> 'closed';

-- ── 3. 계획 버전(추가 전용) ─────────────────────────────────────────────
-- plan = { order: [task_id…], tasks: [{ task, stage, planned, available, rule }], schedule?: { start?: date, per_week?: int } }
--   planned ≤ available(계획 당시 실제 문항 수) — 근거 없는 권장량은 저장 경로가 없다(available 이 null 인 TASK 는 planned 도 null)
create table public.learner_workspace_plan (
  id             bigint generated always as identity primary key,
  workspace_id   uuid not null references public.learner_workspace (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  plan_version   integer not null check (plan_version >= 1),
  plan           jsonb not null check (jsonb_typeof(plan -> 'tasks') = 'array' and jsonb_typeof(plan -> 'order') = 'array'),
  reason         text not null check (reason in ('initial', 'learner_adjust', 'new_exam', 'check_result', 'goal_change', 'definition_change')),
  note           text check (note is null or length(note) <= 500),
  -- 계획을 정한 기준 시점과 그때의 정의 버전(재현 · 감사용)
  as_of          timestamptz not null,
  canon_version  text not null,
  goal_version_id bigint references public.csat_map_goal_version (id),
  client_key     uuid not null,
  created_at     timestamptz not null default now(),
  unique (workspace_id, plan_version),
  unique (user_id, client_key)
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
revoke truncate, update on public.csat_map_goal_version, public.learner_workspace_plan from service_role;

-- ── 5. 쓰기 RPC ─────────────────────────────────────────────────────────
-- 목표 설정 — 최신 값(csat_map_goal) 갱신 + 이력 한 줄. 같은 client_key 재전송은 처음 결과를 돌려준다(멱등)
create function public.csat_map_goal_set(p_user uuid, p_score smallint, p_grade smallint, p_exam text, p_date date, p_client_key uuid)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  select id into v_id from public.csat_map_goal_version where user_id = p_user and client_key = p_client_key;
  if found then return v_id; end if;
  insert into public.csat_map_goal (user_id, target_score, updated_at) values (p_user, p_score, now())
    on conflict (user_id) do update set target_score = excluded.target_score, updated_at = now();
  insert into public.csat_map_goal_version (user_id, target_score, target_grade, target_exam, target_date, client_key)
    values (p_user, p_score, p_grade, p_exam, p_date, p_client_key) returning id into v_id;
  return v_id;
end $$;

-- 계획 확정 · 수정 — Workspace 를 찾거나 만들고 다음 버전을 추가한다.
--   멱등: 같은 (user, client_key) 는 처음 만든 버전을 돌려준다(중복 제출).
--   동시성: p_expected_version(학습자가 보던 버전, 처음이면 0)이 지금 최신과 다르면 'plan_version_conflict' — 덮어쓰지 않는다.
--   검증: tasks[] 마다 planned 는 null 이거나 0 ≤ planned ≤ available(정수). 그 밖이면 'plan_invalid'.
create function public.learner_workspace_plan_commit(
  p_user uuid, p_template text, p_template_canon text, p_canon text, p_plan jsonb, p_reason text, p_note text,
  p_as_of timestamptz, p_expected_version integer, p_client_key uuid)
returns table (workspace_id uuid, plan_version integer, reused boolean)
language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_cur integer; v_bad integer; v_goal bigint;
begin
  select p.workspace_id, p.plan_version into v_ws, v_cur from public.learner_workspace_plan p where p.user_id = p_user and p.client_key = p_client_key;
  if found then return query select v_ws, v_cur, true; return; end if;

  select count(*) into v_bad from jsonb_array_elements(coalesce(p_plan -> 'tasks', '[]'::jsonb)) t
   -- coalesce — available 이 null 인데 planned 만 있으면 비교가 NULL 이 되어 위반에서 빠지던 결함(오프라인 하네스가 잡음 · 2026-10-11)
   --   허용: planned 없음(계획하지 않음) · 또는 0 ≤ planned ≤ available(둘 다 4자리 이하 정수 — 큰 수 ::int 넘침 방지 · 3차 리뷰 P2)
   where not coalesce(
     (t ->> 'planned') is null
     or ((t ->> 'planned') ~ '^\d{1,4}$' and (t ->> 'available') ~ '^\d{1,4}$' and (t ->> 'planned')::int <= (t ->> 'available')::int),
     false);
  if v_bad > 0 then raise exception 'plan_invalid: % task(s)', v_bad using errcode = '22023'; end if;

  -- 같은 학습자 · 같은 템플릿의 첫 확정이 동시에 오면 잠글 행이 없다(FOR UPDATE 무력) → 트랜잭션 자문 잠금으로 줄 세운 뒤
  -- client_key 를 다시 본다(동시 재전송도 23505 가 아니라 reused 로 · 3차 리뷰 P2)
  perform pg_advisory_xact_lock(hashtext(p_user::text || ':' || p_template));
  select p.workspace_id, p.plan_version into v_ws, v_cur from public.learner_workspace_plan p where p.user_id = p_user and p.client_key = p_client_key;
  if found then return query select v_ws, v_cur, true; return; end if;

  select id into v_goal from public.csat_map_goal_version where user_id = p_user order by created_at desc, id desc limit 1;
  select id into v_ws from public.learner_workspace where user_id = p_user and template_id = p_template and status <> 'closed' for update;
  if not found then
    insert into public.learner_workspace (user_id, template_id, canon_version, goal_version_id)
      values (p_user, p_template, p_template_canon, v_goal) returning id into v_ws;
  end if;
  select coalesce(max(p.plan_version), 0) into v_cur from public.learner_workspace_plan p where p.workspace_id = v_ws;
  if v_cur <> coalesce(p_expected_version, 0) then
    raise exception 'plan_version_conflict: expected %, current %', p_expected_version, v_cur using errcode = '40001';
  end if;
  insert into public.learner_workspace_plan (workspace_id, user_id, plan_version, plan, reason, note, as_of, canon_version, goal_version_id, client_key)
    values (v_ws, p_user, v_cur + 1, p_plan, p_reason, nullif(p_note, ''), p_as_of, p_canon, v_goal, p_client_key);
  return query select v_ws, v_cur + 1, false;
end $$;

revoke all on function public.csat_map_goal_set(uuid, smallint, smallint, text, date, uuid) from public, anon, authenticated;
revoke all on function public.learner_workspace_plan_commit(uuid, text, text, text, jsonb, text, text, timestamptz, integer, uuid) from public, anon, authenticated;
grant execute on function public.csat_map_goal_set(uuid, smallint, smallint, text, date, uuid) to service_role;
grant execute on function public.learner_workspace_plan_commit(uuid, text, text, text, jsonb, text, text, timestamptz, integer, uuid) to service_role;

commit;
