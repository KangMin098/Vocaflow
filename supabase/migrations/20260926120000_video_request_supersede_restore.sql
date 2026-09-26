-- supabase/migrations/20260926120000_video_request_supersede_restore.sql
--
-- **PR #119 리뷰 결함 셋을 DB 쪽에서 막는다** (20260924150000 은 이미 적용됐으므로 고치지 않고 덧붙인다).
--
--   ① 실패한 교체 요청 재시도 vs 새 교체 요청 — 같은 video_id 의 두 행이 동시에 applying 으로 가면
--      `video_requests_video_id_live_uniq` 위반으로 파이프라인이 멈춘다. CLI(requests:pull)가 먼저
--      거르지만, 전이 RPC 도 「같은 자리에 더 새 요청이 있으면 옛 실패 요청은 재시도 불가」를 막는다.
--   ② 교체 편 평가가 옛 편의 재생 기록을 섞었다 — 요청이 applied 가 되는 순간의 발행 시각을
--      `applied_at` 에 남겨, 평가는 그 뒤 이벤트만 센다.
--   ③ purge 된 편은 되살릴 길이 없었다(렌더는 내린 id 를 빼고, purged_at 을 지우는 곳이 없다).
--      되살리기를 「다시 찍기 요청」(`rerender_requested_at`)으로 받고, 다시 찍기가 끝나면
--      `video_retire_rerendered` 가 purged_at 을 지우고 되살린다.
--
-- 되돌리기: 두 컬럼 DROP + 아래 함수 셋을 20260924120000 · 20260924150000 의 정의로 되돌린다.

-- ─── 1. 요청: 발행 시각 ───────────────────────────────────────────
ALTER TABLE video_requests ADD COLUMN IF NOT EXISTS applied_at timestamptz;

CREATE OR REPLACE FUNCTION video_request_advance(
  p_id uuid, p_phase text, p_video_id text, p_error text
) RETURNS video_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r video_requests;
  ok boolean;
BEGIN
  SELECT * INTO r FROM video_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such request'; END IF;
  ok := CASE p_phase
          WHEN 'applying'  THEN r.phase IN ('approved', 'failed') AND r.current_rev >= 1
          WHEN 'applied'   THEN r.phase = 'applying'
          WHEN 'evaluated' THEN r.phase IN ('applied', 'evaluated')
          WHEN 'failed'    THEN r.phase IN ('applying')
          ELSE false END;
  IF NOT ok THEN
    RAISE EXCEPTION 'transition % -> % not allowed', r.phase, p_phase;
  END IF;
  -- failed → applying 재시도는 승인된 rev 로만: 마지막 결정이 approve 인지 확인
  IF p_phase = 'applying' AND NOT EXISTS (
    SELECT 1 FROM video_request_reviews
     WHERE request_id = p_id AND rev = r.current_rev AND decision = 'approve'
  ) THEN
    RAISE EXCEPTION 'current revision % is not approved', r.current_rev;
  END IF;
  -- 같은 자리에 더 새 요청이 있으면 옛 실패 요청은 다시 적용하지 않는다(새 요청이 자리를 이어받았다)
  IF p_phase = 'applying' AND r.phase = 'failed' AND r.video_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM video_requests o
     WHERE o.video_id = r.video_id AND o.id <> r.id AND o.created_at > r.created_at
       AND o.phase NOT IN ('rejected', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'superseded: a newer request owns video %', r.video_id;
  END IF;
  UPDATE video_requests
     SET phase = p_phase,
         video_id = coalesce(p_video_id, video_id),
         error = CASE WHEN p_phase = 'failed' THEN p_error ELSE NULL END,
         -- 발행을 확인한 순간의 발행 시각 — 평가는 이 뒤의 재생만 센다(교체 전 편의 기록을 섞지 않는다)
         applied_at = CASE
           WHEN p_phase = 'applied' THEN coalesce(
             (SELECT j.published_at FROM video_jobs j WHERE j.video_id = coalesce(p_video_id, r.video_id)),
             now())
           WHEN p_phase = 'applying' THEN NULL
           ELSE applied_at END
   WHERE id = p_id
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION video_request_advance(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_advance(uuid, text, text, text) TO service_role;

-- ─── 2. 내린 편: purge 뒤 되살리기 = 다시 찍기 요청 ─────────────────
ALTER TABLE video_retirements ADD COLUMN IF NOT EXISTS rerender_requested_at timestamptz;

CREATE OR REPLACE FUNCTION video_restore(p_video_id text) RETURNS video_retirements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v video_retirements;
BEGIN
  IF NOT video_is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM video_retirements WHERE video_id = p_video_id FOR UPDATE;
  IF NOT FOUND OR v.restored_at IS NOT NULL THEN
    RAISE EXCEPTION 'not retired: %', p_video_id;
  END IF;
  IF v.purged_at IS NOT NULL THEN
    -- 파일이 없다 — 바로 되살리지 않고 「다시 찍기」를 요청해 둔다. 내려진 상태는 유지된다
    -- (포장·발행은 계속 뺀다). 다시 찍기가 끝나면 video_retire_rerendered 가 되살린다.
    UPDATE video_retirements SET rerender_requested_at = coalesce(rerender_requested_at, now())
     WHERE video_id = p_video_id RETURNING * INTO v;
    RETURN v;
  END IF;
  UPDATE video_retirements SET restored_at = now(), rerender_requested_at = NULL
   WHERE video_id = p_video_id RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION video_restore(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_restore(text) TO authenticated;

-- 다시 내리면 다시 찍기 요청도 지운다(purge 기록은 남긴다 — 파일은 여전히 없다)
CREATE OR REPLACE FUNCTION video_retire(p_video_id text, p_reason text) RETURNS video_retirements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v video_retirements;
BEGIN
  IF NOT video_is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reason is required';
  END IF;
  INSERT INTO video_retirements (video_id, reason, retired_by)
  VALUES (btrim(p_video_id), btrim(p_reason), auth.uid())
  ON CONFLICT (video_id) DO UPDATE
    SET reason = EXCLUDED.reason, retired_by = EXCLUDED.retired_by, retired_at = now(),
        restored_at = NULL, rerender_requested_at = NULL
  RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION video_retire(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_retire(text, text) TO authenticated;

-- 다시 찍기 완료(CLI render 가 모든 규격을 파일로 확인한 뒤 부른다) → purge 표시를 지우고 되살린다
CREATE OR REPLACE FUNCTION video_retire_rerendered(p_video_id text) RETURNS video_retirements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v video_retirements;
BEGIN
  UPDATE video_retirements
     SET purged_at = NULL, rerender_requested_at = NULL, restored_at = now()
   WHERE video_id = p_video_id AND restored_at IS NULL AND rerender_requested_at IS NOT NULL
  RETURNING * INTO v;
  IF NOT FOUND THEN RAISE EXCEPTION 'no re-render requested: %', p_video_id; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION video_retire_rerendered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_retire_rerendered(text) TO service_role;
