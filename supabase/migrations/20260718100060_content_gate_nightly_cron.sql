-- G4: 콘텐츠 품질 게이트 nightly 자동화 — 전역 게이트 결과를 quality_metrics 에 적재(추이 추적).
-- run_content_quality_gates('global') → stage='gate' 지표. 기존 /admin/quality 대시보드에 추이 표시.
-- 목적: 파이프라인 정확성 불변식을 상시 자동 감시(사람 개입 없이). 맨 처음 "자동으로 되나" 의 답.

-- quality_metrics.stage 에 'gate' 허용 (기존 ingest/analyze/extract/publish/deliver + gate)
ALTER TABLE public.quality_metrics DROP CONSTRAINT IF EXISTS quality_metrics_stage_check;
ALTER TABLE public.quality_metrics ADD CONSTRAINT quality_metrics_stage_check
  CHECK (stage = ANY (ARRAY['ingest','analyze','extract','publish','deliver','gate']));

CREATE OR REPLACE FUNCTION public.collect_content_gate_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_n int;
BEGIN
  INSERT INTO quality_metrics (measured_at, stage, metric, value, dims)
  SELECT now(), 'gate', g.invariant, g.fail_count,
    jsonb_build_object('pipeline', g.pipeline, 'severity', g.severity, 'verdict', g.verdict)
  FROM run_content_quality_gates('global') g;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.collect_content_gate_metrics() IS
  'nightly: 전역 콘텐츠 품질 게이트 불변식 fail_count 를 quality_metrics(stage=gate) 에 적재.';

-- 관리자 수동 트리거 (기존 admin_collect_quality_metrics 패턴)
CREATE OR REPLACE FUNCTION public.admin_collect_content_gate_metrics()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  RETURN collect_content_gate_metrics();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_collect_content_gate_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_collect_content_gate_metrics() TO authenticated, service_role;

-- nightly: KST 03:25 (UTC 18:25) — 기존 quality nightly(jobid=12, 18:10) 뒤로 분리
SELECT cron.schedule('content-gate-nightly', '25 18 * * *', $$SELECT public.collect_content_gate_metrics();$$);
