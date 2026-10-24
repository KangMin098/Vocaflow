-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/C-six/forward.sql
-- 범위 C(확정 6): public.csat_items.choices[4] 끝에 잘못 붙은 낱말 풀이(·쪽번호) 제거. 개발 DB jajenrevcbmrpaliomxv. 별도 승인 전 실행 금지.
-- PK: 2025#30 · M1809#35 · M2006#35 · M2106#35 · M2206#35 · M2209#35. 바꾸는 열은 choices 하나(⑤ 원소만). passage 등 다른 열 불변.
-- 범위 A(2017#24 · 2018#24 · M2509#25)와 B(2014A#29)와 겹치지 않는다. compare-and-set, 바뀐 행이 6 이 아니면 전체를 되돌린다.
do $$
declare n int; total int := 0;
begin
  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+\* taint: 더럽히다 \*\* altruistic: 이타주의의 5$', '')))
   where id = '2025#30' and md5(choices::text) = 'b7c5a422fb50f0732370d5cb5ef048f9';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+특징, 특질 \( 차를\) 우려낼 수 있음 \* hallmark : \*\* steepability :$', '')))
   where id = 'M1809#35' and md5(choices::text) = '0dc1e7ccf73cf082babbbfc48366c0e9';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+\* contraband: 밀수품 \*\* tug: 잡아당김$', '')))
   where id = 'M2006#35' and md5(choices::text) = 'a2b537e7fe822f8ef58d9312a9588359';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+\* compact:$', '')))
   where id = 'M2106#35' and md5(choices::text) = '89281d418e63c96fa279b88d64cdcdbe';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+\* kin: 친족 \*\* proximity: 근접$', '')))
   where id = 'M2206#35' and md5(choices::text) = 'a4aa1417d27c97fcb4267cc9b5edf0b7';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+\* psychic:$', '')))
   where id = 'M2209#35' and md5(choices::text) = '02ce114a5933f672e9ef15c268c8871e';
  get diagnostics n = row_count; total := total + n;

  if total <> 6 then
    raise exception '범위 C: 기대 6행, 실제 %행 — 승인 시점 값과 다르다. 아무것도 바꾸지 않는다', total;
  end if;
end $$;
