-- scripts/csat/error-evidence/rollback-reveal-gate.sql
--
-- Reveal Gate 되돌리기. 생성: scratchpad gen-rollback-reveal.cjs(원래 함수는 20261003230000 원문 그대로).
-- ② 회수(20261005170100)를 먼저 되돌리고 ①을 되돌린다. capture · 묘비 · outbox 행, 종료 이벤트가 하나라도 있으면 멈춘다
-- (데이터를 지우는 결정은 rollback 이 하지 않는다 — 활성 보류가 있는데 되돌리면 그 시험이 바로 공개된다).
-- 검증: scripts/csat/error-evidence/isolated-pg/rollback-reveal.mjs

begin;

do $$
begin
  if exists (select 1 from public.csat_ec_capture_session) or exists (select 1 from public.csat_ec_capture_tombstone)
     or exists (select 1 from public.csat_ec_reveal_outbox) or exists (select 1 from public.funnel_events where event = 'csat_ec_capture_closed') then
    raise exception 'rollback-reveal-gate: capture · 묘비 · outbox · 종료 이벤트 행이 있다 — 정리 여부를 먼저 정한다';
  end if;
end $$;

-- ② 회수 되돌리기(적용돼 있지 않아도 안전 — 표 단위 GRANT 를 다시 준다)
-- 컬럼 단위로 준 SELECT 를 먼저 거둔다(표 단위 GRANT 를 다시 줘도 컬럼 ACL 은 남는다 — pg_attribute.attacl)
revoke select (id, user_id, exam_id, mode, taken_at, total_minutes, entered_by, client_key, created_at) on public.csat_dx_session from authenticated;
revoke select (session_id, item_no, item_id, chosen_option, confidence) on public.csat_dx_response from authenticated;
grant select on public.csat_dx_session to authenticated;
grant select on public.csat_dx_response to authenticated;
grant select on public.csat_dx_snapshot to authenticated;
grant all on public.csat_learner_state to authenticated;

-- ① 정책 원래 조건
alter policy csat_analyses_read on public.csat_item_analyses using (status = 'published');
alter policy csat_item_skeletons_read_published on public.csat_item_skeletons
  using (exists (select 1 from public.csat_item_analyses a where a.item_id = csat_item_skeletons.item_id and a.status = 'published'));
alter policy csat_type_reports_read on public.csat_type_reports using (status = 'published');
alter policy csat_dx_session_own_select on public.csat_dx_session using (user_id = (select auth.uid()));
alter policy csat_dx_response_own_select on public.csat_dx_response
  using (exists (select 1 from public.csat_dx_session s where s.id = csat_dx_response.session_id and s.user_id = (select auth.uid())));
alter policy csat_dx_snapshot_own_select on public.csat_dx_snapshot using (user_id = (select auth.uid()));
alter policy csat_session_attempts_own on public.csat_session_attempts using (user_id = (select auth.uid()));
alter policy csat_trap_attempts_own_select on public.csat_trap_attempts using ((select auth.uid()) = user_id);
alter policy csat_review_queue_own on public.csat_review_queue using (user_id = (select auth.uid()));
alter policy csat_ec_claim_own_student on public.csat_ec_claim using (((user_id = ( SELECT auth.uid() AS uid)) AND (source = 'student'::text)));

-- 공개 뷰 원래 정의
create or replace view public.csat_items_public as
 select i.id, i.exam_id, i.no, i.section, i.in_scope, i.type_id, i.stem, i.answer, i.points, i.high_score, e.organizer, e.grade
   from public.csat_items i join public.csat_exams e on e.id = i.exam_id
  where e.organizer = 'kice' or (e.organizer = 'edu_office' and exists (select 1 from public.csat_item_analyses a where a.item_id = i.id and a.status = 'published'));

-- 해시 컬럼 권한 원래대로 — 컬럼 단위 GRANT 를 거두고 표 단위로
revoke select (id, session_id, item_no, user_id, kind, value, supersedes_id, created_at) on public.csat_ec_process_evidence from authenticated;
revoke select (id, session_id, item_no, user_id, source, ai_run_id, taxonomy_version, code, student_group, role, confidence, evidence, supersedes_id, created_at) on public.csat_ec_claim from authenticated;
grant select on public.csat_ec_process_evidence to authenticated;
grant select on public.csat_ec_claim to authenticated;

-- 원래 함수 본문
create or replace function public.csat_ec_add_student_claim(p_session uuid, p_item_no smallint, p_taxonomy text, p_group text,
                                                            p_code text default null, p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.csat_dx_session s join public.csat_dx_response r on r.session_id = s.id
                  where s.id = p_session and r.item_no = p_item_no and s.user_id = (select auth.uid()) and r.is_correct = false) then
    raise exception 'csat_ec: 자기 오답에만 남길 수 있다';
  end if;
  if not exists (select 1 from public.csat_ec_taxonomy_version where version = p_taxonomy and status = 'sealed') then
    raise exception 'csat_ec: 봉인된 taxonomy 로만 남긴다';
  end if;
  -- 세부 코드를 고르면 그 코드의 학생 범주와 같아야 한다 · 「잘 모르겠음」에는 코드가 없다 · B(행동)는 학생이 고르지 않는다
  if p_code is not null and (p_group = 'unsure' or not exists (
       select 1 from public.csat_ec_code c where c.version = p_taxonomy and c.code = p_code and c.status = 'active'
          and c.student_group = p_group and c.axis <> 'B')) then
    raise exception 'csat_ec: 고른 범주와 세부 원인이 맞지 않는다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for share;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || p_session::text || '|' || p_item_no::text, 0));
  if exists (select 1 from public.csat_ec_review_round r
              where r.status in ('blind_review', 'reveal', 'adjudication')
                and r.targets @> jsonb_build_array(jsonb_build_object('session_id', p_session, 'item_no', p_item_no))) then
    raise exception 'csat_ec: 검수 중인 문항이라 바꿀 수 없다';
  end if;
  insert into public.csat_ec_claim (session_id, item_no, user_id, source, taxonomy_version, code, student_group, role, supersedes_id, item_input_hash)
  values (p_session, p_item_no, (select auth.uid()), 'student', p_taxonomy, p_code, p_group, 'primary', p_supersedes,
          public.csat_ec_item_input_hash(p_session, p_item_no))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.csat_ec_blind_queue(p_round bigint)
returns table (session_id uuid, item_no smallint, item_id text, stem text, passage text, choices jsonb, answer jsonb, chosen_option smallint, process_evidence jsonb, my_judged boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid()) and a.slot in ('A', 'B')) then
    raise exception 'csat_ec: 배정된 회차가 아니다';
  end if;
  if not public.csat_ec_round_inputs_intact(p_round) then
    raise exception 'csat_ec: 봉인 뒤 입력이 바뀐 회차다 — 판정 자료를 내주지 않는다(회차 취소 대상)';
  end if;
  return query
  select (t->>'session_id')::uuid, (t->>'item_no')::smallint, t->>'item_id', i.stem, i.passage, to_jsonb(i.choices),
         public.csat_ec_effective_answer(r.session_id, r.item_no),
         r.chosen_option,
         coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'value', p.value) order by p.created_at)
                     from jsonb_array_elements_text(coalesce(t->'process_evidence_ids', '[]')) pid
                     join public.csat_ec_process_evidence p on p.id = pid::uuid), '[]'),   -- 봉인된 증거만(범주 보고는 애초에 제외)
         exists (select 1 from public.csat_ec_judgment j where j.round_id = p_round and j.phase = 'blind'
                    and j.session_id = (t->>'session_id')::uuid and j.item_no = (t->>'item_no')::smallint
                    and j.reviewer_key = public.csat_ec_my_key())
    from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t
    join public.csat_dx_response r on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint
    left join public.csat_items i on i.id = r.item_id   -- 판정에 필요한 문항 원문 · 정답(배정된 판정자에게만, 이 함수 안에서)
   where rr.id = p_round and rr.status = 'blind_review';
end $$;

create or replace function public.csat_ec_round_material(p_round bigint)
returns table (session_id uuid, item_no smallint, item_id text, stem text, passage text, choices jsonb, answer jsonb, chosen_option smallint,
               process_evidence jsonb, student_category jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v public.csat_ec_review_round;
begin
  if not exists (select 1 from public.csat_ec_review_assignment a where a.round_id = p_round and a.reviewer_id = (select auth.uid())) then
    raise exception 'csat_ec: 배정된 회차가 아니다';
  end if;
  select * into v from public.csat_ec_review_round where id = p_round;
  if v.revealed_at is null then raise exception 'csat_ec: 아직 공개 전이다'; end if;
  return query
  select (t->>'session_id')::uuid, (t->>'item_no')::smallint, t->>'item_id', i.stem, i.passage, to_jsonb(i.choices),
         public.csat_ec_effective_answer(r.session_id, r.item_no), r.chosen_option,
         coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'value', p.value) order by p.created_at)
                     from jsonb_array_elements_text(coalesce(t->'process_evidence_ids', '[]')) pid
                     join public.csat_ec_process_evidence p on p.id = pid::uuid), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object('group', c.student_group, 'code', c.code))
                     from jsonb_array_elements_text(coalesce(t->'claim_ids', '[]')) cid
                     join public.csat_ec_claim c on c.id = cid::uuid and c.source = 'student'), '[]')
    from jsonb_array_elements(v.targets) t
    join public.csat_dx_response r on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint
    left join public.csat_items i on i.id = r.item_id;
end $$;

create or replace function public.csat_ec_reveal_view(p_round bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.csat_ec_review_round;
begin
  -- 관리자도 배정 없이는 못 본다 — 공개 열람 이력 = 배정 이력이라 독립성 판정이 배정만으로 정확하다
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid())) then
    raise exception 'csat_ec: 배정된 회차가 아니다';
  end if;
  select * into v from public.csat_ec_review_round where id = p_round;
  -- 공개된 적이 있으면(공개 뒤 취소된 회차 포함 — 감사용) 배정자가 본다. 공개 전에는 누구도 못 본다
  if v.revealed_at is null then raise exception 'csat_ec: 아직 공개 전이다'; end if;
  return jsonb_build_object(
    'judgments', (select coalesce(jsonb_agg(to_jsonb(j) order by j.id), '[]') from public.csat_ec_judgment j where j.round_id = p_round),
    'claims', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from jsonb_array_elements(v.targets) t
                cross join lateral jsonb_array_elements_text(coalesce(t->'claim_ids', '[]')) cid
                join public.csat_ec_claim c on c.id = cid::uuid));   -- 회차에 봉인된 claim 만
end $$;

create or replace function public.csat_ec_pilot_eligible(p_session uuid, p_item_no smallint) returns boolean
language sql stable set search_path = '' as $$
  select public.csat_ec_record_quality_rq1(p_session) = 'trusted'
     and exists (select 1 from public.csat_dx_session s where s.id = p_session and s.mode in ('live', 'retake'))   -- 시험 1회분만(진단 테스트 · 앱 기록 제외)
     -- 저장된 정오가 지금 유효 정답과 같아야 한다(정답 변경 뒤면 보류)
     and exists (select 1 from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no
                  and public.csat_ec_effective_answer(p_session, p_item_no) is not null
                  and r.is_correct = (public.csat_ec_effective_answer(p_session, p_item_no) @> to_jsonb(r.chosen_option)))
     -- 막힌 곳 표시: 오답은 필수, 정답 대조군은 선택(막힘 없이 맞힌 풀이를 빼지 않게)
     and (exists (select 1 from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no and r.is_correct)
          or exists (select 1 from public.csat_ec_valid_process_evidence(p_session, p_item_no) e where e.kind = 'blocked_span'))
     and exists (select 1 from public.csat_dx_response r join public.csat_items i on i.id = r.item_id
                  where r.session_id = p_session and r.item_no = p_item_no and r.chosen_option is not null
                    and coalesce(btrim(i.stem), '') <> '' and i.choices is not null
                    and i.body_ok)   -- 기존 본문 완전성 판정(body_ok) — 거짓인 문항(실측 380개)은 Pilot 에서 뺀다   -- 실제로 고른 답 · 원문 있는 문항(듣기 · 무응답 제외)
     and coalesce((select c.took_exam and c.judged_each
                          and c.answers_hash = (select encode(extensions.digest(string_agg(r.item_no::text || ':' || coalesce(r.chosen_option::text, '-'), ',' order by r.item_no), 'sha256'), 'hex')
                                                  from public.csat_dx_response r where r.session_id = p_session)
                     from public.csat_ec_session_confirmation c where c.session_id = p_session
                    order by c.revision desc limit 1), false)
     and exists (select 1 from public.csat_ec_valid_process_evidence(p_session, p_item_no) e
                  where e.kind = 'reason' and length(btrim(e.value->>'text')) >= 10)   -- 「고른 이유」 한 문장 이상
$$;

-- 새 트리거 · 함수 · 표 · 스키마
drop trigger csat_ec_capture_write_guard on public.csat_ec_process_evidence;
drop trigger csat_ec_capture_write_guard on public.csat_ec_session_confirmation;
drop trigger csat_ec_capture_write_guard on public.csat_ec_claim;
drop function public.csat_ec_capture_write_guard();
drop function public.csat_ec_record_session_held(jsonb,jsonb,boolean,text,jsonb,smallint[],boolean);
drop function public.csat_ec_my_capture_state(uuid);
drop function public.csat_ec_capture_open(uuid);
drop function public.csat_ec_capture_finish(uuid);
drop function public.csat_ec_capture_close(uuid,text,text);
drop function public.csat_ec_close_tombstone(bigint,text);
drop function public.csat_ec_reveal_state(uuid);
drop function public.csat_ec_embargoed_exams(text[]);
drop function public.csat_ec_embargoed_items(text[]);
drop function public.csat_ec_capture_event(uuid,text,jsonb);
drop table public.csat_ec_reveal_outbox;
drop table public.csat_ec_capture_session;
drop function public.csat_ec_capture_guard();
drop table public.csat_ec_capture_tombstone;
drop function public.csat_ec_tombstone_guard();
drop schema csat_ec_private cascade;

-- 권한(원래 마이그레이션과 같게)
do $$
declare f text;
begin
  foreach f in array array['csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid)', 'csat_ec_blind_queue(bigint)', 'csat_ec_round_material(bigint)', 'csat_ec_reveal_view(bigint)', 'csat_ec_pilot_eligible(uuid,smallint)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
  end loop;
end $$;
grant execute on function public.csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid), public.csat_ec_blind_queue(bigint),
                          public.csat_ec_round_material(bigint), public.csat_ec_reveal_view(bigint) to authenticated;

-- 이벤트 목록(종료 이벤트 제거)
alter table public.funnel_events drop constraint funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check check (event = any (array['teacher_hub_view', 'invite_shared', 'fit_viewed', 'fit_analyzed', 'fit_shared', 'fit_share_opened', 'fit_signup_clicked', 'fit_worksheet_printed', 'fit_level_moved', 'fit_sheet_opened', 'landing_viewed', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached', 'hub_promo_clicked', 'hub_hero_moved', 'catalog_viewed', 'volume_previewed', 'wayfinder_opened', 'wayfinder_cta_clicked', 'screen_viewed', 'video_started', 'video_completed', 'csat_evidence_opened', 'csat_atlas_scoped', 'csat_plan_speed_set', 'csat_plan_ordered', 'csat_drill_answered', 'csat_drill_finished', 'csat_trap_opened', 'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_answered', 'csat_overlay_revealed', 'csat_lecture_played', 'csat_lecture_ended', 'csat_session_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_marked', 'csat_session_finished', 'csat_paper_read', 'csat_space_scoped', 'csat_space_opened', 'csat_home_viewed', 'csat_resume_clicked', 'csat_review_started', 'csat_review_done', 'csat_path_chosen', 'csat_item_back', 'csat_workspace_created', 'csat_workspace_opened', 'csat_workspace_session_started', 'csat_workspace_edited', 'csat_workspace_suggestion_applied', 'csat_dx_viewed', 'csat_dx_profile_saved', 'csat_dx_attempt_saved', 'csat_dx_test_submitted', 'csat_dx_habit_answered', 'csat_dx_history_compared', 'csat_map_viewed', 'csat_map_node_opened', 'csat_map_goal_set', 'csat_map_task_toggled', 'csat_ec_capture_opened', 'csat_ec_capture_finished']::text[]));

commit;
