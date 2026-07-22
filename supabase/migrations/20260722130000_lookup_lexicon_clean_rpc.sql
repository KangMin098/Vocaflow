-- 청정 독해 폴백 조회 — lexicon_clean(kaikki 대체) 직접+굴절 해소.
-- 설계: docs/proposals/lexicon-coverage-clean-architecture.md (L2 런타임 조회)
-- 사용: shared_dictionary(L1) 미스 → 이 RPC(L2). 런타임 DB 전용(LLM 오프라인).
-- 벤치: 2000단어 배치 ~0.8ms/단어(L2 전부 캐시히트). L1(shared_dictionary) bloat는 VACUUM FULL로 개선.
create or replace function lookup_lexicon_clean(p_surface text)
returns table(found boolean, surface text, resolved_word text, meaning_ko text, gloss_en text, ipa text, pos text, gloss_source text, ko_source text)
language plpgsql stable
as $$
declare s text := lower(trim(p_surface));
begin
  if s is null or length(s) = 0 then
    return query select false, p_surface, null::text, null::text, null::text, null::text, null::text, null::text, null::text;
    return;
  end if;
  -- 1) direct
  return query
    select true, p_surface, lc.word, lc.meaning_ko, lc.gloss_en, lc.ipa, lc.pos, lc.gloss_source, lc.ko_source
    from lexicon_clean lc where lc.word = s limit 1;
  if found then return; end if;
  -- 2) 굴절 base 해소(en_inflection_bases 재사용)
  return query
    select true, p_surface, lc.word, lc.meaning_ko, lc.gloss_en, lc.ipa, lc.pos, lc.gloss_source, lc.ko_source
    from unnest(en_inflection_bases(s)) as cand(c)
    join lexicon_clean lc on lc.word = cand.c limit 1;
  if found then return; end if;
  return query select false, p_surface, null::text, null::text, null::text, null::text, null::text, null::text, null::text;
end $$;
grant execute on function lookup_lexicon_clean(text) to authenticated, anon;
