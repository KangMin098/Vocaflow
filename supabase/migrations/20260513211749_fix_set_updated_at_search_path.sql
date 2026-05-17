-- §18.9 BLOCKER 15 패치 — set_updated_at() search_path 명시
-- search_path injection 위험 제거. proconfig 미설정 상태를 안전 값으로 고정.
-- 함수 본문은 그대로 유지 (NEW.updated_at = now()).

ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
