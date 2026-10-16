-- supabase/migrations/_pending_workspace_supply_b_delta_i0.sql
-- ⚠️ 보류(적용 안 함) — I0 Factory Bridge 감사가 찾은 C/B 결함의 **최소 delta**. C → B → 이 파일 순서. 승인 · 격리 PGlite 시험 전에는 적용하지 않는다.
--
-- 고치는 것(재현 근거는 docs/csat-learner/v62/FACTORY_BRIDGE_I1_PENDING.md §2):
--   D1 노출(G) 누락 — B 의 supply_learner_exposure('csat_item') 가 csat_dx_* 만 본다. 학습지도 확인 과제(G2: learning_task_attempts)와
--      해설 열람 · 공개(learning_sessions.explanation_* · revealed_at)를 보지 않는다.
--      개발 DB 2026-10-17 읽기 전용 실측: G2 시도 129행(사용자×문항 123쌍) 전부, 시도 없는 해설 열람 세션 227건이 'none' 으로 보인다.
--   D2 승인 범위 불일치 — 앱(qualification.ts toSupplyQualification)은 모든 역할에 public 승인, 평가 역할에 assessment 승인까지 요구한다.
--      B 의 workspace_delivery_record 는 승인 한 행만 받아 평가 역할은 assessment 하나로, 교수 역할은 어떤 범위든 통과한다.
--   D3 공용 Product Order 계보 — factory_order 는 학습자별 줄에 묶이고 공장 주문과의 결속 칸이 production_run_id(text)뿐이다.
--      공장 계약(textbook-product-order/1)의 product_order_id · order_revision · order_hash 를 N:M 으로 잇는 표를 추가한다(학습자 정보 없음).
--
-- 되돌리기: drop table public.factory_order_product_link; 두 함수는 B 원본 정의로 다시 create or replace(원본 sha256 은 승인 문서에 기록).

-- ── D1. 노출 — G2 원장 · 세션 포함, 정규 지문 identity 는 기존 B 규칙 유지 ─────────────────
create or replace function public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare c record;
begin
  if p_kind = 'csat_item' then
    select * into c from csat_items where id = p_ref;
    if not found then return 'unknown'; end if;
    if exists (select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id
               where s.user_id = p_uid and r.item_id = p_ref) then return 'attempted'; end if;
    -- (D1) 학습지도 확인 과제 · 적용 수행
    if exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = p_ref) then return 'attempted'; end if;
    -- (D1) 해설 열람 · 정답 공개(시도 없이 해설만 본 경우 포함)
    if exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = p_ref and s.deleted_at is null
               and (s.explanation_viewed_at is not null or s.explanation_server_at is not null or s.revealed_at is not null)) then
      return 'explanation_seen';
    end if;
    if exists (select 1 from csat_dx_session s where s.user_id = p_uid and s.exam_id = c.exam_id) then return 'exam_seen'; end if;
    if c.passage is not null and exists (
      select 1 from csat_items j
      where j.id <> c.id and j.passage is not null
        and md5(regexp_replace(lower(j.passage), '\s+', ' ', 'g')) = md5(regexp_replace(lower(c.passage), '\s+', ' ', 'g'))
        and (exists (select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id where s.user_id = p_uid and r.item_id = j.id)
          or exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = j.id)
          or exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = j.id and s.deleted_at is null
                     and (s.explanation_viewed_at is not null or s.explanation_server_at is not null or s.revealed_at is not null)))) then
      return 'shared_passage_seen';
    end if;
    return 'none';
  elsif p_kind = 'dcp_item' then
    if exists (select 1 from csat_item_attempts t where t.user_id = p_uid and t.dcp_item_id = p_ref::uuid) then return 'attempted'; end if;
    return 'unknown';
  end if;
  return 'unknown';
end $$;
revoke all on function public.supply_learner_exposure(text, text, uuid) from public, anon, authenticated;

-- ── D2. 승인 — 앱 계약과 같게: 모든 역할 public · 평가 역할은 assessment 도(둘 다 철회 없음) ─────────
-- B 의 workspace_delivery_record 본문에서 「승인」 블록만 아래로 바꾼다(그 밖의 검사 · 순서는 B 그대로).
-- 원래:
--   select * into a from content_release_approval where id = p_approval and qualification_id = q.id;
--   if not found then raise exception 'delivery: approval missing'; end if;
--   if exists (select 1 from content_release_revocation r where r.approval_id = a.id) then raise exception 'delivery: approval revoked'; end if;
--   if q.role in ('independent_check','transfer','delayed_check') and a.scope <> 'assessment' then raise exception 'delivery: assessment approval required'; end if;
-- 바꿈(p_approval 은 기록용으로 이 자격의 유효 승인 중 하나여야 한다):
--   select * into a from content_release_approval where id = p_approval and qualification_id = q.id;
--   if not found or exists (select 1 from content_release_revocation r where r.approval_id = a.id) then raise exception 'delivery: approval missing or revoked'; end if;
--   if not exists (select 1 from content_release_approval x where x.qualification_id = q.id and x.scope = 'public'
--                  and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)) then
--     raise exception 'delivery: public approval required';
--   end if;
--   if q.role in ('independent_check','transfer','delayed_check') and not exists (
--        select 1 from content_release_approval x where x.qualification_id = q.id and x.scope = 'assessment'
--        and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)) then
--     raise exception 'delivery: assessment approval required';
--   end if;
-- (전체 함수 본문은 승인 단계에서 B 원본 sha256 을 확인한 뒤 이 블록만 바꿔 완성한다 — 원본을 추정해 통째로 다시 쓰지 않는다)

-- ── D3. 공용 Product Order 계보 — 학습자별 주문 ↔ 공장 주문 revision N:M ─────────────────
create table public.factory_order_product_link (
  order_id uuid not null references public.factory_order(id) on delete cascade,
  product_order_id text not null check (length(product_order_id) between 1 and 200),
  order_revision integer not null check (order_revision > 0),
  order_hash text not null check (order_hash ~ '^[0-9a-f]{64}$'),
  -- 학습자 정보 없이 같은 공용 요구를 묶는 키(production-need.ts shareKey)
  share_key text not null check (share_key ~ '^[0-9a-f]{32}$'),
  linked_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (order_id, product_order_id, order_revision)
);
create trigger factory_order_product_link_append_only before update or delete on public.factory_order_product_link
  for each row execute function public.forbid_ledger_mutation();
alter table public.factory_order_product_link enable row level security;
create policy fopl_admin_read on public.factory_order_product_link for select using (public.is_admin_or_curator());
-- 학습자는 이 표를 읽지 않는다(다른 학습자와 같은 공장 주문을 공유한다는 사실도 노출하지 않는다). 쓰기는 정의자 함수(승인 단계에서 작성)만.
