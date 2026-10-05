-- supabase/migrations/20261005170000_csat_ec_reveal_gate.sql
--
-- Pilot blocker 1 — 결과 · 정답 · 해설의 서버 측 보류(Reveal Gate) ① 객체 · 정책 · RPC (2026-10-05 · 초안 · 미적용)
-- 설계: docs/csat-learner/codebook/REVEAL_GATE_DESIGN.md (V 절이 기준) · 되돌리기: scripts/csat/error-evidence/rollback-reveal-gate.sql
--
-- 이 파일은 앱 변경 없이 적용할 수 있다 — 활성 capture 가 없으면 모든 정책 · 뷰 · RPC 결과가 지금과 같다.
-- 정오 · 점수 컬럼의 학습자 직접 조회 영구 회수는 ② 20261005170100_csat_ec_reveal_gate_revoke.sql(앱의 홈 카드 경로 변경 뒤).
--
-- 바뀌는 것
--   [스키마] csat_ec_private — 보류 판단 함수(정책 · 뷰가 부른다). PostgREST 노출 스키마가 아니다.
--   [표]     csat_ec_capture_session(현재 상태 — 공개 판단의 원천) · csat_ec_capture_tombstone(계정 삭제 뒤에도 남는 활성 보류) · csat_ec_reveal_outbox(파생값 갱신 — 선택)
--   [RPC]    record_session_held(service) · my_capture_state · capture_open · capture_finish(학습자) · capture_close · close_tombstone(관리자) · reveal_state · embargoed_exams · embargoed_items(service)
--   [정책]   csat_item_analyses · csat_item_skeletons · csat_type_reports · csat_dx_session · csat_dx_response · csat_dx_snapshot · csat_session_attempts · csat_trap_attempts 의 학습자 SELECT 에 「보류 아님」
--   [뷰]     csat_items_public.answer — 보류 문항이면 null
--   [권한]   csat_ec_process_evidence · csat_ec_claim 의 item_input_hash(정답 포함 해시 — 후보 대입으로 정답 역산) 학습자 SELECT 영구 회수
--   [RPC 수정] add_student_claim(보류 중 정오 oracle 차단) · blind_queue · round_material · reveal_view(비관리자 판정자 마스킹 · 해시 제외) · pilot_eligible(capture 행이 있으면 completed 만)
--   [트리거] 완료 · 종료 뒤 증거 · 확인 · 범주 보고 쓰기 거부 · 상태 전이 가드 · 활성 보류 묘비
--   [이벤트] csat_ec_capture_closed(+ 목록 preflight). opened · finished 는 전이 RPC 가 같은 트랜잭션에서 기록한다

begin;

-- ═══ 0. preflight — 바꾸려는 정책 · 뷰가 예상한 정의인가 ═══
do $$
declare v text;
begin
  for v in select unnest(array['csat_item_analyses:csat_analyses_read', 'csat_item_skeletons:csat_item_skeletons_read_published', 'csat_type_reports:csat_type_reports_read',
                               'csat_dx_session:csat_dx_session_own_select', 'csat_dx_response:csat_dx_response_own_select', 'csat_dx_snapshot:csat_dx_snapshot_own_select',
                               'csat_session_attempts:csat_session_attempts_own', 'csat_trap_attempts:csat_trap_attempts_own_select', 'csat_review_queue:csat_review_queue_own', 'csat_ec_claim:csat_ec_claim_own_student']) loop
    if not exists (select 1 from pg_policy where polrelid = ('public.' || split_part(v, ':', 1))::regclass and polname = split_part(v, ':', 2)) then
      raise exception 'reveal-gate: 정책 % 가 없다 — 정의를 다시 확인하고 적용한다', v;
    end if;
  end loop;
  if (select count(*) from pg_policy where polrelid in ('public.csat_item_analyses'::regclass, 'public.csat_item_skeletons'::regclass, 'public.csat_type_reports'::regclass,
        'public.csat_dx_session'::regclass, 'public.csat_dx_response'::regclass, 'public.csat_dx_snapshot'::regclass,
        'public.csat_session_attempts'::regclass, 'public.csat_trap_attempts'::regclass, 'public.csat_review_queue'::regclass, 'public.csat_ec_claim'::regclass) and polcmd in ('r', '*')) <> 10 then
    raise exception 'reveal-gate: 학습자 SELECT 정책 수가 예상(10)과 다르다 — 다른 정책이 우회 경로가 될 수 있다';
  end if;
end $$;

-- ═══ 1. 상태 표 ═══
create table public.csat_ec_capture_session (
  session_id        uuid primary key references public.csat_dx_session(id) on delete cascade,
  exam_id           text not null,                       -- 생성 때 봉인(묘비 · 시험 단위 보류의 기준 — 부모 조회 없이)
  item_ids          text[] not null,                     -- 그 세션 응답의 문항 id 전체(봉인)
  taxonomy_version  text not null references public.csat_ec_taxonomy_version(version) on delete restrict,
  config            jsonb not null check (jsonb_typeof(config) = 'object'),   -- 생성 당시 서비스 설정 원문(probe 상한 · 허용 probe 판 · 해시 …)
  targets           smallint[] not null default '{}',    -- 정오 무관 적격 대상(봉인)
  evidence_eligible boolean not null,
  status            text not null default 'held' check (status in ('held', 'collecting', 'completed', 'closed_incomplete')),
  required_at       timestamptz not null default now(),
  opened_at         timestamptz,
  completed_at      timestamptz,
  closed_at         timestamptz,
  closed_reason     text,
  closed_by         uuid,
  seal              jsonb,                               -- 완료 · 종료 때 확인 revision · 대상별 유효 증거 id
  counts            jsonb,                               -- 대상 수 · 해석 상태별 수 · probe 응답 수
  check (taxonomy_version !~ '^v99[.]'),
  check ((status = 'held') or opened_at is not null or status = 'closed_incomplete'),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'closed_incomplete') = (closed_at is not null and coalesce(length(btrim(closed_reason)), 0) > 0)),
  check (status not in ('completed', 'closed_incomplete') or seal is not null),
  check (evidence_eligible or cardinality(targets) = 0)
);
create index csat_ec_capture_active_exam on public.csat_ec_capture_session (exam_id) where status in ('held', 'collecting');

create table public.csat_ec_capture_tombstone (
  id            bigint generated always as identity primary key,
  exam_id       text not null,
  item_ids      text[] not null,
  prior_status  text not null check (prior_status in ('held', 'collecting')),
  deleted_at    timestamptz not null default now(),
  closed_at     timestamptz,
  closed_reason text,
  closed_by     uuid,
  check ((closed_at is null) = (closed_reason is null))
);
create index csat_ec_tombstone_active_exam on public.csat_ec_capture_tombstone (exam_id) where closed_at is null;

create table public.csat_ec_reveal_outbox (
  id         bigint generated always as identity primary key,
  session_id uuid not null references public.csat_dx_session(id) on delete cascade,
  kind       text not null check (kind in ('snapshot')),
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  unique (session_id, kind)
);

do $$
declare t text;
begin
  foreach t in array array['csat_ec_capture_session', 'csat_ec_capture_tombstone', 'csat_ec_reveal_outbox'] loop
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ═══ 2. 보류 판단(비노출 스키마 · 정의자 권한 · 읽기 전용) ═══
create schema csat_ec_private;
revoke all on schema csat_ec_private from public;
grant usage on schema csat_ec_private to anon, authenticated, service_role;

create or replace function csat_ec_private.exam_answer_embargoed(p_exam text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.csat_ec_capture_session c where c.exam_id = p_exam and c.status in ('held', 'collecting'))
      or exists (select 1 from public.csat_ec_capture_tombstone t where t.exam_id = p_exam and t.closed_at is null)
$$;

create or replace function csat_ec_private.any_embargo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.csat_ec_capture_session c where c.status in ('held', 'collecting'))
      or exists (select 1 from public.csat_ec_capture_tombstone t where t.closed_at is null)
$$;

-- 문항 → 시험(보류가 하나도 없으면 문항을 찾지 않는다 — 정책이 행마다 부르므로)
create or replace function csat_ec_private.item_answer_embargoed(p_item text) returns boolean
language sql stable security definer set search_path = '' as $$
  select csat_ec_private.any_embargo()
     and exists (select 1 from public.csat_items i where i.id = p_item and csat_ec_private.exam_answer_embargoed(i.exam_id))
$$;

create or replace function csat_ec_private.type_answer_embargoed(p_type text) returns boolean
language sql stable security definer set search_path = '' as $$
  select csat_ec_private.any_embargo()
     and exists (select 1 from public.csat_items i where i.type_id = p_type and csat_ec_private.exam_answer_embargoed(i.exam_id))
$$;

create or replace function csat_ec_private.user_has_embargoed_session(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select csat_ec_private.any_embargo()
     and exists (select 1 from public.csat_dx_session s where s.user_id = p_user and csat_ec_private.exam_answer_embargoed(s.exam_id))
$$;

-- 세션 → 시험 보류(정의자 권한 — 정책 안 하위 조회가 학습자 RLS 로 평가되면 보류 세션이 안 보여 `not exists` 가 열린다(fail-open))
create or replace function csat_ec_private.session_embargoed(p_session uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select csat_ec_private.any_embargo()
     and exists (select 1 from public.csat_dx_session s where s.id = p_session and csat_ec_private.exam_answer_embargoed(s.exam_id))
$$;

create or replace function csat_ec_private.user_exam_active(p_user uuid, p_exam text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.csat_ec_capture_session c join public.csat_dx_session s on s.id = c.session_id
                  where s.user_id = p_user and c.exam_id = p_exam and c.status in ('held', 'collecting'))
$$;

revoke all on all functions in schema csat_ec_private from public, anon, authenticated, service_role;
-- 정책 · 뷰 평가에 필요한 실행 권한만(이 스키마는 REST · GraphQL 로 노출되지 않는다)
grant execute on function csat_ec_private.exam_answer_embargoed(text), csat_ec_private.any_embargo(), csat_ec_private.item_answer_embargoed(text),
                          csat_ec_private.type_answer_embargoed(text), csat_ec_private.user_has_embargoed_session(uuid),
                          csat_ec_private.session_embargoed(uuid) to anon, authenticated, service_role;
grant execute on function csat_ec_private.user_exam_active(uuid, text) to service_role;

-- ═══ 3. 가드 트리거 ═══
-- 상태 전이: held → collecting → completed, held|collecting → closed_incomplete. 봉인 컬럼 불변 · 끝난 행 불변
create or replace function public.csat_ec_capture_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- 부모 세션 cascade(계정 · 기록 삭제) — 활성 보류는 묘비로 남긴다(학습자 식별자 없이)
    if old.status in ('held', 'collecting') then
      insert into public.csat_ec_capture_tombstone (exam_id, item_ids, prior_status) values (old.exam_id, old.item_ids, old.status);
    end if;
    return old;
  end if;
  if (new.session_id, new.exam_id, new.item_ids, new.taxonomy_version, new.config, new.targets, new.evidence_eligible, new.required_at)
     is distinct from (old.session_id, old.exam_id, old.item_ids, old.taxonomy_version, old.config, old.targets, old.evidence_eligible, old.required_at) then
    raise exception 'csat_ec: capture 의 봉인 값은 바꿀 수 없다';
  end if;
  if old.status in ('completed', 'closed_incomplete') then raise exception 'csat_ec: 끝난 capture 는 바꿀 수 없다'; end if;
  if new.status <> old.status and not ((old.status, new.status) in (('held', 'collecting'), ('collecting', 'completed'), ('held', 'closed_incomplete'), ('collecting', 'closed_incomplete'))) then
    raise exception 'csat_ec: capture 전이 % → % 불가', old.status, new.status;
  end if;
  return new;
end $$;
create trigger csat_ec_capture_guard before update or delete on public.csat_ec_capture_session
  for each row execute function public.csat_ec_capture_guard();

create or replace function public.csat_ec_tombstone_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'csat_ec: 묘비는 지우지 않는다(관리자 종료로 닫는다)'; end if;
  if old.closed_at is not null then raise exception 'csat_ec: 닫힌 묘비는 바꿀 수 없다'; end if;
  if (new.exam_id, new.item_ids, new.prior_status, new.deleted_at) is distinct from (old.exam_id, old.item_ids, old.prior_status, old.deleted_at) then
    raise exception 'csat_ec: 묘비 봉인 값은 바꿀 수 없다';
  end if;
  return new;
end $$;
create trigger csat_ec_tombstone_guard before update or delete on public.csat_ec_capture_tombstone
  for each row execute function public.csat_ec_tombstone_guard();

-- 완료 · 종료 뒤 쓰기 거부(늦게 온 재시도 포함). 세션 행 잠금 순서: finish 는 FOR UPDATE, 증거 · 확인 RPC 는 FOR SHARE/UPDATE — 직렬화된다
create or replace function public.csat_ec_capture_write_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.csat_ec_capture_session c where c.session_id = new.session_id and c.status in ('completed', 'closed_incomplete')) then
    raise exception 'csat_ec: 이 기록의 풀이 수집은 끝났다 — 더 남길 수 없다';
  end if;
  return new;
end $$;
create trigger csat_ec_capture_write_guard before insert on public.csat_ec_process_evidence for each row execute function public.csat_ec_capture_write_guard();
create trigger csat_ec_capture_write_guard before insert on public.csat_ec_session_confirmation for each row execute function public.csat_ec_capture_write_guard();
-- 학생 범주 보고만(완료된 세션의 AI claim 적재 · 판정 파이프라인은 막지 않는다)
create trigger csat_ec_capture_write_guard before insert on public.csat_ec_claim for each row when (new.source = 'student') execute function public.csat_ec_capture_write_guard();

-- 감사 이벤트(상태 전이와 같은 트랜잭션)
create or replace function public.csat_ec_capture_event(p_user uuid, p_event text, p_meta jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.funnel_events (user_id, event, surface, meta) values (p_user, p_event, 'csat_ec', p_meta)
$$;

-- ═══ 4. RPC ═══
-- (서비스) 기록 저장 + 보류 행 생성 — 한 트랜잭션. 참가자이거나 그 학습자의 그 시험에 활성 capture 가 있으면 행을 만든다(설정이 바뀌어도 보류 유지)
create or replace function public.csat_ec_record_session_held(p_session jsonb, p_responses jsonb, p_participant boolean, p_taxonomy text,
                                                              p_config jsonb, p_targets smallint[], p_evidence_eligible boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (p_session->>'user_id')::uuid; v_exam text := p_session->>'exam_id'; v_sid uuid; v_tax public.csat_ec_taxonomy_version;
        v_c public.csat_ec_capture_session;
begin
  if v_user is null or coalesce(v_exam, '') = '' then raise exception 'csat_ec: 학습자 · 시험이 필요하다'; end if;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_exam|' || v_user::text || '|' || v_exam, 0));
  v_sid := public.csat_dx_record_session(p_session, p_responses);
  -- 같은 client_key 의 기존 세션이 돌아왔을 수 있다 — 저장된 세션의 학습자 · 시험 · 답안이 요청과 같아야 한다(봉인은 저장된 값 기준)
  if exists (select 1 from public.csat_dx_session s where s.id = v_sid and (s.user_id <> v_user or s.exam_id is distinct from v_exam))
     or (select count(*) from public.csat_dx_response r where r.session_id = v_sid) <> jsonb_array_length(p_responses)
     or exists (select 1 from jsonb_array_elements(p_responses) x
                 where not exists (select 1 from public.csat_dx_response r where r.session_id = v_sid and r.item_no = (x->>'item_no')::smallint
                                     and r.chosen_option is not distinct from (x->>'chosen_option')::smallint)) then
    raise exception 'csat_ec: 같은 기록 키로 다른 시험 · 답안을 보냈다 — 새 기록으로 다시 저장한다';
  end if;
  select * into v_c from public.csat_ec_capture_session where session_id = v_sid;
  if v_c.session_id is not null then   -- 같은 client_key 재전송 — 같은 행
    return jsonb_build_object('session_id', v_sid, 'held', v_c.status in ('held', 'collecting'), 'status', v_c.status);
  end if;
  if not (coalesce(p_participant, false) or csat_ec_private.user_exam_active(v_user, v_exam)) then
    return jsonb_build_object('session_id', v_sid, 'held', false, 'status', null);
  end if;
  select * into v_tax from public.csat_ec_taxonomy_version where version = p_taxonomy;
  if v_tax.status is distinct from 'sealed' or p_taxonomy ~ '^v99[.]' or coalesce(v_tax.note, '') ~ 'TEST' then
    raise exception 'csat_ec: Pilot taxonomy 가 아니다(봉인 · TEST 아님 필요)';
  end if;
  if exists (select 1 from unnest(coalesce(p_targets, '{}')) t
              where not exists (select 1 from public.csat_dx_response r where r.session_id = v_sid and r.item_no = t)) then
    raise exception 'csat_ec: 대상 문항이 이 기록에 없다';
  end if;
  insert into public.csat_ec_capture_session (session_id, exam_id, item_ids, taxonomy_version, config, targets, evidence_eligible)
  values (v_sid, v_exam,
          coalesce((select array_agg(r.item_id order by r.item_no) from public.csat_dx_response r where r.session_id = v_sid and r.item_id is not null), '{}'),
          p_taxonomy, coalesce(p_config, '{}'), coalesce(p_targets, '{}'), coalesce(p_evidence_eligible, false) and cardinality(coalesce(p_targets, '{}')) > 0);
  return jsonb_build_object('session_id', v_sid, 'held', true, 'status', 'held');
end $$;

-- (학습자) 본인 기록의 수집 상태 · 남은 대상
create or replace function public.csat_ec_my_capture_state(p_session uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('status', c.status, 'taxonomy_version', c.taxonomy_version, 'targets', to_jsonb(c.targets), 'evidence_eligible', c.evidence_eligible,
           'probes', coalesce(c.config->'probes', '[]'), 'probe_cap', c.config->'probe_cap',
           'remaining', coalesce((select jsonb_agg(t order by t) from unnest(c.targets) t
                                   where not exists (select 1 from public.csat_ec_valid_process_evidence(c.session_id, t) e where e.kind = 'interpretation')), '[]'))
    from public.csat_ec_capture_session c join public.csat_dx_session s on s.id = c.session_id
   where c.session_id = p_session and s.user_id = (select auth.uid())
$$;

-- 잠금 순서(생성 · open · finish · close 공통): ① (학습자, 시험) advisory ② 세션 행 FOR UPDATE
create or replace function public.csat_ec_capture_open(p_session uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_s public.csat_dx_session; v_c public.csat_ec_capture_session;
begin
  select * into v_s from public.csat_dx_session where id = p_session and user_id = (select auth.uid());
  if v_s.id is null then raise exception 'csat_ec: 자기 기록만'; end if;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_exam|' || v_s.user_id::text || '|' || v_s.exam_id, 0));
  perform 1 from public.csat_dx_session where id = p_session for update;
  select * into v_c from public.csat_ec_capture_session where session_id = p_session;
  if v_c.session_id is null then raise exception 'csat_ec: 풀이 수집 대상 기록이 아니다'; end if;
  if v_c.status = 'held' then
    update public.csat_ec_capture_session set status = 'collecting', opened_at = now() where session_id = p_session;
    perform public.csat_ec_capture_event(v_s.user_id, 'csat_ec_capture_opened', jsonb_build_object('session', p_session, 'from', 'held', 'to', 'collecting', 'targets', cardinality(v_c.targets)));
    return 'collecting';
  end if;
  return v_c.status;   -- 재시도 · 이미 열림 · 끝남 — 같은 상태
end $$;

create or replace function public.csat_ec_capture_finish(p_session uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_s public.csat_dx_session; v_c public.csat_ec_capture_session; v_hash text; v_conf public.csat_ec_session_confirmation;
        v_remaining smallint[]; v_seal jsonb; v_counts jsonb;
begin
  select * into v_s from public.csat_dx_session where id = p_session and user_id = (select auth.uid());
  if v_s.id is null then raise exception 'csat_ec: 자기 기록만'; end if;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_exam|' || v_s.user_id::text || '|' || v_s.exam_id, 0));
  perform 1 from public.csat_dx_session where id = p_session for update;
  select * into v_c from public.csat_ec_capture_session where session_id = p_session;
  if v_c.session_id is null then raise exception 'csat_ec: 풀이 수집 대상 기록이 아니다'; end if;
  if v_c.status in ('completed', 'closed_incomplete') then
    return jsonb_build_object('status', v_c.status, 'remaining', '[]'::jsonb);   -- 멱등
  end if;
  if v_c.status <> 'collecting' then raise exception 'csat_ec: 수집을 연 뒤에 끝낼 수 있다'; end if;
  if v_c.evidence_eligible then
    select encode(extensions.digest(string_agg(r.item_no::text || ':' || coalesce(r.chosen_option::text, '-'), ',' order by r.item_no), 'sha256'), 'hex')
      into v_hash from public.csat_dx_response r where r.session_id = p_session;
    select * into v_conf from public.csat_ec_session_confirmation where session_id = p_session order by revision desc limit 1;
    if v_conf.revision is null or not (v_conf.took_exam and v_conf.judged_each) or v_conf.answers_hash <> v_hash then
      return jsonb_build_object('status', v_c.status, 'missing', 'confirmation');
    end if;
    select coalesce(array_agg(t order by t), '{}') into v_remaining from unnest(v_c.targets) t
     where not exists (select 1 from public.csat_ec_valid_process_evidence(p_session, t) e where e.kind = 'interpretation');
    if cardinality(v_remaining) > 0 then
      return jsonb_build_object('status', v_c.status, 'missing', 'interpretation', 'remaining', to_jsonb(v_remaining));
    end if;
  end if;
  v_seal := jsonb_build_object('confirmation_revision', v_conf.revision,
              'evidence', coalesce((select jsonb_object_agg(t::text, (select coalesce(jsonb_agg(e.id order by e.id), '[]') from public.csat_ec_valid_process_evidence(p_session, t) e))
                                     from unnest(v_c.targets) t), '{}'));
  v_counts := jsonb_build_object('targets', cardinality(v_c.targets),
              'interpretation', coalesce((select jsonb_object_agg(st, n) from (select coalesce(e.value->>'state', 'answered') st, count(*) n
                                                    from unnest(v_c.targets) t, public.csat_ec_valid_process_evidence(p_session, t) e
                                                   where e.kind = 'interpretation' group by 1) x), '{}'),
              'probes', (select count(*) from public.csat_ec_process_evidence p where p.session_id = p_session and p.kind = 'targeted_probe' and p.supersedes_id is null));
  update public.csat_ec_capture_session set status = 'completed', completed_at = now(), seal = v_seal, counts = v_counts where session_id = p_session;
  insert into public.csat_ec_reveal_outbox (session_id, kind) values (p_session, 'snapshot') on conflict (session_id, kind) do nothing;
  perform public.csat_ec_capture_event(v_s.user_id, 'csat_ec_capture_finished', jsonb_build_object('session', p_session, 'from', 'collecting', 'to', 'completed') || v_counts);
  return jsonb_build_object('status', 'completed', 'remaining', '[]'::jsonb);
end $$;

-- (관리자) (학습자, 시험) 단위 명시적 종료 — 그 학습자의 그 시험 활성 capture 를 모두 한 트랜잭션에서 closed_incomplete
create or replace function public.csat_ec_capture_close(p_user uuid, p_exam text, p_reason text) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int := 0; r record;
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  if coalesce(length(btrim(p_reason)), 0) = 0 then raise exception 'csat_ec: 종료 사유가 필요하다'; end if;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_exam|' || p_user::text || '|' || p_exam, 0));
  for r in select c.session_id, c.status from public.csat_ec_capture_session c join public.csat_dx_session s on s.id = c.session_id
            where s.user_id = p_user and c.exam_id = p_exam and c.status in ('held', 'collecting') order by c.session_id loop
    -- finish 와 같은 잠금 순서 ① (학습자, 시험) advisory ② 세션 행 FOR UPDATE — 증거 · 확인 쓰기(세션 FOR SHARE/UPDATE)와 직렬화
    perform 1 from public.csat_dx_session where id = r.session_id for update;
    if not exists (select 1 from public.csat_ec_capture_session where session_id = r.session_id and status in ('held', 'collecting')) then continue; end if;
    update public.csat_ec_capture_session
       set status = 'closed_incomplete', closed_at = now(), closed_reason = p_reason, closed_by = (select auth.uid()),
           seal = jsonb_build_object('closed', true, 'prior_status', r.status)
     where session_id = r.session_id;
    insert into public.csat_ec_reveal_outbox (session_id, kind) values (r.session_id, 'snapshot') on conflict (session_id, kind) do nothing;
    perform public.csat_ec_capture_event(p_user, 'csat_ec_capture_closed', jsonb_build_object('session', r.session_id, 'from', r.status, 'to', 'closed_incomplete'));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.csat_ec_close_tombstone(p_id bigint, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  if coalesce(length(btrim(p_reason)), 0) = 0 then raise exception 'csat_ec: 종료 사유가 필요하다'; end if;
  update public.csat_ec_capture_tombstone set closed_at = now(), closed_reason = p_reason, closed_by = (select auth.uid()) where id = p_id and closed_at is null;
  if not found then raise exception 'csat_ec: 열린 묘비가 아니다'; end if;
  perform public.csat_ec_capture_event(null, 'csat_ec_capture_closed', jsonb_build_object('tombstone', p_id));
end $$;

-- (서비스) 앱 서버의 단일 gate 가 부르는 래퍼 — 상태 표를 앱이 직접 해석하지 않게
create or replace function public.csat_ec_reveal_state(p_session uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('has_row', c.session_id is not null, 'status', c.status, 'exam_id', s.exam_id, 'user_id', s.user_id,
           'exam_embargoed', csat_ec_private.exam_answer_embargoed(s.exam_id))
    from public.csat_dx_session s left join public.csat_ec_capture_session c on c.session_id = s.id
   where s.id = p_session
$$;
create or replace function public.csat_ec_embargoed_exams(p_exams text[]) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e), '{}') from unnest(p_exams) e where csat_ec_private.exam_answer_embargoed(e)
$$;
create or replace function public.csat_ec_embargoed_items(p_items text[]) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x), '{}') from unnest(p_items) x where csat_ec_private.item_answer_embargoed(x)
$$;

-- ═══ 5. 학습자 SELECT 정책 · 뷰 — 보류 아님 조건 ═══
alter policy csat_analyses_read on public.csat_item_analyses
  using (status = 'published' and not csat_ec_private.item_answer_embargoed(item_id));
alter policy csat_item_skeletons_read_published on public.csat_item_skeletons
  using (exists (select 1 from public.csat_item_analyses a where a.item_id = csat_item_skeletons.item_id and a.status = 'published')
         and not csat_ec_private.item_answer_embargoed(item_id));
alter policy csat_type_reports_read on public.csat_type_reports
  using (status = 'published' and not csat_ec_private.type_answer_embargoed(type_id));
alter policy csat_dx_session_own_select on public.csat_dx_session
  using (user_id = (select auth.uid()) and not csat_ec_private.exam_answer_embargoed(exam_id));
alter policy csat_dx_response_own_select on public.csat_dx_response
  using (exists (select 1 from public.csat_dx_session s where s.id = csat_dx_response.session_id and s.user_id = (select auth.uid())
                  and not csat_ec_private.exam_answer_embargoed(s.exam_id)));
alter policy csat_dx_snapshot_own_select on public.csat_dx_snapshot
  using (user_id = (select auth.uid()) and not csat_ec_private.user_has_embargoed_session(user_id));
-- 연습 기록의 본인 정오(문항 단위) — 보류 문항은 안 보인다(FOR ALL 정책이라 보류 문항의 연습 기록 쓰기도 그동안 막힌다 — 카탈로그가 그 문항을 내주지 않으므로 정상 흐름에서는 생기지 않는다)
alter policy csat_session_attempts_own on public.csat_session_attempts
  using (user_id = (select auth.uid()) and not csat_ec_private.item_answer_embargoed(item_id));
alter policy csat_trap_attempts_own_select on public.csat_trap_attempts
  using ((select auth.uid()) = user_id and not csat_ec_private.item_answer_embargoed(item_id));
-- 학생 범주 보고(claim)는 오답에만 생긴다 — 보류 시험이면 본인 행도 안 보인다
alter policy csat_ec_claim_own_student on public.csat_ec_claim
  using (user_id = (select auth.uid()) and source = 'student' and not csat_ec_private.session_embargoed(session_id));
-- 복습 큐(과거 연습 오답에서 생김 — 들어 있다는 사실이 정오)
alter policy csat_review_queue_own on public.csat_review_queue
  using (user_id = (select auth.uid()) and not csat_ec_private.item_answer_embargoed(item_id));

create or replace view public.csat_items_public as
 select i.id, i.exam_id, i.no, i.section, i.in_scope, i.type_id, i.stem,
        case when csat_ec_private.item_answer_embargoed(i.id) then null else i.answer end as answer,
        i.points, i.high_score, e.organizer, e.grade
   from public.csat_items i join public.csat_exams e on e.id = i.exam_id
  where e.organizer = 'kice' or (e.organizer = 'edu_office' and exists (select 1 from public.csat_item_analyses a where a.item_id = i.id and a.status = 'published'));

-- ═══ 6. 정답 포함 해시 — 학습자 직접 조회 영구 회수(DERIVED_SECRET) ═══
revoke select on public.csat_ec_process_evidence from authenticated;
grant select (id, session_id, item_no, user_id, kind, value, supersedes_id, created_at) on public.csat_ec_process_evidence to authenticated;
revoke select on public.csat_ec_claim from authenticated;
grant select (id, session_id, item_no, user_id, source, ai_run_id, taxonomy_version, code, student_group, role, confidence, evidence, supersedes_id, created_at) on public.csat_ec_claim to authenticated;

-- ═══ 7. 기존 RPC 수정 ═══
-- 정오를 보지 않는다 — 「오답에만」 검사가 성공/실패로 정오를 드러냈다(참가자 capture 행이 빠진 버그에서도 새지 않게 검사 자체를 없앤다).
-- 정답 문항의 범주 보고도 저장되고, 분석은 오답 응답과 join 해서 쓴다. 보류 · 미완료 capture 면 여전히 거부.
create or replace function public.csat_ec_add_student_claim(p_session uuid, p_item_no smallint, p_taxonomy text, p_group text,
                                                            p_code text default null, p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.csat_dx_session s where s.id = p_session and s.user_id = (select auth.uid())
                  and not csat_ec_private.exam_answer_embargoed(s.exam_id)
                  and not exists (select 1 from public.csat_ec_capture_session c where c.session_id = s.id and c.status <> 'completed')) then
    raise exception 'csat_ec: 지금은 이 기록에 남길 수 없다';
  end if;
  if not exists (select 1 from public.csat_dx_session s join public.csat_dx_response r on r.session_id = s.id
                  where s.id = p_session and r.item_no = p_item_no and s.user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 응답에만 남길 수 있다';
  end if;
  if not exists (select 1 from public.csat_ec_taxonomy_version where version = p_taxonomy and status = 'sealed') then
    raise exception 'csat_ec: 봉인된 taxonomy 로만 남긴다';
  end if;
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

-- 판정자 자료 — 비관리자에게는 보류 문항의 정답을 null 로
create or replace function public.csat_ec_blind_queue(p_round bigint)
returns table (session_id uuid, item_no smallint, item_id text, stem text, passage text, choices jsonb, answer jsonb, chosen_option smallint, process_evidence jsonb, my_judged boolean)
language plpgsql stable security definer set search_path = '' as $$
declare v_admin boolean := public.is_admin();
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
         case when not v_admin and csat_ec_private.item_answer_embargoed(r.item_id) then null
              else public.csat_ec_effective_answer(r.session_id, r.item_no) end,
         r.chosen_option,
         coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'value', p.value) order by p.created_at)
                     from jsonb_array_elements_text(coalesce(t->'process_evidence_ids', '[]')) pid
                     join public.csat_ec_process_evidence p on p.id = pid::uuid), '[]'),
         exists (select 1 from public.csat_ec_judgment j where j.round_id = p_round and j.phase = 'blind'
                    and j.session_id = (t->>'session_id')::uuid and j.item_no = (t->>'item_no')::smallint
                    and j.reviewer_key = public.csat_ec_my_key())
    from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t
    join public.csat_dx_response r on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint
    left join public.csat_items i on i.id = r.item_id
   where rr.id = p_round and rr.status = 'blind_review';
end $$;

create or replace function public.csat_ec_round_material(p_round bigint)
returns table (session_id uuid, item_no smallint, item_id text, stem text, passage text, choices jsonb, answer jsonb, chosen_option smallint,
               process_evidence jsonb, student_category jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v public.csat_ec_review_round; v_admin boolean := public.is_admin();
begin
  if not exists (select 1 from public.csat_ec_review_assignment a where a.round_id = p_round and a.reviewer_id = (select auth.uid())) then
    raise exception 'csat_ec: 배정된 회차가 아니다';
  end if;
  select * into v from public.csat_ec_review_round where id = p_round;
  if v.revealed_at is null then raise exception 'csat_ec: 아직 공개 전이다'; end if;
  return query
  select (t->>'session_id')::uuid, (t->>'item_no')::smallint, t->>'item_id', i.stem, i.passage, to_jsonb(i.choices),
         case when not v_admin and csat_ec_private.item_answer_embargoed(r.item_id) then null
              else public.csat_ec_effective_answer(r.session_id, r.item_no) end,
         r.chosen_option,
         coalesce((select jsonb_agg(jsonb_build_object('kind', p.kind, 'value', p.value) order by p.created_at)
                     from jsonb_array_elements_text(coalesce(t->'process_evidence_ids', '[]')) pid
                     join public.csat_ec_process_evidence p on p.id = pid::uuid), '[]'),
         -- 학생 범주 보고는 오답에만 생긴다 — 있다는 사실만으로 정오가 드러나므로 비관리자에게 보류 문항은 빈 목록
         case when not v_admin and csat_ec_private.item_answer_embargoed(r.item_id) then '[]'::jsonb else
         coalesce((select jsonb_agg(jsonb_build_object('group', c.student_group, 'code', c.code))
                     from jsonb_array_elements_text(coalesce(t->'claim_ids', '[]')) cid
                     join public.csat_ec_claim c on c.id = cid::uuid and c.source = 'student'), '[]') end
    from jsonb_array_elements(v.targets) t
    join public.csat_dx_response r on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint
    left join public.csat_items i on i.id = r.item_id;
end $$;

-- 공개 뒤 판정 열람 — 해시는 누구에게도 내보내지 않고(명시 필드), 비관리자에게는 보류 문항의 근거 · 메모를 뺀다
create or replace function public.csat_ec_reveal_view(p_round bigint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.csat_ec_review_round; v_admin boolean := public.is_admin();
begin
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid())) then
    raise exception 'csat_ec: 배정된 회차가 아니다';
  end if;
  select * into v from public.csat_ec_review_round where id = p_round;
  if v.revealed_at is null then raise exception 'csat_ec: 아직 공개 전이다'; end if;
  return jsonb_build_object(
    'judgments', (select coalesce(jsonb_agg(
                    jsonb_build_object('id', j.id, 'round_id', j.round_id, 'session_id', j.session_id, 'item_no', j.item_no, 'reviewer_key', j.reviewer_key,
                      'phase', j.phase, 'taxonomy_version', j.taxonomy_version, 'outcome', j.outcome, 'primary_code', j.primary_code,
                      'contributing_codes', to_jsonb(j.contributing_codes), 'excluded_axes', to_jsonb(j.excluded_axes), 'candidate_codes', to_jsonb(j.candidate_codes),
                      'claim_id', j.claim_id, 'verdict', j.verdict, 'independent', j.independent, 'created_at', j.created_at,
                      'note', case when not v_admin and csat_ec_private.item_answer_embargoed(r.item_id) then null else j.note end)
                    order by j.id), '[]')
                    from public.csat_ec_judgment j join public.csat_dx_response r on r.session_id = j.session_id and r.item_no = j.item_no
                   where j.round_id = p_round
                     and (v_admin or not (csat_ec_private.item_answer_embargoed(r.item_id)
                                          and exists (select 1 from public.csat_ec_claim c where c.id = j.claim_id and c.source = 'student')))),
    'claims', (select coalesce(jsonb_agg(
                 jsonb_build_object('id', c.id, 'session_id', c.session_id, 'item_no', c.item_no, 'source', c.source, 'ai_run_id', c.ai_run_id,
                   'taxonomy_version', c.taxonomy_version, 'code', c.code, 'student_group', c.student_group, 'role', c.role, 'confidence', c.confidence,
                   'supersedes_id', c.supersedes_id, 'created_at', c.created_at,
                   'evidence', case when not v_admin and csat_ec_private.item_answer_embargoed(r.item_id) then null else c.evidence end)), '[]')
                 from jsonb_array_elements(v.targets) t
                 cross join lateral jsonb_array_elements_text(coalesce(t->'claim_ids', '[]')) cid
                 join public.csat_ec_claim c on c.id = cid::uuid
                 join public.csat_dx_response r on r.session_id = c.session_id and r.item_no = c.item_no
                where v_admin or not (c.source = 'student' and csat_ec_private.item_answer_embargoed(r.item_id))));
end $$;

-- Pilot 적격 — capture 행이 있으면 completed 일 때만(closed_incomplete · 진행 중 증거는 판정 · AI 입력에서 빠진다)
create or replace function public.csat_ec_pilot_eligible(p_session uuid, p_item_no smallint) returns boolean
language sql stable set search_path = '' as $$
  select public.csat_ec_record_quality_rq1(p_session) = 'trusted'
     and exists (select 1 from public.csat_dx_session s where s.id = p_session and s.mode in ('live', 'retake'))
     and exists (select 1 from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no
                  and public.csat_ec_effective_answer(p_session, p_item_no) is not null
                  and r.is_correct = (public.csat_ec_effective_answer(p_session, p_item_no) @> to_jsonb(r.chosen_option)))
     and (exists (select 1 from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no and r.is_correct)
          or exists (select 1 from public.csat_ec_valid_process_evidence(p_session, p_item_no) e where e.kind = 'blocked_span'))
     and exists (select 1 from public.csat_dx_response r join public.csat_items i on i.id = r.item_id
                  where r.session_id = p_session and r.item_no = p_item_no and r.chosen_option is not null
                    and coalesce(btrim(i.stem), '') <> '' and i.choices is not null
                    and i.body_ok)
     and coalesce((select c.took_exam and c.judged_each
                          and c.answers_hash = (select encode(extensions.digest(string_agg(r.item_no::text || ':' || coalesce(r.chosen_option::text, '-'), ',' order by r.item_no), 'sha256'), 'hex')
                                                  from public.csat_dx_response r where r.session_id = p_session)
                     from public.csat_ec_session_confirmation c where c.session_id = p_session
                    order by c.revision desc limit 1), false)
     and exists (select 1 from public.csat_ec_valid_process_evidence(p_session, p_item_no) e
                  where e.kind = 'reason' and length(btrim(e.value->>'text')) >= 10)
     and coalesce((select c.status = 'completed' from public.csat_ec_capture_session c where c.session_id = p_session), true)
$$;

-- ═══ 8. 권한 ═══
do $$
declare f text;
begin
  foreach f in array array[
    'csat_ec_capture_guard()', 'csat_ec_tombstone_guard()', 'csat_ec_capture_write_guard()', 'csat_ec_capture_event(uuid,text,jsonb)',
    'csat_ec_record_session_held(jsonb,jsonb,boolean,text,jsonb,smallint[],boolean)', 'csat_ec_my_capture_state(uuid)',
    'csat_ec_capture_open(uuid)', 'csat_ec_capture_finish(uuid)', 'csat_ec_capture_close(uuid,text,text)', 'csat_ec_close_tombstone(bigint,text)',
    'csat_ec_reveal_state(uuid)', 'csat_ec_embargoed_exams(text[])', 'csat_ec_embargoed_items(text[])',
    'csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid)', 'csat_ec_blind_queue(bigint)', 'csat_ec_round_material(bigint)',
    'csat_ec_reveal_view(bigint)', 'csat_ec_pilot_eligible(uuid,smallint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
  end loop;
end $$;
grant execute on function public.csat_ec_record_session_held(jsonb,jsonb,boolean,text,jsonb,smallint[],boolean) to service_role;
grant execute on function public.csat_ec_reveal_state(uuid), public.csat_ec_embargoed_exams(text[]), public.csat_ec_embargoed_items(text[]) to service_role;
grant execute on function public.csat_ec_my_capture_state(uuid), public.csat_ec_capture_open(uuid), public.csat_ec_capture_finish(uuid),
                          public.csat_ec_capture_close(uuid,text,text), public.csat_ec_close_tombstone(bigint,text) to authenticated;
grant execute on function public.csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid), public.csat_ec_blind_queue(bigint),
                          public.csat_ec_round_material(bigint), public.csat_ec_reveal_view(bigint) to authenticated;
-- csat_ec_pilot_eligible 은 이전과 같이 직접 실행 권한 없음(정의자 RPC 안에서만)

-- ═══ 9. 이벤트 허용 목록 + csat_ec_capture_closed(preflight — 기대: 2026-10-05 라이브 67개) ═══
do $$
declare v_def text; v_now text[];
        v_expect text[] := array['teacher_hub_view', 'invite_shared', 'fit_viewed', 'fit_analyzed', 'fit_shared', 'fit_share_opened', 'fit_signup_clicked', 'fit_worksheet_printed', 'fit_level_moved', 'fit_sheet_opened', 'landing_viewed', 'landing_cta_clicked', 'landing_demo_moved', 'landing_section_reached', 'hub_promo_clicked', 'hub_hero_moved', 'catalog_viewed', 'volume_previewed', 'wayfinder_opened', 'wayfinder_cta_clicked', 'screen_viewed', 'video_started', 'video_completed', 'csat_evidence_opened', 'csat_atlas_scoped', 'csat_plan_speed_set', 'csat_plan_ordered', 'csat_drill_answered', 'csat_drill_finished', 'csat_trap_opened', 'csat_overlay_loaded', 'csat_overlay_located', 'csat_overlay_answered', 'csat_overlay_revealed', 'csat_lecture_played', 'csat_lecture_ended', 'csat_session_started', 'csat_session_answered', 'csat_session_explained', 'csat_session_marked', 'csat_session_finished', 'csat_paper_read', 'csat_space_scoped', 'csat_space_opened', 'csat_home_viewed', 'csat_resume_clicked', 'csat_review_started', 'csat_review_done', 'csat_path_chosen', 'csat_item_back', 'csat_workspace_created', 'csat_workspace_opened', 'csat_workspace_session_started', 'csat_workspace_edited', 'csat_workspace_suggestion_applied', 'csat_dx_viewed', 'csat_dx_profile_saved', 'csat_dx_attempt_saved', 'csat_dx_test_submitted', 'csat_dx_habit_answered', 'csat_dx_history_compared', 'csat_map_viewed', 'csat_map_node_opened', 'csat_map_goal_set', 'csat_map_task_toggled', 'csat_ec_capture_opened', 'csat_ec_capture_finished']::text[];
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'funnel_events_event_check' and conrelid = 'public.funnel_events'::regclass;
  if v_def is null then raise exception 'funnel_events_event_check 가 없다'; end if;
  select coalesce(array_agg(m[1] order by m[1]), '{}') into v_now from regexp_matches(v_def, '''([a-z_]+)''', 'g') m;
  if (select array_agg(x order by x) from unnest(v_now) x where x <> 'csat_ec_capture_closed') is distinct from (select array_agg(x order by x) from unnest(v_expect) x) then
    raise exception '이벤트 허용 목록이 기대와 다르다 — 지금 % 개 · 기대 % 개. 다른 작업의 이벤트를 지우지 않도록 멈춘다', cardinality(v_now), cardinality(v_expect);
  end if;
  execute 'alter table public.funnel_events drop constraint funnel_events_event_check';
  execute format('alter table public.funnel_events add constraint funnel_events_event_check check (event = any (%L::text[]))', v_expect || array['csat_ec_capture_closed']);
end $$;

commit;
