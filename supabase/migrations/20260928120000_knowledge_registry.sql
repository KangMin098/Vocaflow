-- supabase/migrations/20260928120000_knowledge_registry.sql
-- 학습 원리 지식 등록부 (docs/methodology/SYSTEM.md §6).
-- methodology_* 스냅샷은 「가져오기 원장」으로 두고, 관리자가 항목 하나씩 검토·채택하는 살아 있는 등록부를 그 위에 둔다.
-- 원문(자막·지문·인용)을 담는 열은 없다. 기출 원천은 문항 ID·본문 해시·서지·근거 URL 만.
-- 기존 테이블 수정·삭제 없음. 전 테이블 RLS · anon/authenticated 접근 없음 · service_role 전용.
begin;

-- 층: L1 본질 · L2 원리 · L3 방법론 · L4 공부법
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  layer text not null check (layer in ('essence','principle','method','practice')),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  title text not null check (length(title) between 1 and 120),
  statement text not null check (length(statement) between 1 and 1500),
  -- methodology_taxonomy id (skill·age·proficiency·exam·process·question). 조건이 다르면 다른 항목.
  skill_ids text[] not null default '{}',
  condition_ids text[] not null default '{}',
  status text not null default 'extracted'
    check (status in ('extracted','in_review','adopted','rejected','applied')),
  status_reason text,
  efficacy text not null default 'not_assessed'
    check (efficacy in ('not_assessed','research_supported','mixed','not_supported')),
  product_modules text[] not null default '{}',
  version integer not null default 1 check (version >= 1),
  created_by text not null check (length(created_by) between 1 and 200),
  updated_by text not null check (length(updated_by) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 반려에는 이유가 있어야 한다
  check (status <> 'rejected' or length(coalesce(status_reason, '')) > 0)
);
create index knowledge_items_layer_status_idx on public.knowledge_items (layer, status);
create index knowledge_items_skill_idx on public.knowledge_items using gin (skill_ids);

-- 층 간 연결. implements 는 반드시 한 층 위로(공부법→방법론→원리→본질).
create table public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.knowledge_items(id) on delete cascade,
  to_id uuid not null references public.knowledge_items(id) on delete cascade,
  kind text not null check (kind in ('implements','contrasts','complements','condition_variant','duplicate_candidate')),
  reason text not null check (length(reason) between 1 and 1000),
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (from_id, to_id, kind),
  check (from_id <> to_id)
);
create index knowledge_links_to_idx on public.knowledge_links (to_id);

create function public.knowledge_links_check_layer() returns trigger
language plpgsql set search_path = public as $$
declare
  rank_from int; rank_to int;
begin
  if new.kind <> 'implements' then return new; end if;
  select case layer when 'practice' then 1 when 'method' then 2 when 'principle' then 3 else 4 end
    into rank_from from public.knowledge_items where id = new.from_id;
  select case layer when 'practice' then 1 when 'method' then 2 when 'principle' then 3 else 4 end
    into rank_to from public.knowledge_items where id = new.to_id;
  if rank_to <> rank_from + 1 then
    raise exception 'implements 는 한 층 위로만 잇는다 (from 층 %, to 층 %)', rank_from, rank_to;
  end if;
  return new;
end $$;
create trigger knowledge_links_check_layer before insert or update on public.knowledge_links
  for each row execute function public.knowledge_links_check_layer();

-- 기출 원천 (Codex 2026-09-28 전수 조사). 지문 원문 없음.
create table public.knowledge_csat_origins (
  passage_sha256 text primary key check (passage_sha256 ~ '^[a-f0-9]{64}$'),
  representative_item_id text not null,
  item_ids text[] not null check (cardinality(item_ids) >= 1),
  exam_id text not null,
  status text not null check (status in ('confirmed_exact','supported_candidate','topic_lineage_only','unresolved')),
  grade text generated always as (
    case status when 'confirmed_exact' then 'A' when 'supported_candidate' then 'B'
                when 'topic_lineage_only' then 'C' else 'G' end) stored,
  source_title text,
  source_authors text[] not null default '{}',
  source_publisher text,
  source_year integer check (source_year between 1500 and 2100),
  source_part text,
  field text,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  note text,
  audited_at date not null,
  audit_ref text not null,
  -- 미확인이 아니면 서지가 있어야 한다
  check (status = 'unresolved' or source_title is not null)
);
create index knowledge_csat_origins_exam_idx on public.knowledge_csat_origins (exam_id);
create index knowledge_csat_origins_grade_idx on public.knowledge_csat_origins (grade);

-- 근거: 항목 ↔ 출처 위치. 출처는 셋 중 하나(스냅샷 출처 · 기출 원천 · 외부 링크).
create table public.knowledge_evidence (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.knowledge_items(id) on delete cascade,
  grade text not null check (grade in ('A','B','C')),
  attribution text not null check (attribution in ('stated','inferred')),
  source_type text not null check (source_type in ('methodology','csat_origin','external')),
  source_batch_id text,
  source_id text,
  csat_passage_sha256 text references public.knowledge_csat_origins(passage_sha256),
  external_url text check (external_url like 'https://%'),
  external_title text,
  locator text check (length(locator) <= 200),
  note text check (length(note) <= 1000),
  created_by text not null,
  created_at timestamptz not null default now(),
  foreign key (source_batch_id, source_id) references public.methodology_sources(batch_id, id),
  check (
    (source_type = 'methodology' and source_batch_id is not null and source_id is not null
       and csat_passage_sha256 is null and external_url is null)
    or (source_type = 'csat_origin' and csat_passage_sha256 is not null
       and source_batch_id is null and external_url is null)
    or (source_type = 'external' and external_url is not null and external_title is not null
       and source_batch_id is null and csat_passage_sha256 is null)
  )
);
create index knowledge_evidence_item_idx on public.knowledge_evidence (item_id);

-- 공백: 모르는 것. 0 이 아니라 「모름」으로 남긴다.
create table public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  skill_ids text[] not null default '{}',
  layer text check (layer in ('essence','principle','method','practice')),
  question text not null check (length(question) between 1 and 500),
  cause text not null check (cause in ('no_transcript','rights_unknown','not_found','not_researched','unverifiable')),
  next_action text not null check (length(next_action) between 1 and 500),
  affected_count integer check (affected_count >= 0),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((status = 'closed') = (closed_at is not null))
);

-- 상태 전이 기록 — 트리거가 자동으로 남긴다(앱이 빠뜨려도 기록된다).
create table public.knowledge_reviews (
  id bigint generated always as identity primary key,
  item_id uuid not null references public.knowledge_items(id) on delete cascade,
  from_status text,
  to_status text not null,
  reviewer text not null,
  reason text,
  at timestamptz not null default now()
);
create index knowledge_reviews_item_idx on public.knowledge_reviews (item_id, at desc);

create function public.knowledge_items_track() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.knowledge_reviews (item_id, from_status, to_status, reviewer, reason)
    values (new.id, null, new.status, new.created_by, new.status_reason);
    return new;
  end if;
  new.updated_at := now();
  if new.statement is distinct from old.statement then
    new.version := old.version + 1;
  end if;
  if new.status is distinct from old.status then
    insert into public.knowledge_reviews (item_id, from_status, to_status, reviewer, reason)
    values (new.id, old.status, new.status, new.updated_by, new.status_reason);
  end if;
  return new;
end $$;
create trigger knowledge_items_track_ins after insert on public.knowledge_items
  for each row execute function public.knowledge_items_track();
create trigger knowledge_items_track_upd before update on public.knowledge_items
  for each row execute function public.knowledge_items_track();

-- 권한: 전부 service_role 전용 (methodology_* 와 동일)
do $$
declare t text;
begin
  foreach t in array array['knowledge_items','knowledge_links','knowledge_csat_origins',
                           'knowledge_evidence','knowledge_gaps','knowledge_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;
revoke all on function public.knowledge_links_check_layer() from public, anon, authenticated;
revoke all on function public.knowledge_items_track() from public, anon, authenticated;

commit;
