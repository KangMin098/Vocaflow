-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/forward.sql
-- 범위 B: public.csat_items.passage 의 2014A#29 Hours 각주 복원 1행. 개발 DB jajenrevcbmrpaliomxv. 사용자 승인 전 실행 금지.
-- 단독으로 실행하지 않는다 — B-2014A29/README.md 의 반영 순서(문항 보류 → 해설 동시 교체 → 이 SQL → 확인 → 보류 해제)를 따른다.
-- PK: id = '2014A#29'. 바꾸는 열은 passage 하나. 승인 시점 md5(passage) 가 같을 때만 바꾸고, 1행이 아니면 되돌린다.
do $$
declare n int;
begin
  update public.csat_items
     set passage = replace(passage, '5:00 p.m. month. Fees', '5:00 p.m. * The museum is closed on the first Monday of every month. Fees')
   where id = '2014A#29' and md5(passage) = '354dba3df716d6db04d6cc643afeec3e';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '범위 B: 기대 1행, 실제 %행 — 승인 시점 값과 다르다. 아무것도 바꾸지 않는다', n;
  end if;
end $$;
