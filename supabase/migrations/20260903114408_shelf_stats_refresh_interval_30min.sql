-- supabase/migrations/20260903114408_shelf_stats_refresh_interval_30min.sql
--
-- **5분마다 865 MB 를 풀스캔해서 136 KB 를 만들던 것을 그만둔다.**
--
-- 2026-09-03 03:52:43 UTC, 인스턴스가 통째로 멎었다(11:13 재시작까지 7시간 20분).
-- 로그에는 오류가 한 줄도 없다 — Postgres 가 에러를 던지고 죽은 게 아니라 로그를
-- 내보낼 여력도 없이 굶어 죽었기 때문이다. 증거는 cron 기록에 남았다:
--
--   jobid 7 | failed | 03:53:13 → 04:31:02 | "job startup timeout"
--
-- 마지막 정상 로그의 30초 뒤, postmaster 가 워커를 새로 띄우지 못했다.
-- 그 시점이 자원 고갈의 순간이고, 이후 재시작까지 cron 기록이 한 줄도 없다.
--
-- ── 진범은 job 7 이 아니라 job 14 다 ───────────────────────────────────
-- job 7(30초 워커)은 평균 0.29초로 저렴하다. 기동에 실패한 쪽, 즉 피해자다.
-- 실제 부하는 `refresh-textbook-shelf-stats`(20260830152552 도입) 이었다 —
-- 최근 3일 실측:
--
--   실행 856회 · 평균 13.98초 · 최대 120.54초 · 실패 31회
--   산출물은 132행(72 kB) + 66행(64 kB)
--
-- 5분마다 `csat_dcp_items`(865 MB · 654,390행)를 풀스캔해 136 KB 를 만든다.
-- `shared_buffers` 가 256 MB 뿐이라 스캔할 때마다 버퍼 캐시가 통째로 밀려나고,
-- 그동안 다른 모든 쿼리가 디스크로 떨어진다. 3일간 약 3.3시간어치 풀스캔 I/O.
--
-- ── 왜 30분이면 충분한가 ───────────────────────────────────────────────
-- 원본(`csat_dcp_items`)은 드레인이 돌 때만 바뀐다. 상시로 바뀌는 표가 아니다.
-- 그리고 20260830152552 의 설계가 이미 `textbook_shelf_stats_meta.refreshed_at` 을
-- 함께 내보내, 화면이 "언제 센 값인지" 를 말한다 — **낡음이 설계에 반영돼 있다.**
-- 그 위에서 5분과 30분의 차이는 학습자에게 보이지 않는다.
--
-- 일 288회 → 48회. 풀스캔 부하 6분의 1.
--
-- ⚠️ job 7(`library-pipeline-worker`, 30초)은 **일부러 건드리지 않는다.**
--    원인이 아니고, 늘리면 대기 중 5,317건 드레인이 8.9시간 → 35시간으로 늘어난다.
--    원인이 아닌 것을 고쳐 처리량만 잃을 이유가 없다.
--
-- ⚠️ 이것은 완화이지 해소가 아니다. `shared_buffers` 256 MB 로 5.3 GB DB 를 돌리는
--    구성 자체가 무리다(데이터 5,319 MB + WAL 3,280 MB ≈ 8.6 GB, Pro 기본 디스크 8 GB).
--    컴퓨트 증설 전까지는 재발 여지가 남는다.
--
-- 되돌리기: schedule => '*/5 * * * *' 로 alter_job 재실행.
--
-- ⚠️ 재실행 안전하다 — alter_job 은 멱등이고, jobid 가 아니라 jobname 으로 찾으므로
--    jobid 가 달라져도 맞는 작업을 고친다. 작업이 없으면 아무것도 하지 않는다.

DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid
    FROM cron.job
   WHERE jobname = 'refresh-textbook-shelf-stats';

  IF v_jobid IS NULL THEN
    RAISE NOTICE 'refresh-textbook-shelf-stats 작업이 없다 — 건너뛴다';
    RETURN;
  END IF;

  PERFORM cron.alter_job(v_jobid, schedule => '*/30 * * * *');
  RAISE NOTICE 'jobid % 갱신 주기를 30분으로 바꿨다', v_jobid;
END;
$$;
