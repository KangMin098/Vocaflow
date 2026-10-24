-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/D-three/recovery.sql (make-package.mjs 생성)
-- 되돌리기: 정정 뒤 md5 가 같을 때만 원래 문자열로 되돌린다. 행 삭제·DDL 없음. 3행이 아니면 전체 롤백.
do $$
declare n int; total int := 0;
begin
  update public.csat_items set passage = replace(passage, $q$transmissible$q$, $q$trans-missible$q$)
   where id = '2023#32' and md5(passage) = '839326bfae83588520b8e107aaf0e8e3';
  get diagnostics n = row_count; total := total + n;
  update public.csat_items set passage = passage || $q$ [3점] (A) (B) (A) (B)$q$
   where id = '2014B#36' and md5(passage) = '0b6a803ce0d702594d3d85705013be45';
  get diagnostics n = row_count; total := total + n;
  update public.csat_items set passage = passage || $q$

(A) (B) (A) (B)$q$
   where id = '2017#42' and md5(passage) = 'ac52fa4ae3dae03384dc2983a4fb6430';
  get diagnostics n = row_count; total := total + n;
  if total <> 3 then raise exception 'C-D 되돌리기: 기대 3행, 실제 %행 — 승인 시점 값과 다르다. 아무것도 바꾸지 않는다', total; end if;
end $$;
