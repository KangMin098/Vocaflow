-- supabase/migrations/20260508120300_lcp_v2_worker.sql
-- ═══════════════════════════════════════════════════════════
-- LCP v2.0 — Phase 7: pgmq worker + auto curate
-- ═══════════════════════════════════════════════════════════
-- 옵션 A: pg_cron이 직접 Vercel API 호출 (Edge Function 없음)
-- 흐름:
--   1) library_books INSERT (status=queued) → 트리거가 pgmq.send
--   2) pg_cron 30초마다 process_library_pipeline_batch(5)
--   3) pgmq.read N개 → net.http_post(Vercel)
--   4) Vercel API가 처리 + pgmq_archive (성공/실패 모두 archive)
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────
-- ① pg_net extension (Phase 1에서 누락된 것)
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;
-- supabase_vault 는 Supabase managed 환경에서 자동 설치되어 있음

-- ─────────────────────────────────────────────
-- ② library_books INSERT 트리거 — 자동 enqueue
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_lb_enqueue_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq, extensions
AS $$
BEGIN
  IF NEW.status = 'queued' THEN
    PERFORM pgmq.send(
      'library_pipeline',
      jsonb_build_object('book_id', NEW.id, 'enqueued_at', now())
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lb_enqueue ON library_books;
CREATE TRIGGER trg_lb_enqueue
  AFTER INSERT ON library_books
  FOR EACH ROW EXECUTE FUNCTION trg_lb_enqueue_pipeline();

COMMENT ON FUNCTION trg_lb_enqueue_pipeline() IS
  'LCP v2.0 Phase 7 — library_books INSERT 시 pgmq에 자동 enqueue';

-- ─────────────────────────────────────────────
-- ③ Vercel URL + 토큰을 vault에서 읽는 헬퍼
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_lcp_config()
RETURNS TABLE(vercel_base_url TEXT, internal_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'lcp_vercel_base_url' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'lcp_internal_token' LIMIT 1);
END $$;

REVOKE ALL ON FUNCTION get_lcp_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_lcp_config() TO service_role;

COMMENT ON FUNCTION get_lcp_config() IS
  'LCP v2.0 — vault에서 Vercel URL + 내부 토큰 조회. 사용자가 vault.create_secret로 사전 등록 필요.';

-- ─────────────────────────────────────────────
-- ④ pgmq_archive RPC 래퍼 — TS에서 직접 호출용
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pgmq_archive(p_queue_name TEXT, p_msg_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  SELECT pgmq.archive(p_queue_name, p_msg_id) INTO v_result;
  RETURN COALESCE(v_result, false);
END $$;

REVOKE ALL ON FUNCTION pgmq_archive(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pgmq_archive(TEXT, BIGINT) TO service_role;

COMMENT ON FUNCTION pgmq_archive(TEXT, BIGINT) IS
  'LCP v2.0 — pgmq.archive RPC 래퍼. Vercel API에서 메시지 처리 완료 후 호출.';

-- ─────────────────────────────────────────────
-- ⑤ worker 본체 — pgmq.read + Vercel POST
--    visibility_timeout 600초 (10분, 80K 단어 책 처리 시간 고려)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_library_pipeline_batch(p_batch_size INT DEFAULT 5)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq, extensions
AS $$
DECLARE
  v_msg RECORD;
  v_processed INT := 0;
  v_config RECORD;
  v_request_id BIGINT;
BEGIN
  SELECT * INTO v_config FROM get_lcp_config();

  IF v_config.vercel_base_url IS NULL OR v_config.internal_token IS NULL THEN
    RAISE NOTICE 'LCP config missing — skipping batch (set vault: lcp_vercel_base_url, lcp_internal_token)';
    RETURN 0;
  END IF;

  FOR v_msg IN
    SELECT msg_id, message FROM pgmq.read('library_pipeline', 600, p_batch_size)
  LOOP
    -- fire-and-forget POST
    -- 실제 처리 결과는 Vercel API 측에서 직접 pgmq_archive + library_books update
    SELECT net.http_post(
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
    ) INTO v_request_id;

    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END $$;

REVOKE ALL ON FUNCTION process_library_pipeline_batch(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION process_library_pipeline_batch(INT) TO service_role;

-- ─────────────────────────────────────────────
-- ⑥ auto_curate_book — 자동 publish 판정
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_curate_book(p_book_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_book RECORD;
  v_decision TEXT;
  v_lbv_count INT;
BEGIN
  SELECT * INTO v_book FROM library_books WHERE id = p_book_id;
  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not found: %', p_book_id;
  END IF;

  SELECT COUNT(*) INTO v_lbv_count
    FROM library_book_vocabularies WHERE library_book_id = p_book_id;

  -- 자동 publish 조건
  IF v_book.cefr_confidence >= 0.85
     AND v_book.copyright_safe_in_kr = true
     AND v_book.chapter_count BETWEEN 1 AND 100
     AND v_book.word_count >= 1000
     AND v_lbv_count >= 50
  THEN
    UPDATE library_books
    SET status = 'published', published_at = now()
    WHERE id = p_book_id;
    v_decision := 'auto_publish';

  -- admin 검토 대기
  ELSIF v_book.cefr_confidence >= 0.60
        AND v_book.copyright_safe_in_kr = true
  THEN
    UPDATE library_books SET status = 'ready' WHERE id = p_book_id;
    v_decision := 'admin_review';

  -- 자동 거부
  ELSE
    UPDATE library_books
    SET status = 'failed',
        status_message = format(
          'Auto-curate rejected: cefr_confidence=%s, kr_safe=%s, chapters=%s, words=%s, vocab=%s',
          v_book.cefr_confidence, v_book.copyright_safe_in_kr,
          v_book.chapter_count, v_book.word_count, v_lbv_count
        )
    WHERE id = p_book_id;
    v_decision := 'reject';
  END IF;

  RETURN v_decision;
END $$;

REVOKE ALL ON FUNCTION auto_curate_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auto_curate_book(UUID) TO service_role;

COMMENT ON FUNCTION auto_curate_book(UUID) IS
  'LCP v2.0 Phase 7 — 자동 publish 판정. confidence>=0.85 → publish, >=0.60 → admin_review, 그 외 → reject';

-- ─────────────────────────────────────────────
-- ⑦ pg_cron worker schedule — 30초마다
-- ─────────────────────────────────────────────
SELECT cron.unschedule(jobname) FROM cron.job
  WHERE jobname = 'library-pipeline-worker';

SELECT cron.schedule(
  'library-pipeline-worker',
  '30 seconds',
  $$SELECT process_library_pipeline_batch(5)$$
);

COMMIT;
