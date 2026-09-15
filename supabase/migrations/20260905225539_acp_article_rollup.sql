-- supabase/migrations/20260905225539_acp_article_rollup.sql
--
-- ACP 콘솔 재고 집계 — 화면이 카운트 38개를 동시에 던지던 것을 그룹 스캔 1회로.
--
-- ── 무엇을 봤나 (2026-09-06 · 런타임 전수 훑기 4회 + EXPLAIN ANALYZE) ────────
-- 관리자 화면 41개를 실제 브라우저로 훑는 스펙(`tests/e2e/30-admin-sweep.spec.ts`)을 네 번
-- 돌렸다. 매번 **다른 화면**이 「네비게이션 실패(타임아웃)」로 죽었고, 고칠 때마다 부하가
-- 다음 화면으로 옮겨 갔다(quality/gates → VRL 5개 → textbook). 화면별 버그가 아니었다.
--
-- PostgREST `count=exact` 는 이 프로젝트에서 **2만 행쯤부터 조용히 실패한다.**
-- 같은 서버·같은 순간 실측:
--   library_articles status='ready' (19,063행)  exact 19,063 / 3,944ms · estimated 18,574 / 124ms
--   shared_dictionary 전체 (49,244행)           exact **null / 8,119ms · 오류 message 빈 문자열**
--   library_books status='published' (312행)    exact 312 / 241ms      · estimated 312 / 53ms
--
-- `estimated` 로 급한 불은 껐지만 **질의 수**는 그대로였다(대시보드 36 · ACP 38 · 사전 17).
-- 재시도·동시성 제한·모드 교체를 다 해 봤고 증상이 옮겨 다닐 뿐이었다.
--
-- ── 처방 ────────────────────────────────────────────────────────────────────
-- 한 번의 그룹 스캔이 38개를 대신한다 — EXPLAIN ANALYZE **8,902ms · 반환 47행**.
-- 질의가 하나라 동시 과부하가 없고, null 이 오지 않으며, 47행이라 앱에서 요청 단위로 접힌다.
-- 적용 후 실측: 합계 91,356 = `count(*)` 91,356 — **정확값**이라 `estimated` 근사치보다 낫다.
--
-- ⚠️ 뷰가 아니라 함수인 이유: 뷰는 PostgREST 가 노출하고 RLS 를 따로 걸어야 한다.
--    이 표는 admin 게이트 뒤에서만 읽으므로 security definer + service_role 이 노출면이 좁다.

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

-- ── 적용 후 확인 (2026-09-06 실행됨) ────────────────────────────────────────
--   select sum(items) from public.acp_article_rollup();   -- 91,356 = count(*) 91,356 ✓
--   select count(*) from public.acp_article_rollup();     -- 47행 ✓
--
-- ── 되돌리기 ────────────────────────────────────────────────────────────────
--   drop function if exists public.acp_article_rollup();
--   함수만 지우면 되고 데이터는 건드리지 않는다. 화면은 다시 카운트를 던지는 길로 돌아간다.
