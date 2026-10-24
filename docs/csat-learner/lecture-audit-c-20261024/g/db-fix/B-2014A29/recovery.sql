-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/recovery.sql
-- 범위 B 되돌리기 — 정정된 지문 md5 가 같을 때만 「month.」 조각 상태로 되돌린다. 행 삭제·DDL 없음. 왕복 md5 검증 완료(2026-10-24 SELECT).
-- 지문만 되돌리면 새 해설과 어긋난다 — README 의 복구 순서(문항 보류 → 이 SQL → 해설 이전 판 복귀 → 보류 해제)를 따른다.
do $$
declare n int;
begin
  update public.csat_items
     set passage = replace(passage, '5:00 p.m. * The museum is closed on the first Monday of every month. Fees', '5:00 p.m. month. Fees')
   where id = '2014A#29' and md5(passage) = '6b4dd8818f63a6c9086b06dd8833027a';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception '범위 B 복구: 기대 1행, 실제 %행 — 정정 뒤 다른 변경이 있었다. 아무것도 바꾸지 않는다', n;
  end if;
end $$;
