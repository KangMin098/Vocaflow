-- supabase/migrations/20260906074500_batch_first_sentence_repair_and_stats_counter_age.sql
--
-- ── 왜 (실측 2026-09-06) ─────────────────────────────────────────────
-- ① 9/05 07:37~09:36 두 시간 동안 /rest/v1/library_article_vocabularies 에 한 행씩 PATCH 가
--    분당 2,000~6,859건(피크 초당 114) 들어갔다. 체크포인트가 매번 109~272초 걸렸고
--    statement timeout 이 분당 최대 34건 났다. 원인은 scripts/dict/repair-first-sentence.mts 가
--    "PostgREST 는 행마다 값이 다른 일괄 UPDATE 를 못 한다"는 (맞는) 진단에서
--    "그러니 행 단위로 보낸다"는 (틀린) 결론으로 간 것이다.
--    PostgREST 가 못 하는 것이지 Postgres 가 못 하는 게 아니다 — jsonb 배열 하나면 된다.
--
-- ② 같은 날 06:53 크래시 재시작 뒤 db-health 수집기가 "16개 표에 통계 없음"이라 보고했다.
--    실제로는 pg_statistic 이 멀쩡했다(6·15·27·41·64행). last_analyze/last_autoanalyze 는
--    크래시 때 통계 파일이 폐기되며 함께 사라지는데, 수집기가 그것을 "분석된 적 없음"으로
--    읽었다. 같은 리셋이 unused_index_mb 도 69.6MB/111개 -> 177.5MB/149개로 부풀렸다.
--    틀린 감시 지표는 감시가 없는 것보다 나쁘다 — 없으면 모른다는 걸 알지만 틀리면 안다고 착각한다.
--    그래서 카운터 나이를 함께 싣는다. 판정이 기억이 아니라 값으로 걸러지게 한다.
--
-- 되돌리기: 아래 두 함수를 drop 하면 된다. 기존 데이터는 건드리지 않는다.

-- ─────────────────────────────────────────────────────────────────────
-- ① first_sentence 일괄 보정 — 청크 하나를 한 트랜잭션으로
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

-- ─────────────────────────────────────────────────────────────────────
-- ② db-health 스냅샷에 통계 카운터 나이를 싣는다
-- ─────────────────────────────────────────────────────────────────────
--
-- collect_db_health_metrics() 본문(400여 줄)은 건드리지 않는다 — 옮겨 적다 틀리는 위험이
-- 얻는 것보다 크다. 대신 감싸서 방금 넣은 두 지표에 나이를 덧댄다.
create or replace function public.collect_db_health_snapshot()
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_rows    integer;
  v_at      timestamptz;
  v_reset   timestamptz;
  v_age_min numeric;
begin
  v_rows := collect_db_health_metrics();

  select max(measured_at) into v_at
  from db_health_metrics where axis <> 'integrity';

  select stats_reset into v_reset from pg_stat_bgwriter;
  v_age_min := round(extract(epoch from (now() - v_reset)) / 60);

  -- 카운터가 어릴 때 틀리는 두 지표에 나이와 신뢰 여부를 박아 둔다.
  -- 24시간을 기준으로 삼는 이유: autovacuum/autoanalyze 의 기본 주기가 하루 안에 한 바퀴
  -- 돌고, 인덱스 스캔 카운터도 하루면 일상 질의를 한 번씩 받는다. 이보다 짧으면
  -- "안 쓰였다"와 "아직 안 세었다"를 구분할 수 없다.
  update db_health_metrics
     set dims = dims || jsonb_build_object(
           'counter_age_min', v_age_min,
           'unreliable', v_age_min < 1440
         )
   where measured_at = v_at
     and metric in ('stats_stale_tables', 'unused_index_mb');

  insert into db_health_metrics (measured_at, axis, metric, value, dims)
  values (v_at, 'capacity', 'stats_counter_age_min', v_age_min,
          jsonb_build_object(
            'stats_reset', v_reset,
            'postmaster_start', pg_postmaster_start_time(),
            'crash_restart_suspected', v_reset >= pg_postmaster_start_time(),
            'note', '재시작·리셋 이후 경과(분). 1440 미만이면 stats_stale_tables 와 unused_index_mb 는 믿지 말 것.'
          ));

  return v_rows + 1;
end
$fn$;

comment on function public.collect_db_health_snapshot() is
  'db-health 수집 진입점. collect_db_health_metrics() 를 부른 뒤 통계 카운터 나이를 덧댄다. cron 은 이 함수를 부른다.';

revoke all on function public.collect_db_health_snapshot() from public, anon, authenticated;
grant execute on function public.collect_db_health_snapshot() to service_role;

-- cron 이 감싼 쪽을 부르게 한다. 잡이 없으면(로컬 등) 조용히 넘어간다.
do $do$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'db-health-daily';
  if v_jobid is not null then
    perform cron.alter_job(v_jobid, command := 'select public.collect_db_health_snapshot()');
  end if;
end
$do$;
