-- supabase/deploy/factory-i1/db1-restore.sql
-- 생성물(scripts/db/factory-i1/restore.mjs). DB-1(20261017200000) 를 커밋 뒤 되돌린다 → 적용 전 상태(권한 helper 강화는 유지).
-- 보존 조건(무엇이든 지우기 전에 잠그고 모두 검사): DB-2 · D3 가 있으면 거절(먼저 되돌린다). 8표 중 하나라도 행이 있으면 거절 —
--   원장은 추가 전용이다. 행이 있으면 create table … _preserve_<날짜> as select 로 복사한 뒤 별도 승인으로만.
begin;
set local lock_timeout = '15s';
lock table public.workspace_content_delivery, public.factory_order_event, public.factory_order, public.workspace_content_demand_line, public.workspace_content_demand, public.content_release_revocation, public.content_release_approval, public.content_qualification in access exclusive mode;
do $vf$ declare t text; v_has boolean; begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'workspace_line_fulfillment')
     or exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%') then
    raise exception 'RESTORE_BLOCKED DB-2 가 적용돼 있다 — db2-restore.sql 을 먼저';
  end if;
  if to_regclass('public.factory_product_order') is not null or to_regclass('public.factory_order_product_link') is not null then
    raise exception 'RESTORE_BLOCKED D3 표가 있다 — D3 를 먼저 되돌린다';
  end if;
  foreach t in array array['workspace_content_delivery', 'factory_order_event', 'factory_order', 'workspace_content_demand_line', 'workspace_content_demand', 'content_release_revocation', 'content_release_approval', 'content_qualification'] loop
    execute format('select exists (select 1 from public.%I)', t) into v_has;
    if v_has then raise exception 'RESTORE_BLOCKED %.% 에 행이 있다 — 원장 보존(복사 뒤 별도 승인)', 'public', t; end if;
  end loop;
end $vf$;
drop table public.workspace_content_delivery;
drop table public.factory_order_event;
drop table public.factory_order;
drop table public.workspace_content_demand_line;
drop table public.workspace_content_demand;
drop table public.content_release_revocation;
drop table public.content_release_approval;
drop table public.content_qualification;
drop function public.content_qualification_record(p_rules_version text, p_kind text, p_ref text, p_revision text, p_task text, p_role text, p_axes jsonb, p_source_revision text, p_source_hash text, p_analysis_revision text, p_gold_revision text, p_gold_hash text, p_defects text[], p_evidence_ids text[], p_method text, p_supersedes uuid);
drop function public.content_release_approve(p_qualification uuid, p_scope text, p_note text);
drop function public.content_release_revoke(p_approval uuid, p_reason text);
drop function public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid);
drop function public.factory_order_state_guard();
drop function public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text, p_run_id text, p_qualification uuid, p_request_key uuid);
drop function public.forbid_ledger_mutation();
drop function public.fq_axes_valid(p jsonb);
drop function public.fq_role_ok(p jsonb, p_role text);
drop function public.ledger_writer_guard();
drop function public.supply_artifact_revision(p_kind text, p_ref text);
drop function public.supply_delivery_valid(p_delivery uuid);
drop function public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid);
drop function public.supply_writer_guard();
drop function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid);
drop function public.workspace_demand_record(p_canonical text);
alter table public.learner_workspace drop constraint learner_workspace_id_user_key;
alter table public.csat_map_goal_version drop constraint csat_map_goal_version_id_user_key;
alter table public.learner_workspace_plan drop constraint learner_workspace_plan_ws_ver_user_key;
delete from supabase_migrations.schema_migrations where version = '20261017200000';
commit;
