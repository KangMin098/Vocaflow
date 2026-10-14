// apps/web/src/lib/csat/map/v62/__tests__/supply-b-orders.pglite.test.ts
// v6.2 P-F7b — 승인안 B(수요 · 주문 · 이벤트 · 공급) 보류 SQL 을 격리 Postgres(PGlite)에서 확인한다. 개발 DB 무관.
// 소유권 · 멱등 · 원자 이벤트 · 중복 주문 · 부분 공급 뒤 재주문 · 공급 시점 재검증(자격 · 승인 · 철회 · 원천 · G).
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import type { WorkspaceDemand } from '../demand'
import { canonicalDemand, demandSignature } from '../persist-contract'
import { AXES, as, errorOf, openSupplyDb } from './supply-sql-harness'

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const ME = '00000000-0000-4000-8000-0000000000b1'
const OTHER = '00000000-0000-4000-8000-0000000000b2'
const H64 = 'a'.repeat(64)
const ITEM = '11111111-1111-4111-8111-111111111111'
const ITEM2 = '22222222-2222-4222-8222-222222222222'
const ARTICLE = '33333333-3333-4333-8333-333333333333'
const key = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`

let db: PGlite
let myWs: string
let otherWs: string
let myGoal: number

function demand(ws: string, plan: number, goal: number | null, task = 'r.central_meaning'): WorkspaceDemand {
  return {
    key: 'k', template: 'ws.reading', workspaceId: ws, goalVersion: goal, planVersion: plan, definitionVersion: 'v6.2',
    asOf: '2026-10-15T00:00:00Z', core: task as WorkspaceDemand['core'], support: [],
    purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: [
      { role: 'guided_practice', task, quantity: { n: 3 }, csatTypes: ['R-TOPIC'], taskKeys: [], requires: [], reason: 'need' },
      { role: 'independent_check', task, quantity: { n: 2 }, csatTypes: ['R-TOPIC'], taskKeys: [], requires: [], reason: 'need' },
    ],
  } as unknown as WorkspaceDemand
}

const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!

async function qualify(ref: string, role: string, axes = AXES(), rev = 'r1', task = 'r.central_meaning'): Promise<string> {
  await as(db, ADMIN)
  const r = await q1<{ id: string }>(
    `select public.content_qualification_record('FQ1.0','dcp_item',$1,$2,$3,$4,$5::jsonb,'src',$6,null,'gold',$6,'{}','{ev}','2인 검수',null) id`,
    [ref, rev, task, role, JSON.stringify(axes), H64])
  return r.id
}
async function approve(q: string, scope = 'public'): Promise<string> {
  await as(db, ADMIN)
  return (await q1<{ id: string }>(`select public.content_release_approve($1, $2) id`, [q, scope])).id
}
async function lineOf(demandId: string, role: string): Promise<string> {
  return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1 and role = $2`, [demandId, role])).id
}

beforeAll(async () => {
  db = await openSupplyDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${ME}'), ('${OTHER}');
    insert into public.admins values ('${ADMIN}', 'admin');
    insert into public.csat_dcp_items values ('${ITEM}', 'article', '${ARTICLE}'), ('${ITEM2}', 'article', '${ARTICLE}');`)
  myWs = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [ME])).id
  otherWs = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [OTHER])).id
  myGoal = Number((await q1<{ id: number }>(`insert into public.csat_map_goal_version (user_id) values ($1) returning id`, [ME])).id)
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version, goal_version_id) values ($1, $2, 1, $3), ($4, $5, 1, null)`,
    [myWs, ME, myGoal, otherWs, OTHER])
}, 60000)

describe('B-1 수요 — 소유권 · 멱등', () => {
  it('DB 서명 = 앱 demandSignature(같은 정규 본문 → 같은 SHA-256)', async () => {
    await as(db, ME)
    const d = demand(myWs, 1, myGoal)
    const id = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(ME, d)])).id
    const row = await q1<{ signature: string }>(`select signature from public.workspace_content_demand where id = $1`, [id])
    expect(row.signature).toBe(demandSignature(ME, d))
    const lines = await db.query(`select role, task_id, quantity from public.workspace_content_demand_line where demand_id = $1 order by line_no`, [id])
    expect(lines.rows).toEqual([{ role: 'guided_practice', task_id: 'r.central_meaning', quantity: 3 }, { role: 'independent_check', task_id: 'r.central_meaning', quantity: 2 }])
  })
  it('같은 본문 재전송 → 같은 id(줄도 다시 안 생김)', async () => {
    await as(db, ME)
    const c = canonicalDemand(ME, demand(myWs, 1, myGoal))
    const a = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [c])).id
    const b = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [c])).id
    expect(a).toBe(b)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_content_demand_line where demand_id = $1`, [a])).n).toBe(2)
  })
  it('본문의 user 가 호출자와 다르면 거절(클라이언트 userId 를 믿지 않는다)', async () => {
    await as(db, ME)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(OTHER, demand(myWs, 1, myGoal))]))).toMatch(/user mismatch/)
  })
  it('남의 Workspace · 남의 목표 · 다른 Workspace 의 PLAN 은 거절', async () => {
    await as(db, ME)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(ME, demand(otherWs, 1, null))]))).toMatch(/not owned|foreign key/)
    const otherGoal = Number((await q1<{ id: number }>(`insert into public.csat_map_goal_version (user_id) values ($1) returning id`, [OTHER])).id)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(ME, demand(myWs, 1, otherGoal))]))).toMatch(/foreign key/)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(ME, demand(myWs, 9, myGoal))]))).toMatch(/foreign key/)
  })
  it('서명 · 본문 불일치 행은 DB 가 거절(직접 삽입도)', async () => {
    expect(await errorOf(db.query(
      `insert into public.workspace_content_demand (user_id, workspace_id, plan_version, definition_version, core_task, canonical, signature)
       values ($1, $2, 1, 'v6.2', 'r.central_meaning', '{"v":1}', $3)`, [ME, myWs, H64]))).toMatch(/check/i)
  })
  it('로그아웃 · 닫힌 Workspace 는 거절', async () => {
    await as(db, null)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(ME, demand(myWs, 1, myGoal, 's.form_scope'))]))).toMatch(/Forbidden/)
    const closed = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id, status) values ($1, 'closed') returning id`, [ME])).id
    await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [closed, ME])
    await as(db, ME)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(ME, demand(closed, 1, null))]))).toMatch(/not active/)
  })
})

describe('B-2 · B-3 주문 — 열린 주문 하나 · 원자 이벤트 · 상태 기계', () => {
  let line: string
  let order: string
  beforeAll(async () => {
    await as(db, ME)
    const id = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(ME, demand(myWs, 1, myGoal, 'v.contextual_sense'))])).id
    line = await lineOf(id, 'guided_practice')
  })
  const open = (reason: string, k: number) => db.query<{ id: string }>(`select public.factory_order_open($1, $2, 3::smallint, $3) id`, [line, reason, key(k)])
  const move = (o: string, exp: string, to: string, k: number, ev: { reason?: string; run?: string; q?: string } = {}) =>
    db.query<{ seq: number }>(`select public.factory_order_transition($1, $2, $3, $4, $5, $6, $7) seq`, [o, exp, to, ev.reason ?? null, ev.run ?? null, ev.q ?? null, key(k)])

  it('첫 주문은 initial 만 · 같은 요청 키 재전송 → 같은 주문', async () => {
    await as(db, ME)
    expect(await errorOf(open('shortfall', 1))).toMatch(/first order must be initial/)
    order = (await open('initial', 2)).rows[0]!.id
    expect((await open('initial', 2)).rows[0]!.id).toBe(order)
  })
  it('열린 주문이 있으면 새 주문 거절(중복 주문 0)', async () => {
    await as(db, ME)
    expect(await errorOf(open('shortfall', 3))).toMatch(/open order exists/)
  })
  it('남의 줄에 주문할 수 없다', async () => {
    await as(db, OTHER)
    expect(await errorOf(open('initial', 4))).toMatch(/not owned/)
  })
  it('학습자는 상태를 바꿀 수 없다(전이는 관리자 · 생산 작업자)', async () => {
    await as(db, ME)
    expect(await errorOf(move(order, 'requested', 'stock_search', 10))).toMatch(/Forbidden/)
  })
  it('허용 전이 + 같은 요청 키 재전송은 이벤트 1건', async () => {
    await as(db, ADMIN)
    expect((await move(order, 'requested', 'stock_search', 11)).rows[0]!.seq).toBe(1)
    expect((await move(order, 'requested', 'stock_search', 11)).rows[0]!.seq).toBe(1)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order_event where order_id = $1`, [order])).n).toBe(1)
  })
  it('낡은 기대 상태(동시 전이에서 진 쪽) → 충돌, 이벤트 안 생김', async () => {
    await as(db, ADMIN)
    expect(await errorOf(move(order, 'requested', 'held', 12, { reason: 'x' }))).toMatch(/conflict/)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order_event where order_id = $1`, [order])).n).toBe(1)
  })
  it('근거 없는 전이 거절 — 실행 id 없는 producing · 이유 없는 held · 공급 행 없는 delivered · 허용 안 된 전이', async () => {
    await as(db, ADMIN)
    expect(await errorOf(move(order, 'stock_search', 'held', 13))).toMatch(/check/i)
    expect(await errorOf(move(order, 'stock_search', 'delivered', 14, { q: '00000000-0000-4000-8000-000000000000' }))).toMatch(/needs a delivery row/)
    expect(await errorOf(move(order, 'stock_search', 'reviewing', 15))).toMatch(/not allowed/)
    await move(order, 'stock_search', 'awaiting_production', 16)
    expect(await errorOf(move(order, 'awaiting_production', 'producing', 17))).toMatch(/check/i)
    expect((await move(order, 'awaiting_production', 'producing', 18, { run: 'drain-chunk-07' })).rows[0]!.seq).toBe(3)
  })
  it('직접 UPDATE 로 상태만 바꾸기 · 이벤트 수정 · 삭제는 거부(서비스 권한도) — 실패한 전이는 부분 이력을 남기지 않는다', async () => {
    expect(await errorOf(db.query(`update public.factory_order set state = 'reviewing' where id = $1`, [order]))).toMatch(/only via factory_order_transition/)
    expect(await errorOf(db.query(`update public.factory_order_event set reason = 'x' where order_id = $1`, [order]))).toMatch(/append-only/)
    expect(await errorOf(db.query(`delete from public.factory_order_event where order_id = $1`, [order]))).toMatch(/append-only/)
    expect(await errorOf(db.query(`delete from public.factory_order where id = $1`, [order]))).toMatch(/append-only/)
    const before = (await q1<{ n: number }>(`select count(*)::int n from public.factory_order_event`)).n
    await as(db, ADMIN)
    await errorOf(move(order, 'producing', 'held', 19, { reason: 'x' }))   // producing → held 는 허용 안 됨
    expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order_event`)).n).toBe(before)
  })
  it('실패 뒤 재생산은 새 주문(retry_after_failure · 부모) — initial 재주문은 거절', async () => {
    await as(db, ADMIN)
    await move(order, 'producing', 'failed', 20, { reason: 'Gold 불일치' })
    await as(db, ME)
    expect(await errorOf(open('initial', 21))).toMatch(/reorder needs a reason/)
    const retry = (await open('retry_after_failure', 22)).rows[0]!.id
    const row = await q1<{ order_seq: number; parent_order_id: string }>(`select order_seq, parent_order_id from public.factory_order where id = $1`, [retry])
    expect(row).toEqual({ order_seq: 2, parent_order_id: order })
  })
})

describe('B-4 공급 — 공급 시점 재검증', () => {
  let guidedLine: string
  let checkLine: string
  beforeAll(async () => {
    await as(db, ME)
    const id = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(ME, demand(myWs, 1, myGoal, 'r.inference_link'))])).id
    guidedLine = await lineOf(id, 'guided_practice')
    checkLine = await lineOf(id, 'independent_check')
  })
  const deliver = (line: string, q: string, a: string, k: number, order: string | null = null) =>
    db.query<{ id: string }>(`select public.workspace_delivery_record($1, $2, $3, $4, $5) id`, [line, order, q, a, key(k)])

  it('적격 · 승인된 R5 재고는 공급되고, 같은 요청 키는 같은 공급', async () => {
    const q = await qualify(ITEM, 'guided_practice', AXES(), 'r1', 'r.inference_link')
    const a = await approve(q)
    await as(db, ME)
    const d = (await deliver(guidedLine, q, a, 100)).rows[0]!.id
    expect((await deliver(guidedLine, q, a, 100)).rows[0]!.id).toBe(d)
  })
  it('같은 줄에 같은 산출물을 다른 요청 키로 또 공급하면 거절(중복 공급 0)', async () => {
    const q = (await q1<{ id: string }>(`select qualification_id id from public.workspace_content_delivery where line_id = $1`, [guidedLine])).id
    const a = (await q1<{ id: string }>(`select approval_id id from public.workspace_content_delivery where line_id = $1`, [guidedLine])).id
    await as(db, ME)
    expect(await errorOf(deliver(guidedLine, q, a, 101))).toMatch(/unique|duplicate/i)
  })
  it('TASK · 역할이 다른 자격 · 승인 없는 자격 · 남의 줄은 거절', async () => {
    const wrongTask = await qualify(ITEM2, 'guided_practice', AXES(), 'r1', 'r.central_meaning')
    const a1 = await approve(wrongTask)
    await as(db, ME)
    expect(await errorOf(deliver(guidedLine, wrongTask, a1, 102))).toMatch(/identity mismatch/)
    const noApproval = await qualify(ITEM2, 'guided_practice', AXES(), 'r2', 'r.inference_link')
    await as(db, ME)
    expect(await errorOf(deliver(guidedLine, noApproval, a1, 103))).toMatch(/approval missing/)
    await as(db, OTHER)
    expect(await errorOf(deliver(guidedLine, noApproval, a1, 104))).toMatch(/not owned/)
  })
  it('승인 뒤 revision 이 대체되면 공급 거절 · 승인 철회도 거절', async () => {
    const q = await qualify(ITEM2, 'guided_practice', AXES(), 'r5', 'r.inference_link')
    const a = await approve(q)
    await as(db, ADMIN)
    await db.query(`select public.content_qualification_record('FQ1.0','dcp_item',$1,'r6','r.inference_link','guided_practice',$2::jsonb,'src',$3,null,'gold',$3,'{}','{ev}','2인 검수',$4)`,
      [ITEM2, JSON.stringify(AXES()), H64, q])
    await as(db, ME)
    expect(await errorOf(deliver(guidedLine, q, a, 105))).toMatch(/superseded/)
    const q2 = await qualify(ITEM2, 'guided_practice', AXES(), 'r7', 'r.inference_link')
    const a2 = await approve(q2)
    await db.query(`insert into public.content_release_revocation (approval_id, revoked_by, reason) values ($1, $2, '원천 권리 재검토')`, [a2, ADMIN])
    await as(db, ME)
    expect(await errorOf(deliver(guidedLine, q2, a2, 106))).toMatch(/revoked/)
  })
  it('원천이 공급 시점에 부적격이 되면 거절(과거 자격만으로 공급하지 않는다)', async () => {
    const q = await qualify(ITEM2, 'guided_practice', AXES(), 'r8', 'r.inference_link')
    const a = await approve(q)
    await db.query(`insert into public.ineligible_sources values ($1)`, [ARTICLE])
    await as(db, ME)
    expect(await errorOf(deliver(guidedLine, q, a, 107))).toMatch(/source no longer eligible/)
    await db.query(`delete from public.ineligible_sources where article_id = $1`, [ARTICLE])
  })
  it('평가 역할 — assessment 승인 필요 · 이미 시도한 문항은 G 로 거절(독립 첫 시도 보존)', async () => {
    const q = await qualify(ITEM, 'independent_check', AXES(), 'r1', 'r.inference_link')
    const pub = await approve(q, 'public')
    await as(db, ME)
    expect(await errorOf(deliver(checkLine, q, pub, 108))).toMatch(/assessment approval required/)
    const asmt = await approve(q, 'assessment')
    await db.query(`insert into public.csat_item_attempts (user_id, dcp_item_id) values ($1, $2)`, [ME, ITEM])
    await as(db, ME)
    expect(await errorOf(deliver(checkLine, q, asmt, 109))).toMatch(/G — learner already attempted/)
  })
  it('R5 수직(격리): 수요 → 주문 → 재고 검색 → 승인 재고 공급 → 주문 delivered(같은 자격) · 다른 자격으로는 delivered 불가', async () => {
    await as(db, ME)
    const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(ME, demand(myWs, 1, myGoal, 'r.flow_order'))])).id
    const line = await lineOf(dem, 'guided_practice')
    const order = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 1::smallint, $2) id`, [line, key(200)])).id
    await as(db, ADMIN)
    await db.query(`select public.factory_order_transition($1, 'requested', 'stock_search', null, null, null, $2)`, [order, key(201)])
    const q = await qualify(ITEM, 'guided_practice', AXES(), 'r1', 'r.flow_order')
    const a = await approve(q)
    const other = await qualify(ITEM2, 'guided_practice', AXES(), 'r1', 'r.flow_order')
    await as(db, ME)
    await deliver(line, q, a, 202, order)
    await as(db, ADMIN)
    expect(await errorOf(db.query(`select public.factory_order_transition($1, 'stock_search', 'delivered', null, null, $2, $3)`, [order, other, key(203)]))).toMatch(/needs a delivery row/)
    expect((await q1<{ seq: number }>(`select public.factory_order_transition($1, 'stock_search', 'delivered', null, null, $2, $3) seq`, [order, q, key(204)])).seq).toBe(2)
    const ev = await db.query(`select from_state, to_state from public.factory_order_event where order_id = $1 order by seq`, [order])
    expect(ev.rows).toEqual([{ from_state: 'requested', to_state: 'stock_search' }, { from_state: 'stock_search', to_state: 'delivered' }])
    // 학습자 격리: 다른 학습자는 이 공급 · 주문을 자기 줄로 쓸 수 없다
    await as(db, OTHER)
    expect(await errorOf(deliver(line, q, a, 205, order))).toMatch(/not owned/)
  })
  it('목표 변경 = 다른 수요(새 서명) · 이전 수요의 공급을 상속하지 않는다', async () => {
    await as(db, ME)
    const g2 = Number((await q1<{ id: number }>(`insert into public.csat_map_goal_version (user_id) values ($1) returning id`, [ME])).id)
    const before = canonicalDemand(ME, demand(myWs, 1, myGoal, 'r.flow_order'))
    const after = canonicalDemand(ME, demand(myWs, 1, g2, 'r.flow_order'))
    const d1 = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [before])).id
    const d2 = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [after])).id
    expect(d2).not.toBe(d1)
    const l2 = await lineOf(d2, 'guided_practice')
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_content_delivery where line_id = $1`, [l2])).n).toBe(0)
  })
  it('공급 행은 추가 전용', async () => {
    expect(await errorOf(db.query(`delete from public.workspace_content_delivery where line_id = $1`, [guidedLine]))).toMatch(/append-only/)
  })
})
