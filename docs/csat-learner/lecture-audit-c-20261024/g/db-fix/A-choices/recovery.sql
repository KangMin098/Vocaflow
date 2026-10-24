-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/A-choices/recovery.sql
-- 범위 A 되돌리기 — 정정된 값의 md5 가 같을 때만 원래 잔여물을 다시 붙인다. 행 삭제·DDL 없음. 왕복 md5 검증 완료(2026-10-24 SELECT).
do $$
declare n int; total int := 0;
begin
  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' 8'))
   where id = '2017#24' and md5(choices::text) = '964f24d99fd78f83d0c1665f207fc654';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' 8'))
   where id = '2018#24' and md5(choices::text) = 'f380f7ee5dfa8b569414d54a8b5182af';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' * augmented reality: 증강 현실'))
   where id = 'M2509#25' and md5(choices::text) = '764a83418a6b8862f08b594322f33960';
  get diagnostics n = row_count; total := total + n;

  if total <> 3 then
    raise exception '범위 A 복구: 기대 3행, 실제 %행 — 정정 뒤 다른 변경이 있었다. 아무것도 바꾸지 않는다', total;
  end if;
end $$;
