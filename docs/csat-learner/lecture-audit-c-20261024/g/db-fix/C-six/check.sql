-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/C-six/check.sql
-- 적용 전·후 확인(읽기 전용). 전: 6행 모두 'before' · 후: 6행 모두 'after'. 그 밖이면 멈춘다. passage md5 는 전후 같아야 한다.
select id, md5(choices::text) as choices_md5, md5(passage) as passage_md5, right(choices->>4, 40) as choice5_tail,
       case md5(choices::text)
         when 'b7c5a422fb50f0732370d5cb5ef048f9' then 'before' when 'f8230ca055e8f18a4386b47891cbdb62' then 'after'
         when '0dc1e7ccf73cf082babbbfc48366c0e9' then 'before' when 'a598f33f131019ca218b0da5ed93f146' then 'after'
         when 'a2b537e7fe822f8ef58d9312a9588359' then 'before' when '39d319b929491f62006ae03f0071f0ef' then 'after'
         when '89281d418e63c96fa279b88d64cdcdbe' then 'before' when '11632335d63f31b472701ba1977da8df' then 'after'
         when 'a4aa1417d27c97fcb4267cc9b5edf0b7' then 'before' when '1311573e80fa29e6aa39737417e20a0b' then 'after'
         when '02ce114a5933f672e9ef15c268c8871e' then 'before' when '2a5004c8054f05d9531d612432ea93c9' then 'after'
         else 'UNEXPECTED' end as state
  from public.csat_items
 where id in ('2025#30', 'M1809#35', 'M2006#35', 'M2106#35', 'M2206#35', 'M2209#35')
 order by id;
-- passage md5: 2025#30 2814438c… · M1809#35 ea58ae07… · M2006#35 c4f97aef… · M2106#35 4f5462d3… · M2206#35 9a76a863… · M2209#35 482fb8dc…
