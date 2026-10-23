-- supabase/migrations/_pending_authored_ai_review.sql
-- ⚠️ 보류(적용 안 함) — 단계 2A. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 왜: 사람 검토 역할을 Claude Code · Codex 두 AI 검토로 대체한다(사용자 지침 2026-10-21). 사람 결정 원장
--   (content_human_decision · 'human-reviewed' 진술)은 그대로 보존하고, 이 파일은 **별도 AI 결정 원장**을 더한다.
--   AI 결정은 사람 결정이 아니며 외부 권리의 부여도 아니다 — 자체 창작 선언(provenance.derivedFrom = [])에 대한 검토와
--   본문 · Gold 내용 검토를 두 모델 세션 · 입력 · 응답 해시에 결속해 기록할 뿐이다.
--
-- 무엇:
--   1. js_canonical_json(jsonb) — 검토 영수증의 JS canonical(키 정렬 JSON.stringify) 해시를 DB 행에서 다시 계산한다.
--      DB 의 revision 은 jsonb::text 해시라 JS 해시와 다르다 — 둘을 같다고 가정하지 않고, 등록 행(id · role · passageGroup ·
--      body · gold)을 JS 모양으로 재구성해 영수증의 item/body/gold 해시와 대조한 뒤 DB revision 에 결속한다.
--   2. content_ai_decision(+ 철회) — 추가 전용 · writer trigger · RLS · service_role 쓰기 권한 회수.
--      기록 · 철회는 관리자 · 큐레이터 **로그인 세션**만. 같은 영수증 재요청 = 같은 id, 다른 영수증 = 23505.
--   3. supply_human_decisions_ok 호환 래퍼 — 기존(사람) 판정을 이름을 바꿔 보존하고 앞에 두 경로를 더한다:
--      · authored_item: 철회되지 않은 AI 결정(revision · 현재 Gold hash · 평가 역할은 자격 gold_hash 일치) + 자체 창작 선언.
--      · dcp_item(1C 등록 후보 · 안내 연습만): 등록 영수증 + 현재 원천 정책(csat_source_is_eligible) — 기출 · 창작으로 위장하지 않는다.
--   4. workspace_delivery_record 래퍼 — AI 결정 행을 FOR SHARE 로 잠가 철회와 직렬화한 뒤 기존 함수로 넘긴다.
--   5. authored_supply_decision_state(자격) — 서버 재고 선택용 읽기('human' | 'ai' | 'source_policy' | 'none').
--
-- 적용 순서(결합): C → B → I1-S → I1-P → I2 → G2 → D3(20261020063000) → _pending_authored_supply →
--   **이 파일** → _pending_factory_dcp_admission → _pending_factory_dcp_learning. 한 트랜잭션.
-- 하지 않는 것: 사람 결정 행 생성 · content_human_decision_record 호출 · qualification axes 값 생성 · 학습자에게 원장 노출.
-- 되돌리기(이력 0행일 때만 · 별도 승인): drop function workspace_delivery_record(uuid,uuid,uuid,uuid,uuid);
--   alter function workspace_delivery_record_pre_ai_review(...) rename to workspace_delivery_record; (authenticated 실행 권한 복원)
--   drop function supply_human_decisions_ok(uuid); alter function supply_human_decisions_ok_human(uuid) rename to supply_human_decisions_ok;
--   drop function authored_supply_decision_state(uuid), content_ai_decision_ok(text,text,text), content_ai_decision_record(text,jsonb),
--   content_ai_decision_revoke(uuid,text), js_canonical_json(jsonb); drop table content_ai_decision_revocation, content_ai_decision.

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing from unnest(array[
    'public.supply_human_decisions_ok(uuid)', 'public.authored_item_revision(text)', 'public.authored_item_gold_hash(text)',
    'public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid)', 'public.forbid_ledger_mutation()', 'public.supply_writer_guard()',
    'public.is_admin_or_curator()']::text[]) x
  where to_regprocedure(x) is null;
  if v_missing is not null then raise exception 'authored AI review requires authored supply first — missing: %', v_missing; end if;
  if to_regclass('public.content_ai_decision') is not null then raise exception 'authored AI review: already installed'; end if;
  -- 1C 뒤에 설치하면 1C 래퍼 안쪽에 들어가 잠금 순서가 바뀐다 — 정해진 순서만 허용
  if to_regclass('public.factory_dcp_admission') is not null then raise exception 'authored AI review must be installed before dcp admission'; end if;
end $$;

-- ── 1. JS canonical JSON ────────────────────────────────────────────────
/** JSON.stringify(키 정렬) 와 같은 문자열. 키는 C 정렬(ASCII 키 = JS 기본 정렬). 숫자는 jsonb 표기 그대로(정수 · 단순 소수) */
create function public.js_canonical_json(p jsonb)
returns text language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare v text;
begin
  case jsonb_typeof(p)
    when 'object' then
      select '{' || coalesce(string_agg(to_json(k)::text || ':' || public.js_canonical_json(v2), ',' order by k collate "C"), '') || '}'
        into v from jsonb_each(p) as e(k, v2);
    when 'array' then
      select '[' || coalesce(string_agg(public.js_canonical_json(e), ',' order by o), '') || ']'
        into v from jsonb_array_elements(p) with ordinality as a(e, o);
    when 'string' then v := to_json(p #>> '{}')::text;
    else v := p::text;
  end case;
  return v;
end $$;
revoke all on function public.js_canonical_json(jsonb) from public, anon, authenticated;

-- ── 2. AI 결정 원장 ─────────────────────────────────────────────────────
create table public.content_ai_decision (
  id uuid primary key default gen_random_uuid(),
  artifact_kind text not null check (artifact_kind = 'authored_item'),
  artifact_ref text not null check (length(artifact_ref) between 1 and 200),
  artifact_revision text not null check (artifact_revision ~ '^[0-9a-f]{64}$'),     -- DB revision(jsonb 텍스트 해시)
  gold_hash text not null check (gold_hash ~ '^[0-9a-f]{64}$'),                     -- DB Gold hash
  js_item_sha256 text not null check (js_item_sha256 ~ '^[0-9a-f]{64}$'),           -- 영수증의 JS canonical 해시(DB 가 재계산해 일치 확인)
  js_body_sha256 text not null check (js_body_sha256 ~ '^[0-9a-f]{64}$'),
  js_gold_sha256 text not null check (js_gold_sha256 ~ '^[0-9a-f]{64}$'),
  set_name text not null,
  source_file_sha256 text not null check (source_file_sha256 ~ '^[0-9a-f]{64}$'),
  receipt_sha256 text not null check (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  reviews jsonb not null check (jsonb_typeof(reviews) = 'array' and jsonb_array_length(reviews) = 2),
  -- 권리: 자체 창작 선언에 대한 AI 검토일 뿐 — 외부 권리 부여 아님(rights_grant = false 고정)
  rights_basis text not null check (rights_basis = 'first_party_original_declaration'),
  rights_grant boolean not null default false check (rights_grant = false),
  human_review boolean not null default false check (human_review = false),
  scope text[] not null check (scope <@ array['store','display','transmit','assess']::text[] and cardinality(scope) > 0),
  decided_by uuid not null references auth.users(id),
  decider_role text not null check (decider_role in ('admin', 'curator')),
  created_at timestamptz not null default now(),
  unique (artifact_kind, artifact_ref, artifact_revision)
);
create table public.content_ai_decision_revocation (
  decision_id uuid primary key references public.content_ai_decision(id),
  revoked_by uuid not null references auth.users(id),
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create trigger content_ai_decision_append_only before update or delete on public.content_ai_decision
  for each row execute function public.forbid_ledger_mutation();
create trigger content_ai_decision_writer before insert on public.content_ai_decision
  for each row execute function public.supply_writer_guard();
create trigger content_ai_decision_revocation_append_only before update or delete on public.content_ai_decision_revocation
  for each row execute function public.forbid_ledger_mutation();
create trigger content_ai_decision_revocation_writer before insert on public.content_ai_decision_revocation
  for each row execute function public.supply_writer_guard();
alter table public.content_ai_decision enable row level security;
alter table public.content_ai_decision_revocation enable row level security;
create policy cad_admin_read on public.content_ai_decision for select using (public.is_admin_or_curator());
create policy cadr_admin_read on public.content_ai_decision_revocation for select using (public.is_admin_or_curator());
revoke all on table public.content_ai_decision, public.content_ai_decision_revocation from public, anon, authenticated;
grant select on table public.content_ai_decision, public.content_ai_decision_revocation to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Supabase 기본 권한(default privileges)이 service_role 에 ALL 을 준다 — 쓰기는 RPC 로만
    execute 'revoke all on table public.content_ai_decision, public.content_ai_decision_revocation from service_role';
    execute 'grant select on table public.content_ai_decision, public.content_ai_decision_revocation to service_role';
    execute 'revoke all on function public.js_canonical_json(jsonb) from service_role';
  end if;
end $$;

/**
 * AI 결정 기록 — 관리자 · 큐레이터 로그인 세션만. 영수증(vocaflow.ai-authored-review-receipt/1)을 받아 DB 가 직접 대조한다:
 *   이 ref 가 수락 범위 안 · 역할 = 등록 역할 · JS item/body/Gold 해시 = 등록 행 재구성 해시 · 두 리뷰 = claude + codex ·
 *   서로 다른 세션 · 같은 입력 해시 · 같은 원본 파일 해시 · 문항 accept · 정답 = 등록 Gold · gold_issues 없음 ·
 *   사람 검토 · 권리 부여 주장 없음 · 등록 provenance 가 자체 창작(derivedFrom = []) · 같은 세트.
 */
create function public.content_ai_decision_record(p_ref text, p_receipt jsonb)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare a record; e jsonb; r jsonb; ri jsonb; prev record; v_id text; v_rev text; v_gh text; v_sha text; v_n int := 0;
  v_agents text[] := '{}'; v_sessions text[] := '{}'; v_prompts text[] := '{}';
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_ref is null or p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then raise exception 'ai decision: arguments required'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into a from authored_item where ref = p_ref for share;
  if not found then raise exception 'ai decision: authored item not registered'; end if;
  v_id := substr(p_ref, length('authored:') + 1);
  if p_receipt->>'schema' is distinct from 'vocaflow.ai-authored-review-receipt/1'
     or p_receipt->>'judgment' is distinct from 'accepted_candidate_content_and_gold'
     or p_receipt->>'rights_basis' is distinct from 'first_party_original_declaration_only'
     or p_receipt->'rights_grant' is distinct from 'false'::jsonb or p_receipt->'human_review_claimed' is distinct from 'false'::jsonb
     or coalesce(p_receipt->>'source_file_sha256', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'ai decision: receipt is not an accepted two-model AI content/gold receipt';
  end if;
  if a.provenance->>'set' is distinct from p_receipt->>'set' or a.provenance->'derivedFrom' is distinct from '[]'::jsonb then
    raise exception 'ai decision: registered provenance is not the reviewed first-party set';
  end if;
  if jsonb_typeof(p_receipt->'scope') <> 'array' or not (p_receipt->'scope' ? v_id) or (p_receipt->'not_reviewed') ? v_id then
    raise exception 'ai decision: item outside the accepted review scope';
  end if;
  select x into e from jsonb_array_elements(p_receipt->'items') x where x->>'id' = v_id;
  if e is null or e->>'role' is distinct from a.intended_role then raise exception 'ai decision: receipt item/role differs from registration'; end if;
  -- JS canonical 해시 결속(DB 행을 영수증과 같은 모양으로 재구성)
  if e->>'body_canonical_sha256' is distinct from encode(sha256(convert_to(js_canonical_json(a.body), 'UTF8')), 'hex')
     or e->>'gold_canonical_sha256' is distinct from encode(sha256(convert_to(js_canonical_json(a.gold), 'UTF8')), 'hex')
     or e->>'item_canonical_sha256' is distinct from encode(sha256(convert_to(js_canonical_json(jsonb_build_object(
          'id', v_id, 'role', a.intended_role, 'passageGroup', a.passage_group, 'body', a.body, 'gold', a.gold)), 'UTF8')), 'hex') then
    raise exception 'ai decision: reviewed body/gold differs from registered row';
  end if;
  if jsonb_typeof(p_receipt->'reviews') <> 'array' or jsonb_array_length(p_receipt->'reviews') <> 2 then
    raise exception 'ai decision: exactly two model reviews required';
  end if;
  for r in select x from jsonb_array_elements(p_receipt->'reviews') x loop
    if coalesce(r->>'session_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(r->>'prompt_sha256', '') !~ '^[0-9a-f]{64}$' or coalesce(r->>'response_sha256', '') !~ '^[0-9a-f]{64}$'
       or r->>'source_file_sha256' is distinct from p_receipt->>'source_file_sha256' or r->>'verdict' is distinct from 'accept' then
      raise exception 'ai decision: review identity/hash/verdict invalid';
    end if;
    select x into ri from jsonb_array_elements(r->'items') x where x->>'id' = v_id;
    if ri is null or ri->>'verdict' is distinct from 'accept' or ri->'choice_0based' is distinct from a.gold->'answer'
       or coalesce(jsonb_array_length(ri->'gold_issues'), -1) <> 0 then
      raise exception 'ai decision: review does not accept this item and gold';
    end if;
    v_agents := v_agents || (r->>'agent'); v_sessions := v_sessions || (r->>'session_id'); v_prompts := v_prompts || (r->>'prompt_sha256');
    v_n := v_n + 1;
  end loop;
  if not (v_agents @> array['claude','codex'] and v_agents <@ array['claude','codex']) or v_sessions[1] = v_sessions[2] or v_prompts[1] <> v_prompts[2] then
    raise exception 'ai decision: claude and codex must review the same input in distinct sessions';
  end if;
  v_rev := public.authored_item_revision(p_ref);
  v_gh := public.authored_item_gold_hash(p_ref);
  v_sha := encode(sha256(convert_to(js_canonical_json(p_receipt), 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('ai-decision|' || p_ref || '|' || v_rev, 0));
  select * into prev from content_ai_decision where artifact_kind = 'authored_item' and artifact_ref = p_ref and artifact_revision = v_rev;
  if found then
    if prev.receipt_sha256 <> v_sha then raise exception 'ai decision: revision already decided with a different receipt' using errcode = '23505'; end if;
    return prev.id;
  end if;
  insert into content_ai_decision (artifact_kind, artifact_ref, artifact_revision, gold_hash, js_item_sha256, js_body_sha256, js_gold_sha256,
    set_name, source_file_sha256, receipt_sha256, reviews, rights_basis, scope, decided_by, decider_role)
  values ('authored_item', p_ref, v_rev, v_gh, e->>'item_canonical_sha256', e->>'body_canonical_sha256', e->>'gold_canonical_sha256',
    p_receipt->>'set', p_receipt->>'source_file_sha256', v_sha,
    (select jsonb_agg(jsonb_build_object('agent', x->>'agent', 'session_id', x->>'session_id', 'request_id', x->>'request_id',
       'prompt_sha256', x->>'prompt_sha256', 'response_sha256', x->>'response_sha256') order by x->>'agent') from jsonb_array_elements(p_receipt->'reviews') x),
    'first_party_original_declaration', array['store','display','transmit','assess'], auth.uid(),
    case when public.is_admin() then 'admin' else 'curator' end)
  returning id into prev;
  return (select id from content_ai_decision where artifact_ref = p_ref and artifact_revision = v_rev);
end $$;

create function public.content_ai_decision_revoke(p_decision uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  perform 1 from content_ai_decision where id = p_decision for update;   -- 진행 중 공급(FOR SHARE)과 직렬화
  if not found then raise exception 'revoke: decision not found'; end if;
  insert into content_ai_decision_revocation (decision_id, revoked_by, reason) values (p_decision, auth.uid(), p_reason)
  on conflict (decision_id) do nothing;
end $$;

/** 지금 유효한 AI 결정(철회 없음 · revision · 현재 Gold hash 일치) */
create function public.content_ai_decision_ok(p_ref text, p_revision text, p_gold_hash text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.content_ai_decision d
    where d.artifact_kind = 'authored_item' and d.artifact_ref = p_ref and d.artifact_revision = p_revision and d.gold_hash = p_gold_hash
      and d.artifact_revision = public.authored_item_revision(p_ref) and d.gold_hash = public.authored_item_gold_hash(p_ref)
      and not exists (select 1 from public.content_ai_decision_revocation r where r.decision_id = d.id))
$$;

/**
 * AI 결정에 결속된 자격 기록(관리자 세션). revision · Gold hash · TASK · 주석 ref 는 등록 행에서 DB 가 정한다(호출자 값 불신).
 * 축: A · B · C · F 의 pass 는 지금 유효한 AI 결정이 있을 때만 · E pass 는 평가 역할만 · D pass 는 안내 연습만 · 그 밖은 호출자 값(근거 없으면 unknown).
 * 같은 판본의 대체되지 않은 자격이 있으면 그 id(재실행 안전).
 */
create function public.authored_ai_qualify(p_ref text, p_role text, p_axes jsonb, p_annotation_ref text, p_evidence_ids text[])
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare a record; v_rev text; v_gh text; v_id uuid;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into a from authored_item where ref = p_ref;
  if not found or a.intended_role is distinct from p_role or a.annotation_ref is distinct from p_annotation_ref then
    raise exception 'ai qualify: registration/role/annotation mismatch';
  end if;
  v_rev := public.authored_item_revision(p_ref); v_gh := public.authored_item_gold_hash(p_ref);
  if not public.content_ai_decision_ok(p_ref, v_rev, v_gh) then raise exception 'ai qualify: no current AI decision'; end if;
  if (p_axes->'E'->>'state') = 'pass' and p_role not in ('independent_check','transfer','delayed_check') then raise exception 'ai qualify: E pass outside assessment'; end if;
  if (p_axes->'D'->>'state') = 'pass' and p_role <> 'guided_practice' then raise exception 'ai qualify: D pass outside guided practice'; end if;
  select q.id into v_id from content_qualification q
   where q.artifact_kind = 'authored_item' and q.artifact_ref = p_ref and q.artifact_revision = v_rev and q.role = p_role
     and q.annotation_hash = v_gh and not exists (select 1 from content_qualification s where s.supersedes = q.id)
   order by q.created_at limit 1;
  if found then return v_id; end if;
  return public.content_qualification_record('FQ1.1', 'authored_item', p_ref, v_rev, a.task_id, p_role, p_axes,
    'first_party', v_rev, null, 'ai-two-model', v_gh, a.annotation_ref, v_gh, '{}'::text[], p_evidence_ids,
    'AI 두 모델 검토(Claude Code + Codex) — 사람 검수 아님 · 권리 부여 아님', null);
end $$;
revoke all on function public.authored_ai_qualify(text, text, jsonb, text, text[]) from public, anon;
grant execute on function public.authored_ai_qualify(text, text, jsonb, text, text[]) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on function public.authored_ai_qualify(text, text, jsonb, text, text[]) from service_role';
  end if;
end $$;

-- ── 3. 공급 판정 호환 래퍼(사람 판정 보존) ────────────────────────────────
alter function public.supply_human_decisions_ok(uuid) rename to supply_human_decisions_ok_human;
revoke all on function public.supply_human_decisions_ok_human(uuid) from public, anon, authenticated;

/** 1C 등록 DCP 후보의 원천 정책 경로(안내 연습 · display/transmit 만). 1C 미설치면 false — plpgsql 이라 표가 나중에 생겨도 된다 */
create function public.supply_dcp_source_policy_ok(p_qualification uuid)
returns boolean language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare q record; a record;
begin
  if to_regclass('public.factory_dcp_admission') is null or to_regprocedure('public.csat_source_is_eligible(uuid)') is null then return false; end if;
  select * into q from content_qualification where id = p_qualification;
  -- 권리 축 F 는 1C 가 등록된 권리 기록이 있을 때만 pass 로 남긴다(AI 는 권리를 줄 수 없다)
  if not found or q.artifact_kind <> 'dcp_item' or q.role <> 'guided_practice' or (q.axes->'F'->>'state') is distinct from 'pass' then return false; end if;
  execute 'select source_id, artifact_revision, source_content_sha256 from public.factory_dcp_admission where dcp_item_id::text = $1' into a using q.artifact_ref;
  if a is null or a.artifact_revision is distinct from q.artifact_revision then return false; end if;
  -- 원문이 바뀌면 1C revision 래퍼가 null 을 돌려준다 · 현재 원천 정책(적격)을 다시 묻는다
  if public.supply_artifact_revision('dcp_item', q.artifact_ref) is distinct from q.artifact_revision then return false; end if;
  return coalesce(public.csat_source_is_eligible(a.source_id), false);
end $$;

create function public.supply_human_decisions_ok(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(public.supply_human_decisions_ok_human(p_qualification), false)
    or exists (
      select 1 from public.content_qualification q
      where q.id = p_qualification and q.artifact_kind = 'authored_item'
        and public.content_ai_decision_ok(q.artifact_ref, q.artifact_revision, public.authored_item_gold_hash(q.artifact_ref))
        and exists (select 1 from public.authored_item a where a.ref = q.artifact_ref and a.provenance->'derivedFrom' = '[]'::jsonb)
        and (q.role not in ('independent_check','transfer','delayed_check') or q.gold_hash = public.authored_item_gold_hash(q.artifact_ref)))
    or public.supply_dcp_source_policy_ok(p_qualification)
$$;

/** 서버 재고 선택 — 어느 경로로 지금 공급 가능한가(최종 판정은 공급 함수). service_role 또는 관리자만 */
create function public.authored_supply_decision_state(p_qualification uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if auth.uid() is not null and public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  if coalesce(public.supply_human_decisions_ok_human(p_qualification), false) then return 'human'; end if;
  if public.supply_dcp_source_policy_ok(p_qualification) then return 'source_policy'; end if;
  if public.supply_human_decisions_ok(p_qualification) then return 'ai'; end if;
  return 'none';
end $$;

-- ── 4. 공급 기록 래퍼 — AI 결정 행을 잠가 철회와 직렬화 ───────────────────────
alter function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) rename to workspace_delivery_record_pre_ai_review;
revoke all on function public.workspace_delivery_record_pre_ai_review(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
create function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform 1 from public.content_ai_decision d join public.content_qualification q
    on q.artifact_kind = d.artifact_kind and q.artifact_ref = d.artifact_ref and q.artifact_revision = d.artifact_revision
   where q.id = p_qualification order by d.id for share of d;
  return public.workspace_delivery_record_pre_ai_review(p_line, p_order, p_qualification, p_approval, p_request_key);
end $$;

-- ── 권한 — 기본 권한(anon · authenticated · service_role EXECUTE)을 명시적으로 회수 ──────────
revoke all on function public.content_ai_decision_record(text, jsonb) from public, anon;
revoke all on function public.content_ai_decision_revoke(uuid, text) from public, anon;
grant execute on function public.content_ai_decision_record(text, jsonb) to authenticated;
grant execute on function public.content_ai_decision_revoke(uuid, text) to authenticated;
revoke all on function public.content_ai_decision_ok(text, text, text) from public, anon, authenticated;
revoke all on function public.supply_dcp_source_policy_ok(uuid) from public, anon, authenticated;
revoke all on function public.supply_human_decisions_ok(uuid) from public, anon, authenticated;
revoke all on function public.authored_supply_decision_state(uuid) from public, anon;
grant execute on function public.authored_supply_decision_state(uuid) to authenticated;
revoke all on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on function public.content_ai_decision_record(text, jsonb) from service_role';
    execute 'revoke all on function public.content_ai_decision_revoke(uuid, text) from service_role';
    execute 'revoke all on function public.content_ai_decision_ok(text, text, text) from service_role';
    execute 'revoke all on function public.supply_dcp_source_policy_ok(uuid) from service_role';
    execute 'revoke all on function public.supply_human_decisions_ok_human(uuid) from service_role';
    execute 'grant execute on function public.authored_supply_decision_state(uuid) to service_role';
  end if;
end $$;

-- ── 적용 뒤 검증(하나라도 어긋나면 전체 롤백) ───────────────────────────
do $$
declare v_bad text[];
begin
  select array_agg(t) into v_bad from unnest(array['content_ai_decision','content_ai_decision_revocation']) t
  where not (select relrowsecurity from pg_class where oid = to_regclass('public.'||t))
     or has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or (exists (select 1 from pg_roles where rolname = 'service_role')
         and has_table_privilege('service_role', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));
  if v_bad is not null then raise exception 'authored AI review verify: table RLS/privileges %', v_bad; end if;
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('js_canonical_json','content_ai_decision_ok','supply_dcp_source_policy_ok',
    'supply_human_decisions_ok','supply_human_decisions_ok_human','workspace_delivery_record_pre_ai_review')
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception 'authored AI review verify: internal function exposed %', v_bad; end if;
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('content_ai_decision_record','content_ai_decision_revoke')
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or (exists (select 1 from pg_roles where rolname = 'service_role') and has_function_privilege('service_role', p.oid, 'EXECUTE')));
  if v_bad is not null then raise exception 'authored AI review verify: writer callable outside admin session %', v_bad; end if;
end $$;
