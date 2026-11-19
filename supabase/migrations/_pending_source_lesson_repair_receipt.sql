-- supabase/migrations/_pending_source_lesson_repair_receipt.sql
-- ⚠️ 보류(적용 안 함) — 단계 2D · 2E. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 무엇: 원문 안내 연습(source-lesson v3 · 요지 → 제목 → 주제)의 **수행 사실 영수증**을 지도 loader 가 읽는 읽기 전용 투영.
--   · 새 표 · 새 행 · 새 시각을 만들지 않는다. factory_dcp_attempt(실제 채점 영수증)와 source_lesson_reflection(설명 저장)의
--     기존 received_at 을 그대로 돌려준다. completed_at = 세 단계 설명 저장 중 마지막 서버 수신 시각(= 교수 활동 완료 시각).
--   · 근거가 아니다: Gold · G2(learning_task_attempts / workspace_delivery_attempt)를 만들지 않는다.
--   · 계보: 검증된 사용자(p_user) · 등록 후보 원문 003946dd…/33dc4880… · 역할 guided_practice · TASK r.central_meaning · 판본 일치 ·
--     납품 유효(supply_delivery_valid — 권리 · 승인 철회 · 자격 대체) · 제품주문 링크/현재성 · Workspace 열림 ·
--     수요의 goal_version_id = 학습자의 **현재 목표**(다른 목표 회차의 사실은 넘어오지 않는다).
--   · 1D factory_dcp_delivery_state 와 다른 점은 하나 — 개인 계보 현재성(factory_dcp_learning_current: 최신 plan 버전)을 요구하지 않는다.
--     같은 목표의 다음 계획이 저장돼도 **이미 끝난** 바로잡기 사실이 사라져 repair 로 되돌아가지 않게 하기 위해서다.
--     구계획 자료를 새로 여는 것은 여전히 factory_dcp_delivery_state(lineage_not_current)가 막는다 — current 칸으로 구분해 돌려준다.
--   · p_as_of: 이 시각 뒤에 받은 시도 · 설명은 세지 않는다(과거 asOf 판정에 미래 완료가 유입되지 않게). 서버가 넣는다.
--   · 2E 호출자: (가) 학습자 본인 세션 — auth.uid() = p_user 만. (나) 진짜 service_role(JWT role 클레임 · 서버가 인증한 userId 를 넘김 ·
--     /csat 홈 loadMapPage). 다른 사용자의 p_user 를 넘긴 authenticated 호출 · anon · 역할 없는 호출 = 42501.
--     사용자를 가장하지 않는다(auth.uid 를 바꾸지 않는다).
--   · source_lesson_fact_state 는 내부 전용 — 같은 검증된 p_user 로만 부르고 public/anon/authenticated/service_role 실행 권한이 없다.
--
-- 전제: _pending_source_lesson_reflection.sql(2B) 뒤.
-- 되돌리기(행 없음 · 별도 승인): drop function source_lesson_repair_receipts(uuid, timestamptz); drop function source_lesson_fact_state(uuid, uuid);

do $$
begin
  if to_regclass('public.source_lesson_reflection') is null or to_regprocedure('public.factory_dcp_learning_current(uuid)') is null then
    raise exception 'source lesson repair receipt requires 2B source lesson reflection first';
  end if;
  if to_regprocedure('public.source_lesson_repair_receipts(uuid, timestamptz)') is not null then raise exception 'source lesson repair receipt already installed'; end if;
end $$;

-- ── 과거 수행 사실의 유효성 — 'ok' 또는 닫힌 거절 코드(1D 코드와 같은 이름 · lineage 대신 goal_changed) ─────────────
create function public.source_lesson_fact_state(p_delivery uuid, p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare d record; a record; v_ws text;
begin
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = p_user;
  if not found then return 'not_found'; end if;
  if d.artifact_kind <> 'dcp_item' then return 'not_factory_dcp'; end if;
  select * into a from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref;
  if not found then return 'not_factory_dcp'; end if;
  if a.source_id <> '003946dd-f5e6-4efe-9254-b7a69ca39e61'
     or a.source_content_sha256 <> '33dc4880f42b6b5815b93da059beb2dae640b138371e0cb1992ad46ba6452b0f' then return 'lesson_mismatch'; end if;
  if d.role <> 'guided_practice' or d.task_id <> 'r.central_meaning' or a.role <> d.role or a.task_id <> d.task_id then return 'wrong_role_task'; end if;
  select w.status into v_ws from learner_workspace w where w.id = d.workspace_id and w.user_id = d.user_id;
  if v_ws is distinct from 'active' then return 'workspace_closed'; end if;
  if d.artifact_revision is distinct from a.artifact_revision then return 'stale_revision'; end if;
  if public.supply_delivery_valid(d.id) is not true then return 'not_current'; end if;
  if d.order_id is null then return 'goal_changed'; end if;
  if not exists (select 1 from factory_order o join workspace_content_demand_line l on l.id = o.line_id
                   join workspace_content_demand dm on dm.id = l.demand_id
                  where o.id = d.order_id and o.user_id = d.user_id and o.workspace_id = d.workspace_id and o.state <> 'failed'
                    and dm.goal_version_id is not distinct from (select max(g.id) from csat_map_goal_version g where g.user_id = d.user_id)) then
    return 'goal_changed';
  end if;
  if not exists (select 1 from factory_order_product_link k where k.order_id = d.order_id and k.product_order_id = a.product_order_id
                 and k.order_revision = a.order_revision and k.order_hash = a.order_hash) then return 'product_link_mismatch'; end if;
  if public.factory_product_order_is_current(a.product_order_id, a.order_revision) is not true then return 'product_not_current'; end if;
  return 'ok';
end $$;
revoke all on function public.source_lesson_fact_state(uuid, uuid) from public, anon, authenticated, service_role;

-- ── 영수증 — 개인 주문(한 원문 · 한 Workspace)별 세 단계 수행 사실 ─────────────────────────
-- 반환 jsonb 배열: [{ workspace_id, order_id, task_id, current, complete, completed_at,
--   steps: [{ step, delivery_id, dcp_item_id, attempt_id, is_correct, attempt_received_at, reflected_at }] }]
--   step 하나 = 그 납품에 저장된 설명 1행 + 그 설명이 가리킨 실제 채점 영수증(정오는 채점기 값 그대로). 설명 없는 시도는 싣지 않는다.
--   complete = 요지 · 제목 · 주제 세 단계 모두 실렸을 때만. 미완료 주문도 돌려준다(시도 중 표시용 · 성공 근거 아님).
create function public.source_lesson_repair_receipts(p_user uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_auth uuid := auth.uid();
  v_uid uuid := p_user;
  v_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
begin
  if p_user is null then raise exception 'user required' using errcode = '22023'; end if;
  -- 본인 세션은 자기 것만 · auth.uid 없는 호출은 진짜 service_role 만(서버가 인증한 userId)
  if v_auth is not null then
    if v_auth <> p_user then raise exception 'Forbidden' using errcode = '42501'; end if;
  elsif v_role is distinct from 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_as_of is null then raise exception 'as_of required' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('workspace_id', o.workspace_id, 'order_id', o.order_id, 'task_id', 'r.central_meaning',
             'current', public.factory_dcp_learning_current(o.order_id),
             'complete', o.n = 3, 'completed_at', case when o.n = 3 then o.last_at end, 'steps', o.steps) order by o.last_at)
      from (
        select s.workspace_id, s.order_id, count(distinct s.step) as n, max(s.reflected_at) as last_at,
               jsonb_agg(jsonb_build_object('step', s.step, 'delivery_id', s.delivery_id, 'dcp_item_id', s.dcp_item_id, 'attempt_id', s.attempt_id,
                 'is_correct', s.is_correct, 'attempt_received_at', s.attempt_received_at, 'reflected_at', s.reflected_at)
                 order by array_position(array['main_point','title','topic'], s.step)) as steps
          from (
            select r.workspace_id, r.order_id, r.step, r.delivery_id, t.dcp_item_id, t.id as attempt_id, t.is_correct,
                   t.received_at as attempt_received_at, r.received_at as reflected_at
              from source_lesson_reflection r
              join factory_dcp_attempt t on t.id = r.attempt_id and t.user_id = r.user_id and t.delivery_id = r.delivery_id
              join csat_dcp_items i on i.id = t.dcp_item_id and i.type = r.step
             where r.user_id = v_uid and r.lesson_sha256 = '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0'
               and r.received_at <= p_as_of and t.received_at <= p_as_of and t.received_at <= r.received_at
               and public.source_lesson_fact_state(r.delivery_id, v_uid) = 'ok'
          ) s
         group by s.workspace_id, s.order_id
      ) o), '[]'::jsonb);
end $$;
revoke all on function public.source_lesson_repair_receipts(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.source_lesson_repair_receipts(uuid, timestamptz) to authenticated, service_role;
