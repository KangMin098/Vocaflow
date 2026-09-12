-- library_articles.source 에 'gutenberg' 를 더한다.
--
-- 2단계(30,000)의 부족분은 대부분 인문 칸이고, 학술 오픈액세스 소스는 규모나 수율에서
-- 전부 막혔다(docs/reports/csat-source-fit-20260903.md §20~26). Project Gutenberg 는
-- PD 라 라이선스가 깨끗하고 인문 논픽션이 많으며, 실측에서 정제 후 권당 병목 3칸
-- 8.8편이 나왔다(§44~§46).
--
-- 허용값을 하나 더할 뿐이고 기존 21개 값과 데이터는 그대로다.
alter table public.library_articles
  drop constraint library_articles_source_check;

alter table public.library_articles
  add constraint library_articles_source_check
  check (source = any (array[
    'voa'::text, 'nasa'::text, 'nih'::text, 'manual'::text, 'cdc'::text,
    'medlineplus'::text, 'wikinews'::text, 'the_conversation'::text,
    'simple_wikipedia'::text, 'owid'::text, 'factbook'::text, 'elife'::text,
    'wikipedia'::text, 'plos'::text, 'wikivoyage'::text, 'usgs'::text,
    'noaa'::text, 'futurity'::text, 'storyweaver'::text, 'space_place'::text,
    'original'::text,
    'gutenberg'::text
  ]));
