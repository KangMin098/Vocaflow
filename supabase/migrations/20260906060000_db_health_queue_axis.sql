-- supabase/migrations/20260906060000_db_health_queue_axis.sql
--
-- **큐가 멈춘 것을 아무도 몰랐다.** 11일간.
--
-- ── 실측 (2026-09-06) ──────────────────────────────────────────────────
-- `library-pipeline-worker`(jobid 7)는 30초마다 도는 워커다. 24시간에 2,788회 **성공**으로
-- 기록됐다. 그런데 `pgmq.q_library_pipeline` 에는 메시지 6건이 **10.9일째** 그대로 있고
-- 전부 `read_ct = 0` — 워커가 **한 번도 읽지 않았다.**
--
-- 원인은 함수 첫머리다:
--     SELECT * INTO v_config FROM get_lcp_config();
--     IF v_config.vercel_base_url IS NULL OR ... THEN RETURN 0; END IF;
-- `vault.secrets` 가 **비어 있어서**(0행) 설정이 null 이고, 큐를 읽기도 전에 0 을 돌려준다.
-- 오류가 아니므로 pg_cron 은 **성공**으로 적는다. 즉 약 3만 번의 no-op 이 전부 초록불이었다.
-- 도서 6권이 2026-08-26 부터 `queued` 로 묶여 있다.
--
-- ⚠️ 이것이 CONVENTIONS 의 「조용한 실패」 그 자체다 — **성공을 보고하면서 아무 일도 안 한다.**
--    cron 축은 "잡이 성공했는가" 만 보고 있었고, 그 질문으로는 이 종류를 영원히 못 잡는다.
--    필요한 질문은 **"그래서 일이 줄어들었는가"** 다.
--
-- ── 왜 별도 함수인가 ───────────────────────────────────────────────────
-- `collect_db_health_metrics()` 는 15KB 다. 거기에 지표를 더하려면 매번 전체를 다시 써야 하고,
-- 그때마다 원격/저장소가 갈릴 위험이 생긴다(실제로 376자 갈렸었다). 큐 지표는 관심사가
-- 뚜렷하므로 **작은 함수로 떼어 별도 cron 잡**으로 돌린다 — 실패 영역도 서로 독립이다.
--
-- ── 함께 올리는 예산 두 개 ─────────────────────────────────────────────
-- `refresh-textbook-shelf-stats` 와 `content-gate-nightly` 가 statement timeout 으로 죽는다.
-- 그런데 **둘 다 평소엔 빠르다** — 7일 실측 평균 12.8초(최대 117.3) · 36.8초(최대 45.8).
-- 즉 잡이 무거워서가 아니라 **느린 디스크를 만났을 때** 120초 벽에 부딪힌다
-- (`capacity:disk_io:instance` — 랜덤 리드 26ms · 실효 10MB/s). 그래서 예산을 늘린다:
-- 평균의 8~23배인 300초면 느린 구간을 타고 넘으면서도, 진짜로 무거워지면 여전히 걸린다.
-- ⚠️ 예산을 늘렸다고 빨라지지 않는다. **평균이 오르는지**를 계속 봐야 하고, 그 값은
--    `cron.job_run_details` 에 그대로 남는다.

-- ── 큐 축 ───────────────────────────────────────────────────────────────
create or replace function collect_db_health_queues()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pgmq', 'extensions'
as $function$
declare
  v_now timestamptz := now();
  v_rows integer := 0;
begin
  begin
    -- 큐마다 1행. "가장 오래된 메시지가 몇 시간 묵었나" 가 핵심 신호다 —
    -- 잡이 성공하고 있어도 이 값이 계속 자라면 **일이 줄지 않고 있다**는 뜻이다.
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    select v_now, 'cron', 'queue_oldest_age_hours',
           round((coalesce(m.oldest_msg_age_sec, 0) / 3600.0)::numeric, 2),
           jsonb_build_object(
             'queue', m.queue_name,
             'length', m.queue_length,
             'newest_age_hours', round((coalesce(m.newest_msg_age_sec, 0) / 3600.0)::numeric, 2),
             'total_messages', m.total_messages,
             -- 한 번도 안 읽힌 메시지 수 — 워커가 큐에 **닿지도 못하는** 경우를 가른다.
             -- (읽고 실패하는 것과 읽지도 못하는 것은 원인이 완전히 다르다)
             'never_read', (
               select count(*) from pgmq.q_library_pipeline q
               where m.queue_name = 'library_pipeline' and q.read_ct = 0
             )
           )
    from pgmq.metrics_all() m;

    select count(*)::int into v_rows
    from db_health_metrics where measured_at = v_now and metric = 'queue_oldest_age_hours';
  exception when others then
    -- pgmq 가 없거나 권한이 없으면 **0 이 아니라 실패**로 남긴다.
    -- 0 으로 적으면 "큐가 비었다" 로 읽혀 이 축이 통째로 거짓말이 된다.
    insert into db_health_metrics (measured_at, axis, metric, value, dims)
    values (v_now, 'cron', 'queue_read_failed', 1,
            jsonb_build_object('error', left(sqlerrm, 300)));
    v_rows := 1;
  end;

  return v_rows;
end $function$;

comment on function collect_db_health_queues() is
  'pgmq 큐별 적체 수집 — 가장 오래된 메시지 나이·길이·한 번도 안 읽힌 수. cron 축이 "잡이 성공했는가" 만 보느라 11일간 멈춘 큐를 못 잡은 사고(2026-09-06) 이후 추가. 판정 없음.';

revoke execute on function collect_db_health_queues() from public, anon, authenticated;

create or replace function admin_collect_db_health_queues()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v integer;
begin
  if not exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  select collect_db_health_queues() into v;
  return v;
end $function$;

comment on function admin_collect_db_health_queues() is
  'admin 검사 후 collect_db_health_queues() 위임.';

revoke execute on function admin_collect_db_health_queues() from public, anon;
grant execute on function admin_collect_db_health_queues() to authenticated;

-- ── 야간 잡 예산 (실측 근거는 머리말) ───────────────────────────────────
-- 함수 단위 GUC 라 cron·수동 호출 어느 경로로 불려도 같이 적용되고, 되돌리려면
-- `alter function ... reset statement_timeout` 한 줄이면 된다.
alter function public.refresh_textbook_shelf_stats() set statement_timeout = '300s';
alter function public.collect_content_gate_metrics() set statement_timeout = '300s';

-- pg_cron 등록은 별도 실행:
--   select cron.schedule('db-health-queues-daily', '45 18 * * *',
--     $cron$select collect_db_health_queues()$cron$);
--   -- KST 03:45. db-health-daily(03:40) 바로 뒤 · 실패 영역을 분리하려고 별도 잡으로 둔다.
