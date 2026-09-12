-- supabase/migrations/20260906074500_batch_first_sentence_repair.sql
--
-- ── 왜 (실측 2026-09-06) ─────────────────────────────────────────────
-- 9/05 07:37~09:36 두 시간 동안 /rest/v1/library_article_vocabularies 에 한 행씩 PATCH 가
-- 분당 2,000~6,859건(피크 초당 114) 들어갔다. 체크포인트가 매번 109~272초 걸렸고
-- statement timeout 이 분당 최대 34건 났다. 원인은 scripts/dict/repair-first-sentence.mts 가
-- "PostgREST 는 행마다 값이 다른 일괄 UPDATE 를 못 한다"는 (맞는) 진단에서
-- "그러니 행 단위로 보낸다"는 (틀린) 결론으로 간 것이다.
-- PostgREST 가 못 하는 것이지 Postgres 가 못 하는 게 아니다 — jsonb 배열 하나면 된다.
--
-- 되돌리기: 아래 함수를 drop 하면 된다. 기존 데이터는 건드리지 않는다.

-- ─────────────────────────────────────────────────────────────────────
-- first_sentence 일괄 보정 — 청크 하나를 한 트랜잭션으로
-- ─────────────────────────────────────────────────────────────────────
--
-- SECURITY INVOKER 로 둔다. 호출자는 service_role(드레인 스크립트)이고 RLS 를 이미 우회하므로
-- DEFINER 가 필요 없다. anon 이 실행할 수 있는 SECURITY DEFINER 는 이미 76개다 — 77번째를 만들지 않는다.
create or replace function public.repair_vocab_first_sentences(p_table text, p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path to 'public'
as $fn$
declare
  n integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'repair_vocab_first_sentences: p_rows 는 배열이어야 한다 (받은 것: %)', jsonb_typeof(p_rows);
  end if;

  if p_table = 'library_book_vocabularies' then
    -- 도서 쪽은 대리키 id 가 있다.
    with u as (
      select (r->>'id')::uuid as id, r->>'first_sentence' as fs
      from jsonb_array_elements(p_rows) r
      where r->>'id' is not null
    )
    update library_book_vocabularies v
       set first_sentence = u.fs
      from u
     where v.id = u.id
       and v.first_sentence is distinct from u.fs;  -- 값이 같으면 쓰지 않는다(WAL 을 만들지 않는다)
    get diagnostics n = row_count;

  elsif p_table = 'library_article_vocabularies' then
    -- 글 쪽은 대리키가 없다. 실제 키는 UNIQUE (library_article_id, word).
    with u as (
      select (r->>'library_article_id')::uuid as aid,
             r->>'word' as w,
             r->>'first_sentence' as fs
      from jsonb_array_elements(p_rows) r
      where r->>'library_article_id' is not null and r->>'word' is not null
    )
    update library_article_vocabularies v
       set first_sentence = u.fs
      from u
     where v.library_article_id = u.aid
       and v.word = u.w
       and v.first_sentence is distinct from u.fs;
    get diagnostics n = row_count;

  else
    -- 표 이름을 문자열로 받는 함수는 이 화이트리스트가 유일한 방어선이다.
    raise exception 'repair_vocab_first_sentences: 허용되지 않은 표 %', p_table;
  end if;

  return n;
end
$fn$;

comment on function public.repair_vocab_first_sentences(text, jsonb) is
  'first_sentence 를 청크 단위로 한 번에 고친다. 한 행씩 PATCH 하던 것을 대체한다(2026-09-05 폭주 원인). 값이 같은 행은 쓰지 않는다.';

revoke all on function public.repair_vocab_first_sentences(text, jsonb) from public, anon, authenticated;
grant execute on function public.repair_vocab_first_sentences(text, jsonb) to service_role;

-- ── ② 블록은 적용하지 않고 버렸다 (2026-09-12 실측) ────────────────────
--
-- 원래 이 파일에는 collect_db_health_snapshot() 래퍼가 함께 있었다. 크래시 재시작이
-- last_analyze 를 지워 「분석된 적 없음」으로 읽히던 것을 카운터 나이로 걸러 내려는
-- 것이었는데, 이 파일이 적용을 기다리는 동안 20260908035514 가 **더 나은 자리에서**
-- 같은 문제를 해결했다 — collect_db_health_metrics() 본문이 카운터 나이를 직접 계산하고
-- pg_statistic 실재 여부로 판정한다.
--
-- 2026-09-12 원격 실측: stats_counter_age_min 14행 · unreliable 낙인 14행 ·
-- cron db-health-daily 는 이미 "select collect_db_health_metrics()" 를 부른다.
-- 지금 래퍼를 얹으면 같은 지표를 실행마다 **한 번 더 insert** 하고 cron 을 래퍼로 돌린다 —
-- 고치는 게 아니라 되돌리는 변경이다. 그래서 ①만 적용했다(원격 버전 batch_first_sentence_repair).

-- 되돌리기: drop function public.repair_vocab_first_sentences(text, jsonb);
