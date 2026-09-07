-- supabase/migrations/20260906061000_db_health_queue_axis_separate.sql
--
-- 큐는 **별도 축**이어야 한다.
--
-- 20260906060000 에서 큐 지표를 `axis='cron'` 으로 넣었더니, 큐 수집기가 자기 시각에 cron 행만
-- 남기면서 **"가장 최근 비-integrity 스냅샷" 이 그 실행을 가리키게 됐다** — 화면 헤더의
-- 「최근 수집」과 5축 완전성 검사가 둘 다 엉뚱한 시각을 보고 "capacity 축이 없다" 고 판단한다.
--
-- ⚠️ **실 DB 통합 테스트가 이걸 잡았다.** 픽스처로는 절대 못 잡는 종류다 —
--    두 cron 잡이 서로 다른 시각에 쓴다는 사실 자체가 실 DB 에만 있다.
--    (`queries.integration.test.ts` — "일 1회 수집이 5축을 전부 채운다")
--
-- 축을 나누면 두 수집기가 서로의 시각을 오염시키지 않는다. 관심사도 실제로 다르다 —
-- `cron` 은 **"잡이 도는가"**, `queue` 는 **"그래서 일이 줄어드는가"** 다.
-- 이 사고의 원인이 바로 그 둘을 구별하지 못한 것이었으므로(성공을 보고하며 11일간 no-op),
-- 축을 합쳐 두면 같은 실수를 다시 부른다.
--
-- TS 쪽 짝: `DAILY_AXES`(일 1회 5축)를 `HEALTH_AXES`(전체 7축)와 따로 둔다.

alter table db_health_metrics drop constraint if exists db_health_metrics_axis_check;
alter table db_health_metrics add constraint db_health_metrics_axis_check
  check (axis in ('capacity','cron','latency','connections','advisor','integrity','queue'));

-- 이미 들어간 행도 옮긴다(한 번 실행분).
update db_health_metrics set axis = 'queue'
 where metric in ('queue_oldest_age_hours','queue_read_failed');

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
    select v_now, 'queue', 'queue_oldest_age_hours',
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
    values (v_now, 'queue', 'queue_read_failed', 1,
            jsonb_build_object('error', left(sqlerrm, 300)));
    v_rows := 1;
  end;

  return v_rows;
end $function$;

comment on function collect_db_health_queues() is
  'pgmq 큐별 적체 수집(axis=queue) — 가장 오래된 메시지 나이·길이·한 번도 안 읽힌 수. cron 축이 "잡이 성공했는가" 만 보느라 11일간 멈춘 큐를 못 잡은 사고(2026-09-06) 이후 추가. 판정 없음.';

revoke execute on function collect_db_health_queues() from public, anon, authenticated;
