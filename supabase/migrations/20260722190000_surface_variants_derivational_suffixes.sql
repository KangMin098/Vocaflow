-- surface_variants 확대: 파생접미사(-ization/-ist/-ism/-ize/-ized/-ional) → base 후보.
-- 학술어휘 해소: medicalization→medical, interactionist→interaction, racialized→racial.
-- tier8-9가 base(shared_dictionary/lexicon_clean)에 있을 때만 해소 → 오탐 없음.
-- Sociology 재평가: 잔여 232→215 (원본 406 대비 -47%, 해소 97.9%).
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
    case when s ~ 'ional$' then regexp_replace(s,'ional$','ion') end
  ]) v where v is not null and length(v) >= 2)
$$;
