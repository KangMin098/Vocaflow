-- scripts/dict/measure-test-corpus.sql
-- 테스트 코퍼스(extraction_test_vocab) 해소율 측정 — 단어추출+사전 품질 평가.
-- 계층: 학습코어(shared_dictionary) / 영어커버리지(lexicon_clean en) / 외국어(lang≠en) / 정규화 / 잔여.
-- 사용: 아래 2블록을 순서대로 실행. ①분류 materialize ②집계.

-- ① 분류 (재빌드)
set statement_timeout to '280000';
drop table if exists _tc_cls;
create table _tc_cls as
select v.book_gid as bid, v.lemma as w,
  case
    when exists(select 1 from shared_dictionary d where d.word = any(array[v.lemma]||en_inflection_bases(v.lemma)) and d.classified_by is not null and d.meaning_ko is not null and length(d.meaning_ko)>0) then 'learn'
    when exists(select 1 from lexicon_clean lc where lc.word = any(array[v.lemma]||en_inflection_bases(v.lemma)) and lc.meaning_ko is not null and lc.lang='en') then 'coverage_en'
    when exists(select 1 from lexicon_clean lc where lc.word = any(array[v.lemma]||en_inflection_bases(v.lemma)) and lc.meaning_ko is not null and lc.lang<>'en') then 'foreign'
    when exists(select 1 from shared_dictionary d where d.word in (select unnest(array[sv]||en_inflection_bases(sv)) from unnest(surface_variants(v.lemma)) sv) and d.classified_by is not null and d.meaning_ko is not null and length(d.meaning_ko)>0) then 'learn_norm'
    when exists(select 1 from lexicon_clean lc where lc.word in (select unnest(array[sv]||en_inflection_bases(sv)) from unnest(surface_variants(v.lemma)) sv) and lc.meaning_ko is not null) then 'coverage_norm'
    else 'residual'
  end as cls
from extraction_test_vocab v;

-- ② 전체 집계
select
  count(*) as total,
  count(*) filter (where cls in ('learn','learn_norm')) as learn,
  count(*) filter (where cls='coverage_en') as cov_en,
  count(*) filter (where cls='coverage_norm') as cov_norm,
  count(*) filter (where cls='foreign') as foreign,
  count(*) filter (where cls='residual') as residual,
  round(100.0*count(*) filter (where cls<>'residual')/count(*),2) as resolved_pct
from _tc_cls;

-- ②' 도서별 (해소율 낮은 순 = 난이도/잔여 많은 책)
-- select (select author||'/'||title from extraction_test_books b where b.book_gid=c.bid) as book,
--   count(*) total, count(*) filter (where cls='residual') residual,
--   round(100.0*count(*) filter (where cls<>'residual')/count(*),1) resolved_pct
-- from _tc_cls c group by c.bid order by resolved_pct asc limit 30;
