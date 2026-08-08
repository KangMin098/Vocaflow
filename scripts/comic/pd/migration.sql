-- scripts/comic/pd/migration.sql
--
-- PDCP — 퍼블릭 도메인 스캔 만화. **CCP(AI 생성)와 완전히 분리된 독립 스키마.**
-- ⚠️ 사용자 승인 전 적용 금지 (CLAUDE.md). 승인 시 supabase/migrations/ 로 옮겨 apply_migration.
--
-- ── 왜 comic_books/comic_pages 를 확장하지 않고 분리하는가 ──────────────────
-- 처음엔 `source_kind` 판별 컬럼을 붙여 한 테이블에 담으려 했으나, 두 소재의 성질이
-- 근본적으로 달라 모든 쿼리·화면·QC 에 분기가 번진다:
--
--   구분        CCP (AI 생성)              PDCP (PD 스캔)
--   ─────────────────────────────────────────────────────────────────
--   콘텐츠 단위  도서의 챕터                 발행 호(issue) — 도서 챕터와 무관
--   원작 관계    library_books 에 종속       독립. 원작과는 느슨한 참조
--   대사         우리가 저작(정본 verbatim)   이미지에 구워져 있음 → OCR 로 추출
--   QC           프롬프트 준수·정본 일치      화질·컷 분할 정확도·OCR 신뢰도
--   법적 게이트   없음(자체 생성물)           **필수** — 호별 PD 근거 없으면 발행 불가
--   실패 모드    생성 품질                   저작권 사고(되돌릴 수 없음)
--
-- 특히 마지막 줄이 결정적이다. 저작권 게이트를 "판별 컬럼이 pd-scan 일 때만" 거는 조건부
-- 제약은, 판별 컬럼 하나만 잘못 들어가도 무너진다. 독립 테이블이면 **그 테이블의 모든 행**에
-- 무조건 걸 수 있다.

-- ═══════════════════════════════════════════════════════════════════
-- 1. 소재 호(issue) — PDCP 의 최상위 단위
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.pd_comic_issues (
  id uuid primary key default gen_random_uuid(),

  -- 표시 정체성
  slug          text not null unique,          -- 'classics-illustrated-027-the-spy'
  title         text not null,
  series_title  text,
  issue_no      integer,
  published_year integer,
  cover_url     text,
  panels_total  integer not null default 0,

  -- 원작 연결(선택) — Classics Illustrated 는 문학 각색이라 원작 도서와 묶을 수 있다.
  -- 종속이 아니라 **느슨한 참조**: 원작이 없어도 PD 만화는 단독으로 존재한다.
  library_book_id uuid references public.library_books(id) on delete set null,
  v_level       smallint,

  -- 취득 출처 (어댑터가 채운다)
  source_adapter    text not null,             -- 'internet-archive' | 'local-dir' | 'iiif'
  source_identifier text not null,
  source_url        text,

  -- 법적 근거 — 이 테이블의 존재 이유
  pd_basis        text,                        -- 'pre-1929' | 'no-renewal' | 'explicit-license'
  pd_evidence_url text,
  pd_checked_at   timestamptz,
  pd_checked_by   uuid references auth.users(id) on delete set null,

  -- 파이프라인 상태
  status        text not null default 'acquired',
  qc            jsonb,                         -- {segmentConfidence, ocrCoverage, restoreParams, …}

  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint pd_issues_status_chk
    check (status in ('acquired','restored','segmented','ocr','review','published','archived')),
  constraint pd_issues_basis_chk
    check (pd_basis is null or pd_basis in ('pre-1929','no-renewal','explicit-license')),
  constraint pd_issues_adapter_chk
    check (source_adapter in ('internet-archive','local-dir','iiif')),

  -- ★ 저작권 게이트 — 근거 없이는 절대 발행되지 않는다.
  --   앱 코드가 아니라 DB 에 거는 이유: 스크립트 직접 insert·SQL 콘솔 등 코드를 우회하는
  --   경로가 존재하는 한 코드 검증만으로는 부족하고, 저작권 사고는 되돌릴 수 없다.
  constraint pd_issues_publish_gate check (
    status <> 'published' or (
      pd_basis is not null and pd_checked_at is not null
      and pd_checked_by is not null and source_url is not null
    )
  ),
  constraint pd_issues_unique_source unique (source_adapter, source_identifier)
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. 컷(panel) — 학습자가 실제로 넘겨 보는 단위
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.pd_comic_panels (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.pd_comic_issues(id) on delete cascade,

  panel_order    integer not null,             -- 호 전체 통산 컷 순번 (읽기 순서)
  source_page_no integer not null,             -- 원본 스캔 페이지 번호 (역추적)
  image_url      text not null,                -- 복원·크롭된 컷 이미지

  -- OCR 로 뽑은 대사. CCP 의 authored bubbles 와 형태는 같지만 출처가 다르다.
  --   [{ text, box:{x,y,w,h} (컷 기준 0~1), kind:'speech'|'caption', confidence }]
  bubbles      jsonb not null default '[]'::jsonb,
  target_vocab text[] not null default '{}',

  -- 재현·감사 — "이 컷을 다시 만들려면?" 에 답할 수 있어야 한다
  source_box     jsonb,                        -- 복원본 기준 {x,y,w,h}
  restore_params jsonb,                        -- {paper,gains,sat,scale,denoise,analysis,dilate}

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pd_panels_unique unique (issue_id, panel_order)
);

create index if not exists pd_panels_issue_order_idx
  on public.pd_comic_panels (issue_id, panel_order);
create index if not exists pd_issues_status_idx on public.pd_comic_issues (status);
create index if not exists pd_issues_book_idx on public.pd_comic_issues (library_book_id)
  where library_book_id is not null;

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS — 학습자는 발행본만, 쓰기는 admin 만
-- ═══════════════════════════════════════════════════════════════════
alter table public.pd_comic_issues enable row level security;
alter table public.pd_comic_panels enable row level security;

drop policy if exists pd_issues_read_published on public.pd_comic_issues;
create policy pd_issues_read_published on public.pd_comic_issues
  for select using (status = 'published');

drop policy if exists pd_panels_read_published on public.pd_comic_panels;
create policy pd_panels_read_published on public.pd_comic_panels
  for select using (
    exists (
      select 1 from public.pd_comic_issues i
      where i.id = pd_comic_panels.issue_id and i.status = 'published'
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- 4. 학습자 read RPC — 발행 게이트를 함수 안에 못박는다
-- ═══════════════════════════════════════════════════════════════════

-- 서가 카탈로그 (/library/comics)
create or replace function public.list_pd_comics()
returns table (
  id uuid, slug text, title text, series_title text, issue_no integer,
  published_year integer, cover_url text, panels_total integer,
  v_level smallint, library_book_id uuid
)
language sql stable security definer set search_path = public as $$
  select i.id, i.slug, i.title, i.series_title, i.issue_no,
         i.published_year, i.cover_url, i.panels_total, i.v_level, i.library_book_id
  from public.pd_comic_issues i
  where i.status = 'published'
  order by i.series_title nulls last, i.issue_no nulls last, i.title
$$;

-- 리더 — 호 하나의 전 컷
create or replace function public.select_pd_comic(p_slug text)
returns table (
  panel_order integer, source_page_no integer, image_url text,
  bubbles jsonb, target_vocab text[]
)
language sql stable security definer set search_path = public as $$
  select p.panel_order, p.source_page_no, p.image_url, p.bubbles, p.target_vocab
  from public.pd_comic_panels p
  join public.pd_comic_issues i on i.id = p.issue_id
  where i.slug = p_slug and i.status = 'published'
  order by p.panel_order
$$;

-- 출처 표기 — PD 소재는 출처를 밝히는 것이 신뢰의 문제다
create or replace function public.select_pd_comic_provenance(p_slug text)
returns table (
  title text, series_title text, issue_no integer, published_year integer,
  source_adapter text, source_url text, pd_basis text
)
language sql stable security definer set search_path = public as $$
  select i.title, i.series_title, i.issue_no, i.published_year,
         i.source_adapter, i.source_url, i.pd_basis
  from public.pd_comic_issues i
  where i.slug = p_slug and i.status = 'published'
$$;

grant execute on function public.list_pd_comics() to anon, authenticated;
grant execute on function public.select_pd_comic(text) to anon, authenticated;
grant execute on function public.select_pd_comic_provenance(text) to anon, authenticated;

comment on table public.pd_comic_issues is
  'PDCP — 퍼블릭도메인 스캔 만화 호. CCP(comic_books, AI 생성)와 독립. 발행 게이트로 저작권 사고 방지';
comment on constraint pd_issues_publish_gate on public.pd_comic_issues is
  'PD 근거·검증자·검증시각·출처URL 이 모두 있어야 published. 코드 우회 경로까지 막기 위해 DB 제약';
