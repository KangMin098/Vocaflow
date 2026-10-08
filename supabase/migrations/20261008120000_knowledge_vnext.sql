-- supabase/migrations/_pending_20261008120000_knowledge_vnext.sql
--
-- **제안 · 미적용(승인 대기).** 영어 학습 원리 시스템 vNext Phase 2 — 추가형 스키마(docs/methodology/VNEXT_ARCHITECTURE.md §3).
-- 승인되면 파일명을 20261008120000_knowledge_vnext.sql 로 바꾸고 DB 체크포인트 앞뒤로 적용한다.
-- 원칙: 기존 표 · 행 · 검토 이력 삭제 없음. 기존 제약은 **넓히기만** 한다(knowledge_evidence_source_type_check · knowledge_evidence_check).
-- 데이터 변경(백필): knowledge_items.kind 153행 · knowledge_evidence.evidence_level 118행(updated_at 은 기존 트리거가 갱신한다 · version · 상태 · 검토 기록은 바뀌지 않는다).
-- Codex 계획 리뷰(2026-10-08) P0 1 · P1 7 반영: authenticated 기본 ACL 회수 · kind NOT NULL 보류 · efficacy 가드 INSERT 포함 · 결과 방향 일치 ·
-- 이탈 방향 불변식(적용 중단 · trial 삭제 · 항목 재검토) · 채택 항목만 적용 · 서지 설계 불변 · 수행 기록 ↔ trial · 최소 표본.
-- 되돌리기: 맨 끝 주석의 rollback 블록 — 새 표 데이터가 사라지므로 Phase 3 이후에는 쓰지 않는다.

begin;

-- ── 1. 지식 객체 종류(kind) — 기존 layer 를 지우지 않고 세분 ───────────────────────────────────
alter table public.knowledge_items add column kind text;
alter table public.knowledge_items add constraint knowledge_items_kind_check check (kind in (
  'competency','essence_bundle','processing_mechanism','learning_mechanism','method','task'));
alter table public.knowledge_items add constraint knowledge_items_kind_layer_check check (
  kind is null
  or (layer = 'essence' and kind in ('competency','essence_bundle'))
  or (layer = 'principle' and kind in ('processing_mechanism','learning_mechanism'))
  or (layer = 'method' and kind = 'method')
  or (layer = 'practice' and kind = 'task'));

-- 백필(VNEXT_ARCHITECTURE §3-3 매핑) — 기존 essence 4 는 묶음 표지로 보존
update public.knowledge_items set kind = 'essence_bundle' where layer = 'essence';
update public.knowledge_items set kind = 'processing_mechanism'
  where layer = 'principle' and slug in ('sequential-processing','cohesion-cues','task-directed-attention','phonological-decoding');
update public.knowledge_items set kind = 'learning_mechanism' where layer = 'principle' and kind is null;
update public.knowledge_items set kind = 'method' where layer = 'method';
update public.knowledge_items set kind = 'task' where layer = 'practice';

-- 모호하지 않은 층만 기본값(knowledge_import_claim RPC · 기존 스크립트 호환). essence · principle 은 사람이 아니라 기본값이 정하면 안 된다 — null 로 남는다.
-- NOT NULL 은 쓰기 경로(createItemAction · 원리 시드 스크립트)가 kind 를 보내게 된 뒤 별도 마이그레이션으로 건다(지금 걸면 기존 액션이 깨진다).
create function public.knowledge_items_default_kind() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind is null then
    new.kind := case new.layer when 'method' then 'method' when 'practice' then 'task' else null end;
  end if;
  return new;
end $$;
create trigger knowledge_items_default_kind before insert on public.knowledge_items
  for each row execute function public.knowledge_items_default_kind();

-- ── 2. 연구 서지(설계는 불변 — 고칠 일이 있으면 새 서지 행) ──────────────────────────────────────
create table public.knowledge_research_sources (
  id uuid primary key default gen_random_uuid(),
  citation text not null check (length(citation) between 5 and 600),
  doi text check (doi ~ '^10\.\d{4,9}/\S+$'),
  url text check (url like 'https://%'),
  design text not null check (design in ('meta_analysis','systematic_review','rct','quasi_experimental',
    'correlational','descriptive','theoretical','expert_opinion')),
  population text check (length(population) <= 300),
  l2_context boolean,          -- 제2언어(외국어) 학습 맥락 연구인가 — null = 미확인
  year smallint check (year between 1900 and 2100),
  note text check (length(note) <= 1000),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (doi)
);
create function public.knowledge_research_sources_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.design is distinct from old.design then
    raise exception '연구 서지의 설계(design)는 바꿀 수 없다 — 새 서지 행을 만들고 근거를 옮긴다';
  end if;
  return new;
end $$;
create trigger knowledge_research_sources_immutable before update on public.knowledge_research_sources
  for each row execute function public.knowledge_research_sources_immutable();

-- ── 3. 근거 세 축 — 연구 설계 수준 · 적용 적합성(출처 확인도 grade 는 그대로) ───────────────────────
alter table public.knowledge_evidence
  add column evidence_level text not null default 'not_rated' check (evidence_level in (
    'meta_analysis','systematic_review','rct','quasi_experimental','correlational','descriptive',
    'exam_observation','expert_opinion','practitioner_claim','not_rated')),
  add column applicability text not null default 'unknown' check (applicability in ('high','partial','low','unknown')),
  add column applicability_note text check (length(applicability_note) <= 500),
  add column research_source_id uuid references public.knowledge_research_sources(id);
update public.knowledge_evidence set evidence_level = 'practitioner_claim' where source_type = 'external';
update public.knowledge_evidence set evidence_level = 'exam_observation' where source_type = 'csat_origin';

alter table public.knowledge_evidence drop constraint knowledge_evidence_source_type_check;
alter table public.knowledge_evidence add constraint knowledge_evidence_source_type_check
  check (source_type in ('methodology','csat_origin','external','research'));
alter table public.knowledge_evidence drop constraint knowledge_evidence_check;
alter table public.knowledge_evidence add constraint knowledge_evidence_check check (
  (source_type = 'methodology' and source_batch_id is not null and source_id is not null
     and csat_passage_sha256 is null and external_url is null and research_source_id is null)
  or (source_type = 'csat_origin' and csat_passage_sha256 is not null
     and source_batch_id is null and external_url is null and research_source_id is null)
  or (source_type = 'external' and external_url is not null and external_title is not null
     and source_batch_id is null and csat_passage_sha256 is null and research_source_id is null)
  or (source_type = 'research' and research_source_id is not null
     and source_batch_id is null and csat_passage_sha256 is null and external_url is null));
create index knowledge_evidence_research_idx on public.knowledge_evidence (research_source_id) where research_source_id is not null;

-- 연구 근거의 수준은 서지 설계에서 온다(앱을 거치지 않는 쓰기에도) — 강사 주장 · AI 판정이 수준을 올리지 못하게
create function public.knowledge_evidence_sync_level() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.source_type = 'research' then
    select case s.design when 'theoretical' then 'expert_opinion' else s.design end into new.evidence_level
      from public.knowledge_research_sources s where s.id = new.research_source_id;
  elsif new.source_type = 'external' and new.evidence_level not in ('practitioner_claim','expert_opinion','not_rated') then
    raise exception '외부(영상 · 웹) 근거의 수준은 practitioner_claim · expert_opinion 만 — 연구 설계 수준은 research 서지로';
  elsif new.source_type = 'csat_origin' then
    new.evidence_level := 'exam_observation';
  end if;
  return new;
end $$;
create trigger knowledge_evidence_sync_level before insert or update on public.knowledge_evidence
  for each row execute function public.knowledge_evidence_sync_level();

-- ── 4. 탐구 질문 ────────────────────────────────────────────────────────────────────────────────
create table public.knowledge_inquiries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  question text not null check (length(question) between 5 and 500),
  skill_ids text[] not null default '{}',
  status text not null default 'open' check (status in ('open','investigating','concluded','parked')),
  conclusion_item_id uuid references public.knowledge_items(id),
  uncertainty text check (length(uncertainty) <= 1500),
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'concluded' or conclusion_item_id is not null)
);
create table public.knowledge_inquiry_links (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.knowledge_inquiries(id) on delete cascade,
  item_id uuid references public.knowledge_items(id) on delete cascade,
  evidence_id uuid references public.knowledge_evidence(id) on delete cascade,
  role text not null check (role in ('candidate','support','counter','uncertain')),
  note text check (length(note) <= 1000),
  created_by text not null,
  created_at timestamptz not null default now(),
  check ((item_id is not null) <> (evidence_id is not null))
);
create index knowledge_inquiry_links_inquiry_idx on public.knowledge_inquiry_links (inquiry_id);

-- ── 5. 제품 적용 · 효과 검증 ────────────────────────────────────────────────────────────────────
create table public.knowledge_applications (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.knowledge_items(id),
  surface text not null check (surface in ('csat_item_task','learning_map_find','module_task')),
  surface_ref text not null check (length(surface_ref) between 1 and 200),   -- 과제 키 · 화면 키
  version integer not null default 1 check (version >= 1),
  status text not null default 'draft' check (status in ('draft','active','paused','rolled_back')),
  audience jsonb not null default '{}'::jsonb,     -- 대상 조건(학령 · 숙련 · 시험 …)
  exclusions jsonb not null default '{}'::jsonb,   -- 제외 조건
  status_reason text,
  released_at timestamptz,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (surface, surface_ref, version),
  check (status not in ('paused','rolled_back') or length(coalesce(status_reason, '')) > 0),
  check (status <> 'active' or released_at is not null)
);
create table public.knowledge_trials (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.knowledge_applications(id),
  design jsonb not null,            -- {pre, post, delayed_days, transfer, comparison, measures[], min_n}
  status text not null default 'planned' check (status in ('planned','running','analyzed','stopped')),
  synthetic boolean not null default false,   -- 합성 학습자 실행 — 효과 판정에 쓰지 않는다
  result text check (result in ('supported','mixed','not_supported','inconclusive')),
  result_summary text check (length(result_summary) <= 2000),
  analyzed_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  check (status <> 'analyzed' or (result is not null and analyzed_at is not null))
);
create index knowledge_trials_app_idx on public.knowledge_trials (application_id);

-- 적용 켜기: 채택된 항목 + 검증 프로토콜 있음. 항목 행을 잠가 상태 변경 · 다른 적용과 직렬화한다
create function public.knowledge_applications_guard() returns trigger
language plpgsql set search_path = public as $$
declare st text;
begin
  new.updated_at := now();
  if new.status = 'active' then
    select status into st from public.knowledge_items where id = new.item_id for update;
    if st not in ('adopted','applied') then
      raise exception '채택(adopted)된 항목만 적용을 켤 수 있다 — 지금 %', st;
    end if;
    if not exists (select 1 from public.knowledge_trials t where t.application_id = new.id) then
      raise exception '검증 프로토콜(knowledge_trials) 없이 적용을 켤 수 없다';
    end if;
  end if;
  return new;
end $$;
create trigger knowledge_applications_guard before insert or update on public.knowledge_applications
  for each row execute function public.knowledge_applications_guard();

-- 마지막 active 적용이 빠지면(중단 · 롤백 · 삭제) applied 항목은 재검토로 — 학습자 노출이 사라진 항목이 applied 로 남지 않게
create function public.knowledge_applications_after() returns trigger
language plpgsql set search_path = public as $$
declare iid uuid := case when tg_op = 'DELETE' then old.item_id else new.item_id end;
begin
  if (tg_op = 'DELETE' and old.status = 'active') or (tg_op = 'UPDATE' and old.status = 'active' and new.status <> 'active') then
    perform 1 from public.knowledge_items where id = iid for update;
    if not exists (select 1 from public.knowledge_applications a where a.item_id = iid and a.status = 'active') then
      update public.knowledge_items set status = 'in_review', status_reason = '활성 적용 없음(중단 · 롤백)', updated_by = 'system:application'
        where id = iid and status = 'applied';
    end if;
  end if;
  return null;
end $$;
create trigger knowledge_applications_after after update or delete on public.knowledge_applications
  for each row execute function public.knowledge_applications_after();

-- active 적용의 마지막 검증 프로토콜은 지우거나 다른 적용으로 옮길 수 없다
create function public.knowledge_trials_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' or new.application_id is distinct from old.application_id then
    perform 1 from public.knowledge_applications where id = old.application_id for update;
    if exists (select 1 from public.knowledge_applications a where a.id = old.application_id and a.status = 'active')
       and not exists (select 1 from public.knowledge_trials t where t.application_id = old.application_id and t.id <> old.id) then
      raise exception 'active 적용의 마지막 검증 프로토콜은 지우거나 옮길 수 없다 — 적용을 먼저 중단';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger knowledge_trials_guard before update or delete on public.knowledge_trials
  for each row execute function public.knowledge_trials_guard();

-- 항목이 재검토 · 반려 · 추출로 돌아가면 그 항목의 active 적용을 멈춘다(학습자에게 내리지 않는다)
create function public.knowledge_items_pause_applications() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('extracted','in_review','rejected') then
    update public.knowledge_applications set status = 'paused', status_reason = '항목 ' || new.status || ' — 자동 중단', updated_by = 'system:item'
      where item_id = new.id and status = 'active';
  end if;
  return null;
end $$;
create trigger knowledge_items_pause_applications after update on public.knowledge_items
  for each row execute function public.knowledge_items_pause_applications();

-- applied 로 「들어올 때만」 검사(근거 버전 증가 같은 다른 UPDATE 를 막지 않게) · efficacy 는 그 값을 뒷받침하는 근거가 있어야(INSERT 포함)
--   research_supported ← 연구 근거(준실험 이상 · 적합 high/partial) 또는 실제 학습자 trial 결과 supported
--   mixed · not_supported ← 실제 학습자 trial 결과가 같은 값, 또는 연구 근거(준실험 이상 · 적합 high/partial — 방향은 검토자가 판단)
create function public.knowledge_items_applied_guard() returns trigger
language plpgsql set search_path = public as $$
declare old_status text;
        old_eff text;
begin
  if tg_op = 'UPDATE' then old_status := old.status; old_eff := old.efficacy; end if;
  if new.status = 'applied' and old_status is distinct from 'applied' and not exists (
    select 1 from public.knowledge_applications a where a.item_id = new.id and a.status = 'active') then
    raise exception '활성 제품 적용 없이 applied 로 바꿀 수 없다';
  end if;
  if new.efficacy <> 'not_assessed' and new.efficacy is distinct from old_eff and not (
    exists (select 1 from public.knowledge_evidence e where e.item_id = new.id and e.source_type = 'research'
             and e.evidence_level in ('meta_analysis','systematic_review','rct','quasi_experimental')
             and e.applicability in ('high','partial'))
    or exists (select 1 from public.knowledge_trials t join public.knowledge_applications a on a.id = t.application_id
               where a.item_id = new.id and t.status = 'analyzed' and not t.synthetic
                 and t.result = case new.efficacy when 'research_supported' then 'supported' else new.efficacy end)) then
    raise exception '효과 판정(%)을 뒷받침하는 연구 근거(준실험 이상)나 같은 결과의 실제 학습자 검증이 없다', new.efficacy;
  end if;
  return new;
end $$;
create trigger knowledge_items_applied_guard before insert or update on public.knowledge_items
  for each row execute function public.knowledge_items_applied_guard();

-- ── 6. 학습자 과제 수행 기록 ────────────────────────────────────────────────────────────────────
create table public.learning_task_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null check (length(task_key) between 1 and 120),
  application_id uuid references public.knowledge_applications(id),
  trial_id uuid references public.knowledge_trials(id),
  synthetic boolean not null default false,   -- 합성 학습자 · pilot 기록
  item_ref text,                 -- 문항 id 등(예: csat_items.id)
  content_hash text,             -- 채점에 쓴 정답 주석 · 본문 revision(재분할 뒤 옛 번호로 채점하지 않게)
  phase text not null check (phase in ('pre','practice','post','delayed','transfer')),
  response jsonb not null default '{}'::jsonb,
  is_correct boolean,
  sec integer check (sec between 0 and 7200),
  answered_at timestamptz not null default now()
);
create index learning_task_attempts_user_idx on public.learning_task_attempts (user_id, answered_at desc);
create index learning_task_attempts_app_idx on public.learning_task_attempts (application_id, phase);
create index learning_task_attempts_trial_idx on public.learning_task_attempts (trial_id, phase) where trial_id is not null;

-- 합성이 아닌 trial 을 분석 완료로 바꾸려면, 그 trial 에 묶인 실제(합성 아님) 학습자 기록이 사전 · 사후 모두 최소 표본 이상이어야 한다
create function public.knowledge_trials_analyzed_guard() returns trigger
language plpgsql set search_path = public as $$
declare need int := greatest(coalesce((new.design->>'min_n')::int, 1), 1);
begin
  if new.status = 'analyzed' and not new.synthetic and (tg_op = 'INSERT' or old.status is distinct from 'analyzed') then
    if (select count(distinct user_id) from public.learning_task_attempts where trial_id = new.id and phase = 'pre' and not synthetic) < need
       or (select count(distinct user_id) from public.learning_task_attempts where trial_id = new.id and phase = 'post' and not synthetic) < need then
      raise exception '실제 학습자 사전 · 사후 기록이 최소 표본(%)에 못 미친다 — 분석 완료로 바꿀 수 없다', need;
    end if;
  end if;
  return new;
end $$;
create trigger knowledge_trials_analyzed_guard before insert or update on public.knowledge_trials
  for each row execute function public.knowledge_trials_analyzed_guard();

-- ── 7. 권한 ──────────────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['knowledge_research_sources','knowledge_inquiries','knowledge_inquiry_links',
                           'knowledge_applications','knowledge_trials'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
alter table public.learning_task_attempts enable row level security;
-- 기본 ACL 의 TRUNCATE 등까지 회수한 뒤 SELECT 만(RLS 는 TRUNCATE 를 막지 않는다)
revoke all on public.learning_task_attempts from anon, authenticated;
grant select on public.learning_task_attempts to authenticated;
grant select, insert on public.learning_task_attempts to service_role;   -- 쓰기는 서버(채점)만 — 학습자 기기가 정오를 정하지 않는다
create policy learning_task_attempts_own_select on public.learning_task_attempts
  for select to authenticated using (user_id = auth.uid());
revoke all on function public.knowledge_items_default_kind(), public.knowledge_evidence_sync_level(),
  public.knowledge_research_sources_immutable(), public.knowledge_applications_guard(), public.knowledge_applications_after(),
  public.knowledge_trials_guard(), public.knowledge_items_pause_applications(), public.knowledge_items_applied_guard(),
  public.knowledge_trials_analyzed_guard() from public, anon, authenticated;

commit;

-- rollback(필요할 때만 — 새 표 데이터가 사라진다):
-- begin;
-- drop table public.learning_task_attempts, public.knowledge_trials, public.knowledge_applications,
--   public.knowledge_inquiry_links, public.knowledge_inquiries cascade;
-- drop trigger knowledge_items_applied_guard on public.knowledge_items; drop function public.knowledge_items_applied_guard();
-- drop trigger knowledge_items_pause_applications on public.knowledge_items; drop function public.knowledge_items_pause_applications();
-- drop function public.knowledge_applications_guard(), public.knowledge_applications_after(), public.knowledge_trials_guard(), public.knowledge_trials_analyzed_guard();
-- drop trigger knowledge_evidence_sync_level on public.knowledge_evidence; drop function public.knowledge_evidence_sync_level();
-- alter table public.knowledge_evidence drop constraint knowledge_evidence_check, drop constraint knowledge_evidence_source_type_check;
-- alter table public.knowledge_evidence drop column research_source_id, drop column applicability_note, drop column applicability, drop column evidence_level;
-- (원래 두 제약 복원 — 20260928120000_knowledge_registry.sql 정의 그대로)
-- drop table public.knowledge_research_sources; drop function public.knowledge_research_sources_immutable();
-- drop trigger knowledge_items_default_kind on public.knowledge_items; drop function public.knowledge_items_default_kind();
-- alter table public.knowledge_items drop column kind;
-- commit;
