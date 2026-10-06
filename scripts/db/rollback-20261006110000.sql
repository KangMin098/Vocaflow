-- 20261006110000 되돌리기 — 2026-10-06 ② 적용 직후 relacl 로 복원
--   csat_dx_session · csat_dx_response · csat_dx_snapshot : anon=arwdDxtm · authenticated=awdDxtm
--   csat_learner_state                                    : anon=arwdDxtm (authenticated 는 ② 가 이미 전부 회수)
begin;
grant all on public.csat_dx_session, public.csat_dx_response, public.csat_dx_snapshot, public.csat_learner_state to anon;
grant insert, update, delete, truncate, references, trigger on public.csat_dx_session, public.csat_dx_response, public.csat_dx_snapshot to authenticated;
commit;
