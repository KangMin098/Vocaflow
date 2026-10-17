-- supabase/migrations/_pending_workspace_supply_i1_safety.sql
-- ⚠️ 보류(적용 안 함) — Factory I1 안전 delta(D1 노출 · D2 승인 범위). 적용 순서: C → B → **이 파일** → (선택) P → (선택) D3.
-- I0 의 `_pending_workspace_supply_b_delta_i0.sql`(PR #277) 의 D1 · D2 를 **대체**한다 — 둘을 함께 적용하지 않는다.
-- 승인 패키지 · 실측 근거: docs/csat-learner/v62/FACTORY_I1_APPROVAL_PACKAGE.md · FACTORY_I1_SECURITY_AUDIT.md
--
-- D1 노출(G) — 평가 역할(독립 확인 · 전이 · 지연 확인)은 학습자가 그 문항을 **어떤 경로로든 본 적이 없을 때만** 공급한다.
--    B 는 csat_dx_* 만 봤다. 개발 DB 2026-10-17 읽기 전용 실측(사용자×문항 쌍): G2 시도 123 · 학습 세션 176(그중 viewed_first 55)
--    · 함정 시도 13 · 세션 시도 1 · 복습 큐 1 이 B 에서 'none' 으로 보였다. I0 delta 도 함정 시도 11쌍 · 삭제된 세션 · viewed_first 만 있는 세션을 놓친다.
--    판정 불가(원장 없음 · 문항 없음 · 인자 없음)는 'unknown' = 거절. 조회 오류는 예외로 공급 트랜잭션 전체를 실패시킨다(fail-closed).
-- D2 승인 — 앱 계약(qualification.ts toSupplyQualification · supplyEligible)과 같게:
--    모든 역할 = 이 자격 행의 유효(철회 없는) public 승인 필수. 평가 역할 = 유효 assessment 승인도 필수.
--    p_approval(기록용)은 이 자격 행의 유효 승인이어야 하고, 평가 역할이면 assessment 범위여야 한다.
--    승인 행을 잠가(FOR SHARE) 철회 함수(FOR UPDATE)와 직렬화한다 — 철회 직전 공급 · 철회 직후 공급의 경계가 한 줄로 정해진다.
-- 같이 고치는 B 결함(같은 함수라 분리 불가):
--    · 공급 수량 상한 없음 → 줄 수량 · 주문 수량을 넘는 공급 거절(줄 잠금으로 직렬화). 닫힌 주문(delivered · failed · partial)에 공급 거절.
--      실제 PostgreSQL 17 기준선(B 만): 수량 3 줄에 동시 공급 20 → 20행. I1: 3행.
--    · 철회 경합 → B 는 철회 트랜잭션이 열린 사이 공급이 통과했다(철회 커밋 뒤 「철회된 승인」으로 공급 1행). I1: 공급이 기다린 뒤 거절.
--    · 같은 요청 키 재전송은 줄 잠금 뒤에 본다(B 기준선도 20/20 같은 id 였다 — 결함이 아니라 순서를 고정한 것).
--
-- 바뀌는 객체: supply_learner_exposure · workspace_delivery_record · content_release_revoke · fq_axes_valid · fq_role_ok, 아래 C/B 정의자 함수 search_path.
-- 새 객체: function supply_delivery_valid(uuid)(실행권: 정의자 함수 안에서만 — public · anon · authenticated 회수)
-- 표 · 열 · RLS 변경 없음 · 데이터 변경 없음.
-- 되돌리기: 세 함수를 B · C 원본 정의로 다시 create or replace, drop function supply_delivery_valid(uuid)(원본 sha256 은 승인 패키지 §2).
--           이 파일은 데이터를 만들지 않으므로 손실 없음.

-- C의 SQL NULL은 CHECK/IF NOT에서 거절되지 않는다. 빠진 state는 pass가 아니다.
create or replace function public.fq_axes_valid(p jsonb) returns boolean
language sql immutable set search_path to 'public', 'pg_temp' as $$
  select coalesce(jsonb_typeof(p) = 'object'
     and (select count(*) from jsonb_object_keys(p)) = 8
     and (select bool_and(coalesce(k in ('A','B','C','D','E','F','G','H')
                          and jsonb_typeof(p -> k) = 'object'
                          and (p -> k ->> 'state') in ('pass','fail','unknown','not_applicable'), false))
          from jsonb_object_keys(p) k), false)
$$;
create or replace function public.fq_role_ok(p jsonb, p_role text) returns boolean
language sql immutable set search_path to 'public', 'pg_temp' as $$
  select coalesce((p->'A'->>'state') = 'pass' and (p->'B'->>'state') = 'pass' and (p->'C'->>'state') = 'pass'
     and (p->'F'->>'state') = 'pass' and (p->'H'->>'state') = 'pass'
     and (p_role not in ('source_analysis','model_explanation','guided_practice') or (p->'D'->>'state') = 'pass')
     and (p_role not in ('independent_check','transfer','delayed_check') or (p->'E'->>'state') = 'pass'), false)
$$;

-- ── D1. 노출 ───────────────────────────────────────────────────────────────
-- NULL in the existing admin helper must deny all administrator writes.
create or replace function public.content_qualification_record(
  p_rules_version text, p_kind text, p_ref text, p_revision text, p_task text, p_role text, p_axes jsonb,
  p_source_revision text, p_source_hash text, p_analysis_revision text, p_gold_revision text, p_gold_hash text,
  p_defects text[], p_evidence_ids text[], p_method text, p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_id uuid; prev record;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  if p_supersedes is not null then
    select * into prev from content_qualification where id = p_supersedes for update;
    if not found then raise exception 'supersedes: not found'; end if;
    if (prev.artifact_kind, prev.artifact_ref, prev.task_id, prev.role) is distinct from (p_kind, p_ref, p_task, p_role) then
      raise exception 'supersedes: identity mismatch';
    end if;
  end if;
  insert into content_qualification (rules_version, artifact_kind, artifact_ref, artifact_revision, task_id, role, axes,
    source_revision, source_hash, analysis_revision, gold_revision, gold_hash, defects, evidence_ids, method, supersedes, created_by)
  values (p_rules_version, p_kind, p_ref, p_revision, p_task, p_role, p_axes,
    p_source_revision, p_source_hash, p_analysis_revision, p_gold_revision, p_gold_hash,
    coalesce(p_defects, '{}'), coalesce(p_evidence_ids, '{}'), p_method, p_supersedes, auth.uid())
  returning id into v_id;     -- 같은 이전 행을 두 번 대체하면 unique(supersedes) 위반(동시 대체 1건만 성공)
  return v_id;
end $$;

create or replace function public.content_release_approve(p_qualification uuid, p_scope text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare q record; v_id uuid;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into q from content_qualification where id = p_qualification for share;
  if not found then raise exception 'qualification: not found'; end if;
  if exists (select 1 from content_qualification s where s.supersedes = q.id) then raise exception 'qualification: superseded'; end if;
  if not public.fq_role_ok(q.axes, q.role) then raise exception 'qualification: required axes not pass'; end if;
  if p_scope = 'assessment' and (q.axes->'E'->>'state') <> 'pass' then raise exception 'assessment: E not pass'; end if;
  insert into content_release_approval (qualification_id, scope, approver, approver_role, note)
  values (q.id, p_scope, auth.uid(), case when public.is_admin() then 'admin' else 'curator' end, p_note)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text,
  p_run_id text, p_qualification uuid, p_request_key uuid)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare o record; v_seq int; ok boolean; e record;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into o from factory_order where id = p_order for update;
  if not found then raise exception 'order: not found'; end if;
  -- 같은 요청 재전송: 같은 본문(기대 상태 · 목표 · 이유 · 실행 · 자격)일 때만 이전 seq
  select * into e from factory_order_event where order_id = p_order and request_key = p_request_key;
  if found then
    if (e.from_state, e.to_state, e.reason, e.production_run_id, e.qualification_id)
       is distinct from (p_expected, p_to, p_reason, p_run_id, p_qualification) then
      raise exception 'order: request_key reused with a different body' using errcode = '23505';
    end if;
    return e.seq;
  end if;
  if o.state <> p_expected then raise exception 'order: conflict (expected %, is %)', p_expected, o.state using errcode = '40001'; end if;
  ok := (o.state, p_to) in (
    ('requested','stock_search'),('requested','held'),('requested','failed'),
    ('stock_search','delivered'),('stock_search','awaiting_production'),('stock_search','held'),('stock_search','failed'),
    ('awaiting_production','producing'),('awaiting_production','held'),('awaiting_production','failed'),
    ('producing','reviewing'),('producing','failed'),
    ('reviewing','delivered'),('reviewing','held'),('reviewing','failed'),
    ('held','stock_search'),('held','awaiting_production'),('held','failed'));
  if not ok then raise exception 'order: transition % -> % not allowed', o.state, p_to; end if;
  -- delivered 는 그 주문 줄에 실제 공급 행이 있고 그 자격이 이 이벤트의 자격일 때만
  if p_to = 'delivered' and not exists (
    select 1 from workspace_content_delivery d where d.order_id = p_order and d.qualification_id = p_qualification) then
    raise exception 'order: delivered needs a delivery row with this qualification';
  end if;
  v_seq := o.event_seq + 1;
  insert into factory_order_event (order_id, seq, from_state, to_state, reason, production_run_id, qualification_id, actor, request_key)
  values (p_order, v_seq, o.state, p_to, p_reason, p_run_id, p_qualification, auth.uid(), p_request_key);
  update factory_order set state = p_to, event_seq = v_seq,
    production_run_id = coalesce(p_run_id, production_run_id) where id = p_order;
  return v_seq;
end $$;

create or replace function public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  c record;
  v_norm text;
begin
  if p_kind is null or p_ref is null or p_uid is null then return 'unknown'; end if;

  if p_kind = 'csat_item' then
    -- 노출 원장 중 하나라도 없으면 판정할 수 없다(설치 누락 · 이름 변경) — 「본 적 없음」으로 치지 않는다
    if to_regclass('public.csat_dx_response') is null or to_regclass('public.csat_dx_session') is null
       or to_regclass('public.learning_task_attempts') is null or to_regclass('public.learning_sessions') is null
       or to_regclass('public.csat_trap_attempts') is null or to_regclass('public.csat_session_attempts') is null
       or to_regclass('public.csat_review_queue') is null then
      return 'unknown';
    end if;
    select id, exam_id, passage into c from csat_items where id = p_ref;
    if not found then return 'unknown'; end if;

    -- ① 이 문항을 풀었다(어느 경로든) — 합성(synthetic) 행도 센다: 실제 학습자 원장에 섞인 시험 행이라도 보수적으로 노출
    if exists (select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id where s.user_id = p_uid and r.item_id = p_ref)
       or exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = p_ref)
       or exists (select 1 from learning_task_attempts t join learning_sessions s on s.id = t.session_id
                  where t.user_id = p_uid and t.item_ref is null and s.user_id = p_uid and s.item_ref = p_ref)
       or exists (select 1 from csat_trap_attempts t where t.user_id = p_uid and t.item_id = p_ref)
       or exists (select 1 from csat_session_attempts t where t.user_id = p_uid and t.item_id = p_ref)
       or exists (select 1 from csat_review_queue q where q.user_id = p_uid and q.item_id = p_ref) then
      return 'attempted';
    end if;
    -- ② 해설 · 정답 공개 · 「먼저 보기」 도움 — **삭제된 세션도 센다**(세션을 지워도 본 사실은 지워지지 않는다)
    if exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = p_ref
               and (s.explanation_viewed_at is not null or s.explanation_server_at is not null or s.revealed_at is not null
                    or s.help_level = 'viewed_first' or s.help_received_at is not null or s.help_server_at is not null)) then
      return 'explanation_seen';
    end if;
    -- ③ 문항 화면을 연 적이 있다(시도 · 해설 없이) — 문제를 읽었으므로 첫 독립 시도가 아니다
    if exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = p_ref) then
      return 'item_seen';
    end if;
    -- ④ 같은 시험 회차를 응시했다(문항 번호를 모르는 응답 포함 — 실측: item_id 없는 응답 51행은 모두 회차가 있다)
    if exists (select 1 from csat_dx_session s where s.user_id = p_uid and s.exam_id = c.exam_id) then
      return 'exam_seen';
    end if;
    -- ⑤ 정규화 동일 지문의 다른 문항을 위 어느 경로로든 봤다(41–42 · 43–45 공유 지문, 회차 간 재사용)
    if c.passage is not null then
      v_norm := md5(regexp_replace(lower(c.passage), '\s+', ' ', 'g'));
      if exists (
        select 1 from csat_items j
        where j.id <> c.id and j.passage is not null
          and md5(regexp_replace(lower(j.passage), '\s+', ' ', 'g')) = v_norm
          and (exists (select 1 from csat_dx_session s where s.user_id = p_uid and s.exam_id = j.exam_id)
            or exists (select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id
                       where s.user_id = p_uid and r.item_id = j.id)
            or exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = j.id)
            or exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = j.id)
            or exists (select 1 from csat_trap_attempts t where t.user_id = p_uid and t.item_id = j.id)
            or exists (select 1 from csat_session_attempts t where t.user_id = p_uid and t.item_id = j.id)
            or exists (select 1 from csat_review_queue q where q.user_id = p_uid and q.item_id = j.id))) then
        return 'shared_passage_seen';
      end if;
    end if;
    return 'none';

  elsif p_kind = 'dcp_item' then
    -- DCP 는 해설 열람 · 힌트 · 같은 기사 다른 문항 노출 원장이 없다 → 시도가 없어도 'unknown'(B 와 같음: 평가 공급 HOLD)
    if p_ref !~ '^[0-9a-f-]{36}$' then return 'unknown'; end if;
    if to_regclass('public.csat_item_attempts') is null then return 'unknown'; end if;
    if exists (select 1 from csat_item_attempts t where t.user_id = p_uid and t.dcp_item_id = p_ref::uuid) then return 'attempted'; end if;
    return 'unknown';
  end if;
  return 'unknown';
end $$;
revoke all on function public.supply_learner_exposure(text, text, uuid) from public, anon, authenticated;

-- ── D2 보조. 공급 행이 **지금도** 유효한가 — 승인 철회 · 산출물 변경 뒤에는 부족분으로 다시 센다 ─────────────
-- 유효 = 현재 자격/필수 축 · 유효 public/(평가)assessment 승인 · 기록 승인 철회 없음 · 현재 revision · 현재 원천/Reveal Gate 적격.
-- 자격 대체(supersede)는 과거 이력을 보존하되 현재 공급으로 세지 않는다. 새 자격/승인은 자동 상속하지 않는다.
create or replace function public.supply_delivery_valid(p_delivery uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from workspace_content_delivery d join content_qualification q on q.id = d.qualification_id
    where d.id = p_delivery
      and not exists (select 1 from content_qualification s where s.supersedes = q.id)
      and public.fq_role_ok(q.axes, q.role) is true
      and not exists (select 1 from content_release_revocation r where r.approval_id = d.approval_id)
      and exists (select 1 from content_release_approval x where x.qualification_id = d.qualification_id and x.scope = 'public'
                  and not exists (select 1 from content_release_revocation r where r.approval_id = x.id))
      and (d.role not in ('independent_check','transfer','delayed_check')
           or exists (select 1 from content_release_approval x where x.qualification_id = d.qualification_id and x.scope = 'assessment'
                      and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)))
      and public.supply_artifact_revision(d.artifact_kind, d.artifact_ref) = d.artifact_revision
      and (d.artifact_kind <> 'csat_item' or public.csat_ec_embargoed_items(array[d.artifact_ref]) = '{}'::text[])
      and (d.artifact_kind <> 'dcp_item' or exists (
        select 1 from csat_dcp_items i where i.id = d.artifact_ref::uuid and i.kind = 'article'
          and i.ref_id is not null and public.csat_source_is_eligible(i.ref_id) is true)))
$$;
revoke all on function public.supply_delivery_valid(uuid) from public, anon, authenticated;

-- ── D2. 공급 기록 — 승인 범위 · 철회 직렬화 · 멱등 경합 · 수량 상한 ─────────────────────
-- B 원본과 같은 서명 · 같은 검사 순서 ①~⑧ 을 유지하고 ⑥(승인)을 앱 계약으로 바꾼다. 바뀐 곳은 「(I1)」 표시.
create or replace function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  ln record; q record; a record; d record; o record;
  v_id uuid; v_src uuid; v_rev text; v_exp text;
  v_assess boolean;
  v_line_n int; v_order_n int;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_request_key is null then raise exception 'delivery: request_key required'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);

  -- (I1) 줄을 먼저 잠근다 — 같은 줄의 공급(수량 상한 · 같은 키 재전송)을 직렬화. 소유 확인을 겸한다
  select * into ln from workspace_content_demand_line where id = p_line and user_id = v_uid for update;

  -- ① 같은 요청 키 = 같은 본문일 때만 이전 결과(잠근 뒤에 본다 — 동시 재전송이 먼저 커밋된 행을 본다)
  select * into d from workspace_content_delivery where user_id = v_uid and request_key = p_request_key;
  if found then
    if (d.line_id, d.order_id, d.qualification_id, d.approval_id) is distinct from (p_line, p_order, p_qualification, p_approval) then
      raise exception 'delivery: request_key reused with a different body' using errcode = '23505';
    end if;
    return d.id;
  end if;

  -- ② 줄 소유 · Workspace active
  if ln.id is null then raise exception 'delivery: line not found or not owned' using errcode = '42501'; end if;
  if not exists (select 1 from learner_workspace w where w.id = ln.workspace_id and w.user_id = v_uid and w.status = 'active') then
    raise exception 'delivery: workspace not active';
  end if;

  -- ③ 주문이 이 줄 것 · (I1) 열린 주문일 것
  if p_order is not null then
    select * into o from factory_order where id = p_order and line_id = p_line for update;
    if not found then raise exception 'delivery: order not on this line'; end if;
    if o.state in ('delivered','failed','partial') then raise exception 'delivery: order closed (%)', o.state; end if;
  end if;

  -- ④ 자격 정체성 · 현재 행 · 역할 필수 축
  select * into q from content_qualification where id = p_qualification for share;
  if not found or q.task_id <> ln.task_id or q.role <> ln.role then raise exception 'delivery: qualification identity mismatch'; end if;
  if exists (select 1 from content_qualification s where s.supersedes = q.id) then raise exception 'delivery: qualification superseded'; end if;
  if public.fq_role_ok(q.axes, q.role) is not true then raise exception 'delivery: required axes not pass'; end if;

  -- ⑤ 산출물 실제 행 · 현재 revision
  v_rev := public.supply_artifact_revision(q.artifact_kind, q.artifact_ref);
  if v_rev is null then raise exception 'delivery: artifact not found or kind unsupported (%)', q.artifact_kind; end if;
  if v_rev <> q.artifact_revision then raise exception 'delivery: artifact changed since qualification'; end if;

  -- ⑥ (I1) 승인 — 이 자격의 승인 행을 모두 잠가 철회와 직렬화(철회 함수가 같은 행을 FOR UPDATE 로 잡는다)
  v_assess := q.role in ('independent_check','transfer','delayed_check');
  perform 1 from content_release_approval x where x.qualification_id = q.id order by x.id for share;
  select * into a from content_release_approval where id = p_approval and qualification_id = q.id;
  if not found then raise exception 'delivery: approval missing'; end if;
  if exists (select 1 from content_release_revocation r where r.approval_id = a.id) then raise exception 'delivery: approval revoked'; end if;
  if not exists (select 1 from content_release_approval x where x.qualification_id = q.id and x.scope = 'public'
                 and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)) then
    raise exception 'delivery: public approval required';
  end if;
  if v_assess then
    if not exists (select 1 from content_release_approval x where x.qualification_id = q.id and x.scope = 'assessment'
                   and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)) then
      raise exception 'delivery: assessment approval required';
    end if;
    if a.scope <> 'assessment' then raise exception 'delivery: assessment role must record the assessment approval'; end if;
  end if;

  -- ⑦ 원천 지금 적격(DCP)
  if q.artifact_kind = 'dcp_item' then
    select i.ref_id into v_src from csat_dcp_items i where i.id = q.artifact_ref::uuid;
    if v_src is null or public.csat_source_is_eligible(v_src) is not true then raise exception 'delivery: source not eligible'; end if;
  elsif q.artifact_kind = 'csat_item' then
    if public.csat_ec_embargoed_items(array[q.artifact_ref]) is distinct from '{}'::text[] then
      raise exception 'delivery: source not eligible (Reveal Gate)';
    end if;
  end if;

  -- ⑧ G — 평가 역할은 노출 'none' 일 때만(D1 판정기)
  if v_assess then
    v_exp := public.supply_learner_exposure(q.artifact_kind, q.artifact_ref, v_uid);
    if v_exp is distinct from 'none' then raise exception 'delivery: G — exposure %', coalesce(v_exp, 'unknown'); end if;
  end if;

  -- ⑨ (I1) 수량 상한 — 줄은 **지금 유효한** 공급 수로, 주문은 그 주문의 공급 행 수로 센다.
  --    철회 · 변경으로 무효가 된 공급은 자리를 비워 대체 공급을 받을 수 있다(같은 산출물 재공급은 B 의 unique 가 막는다)
  select count(*) into v_line_n from workspace_content_delivery x where x.line_id = p_line and public.supply_delivery_valid(x.id);
  if v_line_n >= ln.quantity then raise exception 'delivery: line quantity reached (% of %)', v_line_n, ln.quantity; end if;
  if p_order is not null then
    select count(*) into v_order_n from workspace_content_delivery where order_id = p_order;
    if v_order_n >= o.quantity then raise exception 'delivery: order quantity reached (% of %)', v_order_n, o.quantity; end if;
  end if;

  insert into workspace_content_delivery (line_id, user_id, workspace_id, role, task_id, order_id, artifact_kind, artifact_ref,
    artifact_revision, qualification_id, approval_id, request_key)
  values (p_line, v_uid, ln.workspace_id, ln.role, ln.task_id, p_order, q.artifact_kind, q.artifact_ref, q.artifact_revision, q.id, a.id, p_request_key)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) to authenticated;

-- ── D2'. 철회 — 승인 행을 FOR UPDATE 로 잡아 진행 중 공급(FOR SHARE)과 직렬화. 그 밖은 C 원본과 같다 ───────
create or replace function public.content_release_revoke(p_approval uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  perform 1 from content_release_approval where id = p_approval for update;
  if not found then raise exception 'revoke: approval not found'; end if;
  insert into content_release_revocation (approval_id, revoked_by, reason) values (p_approval, auth.uid(), p_reason)
  on conflict (approval_id) do nothing;   -- 이미 철회됨 = 같은 결과
end $$;
revoke all on function public.content_release_revoke(uuid, text) from public, anon;
grant execute on function public.content_release_revoke(uuid, text) to authenticated;

-- public의 CREATE 권한은 적용 전 확인한다. pg_temp를 명시적으로 마지막에 둬 임시 표의 정의자 권한 사칭을 막는다.
alter function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid) set search_path to 'public', 'pg_temp';
alter function public.content_release_approve(uuid,text,text) set search_path to 'public', 'pg_temp';
alter function public.content_release_revoke(uuid,text) set search_path to 'public', 'pg_temp';
alter function public.workspace_demand_record(text) set search_path to 'public', 'pg_temp';
alter function public.factory_order_open(uuid,text,smallint,uuid) set search_path to 'public', 'pg_temp';
alter function public.factory_order_transition(uuid,text,text,text,text,uuid,uuid) set search_path to 'public', 'pg_temp';
alter function public.supply_artifact_revision(text,text) set search_path to 'public', 'pg_temp';
alter function public.supply_learner_exposure(text,text,uuid) set search_path to 'public', 'pg_temp';
alter function public.supply_delivery_valid(uuid) set search_path to 'public', 'pg_temp';
alter function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) set search_path to 'public', 'pg_temp';

-- Supabase 기본 ACL은 ALL(TRUNCATE/REFERENCES/TRIGGER 포함)이다. RLS와 행 트리거는 TRUNCATE를 막지 않는다.
-- 학습자/익명은 SELECT 이외의 표 권한을 모두 제거한다. 서비스 역할은 신뢰된 운영 경계다.
revoke all on table public.content_qualification, public.content_release_approval, public.content_release_revocation,
  public.workspace_content_demand, public.workspace_content_demand_line, public.factory_order,
  public.factory_order_event, public.workspace_content_delivery from public, anon, authenticated;
grant select on table public.content_qualification, public.content_release_approval, public.content_release_revocation,
  public.workspace_content_demand, public.workspace_content_demand_line, public.factory_order,
  public.factory_order_event, public.workspace_content_delivery to authenticated;
