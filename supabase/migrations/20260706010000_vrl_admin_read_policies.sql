-- 20260706010000_vrl_admin_read_policies.sql
-- v06.147 발견 수리 — /admin/vrl/users·snapshots·diagnostic 하위 페이지가
-- 본인전용 RLS 에 막혀 admin 세션에서도 빈 화면이던 문제.
--
-- is_admin() SECURITY DEFINER 헬퍼: user_profiles 자기참조 정책의
-- "infinite recursion detected in policy" 를 피하는 표준 패턴
-- (definer 가 RLS 를 우회해 재귀 고리를 끊는다).

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION is_admin() FROM public;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- admin read 정책 4건 — 기존 본인(own) 정책은 그대로, admin 에게 SELECT 만 추가
CREATE POLICY snapshots_admin_read ON user_level_snapshots
  FOR SELECT USING (is_admin());

CREATE POLICY profiles_admin_read ON user_profiles
  FOR SELECT USING (is_admin());

CREATE POLICY diagnostic_results_admin_read ON user_diagnostic_results
  FOR SELECT USING (is_admin());

-- 비활성 진단도 admin 은 열람 가능 (기존 "read active" 는 학습자용으로 유지)
CREATE POLICY diagnostic_tests_admin_read_all ON vrl_diagnostic_tests
  FOR SELECT USING (is_admin());
