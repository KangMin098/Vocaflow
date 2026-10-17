// scripts/csat/map/v62/gen-supply-i1-rollback.mjs
//
// Factory I1 — 되돌리기 SQL 생성기. I1 이 바꾼 함수의 **원본 정의를 B · C 파일에서 글자 그대로 잘라** 되돌리기 파일을 만든다(손으로 옮겨 적지 않는다).
// 원본 파일 sha256 을 머리에 적고, 생성물은 PGlite 회귀(supply-i1.pglite.test.ts 「되돌리기」)가 실제로 적용해 B 의 원래 동작을 확인한다.
// 실행: node scripts/csat/map/v62/gen-supply-i1-rollback.mjs   (재실행 안전 — 같은 입력이면 같은 출력)
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const MIG = path.join(ROOT, 'supabase/migrations')
const read = (f) => fs.readFileSync(path.join(MIG, f), 'utf8').replace(/\r\n/g, '\n')
const sha = (f) => createHash('sha256').update(fs.readFileSync(path.join(MIG, f))).digest('hex')
const C = '_pending_workspace_supply_c_qualification.sql'
const B = '_pending_workspace_supply_b_orders.sql'

/** 원본에서 `create or replace function public.<name>(` … 첫 `end $$;` 까지 */
function block(text, name, file) {
  const start = text.indexOf(`create or replace function public.${name}(`)
  if (start < 0) throw new Error(`${file}: ${name} 없음`)
  const end = text.indexOf('end $$;', start)
  if (end < 0) throw new Error(`${file}: ${name} 끝 없음`)
  return text.slice(start, end + 'end $$;'.length)
}
const bText = read(B)
const cText = read(C)

const out = `-- supabase/migrations/_pending_workspace_supply_i1_rollback.sql
-- ⚠️ 보류(적용 안 함) — Factory I1 되돌리기. **생성물**: scripts/csat/map/v62/gen-supply-i1-rollback.mjs 가 B · C 원본에서 함수 정의를 글자 그대로 잘라 만든다(손으로 고치지 않는다).
-- 원본: ${B} sha256 ${sha(B)}
--       ${C} sha256 ${sha(C)}
-- 순서: D3 → P → safety 의 역순. 데이터 보존 조건(승인 패키지 §7):
--   · D3 표에 행이 있으면 아래 §1 을 실행하지 않는다(보존 표로 복사한 뒤에만).
--   · factory_order 에 state = 'partial' 행이 있으면 §2 를 실행하지 않는다(닫힌 주문을 열린 것처럼 보이게 만든다).
--   · §3(safety 되돌리기)은 데이터와 무관 — 언제든 가능. 단 되돌리면 D1/D2 결함(노출 누락 · 승인 범위)이 다시 생긴다.

begin;
-- §0. 보존 조건을 **무엇이든 지우기 전에** 모두 검사한다(트랜잭션 — 하나라도 실패하면 아무것도 바뀌지 않는다)
do $$ begin
  if to_regclass('public.factory_order_product_link') is not null and exists (select 1 from public.factory_order_product_link) then
    raise exception 'rollback D3: factory_order_product_link has rows — copy to a preservation table first';
  end if;
  if to_regclass('public.factory_product_order') is not null and exists (select 1 from public.factory_product_order) then
    raise exception 'rollback D3: factory_product_order has rows — copy to a preservation table first';
  end if;
  if exists (select 1 from public.factory_order where state = 'partial') then
    raise exception 'rollback P: partial orders exist — do not reopen closed orders';
  end if;
end $$;

-- §1. D3 되돌리기
drop function if exists public.factory_order_link_product(uuid, text, integer, text, uuid);
drop function if exists public.factory_product_order_register(text, integer, text, text, text, text, text, integer, text, uuid);
drop function if exists public.factory_product_order_is_current(text, integer);
drop table if exists public.factory_order_product_link;
drop table if exists public.factory_product_order;

-- §2. P 되돌리기
drop function if exists public.workspace_line_fulfillment(uuid);
drop index public.factory_order_one_open_per_line;
create unique index factory_order_one_open_per_line on public.factory_order (line_id)
  where state not in ('delivered','failed');
alter table public.factory_order drop constraint factory_order_state_check;
alter table public.factory_order add constraint factory_order_state_check
  check (state in ('requested','stock_search','awaiting_production','producing','reviewing','delivered','held','failed'));
${block(bText, 'factory_order_open', B)}
${block(bText, 'factory_order_transition', B)}
revoke all on function public.factory_order_open(uuid, text, smallint, uuid) from public, anon;
revoke all on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.factory_order_open(uuid, text, smallint, uuid) to authenticated;
grant execute on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) to authenticated;

-- §3. safety 되돌리기(B · C 원본 정의)
${block(bText, 'supply_learner_exposure', B)}
${block(bText, 'workspace_delivery_record', B)}
${block(cText, 'content_release_revoke', C)}
drop function if exists public.supply_delivery_valid(uuid);
revoke all on function public.supply_learner_exposure(text, text, uuid) from public, anon, authenticated;
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) to authenticated;
revoke all on function public.content_release_revoke(uuid, text) from public, anon;
grant execute on function public.content_release_revoke(uuid, text) to authenticated;
commit;
`
fs.writeFileSync(path.join(MIG, '_pending_workspace_supply_i1_rollback.sql'), out)
console.log(`rollback 생성 · sha256 ${createHash('sha256').update(out).digest('hex')}`)
