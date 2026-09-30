-- supabase/migrations/20260928141253_csat_hakpyeong_gate_hygiene.sql
--
-- 독립 검수 게이트(20260928141215) 위생 — 적용 2026-09-28. 보안 권고가 잡은 두 가지:
--   · csat_analysis_hash 의 search_path 미고정(function_search_path_mutable) — 저장소 advisor-hygiene 회귀도 걸린다
--   · 새 트리거 함수(SECURITY DEFINER)를 anon/authenticated 가 RPC 로 실행 가능
-- 트리거 함수의 EXECUTE 권한은 트리거 생성 때만 검사되므로 회수해도 발동은 그대로다(롤백 스모크로 확인:
-- 학평 발행 거부 · 평가원 재발행 정상).

alter function public.csat_analysis_hash(public.csat_item_analyses) set search_path = public;
revoke all on function public.csat_independent_review_stamp(), public.csat_hold_on_analysis_change(),
  public.csat_hold_on_item_change(), public.csat_hold_on_review_withdraw(), public.csat_guard_published()
  from public, anon, authenticated;
revoke all on function public.csat_analysis_hash(public.csat_item_analyses) from public, anon, authenticated;
