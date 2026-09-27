-- supabase/migrations/20260924150000_video_retire_replace.sql
--
-- **발행된 영상 내리기 · 교체.**
--
-- ── 무엇이 없었나 (2026-09-24) ──────────────────────────────────────
--   · 규칙 편은 코드가 매번 다시 만든다 → manifest 에서 손으로 빼도 다음 포장에 되살아난다.
--     「내렸다」는 사실이 어디에도 남지 않았다.
--   · 요청 편은 새 id 로만 태어났다 → 이미 화면에 붙은 편(교재·랜딩)을 바꿀 길이 없었다.
--   · `video_requests.video_id` 가 UNIQUE 라 같은 자리를 두 번째 요청이 받을 수 없었다.
--   · 큐(`video_jobs`)는 단계를 되돌리지 않는다 → 이미 발행된 자리를 다시 찍으면 기록이 안 움직였다.
--
-- ── 이 마이그레이션 ─────────────────────────────────────────────────
--   video_requests.mode        new | replace. replace 면 video_id = 대상 id(같은 자리)
--   video_retirements          내린 편. 되살리기 가능, purge 뒤엔 불가(파일이 없다)
--   RPC                        video_retire · video_restore(화면) · video_retire_mark_purged ·
--                              video_job_restart(CLI)

-- ─── 1. 요청: 모드 + 같은 자리 ─────────────────────────────────────
ALTER TABLE video_requests
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'new' CHECK (mode IN ('new', 'replace'));

-- 같은 자리의 교체는 **진행 중인 것 하나만** — 끝난(평가·반려·거둠) 요청은 자리를 놓는다
ALTER TABLE video_requests DROP CONSTRAINT IF EXISTS video_requests_video_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS video_requests_video_id_live_uniq
  ON video_requests (video_id)
  WHERE video_id IS NOT NULL AND phase IN ('approved', 'applying', 'applied');
CREATE INDEX IF NOT EXISTS video_requests_video_id_idx ON video_requests (video_id);

DROP FUNCTION IF EXISTS video_request_create(text, text, text, text, text, text[], text);
CREATE OR REPLACE FUNCTION video_request_create(
  p_domain text, p_target_key text, p_target_label text,
  p_purpose text, p_audience text, p_formats text[], p_memo text,
  p_mode text DEFAULT 'new'
) RETURNS video_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  d video_domains;
  r video_requests;
BEGIN
  IF NOT video_is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM video_domains WHERE id = p_domain AND enabled;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or disabled domain: %', p_domain;
  END IF;
  IF coalesce(btrim(p_target_key), '') = '' OR coalesce(btrim(p_target_label), '') = '' THEN
    RAISE EXCEPTION 'target is required';
  END IF;
  IF p_mode NOT IN ('new', 'replace') THEN
    RAISE EXCEPTION 'bad mode: %', p_mode;
  END IF;
  -- 교체 대상은 영상 id 모양이어야 한다(자유 입력 문장을 자리로 삼지 않는다)
  IF p_mode = 'replace' AND btrim(p_target_key) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'replace target must be a video id: %', p_target_key;
  END IF;
  INSERT INTO video_requests (domain_id, target_key, target_label, purpose, audience, formats, memo, created_by, mode, video_id)
  VALUES (p_domain, btrim(p_target_key), btrim(p_target_label), p_purpose, p_audience,
          coalesce(p_formats, d.default_formats), coalesce(p_memo, ''), auth.uid(), p_mode,
          CASE WHEN p_mode = 'replace' THEN btrim(p_target_key) ELSE NULL END)
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION video_request_create(text, text, text, text, text, text[], text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_request_create(text, text, text, text, text, text[], text, text) TO authenticated;

-- ─── 2. 내린 편 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_retirements (
  video_id text PRIMARY KEY,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  retired_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  retired_at timestamptz NOT NULL DEFAULT now(),
  -- 되살렸으면 채워진다. null = 지금 내려져 있다
  restored_at timestamptz,
  -- 버킷 파일까지 지웠으면 채워진다 — 되살리려면 다시 찍어야 한다
  purged_at timestamptz
);
ALTER TABLE video_retirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_video_retirements ON video_retirements FOR SELECT USING (video_is_admin());

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
  -- 다시 내리면 이유·시각을 새로 쓰고 되살림 표시를 지운다. purge 기록은 남긴다(파일은 여전히 없다)
  INSERT INTO video_retirements (video_id, reason, retired_by)
  VALUES (btrim(p_video_id), btrim(p_reason), auth.uid())
  ON CONFLICT (video_id) DO UPDATE
    SET reason = EXCLUDED.reason, retired_by = EXCLUDED.retired_by, retired_at = now(), restored_at = NULL
  RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION video_retire(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_retire(text, text) TO authenticated;

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
    RAISE EXCEPTION 'files were purged at % — re-render before restoring', v.purged_at;
  END IF;
  UPDATE video_retirements SET restored_at = now() WHERE video_id = p_video_id RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION video_restore(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_restore(text) TO authenticated;

CREATE OR REPLACE FUNCTION video_retire_mark_purged(p_video_id text) RETURNS video_retirements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v video_retirements;
BEGIN
  UPDATE video_retirements SET purged_at = now()
   WHERE video_id = p_video_id AND restored_at IS NULL
  RETURNING * INTO v;
  IF NOT FOUND THEN RAISE EXCEPTION 'not retired: %', p_video_id; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION video_retire_mark_purged(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_retire_mark_purged(text) TO service_role;

-- ─── 3. 큐: 같은 자리를 다시 찍는다 ────────────────────────────────
-- `video_job_advance` 는 단계를 되돌리지 않는다(재실행 안전의 핵심). 교체는 **의도적으로** 처음부터
-- 다시 찍는 것이므로 별도 RPC 로만 되돌린다 — 이력(published_at 등)은 새 발행이 덮을 때까지 둔다.
CREATE OR REPLACE FUNCTION video_job_restart(p_video_id text, p_kind text) RETURNS video_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  j video_jobs;
BEGIN
  INSERT INTO video_jobs (video_id, kind, stage)
  VALUES (p_video_id, p_kind, 'queued')
  ON CONFLICT (video_id) DO UPDATE
    SET kind = EXCLUDED.kind, stage = 'queued', stage_before_fail = NULL, error = NULL,
        note = '교체 — 처음부터 다시 찍는다'
  RETURNING * INTO j;
  RETURN j;
END $$;
REVOKE ALL ON FUNCTION video_job_restart(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_job_restart(text, text) TO service_role;
