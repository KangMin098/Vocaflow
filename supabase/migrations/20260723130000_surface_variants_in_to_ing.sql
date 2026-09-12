-- surface_variants 확대: -in→-ing 방언 정규화(g 탈락). nothin→nothing·lookin→looking.
-- 200권 평가: -in 방언 218 lemma·2,796 등장. normalized tier(8-9)가 자동 소비.
-- 정밀: 실제 -in 단어(basin·cabin·coin)는 direct tier(1)에서 먼저 해소 → 이 규칙은 미해소 방언만 적중.
create or replace function surface_variants(s text) returns text[]
language sql immutable
as $$
  select array(select distinct v from unnest(array[
    s,
    nullif(replace(s,'-',''), s),
    case when position('-' in s)>0 then regexp_replace(s,'^.*-','') end,
    case when position('-' in s)>0 then regexp_replace(s,'-.*$','') end,
    case when position(chr(39) in s)>0 then split_part(s, chr(39), 1) end,
    case when s ~ 'izations?$' then regexp_replace(s,'izations?$','') end,
    case when s ~ 'isations?$' then regexp_replace(s,'isations?$','') end,
    case when s ~ 'ized$' then regexp_replace(s,'ized$','') end,
    case when s ~ 'ised$' then regexp_replace(s,'ised$','') end,
    case when s ~ 'ize$'  then regexp_replace(s,'ize$','') end,
    case when s ~ 'ise$'  then regexp_replace(s,'ise$','') end,
    case when s ~ 'ists?$' then regexp_replace(s,'ists?$','') end,
    case when s ~ 'ists?$' then regexp_replace(s,'ists?$','e') end,
    case when s ~ 'isms?$' then regexp_replace(s,'isms?$','') end,
    case when s ~ 'ional$' then regexp_replace(s,'ional$','ion') end,
    case when s ~ 'in$' and length(s) >= 4 then regexp_replace(s,'in$','ing') end
  ]) v where v is not null and length(v) >= 2)
$$;
