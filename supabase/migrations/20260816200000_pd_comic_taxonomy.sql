-- supabase/migrations/20260816200000_pd_comic_taxonomy.sql
--
-- PDCP 분류 구조 — 유형(kind) · 시리즈(series) 두 축을 도입한다.
--
-- 왜 필요한가:
--   pd_comic_issues 는 지금까지 `series_title` 이라는 **자유 텍스트 한 칸**으로만 묶여 있었다.
--   원본 제목이 "Fawcett Comics: Whiz Comics 022 (b and w) (coverless)" 처럼 들어오므로
--   그 칸은 같은 시리즈를 표기마다 다르게 적는다 — 학습자 서가에서 한 시리즈가 여러 칸으로 쪼개진다.
--   1,020건 실측에서 자유 텍스트 기준 서로 다른 값이 168개였는데, 실제 시리즈는 90개다.
--
--   그리고 학습자에게 "골든에이지 만화 1,000권"을 평면 격자로 주는 것은 카탈로그이지 서가가 아니다.
--   유형은 **어휘 도메인**이 갈리는 단위다(서부물의 ain't/reckon 과 SF 의 과학 어휘는 다른 학습이다).
--   그래서 유형을 1급 개념으로 올리고, 유형마다 "이걸 읽으면 어떤 영어를 얻나"를 데이터로 갖는다.
--
-- 정본은 `scripts/comic/pd/taxonomy.mjs` 의 규칙표다. 이 마이그레이션은 그 **유형 축**을 심고,
-- 시리즈 행은 대량 적재(ingest-bulk.mjs)가 규칙표에서 upsert 한다.
-- kind FK 가 둘 사이의 드리프트를 조용히 넘어가지 않고 **적재 시점에 실패**시킨다.

-- ── 유형 마스터 ────────────────────────────────────────────────
create table if not exists public.pd_comic_kinds (
  key          text primary key,
  label        text not null,
  blurb        text,
  -- "이 유형을 읽으면 어떤 영어를 얻나" — 학습자 팝업이 그대로 읽는다.
  learner_note text,
  sort_order   int  not null,
  created_at   timestamptz not null default now()
);

comment on table public.pd_comic_kinds is
  'PD 만화 유형(어휘 도메인 축). 정본 규칙표는 scripts/comic/pd/taxonomy.mjs.';

-- ── 시리즈 마스터 ──────────────────────────────────────────────
-- 호 수(issues_total)는 **저장하지 않는다** — 적재·발행마다 바뀌는 값을 컬럼에 두면
-- 반드시 실제와 어긋난다(프로젝트 안티패턴: 파생 카운터 컬럼 금지). 조회 시 집계한다.
create table if not exists public.pd_comic_series (
  key        text primary key,
  title      text not null,
  kind       text not null references public.pd_comic_kinds(key),
  publisher  text,
  blurb      text,
  cover_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.pd_comic_series is
  'PD 만화 시리즈 마스터. 행은 ingest-bulk.mjs 가 taxonomy.mjs 규칙표에서 upsert 한다.';

create index if not exists pd_comic_series_kind_idx on public.pd_comic_series (kind);

-- ── 호 → 유형·시리즈 연결 ──────────────────────────────────────
alter table public.pd_comic_issues
  add column if not exists kind       text references public.pd_comic_kinds(key),
  add column if not exists series_key text references public.pd_comic_series(key);

create index if not exists pd_comic_issues_kind_idx   on public.pd_comic_issues (kind);
create index if not exists pd_comic_issues_series_idx on public.pd_comic_issues (series_key, issue_no);

comment on column public.pd_comic_issues.series_key is
  '정규화된 시리즈 키. 자유 텍스트 series_title 은 원본 표기 보존용으로 남긴다(출처 대조용).';

-- ── 유형 시드 ──────────────────────────────────────────────────
-- taxonomy.mjs KINDS 와 key·sort 가 같아야 한다(테스트가 규칙표 쪽 무결성을 강제).
insert into public.pd_comic_kinds (key, label, blurb, learner_note, sort_order) values
  ('classic-adaptation', '고전 각색', '소설 고전을 만화로 옮긴 각색물.',
   '그레이디드 리더·수능 지문과 어휘가 겹칩니다. 원작 도서로 이어가기 가장 쉬운 유형.', 1),
  ('superhero', '슈퍼히어로', '1940년대 골든에이지 영웅물. Captain Marvel 계열이 중심.',
   '짧은 명령문·감탄문이 많아 회화 리듬을 익히기 좋습니다. 의성어와 구어체 축약형이 빈번합니다.', 2),
  ('humor-daily', '명랑 일상', '가정·학교의 일상 소동을 다룬 유머물.',
   '생활 영어 회화 밀도가 가장 높습니다. 문장이 짧고 현재시제 중심이라 진입 난이도가 낮습니다.', 3),
  ('funny-animal', '명랑 동물', '의인화된 동물 주인공의 코믹물.',
   '어휘가 구체적이고 반복이 많아 초급 진입에 적합합니다.', 4),
  ('adventure', '모험', '정글·항해·탐험 활극.',
   '지형·이동·자연 어휘가 집중적으로 나옵니다. 과거시제 서술 비중이 높습니다.', 5),
  ('western', '서부', '카우보이·보안관·개척지 이야기.',
   '방언과 축약형(ain’t, reckon)이 많습니다. 표준 어휘를 먼저 다진 뒤 읽기를 권합니다.', 6),
  ('mystery-horror', '괴기·미스터리', '괴담·초자연·서스펜스 단편집.',
   '분위기 묘사 형용사와 심리 어휘가 풍부합니다. 문장이 길어 중급 이상에 적합합니다.', 7),
  ('crime', '범죄 수사', '형사·법정·범죄 실화 각색.',
   '법·수사 용어와 인과 접속사(therefore, thus)가 자주 등장합니다.', 8),
  ('scifi', 'SF', '우주·미래·핵시대 상상물.',
   '과학·기술 어휘와 가정법 문장이 많습니다. 과학 지문 독해와 어휘가 겹칩니다.', 9),
  ('war', '전쟁', '2차대전·한국전 배경 전투물.',
   '군사·지휘 어휘와 명령문이 중심입니다. 소재가 무거워 연령 확인이 필요합니다.', 10),
  ('romance', '로맨스', '1950년대 연애 단편집.',
   '감정·관계 어휘와 대화체 1인칭 서술이 많습니다.', 11),
  ('other', '미분류', '규칙표에 걸리지 않은 항목.',
   '검수에서 유형을 지정해야 학습자 서가에 묶여 나갑니다.', 99)
on conflict (key) do update set
  label = excluded.label, blurb = excluded.blurb,
  learner_note = excluded.learner_note, sort_order = excluded.sort_order;

-- ── RLS — 카탈로그 메타는 공개 읽기 (발견·SEO. 호 자체는 기존 published 게이트 유지) ──
alter table public.pd_comic_kinds  enable row level security;
alter table public.pd_comic_series enable row level security;

drop policy if exists pd_kinds_read_all  on public.pd_comic_kinds;
drop policy if exists pd_series_read_all on public.pd_comic_series;
create policy pd_kinds_read_all  on public.pd_comic_kinds  for select using (true);
create policy pd_series_read_all on public.pd_comic_series for select using (true);

-- ── 학습자 서가 — 유형 → 시리즈 묶음 ───────────────────────────
-- 발행본이 하나도 없는 유형·시리즈는 **내보내지 않는다** (빈 칸을 파는 것이 되므로).
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
  select
    k.key, k.label, k.blurb, k.learner_note, k.sort_order,
    s.key, s.title, s.publisher, s.blurb,
    min(i.published_year)::int,
    max(i.published_year)::int,
    count(i.id)::int,
    coalesce(sum(i.panels_total), 0)::int,
    -- 시리즈 표지 = 지정 표지 우선, 없으면 가장 이른 호의 표지
    coalesce(
      s.cover_url,
      (select i2.cover_url
         from public.pd_comic_issues i2
        where i2.series_key = s.key and i2.status = 'published' and i2.cover_url is not null
        order by i2.issue_no nulls last, i2.published_year nulls last
        limit 1)
    )
  from public.pd_comic_series s
  join public.pd_comic_kinds  k on k.key = s.kind
  join public.pd_comic_issues i on i.series_key = s.key and i.status = 'published'
  group by k.key, k.label, k.blurb, k.learner_note, k.sort_order,
           s.key, s.title, s.publisher, s.blurb, s.cover_url
  having count(i.id) > 0
  order by k.sort_order, count(i.id) desc, s.title
$function$;

comment on function public.list_pd_comic_shelf() is
  '학습자 서가 — 유형별로 묶인 시리즈 목록(발행본 있는 것만).';

-- ── 목록 RPC — 유형·시리즈를 함께 실어 화면이 다시 조인하지 않게 ──
-- 반환 컬럼이 늘어나므로 `create or replace` 로는 바꿀 수 없다(반환 타입 변경 불가) → 먼저 drop.
-- 기존 무인자 버전을 남겨두면 `list_pd_comics()` 호출이 두 오버로드 사이에서 모호해지므로
-- **반드시 지운다**(남기면 앱의 기존 호출이 42725 ambiguous 로 죽는다).
drop function if exists public.list_pd_comics();
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
  select i.id, i.slug, i.title,
         coalesce(s.title, i.series_title), i.issue_no,
         i.published_year, i.cover_url, i.panels_total, i.v_level, i.library_book_id,
         i.kind, i.series_key, k.label
  from public.pd_comic_issues i
  left join public.pd_comic_series s on s.key = i.series_key
  left join public.pd_comic_kinds  k on k.key = i.kind
  where i.status = 'published'
    and (p_series_key is null or i.series_key = p_series_key)
  order by k.sort_order nulls last, s.title nulls last, i.issue_no nulls last, i.title
$function$;

-- ── 콘텐츠 정보 팝업 — 학습자가 "이게 뭔지" 판단할 근거를 한 번에 ──
-- 출처·PD 근거를 함께 내보내는 것은 장식이 아니다. 복원 만화는 **왜 이걸 무료로 읽을 수 있는지**가
-- 신뢰의 문제라, 원본 링크와 근거를 숨기면 정당한 콘텐츠가 해적판처럼 보인다.
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
    (select count(*)::int
       from public.pd_comic_issues i2
      where i2.series_key = i.series_key and i2.status = 'published')
  from public.pd_comic_issues i
  left join public.pd_comic_series s on s.key = i.series_key
  left join public.pd_comic_kinds  k on k.key = i.kind
  where i.slug = p_slug and i.status = 'published'
$function$;

comment on function public.select_pd_comic_info(text) is
  '학습자 콘텐츠 정보 팝업 — 서지·유형 학습노트·출처·PD 근거·분량을 한 번에.';

grant execute on function public.list_pd_comic_shelf()        to anon, authenticated;
grant execute on function public.list_pd_comics(text)         to anon, authenticated;
grant execute on function public.select_pd_comic_info(text)   to anon, authenticated;
