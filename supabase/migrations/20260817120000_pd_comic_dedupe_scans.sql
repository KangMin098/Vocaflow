-- supabase/migrations/20260817120000_pd_comic_dedupe_scans.sql
--
-- 학습자 서가에서 **같은 호의 여러 스캔본**을 한 칸으로 접는다.
--
-- 왜 필요한가 (실측 2026-08-16 적재 969건):
--   같은 호가 서로 다른 업로드로 여러 번 올라와 있다. 32개 그룹 · 중복 36행.
--     atomic-war #3      → atomic-war-003 · atomic-war-03 · AtomicWar003195302   (3본)
--     whiz-comics #2     → 1940-02 원본 · Millennium Edition reprint · 2.5 legal notice
--     wow-comics #16     → 1943-08 · 60p B&W Canadian(Bell Features) · UK
--     marvel-family #64  → 원본 · UK · B&W UK reprint
--   전부 (source_adapter, source_identifier) 가 달라 유니크 제약에 걸리지 않는다 —
--   **다른 파일이지만 같은 만화**다. 그대로 발행하면 학습자 서가에 "Atomic War 3" 이 세 칸 뜬다.
--
-- 왜 지우지 않는가:
--   운영 쪽에서는 여러 스캔본이 자산이다 — 어떤 본은 표지가 없고(coverless) 어떤 본은
--   흑백이며 어떤 본은 페이지가 더 많다. 취득해 봐야 어느 것이 나은지 알 수 있다.
--   그래서 **파이프라인에는 전부 남기고, 학습자에게 보이는 지점에서만 하나를 고른다.**
--
-- 고르는 기준: 컷이 많은 본(= 페이지가 온전한 스캔) → 먼저 등록된 본.
--   `panels_total` 은 취득·분할이 끝나야 채워지므로, 발행 시점에는 이미 신뢰할 수 있는 값이다.
--
-- ⚠️ 호수가 없는 항목(NULL, 실측 75건)은 **접으면 안 된다** — SQL 에서 NULL 은 DISTINCT ON 상
-- 서로 같게 취급되어, 번호 없는 별책 3권이 한 권으로 사라진다. id 로 갈라 각각 남긴다.

-- ── 학습자 호 목록 — 호당 스캔 1본 ─────────────────────────────
drop function if exists public.list_pd_comics(text);
create function public.list_pd_comics(p_series_key text default null)
returns table (
  id uuid, slug text, title text, series_title text, issue_no integer,
  published_year integer, cover_url text, panels_total integer,
  v_level smallint, library_book_id uuid,
  kind text, series_key text, kind_label text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with picked as (
    -- coalesce(issue_no::text, id::text): 번호 있는 호만 접고, 번호 없는 항목은 각자 남는다.
    select distinct on (i.series_key, coalesce(i.issue_no::text, i.id::text))
           i.id, i.slug, i.title, i.series_title, i.issue_no, i.published_year,
           i.cover_url, i.panels_total, i.v_level, i.library_book_id, i.kind, i.series_key
    from public.pd_comic_issues i
    where i.status = 'published'
      and (p_series_key is null or i.series_key = p_series_key)
    order by i.series_key, coalesce(i.issue_no::text, i.id::text),
             i.panels_total desc nulls last, i.created_at
  )
  select p.id, p.slug, p.title,
         coalesce(s.title, p.series_title), p.issue_no,
         p.published_year, p.cover_url, p.panels_total, p.v_level, p.library_book_id,
         p.kind, p.series_key, k.label
  from picked p
  left join public.pd_comic_series s on s.key = p.series_key
  left join public.pd_comic_kinds  k on k.key = p.kind
  order by k.sort_order nulls last, s.title nulls last, p.issue_no nulls last, p.title
$function$;

-- ── 서가 집계 — 권수도 "호" 기준이어야 한다 ────────────────────
-- 스캔본을 세면 서가 카드가 "Atomic War 9권"이라고 말하는데 열면 4권이다.
-- 카드의 숫자와 목록의 길이가 다르면 그 숫자는 거짓말이 된다.
create or replace function public.list_pd_comic_shelf()
returns table (
  kind             text,
  kind_label       text,
  kind_blurb       text,
  kind_learner_note text,
  kind_sort        int,
  series_key       text,
  series_title     text,
  publisher        text,
  series_blurb     text,
  year_from        int,
  year_to          int,
  issues_published int,
  panels_total     int,
  cover_url        text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with picked as (
    select distinct on (i.series_key, coalesce(i.issue_no::text, i.id::text))
           i.id, i.series_key, i.issue_no, i.published_year, i.panels_total, i.cover_url
    from public.pd_comic_issues i
    where i.status = 'published'
    order by i.series_key, coalesce(i.issue_no::text, i.id::text),
             i.panels_total desc nulls last, i.created_at
  )
  select
    k.key, k.label, k.blurb, k.learner_note, k.sort_order,
    s.key, s.title, s.publisher, s.blurb,
    min(p.published_year)::int,
    max(p.published_year)::int,
    count(p.id)::int,
    coalesce(sum(p.panels_total), 0)::int,
    coalesce(
      s.cover_url,
      (select p2.cover_url from picked p2
        where p2.series_key = s.key and p2.cover_url is not null
        order by p2.issue_no nulls last, p2.published_year nulls last
        limit 1)
    )
  from public.pd_comic_series s
  join public.pd_comic_kinds  k on k.key = s.kind
  join picked p on p.series_key = s.key
  group by k.key, k.label, k.blurb, k.learner_note, k.sort_order,
           s.key, s.title, s.publisher, s.blurb, s.cover_url
  having count(p.id) > 0
  order by k.sort_order, count(p.id) desc, s.title
$function$;

-- ── 정보 팝업의 시리즈 권수도 같은 기준 ────────────────────────
create or replace function public.select_pd_comic_info(p_slug text)
returns table (
  slug text, title text, issue_no integer, published_year integer,
  cover_url text, panels_total integer, v_level smallint, library_book_id uuid,
  series_key text, series_title text, series_blurb text, publisher text,
  kind text, kind_label text, kind_blurb text, kind_learner_note text,
  source_archive text, source_url text, pd_basis text, published_at timestamptz,
  bubble_count integer, series_issues_published integer
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    i.slug, i.title, i.issue_no, i.published_year,
    i.cover_url, i.panels_total, i.v_level, i.library_book_id,
    i.series_key, coalesce(s.title, i.series_title), s.blurb, s.publisher,
    i.kind, k.label, k.blurb, k.learner_note,
    i.source_adapter, i.source_url, i.pd_basis, i.published_at,
    (select coalesce(sum(jsonb_array_length(p.bubbles)), 0)::int
       from public.pd_comic_panels p
      where p.issue_id = i.id and jsonb_typeof(p.bubbles) = 'array'),
    -- 스캔본이 아니라 호를 센다 — 팝업의 "이 시리즈 N권" 버튼이 목록 길이와 같아야 한다.
    (select count(distinct coalesce(i2.issue_no::text, i2.id::text))::int
       from public.pd_comic_issues i2
      where i2.series_key = i.series_key and i2.status = 'published')
  from public.pd_comic_issues i
  left join public.pd_comic_series s on s.key = i.series_key
  left join public.pd_comic_kinds  k on k.key = i.kind
  where i.slug = p_slug and i.status = 'published'
$function$;

grant execute on function public.list_pd_comics(text)       to anon, authenticated;
grant execute on function public.list_pd_comic_shelf()      to anon, authenticated;
grant execute on function public.select_pd_comic_info(text) to anon, authenticated;
