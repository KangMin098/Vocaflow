-- docs/csat-learner/lecture-audit-c-20261024/g/db-fix/A-choices/forward.sql
-- 범위 A: public.csat_items.choices 의 5번 선지(choices[4]) 끝 추출 잔여물 3행 제거. 개발 DB jajenrevcbmrpaliomxv. 사용자 승인 전 실행 금지.
-- PK: id = '2017#24' · '2018#24' · 'M2509#25'. 다른 열(passage·stem·answer·answers·body_ok·raw_block)은 바꾸지 않는다.
-- 각 UPDATE 는 승인 시점의 md5(choices::text) 가 같을 때만 바꾸고(compare-and-set), 바뀐 행이 3 이 아니면 전체를 되돌린다.
do $$
declare n int; total int := 0;
begin
  update public.csat_items
     set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+8$', '')))
   where id = '2017#24' and md5(choices::text) = 'eadc859ef6f20687e6b413b72edcbff7';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items
     set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+8$', '')))
   where id = '2018#24' and md5(choices::text) = '75afb175f723a2256c424c229f917406';
  get diagnostics n = row_count; total := total + n;

  update public.csat_items
     set choices = jsonb_set(choices, '{4}', to_jsonb(regexp_replace(choices->>4, '\s+\*\s*augmented reality: 증강 현실$', '')))
   where id = 'M2509#25' and md5(choices::text) = 'b7dad550901a58eb02a126df22624888';
  get diagnostics n = row_count; total := total + n;

  if total <> 3 then
    raise exception '범위 A: 기대 3행, 실제 %행 — 승인 시점 값과 다르다. 아무것도 바꾸지 않는다', total;
  end if;
end $$;
