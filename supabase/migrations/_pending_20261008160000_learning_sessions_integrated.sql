-- supabase/migrations/_pending_20261008160000_learning_sessions_integrated.sql
--
-- **통합 SQL 세트 — 미적용 · 승인 대기 · 적용 담당 vocaflow-18 단독**(2026-10-08 사용자 결정). methodology 세션 = 계약 · 설계 · 검증.
-- 원본: 기출 쪽 검토 초안 sha256 779eb9bb0812719702e16e4fcf34fe5813ed6f9adaa8173cc81a1f7aa4182a01(origin/feat/csat-learning-loop-g1 · docs/csat-learner/g2-draft/)를
--       scripts/knowledge/build-g2-integrated.mjs 가 정확한 치환으로 조립 — 바뀐 곳은 M1–M4 표시가 붙은 줄뿐.
-- methodology 쪽 추가(M1–M3):
--   M1 (B8) learning_sessions.explanation_viewed_at — 판단 뒤 해설 열람 시각(먼저 정한 값 유지) · learning_session_apply(p_explanation_viewed_at)
--   M2 learning_first_attempts.after_explanation — 해설을 연 뒤의 판단은 독립 판단이 아니다
--   M3 knowledge_trials_analyzed_guard — 최소 표본을 실제 학습자의 「독립 첫 시도」로만 센다(합성 · 해설 먼저 · 해설 뒤 · 반복 제외)
-- 대체: methodology _pending_20261008140100(client_attempt_id) 은 이 세트의 client_mutation_id 로 흡수 — 그 후보는 적용하지 않는다.
-- 배포 순서 계약: ① 이 SQL 적용(vocaflow-18) ② 사후 검사 ③ 코드 전환 — 문항 과제 POST /api/csat/item/[slug]/task · /csat/practice 기록을
--   learning_attempt_record(client_mutation_id · answered_at 필수)로. ①보다 먼저 ③을 배포하지 않는다(RPC 없음 → 500).
--   기존 직접 INSERT 경로는 ③ 전까지 그대로 동작한다(새 열은 모두 NULL 허용).
--
-- 아래는 원본 초안 머리말이다.
-- docs/csat-learner/g2-draft/20261008160000_learning_sessions_integrated.sql
--
-- ⚠️ **통합 초안 — 미적용 · 승인 대기.** supabase/migrations 에 두지 않는다(자동 적용 · 번호 선점 방지).
--    적용은 사용자 승인 + 지정된 단일 DB 쓰기 담당 세션만. 근거: docs/csat-learner/G2_SESSION_CONTRACT.md · G2_INTEGRATION_REVIEW.md
--
-- 합치는 것(한 세트):
--   ① 서버 학습 세션 표 learning_sessions — 판단 0건(열기만 · 「모르겠어요」) 세션도 이력
--   ② 요청 멱등 원장 learning_mutations — user_id + client_mutation_id (세션 변경 · 시도 기록 공통)
--   ③ learning_task_attempts 확장 — session_id · activity · help_level · client_mutation_id · phase 'review'
--      (methodology-vnext 의 _pending_20261008140100(client_attempt_id) 를 **대체**한다 — 같은 목적, 사용자 결정 명칭)
--   ④ 기록 RPC 2종 — inserted / duplicate / conflict (같은 키 · 다른 내용은 덮지 않는다)
--   ⑤ 첫 시도 뷰 — 「학습 계약상 첫 판단 제출」(네트워크상 첫 INSERT 가 아님)
--   ⑥ funnel_events CHECK — 기존 68 ∪ knowledge 2 ∪ 기출 13 = 83 (한 번에)
--
-- 번호: 개발 DB 최신 적용 20261008150000(methodology-vnext) 다음. 적용 직전 `ls supabase/migrations` + schema_migrations 로 다시 확인.
-- 기존 데이터 영향: learning_task_attempts 0행(2026-10-08) · 새 표 2개 빈 표 · funnel_events 는 CHECK 재정의만(기존 20,722행 전부 기존 68종 안 — 재검증 통과).
-- 되돌리기: 맨 끝 주석 블록.

begin;

-- ── ① 학습 세션 ───────────────────────────────────────────────────────────
create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id uuid not null,                                -- 기기가 만든 세션 id(G1 기기 기록 sessions[].id 와 짝)
  activity text not null check (activity in ('theater', 'dissect', 'practice')),
  phase text not null default 'practice' check (phase in ('pre', 'practice', 'post', 'delayed', 'transfer', 'review')),
  item_ref text not null check (length(item_ref) between 1 and 120), -- 기출 = csat_items.id · 비기출 과제 = 과제 식별자
  task_key text check (task_key is null or length(task_key) between 1 and 120),
  application_id uuid references public.knowledge_applications(id),
  trial_id uuid references public.knowledge_trials(id),
  stage text not null default 'open' check (stage in ('open', 'revealed', 'finished')),
  step integer not null default 0 check (step between 0 and 500),
  steps integer not null default 0 check (steps between 0 and 500),
  help_level text check (help_level in ('independent', 'hint', 'viewed_first')),
  started_at timestamptz not null,
  last_active_at timestamptz not null,
  revealed_at timestamptz,
  finished_at timestamptz,
  review_at timestamptz,
  explanation_viewed_at timestamptz,                               -- M1(B8) 판단 뒤 해설 열람 시각 — 먼저 정한 값 유지
  deleted_at timestamptz,                                           -- 삭제 표시(tombstone) — 행은 지우지 않는다
  client_kind text not null default 'web' check (client_kind in ('web', 'agent', 'import')),
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, client_session_id),
  -- 단계 정합성: 공개 전엔 도움 수준 · 공개 시각이 없고, 공개 뒤엔 둘 다 있다. 마침은 공개 뒤에만.
  constraint learning_sessions_stage_shape check (
    (stage = 'open' and help_level is null and revealed_at is null and finished_at is null)
    or (stage = 'revealed' and help_level is not null and revealed_at is not null and finished_at is null)
    or (stage = 'finished' and help_level is not null and revealed_at is not null and finished_at is not null)
  ),
  constraint learning_sessions_review_after_finish check (review_at is null or finished_at is not null)
);
create index learning_sessions_user_recent_idx on public.learning_sessions (user_id, last_active_at desc);
create index learning_sessions_user_item_idx on public.learning_sessions (user_id, item_ref);

-- ── ② 요청 멱등 원장 ─────────────────────────────────────────────────────
-- 같은 논리적 변경의 재시도만 같은 id. 새 사용자 행동은 언제나 새 id(G2 계약 §2).
create table public.learning_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_mutation_id uuid not null,
  kind text not null check (kind in ('session', 'attempt')),
  target uuid not null,          -- 세션 변경: client_session_id(세션 행을 만들기 **전에** 예약) · 시도: 소속 세션 id(없으면 0-uuid)
  payload jsonb not null,        -- 의미 비교용(jsonb 동등 — 키 순서 무관)
  applied_at timestamptz not null default now(),
  primary key (user_id, client_mutation_id)
);

-- ── ③ 시도 표 확장(모두 NULL 허용 — practice 기존 호출 코드 호환) ─────────────
alter table public.learning_task_attempts
  add column session_id uuid references public.learning_sessions(id),
  add column activity text check (activity is null or activity in ('theater', 'dissect', 'practice')),
  add column help_level text check (help_level is null or help_level in ('independent', 'hint', 'viewed_first')),
  add column client_mutation_id uuid;
create unique index learning_task_attempts_mutation_uniq
  on public.learning_task_attempts (user_id, client_mutation_id) where client_mutation_id is not null;
create index learning_task_attempts_session_idx on public.learning_task_attempts (session_id) where session_id is not null;
alter table public.learning_task_attempts drop constraint learning_task_attempts_phase_check;
alter table public.learning_task_attempts
  add constraint learning_task_attempts_phase_check check (phase in ('pre', 'practice', 'post', 'delayed', 'transfer', 'review'));

-- ── ④ 기록 RPC(서버 service_role 전용) ────────────────────────────────────
-- 같은 mutation id · 같은 내용 → duplicate(기존 결과) · 다른 내용 → conflict(아무것도 바꾸지 않음)
create function public.learning_mutation_claim(p_user uuid, p_mutation uuid, p_kind text, p_target uuid, p_payload jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare v public.learning_mutations%rowtype;
begin
  insert into public.learning_mutations (user_id, client_mutation_id, kind, target, payload)
  values (p_user, p_mutation, p_kind, p_target, p_payload)
  on conflict (user_id, client_mutation_id) do nothing;
  if found then return 'new'; end if;
  select * into v from public.learning_mutations where user_id = p_user and client_mutation_id = p_mutation;
  if v.kind = p_kind and v.target = p_target and v.payload = p_payload then return 'duplicate'; end if;
  return 'conflict';
end $$;

-- 세션 변경 — 단조 규칙(G0 §4): stage 는 앞으로만 · finished/review/revealed 시각과 도움 수준은 먼저 정한 값 · step 은 최신
create function public.learning_session_apply(
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
  -- 멱등 예약을 **세션 행을 만들기 전에** 한다 — conflict 면 아무것도(빈 세션조차) 남기지 않는다(Codex 리뷰 P1).
  -- 대상은 client_session_id · 모든 의미 입력을 비교한다(task_key · application · trial · synthetic 포함).
  v_claim := public.learning_mutation_claim(p_user, p_mutation, 'session', p_client_session_id,
    jsonb_build_object('stage', p_stage, 'step', p_step, 'steps', p_steps, 'help', p_help_level, 'at', p_at,
                       'review_at', p_review_at, 'deleted', coalesce(p_deleted, false), 'item', p_item_ref, 'activity', p_activity,
                       'phase', p_phase, 'task', p_task_key, 'application', p_application_id, 'trial', p_trial_id,
                       'synthetic', coalesce(p_synthetic, false), 'explanation_viewed_at', p_explanation_viewed_at));  -- M1
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
    -- M5a 가장 이른 공개가 이긴다(도착순 아님 — 오프라인 동기화 순서와 무관)
    help_level = case when v_rank_new >= 1 and (s.revealed_at is null or p_at < s.revealed_at) then p_help_level else s.help_level end,
    revealed_at = case when v_rank_new >= 1 and (s.revealed_at is null or p_at < s.revealed_at) then p_at else s.revealed_at end,
    finished_at = coalesce(s.finished_at, case when v_rank_new = 2 then p_at end),
    review_at = coalesce(s.review_at, p_review_at),
    explanation_viewed_at = least(s.explanation_viewed_at, p_explanation_viewed_at),  -- M1 · M5a 가장 이른 열람(least 는 NULL 을 건너뛴다)
    step = case when p_at >= s.last_active_at and s.stage <> 'finished' then p_step else s.step end,
    steps = case when p_at >= s.last_active_at then p_steps else s.steps end,
    last_active_at = greatest(s.last_active_at, p_at),
    deleted_at = coalesce(s.deleted_at, case when p_deleted then p_at end)
  where s.id = v_id;

  session_id := v_id; outcome := 'applied'; return next;
end $$;

-- 시도 기록 — 판단 제출만(「모르겠어요」·해설 먼저는 시도가 아니다 → 세션의 help_level)
create function public.learning_attempt_record(
  p_user uuid, p_mutation uuid, p_session_id uuid, p_task_key text, p_activity text, p_phase text, p_help_level text,
  p_item_ref text, p_content_hash text, p_response jsonb, p_is_correct boolean, p_sec integer, p_synthetic boolean,
  p_application_id uuid default null, p_trial_id uuid default null,
  -- 판단한 시각(기기 시각). 오프라인 판단이 늦게 동기화돼도 「첫 시도」 순서는 이 값으로 정한다(Codex 리뷰 P1)
  p_answered_at timestamptz default null
) returns table (attempt_id bigint, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_claim text;
  v_answered timestamptz := coalesce(p_answered_at, now());
  v_s public.learning_sessions%rowtype;
  v_task text := p_task_key;
  v_activity text := p_activity;
  v_phase text := p_phase;
  v_help text := p_help_level;
  v_item text := p_item_ref;
begin
  -- 세션에 붙는 시도는 세션의 활동 · 단계 · 대상 · 과제 · 도움 수준을 **상속**한다. 다른 값을 보내면 거부한다 —
  -- 그렇지 않으면 viewed_first 세션의 시도가 independent 로 기록돼 「해설 먼저」 제외가 사라진다(Codex 리뷰 P1)
  if p_session_id is not null then
    select * into v_s from public.learning_sessions where id = p_session_id and user_id = p_user;
    if not found then raise exception 'session % does not belong to user', p_session_id; end if;
    if v_s.help_level is null then raise exception 'session % is not revealed — apply the reveal before recording an attempt', p_session_id; end if;
    if (p_activity is not null and p_activity <> v_s.activity)
       or (p_phase is not null and p_phase <> v_s.phase)
       or (p_item_ref is not null and p_item_ref <> v_s.item_ref)
       or (p_task_key is not null and v_s.task_key is not null and p_task_key <> v_s.task_key)
       or (p_help_level is not null and p_help_level <> v_s.help_level) then
      raise exception 'attempt metadata contradicts session %', p_session_id;
    end if;
    v_activity := v_s.activity;
    v_phase := v_s.phase;
    v_item := v_s.item_ref;
    v_task := coalesce(v_s.task_key, p_task_key);
    v_help := v_s.help_level;
  end if;
  -- 저장하는 모든 의미 입력을 비교한다 — application · trial · 판단 시각 포함(Codex 리뷰 P1)
  v_claim := public.learning_mutation_claim(p_user, p_mutation, 'attempt', coalesce(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object('task', v_task, 'activity', v_activity, 'phase', v_phase, 'help', v_help, 'item', v_item,
                       'hash', p_content_hash, 'response', coalesce(p_response, '{}'::jsonb), 'correct', p_is_correct, 'sec', p_sec,
                       'synthetic', coalesce(p_synthetic, false), 'application', p_application_id, 'trial', p_trial_id,
                       -- 기기가 보낸 판단 시각만 비교한다 — 서버가 채운 now() 는 재시도마다 달라 멱등을 깬다(하네스 실측).
                       -- 그래서 클라이언트는 판단 시각을 **반드시** 보낸다(첫 시도 순서의 근거)
                       'answered_at', p_answered_at));
  if v_claim <> 'new' then
    select id into attempt_id from public.learning_task_attempts where user_id = p_user and client_mutation_id = p_mutation;
    outcome := v_claim; return next; return;
  end if;
  insert into public.learning_task_attempts
    (user_id, client_mutation_id, session_id, task_key, activity, phase, help_level, item_ref, content_hash, response, is_correct, sec,
     synthetic, application_id, trial_id, answered_at)
  values (p_user, p_mutation, p_session_id, v_task, v_activity, v_phase, v_help, v_item, p_content_hash,
          coalesce(p_response, '{}'::jsonb), p_is_correct, p_sec, coalesce(p_synthetic, false), p_application_id, p_trial_id, v_answered)
  returning id into attempt_id;
  outcome := 'inserted'; return next;
end $$;

-- ── ⑤ 첫 시도 — 학습 계약상 첫 판단 제출(학습자 · 과제 · 대상 · 측정 단계별 가장 이른 시도) ────
-- 재전송은 멱등 키로 한 행뿐이므로 첫 시도가 둘이 될 수 없다. 해설을 먼저 본 세션의 판단은 제외 표시(효과 측정에서 뺄지는 소비자가 정함).
create view public.learning_first_attempts with (security_invoker = true) as
select distinct on (a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase)
  a.id as attempt_id, a.user_id, a.task_key, a.item_ref, a.phase, a.activity, a.session_id, a.is_correct, a.answered_at,
  -- 세션이 있으면 세션의 도움 수준이 정본(시도는 상속값) — 세션 없는 시도만 자기 값
  coalesce(s.help_level, a.help_level) as help_level,   -- M5b 실효 도움 수준(세션이 정본)
  (coalesce(s.help_level, a.help_level) = 'viewed_first') as after_viewed_first,
  -- M2 해설을 연 뒤의 판단은 독립 판단이 아니다(B8 — 세션의 열람 시각보다 늦은 판단)
  (s.explanation_viewed_at is not null and a.answered_at >= s.explanation_viewed_at) as after_explanation,
  a.synthetic
from public.learning_task_attempts a
left join public.learning_sessions s on s.id = a.session_id
order by a.user_id, a.task_key, coalesce(a.item_ref, ''), a.phase, a.answered_at, a.id;

-- ── M3 학습 원리 효과 게이트 — 최소 표본 = 실제 학습자의 독립 첫 시도 ────────────────────────
-- 20261008120000 의 knowledge_trials_analyzed_guard 는 trial 의 pre · post 기록 수를 학습자 단위로 셌다(반복 · 해설 뒤 판단 포함).
-- 이제 그 trial 에 묶인 시도 중 첫 시도 뷰에 오른 것 · 합성 아님 · 해설 먼저 아님 · 해설 뒤 아님만 센다.
create or replace function public.knowledge_trials_analyzed_guard() returns trigger
language plpgsql set search_path = public as $$
declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
begin
  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
    -- M5c 표본 세션을 잠근다 — 세는 동안 공개 · 해설 시각이 바뀌지 않게(아래 고정 트리거와 직렬화)
    perform 1 from public.learning_sessions where id in (select session_id from public.learning_task_attempts where trial_id = new.id and session_id is not null) order by id for update;
    if (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'pre' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false)) < need
       or (select count(distinct f.user_id) from public.learning_first_attempts f join public.learning_task_attempts a on a.id = f.attempt_id
          where a.trial_id = new.id and f.phase = 'post' and not f.synthetic and f.help_level = 'independent' and not coalesce(f.after_explanation, false)) < need then
      raise exception '실제 학습자의 독립(independent) 첫 시도(사전 · 사후)가 최소 표본(%)에 못 미친다 — 분석 완료로 바꿀 수 없다', need;
    end if;
  end if;
  return new;
end $$;

-- ── M5d 분석 완료된 실제 검증의 표본 고정 ────────────────────────────────────────────
create function public.learning_trial_sample_frozen_attempt() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.knowledge_trials t
             where t.id in (new.trial_id, case when tg_op = 'UPDATE' then old.trial_id end)
               and t.status = 'analyzed' and not t.synthetic for share) then
    raise exception '분석 완료된 검증의 표본에는 시도를 더하거나 고칠 수 없다 — 새 검증으로';
  end if;
  -- 첫 시도 뷰는 검증 구분 없이 (학습자 · 과제 · 문항 · 단계)마다 가장 이른 판단을 고른다 — 분석된 표본 시도보다 이르거나 같은 시도가
  -- 같은 묶음에 들어오면(검증 없는 시도라도) 표본의 첫 시도가 바뀐다. 그런 시도를 막는다(Codex P1 재리뷰 · 2026-10-08)
  if exists (select 1 from public.learning_task_attempts x join public.knowledge_trials t on t.id = x.trial_id
             where t.status = 'analyzed' and not t.synthetic and x.user_id = new.user_id
               and x.task_key is not distinct from new.task_key and coalesce(x.item_ref, '') = coalesce(new.item_ref, '') and x.phase = new.phase
               and new.answered_at <= x.answered_at and x.id is distinct from new.id
             for share of t) then
    raise exception '분석 완료된 검증 표본의 첫 시도보다 이른 시도는 넣을 수 없다 — 표본의 첫 시도가 바뀐다';
  end if;
  return new;
end $$;
create trigger learning_trial_sample_frozen_attempt before insert or update on public.learning_task_attempts
  for each row execute function public.learning_trial_sample_frozen_attempt();

create function public.learning_trial_sample_frozen_session() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.help_level is distinct from old.help_level or new.revealed_at is distinct from old.revealed_at
      or new.explanation_viewed_at is distinct from old.explanation_viewed_at)
     and exists (select 1 from public.learning_task_attempts a join public.knowledge_trials t on t.id = a.trial_id
                 where a.session_id = new.id and t.status = 'analyzed' and not t.synthetic for share of t) then
    raise exception '분석 완료된 검증 표본의 세션은 공개 · 도움 · 해설 시각을 바꿀 수 없다';
  end if;
  return new;
end $$;
create trigger learning_trial_sample_frozen_session before update on public.learning_sessions
  for each row execute function public.learning_trial_sample_frozen_session();

-- ── 권한 ────────────────────────────────────────────────────────────────
alter table public.learning_sessions enable row level security;
alter table public.learning_mutations enable row level security;
revoke all on public.learning_sessions from anon, authenticated;
revoke all on public.learning_mutations from anon, authenticated;
grant select on public.learning_sessions to authenticated;
create policy learning_sessions_own_select on public.learning_sessions for select to authenticated using (user_id = auth.uid());
grant select, insert, update on public.learning_sessions to service_role;   -- 쓰기는 서버 API(RPC)만
grant select, insert on public.learning_mutations to service_role;          -- 원장은 추가만
revoke all on public.learning_first_attempts from anon;
grant select on public.learning_first_attempts to authenticated, service_role;
revoke all on function public.learning_mutation_claim(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.learning_session_apply(uuid, uuid, uuid, text, text, text, text, integer, integer, text, timestamptz, timestamptz, boolean, boolean, text, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.learning_attempt_record(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, boolean, integer, boolean, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.learning_mutation_claim(uuid, uuid, text, uuid, jsonb) to service_role;
grant execute on function public.learning_session_apply(uuid, uuid, uuid, text, text, text, text, integer, integer, text, timestamptz, timestamptz, boolean, boolean, text, uuid, uuid, timestamptz) to service_role;
grant execute on function public.learning_attempt_record(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, boolean, integer, boolean, uuid, uuid, timestamptz) to service_role;

-- ── ⑥ 이벤트 허용 목록 — 기존 68 ∪ knowledge 2 ∪ 기출 13 = 83 ────────────────
alter table public.funnel_events drop constraint funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check check (event in (
  -- 기존 68(2026-10-08 개발 DB pg_constraint 에서 추출 · 정렬)
  'catalog_viewed', 'csat_atlas_scoped', 'csat_drill_answered', 'csat_drill_finished', 'csat_dx_attempt_saved', 'csat_dx_habit_answered',
  'csat_dx_history_compared', 'csat_dx_profile_saved', 'csat_dx_test_submitted', 'csat_dx_viewed', 'csat_ec_capture_closed',
  'csat_ec_capture_finished', 'csat_ec_capture_opened', 'csat_evidence_opened', 'csat_home_viewed', 'csat_item_back', 'csat_lecture_ended',
  'csat_lecture_played', 'csat_map_goal_set', 'csat_map_node_opened', 'csat_map_task_toggled', 'csat_map_viewed', 'csat_overlay_answered',
  'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_revealed', 'csat_paper_read', 'csat_path_chosen', 'csat_plan_ordered',
  'csat_plan_speed_set', 'csat_resume_clicked', 'csat_review_done', 'csat_review_started', 'csat_session_answered', 'csat_session_explained',
  'csat_session_finished', 'csat_session_marked', 'csat_session_started', 'csat_space_opened', 'csat_space_scoped', 'csat_trap_opened',
  'csat_workspace_created', 'csat_workspace_edited', 'csat_workspace_opened', 'csat_workspace_session_started',
  'csat_workspace_suggestion_applied', 'fit_analyzed', 'fit_level_moved', 'fit_share_opened', 'fit_shared', 'fit_sheet_opened',
  'fit_signup_clicked', 'fit_viewed', 'fit_worksheet_printed', 'hub_hero_moved', 'hub_promo_clicked', 'invite_shared', 'landing_cta_clicked',
  'landing_demo_moved', 'landing_section_reached', 'landing_viewed', 'screen_viewed', 'teacher_hub_view', 'video_completed', 'video_started',
  'volume_previewed', 'wayfinder_cta_clicked', 'wayfinder_opened',
  -- knowledge(Practice) 2
  'knowledge_task_viewed', 'knowledge_task_submitted',
  -- 기출 학습 13(G2 계약 §4-6)
  'csat_item_opened', 'csat_source_ready', 'csat_prediction_submitted', 'csat_prediction_skipped', 'csat_step_advanced',
  'csat_session_completed', 'csat_review_scheduled', 'csat_review_completed', 'csat_principle_saved', 'csat_transfer_submitted',
  'csat_browse_filtered', 'csat_paper_failed', 'csat_learning_error'
));

commit;

-- ── 되돌리기(한 트랜잭션 · 실행 가능한 완성본 — 각 줄 앞의 「-- 」를 벗겨 실행) ────────────────────
-- 전제: 적용 뒤 새 이벤트 · review phase · 세션 연결 시도 행이 생겼다면 먼저 처리해야 CHECK · FK 복원이 통과한다(G2_INTEGRATION_REVIEW §8).
-- 검증: scripts/knowledge/g2-integrated-test.mjs 가 이 블록을 격리 DB 에서 실제로 실행한다.
-- begin;
-- alter table public.funnel_events drop constraint funnel_events_event_check;
-- alter table public.funnel_events add constraint funnel_events_event_check check (event in ('catalog_viewed', 'csat_atlas_scoped', 'csat_drill_answered', 'csat_drill_finished', 'csat_dx_attempt_saved', 'csat_dx_habit_answered', 'csat_dx_history_compared', 'csat_dx_profile_saved', 'csat_dx_test_submitted', 'csat_dx_viewed', 'csat_ec_capture_closed', 'csat_ec_capture_finished', 'csat_ec_capture_opened', 'csat_evidence_opened', 'csat_home_viewed', 'csat_item_back', 'csat_lecture_ended', 'csat_lecture_played', 'csat_map_goal_set', 'csat_map_node_opened', 'csat_map_task_toggled', 'csat_map_viewed', 'csat_overlay_answered', 'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_revealed', 'csat_paper_read', 'csat_path_chosen', 'csat_plan_ordered', 'csat_plan_speed_set', 'csat_resume_clicked', 'csat_review_done', 'csat_review_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_finished', 'csat_session_marked', 'csat_session_started', 'csat_space_opened', 'csat_space_scoped', 'csat_trap_opened', 'csat_workspace_created', 'csat_workspace_edited', 'csat_workspace_opened', 'csat_workspace_session_started', 'csat_workspace_suggestion_applied', 'fit_analyzed', 'fit_level_moved', 'fit_share_opened', 'fit_shared', 'fit_sheet_opened', 'fit_signup_clicked', 'fit_viewed', 'fit_worksheet_printed', 'hub_hero_moved', 'hub_promo_clicked', 'invite_shared', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached', 'landing_viewed', 'screen_viewed', 'teacher_hub_view', 'video_completed', 'video_started', 'volume_previewed', 'wayfinder_cta_clicked', 'wayfinder_opened'));
-- drop trigger learning_trial_sample_frozen_session on public.learning_sessions;
-- drop function public.learning_trial_sample_frozen_session();
-- drop trigger learning_trial_sample_frozen_attempt on public.learning_task_attempts;
-- drop function public.learning_trial_sample_frozen_attempt();
-- create or replace function public.knowledge_trials_analyzed_guard() returns trigger
-- language plpgsql set search_path = public as $$
-- declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
-- begin
--   if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
--     if (select count(distinct user_id) from public.learning_task_attempts where trial_id = new.id and phase = 'pre' and not synthetic) < need
--        or (select count(distinct user_id) from public.learning_task_attempts where trial_id = new.id and phase = 'post' and not synthetic) < need then
--       raise exception '실제 학습자 사전 · 사후 기록이 최소 표본(%)에 못 미친다 — 분석 완료로 바꿀 수 없다', need;
--     end if;
--   end if;
--   return new;
-- end $$;
-- drop view public.learning_first_attempts;
-- drop function public.learning_attempt_record(uuid, uuid, uuid, text, text, text, text, text, text, jsonb, boolean, integer, boolean, uuid, uuid, timestamptz);
-- drop function public.learning_session_apply(uuid, uuid, uuid, text, text, text, text, integer, integer, text, timestamptz, timestamptz, boolean, boolean, text, uuid, uuid, timestamptz);
-- drop function public.learning_mutation_claim(uuid, uuid, text, uuid, jsonb);
-- alter table public.learning_task_attempts drop constraint learning_task_attempts_phase_check;
-- alter table public.learning_task_attempts add constraint learning_task_attempts_phase_check check (phase in ('pre','practice','post','delayed','transfer'));
-- drop index public.learning_task_attempts_session_idx;
-- drop index public.learning_task_attempts_mutation_uniq;
-- alter table public.learning_task_attempts drop column client_mutation_id, drop column help_level, drop column activity, drop column session_id;
-- drop table public.learning_mutations;
-- drop table public.learning_sessions;
-- commit;
