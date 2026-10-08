-- supabase/migrations/_pending_20261008180000_learning_help_timing.sql
--
-- **M8 — 도움 노출 시각 기준 독립 판정 · 시각 불확실 보류 · 세션 합성 표시 불변.** 미적용 · 승인 대기(2026-10-08 f5 단독 통합 세션).
-- 전제: 20261008160000_learning_sessions_integrated(적용됨 · sha256 8d1d0624…) — 그 파일은 다시 돌리지 않는다. 이 파일은 그 위에 얹는 추가 마이그레이션.
--
-- 고치는 것
--   M8-A 과소 집계: 첫 시도 뷰가 세션의 **현재** 도움 수준을 세션의 모든 시도에 붙였다(M5a′ 가장 많이 도움받은 쪽이 이김).
--        세션 안에서 독립으로 판단한 뒤 해설을 먼저 본 기록이 나중에 오면(다른 기기 · 오프라인 동기화) 앞선 독립 판단까지 viewed_first 가 된다.
--        → 세션에 「첫 도움 노출 시각」 help_received_at 을 두고, 시도별 실효 도움 = 판단 시각 ≥ 첫 노출 시각일 때만 세션 도움 수준.
--   M8-B 오염 방지: 도움 노출이 판단보다 같거나 이르면(동시 포함) 도움받은 판단이다 — 동률은 도움 쪽(보수적).
--   M8-C 시각 불확실 보류: 판단 시각은 기기 시각이다. ① 판단 시각과 첫 도움 노출 또는 해설 열람이 2분 안 ② 판단 시각이 서버 수신 시각보다 2분 넘게 미래
--        → timing_uncertain. 효과 게이트(M3)는 이 표본을 세지 않는다(판정 보류 · 행은 그대로).
--   M8-G 두 기기 시계(Codex P1): 도움 쪽 서버 수신 시각 help_server_at · 미래 시계 표시 help_clock_suspect.
--        ③ 도움 기록 기기 시계가 2분 넘게 미래 ④ 서버가 도움을 먼저 받았는데 그 뒤 도착한 판단이 도움보다 이르다고 주장 → 보류.
--   M8-D 소급 재작성 없음: 시도 행은 고치지 않는다. 실효 도움은 뷰가 계산한다. 서버 수신 시각 received_at 은 새 행부터(기존 행 NULL = 서버 now() 로 판단 시각이 찍힌 직접 기록).
--   M8-E 표본 고정 확장: 분석 완료 표본 세션의 help_received_at 도 바꿀 수 없다. **세션 synthetic 은 언제나 불변**(170000 trial synthetic 불변과 같은 원칙 · Codex P1 2026-10-08 vocaflow-18 전달).
--        시도 쪽 synthetic 은 learning_trial_sample_frozen_attempt 가 이미 막는다(분석 완료 표본 시도의 UPDATE 전부 거부).
-- 기존 데이터 영향: 세션 help_received_at 백필 = 도움 받은 세션(hint · viewed_first)의 revealed_at(가장 이른 공개 — 실제 노출보다 같거나 이르다 → 보수적).
--   시도 행 · 세션의 다른 열은 바뀌지 않는다. 기존 학습 · 검토 · 수행 기록 삭제 없음.
-- 검증: scripts/knowledge/g2-m8-test.mjs(격리 PostgreSQL — 공유 개발 DB 미사용) · 되돌리기 블록도 그 하네스가 실제로 실행한다.

-- ── 열 ─────────────────────────────────────────────────────────────────
alter table public.learning_sessions add column help_received_at timestamptz;   -- M8 첫 도움(hint · viewed_first) 노출 시각 — 가장 이른 값
alter table public.learning_sessions add column help_server_at timestamptz;     -- M8-G 첫 도움 변경의 서버 수신 시각(가장 이른 값 · 기존 행 NULL)
alter table public.learning_sessions add column help_clock_suspect boolean not null default false;  -- M8-G 도움 기록 기기의 시계가 서버보다 2분 넘게 미래였다
alter table public.learning_task_attempts add column received_at timestamptz;    -- M8 서버 수신 시각(기존 행 NULL)
alter table public.learning_task_attempts alter column received_at set default now();

update public.learning_sessions set help_received_at = revealed_at
 where help_level in ('hint', 'viewed_first') and help_received_at is null;

-- ── 세션 변경 — 160000 본문 + help_received_at 한 줄(M8) ──────────────────────────
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

  insert into public.learning_sessions (user_id, client_session_id, activity, phase, item_ref, task_key, application_id, trial_id,
                                        started_at, last_active_at, synthetic)
  values (p_user, p_client_session_id, p_activity, p_phase, p_item_ref, p_task_key, p_application_id, p_trial_id, p_at, p_at, coalesce(p_synthetic, false))
  on conflict (user_id, client_session_id) do nothing;
  select id into v_id from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id;

  update public.learning_sessions s set
    stage = case when v_rank_new > (case s.stage when 'open' then 0 when 'revealed' then 1 else 2 end) then p_stage else s.stage end,
    help_level = case when v_rank_new >= 1 and (case p_help_level when 'viewed_first' then 2 when 'hint' then 1 when 'independent' then 0 else -1 end) > (case s.help_level when 'viewed_first' then 2 when 'hint' then 1 when 'independent' then 0 else -1 end) then p_help_level else s.help_level end,
    -- M8 첫 도움 노출 시각 = 도움(hint · viewed_first) 변경 중 가장 이른 p_at(도착순 무관 · least 는 NULL 을 건너뛴다)
    help_received_at = case when v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') then least(s.help_received_at, p_at) else s.help_received_at end,
    -- M8-G 도움 쪽 기기 시계 검사 — 서버 수신 시각과 「미래로 2분 넘게 앞선 도움 시각」 표시(뒤로 늦은 시각은 오프라인 지연과 구별할 수 없어 아래 뷰 규칙이 맡는다)
    help_server_at = case when v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') then least(s.help_server_at, now()) else s.help_server_at end,
    help_clock_suspect = s.help_clock_suspect or (v_rank_new >= 1 and p_help_level in ('hint', 'viewed_first') and p_at > now() + interval '2 minutes'),
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

-- ── 첫 시도 뷰 — 실효 도움 = 판단 시각 기준(M8-A · B) · 시각 불확실(M8-C) 열 추가 ─────────────
-- 열 순서 · 이름은 160000 그대로(create or replace view 는 끝에만 덧붙일 수 있다)
create or replace view public.learning_first_attempts with (security_invoker = true) as
select distinct on (a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase)
  a.id as attempt_id, a.user_id, a.task_key, a.item_ref, a.phase, a.activity, a.session_id, a.is_correct, a.answered_at,
  case when s.id is null then a.help_level
       when s.help_received_at is null then s.help_level
       when a.answered_at >= s.help_received_at then s.help_level
       else 'independent' end as help_level,
  (case when s.id is null then a.help_level
        when s.help_received_at is null then s.help_level
        when a.answered_at >= s.help_received_at then s.help_level
        else 'independent' end) = 'viewed_first' as after_viewed_first,
  (s.explanation_viewed_at is not null and a.answered_at >= s.explanation_viewed_at) as after_explanation,
  (a.synthetic or coalesce(s.synthetic, false)) as synthetic,
  ((s.help_received_at is not null and abs(extract(epoch from (a.answered_at - s.help_received_at))) < 120)
    or (s.explanation_viewed_at is not null and abs(extract(epoch from (a.answered_at - s.explanation_viewed_at))) < 120)
    or (a.received_at is not null and a.answered_at > a.received_at + interval '2 minutes')
    -- M8-G 도움 기록 기기 시계가 미래였다 — 그 세션의 판단 순서는 믿지 않는다
    or coalesce(s.help_clock_suspect, false)
    -- M8-G 서버는 도움을 먼저 받았는데 판단이 그보다 이르다고 주장한다(판단 기기 시계가 늦거나 오프라인) — 독립으로 세지 않고 보류
    or (s.help_server_at is not null and a.received_at is not null and a.received_at > s.help_server_at
        and s.help_received_at is not null and a.answered_at < s.help_received_at)) as timing_uncertain
from public.learning_task_attempts a
left join public.learning_sessions s on s.id = a.session_id
order by a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase, a.answered_at, a.id;

-- ── M3 효과 게이트 — 시각 불확실 표본은 세지 않는다(M8-C) ──────────────────────────────
create or replace function public.knowledge_trials_analyzed_guard() returns trigger
language plpgsql set search_path = public as $$
declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
begin
  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
    perform 1 from public.learning_sessions where id in (select session_id from public.learning_task_attempts where trial_id = new.id and session_id is not null) order by id for update;
    if (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'pre' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain) < need
       or (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'post' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain) < need then
      raise exception '실제 학습자의 독립(independent) 첫 시도(사전 · 사후)가 최소 표본(%)에 못 미친다 — 시각이 불확실한 판단은 세지 않는다 · 분석 완료로 바꿀 수 없다', need;
    end if;
  end if;
  return new;
end $$;

-- ── M8-E 세션 고정 — synthetic 은 언제나 불변 · 분석 완료 표본 세션은 도움 노출 시각도 불변 ───────────
create or replace function public.learning_trial_sample_frozen_session() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.synthetic is distinct from old.synthetic then
    raise exception '세션의 합성 표시는 바꿀 수 없다 — 새 세션으로';
  end if;
  if (new.help_level is distinct from old.help_level or new.revealed_at is distinct from old.revealed_at
      or new.explanation_viewed_at is distinct from old.explanation_viewed_at or new.help_received_at is distinct from old.help_received_at
      or new.help_server_at is distinct from old.help_server_at or new.help_clock_suspect is distinct from old.help_clock_suspect)
     and exists (select 1 from public.learning_task_attempts a join public.knowledge_trials t on t.id = a.trial_id
                 where a.session_id = new.id and t.status = 'analyzed' and not t.synthetic for share of t) then
    raise exception '분석 완료된 검증 표본의 세션은 공개 · 도움 · 해설 시각을 바꿀 수 없다';
  end if;
  return new;
end $$;

-- ── M8-F 표본 직렬화 · 시도 synthetic 불변 ─────────────────────────────────────────────
-- 분석 완료 전환과 시도 쓰기를 같은 권고 잠금으로 직렬화한다: 시도 쓰기 = 공유(서로 막지 않음) · 분석 전환 = 배타.
-- 커밋 전 더 이른 시도가 분석 뒤에 커밋돼 첫 표본 · 최소 표본을 바꾸던 경쟁을 닫는다(Codex P1 2026-10-08).
-- 시도 synthetic 도 불변 — 세션 없는 시도의 합성 표시를 뒤집어 게이트를 우회하던 길(vocaflow-18 격리 재현)을 닫는다.
create or replace function public.learning_trial_sample_frozen_attempt() returns trigger
language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock_shared(hashtext('learning_trial_sample'));
  if tg_op = 'UPDATE' and new.synthetic is distinct from old.synthetic then
    raise exception '시도의 합성 표시는 바꿀 수 없다 — 새 기록으로';
  end if;
  if exists (select 1 from public.knowledge_trials t
             where t.id in (new.trial_id, case when tg_op = 'UPDATE' then old.trial_id end)
               and t.status = 'analyzed' and not t.synthetic for share) then
    raise exception '분석 완료된 검증의 표본에는 시도를 더하거나 고칠 수 없다 — 새 검증으로';
  end if;
  if exists (select 1 from public.learning_task_attempts x join public.knowledge_trials t on t.id = x.trial_id
             where t.status = 'analyzed' and not t.synthetic and x.user_id = new.user_id
               and x.task_key is not distinct from new.task_key and coalesce(x.item_ref, '') = coalesce(new.item_ref, '') and x.phase = new.phase
               and new.answered_at <= x.answered_at and x.id is distinct from new.id
             for share of t) then
    raise exception '분석 완료된 검증 표본의 첫 시도보다 이른 시도는 넣을 수 없다 — 표본의 첫 시도가 바뀐다';
  end if;
  return new;
end $$;

create or replace function public.knowledge_trials_analyzed_guard() returns trigger
language plpgsql set search_path = public as $$
declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
begin
  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
    -- M8-F 진행 중인 시도 쓰기가 모두 끝날 때까지 기다리고, 이 트랜잭션이 끝날 때까지 새 시도 쓰기를 막는다
    perform pg_advisory_xact_lock(hashtext('learning_trial_sample'));
    perform 1 from public.learning_sessions where id in (select session_id from public.learning_task_attempts where trial_id = new.id and session_id is not null) order by id for update;
    if (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'pre' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain) < need
       or (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'post' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false) and not f.timing_uncertain) < need then
      raise exception '실제 학습자의 독립(independent) 첫 시도(사전 · 사후)가 최소 표본(%)에 못 미친다 — 시각이 불확실한 판단은 세지 않는다 · 분석 완료로 바꿀 수 없다', need;
    end if;
  end if;
  return new;
end $$;

-- ── 되돌리기(한 트랜잭션 · 각 줄 앞의 「-- 」를 벗겨 실행) ────────────────────
-- 검증: scripts/knowledge/g2-m8-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.
-- begin;
-- create or replace function public.learning_trial_sample_frozen_attempt() returns trigger
-- language plpgsql set search_path = public as $$
-- begin
--   if exists (select 1 from public.knowledge_trials t
--              where t.id in (new.trial_id, case when tg_op = 'UPDATE' then old.trial_id end)
--                and t.status = 'analyzed' and not t.synthetic for share) then
--     raise exception '분석 완료된 검증의 표본에는 시도를 더하거나 고칠 수 없다 — 새 검증으로';
--   end if;
--   if exists (select 1 from public.learning_task_attempts x join public.knowledge_trials t on t.id = x.trial_id
--              where t.status = 'analyzed' and not t.synthetic and x.user_id = new.user_id
--                and x.task_key is not distinct from new.task_key and coalesce(x.item_ref, '') = coalesce(new.item_ref, '') and x.phase = new.phase
--                and new.answered_at <= x.answered_at and x.id is distinct from new.id
--              for share of t) then
--     raise exception '분석 완료된 검증 표본의 첫 시도보다 이른 시도는 넣을 수 없다 — 표본의 첫 시도가 바뀐다';
--   end if;
--   return new;
-- end $$;
-- create or replace function public.learning_trial_sample_frozen_session() returns trigger
-- language plpgsql set search_path = public as $$
-- begin
--   if (new.help_level is distinct from old.help_level or new.revealed_at is distinct from old.revealed_at
--       or new.explanation_viewed_at is distinct from old.explanation_viewed_at)
--      and exists (select 1 from public.learning_task_attempts a join public.knowledge_trials t on t.id = a.trial_id
--                  where a.session_id = new.id and t.status = 'analyzed' and not t.synthetic for share of t) then
--     raise exception '분석 완료된 검증 표본의 세션은 공개 · 도움 · 해설 시각을 바꿀 수 없다';
--   end if;
--   return new;
-- end $$;
-- create or replace function public.knowledge_trials_analyzed_guard() returns trigger
-- language plpgsql set search_path = public as $$
-- declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
-- begin
--   if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
--     perform 1 from public.learning_sessions where id in (select session_id from public.learning_task_attempts where trial_id = new.id and session_id is not null) order by id for update;
--     if (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
--           where a.trial_id = new.id and f.phase = 'pre' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false)) < need
--        or (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
--           where a.trial_id = new.id and f.phase = 'post' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false)) < need then
--       raise exception '실제 학습자의 독립(independent) 첫 시도(사전 · 사후)가 최소 표본(%)에 못 미친다 — 분석 완료로 바꿀 수 없다', need;
--     end if;
--   end if;
--   return new;
-- end $$;
-- drop view public.learning_first_attempts;
-- create view public.learning_first_attempts with (security_invoker = true) as
-- select distinct on (a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase)
--   a.id as attempt_id, a.user_id, a.task_key, a.item_ref, a.phase, a.activity, a.session_id, a.is_correct, a.answered_at,
--   coalesce(s.help_level, a.help_level) as help_level,
--   (coalesce(s.help_level, a.help_level) = 'viewed_first') as after_viewed_first,
--   (s.explanation_viewed_at is not null and a.answered_at >= s.explanation_viewed_at) as after_explanation,
--   (a.synthetic or coalesce(s.synthetic, false)) as synthetic
-- from public.learning_task_attempts a
-- left join public.learning_sessions s on s.id = a.session_id
-- order by a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase, a.answered_at, a.id;
-- revoke all on public.learning_first_attempts from anon;
-- grant select on public.learning_first_attempts to authenticated, service_role;
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
-- alter table public.learning_task_attempts drop column received_at;
-- alter table public.learning_sessions drop column help_received_at;
-- alter table public.learning_sessions drop column help_server_at;
-- alter table public.learning_sessions drop column help_clock_suspect;
-- commit;
