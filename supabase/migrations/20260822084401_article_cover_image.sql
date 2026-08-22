-- ACP 짧은 글(기사) 커버 이미지 — library_articles 에 이미지 컬럼.
--
-- 기사에는 이미지 컬럼이 아예 없었다(36컬럼 전수 확인, 발행 160건 0장). 그래서 화면이
-- GradientBookCover(Penguin Clothbound 풍 양장본 표지)로 폴백했고, 학습자는 카드만 보고
-- 기사인지 책인지 구분하지 못했다.
--
-- 색·그라디언트 컬럼은 만들지 않는다 — 디자인 표지(ArticleCover)가 source 에서 색을
-- 결정론적으로 유도한다(lib/articles/source-meta.ts). DB 에 저장하면 출처가 둘이 되어
-- 반드시 어긋난다. 도서의 cover_from/cover_to 가 그 전례다(texts 277행 중 6행만 채워짐).

alter table public.library_articles
  add column if not exists cover_image_url text,
  add column if not exists cover_image_meta jsonb,
  add column if not exists cover_verified_at timestamptz;

comment on column public.library_articles.cover_image_url is
  '실사진 커버 URL. NULL 이면 화면이 디자인 표지(ArticleCover)를 그린다 — 폴백이 아니라 기본값이다.';

comment on column public.library_articles.cover_image_meta is
  '출처 표기 정보. 저작권법 제37조상 실사진을 쓰면 출처 명시가 의무다(공정이용 제35조의5 에도 적용 — 단서에 미포함). 위반 시 제138조 제2호 500만원 이하 벌금. { source, provider, license, license_url, creator, creator_url, page_url, width, height } — width/height 는 실측값. shared_word_sets.cover_image_meta 와 같은 구조.';

comment on column public.library_articles.cover_verified_at is
  'HEAD 검증(isImageOk) 통과 시각. NULL 이면 URL 이 있어도 화면이 쓰지 않는다. 죽은 URL 이 검은 박스로 노출되던 사고(2026-08-15, fa43acd8 — Standard Ebooks 시드 1,450건 중 1,369건 404)의 재발 방지 장치.';

create index if not exists idx_library_articles_cover_missing
  on public.library_articles (published_at desc)
  where status = 'published' and cover_verified_at is null;
