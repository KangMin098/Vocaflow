-- supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql
--
-- 오답 원인 Evidence — Pilot 데이터 모델 확장(2026-10-05 · 초안 · 개발 DB 미적용). 격리 PostgreSQL 에서 실행 검증 뒤 승인받아 적용한다.
-- 설계: docs/csat-learner/codebook/PILOT_DATA_MODEL.md · 되돌리기: scripts/csat/error-evidence/rollback-pilot.sql
--
-- 원칙
--   · taxonomy 코드 · 경계를 seed 하지 않는다(인프라만). conditional seed 는 별도 단계.
--   · 특정 경계(R6)를 하드코딩하지 않는다 — 경계 · probe 는 데이터(csat_ec_boundary)로 표현한다.
--   · 기존 행의 의미를 바꾸지 않는다 — outcome 값은 더하기만, 기존 evidence_profile 'all' 회차의 판정 입력 해시는 이전과 바이트 단위로 같다.
--   · 학습 지도(Learning Map)와 연결하지 않는다 — 경계 신호 · probe 응답 · 판정 어느 것도 V/S/R/E 상태를 바꾸지 않는다.
--
-- 바뀌는 것
--   [제약 확장] csat_ec_judgment.outcome · csat_ec_ai_run.outcome CHECK → csat_ec_outcomes() 단일 원천(+ multiple_plausible · inconsistent_evidence)
--               csat_ec_claim.role(+ candidate) · csat_ec_process_evidence.kind(+ interpretation · targeted_probe)
--   [표 확장]   csat_ec_judgment.candidate_codes · csat_ec_review_round.evidence_profile
--   [새 객체]   csat_ec_boundary(taxonomy 경계) · csat_ec_boundary_signal(attempt 의 경계 관찰 — 탐지기 · AI 실행 · 판정)

begin;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. outcome — 허용값 단일 원천
-- ═════════════════════════════════════════════════════════════════════════════
-- 'code'(판정) · 'proposed'(AI) = identified. 이름을 바꾸지 않는다(기존 행 · 클라이언트 호환).
-- multiple_plausible = 둘 이상의 원인이 각각 최소 증거를 갖추고 지금 증거로 서로 배제되지 않는다(primary 없음 — 후보 집합).
-- inconsistent_evidence = 증거들이 동시에 참일 수 없는 원인을 지지한다.
create or replace function public.csat_ec_outcomes(p_scope text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_scope
    when 'judgment' then array['code', 'no_cause', 'insufficient_evidence', 'no_fitting_code', 'multiple_plausible', 'inconsistent_evidence']
    when 'ai_run'   then array['proposed', 'no_cause', 'insufficient_evidence', 'no_fitting_code', 'multiple_plausible', 'inconsistent_evidence', 'failed']
  end
$$;

do $$
begin
  -- 기존 CHECK 이름을 확인하고 바꾼다(이름이 다르면 멈춘다 — 조용히 두 CHECK 가 남지 않게)
  if not exists (select 1 from pg_constraint where conname = 'csat_ec_judgment_outcome_check' and conrelid = 'public.csat_ec_judgment'::regclass) then
    raise exception 'csat_ec_judgment_outcome_check 가 없다 — 이름 확인 필요';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'csat_ec_ai_run_outcome_check' and conrelid = 'public.csat_ec_ai_run'::regclass) then
    raise exception 'csat_ec_ai_run_outcome_check 가 없다 — 이름 확인 필요';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'csat_ec_claim_role_check' and conrelid = 'public.csat_ec_claim'::regclass) then
    raise exception 'csat_ec_claim_role_check 가 없다 — 이름 확인 필요';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'csat_ec_process_evidence_kind_check' and conrelid = 'public.csat_ec_process_evidence'::regclass) then
    raise exception 'csat_ec_process_evidence_kind_check 가 없다 — 이름 확인 필요';
  end if;
end $$;

alter table public.csat_ec_judgment drop constraint csat_ec_judgment_outcome_check;
alter table public.csat_ec_judgment add constraint csat_ec_judgment_outcome_check
  check (outcome is null or outcome = any (public.csat_ec_outcomes('judgment')));
alter table public.csat_ec_ai_run drop constraint csat_ec_ai_run_outcome_check;
alter table public.csat_ec_ai_run add constraint csat_ec_ai_run_outcome_check
  check (outcome = any (public.csat_ec_outcomes('ai_run')));

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. multiple_plausible · inconsistent_evidence 의 후보 집합
-- ═════════════════════════════════════════════════════════════════════════════
-- 판정: candidate_codes(primary · contributing 과 다른 의미 — 「하나를 정하지 못한 후보들」)
alter table public.csat_ec_judgment add column candidate_codes text[] not null default '{}';
alter table public.csat_ec_judgment add constraint csat_ec_judgment_candidates_check check (
  case outcome
    when 'multiple_plausible' then cardinality(candidate_codes) >= 2
    when 'inconsistent_evidence' then cardinality(candidate_codes) <> 1   -- 서로 충돌하는 원인들(0 = 원인을 특정하지 않은 충돌)
    else cardinality(candidate_codes) = 0
  end);
-- AI claim: role candidate(multiple · inconsistent 의 후보). primary · contributing 의미는 그대로
alter table public.csat_ec_claim drop constraint csat_ec_claim_role_check;
alter table public.csat_ec_claim add constraint csat_ec_claim_role_check check (role in ('primary', 'contributing', 'candidate'));
alter table public.csat_ec_claim add constraint csat_ec_claim_candidate_ai_only check (role <> 'candidate' or source = 'ai');

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. taxonomy 경계 — 코드 상태와 분리된 code-to-code 경계 상태
-- ═════════════════════════════════════════════════════════════════════════════
create table public.csat_ec_boundary (
  version        text not null references public.csat_ec_taxonomy_version(version) on delete restrict,
  boundary_key   text not null,
  code_a         text not null,
  code_b         text not null,
  foreign key (version, code_a) references public.csat_ec_code(version, code) on delete restrict,
  foreign key (version, code_b) references public.csat_ec_code(version, code) on delete restrict,
  status         text not null check (status in ('accepted', 'provisional', 'retired')),
  probe_key      text check (probe_key ~ '^[a-z0-9_]+$'),            -- 경계를 가르는 추가 질문(정의는 저장소 버전 산출물)
  decision_note  text not null check (length(btrim(decision_note)) > 0),
  provenance     jsonb not null default '{}' check (jsonb_typeof(provenance) = 'object'),   -- 근거 문서 · 회차 · 커밋
  created_at     timestamptz not null default now(),
  primary key (version, boundary_key),
  unique (version, code_a, code_b),
  check (code_a collate "C" < code_b collate "C"),                    -- 순서를 고정 — 같은 경계가 두 번 생기지 않는다
  check (boundary_key = lower(code_a) || '__' || lower(code_b)),
  check (probe_key is null or status = 'provisional')                 -- probe 는 미해결 경계에만
);

-- 봉인된 버전의 경계는 추가 · 수정 · 삭제 불가(코드와 같은 규칙)
create or replace function public.csat_ec_boundary_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select status into v_status from public.csat_ec_taxonomy_version where version = old.version for update;
    if v_status = 'sealed' then raise exception 'csat_ec: 봉인된 taxonomy % 의 경계는 바꿀 수 없다', old.version; end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into v_status from public.csat_ec_taxonomy_version where version = new.version for update;
    if v_status = 'sealed' then raise exception 'csat_ec: 봉인된 taxonomy % 에 경계를 더할 수 없다', new.version; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger csat_ec_boundary_guard before insert or update or delete on public.csat_ec_boundary
  for each row execute function public.csat_ec_boundary_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. 경계 관찰(attempt 단위) — 탐지기 · AI 실행 · 판정 어느 쪽에서든. 덧붙이기 전용.
-- ═════════════════════════════════════════════════════════════════════════════
-- 「해소됐다」는 상태는 두지 않는다 — 해소는 그 뒤의 판정 결과로만 드러난다(두 모델 합의만으로 해소를 저장하지 않는다).
create table public.csat_ec_boundary_signal (
  id               bigint generated always as identity primary key,
  session_id       uuid not null,
  item_no          smallint not null,
  foreign key (session_id, item_no) references public.csat_dx_response(session_id, item_no) on delete cascade,
  taxonomy_version text not null,
  boundary_key     text not null,
  foreign key (taxonomy_version, boundary_key) references public.csat_ec_boundary(version, boundary_key) on delete restrict,
  boundary_status  text not null check (boundary_status in ('accepted', 'provisional', 'retired')),   -- 관찰 당시 경계 상태
  source           text not null check (source in ('detector', 'ai_run', 'judgment')),
  detector_version text,
  ai_run_id        bigint references public.csat_ec_ai_run(id) on delete cascade,
  judgment_id      bigint references public.csat_ec_judgment(id) on delete cascade,
  probe_required   boolean not null,
  evidence_ids     uuid[] not null default '{}',   -- 이 관찰이 나온 과정 증거(판정 입력에 봉인된 id 의 부분집합)
  created_at       timestamptz not null default now(),
  check ((source = 'detector') = (detector_version is not null)),
  check ((source = 'ai_run') = (ai_run_id is not null)),
  check ((source = 'judgment') = (judgment_id is not null))
);
create unique index csat_ec_boundary_signal_ai_once on public.csat_ec_boundary_signal (ai_run_id, boundary_key) where ai_run_id is not null;
create unique index csat_ec_boundary_signal_judgment_once on public.csat_ec_boundary_signal (judgment_id, boundary_key) where judgment_id is not null;
create index csat_ec_boundary_signal_response on public.csat_ec_boundary_signal (session_id, item_no);
create trigger csat_ec_boundary_signal_no_update before update on public.csat_ec_boundary_signal
  for each row execute function public.csat_ec_forbid_update();

-- 관찰 무결성: 봉인된 버전의 경계 · 상태 스냅샷 일치 · 출처 행이 같은 응답 · 같은 버전
create or replace function public.csat_ec_boundary_signal_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_b public.csat_ec_boundary;
begin
  select b.* into v_b from public.csat_ec_boundary b
    join public.csat_ec_taxonomy_version t on t.version = b.version and t.status = 'sealed'
   where b.version = new.taxonomy_version and b.boundary_key = new.boundary_key;
  if v_b.boundary_key is null then raise exception 'csat_ec: 봉인된 taxonomy 의 경계가 아니다'; end if;
  if new.boundary_status <> v_b.status then raise exception 'csat_ec: 경계 상태 스냅샷이 사전과 다르다'; end if;
  if new.probe_required and (v_b.status <> 'provisional' or v_b.probe_key is null) then
    raise exception 'csat_ec: probe 는 probe 가 정의된 미해결 경계에서만 요구한다';
  end if;
  if new.source = 'ai_run' and not exists (select 1 from public.csat_ec_ai_run a where a.id = new.ai_run_id
       and a.session_id = new.session_id and a.item_no = new.item_no and a.taxonomy_version = new.taxonomy_version) then
    raise exception 'csat_ec: AI 실행과 응답 · taxonomy 가 맞지 않는다';
  end if;
  if new.source = 'judgment' and not exists (select 1 from public.csat_ec_judgment j where j.id = new.judgment_id
       and j.session_id = new.session_id and j.item_no = new.item_no and j.taxonomy_version = new.taxonomy_version) then
    raise exception 'csat_ec: 판정과 응답 · taxonomy 가 맞지 않는다';
  end if;
  if exists (select 1 from unnest(new.evidence_ids) e
              where not exists (select 1 from public.csat_ec_process_evidence p
                                 where p.id = e and p.session_id = new.session_id and p.item_no = new.item_no)) then
    raise exception 'csat_ec: 다른 응답의 과정 증거를 근거로 둘 수 없다';
  end if;
  return new;
end $$;
create trigger csat_ec_boundary_signal_guard before insert on public.csat_ec_boundary_signal
  for each row execute function public.csat_ec_boundary_signal_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. 학생 과정 증거 — interpretation · targeted_probe
-- ═════════════════════════════════════════════════════════════════════════════
-- targeted_probe value: {probe_key, probe_version, taxonomy_version, boundary_key, prompt_hash, option('A'..'Z' | null), skipped, free_text?}
-- 학생이 고른 것은 선택지 글자뿐이다 — 그 선택이 어느 원인의 증거인지는 버전 붙은 probe 정의(저장소)와 분석 계층이 해석한다.
alter table public.csat_ec_process_evidence drop constraint csat_ec_process_evidence_kind_check;
alter table public.csat_ec_process_evidence add constraint csat_ec_process_evidence_kind_check
  check (kind in ('confidence', 'reason', 'blocked_span', 'category', 'note', 'interpretation', 'targeted_probe'));
alter table public.csat_ec_process_evidence add constraint csat_ec_process_interpretation_check
  check (kind <> 'interpretation' or coalesce(jsonb_typeof(value->'text') = 'string' and length(btrim(value->>'text')) between 1 and 500, false));
alter table public.csat_ec_process_evidence add constraint csat_ec_process_probe_check check (kind <> 'targeted_probe' or coalesce((
      coalesce(value->>'probe_key', '') ~ '^[a-z0-9_]+$'
  and coalesce(value->>'probe_version', '') ~ '^[a-z0-9_.-]+$'
  and coalesce(value->>'taxonomy_version', '') ~ '^v[0-9]+\.[0-9]+$'
  and jsonb_typeof(value->'boundary_key') = 'string'
  and coalesce(value->>'prompt_hash', '') ~ '^[0-9a-f]{64}$'
  and jsonb_typeof(value->'skipped') = 'boolean'
  and ((value->>'skipped')::boolean = (jsonb_typeof(value->'option') is distinct from 'string'))   -- 건너뜀 ⇔ 선택 없음
  and (jsonb_typeof(value->'option') is distinct from 'string' or value->>'option' ~ '^[A-Z]$')
  and (value->'free_text' is null or (jsonb_typeof(value->'free_text') = 'string' and length(value->>'free_text') <= 500))), false));
-- attempt × probe 는 하나(정정은 supersede 체인 — 첫 응답은 하나)
create unique index csat_ec_process_probe_once on public.csat_ec_process_evidence (session_id, item_no, (value->>'probe_key'))
  where kind = 'targeted_probe' and supersedes_id is null;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. 회차의 증거 범위 — probe 전 · 후 판정을 같은 응답에서 재현
-- ═════════════════════════════════════════════════════════════════════════════
-- 'all' = 지금까지와 같다(유효 과정 증거 전부) · 'pre_probe' = targeted_probe 를 뺀 증거로 판정 입력을 만든다.
-- blind 시작 뒤 봉인(회차 입력). 증거 행에 「전/후」 표시를 두지 않는다 — 어떤 id 들이 들어갔는지는 targets.process_evidence_ids 와 input_hash 가 재현한다.
alter table public.csat_ec_review_round add column evidence_profile text not null default 'all'
  check (evidence_profile in ('all', 'pre_probe'));

create or replace function public.csat_ec_valid_process_evidence(p_session uuid, p_item_no smallint, p_profile text)
returns table (id uuid, kind text, value jsonb, created_at timestamptz)
language sql stable set search_path = '' as $$
  select e.id, e.kind, e.value, e.created_at
    from public.csat_ec_valid_process_evidence(p_session, p_item_no) e
   where p_profile = 'all' or (p_profile = 'pre_probe' and e.kind <> 'targeted_probe')
$$;

-- 'all' 은 이전 전문과 바이트 단위로 같다(키를 더하지 않는다) — 기존 회차 · AI 실행의 input_hash 가 그대로 유효
create or replace function public.csat_ec_canonical_input(p_session uuid, p_item_no smallint, p_profile text) returns jsonb
language sql stable set search_path = '' as $$
  select case when p_profile = 'all' then public.csat_ec_canonical_input(p_session, p_item_no)
    else public.csat_ec_canonical_input(p_session, p_item_no)
         || jsonb_build_object('evidence_profile', p_profile,
              'process_evidence', (select coalesce(jsonb_agg(jsonb_build_array(e.id, e.kind, e.value) order by e.created_at, e.id), '[]')
                                     from public.csat_ec_valid_process_evidence(p_session, p_item_no, p_profile) e))
  end
$$;

create or replace function public.csat_ec_judgment_input_hash(p_session uuid, p_item_no smallint, p_profile text) returns text
language sql stable set search_path = '' as $$
  select encode(extensions.digest(public.csat_ec_canonical_input(p_session, p_item_no, p_profile)::text, 'sha256'), 'hex')
$$;

-- 회차 무결성 — 회차의 증거 범위로 계산
create or replace function public.csat_ec_round_inputs_intact(p_round bigint, p_session uuid default null, p_item_no smallint default null)
returns boolean language sql stable set search_path = '' as $$
  select not exists (
    select 1 from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t
     where rr.id = p_round
       and (p_session is null or ((t->>'session_id')::uuid = p_session and (t->>'item_no')::smallint = p_item_no))
       and (not public.csat_ec_pilot_eligible((t->>'session_id')::uuid, (t->>'item_no')::smallint)
            or t->>'input_hash' is distinct from public.csat_ec_judgment_input_hash((t->>'session_id')::uuid, (t->>'item_no')::smallint, rr.evidence_profile)
            or (t->>'confirmation_revision')::int is distinct from
               (select max(c.revision) from public.csat_ec_session_confirmation c where c.session_id = (t->>'session_id')::uuid)))
$$;

-- 회차 입력 봉인에 evidence_profile 포함
create or replace function public.csat_ec_round_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  rank_old int := array_position(array['draft','blind_review','reveal','adjudication','closed'], old.status);
  rank_new int := array_position(array['draft','blind_review','reveal','adjudication','closed'], new.status);
begin
  if tg_op = 'DELETE' then raise exception 'csat_ec: 검수 회차는 지우지 않는다(취소한다)'; end if;
  if new.created_by is null and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then return new; end if;
  if old.status in ('closed', 'cancelled') then raise exception 'csat_ec: 끝난 회차 % 는 바꿀 수 없다', old.id; end if;
  if new.status <> 'cancelled' and (rank_new is null or rank_new < rank_old or rank_new > rank_old + 1) then
    raise exception 'csat_ec: 회차 상태 전이 % → % 불가', old.status, new.status;
  end if;
  if old.status <> 'draft' and (
       new.taxonomy_version <> old.taxonomy_version or new.quality_rule_version <> old.quality_rule_version
    or new.choice_trap_map <> old.choice_trap_map or new.eligibility <> old.eligibility
    or new.targets <> old.targets or new.targets_hash is distinct from old.targets_hash
    or new.evidence_profile <> old.evidence_profile) then
    raise exception 'csat_ec: blind 시작 뒤 회차 입력은 봉인돼 있다';
  end if;
  -- 대상을 채운 뒤에는 증거 범위를 바꾸지 않는다(봉인할 해시 · 증거 id 가 그 범위로 계산됐다)
  if new.evidence_profile <> old.evidence_profile and jsonb_array_length(old.targets) > 0 then
    raise exception 'csat_ec: 대상을 채운 뒤에는 증거 범위를 바꿀 수 없다';
  end if;
  return new;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. 판정 insert 가드 — 후보 집합 검사 추가
-- ═════════════════════════════════════════════════════════════════════════════
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
  -- 폐기된(deprecated) 코드로 새 판정 금지 — primary · contributing · 후보 모두
  if exists (select 1 from unnest(array_remove(array[new.primary_code], null) || new.contributing_codes || new.candidate_codes) x
              where not exists (select 1 from public.csat_ec_code c where c.version = new.taxonomy_version and c.code = x and c.status = 'active')) then
    raise exception 'csat_ec: 사전에 없거나 폐기된 코드로 판정할 수 없다';
  end if;
  if new.phase in ('blind', 'adjudication') then
    if new.outcome <> 'code' and cardinality(new.excluded_axes) > 0 then
      raise exception 'csat_ec: 원인을 고르지 않은 판정에는 배제 축을 둘 수 없다';
    end if;
    if exists (select 1 from unnest(array_remove(array[new.primary_code], null) || new.contributing_codes) x
                where left(x, 1) = any (new.excluded_axes)) then
      raise exception 'csat_ec: 고른 원인의 축을 배제할 수 없다';
    end if;
  end if;
  if cardinality(new.contributing_codes) > 2
     or cardinality(new.contributing_codes) <> (select count(distinct x) from unnest(new.contributing_codes) x)
     or exists (select 1 from unnest(new.contributing_codes) x
                 where not exists (select 1 from public.csat_ec_code c where c.version = new.taxonomy_version and c.code = x)) then
    raise exception 'csat_ec: 보조 원인 코드가 사전에 없거나 중복 · 초과다';
  end if;
  -- 후보: 중복 없음 · B(행동)는 후보가 아니다(contributing 전용 규칙은 코드북에 — 여기서는 축만)
  if cardinality(new.candidate_codes) <> (select count(distinct x) from unnest(new.candidate_codes) x) then
    raise exception 'csat_ec: 후보 코드가 중복된다';
  end if;
  if new.phase = 'adjudication' and not exists (
       select 1 from public.csat_ec_review_assignment a
        where a.round_id = new.round_id and a.reviewer_key = new.reviewer_key and a.slot = 'adjudicator') then
    raise exception 'csat_ec: 합의 판정은 adjudicator 만';
  end if;
  return new;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. 학습자 RPC — 과정 증거(interpretation · targeted_probe) · 대기 중 probe
-- ═════════════════════════════════════════════════════════════════════════════
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

-- 학습자: 자기 응답 중 probe 를 요구받았고 아직 응답(건너뜀 포함)이 없는 것 — UI 가 probe 를 띄울 때. 세션당 상한은 서비스 정책(여기서 강제하지 않는다)
create or replace function public.csat_ec_my_pending_probes(p_session uuid)
returns table (item_no smallint, taxonomy_version text, boundary_key text, probe_key text)
language sql stable security definer set search_path = '' as $$
  select distinct s.item_no, s.taxonomy_version, s.boundary_key, b.probe_key
    from public.csat_ec_boundary_signal s
    join public.csat_dx_session ss on ss.id = s.session_id and ss.user_id = (select auth.uid())
    join public.csat_ec_boundary b on b.version = s.taxonomy_version and b.boundary_key = s.boundary_key
   where s.session_id = p_session and s.probe_required and b.probe_key is not null
     and not exists (select 1 from public.csat_ec_process_evidence p
                      where p.session_id = s.session_id and p.item_no = s.item_no and p.kind = 'targeted_probe'
                        and p.value->>'probe_key' = b.probe_key)
$$;

-- 탐지기(서비스) — attempt 직후 경계 관찰. 판정이 아니다(probe 를 띄울지 정하는 신호)
create or replace function public.csat_ec_add_detector_signal(p_session uuid, p_item_no smallint, p_taxonomy text, p_boundary_key text,
                                                             p_detector_version text, p_probe_required boolean, p_evidence_ids uuid[])
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_status text;
begin
  if coalesce(btrim(p_detector_version), '') = '' then raise exception 'csat_ec: 탐지기 버전이 필요하다'; end if;
  select b.status into v_status from public.csat_ec_boundary b where b.version = p_taxonomy and b.boundary_key = p_boundary_key;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || p_session::text || '|' || p_item_no::text, 0));
  insert into public.csat_ec_boundary_signal (session_id, item_no, taxonomy_version, boundary_key, boundary_status, source, detector_version, probe_required, evidence_ids)
  values (p_session, p_item_no, p_taxonomy, p_boundary_key, v_status, 'detector', p_detector_version, p_probe_required, coalesce(p_evidence_ids, '{}'))
  returning id into v_id;
  return v_id;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. 관리자 · 판정자 RPC — 증거 범위 · 후보 · 경계 관찰
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.csat_ec_round_create(p_taxonomy text, p_quality_rule text, p_choice_trap_map text, p_eligibility jsonb, p_evidence_profile text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if p_evidence_profile not in ('all', 'pre_probe') then raise exception 'csat_ec: 증거 범위는 all | pre_probe'; end if;
  v_id := public.csat_ec_round_create(p_taxonomy, p_quality_rule, p_choice_trap_map, p_eligibility);
  update public.csat_ec_review_round set evidence_profile = p_evidence_profile where id = v_id;
  return v_id;
end $$;

-- 대상 채우기 — 회차 증거 범위로 해시 · 증거 id 를 계산(그 밖은 이전과 같다)
create or replace function public.csat_ec_round_set_targets(p_round bigint, p_refs jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare v public.csat_ec_review_round; v_targets jsonb;
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  if jsonb_typeof(p_refs) is distinct from 'array' then raise exception 'csat_ec: 대상은 배열'; end if;
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
           'input_hash', public.csat_ec_judgment_input_hash(r.session_id, r.item_no, v.evidence_profile),
           'confirmation_revision', (select max(c.revision) from public.csat_ec_session_confirmation c where c.session_id = r.session_id),
           'process_evidence_ids', coalesce((select jsonb_agg(e.id order by e.id) from public.csat_ec_valid_process_evidence(r.session_id, r.item_no, v.evidence_profile) e), '[]'),
           'quality', public.csat_ec_record_quality_rq1_signals(r.session_id),
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
         and a.input_hash = public.csat_ec_judgment_input_hash(r.session_id, r.item_no, v.evidence_profile)
       order by a.id desc limit 1) ar on true;
  if jsonb_array_length(v_targets) <> (select count(distinct ((x->>'session_id'), (x->>'item_no'))) from jsonb_array_elements(p_refs) x) then
    raise exception 'csat_ec: 없는 응답이 대상에 있다';
  end if;
  update public.csat_ec_review_round set targets = v_targets where id = p_round;
  return jsonb_array_length(v_targets);
end $$;

-- blind 시작 — 증거 범위로 검증(그 밖은 이전과 같다)
create or replace function public.csat_ec_round_start_blind(p_round bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.csat_ec_review_round; v_hash text; v_locked uuid[];
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  select coalesce(array_agg(s.id order by s.id), '{}') into v_locked from (
    select s.id from public.csat_dx_session s
     where s.id in (select (t->>'session_id')::uuid from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t where rr.id = p_round)
     order by s.id for update) s;
  select * into v from public.csat_ec_review_round where id = p_round for update;
  if v.status <> 'draft' then raise exception 'csat_ec: draft 회차만 시작한다'; end if;
  if v_locked is distinct from (select coalesce(array_agg(distinct (t->>'session_id')::uuid order by (t->>'session_id')::uuid), '{}')
                                  from jsonb_array_elements(v.targets) t) then
    raise exception 'csat_ec: 시작하는 동안 대상이 바뀌었다 — 다시 시도한다';
  end if;
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
  if exists (select 1 from jsonb_array_elements(v.targets) t
              where not public.csat_ec_pilot_eligible((t->>'session_id')::uuid, (t->>'item_no')::smallint)) then
    raise exception 'csat_ec: Pilot 적격(품질 · 학습자 확인 · 과정 증거) 못 갖춘 대상이 있다';
  end if;
  if (select count(*) from jsonb_array_elements(v.targets)) <>
     (select count(distinct ((t->>'session_id'), (t->>'item_no'))) from jsonb_array_elements(v.targets) t) then
    raise exception 'csat_ec: 같은 응답이 대상에 두 번 있다';
  end if;
  if (select count(distinct s.user_id) from jsonb_array_elements(v.targets) t join public.csat_dx_session s on s.id = (t->>'session_id')::uuid) < 3
     or (select count(*) from jsonb_array_elements(v.targets) t join public.csat_dx_response r
           on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint where not r.is_correct) not between 30 and 50
     or (select count(*) from jsonb_array_elements(v.targets) t join public.csat_dx_response r
           on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint where r.is_correct) not between 10 and 20 then
    raise exception 'csat_ec: 표본 구성(학습자 3+ · 오답 30~50 · 정답 대조 10~20)을 채우지 못한다';
  end if;
  if exists (select 1 from jsonb_array_elements(v.targets) t
              where (t->>'confirmation_revision')::int is distinct from
                    (select max(c.revision) from public.csat_ec_session_confirmation c where c.session_id = (t->>'session_id')::uuid)) then
    raise exception 'csat_ec: 봉인할 학습자 확인 revision 이 최신이 아니다';
  end if;
  if exists (select 1 from jsonb_array_elements(v.targets) t
              where coalesce((select jsonb_agg(e.id order by e.id) from public.csat_ec_valid_process_evidence((t->>'session_id')::uuid, (t->>'item_no')::smallint, v.evidence_profile) e), '[]')
                    <> coalesce((select jsonb_agg(x order by x) from jsonb_array_elements(t->'process_evidence_ids') x), '[]')) then
    raise exception 'csat_ec: 봉인할 과정 증거 목록이 지금 유효한 증거와 다르다';
  end if;
  if exists (select 1 from jsonb_array_elements(v.targets) t
              join public.csat_dx_response r on r.session_id = (t->>'session_id')::uuid and r.item_no = (t->>'item_no')::smallint
             where r.item_id is distinct from t->>'item_id'
                or t->>'input_hash' is distinct from public.csat_ec_judgment_input_hash(r.session_id, r.item_no, v.evidence_profile)
                or (t->>'ai_run_id' is not null and not exists (
                      select 1 from public.csat_ec_ai_run a where a.id = (t->>'ai_run_id')::bigint and a.round_id = v.id and a.session_id = r.session_id
                         and a.item_no = r.item_no and a.taxonomy_version = v.taxonomy_version and a.outcome <> 'failed'
                         and a.input_hash = public.csat_ec_judgment_input_hash(r.session_id, r.item_no, v.evidence_profile)
                         and a.quality_rule_version = v.quality_rule_version and a.choice_trap_map = v.choice_trap_map))
                or exists (select 1 from jsonb_array_elements_text(coalesce(t->'claim_ids', '[]')) cid
                            where not exists (select 1 from public.csat_ec_claim c where c.id = cid::uuid and c.session_id = r.session_id
                                                 and c.item_no = r.item_no and c.taxonomy_version = v.taxonomy_version
                                                 and ((c.source = 'student' and c.item_input_hash = public.csat_ec_item_input_hash(r.session_id, r.item_no))
                                                      or c.ai_run_id = (t->>'ai_run_id')::bigint))
                               or exists (select 1 from public.csat_ec_claim s2 where s2.supersedes_id = cid::uuid))) then
    raise exception 'csat_ec: 대상의 문항 · 입력 해시 · AI 실행 · claim 연결이 맞지 않는다';
  end if;
  v_hash := encode(extensions.digest(v.targets::text, 'sha256'), 'hex');
  update public.csat_ec_review_round set status = 'blind_review', targets_hash = v_hash, blind_started_at = now() where id = p_round;
  return v_hash;
end $$;

-- 판정 경계 관찰 공통 — 판정 행 하나에 경계 여러 개(덧붙이기)
create or replace function public.csat_ec_attach_judgment_boundaries(p_judgment bigint, p_boundary_keys text[], p_probe_required boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_j public.csat_ec_judgment; k text;
begin
  select * into v_j from public.csat_ec_judgment where id = p_judgment;
  foreach k in array coalesce(p_boundary_keys, '{}') loop
    insert into public.csat_ec_boundary_signal (session_id, item_no, taxonomy_version, boundary_key, boundary_status, source, judgment_id, probe_required)
    values (v_j.session_id, v_j.item_no, v_j.taxonomy_version, k,
            (select b.status from public.csat_ec_boundary b where b.version = v_j.taxonomy_version and b.boundary_key = k),
            'judgment', p_judgment,
            coalesce(p_probe_required, false) and exists (select 1 from public.csat_ec_boundary b where b.version = v_j.taxonomy_version
                                                             and b.boundary_key = k and b.status = 'provisional' and b.probe_key is not null));
  end loop;
end $$;

-- blind 판정(후보 · 경계 포함) — 기존 8인자 함수는 이 함수를 빈 후보 · 경계로 부른다
create or replace function public.csat_ec_submit_blind(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text,
                                                       p_primary text, p_contributing text[], p_excluded text[], p_note text,
                                                       p_candidates text[], p_boundary_keys text[], p_probe_required boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_round public.csat_ec_review_round; v_key text := public.csat_ec_my_key(); v_item text; v_id bigint; v_indep boolean;
begin
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid()) and a.slot in ('A', 'B')) then
    raise exception 'csat_ec: 배정된 판정자가 아니다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for share;
  select * into v_round from public.csat_ec_review_round where id = p_round for share;
  if v_round.status <> 'blind_review' then raise exception 'csat_ec: blind 단계가 아니다'; end if;
  select t->>'item_id' into v_item from jsonb_array_elements(v_round.targets) t
   where (t->>'session_id')::uuid = p_session and (t->>'item_no')::smallint = p_item_no;
  if not public.csat_ec_round_inputs_intact(p_round, p_session, p_item_no) then
    raise exception 'csat_ec: 봉인 뒤 입력이 바뀌었다 — 회차를 취소하고 다시 만든다';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key || '|' || v_item, 0));
  v_indep := not exists (
      select 1 from public.csat_ec_review_round o join public.csat_ec_review_assignment a on a.round_id = o.id
       where o.id <> p_round and o.revealed_at is not null and a.reviewer_key = v_key
         and o.targets @> jsonb_build_array(jsonb_build_object('item_id', v_item)))
    and not exists (select 1 from public.csat_ec_review_assignment a
                     where a.reviewer_key = v_key and v_item = any (a.pre_disclosed_items));
  insert into public.csat_ec_judgment (round_id, session_id, item_no, reviewer_key, phase, taxonomy_version, outcome,
                                       primary_code, contributing_codes, excluded_axes, candidate_codes, independent, note)
  values (p_round, p_session, p_item_no, v_key, 'blind', v_round.taxonomy_version, p_outcome,
          p_primary, coalesce(p_contributing, '{}'), coalesce(p_excluded, '{}'), coalesce(p_candidates, '{}'), v_indep, p_note)
  returning id into v_id;
  perform public.csat_ec_attach_judgment_boundaries(v_id, p_boundary_keys, p_probe_required);
  return v_id;
end $$;

create or replace function public.csat_ec_submit_blind(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text,
                                                       p_primary text, p_contributing text[], p_excluded text[], p_note text)
returns bigint language sql security definer set search_path = '' as $$
  select public.csat_ec_submit_blind(p_round, p_session, p_item_no, p_outcome, p_primary, p_contributing, p_excluded, p_note, '{}'::text[], '{}'::text[], false)
$$;

create or replace function public.csat_ec_submit_adjudication(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text,
                                                              p_primary text, p_contributing text[], p_excluded text[], p_note text,
                                                              p_candidates text[], p_boundary_keys text[], p_probe_required boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_round public.csat_ec_review_round; v_id bigint;
begin
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid()) and a.slot = 'adjudicator') then
    raise exception 'csat_ec: 배정된 adjudicator 가 아니다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for share;
  select * into v_round from public.csat_ec_review_round where id = p_round for share;
  if not public.csat_ec_round_inputs_intact(p_round, p_session, p_item_no) then
    raise exception 'csat_ec: 봉인 뒤 입력이 바뀌었다 — 회차를 취소하고 다시 만든다';
  end if;
  insert into public.csat_ec_judgment (round_id, session_id, item_no, reviewer_key, phase, taxonomy_version, outcome, primary_code,
                                       contributing_codes, excluded_axes, candidate_codes, note)
  values (p_round, p_session, p_item_no, public.csat_ec_my_key(), 'adjudication', v_round.taxonomy_version, p_outcome, p_primary,
          coalesce(p_contributing, '{}'), coalesce(p_excluded, '{}'), coalesce(p_candidates, '{}'), p_note)
  returning id into v_id;
  perform public.csat_ec_attach_judgment_boundaries(v_id, p_boundary_keys, p_probe_required);
  return v_id;
end $$;

create or replace function public.csat_ec_submit_adjudication(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text,
                                                              p_primary text, p_contributing text[], p_excluded text[], p_note text)
returns bigint language sql security definer set search_path = '' as $$
  select public.csat_ec_submit_adjudication(p_round, p_session, p_item_no, p_outcome, p_primary, p_contributing, p_excluded, p_note, '{}'::text[], '{}'::text[], false)
$$;

-- 회차 닫기 — 일치 판단에 후보 집합 포함(그 밖은 이전과 같다)
create or replace function public.csat_ec_round_advance(p_round bigint, p_to text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  perform 1 from public.csat_ec_review_round where id = p_round for update;
  if p_to = 'adjudication' then
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
    if exists (
        select 1 from public.csat_ec_review_round rr, jsonb_array_elements(rr.targets) t
         where rr.id = p_round
           and not exists (select 1 from public.csat_ec_judgment j where j.round_id = p_round and j.phase = 'adjudication'
                             and j.session_id = (t->>'session_id')::uuid and j.item_no = (t->>'item_no')::smallint)
           and (select count(distinct (j.outcome, j.primary_code,
                                       (select array_agg(x order by x) from unnest(j.contributing_codes) x),
                                       (select array_agg(x order by x) from unnest(j.excluded_axes) x),
                                       (select array_agg(x order by x) from unnest(j.candidate_codes) x))) from public.csat_ec_judgment j
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

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. taxonomy 봉인 · AI 사전 — 경계 포함
-- ═════════════════════════════════════════════════════════════════════════════
-- 경계가 없는 버전의 해시는 이전 공식과 같다(기존 봉인값 재계산 호환). 경계가 있으면 코드 뒤에 구분선 + 경계 행.
create or replace function public.csat_ec_taxonomy_seal(p_version text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_hash text;
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  perform 1 from public.csat_ec_taxonomy_version where version = p_version and status = 'draft' for update;
  if not found then raise exception 'csat_ec: draft 버전만 봉인한다'; end if;
  if not exists (select 1 from public.csat_ec_code where version = p_version) then raise exception 'csat_ec: 코드가 없는 버전'; end if;
  select encode(extensions.digest(
           coalesce((select string_agg(to_jsonb(c)::text, chr(10) order by c.code) from public.csat_ec_code c where c.version = p_version), '')
           || coalesce(chr(10) || '--boundaries--' || chr(10)
                       || (select string_agg((to_jsonb(b) - 'created_at')::text, chr(10) order by b.boundary_key)
                             from public.csat_ec_boundary b where b.version = p_version), ''),
           'sha256'), 'hex') into v_hash;
  update public.csat_ec_taxonomy_version set status = 'sealed', sealed_at = now(), definitions_hash = v_hash where version = p_version;
  return v_hash;
end $$;

create or replace function public.csat_ec_ai_taxonomy(p_version text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', v.version, 'definitions_hash', v.definitions_hash,
           'codes', (select jsonb_agg(jsonb_build_object('code', c.code, 'axis', c.axis, 'label', c.label, 'definition', c.definition,
                                                          'inclusion', c.inclusion, 'exclusion', c.exclusion, 'status', c.status) order by c.code)
                       from public.csat_ec_code c where c.version = v.version and c.axis in ('V', 'S', 'R', 'E') and c.status = 'active'),
           'boundaries', (select coalesce(jsonb_agg(jsonb_build_object('boundary_key', b.boundary_key, 'code_a', b.code_a, 'code_b', b.code_b,
                                                                       'status', b.status, 'probe_key', b.probe_key, 'decision_note', b.decision_note)
                                                    order by b.boundary_key), '[]')
                            from public.csat_ec_boundary b where b.version = v.version))
    from public.csat_ec_taxonomy_version v where v.version = p_version and v.status = 'sealed'
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. AI 파이프라인 — 증거 범위 · 새 결과 · 경계 관찰
-- ═════════════════════════════════════════════════════════════════════════════
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
           'quality_rule_version', v.quality_rule_version, 'evidence_profile', v.evidence_profile,
           'canonical_input', public.csat_ec_canonical_input(p_session, p_item_no, v.evidence_profile),
           'input_hash', public.csat_ec_judgment_input_hash(p_session, p_item_no, v.evidence_profile));
end $$;

-- 적재: 실행 + claim(proposed: primary 1 · contributing ≤ 1 / multiple_plausible: candidate ≥ 2 / inconsistent_evidence: candidate 0 또는 ≥ 2)
--       + 경계 관찰(p_run.boundary_signals: [{boundary_key, probe_required, evidence_ids}])
create or replace function public.csat_ec_ai_import(p_round bigint, p_run jsonb, p_claims jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_run bigint; v_user uuid; c jsonb; s jsonb; n_primary int := 0; n_contrib int := 0; n_cand int := 0; v public.csat_ec_review_round;
        v_sid uuid := (p_run->>'session_id')::uuid; v_no smallint := (p_run->>'item_no')::smallint; v_input jsonb; v_hash text;
        v_outcome text := p_run->>'outcome';
begin
  select s2.user_id into v_user from public.csat_dx_session s2 where s2.id = v_sid for share;
  if v_user is null then raise exception 'csat_ec: 없는 세션'; end if;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || v_sid::text || '|' || v_no::text, 0));
  select * into v from public.csat_ec_review_round where id = p_round for share;
  if v.id is null or v.status <> 'draft' then raise exception 'csat_ec: AI 판정은 draft 회차의 대상에만'; end if;
  if not (v.targets @> jsonb_build_array(jsonb_build_object('session_id', v_sid, 'item_no', v_no))) then
    raise exception 'csat_ec: 이 회차의 대상이 아니다';
  end if;
  if p_run->>'taxonomy_version' is distinct from v.taxonomy_version or p_run->>'choice_trap_map' is distinct from v.choice_trap_map
     or p_run->>'quality_rule_version' is distinct from v.quality_rule_version then
    raise exception 'csat_ec: taxonomy · 대응표 · 품질 규칙은 회차 값과 같아야 한다';
  end if;
  if not public.csat_ec_pilot_eligible(v_sid, v_no) then
    raise exception 'csat_ec: Pilot 적격(품질 · 학습자 확인 · 과정 증거) 못 갖춘 응답은 적재하지 않는다';
  end if;
  v_input := public.csat_ec_canonical_input(v_sid, v_no, v.evidence_profile);
  v_hash := encode(extensions.digest(v_input::text, 'sha256'), 'hex');
  if v_outcome <> 'failed' and p_run->>'input_hash' is distinct from v_hash then
    raise exception 'csat_ec: 입력 해시가 지금 입력과 다르다';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|', p_round, v_sid, v_no, v.taxonomy_version, p_run->>'model',
                                                           p_run->>'prompt_version', p_run->>'analyzer_version', v.choice_trap_map, v_hash), 0));
  if v_outcome <> 'failed' then
    select a.id into v_run from public.csat_ec_ai_run a
     where a.round_id = p_round and a.session_id = v_sid and a.item_no = v_no and a.taxonomy_version = v.taxonomy_version
       and a.model = p_run->>'model' and a.prompt_version = p_run->>'prompt_version' and a.analyzer_version = p_run->>'analyzer_version'
       and a.choice_trap_map = v.choice_trap_map and a.input_hash = v_hash and a.outcome <> 'failed';
    if v_run is not null then
      if (select a.outcome = v_outcome and a.output = p_run->'output' from public.csat_ec_ai_run a where a.id = v_run)
         and coalesce((select jsonb_agg(jsonb_build_array(c2.code, c2.role, c2.confidence, c2.evidence) order by c2.code) from public.csat_ec_claim c2 where c2.ai_run_id = v_run), '[]')
           = coalesce((select jsonb_agg(jsonb_build_array(x->>'code', x->>'role', x->>'confidence', x->'evidence') order by x->>'code') from jsonb_array_elements(coalesce(p_claims, '[]')) x), '[]') then
        return v_run;
      end if;
      raise exception 'csat_ec: 같은 입력 · 판정기의 다른 결과가 이미 있다(실행 %)', v_run;
    end if;
  end if;
  insert into public.csat_ec_ai_run (session_id, item_no, taxonomy_version, model, prompt_version, analyzer_version, quality_rule_version,
                                     choice_trap_map, round_id, input_hash, canonical_input, outcome, output, failure)
  values (v_sid, v_no, v.taxonomy_version, p_run->>'model', p_run->>'prompt_version', p_run->>'analyzer_version', v.quality_rule_version,
          v.choice_trap_map, p_round, v_hash, v_input, v_outcome, p_run->'output', p_run->>'failure')
  returning id into v_run;
  if v_outcome in ('proposed', 'multiple_plausible', 'inconsistent_evidence') then
    for c in select * from jsonb_array_elements(coalesce(p_claims, '[]')) loop
      if left(c->>'code', 1) not in ('V', 'S', 'R', 'E') then raise exception 'csat_ec: AI 는 V/S/R/E 원인만 제안한다'; end if;
      if not exists (select 1 from public.csat_ec_code k where k.version = v.taxonomy_version and k.code = c->>'code' and k.status = 'active') then
        raise exception 'csat_ec: 사전에 없거나 폐기된 코드다(%)', c->>'code';
      end if;
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
      case c->>'role' when 'primary' then n_primary := n_primary + 1; when 'contributing' then n_contrib := n_contrib + 1;
                      when 'candidate' then n_cand := n_cand + 1; else raise exception 'csat_ec: 알 수 없는 claim 역할'; end case;
      insert into public.csat_ec_claim (session_id, item_no, user_id, source, ai_run_id, taxonomy_version, code, role, confidence, evidence)
      values (v_sid, v_no, v_user, 'ai', v_run, v.taxonomy_version, c->>'code', c->>'role', c->>'confidence', c->'evidence');
    end loop;
    if v_outcome = 'proposed' and (n_primary <> 1 or n_contrib > 1 or n_cand > 0) then
      raise exception 'csat_ec: proposed 는 primary 1 · contributing ≤ 1 · 후보 없음';
    elsif v_outcome = 'multiple_plausible' and (n_primary > 0 or n_contrib > 0 or n_cand < 2) then
      raise exception 'csat_ec: multiple_plausible 은 후보 2개 이상 · primary 없음';
    elsif v_outcome = 'inconsistent_evidence' and (n_primary > 0 or n_contrib > 0 or n_cand = 1) then
      raise exception 'csat_ec: inconsistent_evidence 는 후보 0 또는 2개 이상 · primary 없음';
    end if;
  elsif jsonb_array_length(coalesce(p_claims, '[]')) > 0 then
    raise exception 'csat_ec: 원인을 내지 않은 실행에는 claim 이 없어야 한다';
  end if;
  -- 경계 관찰(실패 실행에는 없다)
  if v_outcome <> 'failed' then
    for s in select * from jsonb_array_elements(coalesce(p_run->'boundary_signals', '[]')) loop
      insert into public.csat_ec_boundary_signal (session_id, item_no, taxonomy_version, boundary_key, boundary_status, source, ai_run_id, probe_required, evidence_ids)
      values (v_sid, v_no, v.taxonomy_version, s->>'boundary_key',
              (select b.status from public.csat_ec_boundary b where b.version = v.taxonomy_version and b.boundary_key = s->>'boundary_key'),
              'ai_run', v_run, coalesce((s->>'probe_required')::boolean, false),
              coalesce((select array_agg(e::uuid) from jsonb_array_elements_text(coalesce(s->'evidence_ids', '[]')) e), '{}'));
    end loop;
  elsif jsonb_array_length(coalesce(p_run->'boundary_signals', '[]')) > 0 then
    raise exception 'csat_ec: 실패한 실행에는 경계 관찰이 없어야 한다';
  end if;
  return v_run;
end $$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 12. 권한
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['csat_ec_boundary', 'csat_ec_boundary_signal'] loop
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;
-- 경계 정의는 코드 사전처럼 공개 정의 — 로그인 사용자 읽기. 경계 관찰은 직접 권한 없음(RPC 로만)
grant select on public.csat_ec_boundary to authenticated;
create policy csat_ec_boundary_read on public.csat_ec_boundary for select to authenticated using (true);

do $$
declare f text;
begin
  foreach f in array array[
    'csat_ec_outcomes(text)',
    'csat_ec_boundary_guard()', 'csat_ec_boundary_signal_guard()',
    'csat_ec_valid_process_evidence(uuid,smallint,text)', 'csat_ec_canonical_input(uuid,smallint,text)', 'csat_ec_judgment_input_hash(uuid,smallint,text)',
    'csat_ec_round_inputs_intact(bigint,uuid,smallint)', 'csat_ec_round_guard()', 'csat_ec_judgment_insert_guard()',
    'csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid)', 'csat_ec_my_pending_probes(uuid)',
    'csat_ec_add_detector_signal(uuid,smallint,text,text,text,boolean,uuid[])',
    'csat_ec_round_create(text,text,text,jsonb,text)', 'csat_ec_round_set_targets(bigint,jsonb)', 'csat_ec_round_start_blind(bigint)',
    'csat_ec_attach_judgment_boundaries(bigint,text[],boolean)',
    'csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean)',
    'csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text)',
    'csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean)',
    'csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text)',
    'csat_ec_round_advance(bigint,text,text)', 'csat_ec_taxonomy_seal(text)', 'csat_ec_ai_taxonomy(text)',
    'csat_ec_ai_export(bigint,uuid,smallint)', 'csat_ec_ai_import(bigint,jsonb,jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
  end loop;
end $$;

-- 학습자
grant execute on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) to authenticated;
grant execute on function public.csat_ec_my_pending_probes(uuid) to authenticated;
-- 관리자 · 판정자(함수 안에서 is_admin · 배정 확인)
grant execute on function public.csat_ec_round_create(text,text,text,jsonb,text) to authenticated;
grant execute on function public.csat_ec_round_set_targets(bigint,jsonb) to authenticated;
grant execute on function public.csat_ec_round_start_blind(bigint) to authenticated;
grant execute on function public.csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean) to authenticated;
grant execute on function public.csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text) to authenticated;
grant execute on function public.csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text,text[],text[],boolean) to authenticated;
grant execute on function public.csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text) to authenticated;
grant execute on function public.csat_ec_round_advance(bigint,text,text) to authenticated;
grant execute on function public.csat_ec_taxonomy_seal(text) to authenticated;
-- 파이프라인(service_role) — 사람 blind 판정 · 학생 범주 보고는 여전히 읽지 못한다
grant execute on function public.csat_ec_ai_export(bigint,uuid,smallint) to service_role;
grant execute on function public.csat_ec_ai_taxonomy(text) to service_role;
grant execute on function public.csat_ec_ai_import(bigint,jsonb,jsonb) to service_role;
grant execute on function public.csat_ec_add_detector_signal(uuid,smallint,text,text,text,boolean,uuid[]) to service_role;
-- csat_ec_outcomes · 내부 계산 함수 · 가드 · csat_ec_attach_judgment_boundaries 는 직접 실행 권한 없음(definer 함수 · CHECK 안에서만)

commit;
