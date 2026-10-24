-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/C-six/recovery.sql
-- 범위 C 되돌리기 — 정정 후 md5 가 같을 때만 지운 꼬리를 그대로 다시 붙인다. 행 삭제·DDL 없음. 왕복 md5 6/6 검증(2026-10-24 SELECT).
do $$
declare n int; total int := 0;
begin
  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' * taint: 더럽히다 ** altruistic: 이타주의의 5'))
   where id = '2025#30' and md5(choices::text) = 'f8230ca055e8f18a4386b47891cbdb62';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' 특징, 특질 ( 차를) 우려낼 수 있음 * hallmark : ** steepability :'))
   where id = 'M1809#35' and md5(choices::text) = 'a598f33f131019ca218b0da5ed93f146';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' * contraband: 밀수품 ** tug: 잡아당김'))
   where id = 'M2006#35' and md5(choices::text) = '39d319b929491f62006ae03f0071f0ef';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' * compact:'))
   where id = 'M2106#35' and md5(choices::text) = '11632335d63f31b472701ba1977da8df';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' * kin: 친족 ** proximity: 근접'))
   where id = 'M2206#35' and md5(choices::text) = '1311573e80fa29e6aa39737417e20a0b';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' * psychic:'))
   where id = 'M2209#35' and md5(choices::text) = '2a5004c8054f05d9531d612432ea93c9';
  get diagnostics n = row_count; total := total + n;

  if total <> 6 then
    raise exception '범위 C 복구: 기대 6행, 실제 %행 — 정정 뒤 다른 변경이 있었다. 아무것도 바꾸지 않는다', total;
  end if;
end $$;
