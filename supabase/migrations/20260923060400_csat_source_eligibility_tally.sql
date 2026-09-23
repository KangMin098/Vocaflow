-- 20260923060400_csat_source_eligibility_tally.sql
--
-- **원문 적격 집계를 DB 에서 읽는다** (DD-69 A4 · 「원문 적격」 화면).
--
-- ── 왜 필요한가 (실측 2026-09-23) ───────────────────────────────────
-- `/admin/csat/sources` 는 **커밋된 JSON**(`source-eligibility-snapshot.json`)을 읽는다.
-- 실측 차이:
--   스냅샷 `measuredAt 2026-09-19T02:31Z` · 87,716행
--   DB     `max(measured_at) 2026-09-20T00:38Z` · **87,720행**
--
-- 화면이 「3일 전」이라고 정직하게 적는 것은 좋다. 그러나 **드레인을 돌린 직후에도 화면이 안
-- 움직인다** — 누군가 스크립트를 다시 돌려 JSON 을 굽고 커밋해야 한다. 그 사이 관리자는
-- 「안 늘었다」를 보고 안 해도 될 일을 다시 한다(④ 소재의 「지금 다시 잰다」 버튼이 생긴
-- 것과 똑같은 이유다 — `sourcing/actions.ts` 머리말).
--
-- ── 왜 스냅샷을 없애지 않나 ─────────────────────────────────────────
-- 스냅샷은 **본문을 읽어야 나오는 판정**(발췌창·추출 결함)까지 담고 있어 이 함수로 대체되지
-- 않는다. 이 함수가 주는 것은 **지금 값과의 차이**다 — 화면은 스냅샷을 그대로 그리되
-- 「스냅샷 이후 DB 는 이만큼 움직였다」를 함께 적을 수 있게 된다.
--
-- ── 비용 실측 ───────────────────────────────────────────────────────
-- `explain analyze` 2026-09-23: Seq Scan 87,720행 → HashAggregate 61행 · **1,351 ms**.
-- 화면의 요청당 상한은 8초(`withDeadline`)라 안에 든다. 8초를 넘기 시작하면 mv 로 바꾼다
-- (`textbook_shelf_inventory_mv` 와 같은 방식 · 30분 갱신).
--
-- 되돌리기: `drop function public.csat_source_eligibility_tally();`

create or replace function public.csat_source_eligibility_tally()
returns table (
  v_level     smallint,
  grade       text,
  blocked_by  text,
  n           bigint,
  measured_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- ⚠️ grade·blockedBy 를 coalesce 로 뭉개지 않는다 — null 은 「그 축이 판정 대상이 아니다」이고
  --    빈 문자열이나 'unknown' 과 다르다. 읽는 쪽이 그 구분을 쓴다.
  select (e.input->>'articleVLevel')::smallint as v_level,
         e.result->>'grade'                    as grade,
         e.result->>'blockedBy'                as blocked_by,
         count(*)                              as n,
         max(e.measured_at)                    as measured_at
    from public.csat_source_eligibility e
   group by 1, 2, 3
$$;

revoke all on function public.csat_source_eligibility_tally() from public;
-- Admin 화면은 service role 로 읽는다(`createAdminClient`). authenticated 에는 열지 않는다 —
-- 적격 판정 분포는 운영 정보고, 학습자 표면에서 쓸 자리가 없다.
grant execute on function public.csat_source_eligibility_tally() to service_role;

comment on function public.csat_source_eligibility_tally() is
  '원문 적격 분포를 지금 값으로 집계한다(v_level × grade × blockedBy). 화면의 커밋 스냅샷과 나란히 놓아 「스냅샷 이후 얼마나 움직였나」를 말하게 한다. 실측 1.35초 / 87,720행.';
