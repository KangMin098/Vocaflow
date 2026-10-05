-- scripts/csat/error-evidence/rollback-capture.sql
--
-- 20261005150000_csat_ec_capture_support.sql 되돌리기. 생성: scratchpad gen-rollback-capture.cjs(함수 원문은 이전 마이그레이션에서 그대로 뽑음).
-- unknown · skipped interpretation 행, 이벤트 2종 행이 있으면 멈춘다(데이터를 지우는 결정은 rollback 이 하지 않는다).
-- 검증: scripts/csat/error-evidence/isolated-pg/rollback-capture.mjs

begin;

do $$
begin
  if exists (select 1 from public.csat_ec_process_evidence where kind = 'interpretation' and coalesce(value->>'state', 'answered') <> 'answered')
     or exists (select 1 from public.funnel_events where event in ('csat_ec_capture_opened', 'csat_ec_capture_finished')) then
    raise exception 'rollback-capture: 새 상태 · 이벤트 행이 있다 — 정리 여부를 먼저 정한다';
  end if;
end $$;

alter table public.csat_ec_process_evidence drop constraint csat_ec_process_interpretation_check;
alter table public.csat_ec_process_evidence add constraint csat_ec_process_interpretation_check
  check (kind <> 'interpretation' or coalesce(jsonb_typeof(value->'text') = 'string' and length(btrim(value->>'text')) between 1 and 500, false));

create or replace function public.csat_ec_confirm_session(p_session uuid, p_took_exam boolean, p_judged_each boolean)
returns int language plpgsql security definer set search_path = '' as $$
declare v_rev int; v_hash text;
begin
  if not exists (select 1 from public.csat_dx_session where id = p_session and user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 기록만 확인할 수 있다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for update;     -- 같은 세션 동시 확인 직렬화
  -- 응답 해시는 서버가 계산한다(클라이언트 값을 믿지 않는다) — 문항 번호순 「번호:선택」 연결의 sha256
  select encode(extensions.digest(string_agg(r.item_no::text || ':' || coalesce(r.chosen_option::text, '-'), ',' order by r.item_no), 'sha256'), 'hex')
    into v_hash from public.csat_dx_response r where r.session_id = p_session;
  select coalesce(max(revision), 0) + 1 into v_rev from public.csat_ec_session_confirmation where session_id = p_session;
  insert into public.csat_ec_session_confirmation (session_id, revision, user_id, took_exam, judged_each, answers_hash)
  values (p_session, v_rev, (select auth.uid()), p_took_exam, p_judged_each, v_hash);
  return v_rev;
end $$;

create or replace function public.csat_ec_add_process_evidence(p_session uuid, p_item_no smallint, p_kind text, p_value jsonb,
                                                               p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_b public.csat_ec_boundary;
begin
  if not exists (select 1 from public.csat_dx_session s join public.csat_dx_response r on r.session_id = s.id
                  where s.id = p_session and r.item_no = p_item_no and s.user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 응답에만 남길 수 있다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for share;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || p_session::text || '|' || p_item_no::text, 0));
  if exists (select 1 from public.csat_ec_review_round r
              where r.status in ('blind_review', 'reveal', 'adjudication')
                and r.targets @> jsonb_build_array(jsonb_build_object('session_id', p_session, 'item_no', p_item_no))) then
    raise exception 'csat_ec: 검수 중인 문항이라 바꿀 수 없다';
  end if;
  if p_kind = 'blocked_span' then
    if p_value->>'item_id' is distinct from (select r.item_id from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no) then
      raise exception 'csat_ec: 표시한 위치가 이 응답의 문항이 아니다';
    end if;
    if not exists (
        select 1 from public.csat_items i
         where i.id = p_value->>'item_id'
           and length(coalesce(case p_value->>'part' when 'passage' then i.passage when 'stem' then i.stem
                                     else i.choices->>(((p_value->>'option')::int) - 1) end, '')) > 0
           and (p_value->>'end')::int <=
                length(case p_value->>'part' when 'passage' then i.passage when 'stem' then i.stem
                            else i.choices->>(((p_value->>'option')::int) - 1) end)) then
      raise exception 'csat_ec: 표시한 위치가 문항 원문 범위 밖이다';
    end if;
  end if;
  if p_kind = 'targeted_probe' then
    -- 경계 · probe 가 봉인된 사전에 정의돼 있고(미해결 경계), 이 attempt 에서 그 경계가 관찰돼 probe 를 요구했을 때만
    -- (질문을 받지 않은 attempt 에 probe 응답이 생기지 않게 — 「질문 없음」과 「건너뜀」 구분)
    select b.* into v_b from public.csat_ec_boundary b join public.csat_ec_taxonomy_version t on t.version = b.version and t.status = 'sealed'
     where b.version = p_value->>'taxonomy_version' and b.boundary_key = p_value->>'boundary_key';
    if v_b.boundary_key is null or v_b.status <> 'provisional' or v_b.probe_key is distinct from p_value->>'probe_key' then
      raise exception 'csat_ec: 사전에 정의된 미해결 경계의 probe 가 아니다';
    end if;
    if not exists (select 1 from public.csat_ec_boundary_signal s
                    where s.session_id = p_session and s.item_no = p_item_no and s.taxonomy_version = v_b.version
                      and s.boundary_key = v_b.boundary_key and s.probe_required) then
      raise exception 'csat_ec: 이 응답에 요구된 probe 가 아니다';
    end if;
  end if;
  insert into public.csat_ec_process_evidence (session_id, item_no, user_id, kind, value, item_input_hash, supersedes_id)
  values (p_session, p_item_no, (select auth.uid()), p_kind, p_value, public.csat_ec_item_input_hash(p_session, p_item_no), p_supersedes)
  returning id into v_id;
  return v_id;
end $$;

drop function public.csat_ec_add_probe_response(uuid,smallint,jsonb,int);
drop function public.csat_ec_my_process_evidence(uuid);

revoke all on function public.csat_ec_confirm_session(uuid,boolean,boolean) from public, anon, authenticated, service_role;
revoke all on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_confirm_session(uuid,boolean,boolean) to authenticated;
grant execute on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) to authenticated;

alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events
  add constraint funnel_events_event_check check (
    event = any (
      array[
        'teacher_hub_view', 'invite_shared',
        'fit_viewed', 'fit_analyzed', 'fit_shared', 'fit_share_opened', 'fit_signup_clicked',
        'fit_worksheet_printed', 'fit_level_moved', 'fit_sheet_opened',
        'landing_viewed', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached',
        'hub_promo_clicked', 'hub_hero_moved', 'catalog_viewed', 'volume_previewed',
        'wayfinder_opened', 'wayfinder_cta_clicked', 'screen_viewed', 'video_started', 'video_completed',
        'csat_evidence_opened', 'csat_atlas_scoped', 'csat_plan_speed_set', 'csat_plan_ordered',
        'csat_drill_answered', 'csat_drill_finished', 'csat_trap_opened',
        'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_answered', 'csat_overlay_revealed',
        'csat_lecture_played', 'csat_lecture_ended',
        'csat_session_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_marked',
        'csat_session_finished', 'csat_paper_read', 'csat_space_scoped', 'csat_space_opened',
        'csat_home_viewed', 'csat_resume_clicked', 'csat_review_started', 'csat_review_done',
        'csat_path_chosen', 'csat_item_back',
        'csat_workspace_created', 'csat_workspace_opened', 'csat_workspace_session_started', 'csat_workspace_edited',
        'csat_workspace_suggestion_applied',
        'csat_dx_viewed', 'csat_dx_profile_saved', 'csat_dx_attempt_saved', 'csat_dx_test_submitted',
        'csat_dx_habit_answered', 'csat_dx_history_compared',
        'csat_map_viewed', 'csat_map_node_opened', 'csat_map_goal_set', 'csat_map_task_toggled'
      ]::text[]
    )
  );

commit;
