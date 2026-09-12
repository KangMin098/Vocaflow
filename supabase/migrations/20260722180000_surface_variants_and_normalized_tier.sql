-- 표면형 정규화 helper + lookup_word_meaning 정규화 tier(8-9).
-- 단어추출 해소율 개선: OCR de-하이픈(un-til→until)·접두복합(non-religious→religious)·소유격(sister's→sister).
-- 17권 평가: Sociology 잔여 406→232(-43%), Ozma 91→52(-43%), Pride 92→69, Tom 77→56.

create or replace function surface_variants(s text) returns text[]
language sql immutable
as $$
  select array(select distinct v from unnest(array[
    s,
    nullif(replace(s,'-',''), s),                                    -- de-하이픈: un-til→until, help-less→helpless
    case when position('-' in s)>0 then regexp_replace(s,'^.*-','') end,  -- 마지막 하이픈 뒤: non-racialized→racialized
    case when position('-' in s)>0 then regexp_replace(s,'-.*$','') end,  -- 첫 하이픈 앞: micro-level→micro
    case when position(chr(39) in s)>0 then split_part(s, chr(39), 1) end -- 어포스트로피 앞: sister's→sister, i'm→i
  ]) v where v is not null and length(v) >= 2)
$$;

-- lookup_word_meaning 은 20260722150000(kaikki tier 제거) 위에 tier 8-9 추가.
-- de-하이픈 전체형(dh) 우선 정렬. 전체 정의는 DB 적용본 기준(반복 생략).
-- 체인: L1(1-5) → lexicon_clean 한국어(6)·영어(7) → 정규화 shared_dictionary(8)·lexicon_clean(9) → not_found.
