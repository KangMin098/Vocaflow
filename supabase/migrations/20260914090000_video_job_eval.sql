-- supabase/migrations/20260914090000_video_job_eval.sql
--
-- **평가 결과를 큐에 남긴다** — 파이프라인 세 단계(기획·제작·평가) 중 마지막이 기록될 자리.
--
-- ── 무엇이 없었나 (실측 2026-09-14) ──────────────────────────────────
-- `video_jobs` 는 **어디까지 왔나**(단계)는 답해도 **잘 찍었나**는 못 답했다.
-- 그래서 결함은 스틸을 띄워 눈으로 볼 때만 드러났고, 그 방식은 219개 컴포지션에서
-- 되풀이할 수가 없다. 실제로 그렇게 놓친 것이 있다 — 자막 한 건이 7초를 넘는 컷 15개
-- (Netflix Timed Text Style Guide 상한). 사람 눈으로는 "좀 기네" 로만 보인다.
--
-- ── 왜 별도 테이블이 아니라 같은 행인가 ──────────────────────────────
-- 관리자가 묻는 것은 **"이 편이 어디까지 왔고 규격 안인가"** 하나다. 두 표를 맞대야
-- 답이 나오면 화면이 그 조인을 매번 해야 하고, 한쪽만 갱신되는 순간 둘이 갈린다.
-- 큐와 같은 생명주기를 가지므로(편이 사라지면 평가도 의미 없다) 같은 행에 둔다.
--
-- ── 왜 축을 jsonb 로 두나 ────────────────────────────────────────────
-- 축은 늘어난다(지금 7종 + 규격별 음량). 축마다 열을 만들면 축을 더할 때마다
-- 마이그레이션이 필요하고, 그러면 축을 안 더하게 된다. 판정 규칙의 정본은
-- `packages/video-factory/src/spec/evaluate.ts` 이고 DB 는 그 결과를 담기만 한다.
--
-- ⚠️ **합계 세 개를 따로 두는 이유**: jsonb 안을 세면 화면이 매번 배열을 훑어야 하고,
--   무엇보다 **못 잰 축(unknown)이 조용히 합격으로 접힌다.** 세 수를 분리해 두면
--   `pass + fail ≠ 전체` 가 눈에 보인다.

ALTER TABLE video_jobs
  ADD COLUMN IF NOT EXISTS eval_at timestamptz,
  ADD COLUMN IF NOT EXISTS eval_pass int,
  ADD COLUMN IF NOT EXISTS eval_fail int,
  ADD COLUMN IF NOT EXISTS eval_unknown int,
  -- 축별 결과. `[{id, label, verdict, value, limit, source, offenders}]`
  ADD COLUMN IF NOT EXISTS eval_axes jsonb;

COMMENT ON COLUMN video_jobs.eval_fail IS
  '규격을 어긴 축 수. 0 이 아니면 그 편은 다시 찍거나 고쳐야 한다.';
COMMENT ON COLUMN video_jobs.eval_unknown IS
  '못 잰 축 수 — 합격도 불합격도 아니다. 0 으로 접으면 조용히 통과한다.';

-- 어긋난 편만 빠르게 찾는다. 대부분은 0 이므로 부분 인덱스로 둔다.
CREATE INDEX IF NOT EXISTS idx_video_jobs_eval_fail
  ON video_jobs(eval_fail) WHERE eval_fail > 0;

-- ─── 평가 결과 기록 ───────────────────────────────────────────
--
-- **단계(`stage`)를 건드리지 않는다.** 평가는 제작의 단계가 아니라 그 위의 판정이다 —
-- 섞으면 "평가에서 떨어졌다" 가 "아직 안 찍었다" 로 읽힌다.
--
-- 행이 없으면 **만들지 않고 조용히 0행을 돌려준다.** 평가는 찍은 것에 대해서만 의미가
-- 있으므로, 없는 편의 평가를 받아 행을 만들면 큐에 유령이 생긴다.
CREATE OR REPLACE FUNCTION video_job_evaluate(
  p_video_id text,
  p_pass int,
  p_fail int,
  p_unknown int,
  p_axes jsonb
)
RETURNS video_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row video_jobs;
BEGIN
  UPDATE video_jobs SET
    eval_at = now(),
    eval_pass = p_pass,
    eval_fail = p_fail,
    eval_unknown = p_unknown,
    eval_axes = p_axes
  WHERE video_id = p_video_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION video_job_evaluate(text, int, int, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_job_evaluate(text, int, int, int, jsonb) TO service_role;

-- ─── 평가 요약 — Admin 이 한 번에 읽는다 ───────────────────────
--
-- 네 수를 가른다. **「안 잰 편」과 「재서 통과한 편」은 다르다** — 뭉치면
-- 아직 평가를 안 돌린 상태가 "다 통과" 로 보인다.
CREATE OR REPLACE FUNCTION video_eval_overview()
RETURNS TABLE (
  total bigint,
  evaluated bigint,
  clean bigint,
  failing bigint,
  incomplete bigint,
  last_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE eval_at IS NOT NULL),
    count(*) FILTER (WHERE eval_at IS NOT NULL AND eval_fail = 0 AND eval_unknown = 0),
    count(*) FILTER (WHERE eval_at IS NOT NULL AND eval_fail > 0),
    count(*) FILTER (WHERE eval_at IS NOT NULL AND eval_fail = 0 AND eval_unknown > 0),
    max(eval_at)
  FROM video_jobs;
$$;

REVOKE ALL ON FUNCTION video_eval_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION video_eval_overview() TO service_role, authenticated;
