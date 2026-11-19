-- supabase/migrations/_pending_source_lesson_reflection.sql
-- ⚠️ 보류(적용 안 함) — 단계 2B. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 무엇: 1D 로 납품된 한 원문(003946dd…)의 요지 → 제목 → 주제 3단계 안내 연습에서, 학습자가 **실제로 저장된 풀이 영수증**
--   (factory_dcp_attempt) 뒤에 쓴 자기 설명(주장 문장 · 근거 문장 · 관계 · 시범과의 비교 · 자기 절차)을 추가 전용으로 남긴다.
--   · 교수 자료 = source-lesson v3 정확한 바이트(SHA 0b653454…c7f0). 원천 파생 자료라 authored 로 등록하지 않는다.
--     원문 id 와 원문 content SHA(33dc4880…2b0f)는 등록 후보(factory_dcp_admission)의 값과 같아야 한다 — 다른 지문에 일괄 적용 안 함.
--   · 학습자 세션(auth.uid())만. 관리자 · service_role 이 학습자를 흉내내지 않는다. 직접 insert/update/delete 는 막는다.
--   · 같은 (학습자, mutation 키) + 같은 영수증 · 같은 본문 = 저장된 같은 결과(응답 유실 복구). 다른 본문 = 거절(23505).
--   · 한 단계(납품)당 설명 하나. 순서: 요지 설명 저장 → 제목 → 주제. 앞 단계 저장 없이는 다음 단계를 저장하지 않는다.
--   · 같은 원문 3문항은 지문 하나다 — 세 단계는 같은 Workspace · 같은 개인 주문(order_id)의 납품만 묶는다.
--   · 근거가 아니다: evidence = false · non_evidence_reason = 'guided_reflection' CHECK 고정. Gold 해시 · G2 결속을 만들지 않는다.
--   · 자유 설명의 정오는 판정하지 않는다(어휘 일치로 채점하지 않는다). 근거 집합 충분성은 화면의 형성 피드백일 뿐 저장 판정이 아니다.
--
-- 전제: _pending_factory_dcp_learning.sql(1D) 뒤.
-- 되돌리기(행 0 일 때만 · 별도 승인): drop function source_lesson_reflect(uuid,text,jsonb,uuid,uuid); drop function source_lesson_progress(uuid,text);
--   drop function source_lesson_check(uuid); drop table source_lesson_reflection; 이벤트 허용 목록에서 csat_source_lesson_reflected 를 뺀다.

do $$
begin
  if to_regclass('public.factory_dcp_attempt') is null or to_regprocedure('public.factory_dcp_delivery_state(uuid)') is null then
    raise exception 'source lesson reflection requires 1D factory dcp learning first';
  end if;
  if to_regclass('public.source_lesson_reflection') is not null then raise exception 'source lesson reflection already installed'; end if;
end $$;

create table public.source_lesson_reflection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  mutation_id uuid not null,
  lesson_id text not null check (lesson_id = 'title-route-central-meaning.v3'),
  lesson_sha256 text not null check (lesson_sha256 = '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0'),
  source_id uuid not null,
  source_content_sha256 text not null,
  attempt_id uuid not null references public.factory_dcp_attempt(id),
  delivery_id uuid not null references public.workspace_content_delivery(id),
  workspace_id uuid not null,
  order_id uuid not null,
  artifact_revision text not null,
  step text not null check (step in ('main_point', 'title', 'topic')),
  body jsonb not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  evidence boolean not null default false check (evidence = false),
  non_evidence_reason text not null default 'guided_reflection' check (non_evidence_reason = 'guided_reflection'),
  received_at timestamptz not null default now(),
  unique (user_id, mutation_id),
  unique (user_id, delivery_id, lesson_sha256)
);
create index source_lesson_reflection_scope on public.source_lesson_reflection (user_id, workspace_id, order_id, step);
create trigger source_lesson_reflection_append_only before update or delete on public.source_lesson_reflection
  for each row execute function public.forbid_ledger_mutation();
create trigger source_lesson_reflection_writer before insert on public.source_lesson_reflection
  for each row execute function public.supply_writer_guard();
alter table public.source_lesson_reflection enable row level security;
create policy slr_own_read on public.source_lesson_reflection for select using (user_id = auth.uid());
revoke all on public.source_lesson_reflection from public, anon, authenticated;
grant select on public.source_lesson_reflection to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.source_lesson_reflection from service_role';
    execute 'grant select on table public.source_lesson_reflection to service_role';
  end if;
end $$;

-- ── 이 납품이 교수 자료의 원문인가 — 'ok' · 'lesson_mismatch' 또는 1D 의 닫힌 납품 코드 ─────────────
create function public.source_lesson_check(p_delivery uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_state text;
begin
  v_state := public.factory_dcp_delivery_state(p_delivery);
  if v_state <> 'ok' then return v_state; end if;
  if not exists (select 1 from workspace_content_delivery d join factory_dcp_admission x on x.dcp_item_id::text = d.artifact_ref
                 where d.id = p_delivery and x.source_id = '003946dd-f5e6-4efe-9254-b7a69ca39e61'
                   and x.source_content_sha256 = '33dc4880f42b6b5815b93da059beb2dae640b138371e0cb1992ad46ba6452b0f') then
    return 'lesson_mismatch';
  end if;
  return 'ok';
end $$;
revoke all on function public.source_lesson_check(uuid) from public, anon, authenticated;

-- ── 진행 — 같은 Workspace · 같은 개인 주문의 세 단계(요지 · 제목 · 주제)와 풀이/설명 저장 여부 ───────────
create function public.source_lesson_progress(p_delivery uuid, p_lesson_sha text)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); v_state text; d record; v_steps jsonb;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_lesson_sha is distinct from '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0' then
    return jsonb_build_object('state', 'lesson_mismatch');
  end if;
  v_state := public.source_lesson_check(p_delivery);
  if v_state <> 'ok' then return jsonb_build_object('state', v_state); end if;
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = v_uid;
  select coalesce(jsonb_agg(s order by s->>'ord'), '[]'::jsonb) into v_steps from (
    select jsonb_build_object('ord', array_position(array['main_point','title','topic'], i.type), 'type', i.type, 'delivery_id', i.id,
      'state', public.source_lesson_check(i.id),
      'attempted', exists(select 1 from factory_dcp_attempt t where t.delivery_id = i.id and t.user_id = v_uid),
      'reflected', exists(select 1 from source_lesson_reflection r where r.delivery_id = i.id and r.user_id = v_uid and r.lesson_sha256 = p_lesson_sha)) s
    from (select distinct on (i2.type) w2.id, i2.type from workspace_content_delivery w2
            join factory_dcp_admission x on x.dcp_item_id::text = w2.artifact_ref join csat_dcp_items i2 on i2.id = x.dcp_item_id
           where w2.user_id = v_uid and w2.workspace_id = d.workspace_id and w2.order_id = d.order_id and w2.artifact_kind = 'dcp_item'
             and x.source_id = '003946dd-f5e6-4efe-9254-b7a69ca39e61' and i2.type in ('main_point','title','topic')
           order by i2.type, w2.delivered_at desc) i
  ) q(s);
  return jsonb_build_object('state', 'ok', 'delivery_id', d.id, 'workspace_id', d.workspace_id, 'steps', v_steps);
end $$;
revoke all on function public.source_lesson_progress(uuid, text) from public, anon;
grant execute on function public.source_lesson_progress(uuid, text) to authenticated;

-- ── 설명 저장 — 실제 풀이 영수증 뒤 · 순서 · 원자적 · 멱등 ─────────────────────────
-- 본문(닫힌 키): { step, claim: 0..8|null, support: [0..8 서로 다른 1~4개], relation: 2~600자,
--   comparison: 요지만 필수(2~600자) · 다른 단계 null, procedure: 주제만 필수(2~600자) · 다른 단계 null }
create function public.source_lesson_reflect(p_attempt uuid, p_lesson_sha text, p_body jsonb, p_mutation uuid, p_delivery uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid(); v_hash text; prev record; t record; d record; x record; v_step text; v_template text; v_state text;
  v_prev_step text; v_id uuid; g jsonb; v_sup jsonb; v_len int;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  -- HTTP 경로가 지정한 납품은 저장/멱등 응답 전에 영수증과 결속한다.
  -- 직접 RPC는 영수증 자체를 대상으로 삼을 수 있으나, 경로를 받은 서버는 반드시 p_delivery를 전달한다.
  if p_delivery is not null and not exists (
    select 1 from factory_dcp_attempt a where a.id = p_attempt and a.user_id = v_uid and a.delivery_id = p_delivery
  ) then raise exception 'reflect: attempt not_found' using errcode = 'P0001'; end if;
  if p_lesson_sha is distinct from '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0' then
    raise exception 'reflect: lesson lesson_mismatch' using errcode = 'P0001';
  end if;
  if p_attempt is null or p_mutation is null or p_body is null or jsonb_typeof(p_body) <> 'object'
     or (select array_agg(k order by k) from jsonb_object_keys(p_body) k) is distinct from array['claim','comparison','procedure','relation','step','support']
     or coalesce(p_body->>'step', '') not in ('main_point', 'title', 'topic') then
    raise exception 'reflect: body must be closed {step,claim,support,relation,comparison,procedure}' using errcode = '22023';
  end if;
  v_step := p_body->>'step';
  -- 주장 문장: 요지 · 주제는 필수(0..8), 제목은 null 허용
  if jsonb_typeof(p_body->'claim') = 'null' then
    if v_step <> 'title' then raise exception 'reflect: claim required' using errcode = '22023'; end if;
  elsif jsonb_typeof(p_body->'claim') <> 'number' or (p_body->>'claim') !~ '^[0-8]$' then
    raise exception 'reflect: claim must be 0..8' using errcode = '22023';
  end if;
  v_sup := p_body->'support';
  if jsonb_typeof(v_sup) <> 'array' or jsonb_array_length(v_sup) not between 1 and 4
     or exists (select 1 from jsonb_array_elements(v_sup) e where jsonb_typeof(e) <> 'number' or e::text !~ '^[0-8]$')
     or (select count(distinct e::text) from jsonb_array_elements(v_sup) e) <> jsonb_array_length(v_sup) then
    raise exception 'reflect: support must be 1..4 distinct 0..8' using errcode = '22023';
  end if;
  if jsonb_typeof(p_body->'relation') <> 'string' or char_length(btrim(p_body->>'relation')) not between 2 and 600 then
    raise exception 'reflect: relation must be 2..600 chars' using errcode = '22023';
  end if;
  if v_step = 'main_point' then
    if jsonb_typeof(p_body->'comparison') <> 'string' or char_length(btrim(p_body->>'comparison')) not between 2 and 600 then
      raise exception 'reflect: comparison must be 2..600 chars' using errcode = '22023';
    end if;
  elsif jsonb_typeof(p_body->'comparison') <> 'null' then raise exception 'reflect: comparison only on main_point' using errcode = '22023';
  end if;
  if v_step = 'topic' then
    if jsonb_typeof(p_body->'procedure') <> 'string' or char_length(btrim(p_body->>'procedure')) not between 2 and 600 then
      raise exception 'reflect: procedure must be 2..600 chars' using errcode = '22023';
    end if;
  elsif jsonb_typeof(p_body->'procedure') <> 'null' then raise exception 'reflect: procedure only on topic' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_body::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('source_lesson_reflect:' || v_uid::text || ':' || p_mutation::text, 0));

  -- ① 같은 키 재전송 — 같은 영수증 · 같은 본문일 때만 저장된 결과
  select * into prev from source_lesson_reflection r where r.user_id = v_uid and r.mutation_id = p_mutation;
  if found then
    if prev.attempt_id <> p_attempt or prev.body_hash <> v_hash then
      raise exception 'reflect: mutation key reused with a different body' using errcode = '23505';
    end if;
    return prev.result || jsonb_build_object('replayed', true);
  end if;

  -- ② 본인의 실제 풀이 영수증 — 남의 영수증은 존재를 알리지 않는다
  select * into t from factory_dcp_attempt a where a.id = p_attempt and a.user_id = v_uid;
  if not found then raise exception 'reflect: attempt not_found' using errcode = 'P0001'; end if;
  select w.template_id into v_template from learner_workspace w where w.id = t.workspace_id and w.user_id = v_uid;
  if not found then raise exception 'reflect: delivery workspace_closed' using errcode = 'P0001'; end if;
  -- 잠금 순서는 1D 제출과 같다: map_goal → map_plan → Workspace → 주문 → 납품 → 승인 → 등록 후보
  perform pg_advisory_xact_lock(hashtext('map_goal:' || v_uid::text));
  perform pg_advisory_xact_lock(hashtext('map_plan:' || v_uid::text || ':' || v_template));
  perform 1 from learner_workspace w where w.id = t.workspace_id and w.user_id = v_uid for share;
  select * into d from workspace_content_delivery w where w.id = t.delivery_id and w.user_id = v_uid;
  if d.order_id is not null then perform 1 from factory_order o where o.id = d.order_id for share; end if;
  perform 1 from workspace_content_delivery w where w.id = d.id for share;
  perform 1 from content_release_approval r where r.id = d.approval_id for share;
  perform 1 from factory_dcp_admission a where a.dcp_item_id::text = d.artifact_ref for share;

  -- ③ 지금도 유효한 납품 · 교수 자료의 원문 · 같은 판본 · 단계 일치
  v_state := public.source_lesson_check(d.id);
  if v_state <> 'ok' then raise exception 'reflect: delivery %', v_state using errcode = 'P0001'; end if;
  select a.*, i.type into x from factory_dcp_admission a join csat_dcp_items i on i.id = a.dcp_item_id where a.dcp_item_id::text = d.artifact_ref;
  if x.artifact_revision <> t.artifact_revision or x.dcp_item_id <> t.dcp_item_id then raise exception 'reflect: delivery stale_revision' using errcode = 'P0001'; end if;
  if x.type <> v_step then raise exception 'reflect: step does not match the attempted item' using errcode = '22023'; end if;

  -- ④ 순서 — 앞 단계 설명이 같은 Workspace · 같은 주문에 저장돼 있어야 한다
  v_prev_step := case v_step when 'title' then 'main_point' when 'topic' then 'title' end;
  if v_prev_step is not null and not exists (select 1 from source_lesson_reflection r where r.user_id = v_uid and r.workspace_id = d.workspace_id
       and r.order_id = d.order_id and r.step = v_prev_step and r.lesson_sha256 = p_lesson_sha) then
    raise exception 'reflect: step out_of_order' using errcode = 'P0001';
  end if;
  if exists (select 1 from source_lesson_reflection r where r.user_id = v_uid and r.delivery_id = d.id and r.lesson_sha256 = p_lesson_sha) then
    raise exception 'reflect: already reflected for this step' using errcode = '23505';
  end if;

  v_id := gen_random_uuid();
  g := jsonb_build_object('reflection_id', v_id, 'attempt_id', t.id, 'delivery_id', d.id, 'step', v_step, 'recorded', true,
    'evidence', false, 'non_evidence_reason', 'guided_reflection');
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  insert into source_lesson_reflection (id, user_id, mutation_id, lesson_id, lesson_sha256, source_id, source_content_sha256, attempt_id, delivery_id,
    workspace_id, order_id, artifact_revision, step, body, body_hash, result)
  values (v_id, v_uid, p_mutation, 'title-route-central-meaning.v3', p_lesson_sha, x.source_id, x.source_content_sha256, t.id, d.id,
    d.workspace_id, d.order_id, x.artifact_revision, v_step, p_body, v_hash, g);
  return g || jsonb_build_object('replayed', false);
end $$;
revoke all on function public.source_lesson_reflect(uuid, text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.source_lesson_reflect(uuid, text, jsonb, uuid, uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on function public.source_lesson_check(uuid) from service_role;
    revoke all on function public.source_lesson_progress(uuid,text) from service_role;
    revoke all on function public.source_lesson_reflect(uuid,text,jsonb,uuid,uuid) from service_role;
  end if;
end $$;

-- ── 계측 허용 목록 — csat_source_lesson_reflected 하나(1D 와 같은 방식: 실제 제약에서 읽어 더한다) ─────────
do $$
declare v_names text[]; v_def text; v_new constant text[] := array['csat_source_lesson_reflected'];
begin
  -- 제약은 두 모양 중 하나다: array['a','b'] (원래) · '{a,b}'::text[] (1D 처럼 format(%L) 로 다시 만든 뒤). 둘 다 읽는다
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
   where c.conrelid = 'public.funnel_events'::regclass and c.conname = 'funnel_events_event_check';
  select array_agg(distinct n) into v_names from (
    select m[1] n from regexp_matches(coalesce(v_def, ''), '''([a-z0-9_]+)''', 'g') m
    union select unnest(string_to_array(b[1], ',')) from regexp_matches(coalesce(v_def, ''), '''[{]([a-z0-9_,]+)[}]''', 'g') b) z;
  if v_names is null or cardinality(v_names) = 0 then raise exception 'funnel_events_event_check not found or unreadable'; end if;
  v_names := array(select distinct x from unnest(v_names || v_new) x order by x);
  alter table public.funnel_events drop constraint funnel_events_event_check;
  execute format('alter table public.funnel_events add constraint funnel_events_event_check check (event = any (%L::text[]))', v_names);
end $$;
