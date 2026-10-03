-- supabase/migrations/_pending_csat_error_evidence.rollback.sql
--
-- _pending_csat_error_evidence.sql 되돌리기. **적용하지 않는다.**
-- 되돌릴 수 있는 조건: 새 테이블이 모두 비어 있을 때(아래 첫 블록이 확인한다). 행이 있으면 멈춘다 —
-- 그때 되돌리기는 데이터 손실(DROP)이라 사용자 확인이 따로 필요하다(AGENTS.md 「항상 사용자 확인」).
-- 기존 테이블에 건 것은 csat_dx_response 의 트리거 하나뿐이다 — 그것만 지우면 기존 동작은 그대로다.

begin;

do $$
declare n bigint; t text;
begin
  foreach t in array array['csat_ec_judgment','csat_ec_review_assignment','csat_ec_review_round','csat_ec_claim','csat_ec_ai_run',
                           'csat_ec_process_evidence','csat_ec_session_confirmation','csat_ec_code','csat_ec_taxonomy_version'] loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then raise exception 'rollback 중단: % 에 % 행이 있다 — 데이터 손실 확인 필요', t, n; end if;
  end loop;
end $$;

drop trigger if exists csat_ec_cancel_rounds_on_response_delete on public.csat_dx_response;

drop function if exists public.csat_ec_ai_import(jsonb, jsonb);
drop function if exists public.csat_ec_ai_export(uuid, smallint);
drop function if exists public.csat_ec_ai_taxonomy(text);
drop function if exists public.csat_ec_taxonomy_seal(text);
drop function if exists public.csat_ec_submit_adjudication(bigint, uuid, smallint, text, text, text[], text[], text);
drop function if exists public.csat_ec_round_advance(bigint, text, text);
drop function if exists public.csat_ec_submit_verify(bigint, uuid, text, text);
drop function if exists public.csat_ec_reveal_view(bigint);
drop function if exists public.csat_ec_round_material(bigint);
drop function if exists public.csat_ec_round_reveal(bigint);
drop function if exists public.csat_ec_submit_blind(bigint, uuid, smallint, text, text, text[], text[], text);
drop function if exists public.csat_ec_blind_queue(bigint);
drop function if exists public.csat_ec_round_start_blind(bigint);
drop function if exists public.csat_ec_round_assign(bigint, uuid, text, text[]);
drop function if exists public.csat_ec_round_set_targets(bigint, jsonb);
drop function if exists public.csat_ec_round_create(text, text, text, jsonb);
drop function if exists public.csat_ec_add_student_claim(uuid, smallint, text, text, text, uuid);
drop function if exists public.csat_ec_add_process_evidence(uuid, smallint, text, jsonb, uuid);
drop function if exists public.csat_ec_confirm_session(uuid, boolean, boolean);
drop function if exists public.csat_ec_my_key();
drop function if exists public.csat_ec_item_input_hash(uuid, smallint);
drop function if exists public.csat_ec_effective_answer(uuid, smallint);
drop function if exists public.csat_ec_round_inputs_intact(bigint, uuid, smallint);
drop function if exists public.csat_ec_pilot_eligible(uuid, smallint);
drop function if exists public.csat_ec_judgment_input_hash(uuid, smallint);
drop function if exists public.csat_ec_valid_process_evidence(uuid, smallint);
drop function if exists public.csat_ec_record_quality_rq1(uuid);

drop table if exists public.csat_ec_judgment;
drop table if exists public.csat_ec_review_assignment;
drop table if exists public.csat_ec_review_round;
drop table if exists public.csat_ec_claim;
drop table if exists public.csat_ec_ai_run;
drop table if exists public.csat_ec_process_evidence;
drop table if exists public.csat_ec_session_confirmation;
drop table if exists public.csat_ec_code;
drop table if exists public.csat_ec_taxonomy_version;

drop function if exists public.csat_ec_supersede_guard();
drop function if exists public.csat_ec_cancel_rounds_on_response_delete();
drop function if exists public.csat_ec_cancel_rounds_on_confirmation();
drop function if exists public.csat_ec_judgment_insert_guard();
drop function if exists public.csat_ec_assignment_insert_guard();
drop function if exists public.csat_ec_round_guard();
drop function if exists public.csat_ec_code_guard();
drop function if exists public.csat_ec_taxonomy_guard();
drop function if exists public.csat_ec_only_reviewer_null();
drop function if exists public.csat_ec_forbid_update();

commit;
