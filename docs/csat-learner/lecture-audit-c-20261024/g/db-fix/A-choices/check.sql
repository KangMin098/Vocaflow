-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/A-choices/check.sql
-- 적용 전·후 모두 이 SELECT 하나로 확인한다(읽기 전용).
-- 적용 전 기대: state = 'before' 3행 · 적용 후 기대: state = 'after' 3행 · 그 밖의 값이 나오면 멈추고 다시 대조한다.
select id,
       md5(choices::text) as choices_md5,
       md5(passage) as passage_md5,
       right(choices->>4, 30) as choice5_tail,
       case md5(choices::text)
         when 'eadc859ef6f20687e6b413b72edcbff7' then 'before' when '964f24d99fd78f83d0c1665f207fc654' then 'after'
         when '75afb175f723a2256c424c229f917406' then 'before' when 'f380f7ee5dfa8b569414d54a8b5182af' then 'after'
         when 'b7dad550901a58eb02a126df22624888' then 'before' when '764a83418a6b8862f08b594322f33960' then 'after'
         else 'UNEXPECTED' end as state
  from public.csat_items
 where id in ('2017#24', '2018#24', 'M2509#25')
 order by id;
-- 지문(passage_md5)은 전후 같아야 한다: 2017#24 9e5dbc2e… · 2018#24 fe35fdc6… · M2509#25 1325adaf…
