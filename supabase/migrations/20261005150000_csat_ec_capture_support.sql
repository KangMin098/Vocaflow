-- supabase/migrations/20261005150000_csat_ec_capture_support.sql
--
-- 오답 원인 Pilot — 학생 증거 수집 화면을 위한 작은 확장(2026-10-05 사용자 결정 · 초안 · 승인 후 적용). 표 · 컬럼 추가 없음.
-- 계획: .agent-plan.md(학생 증거 수집 UI) · 설계: docs/csat-learner/codebook/PILOT_DATA_MODEL.md
-- 되돌리기: scripts/csat/error-evidence/rollback-capture.sql
--
-- 1. interpretation 상태 — answered(글 1–500자) · unknown(「잘 모르겠어요」) · skipped(질문 건너뜀). state 없는 옛 형식 {text} 은 answered.
-- 2. 재시도 멱등(같은 잠금 안에서 원자적으로)
--    · csat_ec_confirm_session — 최신 확인이 같은 응답 해시 · 같은 답이면 새 revision 을 만들지 않고 그 revision 을 돌려준다
--      (새 revision 은 열린 회차를 취소하는 트리거가 있다 — 네트워크 재시도로 회차가 취소되지 않게).
--    · csat_ec_add_process_evidence — 정정(supersedes)이 아니고 같은 kind · 같은 value(jsonb 의미 비교)의 유효 행이 있으면 그 id.
-- 3. csat_ec_add_probe_response — 세션 잠금 안에서 세션 probe 누계(건너뜀 포함)를 서비스 설정의 상한과 비교하고 저장.
--    상한 값은 호출자(서비스)가 넘긴다 — DB 상수 없음. 같은 attempt · probe 의 첫 응답이 있으면 그 행을 돌려준다.
-- 4. funnel_events 허용 목록 + csat_ec_capture_opened · csat_ec_capture_finished (AGENTS D2 — 목록은 2026-10-05 라이브 제약에서 옮겼다).

begin;

-- ═══ 1. interpretation 상태 ═══
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'csat_ec_process_interpretation_check' and conrelid = 'public.csat_ec_process_evidence'::regclass) then
    raise exception 'csat_ec_process_interpretation_check 가 없다 — Pilot 모델(20261005130000) 먼저';
  end if;
end $$;
alter table public.csat_ec_process_evidence drop constraint csat_ec_process_interpretation_check;
alter table public.csat_ec_process_evidence add constraint csat_ec_process_interpretation_check
  check (kind <> 'interpretation' or coalesce(
    case coalesce(value->>'state', 'answered')
      when 'answered' then jsonb_typeof(value->'text') = 'string' and length(btrim(value->>'text')) between 1 and 500
      when 'unknown'  then value->'text' is null
      when 'skipped'  then value->'text' is null
      else false
    end
    and (value->'state' is null or jsonb_typeof(value->'state') = 'string'), false));

-- ═══ 2. 재시도 멱등 ═══
create or replace function public.csat_ec_confirm_session(p_session uuid, p_took_exam boolean, p_judged_each boolean)
returns int language plpgsql security definer set search_path = '' as $$
declare v_rev int; v_hash text; v_last public.csat_ec_session_confirmation;
begin
  if not exists (select 1 from public.csat_dx_session where id = p_session and user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 기록만 확인할 수 있다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for update;     -- 같은 세션 동시 확인 직렬화
  select encode(extensions.digest(string_agg(r.item_no::text || ':' || coalesce(r.chosen_option::text, '-'), ',' order by r.item_no), 'sha256'), 'hex')
    into v_hash from public.csat_dx_response r where r.session_id = p_session;
  -- 같은 답안 · 같은 확인이면 새 revision 을 만들지 않는다(재시도 · 중복 클릭 — 열린 회차 취소를 일으키지 않게)
  select * into v_last from public.csat_ec_session_confirmation where session_id = p_session order by revision desc limit 1;
  if v_last.revision is not null and v_last.answers_hash = v_hash and v_last.took_exam = p_took_exam and v_last.judged_each = p_judged_each then
    return v_last.revision;
  end if;
  select coalesce(max(revision), 0) + 1 into v_rev from public.csat_ec_session_confirmation where session_id = p_session;
  insert into public.csat_ec_session_confirmation (session_id, revision, user_id, took_exam, judged_each, answers_hash)
  values (p_session, v_rev, (select auth.uid()), p_took_exam, p_judged_each, v_hash);
  return v_rev;
end $$;

-- 본문은 20261005130000 과 같고, insert 직전에 같은 값 유효 행 반환만 더했다
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
  -- 재시도 멱등 — 정정이 아니고 같은 종류 · 같은 값의 유효 행(지금 문항 입력 · 정정되지 않음)이 있으면 그 행
  if p_supersedes is null then
    select p.id into v_id from public.csat_ec_process_evidence p
     where p.session_id = p_session and p.item_no = p_item_no and p.kind = p_kind and p.value = p_value
       and p.item_input_hash = public.csat_ec_item_input_hash(p_session, p_item_no)
       and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id)
     order by p.created_at, p.id limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.csat_ec_process_evidence (session_id, item_no, user_id, kind, value, item_input_hash, supersedes_id)
  values (p_session, p_item_no, (select auth.uid()), p_kind, p_value, public.csat_ec_item_input_hash(p_session, p_item_no), p_supersedes)
  returning id into v_id;
  return v_id;
end $$;

-- ═══ 3. probe 응답 — 세션 상한(서비스 설정값) ═══
create or replace function public.csat_ec_add_probe_response(p_session uuid, p_item_no smallint, p_value jsonb, p_session_cap int default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_n int;
begin
  if not exists (select 1 from public.csat_dx_session where id = p_session and user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 기록에만 남길 수 있다';
  end if;
  if p_session_cap is not null and p_session_cap < 0 then raise exception 'csat_ec: 상한은 0 이상'; end if;
  -- 세션 단위 잠금 — 서로 다른 문항의 동시 제출이 같은 누계를 읽지 않게
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_probe_session|' || p_session::text, 0));
  -- 같은 attempt · probe 의 첫 응답이 이미 있으면 그 행(재시도 · 중복 제출)
  select p.id into v_id from public.csat_ec_process_evidence p
   where p.session_id = p_session and p.item_no = p_item_no and p.kind = 'targeted_probe'
     and p.value->>'probe_key' = p_value->>'probe_key' and p.supersedes_id is null
   order by p.created_at, p.id limit 1;
  if v_id is not null then return v_id; end if;
  if p_session_cap is not null then
    select count(*) into v_n from public.csat_ec_process_evidence p
     where p.session_id = p_session and p.kind = 'targeted_probe' and p.supersedes_id is null;
    if v_n >= p_session_cap then raise exception 'csat_ec: 이 기록의 추가 질문 상한에 닿았다'; end if;
  end if;
  return public.csat_ec_add_process_evidence(p_session, p_item_no, 'targeted_probe', p_value, null);
end $$;

revoke all on function public.csat_ec_confirm_session(uuid,boolean,boolean) from public, anon, authenticated, service_role;
revoke all on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) from public, anon, authenticated, service_role;
revoke all on function public.csat_ec_add_probe_response(uuid,smallint,jsonb,int) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_confirm_session(uuid,boolean,boolean) to authenticated;
grant execute on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) to authenticated;
grant execute on function public.csat_ec_add_probe_response(uuid,smallint,jsonb,int) to authenticated;

-- ═══ 4. 이벤트 허용 목록 ═══
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
        'csat_map_viewed', 'csat_map_node_opened', 'csat_map_goal_set', 'csat_map_task_toggled',
        'csat_ec_capture_opened', 'csat_ec_capture_finished'
      ]::text[]
    )
  );

commit;
