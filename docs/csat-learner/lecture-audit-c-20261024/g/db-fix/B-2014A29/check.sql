-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/check.sql
-- 적용 전·후 확인(읽기 전용). 적용 전 기대: state='before' · 적용 후 기대: state='after'. 그 밖이면 멈춘다.
select id,
       md5(passage) as passage_md5,
       md5(choices::text) as choices_md5,
       position('first Monday' in passage) > 0 as has_footnote,
       (length(passage) - length(replace(passage, 'p.m. month.', ''))) / length('p.m. month.') as fragment_count,
       case md5(passage) when '354dba3df716d6db04d6cc643afeec3e' then 'before'
                         when '6b4dd8818f63a6c9086b06dd8833027a' then 'after'
                         else 'UNEXPECTED' end as state
  from public.csat_items
 where id = '2014A#29';
-- 선지(choices_md5)는 전후 같아야 한다: 9b38a7ffcabc90a1eaeacd20551c163a
