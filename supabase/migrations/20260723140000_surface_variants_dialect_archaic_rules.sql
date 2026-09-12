-- surface_variants 생성 규칙 확대 (근본 방안 Phase 1) — 미관찰 방언/고어에도 일반화.
-- a-VERBin'→VERBing (a-standin→standing) · 고어 굴절 -eth/-est→base (knoweth→know·makest→make).
-- 정밀: 실단어는 direct/inflection tier(1-2)서 먼저 해소 → 규칙은 미해소 방언/고어만 적중.
-- 측정: 효과 marginal(잔여 -34 lemma) — -eth/-est 대다수 이미 inflection 해소. a-VERBin' 신규.
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
    case when s ~ 'in$' and length(s) >= 4 then regexp_replace(s,'in$','ing') end,
    case when s ~ '^a-' and length(s) >= 5 then regexp_replace(s,'^a-','') end,
    case when s ~ '^a-.*in$' and length(s) >= 6 then regexp_replace(regexp_replace(s,'^a-',''),'in$','ing') end,
    case when s ~ 'eth$' and length(s) >= 5 then regexp_replace(s,'eth$','') end,
    case when s ~ 'eth$' and length(s) >= 5 then regexp_replace(s,'eth$','e') end,
    case when s ~ 'est$' and length(s) >= 5 then regexp_replace(s,'est$','') end,
    case when s ~ 'est$' and length(s) >= 5 then regexp_replace(s,'est$','e') end
  ]) v where v is not null and length(v) >= 2)
$$;
