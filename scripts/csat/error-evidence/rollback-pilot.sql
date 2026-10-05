-- scripts/csat/error-evidence/rollback-pilot.sql
--
-- 20261005130000_csat_ec_pilot_evidence.sql 되돌리기. 생성: scratchpad gen-rollback-pilot.cjs(원래 마이그레이션 20261003230000 에서 함수 원문을 그대로 뽑음 — 손으로 옮기지 않는다).
-- 새 값을 쓰는 행(새 outcome · 후보 · candidate claim · interpretation · targeted_probe · 경계 · 경계 관찰 · pre_probe 회차)이 하나라도 있으면 멈춘다 —
-- 데이터를 지우는 결정은 rollback 이 하지 않는다(사람이 먼저 정리 여부를 정한다).
-- 검증: scripts/csat/error-evidence/isolated-pg/rollback-pilot.mjs(적용 → rollback → 적용 전 스키마와 완전 비교).

begin;

do $$
begin
  if exists (select 1 from public.csat_ec_judgment where outcome in ('multiple_plausible', 'inconsistent_evidence') or candidate_codes <> '{}')
     or exists (select 1 from public.csat_ec_ai_run where outcome in ('multiple_plausible', 'inconsistent_evidence'))
     or exists (select 1 from public.csat_ec_claim where role = 'candidate')
     or exists (select 1 from public.csat_ec_process_evidence where kind in ('interpretation', 'targeted_probe'))
     or exists (select 1 from public.csat_ec_boundary)
     or exists (select 1 from public.csat_ec_boundary_signal)
     or exists (select 1 from public.csat_ec_review_round where evidence_profile <> 'all') then
    raise exception 'rollback-pilot: Pilot 모델을 쓰는 행이 있다 — 정리 여부를 먼저 정한다(이 스크립트는 데이터를 지우지 않는다)';
  end if;
end $$;

-- 1. 원래 함수 본문 복원(오버로드는 아래에서 지운다)
create or replace function public.csat_ec_round_inputs_intact(p_round bigint, p_session uuid default null, p_item_no smallint default null)
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select 1 from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t
     where rr.id = p_round
       and (p_session is null or ((t->>'session_id')::uuid = p_session and (t->>'item_no')::smallint = p_item_no))
       and (not public.csat_ec_pilot_eligible((t->>'session_id')::uuid, (t->>'item_no')::smallint)
            or t->>'input_hash' is distinct from public.csat_ec_judgment_input_hash((t->>'session_id')::uuid, (t->>'item_no')::smallint)
            or (t->>'confirmation_revision')::int is distinct from
               (select max(c.revision) from public.csat_ec_session_confirmation c where c.session_id = (t->>'session_id')::uuid)))
$$;

create or replace function public.csat_ec_round_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  rank_old int := array_position(array['draft','blind_review','reveal','adjudication','closed'], old.status);
  rank_new int := array_position(array['draft','blind_review','reveal','adjudication','closed'], new.status);
begin
  if tg_op = 'DELETE' then raise exception 'csat_ec: 검수 회차는 지우지 않는다(취소한다)'; end if;
  -- 만든 관리자 계정 삭제(ON DELETE SET NULL)는 어느 상태에서든 통과 — 막으면 계정 삭제가 실패한다
  if new.created_by is null and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then return new; end if;
  if old.status in ('closed', 'cancelled') then raise exception 'csat_ec: 끝난 회차 % 는 바꿀 수 없다', old.id; end if;
  if new.status <> 'cancelled' and (rank_new is null or rank_new < rank_old or rank_new > rank_old + 1) then
    raise exception 'csat_ec: 회차 상태 전이 % → % 불가', old.status, new.status;
  end if;
  if old.status <> 'draft' and (
       new.taxonomy_version <> old.taxonomy_version or new.quality_rule_version <> old.quality_rule_version
    or new.choice_trap_map <> old.choice_trap_map or new.eligibility <> old.eligibility
    or new.targets <> old.targets or new.targets_hash is distinct from old.targets_hash) then
    raise exception 'csat_ec: blind 시작 뒤 회차 입력은 봉인돼 있다';
  end if;
  return new;
end $$;

create or replace function public.csat_ec_judgment_insert_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_round public.csat_ec_review_round;
begin
  select * into v_round from public.csat_ec_review_round where id = new.round_id for share;
  if new.taxonomy_version <> v_round.taxonomy_version then raise exception 'csat_ec: 판정 taxonomy 가 회차와 다르다'; end if;
  if not (v_round.targets @> jsonb_build_array(jsonb_build_object('session_id', new.session_id, 'item_no', new.item_no))) then
    raise exception 'csat_ec: 회차 대상이 아닌 응답이다';
  end if;
  if (new.phase = 'blind' and v_round.status <> 'blind_review')
     or (new.phase = 'verify' and v_round.status <> 'reveal')
     or (new.phase = 'adjudication' and v_round.status <> 'adjudication') then
    raise exception 'csat_ec: 회차 상태 % 에서 % 판정을 받을 수 없다', v_round.status, new.phase;
  end if;
  -- 폐기된(deprecated) 코드로 새 판정 금지(과거 판정의 참조는 유지)
  if exists (select 1 from unnest(array_remove(array[new.primary_code], null) || new.contributing_codes) x
              where not exists (select 1 from public.csat_ec_code c where c.version = new.taxonomy_version and c.code = x and c.status = 'active')) then
    raise exception 'csat_ec: 사전에 없거나 폐기된 코드로 판정할 수 없다';
  end if;
  -- 원인 축과 배제 축의 모순 금지 · 원인을 고르지 않은 판정(no_cause · insufficient_evidence · no_fitting_code)은 배제 축을 두지 않는다
  if new.phase in ('blind', 'adjudication') then
    if new.outcome <> 'code' and cardinality(new.excluded_axes) > 0 then
      raise exception 'csat_ec: 원인을 고르지 않은 판정에는 배제 축을 둘 수 없다';
    end if;
    if exists (select 1 from unnest(array_remove(array[new.primary_code], null) || new.contributing_codes) x
                where left(x, 1) = any (new.excluded_axes)) then
      raise exception 'csat_ec: 고른 원인의 축을 배제할 수 없다';
    end if;
  end if;
  -- 보조 원인: 회차 버전 사전에 있는 코드 · 중복 없음 · 최대 2개
  if cardinality(new.contributing_codes) > 2
     or cardinality(new.contributing_codes) <> (select count(distinct x) from unnest(new.contributing_codes) x)
     or exists (select 1 from unnest(new.contributing_codes) x
                 where not exists (select 1 from public.csat_ec_code c where c.version = new.taxonomy_version and c.code = x)) then
    raise exception 'csat_ec: 보조 원인 코드가 사전에 없거나 중복 · 초과다';
  end if;
  if new.phase = 'adjudication' and not exists (
       select 1 from public.csat_ec_review_assignment a
        where a.round_id = new.round_id and a.reviewer_key = new.reviewer_key and a.slot = 'adjudicator') then
    raise exception 'csat_ec: 합의 판정은 adjudicator 만';
  end if;
  return new;
end $$;

create or replace function public.csat_ec_add_process_evidence(p_session uuid, p_item_no smallint, p_kind text, p_value jsonb,
                                                               p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.csat_dx_session s join public.csat_dx_response r on r.session_id = s.id
                  where s.id = p_session and r.item_no = p_item_no and s.user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 응답에만 남길 수 있다';
  end if;
  -- 세션 공유 잠금(blind 시작 FOR UPDATE 와 직렬화) + 응답 단위 배타 잠금(AI 적재 · 다른 증거 작성과 직렬화)
  perform 1 from public.csat_dx_session where id = p_session for share;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || p_session::text || '|' || p_item_no::text, 0));
  -- 검수 중(열린 회차의 대상)이면 정정 불가 — 새 증거 추가도 막는다(blind 입력이 바뀌지 않게)
  if exists (select 1 from public.csat_ec_review_round r
              where r.status in ('blind_review', 'reveal', 'adjudication')
                and r.targets @> jsonb_build_array(jsonb_build_object('session_id', p_session, 'item_no', p_item_no))) then
    raise exception 'csat_ec: 검수 중인 문항이라 바꿀 수 없다';
  end if;
  if p_kind = 'blocked_span' then
    if p_value->>'item_id' is distinct from (select r.item_id from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no) then
      raise exception 'csat_ec: 표시한 위치가 이 응답의 문항이 아니다';
    end if;
    -- 표시한 부분(지문 · 발문 · 선지 n)의 실제 글이 있어야 하고, 문자 범위는 그 글 길이 안이어야 한다
    -- (문장 번호는 앱의 문장 분할 기준이라 DB 는 범위만 본다 — 앱이 문장 번호 ↔ 문자 범위를 함께 보낸다)
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
  insert into public.csat_ec_process_evidence (session_id, item_no, user_id, kind, value, item_input_hash, supersedes_id)
  values (p_session, p_item_no, (select auth.uid()), p_kind, p_value, public.csat_ec_item_input_hash(p_session, p_item_no), p_supersedes)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.csat_ec_round_set_targets(p_round bigint, p_refs jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v public.csat_ec_review_round; v_targets jsonb;
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  if jsonb_typeof(p_refs) is distinct from 'array' then raise exception 'csat_ec: 대상은 배열'; end if;
  -- 잠금 순서: 세션 → 회차
  perform 1 from public.csat_dx_session s
   where s.id in (select (x->>'session_id')::uuid from jsonb_array_elements(p_refs) x) order by s.id for share;
  select * into v from public.csat_ec_review_round where id = p_round for update;
  if v.id is null then raise exception 'csat_ec: 없는 회차'; end if;
  if v.status <> 'draft' then raise exception 'csat_ec: draft 회차만 대상을 바꾼다'; end if;
  if exists (select 1 from public.csat_ec_review_assignment a join public.csat_dx_session s on s.user_id = a.reviewer_id
              where a.round_id = p_round and s.id in (select (x->>'session_id')::uuid from jsonb_array_elements(p_refs) x)) then
    raise exception 'csat_ec: 판정자의 자기 응답이 대상에 있다';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'session_id', r.session_id, 'item_no', r.item_no, 'item_id', r.item_id,
           'input_hash', public.csat_ec_judgment_input_hash(r.session_id, r.item_no),
           'confirmation_revision', (select max(c.revision) from public.csat_ec_session_confirmation c where c.session_id = r.session_id),
           'process_evidence_ids', coalesce((select jsonb_agg(e.id order by e.id) from public.csat_ec_valid_process_evidence(r.session_id, r.item_no) e), '[]'),
           'quality', public.csat_ec_record_quality_rq1_signals(r.session_id),   -- 당시 신호 전부(rq-2 가 나와도 「왜 포함됐나」 재현)
           'ai_run_id', ar.id,
           'claim_ids', coalesce((select jsonb_agg(c.id order by c.id) from public.csat_ec_claim c
                                   where c.session_id = r.session_id and c.item_no = r.item_no and c.taxonomy_version = v.taxonomy_version
                                     and ((c.source = 'student' and c.item_input_hash = public.csat_ec_item_input_hash(r.session_id, r.item_no)
                                           and not exists (select 1 from public.csat_ec_claim s2 where s2.supersedes_id = c.id))
                                          or (ar.id is not null and c.ai_run_id = ar.id))), '[]')
         ) order by r.session_id, r.item_no), '[]')
    into v_targets
    from (select distinct (x->>'session_id')::uuid as sid, (x->>'item_no')::smallint as no from jsonb_array_elements(p_refs) x) ref
    join public.csat_dx_response r on r.session_id = ref.sid and r.item_no = ref.no
    left join lateral (
      select a.id from public.csat_ec_ai_run a
       where a.round_id = v.id and a.session_id = r.session_id and a.item_no = r.item_no and a.taxonomy_version = v.taxonomy_version
         and a.outcome <> 'failed' and a.quality_rule_version = v.quality_rule_version and a.choice_trap_map = v.choice_trap_map
         and a.input_hash = public.csat_ec_judgment_input_hash(r.session_id, r.item_no)
       order by a.id desc limit 1) ar on true;
  if jsonb_array_length(v_targets) <> (select count(distinct ((x->>'session_id'), (x->>'item_no'))) from jsonb_array_elements(p_refs) x) then
    raise exception 'csat_ec: 없는 응답이 대상에 있다';
  end if;
  update public.csat_ec_review_round set targets = v_targets where id = p_round;
  return jsonb_array_length(v_targets);
end $$;

create or replace function public.csat_ec_round_start_blind(p_round bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.csat_ec_review_round; v_hash text; v_locked uuid[];
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  -- 잠금 순서는 모든 경로에서 「세션 → 회차」(세션 삭제 → 응답 삭제 트리거 → 회차 갱신과 같은 순서 — 교착 방지)
  select coalesce(array_agg(s.id order by s.id), '{}') into v_locked from (
    select s.id from public.csat_dx_session s
     where s.id in (select (t->>'session_id')::uuid from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t where rr.id = p_round)
     order by s.id for update) s;
  select * into v from public.csat_ec_review_round where id = p_round for update;
  if v.status <> 'draft' then raise exception 'csat_ec: draft 회차만 시작한다'; end if;
  -- 회차를 잠근 뒤 대상 세션 집합이 잠근 집합과 같은지 다시 본다 — 그 사이 대상이 바뀌었으면 새 세션은 잠기지 않았으므로 거부(다시 시도)
  if v_locked is distinct from (select coalesce(array_agg(distinct (t->>'session_id')::uuid order by (t->>'session_id')::uuid), '{}')
                                  from jsonb_array_elements(v.targets) t) then
    raise exception 'csat_ec: 시작하는 동안 대상이 바뀌었다 — 다시 시도한다';
  end if;
  -- 판정자는 대상 응답의 학생이 아니어야 한다 — 배정 뒤 대상을 바꾼 경우까지 시작 시점에 다시 검사
  if exists (select 1 from public.csat_ec_review_assignment a join public.csat_dx_session s on s.user_id = a.reviewer_id
              where a.round_id = p_round and s.id = any (v_locked)) then
    raise exception 'csat_ec: 판정자의 자기 응답이 대상에 있다';
  end if;
  if (select count(*) from public.csat_ec_review_assignment a join auth.users u on u.id = a.reviewer_id
       where a.round_id = p_round and a.slot in ('A', 'B', 'adjudicator')) <> 3 then
    raise exception 'csat_ec: 판정자 A · B · adjudicator 가 모두 유효한 계정으로 배정돼야 한다';
  end if;
  if jsonb_array_length(v.targets) = 0 then raise exception 'csat_ec: 대상이 없다'; end if;
  if v.quality_rule_version <> 'rq-1' then raise exception 'csat_ec: 이 DB 가 아는 품질 규칙은 rq-1 뿐이다'; end if;
  if not public.csat_ec_choice_trap_map_approved(v.choice_trap_map) then raise exception 'csat_ec: 승인된 선지 함정 대응표가 아니다'; end if;
  if exists (select 1 from jsonb_array_elements(v.targets) t
              where not exists (select 1 from public.csat_dx_response r
                                 where r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint)) then
    raise exception 'csat_ec: 사라진 대상이 있다 — 회차를 다시 만든다';
  end if;
  -- Pilot 적격: 입력 품질 trusted · 학습자 확인(응시 · 선지별 판단, 지금 답안과 같음) · 유효 과정 증거(reason) — 하나라도 없으면 시작하지 않는다
  if exists (select 1 from jsonb_array_elements(v.targets) t
              where not public.csat_ec_pilot_eligible((t->>'session_id')::uuid, (t->>'item_no')::smallint)) then
    raise exception 'csat_ec: Pilot 적격(품질 · 학습자 확인 · 과정 증거) 못 갖춘 대상이 있다';
  end if;
  -- 대상 중복 금지 — 같은 응답을 두 번 넣어 표본 수를 채우지 못하게
  if (select count(*) from jsonb_array_elements(v.targets)) <>
     (select count(distinct ((t->>'session_id'), (t->>'item_no'))) from jsonb_array_elements(v.targets) t) then
    raise exception 'csat_ec: 같은 응답이 대상에 두 번 있다';
  end if;
  -- 표본 구성 — 사용자 승인값(학습자 3명+ · 오답 30~50 · 정답 대조 10~20)은 DB 상수로 고정한다. eligibility 로 바꿀 수 없다(바꾸려면 별도 승인 + 이 함수 개정)
  if (select count(distinct s.user_id) from jsonb_array_elements(v.targets) t join public.csat_dx_session s on s.id = (t->>'session_id')::uuid) < 3
     or (select count(*) from jsonb_array_elements(v.targets) t join public.csat_dx_response r
           on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint where not r.is_correct) not between 30 and 50
     or (select count(*) from jsonb_array_elements(v.targets) t join public.csat_dx_response r
           on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint where r.is_correct) not between 10 and 20 then
    raise exception 'csat_ec: 표본 구성(학습자 3+ · 오답 30~50 · 정답 대조 10~20)을 채우지 못한다';
  end if;
  -- 봉인할 학습자 확인 revision 은 지금 최신과 같아야 한다
  if exists (select 1 from jsonb_array_elements(v.targets) t
              where (t->>'confirmation_revision')::int is distinct from
                    (select max(c.revision) from public.csat_ec_session_confirmation c where c.session_id = (t->>'session_id')::uuid)) then
    raise exception 'csat_ec: 봉인할 학습자 확인 revision 이 최신이 아니다';
  end if;
  -- 봉인할 과정 증거 id 는 지금 유효한 집합과 정확히 같아야 한다(blind 큐 · AI 입력이 이 집합만 쓴다)
  if exists (select 1 from jsonb_array_elements(v.targets) t
              where coalesce((select jsonb_agg(e.id order by e.id) from public.csat_ec_valid_process_evidence((t->>'session_id')::uuid, (t->>'item_no')::smallint) e), '[]')
                    <> coalesce((select jsonb_agg(x order by x) from jsonb_array_elements(t->'process_evidence_ids') x), '[]')) then
    raise exception 'csat_ec: 봉인할 과정 증거 목록이 지금 유효한 증거와 다르다';
  end if;
  -- 연결 검증: item_id · input_hash 가 지금 값과 같고, ai_run · claim 이 그 응답 · 그 taxonomy 의 것이며, 정정된(superseded) claim 이 아니다
  if exists (select 1 from jsonb_array_elements(v.targets) t
              join public.csat_dx_response r on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint
             where r.item_id is distinct from t->>'item_id'
                or t->>'input_hash' is distinct from public.csat_ec_judgment_input_hash(r.session_id, r.item_no)
                or (t->>'ai_run_id' is not null and not exists (
                      select 1 from public.csat_ec_ai_run a where a.id = (t->>'ai_run_id')::bigint and a.round_id = v.id and a.session_id = r.session_id
                         and a.item_no = r.item_no and a.taxonomy_version = v.taxonomy_version and a.outcome <> 'failed'
                         and a.input_hash = public.csat_ec_judgment_input_hash(r.session_id, r.item_no)
                         and a.quality_rule_version = v.quality_rule_version and a.choice_trap_map = v.choice_trap_map))
                or exists (select 1 from jsonb_array_elements_text(coalesce(t->'claim_ids', '[]')) cid
                            where not exists (select 1 from public.csat_ec_claim c where c.id = cid::uuid and c.session_id = r.session_id
                                                 and c.item_no = r.item_no and c.taxonomy_version = v.taxonomy_version
                                                 and ((c.source = 'student' and c.item_input_hash = public.csat_ec_item_input_hash(r.session_id, r.item_no))
                                                      or c.ai_run_id = (t->>'ai_run_id')::bigint))
                               or exists (select 1 from public.csat_ec_claim s2 where s2.supersedes_id = cid::uuid))) then
    raise exception 'csat_ec: 대상의 문항 · 입력 해시 · AI 실행 · claim 연결이 맞지 않는다';
  end if;
  -- targets_hash 는 서버가 계산한다(jsonb 정규 텍스트 — 키 순서가 정해져 있다)
  v_hash := encode(extensions.digest(v.targets::text, 'sha256'), 'hex');
  update public.csat_ec_review_round set status = 'blind_review', targets_hash = v_hash, blind_started_at = now() where id = p_round;
  return v_hash;
end $$;

create or replace function public.csat_ec_submit_blind(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text,
                                                       p_primary text, p_contributing text[], p_excluded text[], p_note text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_round public.csat_ec_review_round; v_key text := public.csat_ec_my_key(); v_item text; v_id bigint; v_indep boolean;
begin
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid()) and a.slot in ('A', 'B')) then
    raise exception 'csat_ec: 배정된 판정자가 아니다';
  end if;
  -- 잠금 순서 「세션 → 회차」(기록 삭제 경로와 같음 — 교착 방지). 회차 공유 잠금은 reveal(FOR UPDATE)과 직렬화한다
  perform 1 from public.csat_dx_session where id = p_session for share;
  select * into v_round from public.csat_ec_review_round where id = p_round for share;
  if v_round.status <> 'blind_review' then raise exception 'csat_ec: blind 단계가 아니다'; end if;
  select t->>'item_id' into v_item from jsonb_array_elements(v_round.targets) t
   where (t->>'session_id')::uuid = p_session and (t->>'item_no')::smallint = p_item_no;
  if not public.csat_ec_round_inputs_intact(p_round, p_session, p_item_no) then
    raise exception 'csat_ec: 봉인 뒤 입력이 바뀌었다 — 회차를 취소하고 다시 만든다';
  end if;
  -- 판정자 × 문항 잠금 — 다른 회차의 공개(같은 잠금)와 직렬화해 독립성 판정이 원자적이다
  perform pg_advisory_xact_lock(hashtextextended(v_key || '|' || v_item, 0));
  -- 독립성: 제출 시점에 같은 문항을 이 판정자가 이미 본 적(공개된 다른 회차 · DB 밖 신고)이 있으면 false
  v_indep := not exists (
      select 1 from public.csat_ec_review_round o join public.csat_ec_review_assignment a on a.round_id = o.id
       where o.id <> p_round and o.revealed_at is not null and a.reviewer_key = v_key
         and o.targets @> jsonb_build_array(jsonb_build_object('item_id', v_item)))
    and not exists (select 1 from public.csat_ec_review_assignment a   -- DB 밖 공개 신고는 모든 회차(취소 · 미공개 포함)에 걸쳐 누적
                     where a.reviewer_key = v_key and v_item = any (a.pre_disclosed_items));
  insert into public.csat_ec_judgment (round_id, session_id, item_no, reviewer_key, phase, taxonomy_version, outcome,
                                       primary_code, contributing_codes, excluded_axes, independent, note)
  values (p_round, p_session, p_item_no, v_key, 'blind', v_round.taxonomy_version, p_outcome,
          p_primary, coalesce(p_contributing, '{}'), coalesce(p_excluded, '{}'), v_indep, p_note)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.csat_ec_submit_adjudication(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text,
                                                              p_primary text, p_contributing text[], p_excluded text[], p_note text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_round public.csat_ec_review_round; v_id bigint;
begin
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid()) and a.slot = 'adjudicator') then
    raise exception 'csat_ec: 배정된 adjudicator 가 아니다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for share;   -- 세션 → 회차(교착 방지)
  select * into v_round from public.csat_ec_review_round where id = p_round for share;
  if not public.csat_ec_round_inputs_intact(p_round, p_session, p_item_no) then
    raise exception 'csat_ec: 봉인 뒤 입력이 바뀌었다 — 회차를 취소하고 다시 만든다';
  end if;
  insert into public.csat_ec_judgment (round_id, session_id, item_no, reviewer_key, phase, taxonomy_version, outcome, primary_code, contributing_codes, excluded_axes, note)
  values (p_round, p_session, p_item_no, public.csat_ec_my_key(), 'adjudication', v_round.taxonomy_version, p_outcome, p_primary, coalesce(p_contributing, '{}'), coalesce(p_excluded, '{}'), p_note)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.csat_ec_round_advance(p_round bigint, p_to text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  perform 1 from public.csat_ec_review_round where id = p_round for update;
  if p_to = 'adjudication' then
    -- 봉인된 claim 마다 A · B 의 verify 가 모두 있어야 합의 단계로 간다(뒤에서는 verify 를 받지 않으므로)
    if exists (
        select 1 from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t,
                      jsonb_array_elements_text(coalesce(t->'claim_ids', '[]')) cid, public.csat_ec_review_assignment a
         where rr.id = p_round and a.round_id = p_round and a.slot in ('A', 'B')
           and not exists (select 1 from public.csat_ec_judgment j where j.round_id = p_round and j.phase = 'verify'
                             and j.claim_id = cid::uuid and j.reviewer_key = a.reviewer_key)) then
      raise exception 'csat_ec: 봉인된 claim 에 A · B verify 가 모두 있어야 합의 단계로 간다';
    end if;
    update public.csat_ec_review_round set status = 'adjudication', adjudication_at = now() where id = p_round;
  elsif p_to = 'closed' then
    -- 닫으려면 모든 대상이 「A · B blind 완전 일치(outcome · primary · 보조 원인 · 배제 축)」 또는 「합의 판정 있음」이어야 한다
    if exists (
        select 1 from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t
         where rr.id = p_round
           and not exists (select 1 from public.csat_ec_judgment j where j.round_id = p_round and j.phase = 'adjudication'
                             and j.session_id = (t->>'session_id')::uuid and j.item_no = (t->>'item_no')::smallint)
           and (select count(distinct (j.outcome, j.primary_code,
                                       (select array_agg(x order by x) from unnest(j.contributing_codes) x),
                                       (select array_agg(x order by x) from unnest(j.excluded_axes) x))) from public.csat_ec_judgment j
                 where j.round_id = p_round and j.phase = 'blind'
                   and j.session_id = (t->>'session_id')::uuid and j.item_no = (t->>'item_no')::smallint) <> 1) then
      raise exception 'csat_ec: 불일치 대상에 합의 판정이 없어 닫을 수 없다';
    end if;
    if not public.csat_ec_round_inputs_intact(p_round) then
      raise exception 'csat_ec: 봉인 뒤 입력이 바뀌었다 — 닫지 않고 취소한다';
    end if;
    update public.csat_ec_review_round set status = 'closed', closed_at = now() where id = p_round;
  elsif p_to = 'cancelled' then
    update public.csat_ec_review_round set status = 'cancelled', cancelled_at = now(), cancel_reason = coalesce(p_reason, 'admin') where id = p_round;
  else
    raise exception 'csat_ec: 이 RPC 로 갈 수 없는 상태 %', p_to;
  end if;
end $$;

create or replace function public.csat_ec_taxonomy_seal(p_version text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  perform 1 from public.csat_ec_taxonomy_version where version = p_version and status = 'draft' for update;
  if not found then raise exception 'csat_ec: draft 버전만 봉인한다'; end if;
  select encode(extensions.digest(coalesce(string_agg(to_jsonb(c)::text, chr(10) order by c.code), ''), 'sha256'), 'hex')
    into v_hash from public.csat_ec_code c where c.version = p_version;
  if v_hash is null or not exists (select 1 from public.csat_ec_code where version = p_version) then raise exception 'csat_ec: 코드가 없는 버전'; end if;
  update public.csat_ec_taxonomy_version set status = 'sealed', sealed_at = now(), definitions_hash = v_hash where version = p_version;
  return v_hash;
end $$;

create or replace function public.csat_ec_ai_taxonomy(p_version text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', v.version, 'definitions_hash', v.definitions_hash,
           'codes', (select jsonb_agg(jsonb_build_object('code', c.code, 'axis', c.axis, 'label', c.label, 'definition', c.definition,
                                                          'inclusion', c.inclusion, 'exclusion', c.exclusion, 'status', c.status) order by c.code)
                       from public.csat_ec_code c where c.version = v.version and c.axis in ('V', 'S', 'R', 'E') and c.status = 'active'))
    from public.csat_ec_taxonomy_version v where v.version = p_version and v.status = 'sealed'
$$;

create or replace function public.csat_ec_ai_export(p_round bigint, p_session uuid, p_item_no smallint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.csat_ec_review_round;
begin
  select * into v from public.csat_ec_review_round where id = p_round;
  if v.id is null or v.status <> 'draft' then raise exception 'csat_ec: AI 판정은 draft 회차의 대상에만'; end if;
  if not (v.targets @> jsonb_build_array(jsonb_build_object('session_id', p_session, 'item_no', p_item_no))) then
    raise exception 'csat_ec: 이 회차의 대상이 아니다';
  end if;
  if not public.csat_ec_pilot_eligible(p_session, p_item_no) then
    raise exception 'csat_ec: Pilot 적격(품질 · 학습자 확인 · 과정 증거) 못 갖춘 응답은 판정하지 않는다';
  end if;
  return jsonb_build_object('round_id', v.id, 'taxonomy_version', v.taxonomy_version, 'choice_trap_map', v.choice_trap_map,
           'quality_rule_version', v.quality_rule_version,
           'canonical_input', public.csat_ec_canonical_input(p_session, p_item_no),
           'input_hash', public.csat_ec_judgment_input_hash(p_session, p_item_no));
end $$;

create or replace function public.csat_ec_ai_import(p_round bigint, p_run jsonb, p_claims jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_run bigint; v_user uuid; c jsonb; n_primary int := 0; v public.csat_ec_review_round;
        v_sid uuid := (p_run->>'session_id')::uuid; v_no smallint := (p_run->>'item_no')::smallint; v_input jsonb; v_hash text;
begin
  -- 잠금 순서: 세션 → 응답 advisory → 회차
  select s.user_id into v_user from public.csat_dx_session s where s.id = v_sid for share;
  if v_user is null then raise exception 'csat_ec: 없는 세션'; end if;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || v_sid::text || '|' || v_no::text, 0));
  select * into v from public.csat_ec_review_round where id = p_round for share;
  if v.id is null or v.status <> 'draft' then raise exception 'csat_ec: AI 판정은 draft 회차의 대상에만'; end if;
  if not (v.targets @> jsonb_build_array(jsonb_build_object('session_id', v_sid, 'item_no', v_no))) then
    raise exception 'csat_ec: 이 회차의 대상이 아니다';
  end if;
  -- 판정기 출처는 회차 값과 같아야 한다(다른 taxonomy · 대응표 주입 불가)
  if p_run->>'taxonomy_version' is distinct from v.taxonomy_version or p_run->>'choice_trap_map' is distinct from v.choice_trap_map
     or p_run->>'quality_rule_version' is distinct from v.quality_rule_version then
    raise exception 'csat_ec: taxonomy · 대응표 · 품질 규칙은 회차 값과 같아야 한다';
  end if;
  if not public.csat_ec_pilot_eligible(v_sid, v_no) then
    raise exception 'csat_ec: Pilot 적격(품질 · 학습자 확인 · 과정 증거) 못 갖춘 응답은 적재하지 않는다';
  end if;
  v_input := public.csat_ec_canonical_input(v_sid, v_no);
  v_hash := encode(extensions.digest(v_input::text, 'sha256'), 'hex');
  if p_run->>'outcome' <> 'failed' and p_run->>'input_hash' is distinct from v_hash then
    raise exception 'csat_ec: 입력 해시가 지금 입력과 다르다';
  end if;
  -- 재시도 멱등 — 같은 실행 키 직렬화 뒤, 성공 실행이 이미 있으면 결과(출력 · claim)가 같을 때만 그 id
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|', p_round, v_sid, v_no, v.taxonomy_version, p_run->>'model',
                                                           p_run->>'prompt_version', p_run->>'analyzer_version', v.choice_trap_map, v_hash), 0));
  if p_run->>'outcome' <> 'failed' then
    select a.id into v_run from public.csat_ec_ai_run a
     where a.round_id = p_round and a.session_id = v_sid and a.item_no = v_no and a.taxonomy_version = v.taxonomy_version
       and a.model = p_run->>'model' and a.prompt_version = p_run->>'prompt_version' and a.analyzer_version = p_run->>'analyzer_version'
       and a.choice_trap_map = v.choice_trap_map and a.input_hash = v_hash and a.outcome <> 'failed';
    if v_run is not null then
      if (select a.outcome = p_run->>'outcome' and a.output = p_run->'output' from public.csat_ec_ai_run a where a.id = v_run)
         and coalesce((select jsonb_agg(jsonb_build_array(c.code, c.role, c.confidence, c.evidence) order by c.code) from public.csat_ec_claim c where c.ai_run_id = v_run), '[]')
           = coalesce((select jsonb_agg(jsonb_build_array(x->>'code', x->>'role', x->>'confidence', x->'evidence') order by x->>'code') from jsonb_array_elements(coalesce(p_claims, '[]')) x), '[]') then
        return v_run;
      end if;
      raise exception 'csat_ec: 같은 입력 · 판정기의 다른 결과가 이미 있다(실행 %)', v_run;
    end if;
  end if;
  insert into public.csat_ec_ai_run (session_id, item_no, taxonomy_version, model, prompt_version, analyzer_version, quality_rule_version,
                                     choice_trap_map, round_id, input_hash, canonical_input, outcome, output, failure)
  values (v_sid, v_no, v.taxonomy_version, p_run->>'model', p_run->>'prompt_version', p_run->>'analyzer_version', v.quality_rule_version,
          v.choice_trap_map, p_round, v_hash, v_input, p_run->>'outcome', p_run->'output', p_run->>'failure')
  returning id into v_run;
  if p_run->>'outcome' = 'proposed' then
    for c in select * from jsonb_array_elements(p_claims) loop
      if left(c->>'code', 1) not in ('V', 'S', 'R', 'E') then raise exception 'csat_ec: AI 는 V/S/R/E 원인만 제안한다'; end if;
      -- 폐기된(deprecated) 코드로 새 제안 금지
      if not exists (select 1 from public.csat_ec_code k where k.version = v.taxonomy_version and k.code = c->>'code' and k.status = 'active') then
        raise exception 'csat_ec: 사전에 없거나 폐기된 코드다(%)', c->>'code';
      end if;
      -- 근거: 요약 + 인용 1개 이상, 인용은 표시한 원문(지문 · 발문 · 선지 n)에 실제로 있어야 한다 — 전문(v_input)에서 찾는다
      if coalesce(length(btrim(c->'evidence'->>'summary')), 0) < 10
         or coalesce(jsonb_array_length(c->'evidence'->'text_refs'), 0) = 0
         or exists (select 1 from jsonb_array_elements(c->'evidence'->'text_refs') q
                     where coalesce(length(btrim(q->>'quote')), 0) < 2
                        or coalesce(q->>'where', '') !~ '^(passage|stem|option:[1-5])$'
                        or strpos(lower(coalesce(case when q->>'where' = 'passage' then v_input->>'passage'
                                                      when q->>'where' = 'stem' then v_input->>'stem'
                                                      else v_input->'choices'->>(split_part(q->>'where', ':', 2)::int - 1) end, '')),
                                  lower(btrim(q->>'quote'))) = 0) then
        raise exception 'csat_ec: AI 근거에 요약 · 출처 표시 인용이 없거나, 표시한 원문(지문 · 발문 · 선지 n)에 없는 인용이 있다';
      end if;
      if c->>'role' = 'primary' then n_primary := n_primary + 1; end if;
      insert into public.csat_ec_claim (session_id, item_no, user_id, source, ai_run_id, taxonomy_version, code, role, confidence, evidence)
      values (v_sid, v_no, v_user, 'ai', v_run, v.taxonomy_version, c->>'code', c->>'role', c->>'confidence', c->'evidence');
    end loop;
    if n_primary <> 1 or jsonb_array_length(p_claims) > 2 then raise exception 'csat_ec: proposed 는 primary 1 · contributing ≤ 1'; end if;
  elsif jsonb_array_length(coalesce(p_claims, '[]')) > 0 then
    raise exception 'csat_ec: 원인을 내지 않은 실행에는 claim 이 없어야 한다';
  end if;
  return v_run;
end $$;

-- 2. 새 함수 · 오버로드 삭제(제약이 csat_ec_outcomes 를 쓰므로 그 함수는 제약 복원 뒤에)
drop function public.csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean);
drop function public.csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean);
drop function public.csat_ec_attach_judgment_boundaries(bigint,text[],boolean);
drop function public.csat_ec_round_create(text,text,text,jsonb,text);
drop function public.csat_ec_add_detector_signal(uuid,smallint,text,text,text,boolean,uuid[]);
drop function public.csat_ec_my_pending_probes(uuid);
drop function public.csat_ec_judgment_input_hash(uuid,smallint,text);
drop function public.csat_ec_canonical_input(uuid,smallint,text);
drop function public.csat_ec_valid_process_evidence(uuid,smallint,text);

-- 3. 새 표
drop table public.csat_ec_boundary_signal;
drop function public.csat_ec_boundary_signal_guard();
drop table public.csat_ec_boundary;
drop function public.csat_ec_boundary_guard();

-- 4. 새 컬럼 · 제약 · 인덱스
alter table public.csat_ec_judgment drop column candidate_codes;     -- csat_ec_judgment_candidates_check 도 함께 사라진다
alter table public.csat_ec_review_round drop column evidence_profile;
drop index public.csat_ec_process_probe_once;
alter table public.csat_ec_process_evidence drop constraint csat_ec_process_probe_check;
alter table public.csat_ec_process_evidence drop constraint csat_ec_process_interpretation_check;
alter table public.csat_ec_process_evidence drop constraint csat_ec_process_evidence_kind_check;
alter table public.csat_ec_process_evidence add constraint csat_ec_process_evidence_kind_check check (kind in ('confidence', 'reason', 'blocked_span', 'category', 'note'));
alter table public.csat_ec_claim drop constraint csat_ec_claim_candidate_ai_only;
alter table public.csat_ec_claim drop constraint csat_ec_claim_role_check;
alter table public.csat_ec_claim add constraint csat_ec_claim_role_check check (role in ('primary', 'contributing'));
alter table public.csat_ec_judgment drop constraint csat_ec_judgment_outcome_check;
alter table public.csat_ec_judgment add constraint csat_ec_judgment_outcome_check check (outcome in ('code', 'no_cause', 'insufficient_evidence', 'no_fitting_code'));
alter table public.csat_ec_ai_run drop constraint csat_ec_ai_run_outcome_check;
alter table public.csat_ec_ai_run add constraint csat_ec_ai_run_outcome_check check (outcome in ('proposed', 'no_cause', 'insufficient_evidence', 'no_fitting_code', 'failed'));
drop function public.csat_ec_outcomes(text);

-- 5. 권한 — 복원한 함수의 권한은 create or replace 가 유지한다. 원래 마이그레이션의 회수 · 부여를 다시 확인한다
revoke all on function public.csat_ec_round_inputs_intact(bigint,uuid,smallint) from public, anon, authenticated, service_role;
revoke all on function public.csat_ec_round_guard() from public, anon, authenticated, service_role;
revoke all on function public.csat_ec_judgment_insert_guard() from public, anon, authenticated, service_role;
revoke all on function public.csat_ec_ai_taxonomy(text) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_ai_taxonomy(text) to service_role;

commit;
