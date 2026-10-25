-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/D-three/forward.sql (make-package.mjs 생성)
-- 확정 원문 오류 3건: public.csat_items.passage 만. 2023#32 줄바꿈 하이픈 · 2014B#36 · 2017#42 지문 끝 배점·선지 표 머리 꼬리.
-- 개발 DB jajenrevcbmrpaliomxv. compare-and-set — 3행이 아니면 전체 롤백. 사용자 별도 승인 전 실행 금지 · 승인형 러너로만.
do $$
declare n int; total int := 0;
begin
  update public.csat_items set passage = replace(passage, $q$trans-missible$q$, $q$transmissible$q$)
   where id = '2023#32' and md5(passage) = '03a62be16a1bc6357446a0d3a4c25ad9';
  get diagnostics n = row_count; total := total + n;
  update public.csat_items set passage = replace(passage, $q$ [3점] (A) (B) (A) (B)$q$, '')
   where id = '2014B#36' and md5(passage) = '4910c6d0824e9e5b8e1a29265b29659d';
  get diagnostics n = row_count; total := total + n;
  update public.csat_items set passage = replace(passage, $q$

(A) (B) (A) (B)$q$, '')
   where id = '2017#42' and md5(passage) = '5bb996e451c82758a15c4fe0e5b00ea2';
  get diagnostics n = row_count; total := total + n;
  if total <> 3 then raise exception 'C-D 정정: 기대 3행, 실제 %행 — 승인 시점 값과 다르다. 아무것도 바꾸지 않는다', total; end if;
end $$;
