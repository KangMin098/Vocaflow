-- supabase/migrations/20260913120000_video_jobs.sql
--
-- **영상 공장의 작업 단위** — 이게 없어서 지금까지 "파이프라인" 이 아니었다.
--
-- ── 무엇이 없었나 (실측 2026-09-13) ──────────────────────────────────
-- 영상 62편을 찍어 발행했는데, 그 과정이 **어디에도 남지 않았다**:
--   · 어느 편이 어느 단계인지 모른다 (manifest 와 파일을 비교해 **추론**만 했다)
--   · 렌더가 실패해도 콘솔에 한 줄 찍히고 사라진다 — 다음 사람은 실패가 있었는지도 모른다
--   · 언제 몇 편을 찍었는지, 누가 돌렸는지 기록이 없다
--   · "지금 돌고 있는가" 를 볼 방법이 없다
-- 이 저장소의 다른 파이프라인(`book_quiz_jobs` · 큐레이션 잡)은 전부 이걸 갖는다.
--
-- ── 왜 편당 한 행인가 ────────────────────────────────────────────────
-- 단계는 여섯인데 (원료→음성→렌더→썸네일→포장→발행) 관리자가 묻는 것은
-- **"이 편이 어디까지 왔나"** 하나다. 단계마다 행을 만들면 62×6=372행을 훑어야 그 답이 나온다.
-- `book_quiz_jobs` 가 책당 한 행에 진척 카운터를 둔 것과 같은 판단이다.
--
-- ── 재실행 안전 ──────────────────────────────────────────────────────
-- 자연키는 `video_id`(예: `type-blank`) 하나다. 원료 단계가 **upsert** 하므로
-- 몇 번 돌려도 행이 늘지 않고, 이미 진행된 단계는 되돌아가지 않는다(아래 RPC 가 막는다).

-- ─── 1. 작업 단위 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 공장이 짓는 id. `@vocaflow/video-factory/ids` 가 정본이라 여기서 형식을 강제하지 않는다
  -- (강제하면 규칙이 두 곳이 된다 — 이 저장소가 반복해서 겪은 드리프트).
  video_id text NOT NULL,
  -- 종류는 `spec/types.ts` 의 `VideoKind` 와 같은 목록이어야 한다.
  -- (`method`·`advice` 는 2026-09-13 에 학습방법·권장안 규칙을 더하며 생겼다 —
  --  여기 빠지면 그 편들의 큐 등록이 CHECK 위반으로 죽는다.)
  kind text NOT NULL
    CHECK (kind IN (
      'intro', 'benefit', 'curriculum', 'series', 'type', 'module', 'method', 'advice'
    )),

  -- **어디까지 왔나.** 뒤로 가지 않는다(되돌리려면 `video_job_reset`).
  --   queued    — 설계도는 있는데 아직 아무것도 안 했다
  --   voiced    — 나레이션을 구웠다
  --   rendered  — mp4 가 나왔다
  --   packaged  — 포스터·자막·썸네일·manifest 까지
  --   published — 버킷에 올라갔다 (= 화면에 뜰 수 있다)
  --   failed    — 어느 단계에서 멈췄다. `error` 와 `stage_before_fail` 을 본다
  stage text NOT NULL DEFAULT 'queued'
    CHECK (stage IN ('queued', 'voiced', 'rendered', 'packaged', 'published', 'failed')),
  /** 실패 직전 단계 — 어디서 멈췄는지. 성공 중이면 null. */
  stage_before_fail text,

  -- 단계별 실측. **못 잰 것은 null 이다** — 0 으로 뭉개면 "컷이 없다" 는 거짓이 된다.
  scenes int,
  voice_clips int,
  formats_rendered int,
  seconds numeric(6, 2),
  bytes bigint,
  thumb boolean,
  captions boolean,

  error text,
  note text,

  -- 이력 — "언제 찍었나" 는 수치가 얼마나 묵었는지의 근거다.
  voiced_at timestamptz,
  rendered_at timestamptz,
  packaged_at timestamptz,
  published_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT video_jobs_video_uniq UNIQUE (video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_stage ON video_jobs(stage);
CREATE INDEX IF NOT EXISTS idx_video_jobs_updated ON video_jobs(updated_at DESC);

DROP TRIGGER IF EXISTS trg_video_jobs_updated ON video_jobs;
CREATE TRIGGER trg_video_jobs_updated BEFORE UPDATE ON video_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 2. RLS — admin 만 ────────────────────────────────────────
-- 학습자에게 보일 것이 없다. 발행 스크립트는 service_role 이라 RLS 를 우회한다.
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_video_jobs ON video_jobs;
CREATE POLICY admin_video_jobs ON video_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── 3. 단계 올리기 ───────────────────────────────────────────
--
-- **왜 RPC 인가**: 단계는 앞으로만 간다. 그냥 UPDATE 를 허용하면 늦게 끝난 단계가
-- 먼저 끝난 단계를 **덮어써 뒤로 돌린다**(렌더를 두 번 돌리면 실제로 그렇게 된다).
-- 순서를 여기서 한 번만 정의하고, 낮은 단계로 가는 호출은 **조용히 무시**한다.
CREATE OR REPLACE FUNCTION video_job_advance(
  p_video_id text,
  p_kind text,
  p_stage text,
  p_metrics jsonb DEFAULT '{}'::jsonb,
  p_error text DEFAULT NULL
)
RETURNS video_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank int;
  v_cur_rank int;
  v_row video_jobs;
BEGIN
  IF p_stage NOT IN ('queued', 'voiced', 'rendered', 'packaged', 'published', 'failed') THEN
    RAISE EXCEPTION '알 수 없는 단계: %', p_stage;
  END IF;

  INSERT INTO video_jobs (video_id, kind)
  VALUES (p_video_id, p_kind)
  ON CONFLICT (video_id) DO NOTHING;

  SELECT * INTO v_row FROM video_jobs WHERE video_id = p_video_id;

  v_rank := array_position(
    ARRAY['queued', 'voiced', 'rendered', 'packaged', 'published'], p_stage);
  v_cur_rank := array_position(
    ARRAY['queued', 'voiced', 'rendered', 'packaged', 'published'], v_row.stage);

  UPDATE video_jobs SET
    kind = p_kind,
    -- 실패는 언제든 기록한다. 성공 단계는 **앞으로만** 간다.
    stage = CASE
      WHEN p_stage = 'failed' THEN 'failed'
      WHEN v_row.stage = 'failed' THEN p_stage          -- 실패에서 복구하면 그 단계로
      WHEN v_rank IS NULL OR v_cur_rank IS NULL THEN p_stage
      WHEN v_rank > v_cur_rank THEN p_stage
      ELSE v_row.stage
    END,
    stage_before_fail = CASE
      WHEN p_stage = 'failed' THEN v_row.stage
      ELSE NULL
    END,
    error = CASE WHEN p_stage = 'failed' THEN p_error ELSE NULL END,
    scenes           = COALESCE((p_metrics->>'scenes')::int,            scenes),
    voice_clips      = COALESCE((p_metrics->>'voice_clips')::int,       voice_clips),
    formats_rendered = COALESCE((p_metrics->>'formats_rendered')::int,  formats_rendered),
    seconds          = COALESCE((p_metrics->>'seconds')::numeric,       seconds),
    bytes            = COALESCE((p_metrics->>'bytes')::bigint,          bytes),
    thumb            = COALESCE((p_metrics->>'thumb')::boolean,         thumb),
    captions         = COALESCE((p_metrics->>'captions')::boolean,      captions),
    note             = COALESCE(p_metrics->>'note',                     note),
    voiced_at    = CASE WHEN p_stage = 'voiced'    THEN now() ELSE voiced_at END,
    rendered_at  = CASE WHEN p_stage = 'rendered'  THEN now() ELSE rendered_at END,
    packaged_at  = CASE WHEN p_stage = 'packaged'  THEN now() ELSE packaged_at END,
    published_at = CASE WHEN p_stage = 'published' THEN now() ELSE published_at END
  WHERE video_id = p_video_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION video_job_advance(text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_job_advance(text, text, text, jsonb, text) TO service_role;

-- ─── 4. 큐 요약 — Admin 이 한 번에 읽는다 ──────────────────────
CREATE OR REPLACE FUNCTION video_jobs_overview()
RETURNS TABLE (stage text, n bigint, oldest timestamptz, newest timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT stage, count(*), min(updated_at), max(updated_at)
  FROM video_jobs
  GROUP BY stage
  ORDER BY array_position(
    ARRAY['failed', 'queued', 'voiced', 'rendered', 'packaged', 'published'], stage);
$$;

REVOKE ALL ON FUNCTION video_jobs_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_jobs_overview() TO service_role, authenticated;
