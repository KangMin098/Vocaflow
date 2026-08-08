-- scripts/comic/pd/migration.sql
--
-- PDCP — 퍼블릭 도메인 스캔 만화 출처·법적 근거 저장.
-- ⚠️ 사용자 승인 전 적용 금지 (CLAUDE.md). 승인 시 supabase/migrations/ 로 옮겨 apply_migration.
--
-- 설계 원칙:
--   · comic_books 를 갈아엎지 않는다. PD 소재는 기존 발행 게이트·리더·Admin 을 그대로 타고,
--     "출처가 무엇이며 왜 써도 되는가"만 추가로 기록한다.
--   · 근거 없는 PD 소재가 발행되는 일이 없도록 **DB 레벨 제약**으로 막는다.
--     (앱 코드만으로 막으면 스크립트 직접 적재 경로가 뚫린다)

-- ── 1. 소스 구분 ────────────────────────────────────────────────
-- 기존 행은 전부 AI 생성이므로 기본값 'ai-gen' 으로 백필된다.
alter table public.comic_books
  add column if not exists source_kind text not null default 'ai-gen';

alter table public.comic_books
  drop constraint if exists comic_books_source_kind_chk;
alter table public.comic_books
  add constraint comic_books_source_kind_chk
  check (source_kind in ('ai-gen', 'pd-scan'));

-- ── 2. 출처·법적 근거 (pd-scan 전용) ─────────────────────────────
alter table public.comic_books
  add column if not exists source_archive     text,   -- 'internet-archive' | 'digital-comic-museum' | ...
  add column if not exists source_identifier  text,   -- 예: ClassicsIllustrated027TheSpy
  add column if not exists source_url         text,
  add column if not exists series_title       text,   -- 'Classics Illustrated'
  add column if not exists issue_no           integer,
  add column if not exists published_year     integer,
  add column if not exists pd_basis           text,   -- 'pre-1929' | 'no-renewal' | 'explicit-license'
  add column if not exists pd_evidence_url    text,   -- UPenn 갱신기록 등 근거 링크
  add column if not exists pd_checked_at      timestamptz,
  add column if not exists pd_checked_by      uuid references auth.users(id) on delete set null;

alter table public.comic_books
  drop constraint if exists comic_books_pd_basis_chk;
alter table public.comic_books
  add constraint comic_books_pd_basis_chk
  check (pd_basis is null or pd_basis in ('pre-1929', 'no-renewal', 'explicit-license'));

-- ── 3. 발행 게이트 — 근거 없는 PD 소재는 published 로 갈 수 없다 ──
-- 왜 DB 제약인가: 저작권 사고는 되돌릴 수 없다. 앱 코드 한 곳을 우회하는 경로
-- (스크립트 직접 insert, SQL 콘솔)가 존재하는 한 코드 검증만으로는 부족하다.
alter table public.comic_books
  drop constraint if exists comic_books_pd_provenance_chk;
alter table public.comic_books
  add constraint comic_books_pd_provenance_chk
  check (
    source_kind <> 'pd-scan'
    or status <> 'published'
    or (
      source_archive is not null
      and source_identifier is not null
      and pd_basis is not null
      and pd_checked_at is not null
    )
  );

-- ── 4. 컷 단위 복원 이력 (재현·감사) ─────────────────────────────
-- 어떤 원본 페이지의 어느 영역을, 어떤 파라미터로 복원했는지.
-- 문제가 생겼을 때 "이 컷을 다시 만들려면?" 에 답할 수 있어야 한다.
alter table public.comic_pages
  add column if not exists source_page_no  integer,  -- 원본 스캔 페이지 번호
  add column if not exists source_box      jsonb,    -- {x,y,w,h} 복원본 기준 컷 영역
  add column if not exists restore_params  jsonb;    -- {paper,gains,sat,scale,denoise,analysis,dilate}

-- ── 5. 조회 인덱스 ──────────────────────────────────────────────
create index if not exists comic_books_source_kind_idx
  on public.comic_books (source_kind);
create index if not exists comic_books_source_identifier_idx
  on public.comic_books (source_identifier)
  where source_identifier is not null;

-- ── 6. 학습자 노출용 출처 (RLS 안전) ─────────────────────────────
-- 리더/도서 상세가 출처를 표기하려면 발행본에 한해 읽을 수 있어야 한다.
create or replace function public.select_comic_provenance(p_book_id uuid)
returns table (
  source_kind text,
  source_archive text,
  source_url text,
  series_title text,
  issue_no integer,
  published_year integer,
  pd_basis text
)
language sql
stable
security definer
set search_path = public
as $$
  select cb.source_kind, cb.source_archive, cb.source_url,
         cb.series_title, cb.issue_no, cb.published_year, cb.pd_basis
  from public.comic_books cb
  where cb.library_book_id = p_book_id
    and cb.status = 'published'   -- 발행본만 (기존 학습자 read 게이트와 동일)
$$;

grant execute on function public.select_comic_provenance(uuid) to anon, authenticated;

comment on column public.comic_books.source_kind is
  'ai-gen = 도서→AI 생성(CCP) · pd-scan = 퍼블릭도메인 스캔 복원(PDCP)';
comment on constraint comic_books_pd_provenance_chk on public.comic_books is
  'PD 소재는 출처·PD 근거·검증시각이 모두 채워져야 published 로 갈 수 있다 (저작권 사고 방지)';
