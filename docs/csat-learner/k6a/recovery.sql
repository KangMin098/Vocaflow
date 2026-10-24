-- docs/csat-learner/k6a/recovery.sql
-- K6-a 복구(forward.sql 을 되돌린다). 개발 DB jajenrevcbmrpaliomxv 의 2026-10-25 pg_get_functiondef 원문 그대로(v3 · 20261023194123).
-- 권한: CREATE OR REPLACE 는 기존 ACL 을 유지한다(현재 postgres · service_role · authenticated EXECUTE, security invoker, STABLE).
-- 데이터 변경 없음. forward 로 만든 csat_passage_key 를 지운다(다른 객체가 의존하지 않는다 — forward 의 learning_attempt_independence 만 썼고 아래에서 원래 본문으로 돌아간다).

begin;

CREATE OR REPLACE FUNCTION public.learning_attempt_independence(p_attempt_id bigint)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with a as (
    select t.id, t.user_id, t.item_ref, t.task_key, t.phase, t.activity, t.session_id, t.is_correct, t.answered_at, t.exposure_order_at
    from public.learning_task_attempts t where t.id = p_attempt_id
  ), f as (
    select v.* from public.learning_first_attempts v, a where v.attempt_id = a.id
  ), exposed as (
    select 1 as yes from public.learning_exposures e, a
    where e.user_id = a.user_id and e.item_ref = a.item_ref and e.received_at <= a.exposure_order_at limit 1
  )
  select case
    when a.id is null then null
    when a.exposure_order_at is null or a.item_ref is null then 'legacy_unknown'
    when a.activity is distinct from 'theater' or a.phase <> 'practice' then 'not_check_phase'
    when not exists (select 1 from f) then 'repeat'
    when (select after_viewed_first or after_explanation or help_level is distinct from 'independent' from f) then 'helped'
    when exists (select 1 from exposed) then 'after_exposure'
    when (select timing_uncertain from f) then 'timing_held'
    when a.session_id is null then 'unbound'
    when a.is_correct is null or a.answered_at is null then 'ungraded'
    else 'independent_candidate'
  end
  from (select 1) one left join a on true
$function$;

drop function if exists public.csat_passage_key(text);

-- 확인: 원래 ACL 과 같은가(postgres=X · service_role=X · authenticated=X)
select p.proacl::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'learning_attempt_independence';

commit;
