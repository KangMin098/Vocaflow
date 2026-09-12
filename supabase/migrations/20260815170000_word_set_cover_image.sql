-- supabase/migrations/20260815170000_word_set_cover_image.sql
--
-- 단어장 표지 이미지.
--
-- 도서는 Gutenberg 가 제 표지를 갖고 오지만(library_books.cover_image_url) 단어장은 세상에
-- 표지가 없다. 지금은 `cover_emoji` 하나로 버티는데, 카탈로그에서 29권이 나란히 서면
-- 이모지만으로는 서로 구별되지 않고 기억에도 남지 않는다.
--
-- 외부(Openverse)에서 받아 오므로 **라이선스 표기가 의무**다. URL 만 저장하면 CC 위반이
-- 되므로 출처·라이선스·제작자를 같이 남긴다 — 나중에 표기하려 해도 출처를 되찾을 수 없다.
--
-- 수집: `scripts/vcb/fetch-covers.mts` (재실행 가능 · `--only <유형>` 으로 재추첨)
-- 시각 설계: `apps/web/src/lib/vcb/covers/design.ts` (계열 5색 듀오톤 · 유형별 검색어)
alter table public.shared_word_sets
  add column if not exists cover_image_url text,
  add column if not exists cover_image_meta jsonb;

comment on column public.shared_word_sets.cover_image_url is
  '표지 이미지 원본 URL (Openverse 등 외부 CC/PD 자료). NULL 이면 그라디언트 표지로 폴백.';
comment on column public.shared_word_sets.cover_image_meta is
  '표지 출처 — {source, provider, license, license_url, creator, creator_url, page_url, query, family}. CC 표기 의무를 지키기 위한 필수 동반 데이터.';
