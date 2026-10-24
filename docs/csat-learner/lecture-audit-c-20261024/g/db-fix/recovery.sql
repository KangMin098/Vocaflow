-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/recovery.sql
-- forward.sql 을 되돌린다 — 정정된 값의 md5 가 같을 때만 원래 값으로 바꾼다. 행 삭제·DDL 없음.
-- 왕복 검증(2026-10-24 SELECT): 4행 모두 forward → recovery 의 passage·choices md5 가 원래 값과 같다.
do $$
declare n int; total int := 0;
begin
  update csat_items
     set passage = replace(passage, '5:00 p.m. * The museum is closed on the first Monday of every month. Fees', '5:00 p.m. month. Fees')
   where id = '2014A#29' and md5(passage) = '6b4dd8818f63a6c9086b06dd8833027a';
  get diagnostics n = row_count; total := total + n;

  update csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' 8'))
   where id = '2017#24' and md5(choices::text) = '964f24d99fd78f83d0c1665f207fc654';
  get diagnostics n = row_count; total := total + n;

  update csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' 8'))
   where id = '2018#24' and md5(choices::text) = 'f380f7ee5dfa8b569414d54a8b5182af';
  get diagnostics n = row_count; total := total + n;

  update csat_items set choices = jsonb_set(choices, '{4}', to_jsonb((choices->>4) || ' * augmented reality: 증강 현실'))
   where id = 'M2509#25' and md5(choices::text) = '764a83418a6b8862f08b594322f33960';
  get diagnostics n = row_count; total := total + n;

  if total <> 4 then
    raise exception 'csat_items 복구: 기대 4행, 실제 %행 — 정정 뒤 다른 변경이 있었다. 아무것도 바꾸지 않는다', total;
  end if;
end $$;
-- 복구 뒤 기대값: 2014A#29 passage 354dba3d… · 2017#24 choices eadc859e… · 2018#24 choices 75afb175… · M2509#25 choices b7dad550…
