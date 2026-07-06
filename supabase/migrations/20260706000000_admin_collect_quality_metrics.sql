-- 20260706000000_admin_collect_quality_metrics.sql
-- 품질평가 Q3 후속 — /admin/quality "지금 수집" 버튼용 admin wrapper RPC.
-- collect_quality_metrics() 는 EXECUTE 가 postgres/service_role 전용이라
-- 웹(authenticated 세션)에서 직접 호출 불가 → role='admin' 검사 후 위임.

CREATE OR REPLACE FUNCTION admin_collect_quality_metrics()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  PERFORM collect_quality_metrics();
END $$;

REVOKE ALL ON FUNCTION admin_collect_quality_metrics() FROM public;
GRANT EXECUTE ON FUNCTION admin_collect_quality_metrics() TO authenticated;
