-- 격리 PostgreSQL 부트스트랩 — 개발 DB(jajenrevcbmrpaliomxv) 의 실제 정의를 2026-10-24 SELECT(pg_get_functiondef ·
-- pg_get_triggerdef · pg_get_viewdef · pg_attribute · pg_constraint)로 가져와 그대로 옮겼다. 정의 본문은 고치지 않았다.
-- 스텁은 Supabase 의존(auth 스키마 · 역할)과 knowledge_applications(외래 키 대상, id 만) 뿐이다.
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- 실제 Supabase 의 service_role 에는 auth.users SELECT 가 없다(2026-10-24 사후 검증 42501). 하네스도 같게 둔다 — 이전 하네스는 이 권한을 줘서 결함을 놓쳤다.
-- 단, 외래 키 검사는 표 소유자 권한으로 돌므로 FK 대상으로는 문제없다(postgres 소유).
create table public.knowledge_applications (id uuid primary key default gen_random_uuid());

-- ── 표(실제 열 · 기본값 · 제약) ───────────────────────────────
create table public.knowledge_trials (id uuid not null default gen_random_uuid(), application_id uuid not null, design jsonb not null, status text not null default 'planned'::text, synthetic boolean not null default false, result text, result_summary text, analyzed_at timestamp with time zone, created_by text not null, created_at timestamp with time zone not null default now(), review_required_at timestamp with time zone, review_required_reason text, sample_signature text,
  constraint knowledge_trials_application_id_fkey FOREIGN KEY (application_id) REFERENCES knowledge_applications(id), constraint knowledge_trials_check CHECK (((status <> 'analyzed'::text) OR ((result IS NOT NULL) AND (analyzed_at IS NOT NULL)))), constraint knowledge_trials_pkey PRIMARY KEY (id), constraint knowledge_trials_result_check CHECK ((result = ANY (ARRAY['supported'::text, 'mixed'::text, 'not_supported'::text, 'inconclusive'::text]))), constraint knowledge_trials_result_summary_check CHECK ((length(result_summary) <= 2000)), constraint knowledge_trials_review_required_reason_check CHECK (((review_required_reason IS NULL) OR (length(review_required_reason) <= 500))), constraint knowledge_trials_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'running'::text, 'analyzed'::text, 'stopped'::text]))));
create table public.learning_sessions (id uuid not null default gen_random_uuid(), user_id uuid not null, client_session_id uuid not null, activity text not null, phase text not null default 'practice'::text, item_ref text not null, task_key text, application_id uuid, trial_id uuid, stage text not null default 'open'::text, step integer not null default 0, steps integer not null default 0, help_level text, started_at timestamp with time zone not null, last_active_at timestamp with time zone not null, revealed_at timestamp with time zone, finished_at timestamp with time zone, review_at timestamp with time zone, explanation_viewed_at timestamp with time zone, deleted_at timestamp with time zone, client_kind text not null default 'web'::text, synthetic boolean not null default false, created_at timestamp with time zone not null default now(), help_received_at timestamp with time zone, help_server_at timestamp with time zone, help_clock_suspect boolean not null default false, explanation_server_at timestamp with time zone,
  constraint learning_sessions_activity_check CHECK ((activity = ANY (ARRAY['theater'::text, 'dissect'::text, 'practice'::text]))), constraint learning_sessions_application_id_fkey FOREIGN KEY (application_id) REFERENCES knowledge_applications(id), constraint learning_sessions_client_kind_check CHECK ((client_kind = ANY (ARRAY['web'::text, 'agent'::text, 'import'::text]))), constraint learning_sessions_help_level_check CHECK ((help_level = ANY (ARRAY['independent'::text, 'hint'::text, 'viewed_first'::text]))), constraint learning_sessions_item_ref_check CHECK (((length(item_ref) >= 1) AND (length(item_ref) <= 120))), constraint learning_sessions_phase_check CHECK ((phase = ANY (ARRAY['pre'::text, 'practice'::text, 'post'::text, 'delayed'::text, 'transfer'::text, 'review'::text]))), constraint learning_sessions_pkey PRIMARY KEY (id), constraint learning_sessions_review_after_finish CHECK (((review_at IS NULL) OR (finished_at IS NOT NULL))), constraint learning_sessions_stage_check CHECK ((stage = ANY (ARRAY['open'::text, 'revealed'::text, 'finished'::text]))), constraint learning_sessions_stage_shape CHECK ((((stage = 'open'::text) AND (help_level IS NULL) AND (revealed_at IS NULL) AND (finished_at IS NULL)) OR ((stage = 'revealed'::text) AND (help_level IS NOT NULL) AND (revealed_at IS NOT NULL) AND (finished_at IS NULL)) OR ((stage = 'finished'::text) AND (help_level IS NOT NULL) AND (revealed_at IS NOT NULL) AND (finished_at IS NOT NULL)))), constraint learning_sessions_step_check CHECK (((step >= 0) AND (step <= 500))), constraint learning_sessions_steps_check CHECK (((steps >= 0) AND (steps <= 500))), constraint learning_sessions_task_key_check CHECK (((task_key IS NULL) OR ((length(task_key) >= 1) AND (length(task_key) <= 120)))), constraint learning_sessions_trial_id_fkey FOREIGN KEY (trial_id) REFERENCES knowledge_trials(id), constraint learning_sessions_user_id_client_session_id_key UNIQUE (user_id, client_session_id), constraint learning_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE);
create table public.learning_task_attempts (id bigint generated always as identity not null, user_id uuid not null, task_key text not null, application_id uuid, trial_id uuid, synthetic boolean not null default false, item_ref text, content_hash text, phase text not null, response jsonb not null default '{}'::jsonb, is_correct boolean, sec integer, answered_at timestamp with time zone not null default now(), session_id uuid, activity text, help_level text, client_mutation_id uuid, received_at timestamp with time zone default now(),
  constraint learning_task_attempts_activity_check CHECK (((activity IS NULL) OR (activity = ANY (ARRAY['theater'::text, 'dissect'::text, 'practice'::text])))), constraint learning_task_attempts_application_id_fkey FOREIGN KEY (application_id) REFERENCES knowledge_applications(id), constraint learning_task_attempts_help_level_check CHECK (((help_level IS NULL) OR (help_level = ANY (ARRAY['independent'::text, 'hint'::text, 'viewed_first'::text])))), constraint learning_task_attempts_phase_check CHECK ((phase = ANY (ARRAY['pre'::text, 'practice'::text, 'post'::text, 'delayed'::text, 'transfer'::text, 'review'::text]))), constraint learning_task_attempts_pkey PRIMARY KEY (id), constraint learning_task_attempts_sec_check CHECK (((sec >= 0) AND (sec <= 7200))), constraint learning_task_attempts_session_id_fkey FOREIGN KEY (session_id) REFERENCES learning_sessions(id), constraint learning_task_attempts_task_key_check CHECK (((length(task_key) >= 1) AND (length(task_key) <= 120))), constraint learning_task_attempts_trial_id_fkey FOREIGN KEY (trial_id) REFERENCES knowledge_trials(id), constraint learning_task_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE);
create table public.learning_mutations (user_id uuid not null, client_mutation_id uuid not null, kind text not null, target uuid not null, payload jsonb not null, applied_at timestamp with time zone not null default now(),
  constraint learning_mutations_kind_check CHECK ((kind = ANY (ARRAY['session'::text, 'attempt'::text]))), constraint learning_mutations_pkey PRIMARY KEY (user_id, client_mutation_id), constraint learning_mutations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE);
alter table public.learning_sessions enable row level security;
alter table public.learning_task_attempts enable row level security;
create policy learning_sessions_own_select on public.learning_sessions for select using ((user_id = auth.uid()));
create policy learning_task_attempts_own_select on public.learning_task_attempts for select using ((user_id = auth.uid()));
grant select on public.learning_sessions, public.learning_task_attempts to authenticated;
grant all on public.learning_sessions, public.learning_task_attempts, public.learning_mutations, public.knowledge_trials, public.knowledge_applications to service_role;

-- ── 함수(실제 본문) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.learning_mutation_claim(p_user uuid, p_mutation uuid, p_kind text, p_target uuid, p_payload jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare v public.learning_mutations%rowtype;
begin
  insert into public.learning_mutations (user_id, client_mutation_id, kind, target, payload)
  values (p_user, p_mutation, p_kind, p_target, p_payload)
  on conflict (user_id, client_mutation_id) do nothing;
  if found then return 'new'; end if;
  select * into v from public.learning_mutations where user_id = p_user and client_mutation_id = p_mutation;
  if v.kind = p_kind and v.target = p_target and v.payload = p_payload then return 'duplicate'; end if;
  return 'conflict';
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_attempt_record(p_user uuid, p_mutation uuid, p_session_id uuid, p_task_key text, p_activity text, p_phase text, p_help_level text, p_item_ref text, p_content_hash text, p_response jsonb, p_is_correct boolean, p_sec integer, p_synthetic boolean, p_application_id uuid DEFAULT NULL::uuid, p_trial_id uuid DEFAULT NULL::uuid, p_answered_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(attempt_id bigint, outcome text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  v_claim := public.learning_mutation_claim(p_user, p_mutation, 'attempt', coalesce(p_session_id, '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object('task', p_task_key, 'activity', p_activity, 'phase', p_phase, 'help', p_help_level, 'item', p_item_ref,
                       'hash', p_content_hash, 'response', coalesce(p_response, '{}'::jsonb), 'correct', p_is_correct, 'sec', p_sec,
                       'synthetic', coalesce(p_synthetic, false), 'application', p_application_id, 'trial', p_trial_id,
                       'answered_at', p_answered_at));
  if v_claim <> 'new' then
    select id into attempt_id from public.learning_task_attempts where user_id = p_user and client_mutation_id = p_mutation;
    outcome := v_claim; return next; return;
  end if;
  if p_session_id is not null then
    select * into v_s from public.learning_sessions where id = p_session_id and user_id = p_user;
    if not found then raise exception 'session % does not belong to user', p_session_id; end if;
    if v_s.help_level is null then raise exception 'session % is not revealed — apply the reveal before recording an attempt', p_session_id; end if;
    if (p_activity is not null and p_activity <> v_s.activity)
       or (p_phase is not null and p_phase <> v_s.phase)
       or (p_item_ref is not null and p_item_ref <> v_s.item_ref)
       or (p_task_key is not null and v_s.task_key is not null and p_task_key <> v_s.task_key)
       or (p_help_level is not null and p_help_level <> v_s.help_level)
       or (coalesce(p_synthetic, false) <> v_s.synthetic) then
      raise exception 'attempt metadata contradicts session %', p_session_id;
    end if;
    v_activity := v_s.activity;
    v_phase := v_s.phase;
    v_item := v_s.item_ref;
    v_task := coalesce(v_s.task_key, p_task_key);
    v_help := v_s.help_level;
  end if;
  insert into public.learning_task_attempts
    (user_id, client_mutation_id, session_id, task_key, activity, phase, help_level, item_ref, content_hash, response, is_correct, sec,
     synthetic, application_id, trial_id, answered_at)
  values (p_user, p_mutation, p_session_id, v_task, v_activity, v_phase, v_help, v_item, p_content_hash,
          coalesce(p_response, '{}'::jsonb), p_is_correct, p_sec, coalesce(p_synthetic, false), p_application_id, p_trial_id, v_answered)
  returning id into attempt_id;
  outcome := 'inserted'; return next;
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_session_apply(p_user uuid, p_mutation uuid, p_client_session_id uuid, p_activity text, p_phase text, p_item_ref text, p_stage text, p_step integer, p_steps integer, p_help_level text, p_at timestamp with time zone, p_review_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_deleted boolean DEFAULT false, p_synthetic boolean DEFAULT false, p_task_key text DEFAULT NULL::text, p_application_id uuid DEFAULT NULL::uuid, p_trial_id uuid DEFAULT NULL::uuid, p_explanation_viewed_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(session_id uuid, outcome text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  if exists (select 1 from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id
               and synthetic <> coalesce(p_synthetic, false)) then
    raise exception 'session synthetic mismatch — 세션의 합성 표시와 다른 변경은 받지 않는다';
  end if;

  insert into public.learning_sessions (user_id, client_session_id, activity, phase, item_ref, task_key, application_id, trial_id,
                                        started_at, last_active_at, synthetic)
  values (p_user, p_client_session_id, p_activity, p_phase, p_item_ref, p_task_key, p_application_id, p_trial_id, p_at, p_at, coalesce(p_synthetic, false))
  on conflict (user_id, client_session_id) do nothing;
  select id into v_id from public.learning_sessions where user_id = p_user and client_session_id = p_client_session_id;
  if exists (select 1 from public.learning_sessions where id = v_id and synthetic <> coalesce(p_synthetic, false)) then
    raise exception 'session synthetic mismatch — 세션의 합성 표시와 다른 변경은 받지 않는다';
  end if;

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
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_attempt_submit(p_user uuid, p_mutation uuid, p_reveal_mutation uuid, p_client_session_id uuid, p_activity text, p_phase text, p_item_ref text, p_help_level text, p_answered_at timestamp with time zone, p_synthetic boolean, p_task_key text, p_application_id uuid, p_content_hash text, p_response jsonb, p_is_correct boolean, p_sec integer, p_trial_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(session_id uuid, attempt_id bigint, outcome text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_sid uuid;
  v_rev text;
begin
  perform pg_advisory_xact_lock_shared(hashtext('learning_trial_sample'));
  perform pg_advisory_xact_lock(hashtext('learning_attempt_submit:' || p_user::text || ':' || p_mutation::text));
  if exists (select 1 from public.learning_mutations m where m.user_id = p_user and m.client_mutation_id = p_mutation) then
    select a.session_id into v_sid from public.learning_task_attempts a where a.user_id = p_user and a.client_mutation_id = p_mutation;
  else
    select r.session_id, r.outcome into v_sid, v_rev from public.learning_session_apply(p_user, p_reveal_mutation, p_client_session_id, p_activity, p_phase, p_item_ref,
      'revealed', 0, 1, p_help_level, p_answered_at, null, false, p_synthetic, p_task_key, p_application_id, p_trial_id, null) r;
    if v_rev not in ('applied', 'duplicate') then raise exception 'session reveal %', v_rev; end if;
  end if;
  select r.attempt_id, r.outcome into attempt_id, outcome from public.learning_attempt_record(p_user, p_mutation, v_sid, p_task_key, p_activity, p_phase, null,
    p_item_ref, p_content_hash, p_response, p_is_correct, p_sec, p_synthetic, p_application_id, p_trial_id, p_answered_at) r;
  session_id := v_sid;
  return next;
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_mutations_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_syn boolean;
begin
  if tg_op = 'UPDATE' then
    raise exception '요청 원장은 고칠 수 없다(추가 전용)';
  end if;
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  if old.kind = 'session' then
    select s.synthetic into v_syn from public.learning_sessions s where s.user_id = old.user_id and s.client_session_id = old.target;
  else
    select a.synthetic into v_syn from public.learning_task_attempts a where a.user_id = old.user_id and a.client_mutation_id = old.client_mutation_id;
  end if;
  if not coalesce(v_syn, (old.payload->>'synthetic')::boolean, false) then
    raise exception '실제 학습자의 요청 원장은 지울 수 없다 — 합성 기록만 정리할 수 있다';
  end if;
  return old;
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_records_delete_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_trial uuid;
begin
  if tg_table_name = 'learning_task_attempts' and old.trial_id is not null then
    perform 1 from public.knowledge_trials where id = old.trial_id for update;
  end if;
  perform pg_advisory_xact_lock_shared(hashtext('learning_trial_sample'));
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
    if exists (select 1 from public.learning_task_attempts x join public.knowledge_trials t on t.id = x.trial_id
               where t.status = 'analyzed' and not t.synthetic and x.user_id = old.user_id
                 and x.task_key is not distinct from old.task_key and coalesce(x.item_ref, '') = coalesce(old.item_ref, '') and x.phase = old.phase
                 and old.answered_at <= x.answered_at and x.id <> old.id) then
      raise exception '분석 완료된 검증 표본의 첫 시도 묶음에 있는 이른 시도는 지울 수 없다 — 표본의 첫 시도가 바뀐다';
    end if;
  end if;
  return old;
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_records_owner_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.user_id is distinct from old.user_id then
    raise exception '학습 기록의 학습자(user_id)는 바꿀 수 없다';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_task_attempts_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.user_id is distinct from old.user_id then
    raise exception '학습 기록의 학습자(user_id)는 바꿀 수 없다';
  end if;
  if not old.synthetic then
    raise exception '실제 학습자의 수행 기록은 고칠 수 없다(추가 전용)';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_trial_sample_frozen_attempt()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.learning_trial_sample_frozen_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.synthetic is distinct from old.synthetic then
    raise exception '세션의 합성 표시는 바꿀 수 없다 — 새 세션으로';
  end if;
  if (new.help_level is distinct from old.help_level or new.revealed_at is distinct from old.revealed_at
      or new.explanation_viewed_at is distinct from old.explanation_viewed_at or new.help_received_at is distinct from old.help_received_at
      or new.help_server_at is distinct from old.help_server_at or new.help_clock_suspect is distinct from old.help_clock_suspect
      or new.explanation_server_at is distinct from old.explanation_server_at)
     and exists (select 1 from public.learning_task_attempts a join public.knowledge_trials t on t.id = a.trial_id
                 where a.session_id = new.id and t.status = 'analyzed' and not t.synthetic for share of t) then
    raise exception '분석 완료된 검증 표본의 세션은 공개 · 도움 · 해설 시각을 바꿀 수 없다';
  end if;
  return new;
end $function$
;

-- ── 트리거(실제 정의) ─────────────────────────────────────
CREATE TRIGGER learning_mutations_append_only BEFORE DELETE OR UPDATE ON public.learning_mutations FOR EACH ROW EXECUTE FUNCTION learning_mutations_append_only();
CREATE TRIGGER learning_sessions_delete_guard BEFORE DELETE ON public.learning_sessions FOR EACH ROW EXECUTE FUNCTION learning_records_delete_guard();
CREATE TRIGGER learning_sessions_owner_immutable BEFORE UPDATE OF user_id ON public.learning_sessions FOR EACH ROW EXECUTE FUNCTION learning_records_owner_immutable();
CREATE TRIGGER learning_task_attempts_delete_guard BEFORE DELETE ON public.learning_task_attempts FOR EACH ROW EXECUTE FUNCTION learning_records_delete_guard();
CREATE TRIGGER learning_task_attempts_update_guard BEFORE UPDATE ON public.learning_task_attempts FOR EACH ROW EXECUTE FUNCTION learning_task_attempts_update_guard();
CREATE TRIGGER learning_trial_sample_frozen_attempt BEFORE INSERT OR UPDATE ON public.learning_task_attempts FOR EACH ROW EXECUTE FUNCTION learning_trial_sample_frozen_attempt();
CREATE TRIGGER learning_trial_sample_frozen_session BEFORE UPDATE ON public.learning_sessions FOR EACH ROW EXECUTE FUNCTION learning_trial_sample_frozen_session();

-- ── 실제 뷰(learning_first_attempts, security_invoker) ─────────
create view public.learning_first_attempts with (security_invoker = true) as
 WITH base AS ( SELECT DISTINCT ON (a_1.user_id, a_1.task_key, (COALESCE(a_1.item_ref, ''::text)), a_1.phase) a_1.id, a_1.user_id, a_1.task_key, a_1.application_id, a_1.trial_id, a_1.synthetic, a_1.item_ref, a_1.content_hash, a_1.phase, a_1.response, a_1.is_correct, a_1.sec, a_1.answered_at, a_1.session_id, a_1.activity, a_1.help_level, a_1.client_mutation_id, a_1.received_at FROM learning_task_attempts a_1 ORDER BY a_1.user_id, a_1.task_key, (COALESCE(a_1.item_ref, ''::text)), a_1.phase, a_1.answered_at, a_1.id ), cross_help AS ( SELECT b.id AS attempt_id, bool_or(e.at <= (b.answered_at - '00:02:00'::interval)) AS helped, bool_or(x.help_clock_suspect OR abs(EXTRACT(epoch FROM b.answered_at - e.at)) < 120::numeric OR e.srv IS NOT NULL AND b.received_at IS NOT NULL AND e.srv <= b.received_at AND b.answered_at < e.at OR b.received_at IS NOT NULL AND (b.received_at - b.answered_at) > '00:02:00'::interval AND abs(EXTRACT(epoch FROM b.answered_at - e.at)) < EXTRACT(epoch FROM b.received_at - b.answered_at)) AS uncertain FROM base b JOIN learning_sessions x ON x.user_id = b.user_id AND x.item_ref = b.item_ref AND x.id IS DISTINCT FROM b.session_id CROSS JOIN LATERAL ( VALUES (x.help_received_at,x.help_server_at), (x.explanation_viewed_at,x.explanation_server_at)) e(at, srv) WHERE e.at IS NOT NULL GROUP BY b.id ) SELECT a.id AS attempt_id, a.user_id, a.task_key, a.item_ref, a.phase, a.activity, a.session_id, a.is_correct, a.answered_at, CASE WHEN COALESCE(c.helped, false) THEN 'viewed_first'::text WHEN s.id IS NULL THEN a.help_level WHEN s.help_received_at IS NULL THEN s.help_level WHEN a.answered_at >= s.help_received_at THEN s.help_level ELSE 'independent'::text END AS help_level, CASE WHEN COALESCE(c.helped, false) THEN 'viewed_first'::text WHEN s.id IS NULL THEN a.help_level WHEN s.help_received_at IS NULL THEN s.help_level WHEN a.answered_at >= s.help_received_at THEN s.help_level ELSE 'independent'::text END = 'viewed_first'::text AS after_viewed_first, s.explanation_viewed_at IS NOT NULL AND a.answered_at >= s.explanation_viewed_at AS after_explanation, a.synthetic OR COALESCE(s.synthetic, false) AS synthetic, s.help_received_at IS NOT NULL AND abs(EXTRACT(epoch FROM a.answered_at - s.help_received_at)) < 120::numeric OR s.explanation_viewed_at IS NOT NULL AND abs(EXTRACT(epoch FROM a.answered_at - s.explanation_viewed_at)) < 120::numeric OR a.received_at IS NOT NULL AND a.answered_at > (a.received_at + '00:02:00'::interval) OR COALESCE(s.help_clock_suspect, false) OR s.help_server_at IS NOT NULL AND a.received_at IS NOT NULL AND a.received_at > s.help_server_at AND s.help_received_at IS NOT NULL AND a.answered_at < s.help_received_at OR a.received_at IS NOT NULL AND (a.received_at - a.answered_at) > '00:02:00'::interval AND (s.help_received_at IS NOT NULL AND abs(EXTRACT(epoch FROM a.answered_at - s.help_received_at)) < EXTRACT(epoch FROM a.received_at - a.answered_at) OR s.explanation_viewed_at IS NOT NULL AND abs(EXTRACT(epoch FROM a.answered_at - s.explanation_viewed_at)) < EXTRACT(epoch FROM a.received_at - a.answered_at)) OR s.explanation_server_at IS NOT NULL AND a.received_at IS NOT NULL AND a.received_at > s.explanation_server_at AND s.explanation_viewed_at IS NOT NULL AND a.answered_at < s.explanation_viewed_at OR COALESCE(c.uncertain, false) AND NOT COALESCE(c.helped, false) AS timing_uncertain FROM base a LEFT JOIN learning_sessions s ON s.id = a.session_id LEFT JOIN cross_help c ON c.attempt_id = a.id;
grant select on public.learning_first_attempts to authenticated, service_role;
