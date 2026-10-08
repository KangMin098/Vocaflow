-- supabase/migrations/20261008120000_knowledge_vnext.sql
-- 학습 원리 vNext — 설계 → 배포 → 수행 기록 → 검증 층 (docs/methodology/VNEXT.md §2).
-- **추가만 한다.** 기존 knowledge_* / methodology_* 의 행·이력·트리거는 그대로다(열 추가 3 + 새 테이블 7).
-- 원문(지문·자막) 열은 없다. 학습자 응답은 문장 번호·선지 번호 같은 숫자만.
-- 되돌리기: 새 테이블 7 개와 함수 6 개를 drop, 추가 열 4 개를 drop (기존 데이터 영향 없음).
begin;

-- ── 1. 기존 테이블에 열 추가 ────────────────────────────────────────────
-- 원리의 면: 언어 처리 기제(language) / 학습·기억·습득 기제(learning). 원리에만 붙는다.
alter table public.knowledge_items
  add column facet text check (facet in ('language','learning'));
alter table public.knowledge_items
  add constraint knowledge_items_facet_principle_only check (facet is null or layer = 'principle');

-- 근거 세 축: 출처 확인도(grade, 기존) · 연구 근거 수준 · 학습 적용 적합성 — 서로 독립
alter table public.knowledge_evidence
  add column research_level text not null default 'not_assessed'
    check (research_level in ('meta_analysis','systematic_review','rct','quasi_experimental',
                              'correlational','expert_consensus','practitioner_claim','observation','not_assessed')),
  add column fit text not null default 'not_assessed'
    check (fit in ('direct','adapted','weak','not_assessed')),
  add column fit_note text check (length(fit_note) <= 500);

-- ── 2. 탐구 질문 ───────────────────────────────────────────────────────
create table public.knowledge_inquiries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  question text not null check (length(question) between 1 and 500),
  capability_item_id uuid references public.knowledge_items(id) on delete set null,
  status text not null default 'open'
    check (status in ('open','collecting','synthesizing','concluded','parked')),
  conclusion text check (length(conclusion) <= 2000),
  uncertainty text check (length(uncertainty) <= 1000),
  next_action text check (length(next_action) <= 500),
  created_by text not null check (length(created_by) between 1 and 200),
  updated_by text not null check (length(updated_by) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 결론을 내렸다면 결론과 불확실성을 함께 적는다(불확실성 없는 결론 금지)
  check (status <> 'concluded' or (length(coalesce(conclusion,'')) > 0 and length(coalesce(uncertainty,'')) > 0))
);

-- 질문에 대한 입장 하나 = 항목 또는 근거 + 태도. 반례·반박을 지지와 같은 자리에 둔다.
create table public.knowledge_inquiry_positions (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.knowledge_inquiries(id) on delete cascade,
  item_id uuid references public.knowledge_items(id) on delete cascade,
  evidence_id uuid references public.knowledge_evidence(id) on delete cascade,
  stance text not null check (stance in ('supports','contradicts','qualifies','counterexample')),
  note text not null check (length(note) between 1 and 1000),
  created_by text not null check (length(created_by) between 1 and 200),
  created_at timestamptz not null default now(),
  check (item_id is not null or evidence_id is not null)
);
create index knowledge_inquiry_positions_inq_idx on public.knowledge_inquiry_positions (inquiry_id);

-- ── 3. 학습 설계 · 배포 ────────────────────────────────────────────────
create table public.knowledge_designs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  title text not null check (length(title) between 1 and 120),
  -- 학습자에게 보이는 추천 이유(관리자 용어·등급 없이)
  learner_summary text not null check (length(learner_summary) between 1 and 600),
  -- [{ "title": "...", "detail": "..." }] — 학습자가 따르는 절차
  procedure jsonb not null check (jsonb_typeof(procedure) = 'array' and jsonb_array_length(procedure) between 1 and 12),
  include_conditions text[] not null default '{}',
  exclude_conditions text[] not null default '{}',
  -- 학습자 화면 구현 키(코드에 있는 모듈만 의미가 있다)
  module_key text not null check (module_key ~ '^[a-z][a-z0-9_]{2,60}$'),
  train_type_ids text[] not null default '{}',
  transfer_type_ids text[] not null default '{}',
  -- 학습 지도(csat_map) 코드 — 연결 계약만(FK 없음, 지도는 다른 브랜치)
  map_codes text[] not null default '{}',
  -- { pre, post, delayed, transfer, metrics, thresholds } — 효과 검증 프로토콜
  assessment jsonb not null check (jsonb_typeof(assessment) = 'object'),
  inquiry_id uuid references public.knowledge_inquiries(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','ready','deployed','paused','retired')),
  status_reason text check (length(status_reason) <= 500),
  version integer not null default 1 check (version >= 1),
  created_by text not null check (length(created_by) between 1 and 200),
  updated_by text not null check (length(updated_by) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('paused','retired') or length(coalesce(status_reason,'')) > 0)
);

create table public.knowledge_design_items (
  design_id uuid not null references public.knowledge_designs(id) on delete cascade,
  item_id uuid not null references public.knowledge_items(id) on delete restrict,
  role text not null check (role in ('capability','language_mechanism','learning_mechanism','method','practice')),
  primary key (design_id, item_id)
);
create index knowledge_design_items_item_idx on public.knowledge_design_items (item_id);

create table public.knowledge_deployments (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.knowledge_designs(id) on delete restrict,
  design_version integer not null,
  -- 배포 시점의 학습자 노출 내용 — 롤백은 이 사본으로 되돌린다
  snapshot jsonb not null,
  started_at timestamptz not null default now(),
  started_by text not null,
  ended_at timestamptz,
  ended_by text,
  end_reason text check (end_reason in ('evidence_changed','manual_pause','rollback','retired')),
  check ((ended_at is null) = (end_reason is null))
);
-- 설계당 열린 배포는 하나
create unique index knowledge_deployments_open_uidx on public.knowledge_deployments (design_id) where ended_at is null;

-- ── 4. 수행 기록 · 검증 실행 ───────────────────────────────────────────
create table public.knowledge_task_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  design_id uuid not null references public.knowledge_designs(id) on delete restrict,
  design_version integer not null,
  deployment_id uuid references public.knowledge_deployments(id) on delete restrict,
  item_id text not null check (length(item_id) between 1 and 80),
  phase text not null check (phase in ('train','transfer')),
  -- { claimSentence, sentenceCount, option, ... } — 숫자·불리언만
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  claim_hit boolean,
  option_correct boolean,
  confidence smallint check (confidence between 1 and 3),
  sec integer check (sec between 0 and 7200),
  preview boolean not null default false,
  synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  -- 실학습 기록은 반드시 배포 구간에 묶인다
  check (preview or synthetic or deployment_id is not null)
);
create index knowledge_task_runs_design_idx on public.knowledge_task_runs (design_id, created_at);
create index knowledge_task_runs_user_idx on public.knowledge_task_runs (user_id, design_id, created_at);

create table public.knowledge_validation_runs (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.knowledge_designs(id) on delete cascade,
  design_version integer not null,
  synthetic boolean not null,
  n_learners integer not null check (n_learners >= 0),
  n_runs integer not null check (n_runs >= 0),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  verdict text not null check (verdict in ('insufficient_data','positive','no_effect','negative','inconclusive')),
  note text check (length(note) <= 1000),
  computed_by text not null,
  computed_at timestamptz not null default now(),
  -- 합성 데이터는 효과 판정을 내리지 않는다
  check (not synthetic or verdict = 'insufficient_data')
);
create index knowledge_validation_runs_design_idx on public.knowledge_validation_runs (design_id, computed_at desc);

-- ── 5. 불변식 ──────────────────────────────────────────────────────────
-- 5-1 설계: 내용이 바뀌면 version+1, 배포 중에는 내용 변경 거부, 배포 문턱, 배포 구간 자동 개폐
create function public.knowledge_designs_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  v_content_changed boolean;
  v_bad int;
  v_core int;
  v_reason text;
begin
  new.updated_at := now();
  v_content_changed :=
       new.learner_summary is distinct from old.learner_summary
    or new.procedure is distinct from old.procedure
    or new.include_conditions is distinct from old.include_conditions
    or new.exclude_conditions is distinct from old.exclude_conditions
    or new.module_key is distinct from old.module_key
    or new.train_type_ids is distinct from old.train_type_ids
    or new.transfer_type_ids is distinct from old.transfer_type_ids
    or new.assessment is distinct from old.assessment;
  if v_content_changed then
    if old.status = 'deployed' then
      raise exception 'knowledge_designs: 배포 중인 설계는 내용을 바꿀 수 없다 — 먼저 중단한다' using errcode = 'check_violation';
    end if;
    new.version := old.version + 1;
  end if;

  if new.status = 'deployed' and old.status is distinct from 'deployed' then
    -- 연결 항목 행을 잠가 채택 해제와 경합하지 않게 한다(채택 해제는 FOR UPDATE 를 잡는다)
    perform 1 from public.knowledge_items i
      join public.knowledge_design_items d on d.item_id = i.id
      where d.design_id = new.id order by i.id for share of i;
    select count(*) filter (where i.status not in ('adopted','applied')),
           count(*) filter (where d.role in ('capability','method'))
      into v_bad, v_core
      from public.knowledge_design_items d join public.knowledge_items i on i.id = d.item_id
      where d.design_id = new.id;
    if v_core = 0 then
      raise exception 'knowledge_designs: 역량 또는 방법론 항목이 연결되지 않은 설계는 배포할 수 없다' using errcode = 'check_violation';
    end if;
    if v_bad > 0 then
      raise exception 'knowledge_designs: 채택되지 않은 항목 %개가 연결돼 있어 배포할 수 없다', v_bad using errcode = 'check_violation';
    end if;
    insert into public.knowledge_deployments (design_id, design_version, snapshot, started_by)
    values (new.id, new.version,
            jsonb_build_object('learner_summary', new.learner_summary, 'procedure', new.procedure,
                               'include_conditions', new.include_conditions, 'exclude_conditions', new.exclude_conditions,
                               'train_type_ids', new.train_type_ids, 'transfer_type_ids', new.transfer_type_ids,
                               'assessment', new.assessment, 'module_key', new.module_key),
            new.updated_by);
  elsif old.status = 'deployed' and new.status is distinct from 'deployed' then
    v_reason := case
      when new.status = 'retired' then 'retired'
      else coalesce(nullif(current_setting('knowledge.end_reason', true), ''), 'manual_pause')
    end;
    update public.knowledge_deployments
       set ended_at = now(), ended_by = new.updated_by, end_reason = v_reason
     where design_id = new.id and ended_at is null;
  end if;
  return new;
end $$;
create trigger knowledge_designs_guard before update on public.knowledge_designs
  for each row execute function public.knowledge_designs_guard();

-- 처음부터 deployed 로 넣는 것은 막는다(문턱을 우회한다)
create function public.knowledge_designs_insert_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'deployed' then
    raise exception 'knowledge_designs: 새 설계는 draft/ready 로 만들고 연결 뒤 배포한다' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger knowledge_designs_insert_guard before insert on public.knowledge_designs
  for each row execute function public.knowledge_designs_insert_guard();

-- 배포 중인 설계의 연결 항목은 바꿀 수 없다
create function public.knowledge_design_items_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.knowledge_designs
   where id = coalesce(new.design_id, old.design_id) for update;
  if v_status = 'deployed' then
    raise exception 'knowledge_design_items: 배포 중인 설계의 연결은 바꿀 수 없다 — 먼저 중단한다' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;
create trigger knowledge_design_items_guard before insert or update or delete on public.knowledge_design_items
  for each row execute function public.knowledge_design_items_guard();

-- 5-2 근거 변화 → 추천 중단: 연결 항목이 채택에서 벗어나면 배포 중인 설계를 멈춘다
create function public.knowledge_items_pause_designs() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.status in ('adopted','applied') and new.status not in ('adopted','applied') then
    perform set_config('knowledge.end_reason', 'evidence_changed', true);
    update public.knowledge_designs d
       set status = 'paused',
           status_reason = left(format('근거 변화: %s 항목이 %s → %s', new.slug, old.status, new.status), 500),
           updated_by = new.updated_by
     where d.status = 'deployed'
       and exists (select 1 from public.knowledge_design_items x where x.design_id = d.id and x.item_id = new.id);
    perform set_config('knowledge.end_reason', '', true);
  end if;
  return null;
end $$;
create trigger knowledge_items_pause_designs after update of status on public.knowledge_items
  for each row execute function public.knowledge_items_pause_designs();

-- 5-3 수행 기록: 실학습 기록은 그 설계의 열린 배포 구간에만, 버전도 배포 버전과 같아야 한다
create function public.knowledge_task_runs_guard() returns trigger
language plpgsql set search_path = public as $$
declare v_dep public.knowledge_deployments;
begin
  if new.preview or new.synthetic then
    return new;
  end if;
  select * into v_dep from public.knowledge_deployments where id = new.deployment_id for share;
  if v_dep.id is null or v_dep.design_id <> new.design_id or v_dep.ended_at is not null then
    raise exception 'knowledge_task_runs: 열린 배포 구간이 아니다' using errcode = 'check_violation';
  end if;
  if v_dep.design_version <> new.design_version then
    raise exception 'knowledge_task_runs: 배포 버전과 기록 버전이 다르다' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger knowledge_task_runs_guard before insert on public.knowledge_task_runs
  for each row execute function public.knowledge_task_runs_guard();

-- 5-4 탐구 질문 updated_at
create function public.knowledge_inquiries_touch() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger knowledge_inquiries_touch before update on public.knowledge_inquiries
  for each row execute function public.knowledge_inquiries_touch();

-- ── 6. 권한 ────────────────────────────────────────────────────────────
-- 전부 service_role 이 쓴다. 학습자는 자기 수행 기록만 읽는다(쓰기는 서버 경로 → service_role).
do $$
declare t text;
begin
  foreach t in array array['knowledge_inquiries','knowledge_inquiry_positions','knowledge_designs',
                           'knowledge_design_items','knowledge_deployments','knowledge_task_runs',
                           'knowledge_validation_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.knowledge_task_runs to authenticated;
create policy knowledge_task_runs_own_select on public.knowledge_task_runs
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on function public.knowledge_designs_guard() from public, anon, authenticated;
revoke all on function public.knowledge_designs_insert_guard() from public, anon, authenticated;
revoke all on function public.knowledge_design_items_guard() from public, anon, authenticated;
revoke all on function public.knowledge_items_pause_designs() from public, anon, authenticated;
revoke all on function public.knowledge_task_runs_guard() from public, anon, authenticated;
revoke all on function public.knowledge_inquiries_touch() from public, anon, authenticated;

-- ── 7. 관측 이벤트 2종 (AGENTS D2) — 현재 DB 제약 목록을 읽어 덧붙인다(다른 브랜치 항목을 잃지 않게) ──
do $$
declare
  v_def text;
  v_list text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conname = 'funnel_events_event_check' and conrelid = 'public.funnel_events'::regclass;
  if v_def is null then
    raise exception 'funnel_events_event_check 가 없다 — 이벤트 허용 목록 구조가 바뀌었다';
  end if;
  select array_agg(distinct m[1]) into v_list from regexp_matches(v_def, '''([a-z0-9_]+)''', 'g') as m;
  v_list := array(select distinct unnest(v_list || array['knowledge_task_viewed','knowledge_task_submitted']) order by 1);
  execute 'alter table public.funnel_events drop constraint funnel_events_event_check';
  execute format('alter table public.funnel_events add constraint funnel_events_event_check check (event = any (%L::text[]))', v_list);
end $$;

commit;
