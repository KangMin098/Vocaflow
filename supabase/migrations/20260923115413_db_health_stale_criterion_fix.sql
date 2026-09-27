-- supabase/migrations/20260923115413_db_health_stale_criterion_fix.sql
--
-- **판정이 자기 기준을 어기고 있었다** — `stats_stale_tables` 가 통계가 있는 표를 stale 로 셌다.
--
-- ── 무엇을 봤나 (2026-09-23 실측) ───────────────────────────────────
-- 회귀 `apps/web/src/lib/admin/db-health/__tests__/silent-noop.integration.test.ts` 가 실패한다:
--   `library_book_vocabularies 은 통계가 있는데 stale 로 셌다: expected 15 to be +0`
--
-- 그 표는 `pg_statistic` 에 **15컬럼 통계가 실재**한다. 그런데도 목록에 들어갔다.
-- 2026-09-08(`20260908035514`)에 판정 근거를 `last_analyze` 카운터에서 `pg_statistic` 으로
-- 바꿨는데, 같은 WHERE 에 남아 있던 **드리프트 분기**가 그 원칙을 뒤로 되돌리고 있었다:
--
--   where ... and ( st.stat_cols = 0                  -- 통계 없음 (원칙)
--                   or (v_counter_age_min >= 1440     -- 또는 드리프트  ← 여기
--                       and abs(n_live_tup - reltuples) > greatest(reltuples*0.5, 10000)) )
--
-- 드리프트 분기가 문제인 이유는 두 겹이다:
--
--   ① 통계가 **있는** 표를 `dims.tables` 에 넣는다 → 회귀가 금지하는 바로 그 오탐.
--      `stats_stale_tables` 는 「통계가 없는 표」를 세는 지표다. 드리프트는 **다른 신호**다.
--   ② `n_live_tup` 은 **카운터가 리셋되면 0 에서 다시 시작**한다. 읽기만 하는 표는
--      영원히 0 이므로 `reltuples` 와 항상 크게 벌어진다. 나이(`counter_age_min`)만으로는
--      절대 믿을 수 없다 — **2026-09-15 13:35:22 서버 재시작** 뒤 8일이 지나
--      `counter_age_min >= 1440` 이 충족되면서 읽기 전용 대형 표들이 전부 걸렸다.
--      (같은 리셋이 이 조사 내내 `n_live_tup = 0` 을 「빈 표」로 오해시킨 그 원인이다.)
--
-- ── 조치 ────────────────────────────────────────────────────────────
-- ㉠ `value` 와 `dims.tables` 는 **`stat_cols = 0` 만** 센다 (지표의 정의대로).
-- ㉡ 드리프트는 `dims.drift_tables` 로 **분리**한다 — 신호를 버리지 않되 stale 수에 섞지 않는다.
-- ㉢ 드리프트 비교에 **「리셋 이후 DML 이 있었나」** 가드를 더한다
--    (`n_tup_ins + n_tup_upd + n_tup_del > 0`). 쓰기 흔적이 없으면 `n_live_tup` 은 값이 아니라 공백이다.
--
-- `criterion` 과 `drift_check_applied` 는 그대로 둔다 — 회귀가 그 두 칸을 읽는다.
--
-- ── 왜 함수 전문을 다시 적지 않는가 ─────────────────────────────────
-- `collect_db_health_metrics` 는 389줄이고 지표 20여 개를 한 트랜잭션에 넣는다.
-- 전문을 옮겨 적다 한 글자를 틀리면 **다른 지표가 조용히 죽는다** — 이 파일이 고치려는 결함과
-- 정확히 같은 종류의 사고다. 그래서 `pg_get_functiondef` 로 **지금 DB 에 있는 정의를 읽어**
-- 세 군데만 치환한다. 치환이 하나라도 안 걸리면 **예외를 던지고 멈춘다**(조용한 no-op 금지).
--
-- 재실행 안전: 두 번째 실행은 첫 패턴을 못 찾아 `이미 적용됨` 으로 끝난다(예외 없음).
-- 되돌리기: `20260908035514_db_health_stats_criterion_pg_statistic.sql` 을 다시 적용한다.

DO $patch$
DECLARE
  v_def      text;
  v_before   text;
  v_hits     int := 0;

  -- ㉠ value: 전체 count → stat_cols = 0 만
  c_count_old constant text := $x$select v_now, 'capacity', 'stats_stale_tables', count(*),$x$;
  c_count_new constant text := $x$select v_now, 'capacity', 'stats_stale_tables', count(*) filter (where x.stat_cols = 0),$x$;

  -- ㉡ dims: tables 를 stat_cols = 0 으로 좁히고 drift_tables 를 새로 싣는다
  c_dims_old constant text := $x$                       'never_analyzed', x.never_analyzed
                     ) order by x.total_bytes desc), '[]'::jsonb)
         )$x$;
  c_dims_new constant text := $x$                       'never_analyzed', x.never_analyzed
                     ) order by x.total_bytes desc) filter (where x.stat_cols = 0), '[]'::jsonb),
           -- 드리프트는 다른 신호다. stale 수에 섞으면 판정이 자기 기준을 어긴다.
           'drift_tables', coalesce(jsonb_agg(jsonb_build_object(
                       'table', x.relname,
                       'total_mb', round(x.total_bytes / 1048576.0, 1),
                       'n_live_tup', x.n_live_tup,
                       'reltuples', x.reltuples,
                       'stat_cols', x.stat_cols
                     ) order by x.total_bytes desc) filter (where x.stat_cols > 0), '[]'::jsonb)
         )$x$;

  -- ㉢ 드리프트 분기에 「리셋 이후 쓰기 흔적」 가드
  c_drift_old constant text := $x$        or (v_counter_age_min >= 1440
            and abs(coalesce(s.n_live_tup, 0) - c.reltuples)$x$;
  c_drift_new constant text := $x$        or (v_counter_age_min >= 1440
            -- 리셋 이후 DML 이 한 번이라도 있어야 n_live_tup 이 의미를 갖는다.
            -- (2026-09-15 재시작 뒤 읽기 전용 표들이 n_live_tup=0 으로 전부 드리프트로 잡혔다)
            and coalesce(s.n_tup_ins, 0) + coalesce(s.n_tup_upd, 0) + coalesce(s.n_tup_del, 0) > 0
            and abs(coalesce(s.n_live_tup, 0) - c.reltuples)$x$;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'collect_db_health_metrics';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'collect_db_health_metrics() 가 없다 — 20260906010000 계열이 먼저 적용돼야 한다';
  END IF;

  -- 이미 적용됐는지 먼저 본다(재실행 안전).
  IF position('drift_tables' in v_def) > 0 THEN
    RAISE NOTICE 'db_health_stale_criterion_fix: 이미 적용됨 — 건너뛴다';
    RETURN;
  END IF;

  v_before := v_def;
  v_def := replace(v_def, c_count_old, c_count_new);
  IF v_def <> v_before THEN v_hits := v_hits + 1; END IF;

  v_before := v_def;
  v_def := replace(v_def, c_dims_old, c_dims_new);
  IF v_def <> v_before THEN v_hits := v_hits + 1; END IF;

  v_before := v_def;
  v_def := replace(v_def, c_drift_old, c_drift_new);
  IF v_def <> v_before THEN v_hits := v_hits + 1; END IF;

  -- 조용한 no-op 금지 — 세 곳 전부 걸려야 한다.
  IF v_hits <> 3 THEN
    RAISE EXCEPTION 'collect_db_health_metrics() 정의가 예상과 다르다 — 치환 %/3 만 걸렸다. '
                    '다른 세션이 함수를 바꿨는지 pg_get_functiondef 로 확인할 것', v_hits;
  END IF;

  EXECUTE v_def;
  RAISE NOTICE 'db_health_stale_criterion_fix: 3/3 치환 적용';
END
$patch$;

-- ── 적용 뒤 ─────────────────────────────────────────────────────────
-- 지표는 append-only 스냅샷이라 **다시 수집해야** 새 판정이 나온다(과거 행은 그대로 둔다):
--   select public.collect_db_health_metrics();
--
-- 확인 — 아래가 0행이어야 한다(통계가 있는데 stale 로 센 표):
--   select jsonb_array_elements(dims->'tables') t
--   from db_health_metrics
--   where metric = 'stats_stale_tables'
--   order by measured_at desc limit 1;
--   -- 위 결과의 각 t->>'stat_cols' 가 전부 '0' 이어야 한다
--
-- 회귀: pnpm --filter web exec vitest run silent-noop
