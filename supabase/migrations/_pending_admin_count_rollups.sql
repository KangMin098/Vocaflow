-- supabase/migrations/<ts>_admin_count_rollups.sql
--
-- **관리자 화면이 화면당 수십 개의 COUNT 를 던지고 있다** — 이 DB 등급이 감당하는 범위 밖이다.
--
-- ⚠️ 아직 적용하지 않았다. 승인 후 `apply_migration` 으로 올린다.
--
-- ── 무엇을 봤나 (2026-09-06 · 런타임 전수 훑기 4회 + EXPLAIN ANALYZE) ─────────
--
-- 관리자 화면 41개를 실제 브라우저로 훑는 스펙(`tests/e2e/30-admin-sweep.spec.ts`)을
-- 네 번 돌렸다. 매번 **다른 화면**이 「네비게이션 실패(타임아웃)」로 죽었다:
--
--   1회차  /admin/quality/gates                                    (열림 1)
--   2회차  /admin/quality/gates                                    (열림 1)
--   3회차  /admin/vrl/{concerns,diagnostic,snapshots,taxonomy,users} (열림 5)
--   4회차  /admin/textbook                                          (열림 1)
--
-- 고칠 때마다 그 화면은 살아났고 **부하가 다음 화면으로 옮겨 갔다.** 화면별 버그가 아니다.
--
-- ── 왜 그런가 (실측) ─────────────────────────────────────────────────────────
--
-- PostgREST 의 `count=exact` 는 이 프로젝트에서 **2만 행쯤부터 조용히 실패한다.**
-- 같은 서버·같은 순간에 세 모드를 쟀다:
--
--   library_articles status='ready' (19,063행)  exact 19,063 / 3,944ms
--                                               estimated 18,574 /   124ms
--   shared_dictionary 전체 (49,244행)           exact **null / 8,119ms · 오류 message 빈 문자열**
--                                               estimated 48,969 / 1,260ms
--   library_books status='published' (312행)    exact 312 /  241ms
--                                               estimated **312** /   53ms
--
-- `estimated` 로 바꿔 급한 불은 껐다(작은 표는 정확값 그대로, 큰 표만 플래너 추정치).
-- 그러나 **질의 수 자체**는 그대로다:
--
--   /admin              대시보드 카운트 **36개**  (`lib/admin/dashboard-stats.ts`)
--   /admin/articles     상태 8 + 커버리지 31 = **38개** (`lib/articles/admin-queries.ts`)
--   /admin/vrl          사전 채움률 **17개** + 그 밖 (`lib/admin/dict/queries.ts`)
--
-- 한 화면이 수십 개를 동시에 던지면 서버가 몇 개를 **본문 없는 오류**로 돌려준다.
-- 재시도·동시성 제한·모드 교체를 다 해 봤고, 그때마다 증상이 줄되 **다른 화면으로 옮겨 갔다.**
-- 앱 쪽에서 더 할 수 있는 것이 남지 않았다 — 남은 것은 **질의 수를 줄이는 것**뿐이다.
--
-- ── 처방 ─────────────────────────────────────────────────────────────────────
--
-- 한 번의 그룹 스캔이 38개를 대신한다. 실측(EXPLAIN ANALYZE):
--
--   select status, register, cefr_level, count(*) from library_articles
--   group by status, register, cefr_level;
--     HashAggregate ← Seq Scan (rows=90,961)
--     Execution Time: **8,902 ms** · 반환 **47행**
--
-- 8.9초는 여전히 느리지만 성격이 다르다: ① 질의가 **하나**라 동시 과부하가 없고
-- ② `null` 이 오지 않으며 ③ 결과가 47행뿐이라 `unstable_cache`(60초)로 접으면
-- **첫 방문자만** 치른다. 지금은 방문자마다 38개를 던진다.
--
-- ⚠️ 이 파일은 ACP 하나만 담았다. 같은 처방이 대시보드(36)·사전(17)에도 필요하고,
--    교재 공장 재고는 이미 `_pending_csat_dcp_inventory.sql` 에 따로 있다.
--    한 번에 다 올리지 않는 이유: 하나를 올려 **실제로 화면이 살아나는지** 본 뒤에
--    나머지를 정하는 편이, 넷을 한꺼번에 올리고 원인을 못 가르는 것보다 낫다.
--
-- ⚠️ **뷰가 아니라 함수인 이유**는 `_pending_csat_dcp_inventory.sql` 과 같다 —
--    뷰는 PostgREST 가 노출하고 RLS 를 따로 걸어야 한다. 이 표는 admin 게이트 뒤에서만
--    읽으므로 `security definer` + `service_role` EXECUTE 가 노출면이 좁다.

create or replace function public.acp_article_rollup()
returns table (
  status text,
  register text,
  cefr_level text,
  items bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select a.status, a.register, a.cefr_level, count(*) as items
  from public.library_articles a
  group by a.status, a.register, a.cefr_level
$$;

comment on function public.acp_article_rollup() is
  'ACP 콘솔용 재고 집계 — (상태 × register × CEFR) 건수를 한 번의 훑기로 낸다. '
  '화면이 카운트 38개를 동시에 던지면 서버가 몇 개를 본문 없는 오류로 돌려준다(실측 2026-09-06). '
  'admin 게이트 뒤에서만 부른다. 결과는 47행 안팎이라 앱에서 60초 캐시로 접는다.';

revoke all on function public.acp_article_rollup() from public;
grant execute on function public.acp_article_rollup() to service_role;

-- ── 적용 후 확인 ─────────────────────────────────────────────────────────────
--   select sum(items) from public.acp_article_rollup();
--     -- library_articles 전체 행 수와 같아야 한다
--   select status, sum(items) from public.acp_article_rollup() group by status order by 2 desc;
--     -- 화면 상단 상태 타일과 같은 수가 나와야 한다
--
-- ── 되돌리기 ─────────────────────────────────────────────────────────────────
--   drop function if exists public.acp_article_rollup();
--   함수만 지우면 되고 데이터는 건드리지 않는다. 화면은 다시 카운트를 던지는 길로 돌아간다.
