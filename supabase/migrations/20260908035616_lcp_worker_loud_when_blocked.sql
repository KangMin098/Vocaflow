-- supabase/migrations/20260908035616_lcp_worker_loud_when_blocked.sql
--
-- LCP 워커가 일을 못 하면서 성공을 보고하던 것을 끝낸다.
--
-- 무엇이 있었나 (finding 36 · 2026-09-08 실측):
--   vault.secrets 가 0행이다. get_lcp_config() 가 NULL 둘을 돌려준다.
--   process_library_pipeline_batch 는 RAISE NOTICE 뒤 RETURN 0 했다.
--   cron 은 "1 row" 를 받으니 succeeded 로 기록한다 — 24시간에 1,439회 전부 초록불.
--   그 사이 pgmq library_pipeline 의 6건은 read_ct=0 인 채 12.7일을 늙었다.
--   cron 축만 보면 완벽하게 건강했다. 조용한 실패가 판정층을 통째로 속인 것이다.
--
-- 판정 기준을 바꾼다: "설정이 없다" 가 아니라 **"할 일이 있는데 못 한다"** 가 실패다.
--   큐가 비었으면 설정이 없어도 해가 없다        -> 조용히 0 (잡음 없음)
--   큐에 일이 있는데 설정이 없으면 그것은 실패다  -> 예외. cron 이 빨간불을 켠다.
--
-- 이 판정은 자기교정된다. 시크릿을 넣으면 정상 경로로 돌아가고, 잡을 끄면 아예 안 돈다.
-- 즉 "고쳤거나 껐거나" 둘 중 하나가 되기 전에는 초록불이 될 수 없다.

create or replace function public.process_library_pipeline_batch(p_batch_size integer default 5)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'pgmq', 'extensions'
as $function$
declare
  v_msg RECORD;
  v_processed int := 0;
  v_config RECORD;
  v_request_id bigint;
  v_pending bigint;
begin
  select * into v_config from get_lcp_config();

  if v_config.vercel_base_url is null or v_config.internal_token is null then
    select count(*) into v_pending from pgmq.q_library_pipeline;

    if v_pending > 0 then
      raise exception
        'LCP config missing while % message(s) wait in library_pipeline. Set vault secrets lcp_vercel_base_url and lcp_internal_token, or deactivate cron job library-pipeline-worker.',
        v_pending
        using errcode = 'configuration_limit_exceeded';
    end if;

    -- 큐가 비었다 — 설정이 없어도 놓친 일이 없다.
    raise notice 'LCP config missing, queue empty — nothing lost.';
    return 0;
  end if;

  for v_msg in
    select msg_id, message from pgmq.read('library_pipeline', 600, p_batch_size)
  loop
    select net.http_post(
      url     := v_config.vercel_base_url || '/api/lcp/process',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-LCP-Token',  v_config.internal_token
      ),
      body    := jsonb_build_object(
        'msg_id',  v_msg.msg_id,
        'book_id', v_msg.message->>'book_id'
      ),
      timeout_milliseconds := 5000
    ) into v_request_id;

    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end $function$;

comment on function public.process_library_pipeline_batch(integer) is
  'LCP 큐 워커. Vault 설정이 없고 큐에 일이 있으면 예외를 던진다 — 조용히 0 을 돌려주면 cron 이 성공으로 기록해 12.7일짜리 무증상 정지가 생긴다 (2026-09-08).';
