-- supabase/migrations/20260906000100_acp_article_rollup_published_only.sql
--
-- `acp_article_rollup()` 재설계 — **발행분만** 훑는다. 앞 마이그레이션의 설계 오류 정정.
--
-- ── 무엇을 틀렸나 (2026-09-06) ──────────────────────────────────────────────
-- 앞 판(20260905225539)은 `library_articles` **전량 91,356행**을
-- `group by status, register, cefr_level` 로 훑었다. 근거로 삼은 수치는 `EXPLAIN ANALYZE`
-- 8,902ms 였는데, 그것은 `postgres` 로 직접 잰 값이라 **실제 경로를 대표하지 못했다.**
-- PostgREST(`authenticator`, 풀러 경유)로 재 보니 **29,816ms** 였다.
--
-- 그리고 `pg_db_role_setting` 실측: anon 3s · authenticated 8s · **authenticator 8s**.
-- 이 8초가 그동안의 모든 증상을 한 줄로 설명한다 — "2만 행쯤부터 count 가 조용히 죽는다" 는
-- 것은 행 수가 아니라 **8초를 넘는 순간**이었다.
--
-- 더 근본적인 잘못: 커버리지 매트릭스(register × CEFR)는 **발행분에만** 해당하는데,
-- 그 30칸을 채우려고 queued 5.2만 행까지 전부 훑고 있었다.
--
--   전량 group by                            8,902ms(직접) / 29,816ms(PostgREST)
--   where status='published' group by 두 열     323ms(직접) /  75ms · 22ms(PostgREST)
--
-- 인덱스(`idx_la_status_date`)를 타기 때문이고, 발행분이 늘어도 이 형태가 유지된다.
--
-- 상태별 건수는 이 함수가 아니라 `count: 'estimated'` head 카운트로 되돌렸다(각 124ms).
-- 그쪽은 이미 되던 길이었고, 한 함수에 몰아넣을 이유가 없었다 — **합치는 것이 늘 싸지 않다.**
--
-- 반환 열이 바뀌므로 `create or replace` 로는 안 된다(42P13) — 먼저 지운다.

drop function if exists public.acp_article_rollup();

create function public.acp_article_rollup()
returns table (
  register text,
  cefr_level text,
  items bigint
)
language sql
stable
security definer
set search_path = public
set statement_timeout to '30000'
as $$
  select a.register, a.cefr_level, count(*) as items
  from public.library_articles a
  where a.status = 'published'
  group by a.register, a.cefr_level
$$;

comment on function public.acp_article_rollup() is
  'ACP 커버리지 매트릭스용 집계 — 발행분의 (register × CEFR) 건수를 한 번의 인덱스 스캔으로 낸다(실측 75ms · 10행). '
  '전량을 훑던 앞 판은 PostgREST 경유 29.8초로 statement_timeout(8s)을 넘겨 못 썼다. '
  '상태별 건수는 이 함수가 아니라 estimated head 카운트가 낸다. admin 게이트 뒤에서만 부른다.';

revoke all on function public.acp_article_rollup() from public;
grant execute on function public.acp_article_rollup() to service_role;

-- 교재 공장 재고는 657k 행 + jsonb 접근이라 인덱스로 줄일 수 없다 — 전수 훑기가 본질이다.
-- 관리자 전용 비-hot path 이므로 60초로 올린다(`20260718100120_gate_statement_timeout.sql` 선례).
alter function public.csat_dcp_inventory() set statement_timeout to '60000';

-- ⚠️ **그래도 부족했다.** 60초로 올린 뒤에도 PostgREST 경유로는 60,079ms 에서 취소된다
--    (실측 2회). 직접 SQL 5.7초와 10배 차이다. 타임아웃을 더 올리지 않는다 — 그건
--    "화면이 1분 넘게 멈춰도 된다" 는 뜻이고, 이 저장소가 품질 게이트에서 이미 그 대가를
--    치렀다. 남은 처방은 **미리 계산해 두는 것**(matview + 주기 갱신 —
--    `textbook_shelf_stats` 가 쓰는 방식)이고 그건 별도 승인이 필요하다.
--    그때까지 공정 ⑥ 해설 눈금은 「못 잼」 + 이유로 남는다. 앱은 이 함수를 부르지 않는다.
