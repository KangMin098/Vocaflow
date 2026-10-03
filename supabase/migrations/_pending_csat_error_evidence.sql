-- supabase/migrations/_pending_csat_error_evidence.sql
--
-- 오답 원인 Evidence 모델 — 물리 스키마 초안(2026-10-03). **적용하지 않는다(_pending_).** 승인 뒤 버전 번호를 붙여 옮긴다.
-- 설계: docs/csat-learner/ERROR_EVIDENCE_DESIGN.md §15 · 되돌리기: _pending_csat_error_evidence.rollback.sql
--
-- 원칙
--   · 응답(원 기록) → 입력 품질 → 수행 증거 → 오답 원인 → (별도) 직접 진단. 이 파일은 「수행 증거 · 오답 원인」 층만 만든다.
--   · 원인 claim 은 attempt 하나에 대한 가설이다 — 학생 역량 상태를 저장하지 않고, V/S/R/E/L 을 바꾸는 트리거도 없다.
--   · 접근은 전부 SECURITY DEFINER RPC 로만. 표 직접 권한은 학습자 자기 행 읽기 · 사전 읽기뿐이다(anon · authenticated · service_role 모두 회수 후 최소 부여).
--     service_role 은 RLS 를 우회하므로 **GRANT 자체를 주지 않는 것**으로 막는다(AI 파이프라인이 사람 blind 판정을 읽지 못하게).
--   · 테이블 분류: [event] INSERT 만 · [versioned] 새 revision 으로만 바뀜 · [workflow] 정해진 컬럼만 정해진 방향으로.
--
-- 테이블 9개(§15 B — reviewers jsonb 대신 배정 테이블 복원)
--   1 csat_ec_taxonomy_version  [workflow: draft → sealed]
--   2 csat_ec_code              [versioned: 봉인된 버전의 행은 불변]
--   3 csat_ec_ai_run            [event]
--   4 csat_ec_claim             [event: 학생 범주 보고 · AI 제안 — 상태 컬럼 없음, 판정은 7 에 이벤트로]
--   5 csat_ec_review_round      [workflow: draft → blind_review → reveal → adjudication → closed | cancelled]
--   6 csat_ec_review_assignment [event: draft 에서만 추가]
--   7 csat_ec_judgment          [event: blind · verify · adjudication]
--   8 csat_ec_session_confirmation [versioned: revision]
--   9 csat_ec_process_evidence  [event: supersede 로만 정정]

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. taxonomy 버전
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_taxonomy_version (
  version          text primary key check (version ~ '^v[0-9]+\.[0-9]+$'),   -- 'v0.1'
  status           text not null default 'draft' check (status in ('draft', 'sealed')),
  definitions_hash text,                                                    -- 봉인 때 코드 정의 전체의 sha256
  note             text,
  created_at       timestamptz not null default now(),
  sealed_at        timestamptz,
  check ((status = 'sealed') = (sealed_at is not null and definitions_hash is not null))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. 원인 코드(버전별 정의 — 과거 의미를 재현할 수 있게 전부 행에 둔다)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_code (
  version        text not null references public.csat_ec_taxonomy_version(version) on delete restrict,
  code           text not null check (code ~ '^[VSREBX]\.[a-z_]+$'),
  axis           text not null check (axis in ('V', 'S', 'R', 'E', 'B', 'X')),
  label          text not null,
  definition     text not null,
  inclusion      text not null,          -- 이 코드를 고르려면 있어야 하는 근거
  exclusion      text not null,          -- 인접 코드와 가르는 기준 · 이 코드가 아닌 경우
  student_group  text check (student_group in ('word', 'sentence', 'flow', 'evidence', 'choice', 'time')),  -- 자기보고 상위 범주(B 는 NULL)
  status         text not null default 'active' check (status in ('active', 'deprecated')),   -- 그 버전 안에서의 상태(봉인 뒤 불변)
  primary key (version, code),
  check (left(code, 1) = axis),
  check (axis = 'B' or student_group is not null)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AI 실행 — 입력은 원문 복사 대신 참조 + 정규화 해시. 학생 자유서술은 필요한 최소만(§10)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_ai_run (
  id                    bigint generated always as identity primary key,
  session_id            uuid not null,
  item_no               smallint not null,
  foreign key (session_id, item_no) references public.csat_dx_response(session_id, item_no) on delete cascade,
  taxonomy_version      text not null references public.csat_ec_taxonomy_version(version) on delete restrict,
  model                 text not null,
  prompt_version        text not null,
  analyzer_version      text not null,
  quality_rule_version  text not null,            -- 대상 선정에 쓴 Record Quality 규칙(rq-1 …)
  choice_trap_map       text not null,            -- 'v0.1:<sha256>' — 저장소 JSON 의 버전 · 내용 해시
  input_hash            text not null check (input_hash ~ '^[0-9a-f]{64}$'),   -- 판정 입력 해시(csat_ec_judgment_input_hash — 문항 해시 + 유효 과정 증거 + 품질 규칙)
  input_refs            jsonb not null,           -- 참조만: {item_id, process_evidence_ids[], chosen_option} — 원문은 문항 표에서
  outcome               text not null check (outcome in ('proposed', 'no_cause', 'insufficient_evidence', 'no_fitting_code', 'failed')),
  output                jsonb not null,           -- 모델 출력 원문(검증 전) — 감사용
  failure               text,
  created_at            timestamptz not null default now(),
  check ((outcome = 'failed') = (failure is not null))
);
create index csat_ec_ai_run_response on public.csat_ec_ai_run (session_id, item_no, id desc);
-- 같은 판정 입력 · 같은 판정기(모델 · 프롬프트 · 분석기 · 대응표 · taxonomy)로는 성공 실행 한 번 — 판정기를 바꾼 재판정은 새 행
create unique index csat_ec_ai_run_success_once on public.csat_ec_ai_run
  (session_id, item_no, taxonomy_version, model, prompt_version, analyzer_version, choice_trap_map, input_hash) where outcome <> 'failed';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. 원인 claim — attempt 하나에 대한 가설. source = student(범주 자기보고) | ai(제안). 사람 판정은 7 에.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_claim (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null,
  item_no           smallint not null,
  foreign key (session_id, item_no) references public.csat_dx_response(session_id, item_no) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,   -- 응답 소유자(학생)
  source            text not null check (source in ('student', 'ai')),
  ai_run_id         bigint references public.csat_ec_ai_run(id) on delete cascade,
  taxonomy_version  text not null references public.csat_ec_taxonomy_version(version) on delete restrict,
  code              text,
  foreign key (taxonomy_version, code) references public.csat_ec_code(version, code) on delete restrict,
  student_group     text check (student_group in ('word', 'sentence', 'flow', 'evidence', 'choice', 'time', 'unsure')),
  role              text not null check (role in ('primary', 'contributing')),
  confidence        text check (confidence in ('low', 'medium', 'high')),
  evidence          jsonb not null default '{}',   -- AI: text_refs · summary / 학생: 없음(과정 증거는 9)
  supersedes_id     uuid references public.csat_ec_claim(id) on delete cascade,   -- 학생 정정 — 원래 행은 남는다
  item_input_hash   text check (item_input_hash ~ '^[0-9a-f]{64}$'),             -- 학생 보고: 작성 당시 문항 해시(서버 계산)
  created_at        timestamptz not null default now(),
  check ((source = 'student') = (item_input_hash is not null)),
  check ((source = 'ai') = (ai_run_id is not null)),
  check (source <> 'ai' or (code is not null and confidence is not null)),
  check (source <> 'student' or (confidence is null and student_group is not null and role = 'primary'))
);
create unique index csat_ec_claim_ai_code on public.csat_ec_claim (ai_run_id, code) where source = 'ai';
create unique index csat_ec_claim_ai_primary on public.csat_ec_claim (ai_run_id) where source = 'ai' and role = 'primary';
create unique index csat_ec_claim_supersede_once on public.csat_ec_claim (supersedes_id) where supersedes_id is not null;   -- 정정은 선형(가지치기 금지)
create unique index csat_ec_claim_student_root_once on public.csat_ec_claim (session_id, item_no) where source = 'student' and supersedes_id is null;   -- 첫 보고는 하나 → 활성 보고는 항상 체인의 끝 하나
create index csat_ec_claim_response on public.csat_ec_claim (session_id, item_no);
create index csat_ec_claim_user on public.csat_ec_claim (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. 검수 회차 — 시작(blind_review) 뒤 입력 봉인
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_review_round (
  id                    bigint generated always as identity primary key,
  status                text not null default 'draft'
                        check (status in ('draft', 'blind_review', 'reveal', 'adjudication', 'closed', 'cancelled')),
  taxonomy_version      text not null references public.csat_ec_taxonomy_version(version) on delete restrict,
  quality_rule_version  text not null,                -- rq-1 재현성(§15 G)
  choice_trap_map       text not null,                -- 'v0.1:<sha256>'
  eligibility           jsonb not null,               -- 선정 조건(품질 · 과정 증거 기준 · 유형 분산 등)
  targets               jsonb not null default '[]',  -- [{session_id, item_no, item_id, input_hash, confirmation_revision, process_evidence_ids[], quality:{status,signals}, ai_run_id, claim_ids[]}]
  targets_hash          text,                         -- 정규화한 targets 의 sha256 — blind 시작 때 채운다
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  blind_started_at      timestamptz,
  revealed_at           timestamptz,
  adjudication_at       timestamptz,
  closed_at             timestamptz,
  cancelled_at          timestamptz,
  cancel_reason         text,
  check (jsonb_typeof(targets) = 'array'),
  check (blind_started_at is null or targets_hash is not null),
  check (status in ('draft', 'cancelled') or blind_started_at is not null),   -- draft 에서 바로 취소(대상 삭제 등)도 허용
  check ((status = 'cancelled') = (cancelled_at is not null))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. 판정자 배정 — 회차 × 사람. reviewer_key 는 계정 삭제 뒤에도 남는 고정 식별
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_review_assignment (
  round_id      bigint not null references public.csat_ec_review_round(id) on delete restrict,
  reviewer_key  text not null,                                             -- 'user:<uuid>' — 생성 때 고정
  reviewer_id   uuid references auth.users(id) on delete set null,         -- 계정이 지워지면 NULL(기록은 남는다)
  slot          text not null check (slot in ('A', 'B', 'adjudicator')),
  pre_disclosed_items text[] not null default '{}',                        -- DB 밖에서 이미 본 문항(독립성 표시용)
  created_at    timestamptz not null default now(),
  primary key (round_id, reviewer_key),
  unique (round_id, slot)
);
create index csat_ec_assignment_reviewer on public.csat_ec_review_assignment (reviewer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. 판정 — blind(응답 단위 독립 판정) · verify(claim 에 대한 동의) · adjudication(합의 결과). 덮어쓰지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_judgment (
  id                bigint generated always as identity primary key,
  round_id          bigint not null references public.csat_ec_review_round(id) on delete restrict,
  session_id        uuid not null,
  item_no           smallint not null,
  foreign key (session_id, item_no) references public.csat_dx_response(session_id, item_no) on delete cascade,
  reviewer_key      text not null,
  foreign key (round_id, reviewer_key) references public.csat_ec_review_assignment(round_id, reviewer_key) on delete restrict,
  phase             text not null check (phase in ('blind', 'verify', 'adjudication')),
  taxonomy_version  text not null references public.csat_ec_taxonomy_version(version) on delete restrict,
  outcome           text check (outcome in ('code', 'no_cause', 'insufficient_evidence', 'no_fitting_code')),   -- blind · adjudication
  primary_code      text,
  foreign key (taxonomy_version, primary_code) references public.csat_ec_code(version, code) on delete restrict,
  contributing_codes text[] not null default '{}',
  excluded_axes     text[] not null default '{}' check (excluded_axes <@ array['V', 'S', 'R', 'E']),
  claim_id          uuid references public.csat_ec_claim(id) on delete cascade,                               -- verify 만
  verdict           text check (verdict in ('accept', 'reject', 'unsure')),                                     -- verify 만
  independent       boolean not null default true,     -- blind: 제출 시점에 같은 문항 공개 이력이 없었는가
  note              text not null check (length(btrim(note)) > 0),
  created_at        timestamptz not null default now(),
  check (phase = 'verify' or (outcome is not null and claim_id is null and verdict is null)),
  check (phase <> 'verify' or (claim_id is not null and verdict is not null and outcome is null and primary_code is null
                               and cardinality(contributing_codes) = 0 and cardinality(excluded_axes) = 0)),
  check (outcome is distinct from 'code' or primary_code is not null),
  check (outcome = 'code' or (primary_code is null and cardinality(contributing_codes) = 0)),    -- 근거 부족이면 primary 를 요구하지 않는다
  check (not (primary_code = any (contributing_codes)))
);
create unique index csat_ec_judgment_blind_once on public.csat_ec_judgment (round_id, session_id, item_no, reviewer_key) where phase = 'blind';
create unique index csat_ec_judgment_verify_once on public.csat_ec_judgment (round_id, claim_id, reviewer_key) where phase = 'verify';
create unique index csat_ec_judgment_adjudication_once on public.csat_ec_judgment (round_id, session_id, item_no) where phase = 'adjudication';   -- 합의 결과는 응답당 하나(고치려면 새 회차)
create index csat_ec_judgment_round on public.csat_ec_judgment (round_id, session_id, item_no);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. 학습자 확인 — 품질 상태(rq-*)와 별개 개념. 품질 계산값을 바꾸지 않는다.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_session_confirmation (
  session_id    uuid not null references public.csat_dx_session(id) on delete cascade,
  revision      int not null check (revision >= 1),
  user_id       uuid not null references auth.users(id) on delete cascade,
  took_exam     boolean not null,
  judged_each   boolean not null,
  answers_hash  text not null check (answers_hash ~ '^[0-9a-f]{64}$'),   -- 확인 당시 응답 45개 해시 — 응답이 바뀌면 무효
  created_at    timestamptz not null default now(),
  primary key (session_id, revision),
  check (took_exam or not judged_each)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. 풀이 과정 증거 — attempt 당 여러 개. 위치는 문장 참조 우선(복사 대신)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.csat_ec_process_evidence (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null,
  item_no         smallint not null,
  foreign key (session_id, item_no) references public.csat_dx_response(session_id, item_no) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null check (kind in ('confidence', 'reason', 'blocked_span', 'category', 'note')),
  value           jsonb not null,
  -- blocked_span: {"item_id":"M2509#24","part":"passage|stem|option","option":null,"sentence":3,"start":12,"end":31}
  item_input_hash text not null check (item_input_hash ~ '^[0-9a-f]{64}$'),   -- 작성 당시 문항 · 채점 정답 · 고른 답(서버 계산 — csat_ec_item_input_hash)
  supersedes_id   uuid references public.csat_ec_process_evidence(id) on delete cascade,
  created_at      timestamptz not null default now(),
  check (jsonb_typeof(value) = 'object'),
  -- NULL 로 통과하지 않게 coalesce 로 명시 비교한다
  check (kind <> 'confidence' or coalesce(value->>'level', '') in ('sure', 'unsure', 'guess')),
  check (kind <> 'category' or coalesce(value->>'group', '') in ('word', 'sentence', 'flow', 'evidence', 'choice', 'time', 'unsure')),
  check (kind not in ('reason', 'note') or coalesce(jsonb_typeof(value->'text') = 'string' and length(btrim(value->>'text')) between 1 and 500, false)),
  check (kind <> 'blocked_span' or coalesce((
    jsonb_typeof(value->'item_id') = 'string' and coalesce(value->>'part', '') in ('passage', 'stem', 'option')
    and jsonb_typeof(value->'sentence') = 'number' and (value->>'sentence')::int >= 0
    and jsonb_typeof(value->'start') = 'number' and jsonb_typeof(value->'end') = 'number'   -- 검증 가능한 문자 범위 필수
    and (value->>'start')::int >= 0 and (value->>'start')::int < (value->>'end')::int
    and (value->>'part' <> 'option' or coalesce((value->>'option')::int, 0) between 1 and 5)), false))
);
create unique index csat_ec_process_supersede_once on public.csat_ec_process_evidence (supersedes_id) where supersedes_id is not null;
create index csat_ec_process_response on public.csat_ec_process_evidence (session_id, item_no);
create index csat_ec_process_user on public.csat_ec_process_evidence (user_id);

-- ═════════════════════════════════════════════════════════════════════════════
-- 불변 · 상태 전이 트리거
-- ═════════════════════════════════════════════════════════════════════════════

-- [event] 테이블 공통 — UPDATE 금지(예외는 아래 개별 함수). DELETE 는 GRANT 가 없어 직접 불가, FK 연쇄 삭제만 통과한다.
create or replace function public.csat_ec_forbid_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'csat_ec: % 는 덧붙이기 전용이다(UPDATE 금지)', tg_table_name using errcode = 'check_violation';
end $$;

create trigger csat_ec_ai_run_no_update before update on public.csat_ec_ai_run for each row execute function public.csat_ec_forbid_update();
create trigger csat_ec_claim_no_update before update on public.csat_ec_claim for each row execute function public.csat_ec_forbid_update();
create trigger csat_ec_confirmation_no_update before update on public.csat_ec_session_confirmation for each row execute function public.csat_ec_forbid_update();
create trigger csat_ec_process_no_update before update on public.csat_ec_process_evidence for each row execute function public.csat_ec_forbid_update();

-- 배정 · 판정: reviewer_id → NULL(계정 삭제) 만 허용
create or replace function public.csat_ec_only_reviewer_null() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'reviewer_id') is distinct from (to_jsonb(old) - 'reviewer_id')
     or (new.reviewer_id is not null and new.reviewer_id is distinct from old.reviewer_id) then
    raise exception 'csat_ec: % 는 계정 삭제에 따른 reviewer_id NULL 전환만 허용', tg_table_name using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger csat_ec_assignment_guard before update on public.csat_ec_review_assignment for each row execute function public.csat_ec_only_reviewer_null();
create trigger csat_ec_judgment_no_update before update on public.csat_ec_judgment for each row execute function public.csat_ec_forbid_update();
-- 판정 표에는 reviewer_id 가 없다(reviewer_key 만) — 계정 삭제가 판정을 건드리지 않는다

-- taxonomy: draft → sealed 한 번. 봉인된 버전의 코드는 추가 · 수정 · 삭제 불가
create or replace function public.csat_ec_taxonomy_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'csat_ec: taxonomy 버전은 지우지 않는다';
  end if;
  if old.status = 'sealed' then
    raise exception 'csat_ec: 봉인된 taxonomy % 는 바꿀 수 없다 — 새 버전을 만든다', old.version;
  end if;
  if new.version <> old.version or new.created_at <> old.created_at then
    raise exception 'csat_ec: taxonomy 식별 컬럼은 바꿀 수 없다';
  end if;
  return new;
end $$;
create trigger csat_ec_taxonomy_guard before update or delete on public.csat_ec_taxonomy_version for each row execute function public.csat_ec_taxonomy_guard();

create or replace function public.csat_ec_code_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_status text;
begin
  -- 봉인과 경쟁하지 않게 부모 버전 행을 잠그고 확인한다 — 옮기는 UPDATE 는 OLD · NEW 버전 둘 다 본다
  if tg_op in ('UPDATE', 'DELETE') then
    select status into v_status from public.csat_ec_taxonomy_version where version = old.version for update;
    if v_status = 'sealed' then raise exception 'csat_ec: 봉인된 taxonomy % 의 코드는 바꿀 수 없다', old.version; end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select status into v_status from public.csat_ec_taxonomy_version where version = new.version for update;
    if v_status = 'sealed' then raise exception 'csat_ec: 봉인된 taxonomy % 에 코드를 더할 수 없다', new.version; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger csat_ec_code_guard before insert or update or delete on public.csat_ec_code for each row execute function public.csat_ec_code_guard();

-- 검수 회차: 상태는 앞으로만. blind_review 이후 입력 컬럼 불변
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
create trigger csat_ec_round_guard before update or delete on public.csat_ec_review_round for each row execute function public.csat_ec_round_guard();

-- 배정은 draft 회차에만 추가
create or replace function public.csat_ec_assignment_insert_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_status text;
begin
  select status into v_status from public.csat_ec_review_round where id = new.round_id for update;
  if v_status <> 'draft' then raise exception 'csat_ec: 시작된 회차에는 판정자를 더할 수 없다'; end if;
  return new;
end $$;
create trigger csat_ec_assignment_insert_guard before insert on public.csat_ec_review_assignment for each row execute function public.csat_ec_assignment_insert_guard();

-- 판정 insert 는 회차 상태와 단계가 맞아야 한다(RPC 를 거치지 않은 경로에 대한 2차 방어선)
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
create trigger csat_ec_judgment_insert_guard before insert on public.csat_ec_judgment for each row execute function public.csat_ec_judgment_insert_guard();

-- 대상 응답이 지워지면(학습자 기록 삭제) 그 응답을 대상으로 둔 열린 회차를 취소한다 — 회차 · 다른 학생 데이터는 지우지 않는다
create or replace function public.csat_ec_cancel_rounds_on_response_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.csat_ec_review_round r
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'target_deleted'
   where r.status not in ('closed', 'cancelled')
     and r.targets @> jsonb_build_array(jsonb_build_object('session_id', old.session_id, 'item_no', old.item_no));
  return old;
end $$;
create trigger csat_ec_cancel_rounds_on_response_delete before delete on public.csat_dx_response
  for each row execute function public.csat_ec_cancel_rounds_on_response_delete();

-- 학습자 확인이 새 revision 으로 바뀌면 그 세션이 대상인 열린 회차를 취소한다(봉인된 revision 과 달라졌으므로)
create or replace function public.csat_ec_cancel_rounds_on_confirmation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.csat_ec_review_round r
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'confirmation_changed'
   where r.status not in ('closed', 'cancelled')
     and r.targets @> jsonb_build_array(jsonb_build_object('session_id', new.session_id));
  return new;
end $$;
create trigger csat_ec_cancel_rounds_on_confirmation after insert on public.csat_ec_session_confirmation
  for each row execute function public.csat_ec_cancel_rounds_on_confirmation();

-- 학생 정정은 자기 행만 · 같은 응답 안에서만
create or replace function public.csat_ec_supersede_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v record;
begin
  if new.supersedes_id is null then return new; end if;
  if tg_table_name = 'csat_ec_claim' then
    select session_id, item_no, user_id, source as k into v from public.csat_ec_claim where id = new.supersedes_id;
    if v.k <> 'student' or new.source <> 'student' then raise exception 'csat_ec: 정정은 학생 보고끼리만'; end if;
  else
    select session_id, item_no, user_id, kind as k into v from public.csat_ec_process_evidence where id = new.supersedes_id;
    if v.k <> new.kind then raise exception 'csat_ec: 과정 증거 정정은 같은 종류끼리만'; end if;
  end if;
  if v.session_id <> new.session_id or v.item_no <> new.item_no or v.user_id <> new.user_id then
    raise exception 'csat_ec: 정정은 같은 학생 · 같은 응답의 행만';
  end if;
  return new;
end $$;
create trigger csat_ec_claim_supersede before insert on public.csat_ec_claim for each row execute function public.csat_ec_supersede_guard();
create trigger csat_ec_process_supersede before insert on public.csat_ec_process_evidence for each row execute function public.csat_ec_supersede_guard();

-- ═════════════════════════════════════════════════════════════════════════════
-- 권한 — 전부 회수한 뒤 최소 부여. 직접 DELETE · TRUNCATE 는 어떤 역할에도 없다.
-- ═════════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array['csat_ec_taxonomy_version','csat_ec_code','csat_ec_ai_run','csat_ec_claim','csat_ec_review_round',
                           'csat_ec_review_assignment','csat_ec_judgment','csat_ec_session_confirmation','csat_ec_process_evidence'] loop
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- 사전은 공개 정의라 로그인 사용자 읽기
grant select on public.csat_ec_taxonomy_version, public.csat_ec_code to authenticated;
create policy csat_ec_taxonomy_read on public.csat_ec_taxonomy_version for select to authenticated using (true);
create policy csat_ec_code_read on public.csat_ec_code for select to authenticated using (true);

-- 학습자: 자기 확인 · 자기 과정 증거 · 자기 범주 보고만 읽기(쓰기는 RPC)
grant select on public.csat_ec_session_confirmation, public.csat_ec_process_evidence, public.csat_ec_claim to authenticated;
create policy csat_ec_confirmation_own on public.csat_ec_session_confirmation for select to authenticated using (user_id = (select auth.uid()));
create policy csat_ec_process_own on public.csat_ec_process_evidence for select to authenticated using (user_id = (select auth.uid()));
create policy csat_ec_claim_own_student on public.csat_ec_claim for select to authenticated using (user_id = (select auth.uid()) and source = 'student');
-- ai_run · review_round · assignment · judgment: 직접 권한 없음(정책도 없음 → FORCE RLS 로 0행). 판정자 · 관리자 · 파이프라인은 RPC 로만.

-- ═════════════════════════════════════════════════════════════════════════════
-- RPC — security definer · search_path='' · 생성 직후 실행 권한 회수 → 필요한 역할에만 부여
-- ═════════════════════════════════════════════════════════════════════════════

-- 내부: 호출자의 고정 판정자 키
create or replace function public.csat_ec_my_key() returns text
language sql stable set search_path = '' as $$ select 'user:' || (select auth.uid())::text $$;

-- 공통 계산 ─────────────────────────────────────────────────────────────────────
-- Record Quality rq-1 — apps/web/src/lib/csat/diagnosis/engine/record-quality.ts 와 같은 규칙(동치 테스트로 지킨다).
--   답한 문항 < 20 → trusted · 고른 번호가 한 종류 → excluded_pending_review · 최빈 비율 ≥ 0.9 또는 같은 번호 최장 연속 ≥ 15 → suspicious
create or replace function public.csat_ec_record_quality_rq1(p_session uuid) returns text
language sql stable set search_path = '' as $$
  with a as (
    select item_no, chosen_option as c, row_number() over (order by item_no) as rn
      from public.csat_dx_response where session_id = p_session and chosen_option is not null
  ), runs as (
    select count(*) as n from (select c, rn - row_number() over (partition by c order by item_no) as grp from a) x group by c, grp
  ), stats as (
    select count(*) as answered, count(distinct c) as kinds,
           coalesce((select max(cnt) from (select count(*) as cnt from a group by c) y), 0) as top
      from a
  )
  select case
    when s.answered < 20 then 'trusted'
    when s.kinds = 1 then 'excluded_pending_review'
    when s.top::numeric / s.answered >= 0.9 or coalesce((select max(n) from runs), 0) >= 15 then 'suspicious'
    else 'trusted' end
  from stats s
$$;

-- 응답 하나의 유효 정답 — 해시 · 판정자 큐 · AI 입력이 모두 이것만 쓴다(채점 로직과 같은 규칙)
--   시험 기록: 채점 정본 csat_dx_answer_key.answers · 진단 테스트(exam_id 없음): 문항 answers(비어 있으면 answer)
create or replace function public.csat_ec_effective_answer(p_session uuid, p_item_no smallint) returns jsonb
language sql stable set search_path = '' as $$
  select case when s.exam_id is not null then to_jsonb(k.answers)
              when coalesce(cardinality(i.answers), 0) > 0 then to_jsonb(i.answers)
              else to_jsonb(array[i.answer]) end
    from public.csat_dx_response r
    join public.csat_dx_session s on s.id = r.session_id
    left join public.csat_items i on i.id = r.item_id
    left join public.csat_dx_answer_key k on k.exam_id = s.exam_id and k.no = r.item_no
   where r.session_id = p_session and r.item_no = p_item_no
$$;

-- 응답 하나의 판정 입력 해시(서버 계산) — 문항 원문 · 채점 정답 · 고른 답
create or replace function public.csat_ec_item_input_hash(p_session uuid, p_item_no smallint) returns text
language sql stable set search_path = '' as $$
  -- jsonb 배열로 묶어 NULL · 필드 경계를 보존한다. 정답: 시험 기록 = 채점 정본(csat_dx_answer_key), 진단 테스트(exam_id 없음) = 문항 정답
  select encode(extensions.digest(jsonb_build_array(r.item_id, i.stem, i.passage, i.choices,
           public.csat_ec_effective_answer(p_session, p_item_no), r.chosen_option,
           -- 선지별 함정 원값(csat_dx_option_trap) — 태깅이 바뀌면 판정 입력도 바뀐 것이다(표준 코드 대응은 choice_trap_map 버전으로 따로 봉인)
           (select coalesce(jsonb_agg(jsonb_build_array(o.option_no, o.trap_key) order by o.option_no), '[]')
              from public.csat_dx_option_trap o where o.item_id = r.item_id))::text, 'sha256'), 'hex')
    from public.csat_dx_response r
    join public.csat_dx_session s on s.id = r.session_id
    left join public.csat_items i on i.id = r.item_id
    left join public.csat_dx_answer_key k on k.exam_id = s.exam_id and k.no = r.item_no
   where r.session_id = p_session and r.item_no = p_item_no
$$;

-- 유효한 과정 증거 — 정정되지 않았고, 작성 당시 문항 해시가 지금과 같고, 범주 보고(category)가 아닌 것
create or replace function public.csat_ec_valid_process_evidence(p_session uuid, p_item_no smallint)
returns table (id uuid, kind text, value jsonb, created_at timestamptz)
language sql stable set search_path = '' as $$
  select p.id, p.kind, p.value, p.created_at
    from public.csat_ec_process_evidence p
   where p.session_id = p_session and p.item_no = p_item_no and p.kind <> 'category'
     and p.item_input_hash = public.csat_ec_item_input_hash(p_session, p_item_no)
     and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id)
$$;

-- 판정 입력 해시 — 문항 해시 + 유효 과정 증거(id · 종류 · 값, 작성순) + 품질 규칙
create or replace function public.csat_ec_judgment_input_hash(p_session uuid, p_item_no smallint) returns text
language sql stable set search_path = '' as $$
  select encode(extensions.digest(concat_ws('|', public.csat_ec_item_input_hash(p_session, p_item_no), 'rq-1',
           coalesce((select jsonb_agg(jsonb_build_array(e.id, e.kind, e.value) order by e.created_at, e.id)
                       from public.csat_ec_valid_process_evidence(p_session, p_item_no) e)::text, '[]')), 'sha256'), 'hex')
$$;

-- Pilot 적격 — 입력 품질 trusted · 최신 학습자 확인이 「응시 · 선지별 판단」이고 지금 응답과 같은 답안 · 유효 과정 증거에 reason 이 있다
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

-- 회차 입력이 봉인 때와 같은가 — 대상마다 Pilot 적격 · 판정 입력 해시 · 최신 학습자 확인 revision 이 봉인값과 같아야 한다.
-- p_session/p_item_no 를 주면 그 대상만, NULL 이면 전부.
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

-- 학습자 ─────────────────────────────────────────────────────────────────────
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

-- 관리자: 회차 ───────────────────────────────────────────────────────────────
create or replace function public.csat_ec_round_create(p_taxonomy text, p_quality_rule text, p_choice_trap_map text, p_eligibility jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  if not exists (select 1 from public.csat_ec_taxonomy_version where version = p_taxonomy and status = 'sealed') then
    raise exception 'csat_ec: 봉인된 taxonomy 로만 회차를 만든다';
  end if;
  if p_quality_rule is distinct from 'rq-1' then raise exception 'csat_ec: 이 DB 가 아는 품질 규칙은 rq-1 뿐이다'; end if;
  if coalesce(p_choice_trap_map, '') !~ '^v[0-9]+\.[0-9]+:[0-9a-f]{64}$' then raise exception 'csat_ec: choice_trap_map 은 「v0.1:<sha256>」 형식'; end if;
  insert into public.csat_ec_review_round (taxonomy_version, quality_rule_version, choice_trap_map, eligibility, created_by)
  values (p_taxonomy, p_quality_rule, p_choice_trap_map, coalesce(p_eligibility, '{}'), (select auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- 대상 채우기(draft 만) — 관리자는 (session_id, item_no) 목록만 준다. 해시 · 확인 revision · 유효 과정 증거 · 품질 신호 ·
-- 최신 성공 AI 실행 · 봉인할 claim(학생 활성 보고 + 그 실행의 AI claim)은 서버가 계산한다(클라이언트 값을 봉인하지 않는다)
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
           'quality', jsonb_build_object('rule', 'rq-1', 'status', public.csat_ec_record_quality_rq1(r.session_id)),
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
       where a.session_id = r.session_id and a.item_no = r.item_no and a.taxonomy_version = v.taxonomy_version
         and a.outcome <> 'failed' and a.quality_rule_version = v.quality_rule_version and a.choice_trap_map = v.choice_trap_map
         and a.input_hash = public.csat_ec_judgment_input_hash(r.session_id, r.item_no)
       order by a.id desc limit 1) ar on true;
  if jsonb_array_length(v_targets) <> (select count(distinct ((x->>'session_id'), (x->>'item_no'))) from jsonb_array_elements(p_refs) x) then
    raise exception 'csat_ec: 없는 응답이 대상에 있다';
  end if;
  update public.csat_ec_review_round set targets = v_targets where id = p_round;
  return jsonb_array_length(v_targets);
end $$;

create or replace function public.csat_ec_round_assign(p_round bigint, p_reviewer uuid, p_slot text, p_pre_disclosed text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  if not exists (select 1 from auth.users where id = p_reviewer) then raise exception 'csat_ec: 없는 사용자'; end if;
  -- 판정자는 대상 응답의 학생이 아니어야 한다
  if exists (select 1 from public.csat_ec_review_round r, jsonb_array_elements(r.targets) t
              join public.csat_dx_session s on s.id = (t->>'session_id')::uuid
              where r.id = p_round and s.user_id = p_reviewer) then
    raise exception 'csat_ec: 자기 응답을 판정할 수 없다';
  end if;
  insert into public.csat_ec_review_assignment (round_id, reviewer_key, reviewer_id, slot, pre_disclosed_items)
  values (p_round, 'user:' || p_reviewer::text, p_reviewer, p_slot, p_pre_disclosed);
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
                      select 1 from public.csat_ec_ai_run a where a.id = (t->>'ai_run_id')::bigint and a.session_id = r.session_id
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

-- 판정자: blind ───────────────────────────────────────────────────────────────
-- blind 단계에서 판정자가 받는 것: 대상 응답 · 문항 참조 · 과정 증거. AI 제안 · 학생 범주 보고 · 다른 판정자 판정은 주지 않는다.
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

-- 관리자: reveal — A · B 의 blind 판정이 모든 대상에 대해 있어야만
create or replace function public.csat_ec_round_reveal(p_round bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.csat_ec_review_round; v_key text;
begin
  if not public.is_admin() then raise exception 'csat_ec: 관리자만'; end if;
  select * into v from public.csat_ec_review_round where id = p_round for update;   -- 진행 중인 blind 제출(FOR SHARE)이 끝날 때까지 기다린다
  if v.status <> 'blind_review' then raise exception 'csat_ec: blind 단계가 아니다'; end if;
  if exists (
      select 1 from jsonb_array_elements(v.targets) t cross join public.csat_ec_review_assignment a
       where a.round_id = p_round and a.slot in ('A', 'B')
         and not exists (select 1 from public.csat_ec_judgment j
                          where j.round_id = p_round and j.phase = 'blind' and j.reviewer_key = a.reviewer_key
                            and j.session_id = (t->>'session_id')::uuid and j.item_no = (t->>'item_no')::smallint)) then
    raise exception 'csat_ec: 모든 대상에 A · B blind 판정이 있어야 공개한다';
  end if;
  if not public.csat_ec_round_inputs_intact(p_round) then
    raise exception 'csat_ec: 봉인 뒤 입력이 바뀌었다 — 회차를 취소하고 다시 만든다';
  end if;
  -- 이 회차 배정자 × 대상 문항 잠금 — 다른 회차에서 같은 판정자가 같은 문항을 제출 중이면 끝날 때까지 기다린다
  for v_key in
    select distinct a.reviewer_key || '|' || (t->>'item_id')
      from public.csat_ec_review_assignment a, jsonb_array_elements(v.targets) t
     where a.round_id = p_round
     order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
  end loop;
  update public.csat_ec_review_round set status = 'reveal', revealed_at = now() where id = p_round;
end $$;

-- 판정자: reveal 이후 비교 자료(두 판정 · AI 제안 · 학생 범주 보고)
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

create or replace function public.csat_ec_submit_verify(p_round bigint, p_claim uuid, p_verdict text, p_note text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_round public.csat_ec_review_round; v_c public.csat_ec_claim; v_id bigint;
begin
  if not exists (select 1 from public.csat_ec_review_assignment a
                  where a.round_id = p_round and a.reviewer_id = (select auth.uid()) and a.slot in ('A', 'B')) then
    raise exception 'csat_ec: 배정된 판정자가 아니다';
  end if;
  select * into v_c from public.csat_ec_claim where id = p_claim;
  perform 1 from public.csat_dx_session where id = v_c.session_id for share;   -- 세션 → 회차(교착 방지)
  select * into v_round from public.csat_ec_review_round where id = p_round for share;
  -- 봉인된 대상의 claim 만(회차 도중 새 AI 실행 · 새 정정은 다음 회차)
  if not exists (select 1 from jsonb_array_elements(v_round.targets) t
                  where (t->>'session_id')::uuid = v_c.session_id and (t->>'item_no')::smallint = v_c.item_no
                    and t->'claim_ids' ? p_claim::text) then
    raise exception 'csat_ec: 이 회차에 봉인된 claim 이 아니다';
  end if;
  if not public.csat_ec_round_inputs_intact(p_round, v_c.session_id, v_c.item_no) then
    raise exception 'csat_ec: 봉인 뒤 입력이 바뀌었다 — 회차를 취소하고 다시 만든다';
  end if;
  insert into public.csat_ec_judgment (round_id, session_id, item_no, reviewer_key, phase, taxonomy_version, claim_id, verdict, note)
  values (p_round, v_c.session_id, v_c.item_no, public.csat_ec_my_key(), 'verify', v_round.taxonomy_version, p_claim, p_verdict, p_note)
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

-- 관리자: taxonomy 봉인 ──────────────────────────────────────────────────────
-- 코드 정의 전체를 서버가 해시해 봉인한다(정의 · 포함 · 제외 기준까지 — 과거 의미 재현). 버전 · 코드 생성은 마이그레이션(시드)로.
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

-- AI 파이프라인(service_role) ────────────────────────────────────────────────
-- 판정 입력 — 과정 증거 중 범주 자기보고는 빼고(blind), 사람 판정 · 학생 범주 claim 은 주지 않는다.
create or replace function public.csat_ec_ai_export(p_session uuid, p_item_no smallint)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.csat_ec_pilot_eligible(p_session, p_item_no) then
    raise exception 'csat_ec: Pilot 적격(품질 · 학습자 확인 · 과정 증거) 못 갖춘 응답은 판정하지 않는다';
  end if;
  return (
    select jsonb_build_object(
      'session_id', r.session_id, 'item_no', r.item_no, 'item_id', r.item_id, 'chosen_option', r.chosen_option, 'is_correct', r.is_correct,
      'input_hash', public.csat_ec_judgment_input_hash(r.session_id, r.item_no), 'quality_rule_version', 'rq-1',
      'process_evidence', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'value', e.value) order by e.created_at, e.id)
                                     from public.csat_ec_valid_process_evidence(r.session_id, r.item_no) e), '[]'))
      from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no);
end $$;

create or replace function public.csat_ec_ai_taxonomy(p_version text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('version', v.version, 'definitions_hash', v.definitions_hash,
           'codes', (select jsonb_agg(jsonb_build_object('code', c.code, 'axis', c.axis, 'label', c.label, 'definition', c.definition,
                                                          'inclusion', c.inclusion, 'exclusion', c.exclusion, 'status', c.status) order by c.code)
                       from public.csat_ec_code c where c.version = v.version and c.axis in ('V', 'S', 'R', 'E')))
    from public.csat_ec_taxonomy_version v where v.version = p_version and v.status = 'sealed'
$$;

-- 원자적 적재: 실행 1행 + (proposed 면) claim 들. 사람 판정 · 학생 범주 보고는 읽지 않는다.
create or replace function public.csat_ec_ai_import(p_run jsonb, p_claims jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_run bigint; v_user uuid; c jsonb; n_primary int := 0;
begin
  -- 세션 공유 잠금 — 학생 증거 작성(같은 세션 FOR SHARE)과는 함께 가능하지만 blind 시작(FOR UPDATE)과는 직렬화.
  -- 증거 정정은 판정 입력 해시를 바꾸므로, 아래 해시 재검증이 같은 트랜잭션 안에서 정정을 잡는다
  select s.user_id into v_user from public.csat_dx_session s where s.id = (p_run->>'session_id')::uuid for share;
  -- 응답 단위 배타 잠금 — 같은 응답의 증거 작성과 직렬화: 잠금을 잡은 뒤의 해시 재검증이 정정을 확실히 잡는다
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || (p_run->>'session_id') || '|' || (p_run->>'item_no'), 0));
  if v_user is null then raise exception 'csat_ec: 없는 세션'; end if;
  if p_run->>'quality_rule_version' <> 'rq-1' or not public.csat_ec_pilot_eligible((p_run->>'session_id')::uuid, (p_run->>'item_no')::smallint) then
    raise exception 'csat_ec: Pilot 적격(품질 · 학습자 확인 · 과정 증거) 못 갖춘 응답은 적재하지 않는다';
  end if;
  -- 판정한 입력이 지금 입력과 같아야 한다(그 사이 문항 · 정답이 바뀌었으면 다시 판정)
  if p_run->>'outcome' <> 'failed' and p_run->>'input_hash' is distinct from
     public.csat_ec_judgment_input_hash((p_run->>'session_id')::uuid, (p_run->>'item_no')::smallint) then
    raise exception 'csat_ec: 입력 해시가 지금 입력과 다르다';
  end if;
  if not exists (select 1 from public.csat_ec_taxonomy_version where version = p_run->>'taxonomy_version' and status = 'sealed') then
    raise exception 'csat_ec: 봉인된 taxonomy 로만 판정한다';
  end if;
  -- 재시도 멱등 — 같은 실행 키를 advisory 잠금으로 직렬화한 뒤, 성공 실행이 이미 있으면: 결과(출력 · claim)가 같으면 그 id, 다르면 거부
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|', p_run->>'session_id', p_run->>'item_no', p_run->>'taxonomy_version', p_run->>'model',
                                                           p_run->>'prompt_version', p_run->>'analyzer_version', p_run->>'choice_trap_map', p_run->>'input_hash'), 0));
  if p_run->>'outcome' <> 'failed' then
    select a.id into v_run from public.csat_ec_ai_run a
     where a.session_id = (p_run->>'session_id')::uuid and a.item_no = (p_run->>'item_no')::smallint
       and a.taxonomy_version = p_run->>'taxonomy_version' and a.model = p_run->>'model' and a.prompt_version = p_run->>'prompt_version'
       and a.analyzer_version = p_run->>'analyzer_version' and a.choice_trap_map = p_run->>'choice_trap_map'
       and a.input_hash = p_run->>'input_hash' and a.outcome <> 'failed';
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
                                     choice_trap_map, input_hash, input_refs, outcome, output, failure)
  values ((p_run->>'session_id')::uuid, (p_run->>'item_no')::smallint, p_run->>'taxonomy_version', p_run->>'model', p_run->>'prompt_version',
          p_run->>'analyzer_version', p_run->>'quality_rule_version', p_run->>'choice_trap_map', p_run->>'input_hash',
          p_run->'input_refs', p_run->>'outcome', p_run->'output', p_run->>'failure')
  returning id into v_run;
  if p_run->>'outcome' = 'proposed' then
    for c in select * from jsonb_array_elements(p_claims) loop
      if left(c->>'code', 1) not in ('V', 'S', 'R', 'E') then raise exception 'csat_ec: AI 는 V/S/R/E 원인만 제안한다'; end if;
      -- 근거: 요약 + 인용 1개 이상, 인용은 그 문항 원문(발문 · 지문 · 선지)에 실제로 있어야 한다
      if coalesce(length(btrim(c->'evidence'->>'summary')), 0) < 10
         or coalesce(jsonb_array_length(c->'evidence'->'text_refs'), 0) = 0
         or exists (select 1 from jsonb_array_elements(c->'evidence'->'text_refs') q
                     where coalesce(length(btrim(q->>'quote')), 0) < 2
                        or coalesce(q->>'where', '') !~ '^(passage|stem|option:[1-5])$'
                        or not exists (select 1 from public.csat_dx_response r join public.csat_items i on i.id = r.item_id
                                        where r.session_id = (p_run->>'session_id')::uuid and r.item_no = (p_run->>'item_no')::smallint
                                          and strpos(lower(coalesce(case when q->>'where' = 'passage' then i.passage
                                                                         when q->>'where' = 'stem' then i.stem
                                                                         else i.choices->>(split_part(q->>'where', ':', 2)::int - 1) end, '')),
                                                     lower(btrim(q->>'quote'))) > 0)) then
        raise exception 'csat_ec: AI 근거에 요약 · 출처 표시 인용이 없거나, 표시한 원문(지문 · 발문 · 선지 n)에 없는 인용이 있다';
      end if;
      if c->>'role' = 'primary' then n_primary := n_primary + 1; end if;
      insert into public.csat_ec_claim (session_id, item_no, user_id, source, ai_run_id, taxonomy_version, code, role, confidence, evidence)
      values ((p_run->>'session_id')::uuid, (p_run->>'item_no')::smallint, v_user, 'ai', v_run, p_run->>'taxonomy_version',
              c->>'code', c->>'role', c->>'confidence', c->'evidence');
    end loop;
    if n_primary <> 1 or jsonb_array_length(p_claims) > 2 then raise exception 'csat_ec: proposed 는 primary 1 · contributing ≤ 1'; end if;
  elsif jsonb_array_length(coalesce(p_claims, '[]')) > 0 then
    raise exception 'csat_ec: 원인을 내지 않은 실행에는 claim 이 없어야 한다';
  end if;
  return v_run;
end $$;

-- 실행 권한 — 전부 회수한 뒤 필요한 역할에만
do $$
declare f text;
begin
  foreach f in array array[
    'csat_ec_my_key()',
    'csat_ec_confirm_session(uuid,boolean,boolean)',
    'csat_ec_taxonomy_seal(text)',
    'csat_ec_ai_export(uuid,smallint)',
    'csat_ec_ai_taxonomy(text)',
    'csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid)',
    'csat_ec_record_quality_rq1(uuid)',
    'csat_ec_effective_answer(uuid,smallint)',
    'csat_ec_valid_process_evidence(uuid,smallint)',
    'csat_ec_judgment_input_hash(uuid,smallint)',
    'csat_ec_pilot_eligible(uuid,smallint)',
    'csat_ec_round_inputs_intact(bigint,uuid,smallint)',
    'csat_ec_cancel_rounds_on_confirmation()',
    'csat_ec_item_input_hash(uuid,smallint)',
    'csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid)',
    'csat_ec_round_create(text,text,text,jsonb)',
    'csat_ec_round_set_targets(bigint,jsonb)',
    'csat_ec_round_assign(bigint,uuid,text,text[])',
    'csat_ec_round_start_blind(bigint)',
    'csat_ec_blind_queue(bigint)',
    'csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text)',
    'csat_ec_round_reveal(bigint)',
    'csat_ec_reveal_view(bigint)',
    'csat_ec_round_material(bigint)',
    'csat_ec_submit_verify(bigint,uuid,text,text)',
    'csat_ec_round_advance(bigint,text,text)',
    'csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text)',
    'csat_ec_ai_import(jsonb,jsonb)',
    'csat_ec_forbid_update()', 'csat_ec_only_reviewer_null()', 'csat_ec_taxonomy_guard()', 'csat_ec_code_guard()',
    'csat_ec_round_guard()', 'csat_ec_assignment_insert_guard()', 'csat_ec_judgment_insert_guard()',
    'csat_ec_cancel_rounds_on_response_delete()', 'csat_ec_supersede_guard()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated, service_role', f);
  end loop;
end $$;

grant execute on function public.csat_ec_confirm_session(uuid,boolean,boolean) to authenticated;
grant execute on function public.csat_ec_taxonomy_seal(text) to authenticated;   -- 함수 안에서 is_admin()
grant execute on function public.csat_ec_ai_export(uuid,smallint) to service_role;
grant execute on function public.csat_ec_ai_taxonomy(text) to service_role;
grant execute on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) to authenticated;
grant execute on function public.csat_ec_add_student_claim(uuid,smallint,text,text,text,uuid) to authenticated;
-- 판정자 · 관리자 RPC 는 함수 안에서 배정 · is_admin() 을 확인한다
grant execute on function public.csat_ec_round_create(text,text,text,jsonb) to authenticated;
grant execute on function public.csat_ec_round_set_targets(bigint,jsonb) to authenticated;
grant execute on function public.csat_ec_round_assign(bigint,uuid,text,text[]) to authenticated;
grant execute on function public.csat_ec_round_start_blind(bigint) to authenticated;
grant execute on function public.csat_ec_blind_queue(bigint) to authenticated;
grant execute on function public.csat_ec_submit_blind(bigint,uuid,smallint,text,text,text[],text[],text) to authenticated;
grant execute on function public.csat_ec_round_reveal(bigint) to authenticated;
grant execute on function public.csat_ec_reveal_view(bigint) to authenticated;
grant execute on function public.csat_ec_round_material(bigint) to authenticated;
grant execute on function public.csat_ec_submit_verify(bigint,uuid,text,text) to authenticated;
grant execute on function public.csat_ec_round_advance(bigint,text,text) to authenticated;
grant execute on function public.csat_ec_submit_adjudication(bigint,uuid,smallint,text,text,text[],text[],text) to authenticated;
grant execute on function public.csat_ec_ai_import(jsonb,jsonb) to service_role;
-- csat_ec_my_key 는 다른 definer 함수 안에서만 쓰인다(직접 실행 권한 없음)

commit;
