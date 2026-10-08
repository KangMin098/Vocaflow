-- supabase/migrations/_pending_20261008190000_learning_records_append_only.sql
--
-- **F7 — 학습 기록 3표 추가 전용화 · 안전한 테스트 정리 경로 · 계정 삭제 허용.** 미적용 · 승인 대기(M8 과 별도 승인). 전제: M8(20261008180000 · 적용됨).
-- 실측(개발 DB 2026-10-08 읽기 전용): service_role 이 learning_mutations · learning_sessions · learning_task_attempts 에
--   UPDATE · DELETE · TRUNCATE 를 갖는다(160000 은 SELECT · INSERT 만 의도했지만 Supabase 기본 GRANT 가 남음).
--   TRUNCATE 는 행 트리거를 건너뛰므로 표본 고정(M5d) · synthetic 불변(M8)을 한 문장으로 우회한다.
-- 사용자 결정(2026-10-08): 계정 삭제는 허용 · 계정이 살아 있으면 원장 · 기록의 임의 수정 · 삭제 거부 · TRUNCATE 차단 ·
--   삭제로 분석 완료 표본이 바뀌면 그 결과를 재검토 필요로 표시(재계산 전 유효 근거로 쓰지 않음) · 원장 삭제는 실제 대상의 synthetic 과 대조.
-- 바꾸는 것
--   F7-1 세 표 TRUNCATE 회수(service_role · authenticated · anon).
--   F7-2 요청 원장은 고치지 않는다 — UPDATE 회수 + 트리거 거부(소유자 역할 포함).
--   F7-3 계정이 살아 있으면 삭제는 합성 행만 · 분석 완료 실검증 표본 밖에서만 — 테스트 정리 경로(시도 → 세션 → 원장, PK 로).
--        원장 삭제는 payload 가 아니라 **실제 대상(세션 · 시도)의 synthetic** 과 대조한다(methodology f7-review-probe P1-2).
--        표본 첫 시도보다 이르거나 같은 합성 시도도 지울 수 없다 — 지우면 뒤의 실제 시도가 첫 시도로 올라온다(Codex P2).
--   F7-4 계정 삭제(auth.users cascade)는 허용 — 부모 계정이 이미 없으면 가드를 통과한다(methodology f7-review-probe P1-1).
--        그 삭제가 분석 완료 실검증 표본 시도를 지우면 그 검증에 review_required_at · 사유를 남긴다(결과 행은 그대로 · 재계산 전 근거 금지).
--   F7-5 learning_session_apply 는 기존 세션과 다른 synthetic 을 거부한다(시도 M7 과 같은 원칙) — 합성 표시 원장으로 실제 요청을 지우는 길을 닫는다.
-- 기존 데이터 영향: 행 변경 없음(열 2개 추가 · 권한 · 트리거 · 함수 본문만). 세 표 모두 0행(2026-10-08 실측) · knowledge_trials 4행(planned).
-- 검증: scripts/knowledge/g2-f7-test.mjs(격리 PostgreSQL) · 되돌리기 블록도 그 하네스가 실행한다.

revoke truncate on public.learning_mutations, public.learning_sessions, public.learning_task_attempts from service_role, authenticated, anon;
revoke update on public.learning_mutations from service_role, authenticated, anon;

-- F7-4 재검토 표시 — 분석 결과 행은 그대로 두고, 재계산 전에는 유효 근거로 쓰지 않는다(소비자가 이 열을 본다)
alter table public.knowledge_trials add column review_required_at timestamptz;
alter table public.knowledge_trials add column review_required_reason text check (review_required_reason is null or length(review_required_reason) <= 500);

create function public.learning_mutations_append_only() returns trigger
-- security definer: 부모 계정 존재 확인에 auth.users 를 읽는다(service_role 은 읽지 못한다) — 읽기만 하고 search_path 고정
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_syn boolean;
begin
  if tg_op = 'UPDATE' then
    raise exception '요청 원장은 고칠 수 없다(추가 전용)';
  end if;
  -- F7-4 계정 삭제 cascade — 부모 계정이 이미 없으면 통과
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  -- F7-3 실제 대상의 synthetic 과 대조(payload 표시는 믿지 않는다). 대상이 이미 정리됐으면(합성만 지울 수 있으므로) payload 로 판단
  if old.kind = 'session' then
    select s.synthetic into v_syn from public.learning_sessions s where s.user_id = old.user_id and s.client_session_id = old.target;
  else
    select a.synthetic into v_syn from public.learning_task_attempts a where a.user_id = old.user_id and a.client_mutation_id = old.client_mutation_id;
  end if;
  if not coalesce(v_syn, (old.payload->>'synthetic')::boolean, false) then
    raise exception '실제 학습자의 요청 원장은 지울 수 없다 — 합성 기록만 정리할 수 있다';
  end if;
  return old;
end $$;
create trigger learning_mutations_append_only before update or delete on public.learning_mutations
  for each row execute function public.learning_mutations_append_only();

create function public.learning_records_delete_guard() returns trigger
-- security definer: 위와 같은 이유(auth.users 읽기 · knowledge_trials 재검토 표시)
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_trial uuid;
begin
  -- F7-4 계정 삭제 cascade — 허용하되, 분석 완료 실검증 표본이 줄면 그 검증을 재검토 필요로 표시
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    if tg_table_name = 'learning_task_attempts' and old.trial_id is not null then
      update public.knowledge_trials t set review_required_at = coalesce(t.review_required_at, now()),
             review_required_reason = coalesce(t.review_required_reason, '표본 학습자 계정 삭제로 표본이 바뀌었다 — 재계산 전에는 근거로 쓰지 않는다')
       where t.id = old.trial_id and t.status = 'analyzed' and not t.synthetic;
    end if;
    return old;
  end if;
  if not old.synthetic then
    raise exception '실제 학습자 기록은 지울 수 없다 — 합성 기록만 정리할 수 있다';
  end if;
  if tg_table_name = 'learning_task_attempts' then
    if exists (select 1 from public.knowledge_trials t where t.id = old.trial_id and t.status = 'analyzed' and not t.synthetic) then
      raise exception '분석 완료된 검증의 표본은 지울 수 없다';
    end if;
    -- 같은 첫 시도 묶음(학습자 · 과제 · 문항 · 단계)에 분석 완료 표본 시도가 있고 이 행이 그보다 이르거나 같으면 — 지우면 첫 시도가 바뀐다
    if exists (select 1 from public.learning_task_attempts x join public.knowledge_trials t on t.id = x.trial_id
               where t.status = 'analyzed' and not t.synthetic and x.user_id = old.user_id
                 and x.task_key is not distinct from old.task_key and coalesce(x.item_ref, '') = coalesce(old.item_ref, '') and x.phase = old.phase
                 and old.answered_at <= x.answered_at and x.id <> old.id) then
      raise exception '분석 완료된 검증 표본의 첫 시도 묶음에 있는 이른 시도는 지울 수 없다 — 표본의 첫 시도가 바뀐다';
    end if;
  end if;
  return old;
end $$;
create trigger learning_task_attempts_delete_guard before delete on public.learning_task_attempts
  for each row execute function public.learning_records_delete_guard();
create trigger learning_sessions_delete_guard before delete on public.learning_sessions
  for each row execute function public.learning_records_delete_guard();

-- ── F7-5 세션 변경 — M8 본문 + 기존 세션과 다른 synthetic 거부 한 줄 ──────────────────────────
create or replace function public.learning_session_apply(
  p_user uuid, p_mutation uuid, p_client_session_id uuid, p_activity text, p_phase text, p_item_ref text,
  p_stage text, p_step integer, p_steps integer, p_help_level text, p_at timestamptz,
  p_review_at timestamptz default null, p_deleted boolean default false, p_synthetic boolean default false,
  p_task_key text default null, p_application_id uuid default null, p_trial_id uuid default null,
  p_explanation_viewed_at timestamptz default null   -- M1(B8)
) returns table (session_id uuid, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_claim text;
  v_rank_new int := case p_stage when 'open' then 0 when 'revealed' then 1 else 2 end;
begin
  v_claim := public.learning_mutation_claim(p_user, p_mutation, 'session', p_client_session_id,
    jsonb_build_object('stage', p_stage, 'step', p_step, 'steps', p_steps, 'help', p_help_level, 'at', p_at,
                       'review_at', p_review_at, 'deleted', coalesce(p_deleted, false), 'item', p_item_ref, 'activity', p_activity,
                       'phase', p_phase, 'task', p_task_key, 'application', p_application_id, 'trial', p_trial_id,
                       'synthetic', coalesce(p_synthetic, false), 'explanation_viewed_at', p_explanation_viewed_at));
  if v_claim <> 'new' then
    select id into v_id from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id;
    session_id := v_id; outcome := v_claim; return next; return;
  end if;
  -- F7-5 기존 세션과 다른 합성 표시의 변경은 거부(예외 → 원장 예약까지 되돌린다)
  if exists (select 1 from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id
               and synthetic <> coalesce(p_synthetic, false)) then
    raise exception 'session synthetic mismatch — 세션의 합성 표시와 다른 변경은 받지 않는다';
  end if;

  insert into public.learning_sessions (user_id, client_session_id, activity, phase, item_ref, task_key, application_id, trial_id,
                                        started_at, last_active_at, synthetic)
  values (p_user, p_client_session_id, p_activity, p_phase, p_item_ref, p_task_key, p_application_id, p_trial_id, p_at, p_at, coalesce(p_synthetic, false))
  on conflict (user_id, client_session_id) do nothing;
  select id into v_id from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id;

  update public.learning_sessions s set
    stage = case when v_rank_new > (case s.stage when 'open' then 0 when 'revealed' then 1 else 2 end) then p_stage else s.stage end,
    help_level = case when v_rank_new >= 1 and (case p_help_level when 'viewed_first' then 2 when 'hint' then 1 when 'independent' then 0 else -1 end) > (case s.help_level when 'viewed_first' then 2 when 'hint' then 1 when 'independent' then 0 else -1 end) then p_help_level else s.help_level end,
    help_received_at = case when v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') then least(s.help_received_at, p_at) else s.help_received_at end,
    help_server_at = case when v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') then least(s.help_server_at, now()) else s.help_server_at end,
    help_clock_suspect = s.help_clock_suspect or (v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') and p_at > now() + interval '2 minutes')
                         or (p_explanation_viewed_at is not null and p_explanation_viewed_at > now() + interval '2 minutes'),
    explanation_server_at = case when p_explanation_viewed_at is not null then least(s.explanation_server_at, now()) else s.explanation_server_at end,
    revealed_at = case when v_rank_new >= 1 and (s.revealed_at is null or p_at < s.revealed_at) then p_at else s.revealed_at end,
    finished_at = coalesce(s.finished_at, case when v_rank_new = 2 then p_at end),
    review_at = coalesce(s.review_at, p_review_at),
    explanation_viewed_at = least(s.explanation_viewed_at, p_explanation_viewed_at),
    step = case when p_at >= s.last_active_at and s.stage <> 'finished' then p_step else s.step end,
    steps = case when p_at >= s.last_active_at then p_steps else s.steps end,
    last_active_at = greatest(s.last_active_at, p_at),
    deleted_at = coalesce(s.deleted_at, case when p_deleted then p_at end)
  where s.id = v_id;

  session_id := v_id; outcome := 'applied'; return next;
end $$;

-- ── 되돌리기(한 트랜잭션 · 각 줄 앞의 「-- 」를 벗겨 실행) ────────────────────
-- 검증: scripts/knowledge/g2-f7-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.
-- 검증 메모: learning_session_apply 는 M8 본문(20261008180000)으로 되돌린다 — F7-5 한 줄만 빠진다.
-- begin;
-- create or replace function public.learning_session_apply(
--   p_user uuid, p_mutation uuid, p_client_session_id uuid, p_activity text, p_phase text, p_item_ref text,
--   p_stage text, p_step integer, p_steps integer, p_help_level text, p_at timestamptz,
--   p_review_at timestamptz default null, p_deleted boolean default false, p_synthetic boolean default false,
--   p_task_key text default null, p_application_id uuid default null, p_trial_id uuid default null,
--   p_explanation_viewed_at timestamptz default null
-- ) returns table (session_id uuid, outcome text)
-- language plpgsql security invoker set search_path = '' as $$
-- declare
--   v_id uuid;
--   v_claim text;
--   v_rank_new int := case p_stage when 'open' then 0 when 'revealed' then 1 else 2 end;
-- begin
--   v_claim := public.learning_mutation_claim(p_user, p_mutation, 'session', p_client_session_id,
--     jsonb_build_object('stage', p_stage, 'step', p_step, 'steps', p_steps, 'help', p_help_level, 'at', p_at,
--                        'review_at', p_review_at, 'deleted', coalesce(p_deleted, false), 'item', p_item_ref, 'activity', p_activity,
--                        'phase', p_phase, 'task', p_task_key, 'application', p_application_id, 'trial', p_trial_id,
--                        'synthetic', coalesce(p_synthetic, false), 'explanation_viewed_at', p_explanation_viewed_at));
--   if v_claim <> 'new' then
--     select id into v_id from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id;
--     session_id := v_id; outcome := v_claim; return next; return;
--   end if;
--   insert into public.learning_sessions (user_id, client_session_id, activity, phase, item_ref, task_key, application_id, trial_id,
--                                         started_at, last_active_at, synthetic)
--   values (p_user, p_client_session_id, p_activity, p_phase, p_item_ref, p_task_key, p_application_id, p_trial_id, p_at, p_at, coalesce(p_synthetic, false))
--   on conflict (user_id, client_session_id) do nothing;
--   select id into v_id from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id;
--   update public.learning_sessions s set
--     stage = case when v_rank_new > (case s.stage when 'open' then 0 when 'revealed' then 1 else 2 end) then p_stage else s.stage end,
--     help_level = case when v_rank_new >= 1 and (case p_help_level when 'viewed_first' then 2 when 'hint' then 1 when 'independent' then 0 else -1 end) > (case s.help_level when 'viewed_first' then 2 when 'hint' then 1 when 'independent' then 0 else -1 end) then p_help_level else s.help_level end,
--     help_received_at = case when v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') then least(s.help_received_at, p_at) else s.help_received_at end,
--     help_server_at = case when v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') then least(s.help_server_at, now()) else s.help_server_at end,
--     help_clock_suspect = s.help_clock_suspect or (v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') and p_at > now() + interval '2 minutes')
--                          or (p_explanation_viewed_at is not null and p_explanation_viewed_at > now() + interval '2 minutes'),
--     explanation_server_at = case when p_explanation_viewed_at is not null then least(s.explanation_server_at, now()) else s.explanation_server_at end,
--     revealed_at = case when v_rank_new >= 1 and (s.revealed_at is null or p_at < s.revealed_at) then p_at else s.revealed_at end,
--     finished_at = coalesce(s.finished_at, case when v_rank_new = 2 then p_at end),
--     review_at = coalesce(s.review_at, p_review_at),
--     explanation_viewed_at = least(s.explanation_viewed_at, p_explanation_viewed_at),
--     step = case when p_at >= s.last_active_at and s.stage <> 'finished' then p_step else s.step end,
--     steps = case when p_at >= s.last_active_at then p_steps else s.steps end,
--     last_active_at = greatest(s.last_active_at, p_at),
--     deleted_at = coalesce(s.deleted_at, case when p_deleted then p_at end)
--   where s.id = v_id;
--   session_id := v_id; outcome := 'applied'; return next;
-- end $$;
-- drop trigger learning_sessions_delete_guard on public.learning_sessions;
-- drop trigger learning_task_attempts_delete_guard on public.learning_task_attempts;
-- drop function public.learning_records_delete_guard();
-- drop trigger learning_mutations_append_only on public.learning_mutations;
-- drop function public.learning_mutations_append_only();
-- alter table public.knowledge_trials drop column review_required_reason;
-- alter table public.knowledge_trials drop column review_required_at;
-- grant update on public.learning_mutations to service_role;
-- grant truncate on public.learning_mutations, public.learning_sessions, public.learning_task_attempts to service_role;
-- commit;
