-- 롤백: P2 weekly_reports 제거 (주간 리포트 캐시 손실 — daily_activity/원천 무영향)
DROP POLICY IF EXISTS weekly_reports_owner ON public.weekly_reports;
DROP TABLE IF EXISTS public.weekly_reports;
