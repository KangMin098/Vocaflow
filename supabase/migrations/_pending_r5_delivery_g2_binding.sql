-- supabase/migrations/_pending_r5_delivery_g2_binding.sql
-- ⚠️ 보류(적용 안 함) — R5 §6 · §10 「공급(Workspace delivery) ↔ G2 시도」 결속. 적용 순서: DB-1(C → B → I1-S) → (DB-2) → I2 주석 결속 → **이 파일**. 한 트랜잭션.
-- 승인 패키지: docs/csat-learner/v62/R5_DB_APPROVAL_PACKAGE.md — 별도 명시 승인 전 개발 DB 에 적용하지 않는다.
--
-- 무엇: 학습자의 G2 시도(learning_task_attempts 한 행)가 「어느 Workspace 공급에서 나왔고, 근거로 세는가」를 추가 전용 원장 한 표에 남긴다.
--   · 기존 표(learning_task_attempts · workspace_content_delivery 등)는 열 · 제약 · 권한을 하나도 바꾸지 않는다. 백필 없음.
--     ⇒ 결속 행이 없는 옛 시도(레거시)는 지금과 똑같이 유효하다(이 표에 행이 없을 뿐 — 「NULL 연결」).
--   · 학습자는 정의자 RPC `workspace_delivery_attempt_record` 하나로만 쓴다. 표 직접 쓰기는 권한 · 쓰기 가드 · 추가 전용 트리거가 막는다.
--   · 도움 상태는 클라이언트 값이 아니라 **시도 행**에서 서버가 정한다(앱 attemptRole 과 같은 규칙):
--       activity=practice → practice · help_level≠independent → helped · theater+practice → independent · theater+transfer → transfer.
--       세션 · TASK · 내용 hash 중 하나라도 없으면 결속 거절(unbound 는 근거가 아니다).
--   · 기록 시점 검사(어긋나면 **거절**): 공급 행이 호출자 것 · Workspace active · 시도 행이 호출자 것 · 같은 문항 · 과제 키가 배포 주석 등록부로 공급 TASK 에 대응 ·
--       시도 내용 hash = 자격 주석 hash · 현재 산출물 revision = 공급 revision · 현재 배포 주석(supply_current_annotation) = 자격 주석 ·
--       시도 서버 수신 시각 ≥ 공급 시각.
--   · 근거 판정(어긋나면 **비근거로 기록** — 이력은 남기고 고치지 않는다): 자격 대체됨 · 승인 철회 · 그 밖의 현재 공급 무효(supply_delivery_valid) ·
--       첫 노출 아님 · 도움 상태와 공급 역할 불일치(독립 확인/지연 확인 ↔ independent, 전이 ↔ transfer, 그 밖의 역할은 근거 아님).
--   · 첫 노출(같은 문항 또는 정규화 동일 지문)은 사용자 × 노출 키 advisory 잠금 + 부분 고유 인덱스로 원자적이다 — 동시 두 요청이 모두 「첫 독립 노출」이 될 수 없다.
--   · 요청 키 멱등: 같은 (사용자, 요청 키) + 같은 본문 → 같은 id · 다른 본문 → 23505. 한 시도는 한 번만 결속된다.
-- 되돌리기(이력 0행일 때만, 별도 승인): drop function public.workspace_delivery_attempt_record(uuid, bigint, uuid);
--   drop function public.r5_exposure_key(text, text); drop table public.workspace_delivery_attempt;
--   행이 생긴 뒤에는 DROP 하지 않는다(근거 이력 손실). 중단은 RPC 실행권 회수(revoke execute … from authenticated)로 한다.

do $$
declare v_missing text[];
begin
  -- DB-1 (C · B · I1-S)
  select array_agg(x) into v_missing from unnest(array['public.content_qualification', 'public.content_release_approval',
    'public.content_release_revocation', 'public.workspace_content_demand', 'public.workspace_content_demand_line',
    'public.factory_order', 'public.workspace_content_delivery', 'public.learning_task_attempts', 'public.learning_sessions',
    'public.learner_workspace', 'public.csat_items']::text[]) x where to_regclass(x) is null;
  if v_missing is not null then raise exception 'r5 delivery-G2 binding requires DB-1 first — missing tables: %', v_missing; end if;
  select array_agg(x) into v_missing from unnest(array['public.supply_delivery_valid(uuid)', 'public.supply_artifact_revision(text,text)',
    'public.forbid_ledger_mutation()', 'public.supply_writer_guard()', 'public.fq_role_ok(jsonb,text)',
    -- I2 주석 결속 v2
    'public.supply_annotation_matches(uuid)', 'public.supply_delivery_valid_i1(uuid)',
    'public.workspace_delivery_record_i1(uuid,uuid,uuid,uuid,uuid)']::text[]) x where to_regprocedure(x) is null;
  if v_missing is not null then raise exception 'r5 delivery-G2 binding requires DB-1 + I2 annotation binding first — missing functions: %', v_missing; end if;
  if to_regclass('public.supply_current_annotation') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'content_qualification' and column_name = 'annotation_hash') then
    raise exception 'r5 delivery-G2 binding requires I2 annotation binding first';
  end if;
  -- G2 시도 행 열(20261008120000 · 160000 · 180000)
  select array_agg(c) into v_missing from unnest(array['session_id', 'activity', 'help_level', 'content_hash', 'received_at', 'task_key', 'item_ref', 'phase']::text[]) c
   where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_task_attempts' and column_name = c);
  if v_missing is not null then raise exception 'r5 delivery-G2 binding: learning_task_attempts columns missing: %', v_missing; end if;
  if to_regclass('public.workspace_delivery_attempt') is not null then
    raise exception 'r5 delivery-G2 binding: target table already exists';
  end if;
end $$;

-- ── 1. 결속 원장(추가 전용) ───────────────────────────────────────────────
create table public.workspace_delivery_attempt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  workspace_id uuid not null,
  plan_version integer not null,
  demand_id uuid not null references public.workspace_content_demand(id),
  line_id uuid not null references public.workspace_content_demand_line(id),
  order_id uuid references public.factory_order(id),                       -- 재고 재사용 공급은 null
  delivery_id uuid not null references public.workspace_content_delivery(id),
  qualification_id uuid not null references public.content_qualification(id),
  approval_id uuid not null references public.content_release_approval(id),
  artifact_kind text not null,
  artifact_ref text not null,                                               -- 문항 ref(csat_items.id 등)
  task_id text not null,
  role text not null,
  artifact_revision text not null,
  annotation_ref text not null,
  annotation_hash text not null check (annotation_hash ~ '^[0-9a-f]{64}$'),
  attempt_id bigint not null unique references public.learning_task_attempts(id),   -- 한 시도는 한 번만 결속
  session_id uuid not null,
  help_state text not null check (help_state in ('helped', 'practice', 'independent', 'transfer')),
  exposure_key text not null check (exposure_key ~ '^(item|passage):'),
  first_exposure boolean not null,
  first_exposed_at timestamptz,
  evidence boolean not null,
  non_evidence_reason text check (non_evidence_reason is null or non_evidence_reason in (
    'qualification_superseded', 'approval_revoked', 'delivery_invalid', 'not_first_exposure', 'exposure_unverifiable', 'help_state_mismatch', 'role_not_evidence')),
  request_key uuid not null,
  recorded_at timestamptz not null default now(),
  unique (user_id, request_key),
  check ((first_exposure and first_exposed_at is not null) or (not first_exposure and first_exposed_at is null)),
  check ((evidence and non_evidence_reason is null and first_exposure) or (not evidence and non_evidence_reason is not null))
);
-- 첫 노출은 사용자 × 노출 키당 한 행(동시 요청의 최종 방어선 — 함수의 advisory 잠금이 먼저 직렬화한다)
create unique index workspace_delivery_attempt_first_exposure on public.workspace_delivery_attempt (user_id, exposure_key) where first_exposure;
create index workspace_delivery_attempt_delivery on public.workspace_delivery_attempt (delivery_id);

create trigger workspace_delivery_attempt_append_only before update or delete on public.workspace_delivery_attempt
  for each row execute function public.forbid_ledger_mutation();
create trigger workspace_delivery_attempt_writer before insert on public.workspace_delivery_attempt
  for each row execute function public.supply_writer_guard();

alter table public.workspace_delivery_attempt enable row level security;
create policy wda_owner_read on public.workspace_delivery_attempt for select
  using ((select auth.uid()) = user_id or public.is_admin_or_curator());
revoke all on table public.workspace_delivery_attempt from public, anon, authenticated;
grant select on table public.workspace_delivery_attempt to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke insert, update, delete, truncate, references, trigger on table public.workspace_delivery_attempt from service_role';
  end if;
end $$;

-- ── 2. 노출 키 — 정규화 동일 지문은 하나의 키(supply_learner_exposure 와 같은 정규화) ─────────
create function public.r5_exposure_key(p_kind text, p_ref text)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(
    (select 'passage:' || md5(regexp_replace(lower(c.passage), '\s+', ' ', 'g'))
       from public.csat_items c where p_kind = 'csat_item' and c.id = p_ref and c.passage is not null),
    'item:' || p_kind || ':' || p_ref)
$$;
revoke all on function public.r5_exposure_key(text, text) from public, anon, authenticated;

-- ── 3. 기록 RPC(학습자 본인) ─────────────────────────────────────────────
create function public.workspace_delivery_attempt_record(p_delivery uuid, p_attempt bigint, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); d record; q record; t record; c record; ln record; dem record; prev record;
  v_help text; v_key text; v_first boolean; v_unverifiable boolean := false; v_items text[]; v_at timestamptz; v_reason text; v_id uuid;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_delivery is null or p_attempt is null or p_request_key is null then raise exception 'attempt binding: arguments required'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);

  -- ① 요청 키 멱등 — 이전 결과는 역사 사실(재판정하지 않는다). 같은 (사용자, 요청 키) 동시 재전송은 잠금으로 직렬화해
  --    뒤 요청이 고유 제약 오류 대신 앞 요청의 id 를 읽게 한다(잠금 뒤에 조회).
  perform pg_advisory_xact_lock(hashtextextended('r5-attempt-req|' || v_uid::text || '|' || p_request_key::text, 0));
  select * into prev from workspace_delivery_attempt where user_id = v_uid and request_key = p_request_key;
  if found then
    if (prev.delivery_id, prev.attempt_id) is distinct from (p_delivery, p_attempt) then
      raise exception 'attempt binding: request_key reused with a different body' using errcode = '23505';
    end if;
    return prev.id;
  end if;

  -- ② 공급 행 = 호출자 것(RLS 와 별도로 정의자 안에서 다시 본다) · Workspace active
  select * into d from workspace_content_delivery where id = p_delivery and user_id = v_uid;
  if not found then raise exception 'attempt binding: delivery not found or not owned' using errcode = '42501'; end if;
  if not exists (select 1 from learner_workspace w where w.id = d.workspace_id and w.user_id = v_uid and w.status = 'active') then
    raise exception 'attempt binding: workspace not active';
  end if;
  select * into ln from workspace_content_demand_line where id = d.line_id;
  select * into dem from workspace_content_demand where id = ln.demand_id;

  -- ③ 시도 행 = 호출자 것 · 같은 문항 · 공급 뒤 서버 수신. TASK 는 ⑤ 에서 배포 주석 등록부로 대응시킨다
  --    (시도 task_key 는 과제 「키」(예: claim-support), 공급 task_id 는 TASK id(예: r.central_meaning) — 직접 비교하지 않는다)
  select * into t from learning_task_attempts where id = p_attempt for share;
  if not found or t.user_id is distinct from v_uid then raise exception 'attempt binding: attempt not found or not owned' using errcode = '42501'; end if;
  if t.item_ref is distinct from d.artifact_ref or t.task_key is null then
    raise exception 'attempt binding: attempt item/task differs from delivery';
  end if;
  if t.received_at is null or t.received_at < d.delivered_at then raise exception 'attempt binding: attempt predates delivery'; end if;
  if exists (select 1 from workspace_delivery_attempt x where x.attempt_id = p_attempt) then
    raise exception 'attempt binding: attempt already bound' using errcode = '23505';
  end if;

  -- ④ 도움 상태 — 시도 행에서(앱 attemptRole 과 같은 규칙). 빠진 사실은 거절
  if t.activity is null or t.phase is null or t.session_id is null or t.content_hash is null then
    raise exception 'attempt binding: attempt unbound (activity/phase/session/content hash missing)';
  end if;
  if t.activity = 'practice' then v_help := 'practice';
  elsif t.help_level is distinct from 'independent' then v_help := 'helped';
  elsif t.activity = 'theater' and t.phase = 'practice' then v_help := 'independent';
  elsif t.activity = 'theater' and t.phase = 'transfer' then v_help := 'transfer';
  else raise exception 'attempt binding: attempt unbound (activity %, phase %)', t.activity, t.phase;
  end if;

  -- ⑤ 내용 결속 — 시도가 채점한 주석 = 자격 주석 · 현재 revision = 공급 revision · 현재 배포 주석 = 자격 주석(어긋나면 거절)
  select * into q from content_qualification where id = d.qualification_id for share;
  if q.annotation_hash is null or q.annotation_ref is null then raise exception 'attempt binding: qualification has no annotation binding'; end if;
  if t.content_hash <> q.annotation_hash then raise exception 'attempt binding: attempt annotation differs from delivered annotation'; end if;
  if public.supply_artifact_revision(d.artifact_kind, d.artifact_ref) is distinct from d.artifact_revision then
    raise exception 'attempt binding: artifact revision changed since delivery';
  end if;
  if d.artifact_kind = 'csat_item' then
    select * into c from supply_current_annotation where artifact_ref = d.artifact_ref and task_id = d.task_id for share;
    if not found or (c.artifact_revision, c.annotation_ref, c.annotation_hash) is distinct from (d.artifact_revision, q.annotation_ref, q.annotation_hash) then
      raise exception 'attempt binding: current annotation differs from delivery';
    end if;
    -- 과제 키 → TASK 대응: 신뢰 등록부(supply_current_annotation · 배포 소유자만 갱신)의 (문항, TASK) 행이 가리키는 주석이
    -- 시도가 채점에 쓴 주석(response.annotation = 주석 version · content_hash = 주석 hash, 위에서 확인)과 같고, 그 version 이 과제 키로 시작해야 한다.
    if (t.response->>'annotation') is distinct from c.annotation_ref
       or left(c.annotation_ref, length(t.task_key) + 1) <> t.task_key || '-' then
      raise exception 'attempt binding: attempt task key does not map to delivery TASK';
    end if;
  else
    raise exception 'attempt binding: task mapping unavailable for %', d.artifact_kind;
  end if;

  -- ⑥ 첫 노출 — 사용자 × 노출 키 직렬화. 이 시도 수신 전에 같은 문항 · 같은 지문을 어느 경로로든 봤으면 첫 노출이 아니다.
  --    경로 = exposure-ledger.ts 6종(G2 시도 · G2 세션 · 함정 · 문제지/세션 시도 · 복습 큐 · 진단 응답/응시 회차) + 이 세션의 해설 열람 · 도움 + 앞선 결속.
  --    시각이 없는 기록(복습 큐 · 진단 응답 · 시각 없는 세션)은 「앞섰다」로 본다. 원장 표가 없으면 판정 불가 → 비근거(fail-closed).
  v_key := public.r5_exposure_key(d.artifact_kind, d.artifact_ref);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || '|' || v_key, 0));
  v_items := array(select j.id from csat_items j where j.id = d.artifact_ref
    or (v_key like 'passage:%' and j.passage is not null and 'passage:' || md5(regexp_replace(lower(j.passage), '\s+', ' ', 'g')) = v_key));
  if not (d.artifact_ref = any(v_items)) then v_items := v_items || d.artifact_ref; end if;
  if to_regclass('public.csat_trap_attempts') is null or to_regclass('public.csat_session_attempts') is null
     or to_regclass('public.csat_review_queue') is null or to_regclass('public.csat_dx_response') is null
     or to_regclass('public.csat_dx_session') is null then
    v_first := false; v_unverifiable := true;
  else
    v_first := not exists (select 1 from workspace_delivery_attempt x where x.user_id = v_uid and x.exposure_key = v_key)
      and not exists (select 1 from learning_task_attempts o
        where o.user_id = v_uid and o.id <> t.id and o.item_ref = any(v_items) and (o.received_at is null or o.received_at <= t.received_at))
      and not exists (select 1 from learning_sessions s
        where s.user_id = v_uid and s.id <> t.session_id and s.item_ref = any(v_items)
          and coalesce(least(s.revealed_at, s.explanation_viewed_at, s.explanation_server_at, s.help_received_at, s.help_server_at), '-infinity') <= t.received_at)
      and not exists (select 1 from learning_sessions s
        where s.id = t.session_id and least(s.explanation_viewed_at, s.explanation_server_at, s.help_received_at, s.help_server_at) <= t.received_at)
      and not exists (select 1 from csat_trap_attempts x where x.user_id = v_uid and x.item_id = any(v_items) and x.answered_at <= t.received_at)
      and not exists (select 1 from csat_session_attempts x where x.user_id = v_uid and x.item_id = any(v_items) and x.answered_at <= t.received_at)
      and not exists (select 1 from csat_review_queue x where x.user_id = v_uid and x.item_id = any(v_items))
      and not exists (select 1 from csat_dx_response r join csat_dx_session ds on ds.id = r.session_id
        where ds.user_id = v_uid and r.item_id = any(v_items))
      and not exists (select 1 from csat_dx_session ds join csat_items ci on ci.exam_id = ds.exam_id
        where ds.user_id = v_uid and ci.id = any(v_items));
  end if;
  v_at := case when v_first then coalesce((select s.revealed_at from learning_sessions s where s.id = t.session_id), t.received_at) end;

  -- ⑦ 근거 판정(비근거도 기록한다 — 이력 불변)
  if exists (select 1 from content_qualification s where s.supersedes = q.id) then v_reason := 'qualification_superseded';
  elsif exists (select 1 from content_release_revocation r join content_release_approval a on a.id = r.approval_id
                where a.qualification_id = q.id) then v_reason := 'approval_revoked';
  elsif public.supply_delivery_valid(d.id) is not true then v_reason := 'delivery_invalid';
  elsif v_unverifiable then v_reason := 'exposure_unverifiable';
  elsif not v_first then v_reason := 'not_first_exposure';
  elsif d.role in ('independent_check', 'delayed_check') then
    if v_help <> 'independent' then v_reason := 'help_state_mismatch'; end if;
  elsif d.role = 'transfer' then
    if v_help <> 'transfer' then v_reason := 'help_state_mismatch'; end if;
  else v_reason := 'role_not_evidence';
  end if;

  insert into workspace_delivery_attempt (user_id, workspace_id, plan_version, demand_id, line_id, order_id, delivery_id,
    qualification_id, approval_id, artifact_kind, artifact_ref, task_id, role, artifact_revision, annotation_ref, annotation_hash,
    attempt_id, session_id, help_state, exposure_key, first_exposure, first_exposed_at, evidence, non_evidence_reason, request_key)
  values (v_uid, d.workspace_id, dem.plan_version, dem.id, d.line_id, d.order_id, d.id,
    q.id, d.approval_id, d.artifact_kind, d.artifact_ref, d.task_id, d.role, d.artifact_revision, q.annotation_ref, q.annotation_hash,
    t.id, t.session_id, v_help, v_key, v_first, v_at, v_reason is null, v_reason, p_request_key)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.workspace_delivery_attempt_record(uuid, bigint, uuid) from public, anon;
grant execute on function public.workspace_delivery_attempt_record(uuid, bigint, uuid) to authenticated;
