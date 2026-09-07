-- supabase/migrations/20260905225559_csat_dcp_inventory.sql
--
-- 교재 공장 재고 집계 — 화면이 65만 행을 칸마다 세던 것을 한 번의 훑기로.
--
-- ── 무엇을 봤나 (2026-09-05 실측) ───────────────────────────────────────────
-- `/admin/csat` 계열은 `csat_dcp_items`(65만 행)의 (유형 × 수준) 재고와 해설 보유 수를
-- 칸마다 head count 로 센다 — 한 화면에 조회 225회. PostgREST 집계 함수가 이 프로젝트에서
-- 꺼져 있어(`PGRST123`) `group by` 를 못 쓰기 때문이다.
--
-- 대가 셋:
--   ① 느리다 — 공정 현황판 11.2초 · 집필 표 7.2초.
--   ② 조용히 틀린다 — 여러 개를 한꺼번에 던지면 몇 개가 `count=null` 로 온다. 그 칸은
--      화면에서 「?」로 남는데, 한때 「재고 0」처럼 보였다.
--   ③ **유형별 해설 보유율은 아예 못 잰다 — 느린 게 아니라 불가능하다.**
--      유일한 관련 인덱스가 `(v_level, type)` 이라 `type` 단독 필터는 선두 열이 없어
--      인덱스를 못 탄다 → 유형마다 65만 행 순차 훑기 → 큰 유형은 20초 벽에서 `count=null`.
--      실측(순차·재시도 포함 187초): blank_word · grammar_fix · insert · unit_vocab 전부 null.
--      `(유형, 수준)` 으로 쪼개면 값은 나오지만(셀당 3.7~8.4초) 재고가 있는 칸이 132개라
--      다 돌면 90초가 넘는다 — 화면으로도 온디맨드 API 로도 못 쓴다.
--
--      그래서 공정 ⑥(해설)만 전용 눈금이 없었다. 해설 없는 문항이 22만 개인데 어느 유형·수준에
--      몰렸는지 화면에서 볼 수 없었고, **이 함수 없이는 볼 방법이 없었다.**
--
-- ── 왜 함수인가 ─────────────────────────────────────────────────────────────
-- 같은 것을 한 번의 순차 훑기로 접으면 끝난다 — EXPLAIN ANALYZE:
--   Parallel Seq Scan → Partial HashAggregate → Gather Merge · **5,715 ms** · 132행 반환.
-- 칸마다 던지는 225회를 1회로 바꾼다. 반환이 132행뿐이라 네트워크에 실리는 것도 거의 없다.
--
-- ⚠️ 뷰가 아니라 함수인 이유: 뷰는 PostgREST 가 노출하고 RLS 를 따로 걸어야 한다.
--    이 표는 admin 게이트 뒤에서만 읽으므로 security definer + service_role 이 노출면이 좁다.
--
-- ⚠️ `?` 와 `->>` 를 **둘 다** 센다. `->>` 는 키가 있는데 값이 JSON null 이면 SQL NULL 을
--    돌려줘 「해설 없음」으로 센다. 적재기는 20자 미만을 안 넣으므로 지금 두 셈은 같지만,
--    갈리기 시작하면 그 자체가 적재 결함의 신호라 따로 돌려준다.

create or replace function public.csat_dcp_inventory()
returns table (
  type text,
  v_level smallint,
  items bigint,
  -- 키가 있는 것 (적재기가 넣었다)
  explained_key bigint,
  -- 값이 실제로 있는 것 (JSON null 이 아니다)
  explained_value bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.type,
    d.v_level,
    count(*)                                                             as items,
    count(*) filter (where d.answer_key ? 'explanation_ko')               as explained_key,
    count(*) filter (where d.answer_key ->> 'explanation_ko' is not null) as explained_value
  from public.csat_dcp_items d
  group by d.type, d.v_level
$$;

comment on function public.csat_dcp_inventory() is
  '교재 공장 화면용 재고 집계 — (유형 × 수준) 문항 수와 해설 보유 수를 한 번의 훑기로 낸다. '
  '칸마다 count 를 던지면 조회 225회에 11초가 걸리고 몇 개는 조용히 null 로 온다. '
  'admin 게이트 뒤에서만 부른다.';

-- 이 표는 학습자 경로로 나가지 않는다. anon·authenticated 에게는 주지 않는다.
revoke all on function public.csat_dcp_inventory() from public;
grant execute on function public.csat_dcp_inventory() to service_role;

-- ── 적용 후 확인 (2026-09-06 실행됨) ────────────────────────────────────────
--   select sum(items) from public.csat_dcp_inventory();          -- 656,984
--   select sum(explained_key) from public.csat_dcp_inventory();  -- 426,696
--   select count(*) from public.csat_dcp_inventory()
--     where explained_key <> explained_value;                    -- **0** ✓ (적재 결함 없음)
--   select count(*) from public.csat_dcp_inventory();            -- 136행
--
-- ── 되돌리기 ────────────────────────────────────────────────────────────────
--   drop function if exists public.csat_dcp_inventory();
--   함수만 지우면 되고 데이터는 건드리지 않는다. 공정 ⑥ 은 다시 눈금을 잃는다.
