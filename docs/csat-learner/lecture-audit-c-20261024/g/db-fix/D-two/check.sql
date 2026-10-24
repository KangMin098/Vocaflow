-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/D-two/check.sql (make-package.mjs 생성) — 읽기 전용. 전: before 2 · 후: after 2
select id, md5(passage) as passage_md5, md5(choices::text) as choices_md5, right(passage, 40) as tail,
       case md5(passage)
         when '4910c6d0824e9e5b8e1a29265b29659d' then 'before' when '0b6a803ce0d702594d3d85705013be45' then 'after'
         when '5bb996e451c82758a15c4fe0e5b00ea2' then 'before' when 'ac52fa4ae3dae03384dc2983a4fb6430' then 'after'
         else 'UNEXPECTED' end as state
  from public.csat_items where id in ('2014B#36', '2017#42') order by id;
