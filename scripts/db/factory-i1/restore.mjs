// scripts/db/factory-i1/restore.mjs
//
// Factory I1 배포 — 커밋 **뒤** 되돌리기 SQL 생성(트랜잭션 롤백이 아니라 적용된 단계를 되돌리는 경우).
//   · db2-restore.sql : DB-2 → 「DB-1 직후」 상태. factory_order_transition 은 **S 정의**, factory_order_open 은 B 정의(S 는 설정만 바꿨다)로
//                       되돌리고 S 의 search_path 강화(pg_temp 마지막)를 다시 건다. 기존 _pending_workspace_supply_i1_rollback.sql 은
//                       D3 → P → S 를 한 트랜잭션으로 모두 되돌리는 파일이고, 그 §0–§2 만 떼어 쓰면 본문은 S 그대로지만
//                       factory_order_open · factory_order_transition 의 search_path 에서 pg_temp 가 빠진다(격리 시험 F1 실측).
//                       그래서 DB-2 단독 되돌리기는 이 파일만 쓴다(격리 시험 E2: 결과 카탈로그 = DB-1 직후, 바이트 일치).
//   · db1-restore.sql : DB-1 → 적용 전. 8표가 모두 비어 있을 때만. 권한 helper 두 개의 search_path 강화는 **남긴다**(승인 패키지 §3 · 롤백 유지).
// 함수 본문은 원본 SQL 에서 글자 그대로 잘라 온다(손으로 다시 쓰지 않는다). 격리 시험이 「되돌린 카탈로그 = 기대 카탈로그」를 대조한다.
import { readSource } from './source.mjs'
import { STAGES, DB1_TARGET_TABLES, ALLOW } from './spec.mjs'

/** 원본에서 `create or replace function public.<name>(` 문 하나를 `$$;` 로 끝나는 줄까지 자른다 */
export function cutFunction(text, name) {
  const lines = text.split('\n')
  const i = lines.findIndex((l) => l.startsWith(`create or replace function public.${name}(`))
  if (i < 0) throw new Error(`원본에 ${name} 정의가 없다`)
  const j = lines.findIndex((l, k) => k > i && /\$\$;\s*$/.test(l))
  if (lines.slice(i + 1, j).some((l) => l.startsWith('create or replace function '))) throw new Error(`${name} 정의 경계가 모호하다`)
  return lines.slice(i, j + 1).join('\n') + '\n'
}

const DROP_ORDER = ['workspace_content_delivery', 'factory_order_event', 'factory_order', 'workspace_content_demand_line',
  'workspace_content_demand', 'content_release_revocation', 'content_release_approval', 'content_qualification']

export function buildRestore() {
  const B = readSource('B'), S = readSource('S')
  if (DROP_ORDER.length !== DB1_TARGET_TABLES.length || !DB1_TARGET_TABLES.every((t) => DROP_ORDER.includes(t))) throw new Error('DROP_ORDER ≠ 대상 표')

  const db2 = `-- supabase/deploy/factory-i1/db2-restore.sql
-- 생성물(scripts/db/factory-i1/restore.mjs). DB-2(${STAGES.db2.version}) 를 커밋 뒤 되돌린다 → DB-1 직후 상태.
-- 보존 조건: factory_order.state = 'partial' 행이 있으면 거절(닫힌 주문을 열린 것으로 보이게 만든다). D3 표가 있으면 거절(D3 를 먼저).
-- 함수 정의 출처: factory_order_open = B 원본 · factory_order_transition = S 원본(글자 그대로).
begin;
set local lock_timeout = '15s';
lock table public.factory_order in access exclusive mode;
do $vf$ begin
  if to_regclass('public.factory_product_order') is not null or to_regclass('public.factory_order_product_link') is not null then
    raise exception 'RESTORE_BLOCKED D3 표가 있다 — D3 를 먼저 되돌린다';
  end if;
  if exists (select 1 from public.factory_order where state = 'partial') then
    raise exception 'RESTORE_BLOCKED partial 주문이 있다 — 되돌리지 않는다(보존)';
  end if;
end $vf$;
drop function public.workspace_line_fulfillment(uuid);
drop index public.factory_order_one_open_per_line;
create unique index factory_order_one_open_per_line on public.factory_order (line_id)
  where state not in ('delivered','failed');
alter table public.factory_order drop constraint factory_order_state_check;
alter table public.factory_order add constraint factory_order_state_check
  check (state in ('requested','stock_search','awaiting_production','producing','reviewing','delivered','held','failed'));
${cutFunction(B, 'factory_order_open')}${cutFunction(S, 'factory_order_transition')}alter function public.factory_order_open(uuid,text,smallint,uuid) set search_path to 'public', 'pg_temp';
alter function public.factory_order_transition(uuid,text,text,text,text,uuid,uuid) set search_path to 'public', 'pg_temp';
delete from supabase_migrations.schema_migrations where version = '${STAGES.db2.version}';
commit;
`

  const fns = ALLOW.db1.added.filter((x) => x.startsWith('fn:')).map((x) => x.slice(3))
  const db1 = `-- supabase/deploy/factory-i1/db1-restore.sql
-- 생성물(scripts/db/factory-i1/restore.mjs). DB-1(${STAGES.db1.version}) 를 커밋 뒤 되돌린다 → 적용 전 상태(권한 helper 강화는 유지).
-- 보존 조건(무엇이든 지우기 전에 잠그고 모두 검사): DB-2 · D3 가 있으면 거절(먼저 되돌린다). 8표 중 하나라도 행이 있으면 거절 —
--   원장은 추가 전용이다. 행이 있으면 create table … _preserve_<날짜> as select 로 복사한 뒤 별도 승인으로만.
begin;
set local lock_timeout = '15s';
lock table ${DROP_ORDER.map((t) => `public.${t}`).join(', ')} in access exclusive mode;
do $vf$ declare t text; v_has boolean; begin
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'workspace_line_fulfillment')
     or exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%') then
    raise exception 'RESTORE_BLOCKED DB-2 가 적용돼 있다 — db2-restore.sql 을 먼저';
  end if;
  if to_regclass('public.factory_product_order') is not null or to_regclass('public.factory_order_product_link') is not null then
    raise exception 'RESTORE_BLOCKED D3 표가 있다 — D3 를 먼저 되돌린다';
  end if;
  foreach t in array array[${DROP_ORDER.map((t) => `'${t}'`).join(', ')}] loop
    execute format('select exists (select 1 from public.%I)', t) into v_has;
    if v_has then raise exception 'RESTORE_BLOCKED %.% 에 행이 있다 — 원장 보존(복사 뒤 별도 승인)', 'public', t; end if;
  end loop;
end $vf$;
${DROP_ORDER.map((t) => `drop table public.${t};`).join('\n')}
${fns.map((f) => `drop function public.${f.replace(/^public\./, '')};`).join('\n')}
alter table public.learner_workspace drop constraint learner_workspace_id_user_key;
alter table public.csat_map_goal_version drop constraint csat_map_goal_version_id_user_key;
alter table public.learner_workspace_plan drop constraint learner_workspace_plan_ws_ver_user_key;
delete from supabase_migrations.schema_migrations where version = '${STAGES.db1.version}';
commit;
`
  return { db1, db2 }
}
