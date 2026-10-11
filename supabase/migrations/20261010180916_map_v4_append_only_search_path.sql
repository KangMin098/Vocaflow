-- supabase/migrations/20261011120100_map_v4_append_only_search_path.sql
--
-- 20261011120000_map_v4_plan 의 추가 전용 가드 트리거 함수에 search_path 고정이 빠졌다 — 적용 직후 체크포인트
-- (map-v4-plan-20261011) diff 에서 mutable_search_path_funcs 0 → 1 로 드러났다. RPC 두 개와 같게 고정한다.
-- 되돌리기: alter function public.map_v4_append_only() reset search_path;
alter function public.map_v4_append_only() set search_path = public, pg_temp;
