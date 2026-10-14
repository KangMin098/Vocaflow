// apps/web/src/lib/csat/map/v62/__tests__/supply-b-orders.pglite.test.ts
// v6.2 P-F7b · P-F8b — 승인안 B(수요 · 주문 · 이벤트 · 공급) 보류 SQL 을 격리 Postgres(PGlite)에서 확인한다. 개발 DB 무관.
// 소유권 · 멱등(같은 요청 키 다른 본문 거절) · 원자 이벤트 · 직접 쓰기 차단 · 중복 주문 · 재주문 ·
// 공급 시점 재검증(실제 산출물 · revision · 자격 · 승인 · 철회 · 원천 · G 노출).
// ⚠️ PGlite 는 연결이 하나다 — 동시 트랜잭션은 `scripts/csat/map/v62/supply-concurrency.mjs`(실제 Postgres 다중 연결)가 따로 본다.
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import type { WorkspaceDemand } from '../demand'
import { canonicalDemand, demandSignature } from '../persist-contract'
import { AXES, as, errorOf, openSupplyDb, revOf } from './supply-sql-harness'

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const ME = '00000000-0000-4000-8000-0000000000b1'
const OTHER = '00000000-0000-4000-8000-0000000000b2'
const H64 = 'a'.repeat(64)
const ITEM = '11111111-1111-4111-8111-111111111111'
const ITEM2 = '22222222-2222-4222-8222-222222222222'
const ORPHAN = '44444444-4444-4444-8444-444444444444' // 원천(ref_id) 이 null 인 DCP 문항
const GHOST = '55555555-5555-4555-8555-555555555555' // 존재하지 않는 DCP 문항
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

/** 자격 기록 — revision 을 주지 않으면 산출물의 **현재 실제 revision** 으로 묶는다 */
async function qualify(ref: string, role: string, opts: { axes?: object; rev?: string; task?: string; kind?: string } = {}): Promise<string> {
  const kind = opts.kind ?? 'dcp_item'
  const rev = opts.rev ?? (await revOf(db, kind, ref)) ?? 'no-artifact'
  await as(db, ADMIN)
  const r = await q1<{ id: string }>(
    `select public.content_qualification_record('FQ1.0',$1,$2,$3,$4,$5,$6::jsonb,'src',$7,null,'gold',$7,'{}','{ev}','2인 검수',null) id`,
    [kind, ref, rev, opts.task ?? 'r.central_meaning', role, JSON.stringify(opts.axes ?? AXES()), H64])
  return r.id
}
async function approve(q: string, scope = 'public'): Promise<string> {
  await as(db, ADMIN)
  return (await q1<{ id: string }>(`select public.content_release_approve($1, $2) id`, [q, scope])).id
}
async function lineOf(demandId: string, role: string): Promise<string> {
  return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1 and role = $2`, [demandId, role])).id
}
async function newDemand(task: string, uid = ME, ws = myWs, goal: number | null = myGoal): Promise<string> {
  await as(db, uid)
  return (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(uid, demand(ws, 1, goal, task))])).id
}
const deliver = (line: string, q: string, a: string, k: number, order: string | null = null) =>
  db.query<{ id: string }>(`select public.workspace_delivery_record($1, $2, $3, $4, $5) id`, [line, order, q, a, key(k)])

beforeAll(async () => {
  db = await openSupplyDb()
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${ME}'), ('${OTHER}');
    insert into public.admins values ('${ADMIN}', 'admin');
    insert into public.csat_dcp_items (id, kind, ref_id, payload, answer_key) values
      ('${ITEM}', 'article', '${ARTICLE}', '{"s":1}', '{"position":2}'),
      ('${ITEM2}', 'article', '${ARTICLE}', '{"s":2}', '{"position":3}'),
      ('${ORPHAN}', 'article', null, '{"s":3}', '{"position":1}');
    insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values
      ('2024-31', '2024', 31, 'stem31', 'The same   passage A.', '[1,2,3,4,5]', 2),
      ('2024-32', '2024', 32, 'stem32', 'Passage B.', '[1,2,3,4,5]', 3),
      ('2023-32', '2023', 32, 'stem', 'the same passage a.', '[1,2,3,4,5]', 1),
      ('2022-33', '2022', 33, 'stem', 'Passage C.', '[1,2,3,4,5]', 4);`)
  myWs = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [ME])).id
  otherWs = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [OTHER])).id
  myGoal = Number((await q1<{ id: number }>(`insert into public.csat_map_goal_version (user_id) values ($1) returning id`, [ME])).id)
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version, goal_version_id) values ($1, $2, 1, $3), ($4, $5, 1, null)`,
    [myWs, ME, myGoal, otherWs, OTHER])
}, 60000)

describe('B-1 수요 — 소유권 · 멱등', () => {
  it('DB 서명 = 앱 demandSignature(같은 정규 본문 → 같은 SHA-256) · 줄 생성', async () => {
    const d = demand(myWs, 1, myGoal)
    const id = await newDemand('r.central_meaning')
    expect((await q1<{ signature: string }>(`select signature from public.workspace_content_demand where id = $1`, [id])).signature).toBe(demandSignature(ME, d))
    const lines = await db.query(`select role, task_id, quantity from public.workspace_content_demand_line where demand_id = $1 order by line_no`, [id])
    expect(lines.rows).toEqual([{ role: 'guided_practice', task_id: 'r.central_meaning', quantity: 3 }, { role: 'independent_check', task_id: 'r.central_meaning', quantity: 2 }])
  })
  it('같은 본문 재전송 → 같은 id(줄도 다시 안 생김)', async () => {
    const a = await newDemand('r.central_meaning')
    const b = await newDemand('r.central_meaning')
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
  it('로그아웃 · 닫힌 Workspace 는 거절', async () => {
    await as(db, null)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(ME, demand(myWs, 1, myGoal, 's.form_scope'))]))).toMatch(/Forbidden/)
    const closed = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id, status) values ($1, 'closed') returning id`, [ME])).id
    await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [closed, ME])
    await as(db, ME)
    expect(await errorOf(db.query(`select public.workspace_demand_record($1)`, [canonicalDemand(ME, demand(closed, 1, null))]))).toMatch(/not active/)
  })
})

describe('B-5 직접 쓰기 차단 — 함수 밖 INSERT · UPDATE · DELETE(서비스 권한 포함)', () => {
  it('수요 · 주문 · 승인 직접 INSERT 거부', async () => {
    const d = await newDemand('r.central_meaning')
    const line = await lineOf(d, 'guided_practice')
    const cases: [string, unknown[]][] = [
      [`insert into public.workspace_content_demand (user_id, workspace_id, plan_version, definition_version, core_task, canonical, signature)
        values ($1, $2, 1, 'v6.2', 'r.central_meaning', '{"v":1}', encode(sha256(convert_to('{"v":1}','UTF8')),'hex'))`, [ME, myWs]],
      [`insert into public.factory_order (line_id, user_id, workspace_id, role, task_id, order_seq, reason, quantity, request_key, state)
        values ($1, $2, $3, 'guided_practice', 'r.central_meaning', 9, 'initial', 1, $4, 'delivered')`, [line, ME, myWs, key(900)]],
      [`insert into public.content_release_approval (qualification_id, scope, approver, approver_role)
        values (gen_random_uuid(), 'public', $1, 'admin')`, [ADMIN]],
    ]
    for (const [sql, p] of cases) expect(await errorOf(db.query(sql, p)), sql.slice(0, 60)).toMatch(/insert only via/)
  })
  it('수요 · 줄 수정 · 삭제 거부', async () => {
    const d = await newDemand('r.central_meaning')
    expect(await errorOf(db.query(`update public.workspace_content_demand set core_task = 'r.flow_order' where id = $1`, [d]))).toMatch(/append-only/)
    expect(await errorOf(db.query(`delete from public.workspace_content_demand_line where demand_id = $1`, [d]))).toMatch(/append-only/)
  })
})

describe('B-2 · B-3 주문 — 열린 주문 하나 · 원자 이벤트 · 같은 키 다른 본문', () => {
  let line: string
  let order: string
  beforeAll(async () => {
    line = await lineOf(await newDemand('v.contextual_sense'), 'guided_practice')
  })
  const open = (reason: string, k: number, qty = 3, ln?: string) =>
    db.query<{ id: string }>(`select public.factory_order_open($1, $2, $3::smallint, $4) id`, [ln ?? line, reason, qty, key(k)])
  const move = (o: string, exp: string, to: string, k: number, ev: { reason?: string; run?: string; q?: string } = {}) =>
    db.query<{ seq: number }>(`select public.factory_order_transition($1, $2, $3, $4, $5, $6, $7) seq`, [o, exp, to, ev.reason ?? null, ev.run ?? null, ev.q ?? null, key(k)])

  it('첫 주문은 initial 만 · 같은 요청 키 · 같은 본문 → 같은 주문', async () => {
    await as(db, ME)
    expect(await errorOf(open('shortfall', 1))).toMatch(/first order must be initial/)
    order = (await open('initial', 2)).rows[0]!.id
    expect((await open('initial', 2)).rows[0]!.id).toBe(order)
  })
  it('같은 요청 키로 다른 수량 · 이유 · 줄 → 이전 결과를 성공으로 돌려주지 않는다', async () => {
    await as(db, ME)
    expect(await errorOf(open('initial', 2, 5))).toMatch(/different body/)
    expect(await errorOf(open('shortfall', 2))).toMatch(/different body/)
    const other = await lineOf(await newDemand('v.contextual_sense'), 'independent_check')
    await as(db, ME)
    expect(await errorOf(open('initial', 2, 3, other))).toMatch(/different body/)
  })
  it('다른 사용자의 같은 요청 키는 별개(키 공간은 사용자별)', async () => {
    const theirs = await lineOf(await newDemand('v.contextual_sense', OTHER, otherWs, null), 'guided_practice')
    await as(db, OTHER)
    const o = (await open('initial', 2, 3, theirs)).rows[0]!.id
    expect(o).not.toBe(order)
  })
  it('열린 주문이 있으면 새 주문 거절(중복 주문 0) · 남의 줄 거절', async () => {
    await as(db, ME)
    expect(await errorOf(open('shortfall', 3))).toMatch(/open order exists/)
    await as(db, OTHER)
    expect(await errorOf(open('initial', 4))).toMatch(/not owned/)
  })
  it('학습자는 상태를 바꿀 수 없다(전이는 관리자 · 생산 작업자)', async () => {
    await as(db, ME)
    expect(await errorOf(move(order, 'requested', 'stock_search', 10))).toMatch(/Forbidden/)
  })
  it('허용 전이 + 같은 요청 키 · 같은 본문 재전송은 이벤트 1건 · 다른 본문은 거절', async () => {
    await as(db, ADMIN)
    expect((await move(order, 'requested', 'stock_search', 11)).rows[0]!.seq).toBe(1)
    expect((await move(order, 'requested', 'stock_search', 11)).rows[0]!.seq).toBe(1)
    expect(await errorOf(move(order, 'requested', 'held', 11, { reason: 'x' }))).toMatch(/different body/)
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
  it('직접 UPDATE · 이벤트 수정 · 삭제 · 끊긴 seq 이벤트 삽입 거부 — 실패한 전이는 부분 이력을 남기지 않는다', async () => {
    expect(await errorOf(db.query(`update public.factory_order set state = 'reviewing' where id = $1`, [order]))).toMatch(/only via factory_order_transition/)
    expect(await errorOf(db.query(`update public.factory_order_event set reason = 'x' where order_id = $1`, [order]))).toMatch(/append-only/)
    expect(await errorOf(db.query(`delete from public.factory_order_event where order_id = $1`, [order]))).toMatch(/append-only/)
    expect(await errorOf(db.query(`delete from public.factory_order where id = $1`, [order]))).toMatch(/append-only/)
    // 설정을 켜더라도 이어지지 않는 seq · from_state 는 거부(이벤트 누락 · 중복)
    await db.exec(`begin; select set_config('vocaflow.supply_writer','rpc',true);`)
    const gap = await errorOf(db.query(`insert into public.factory_order_event (order_id, seq, from_state, to_state, request_key) values ($1, 9, 'producing', 'reviewing', $2)`, [order, key(901)]))
    await db.exec('rollback')
    expect(gap).toMatch(/must continue the order/)
    const before = (await q1<{ n: number }>(`select count(*)::int n from public.factory_order_event`)).n
    await as(db, ADMIN)
    await errorOf(move(order, 'producing', 'held', 19, { reason: 'x' }))
    expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order_event`)).n).toBe(before)
  })
  it('실패 뒤 재생산은 새 주문(retry_after_failure · 부모) — initial 재주문은 거절', async () => {
    await as(db, ADMIN)
    await move(order, 'producing', 'failed', 20, { reason: 'Gold 불일치' })
    await as(db, ME)
    expect(await errorOf(open('initial', 21))).toMatch(/reorder needs a reason/)
    const retry = (await open('retry_after_failure', 22)).rows[0]!.id
    expect(await q1(`select order_seq, parent_order_id from public.factory_order where id = $1`, [retry])).toEqual({ order_seq: 2, parent_order_id: order })
  })
})

describe('B-1 · B-4 공급 — 실제 산출물 · revision · 공급 시점 재검증', () => {
  let guided: string
  let check: string
  beforeAll(async () => {
    const d = await newDemand('r.inference_link')
    guided = await lineOf(d, 'guided_practice')
    check = await lineOf(d, 'independent_check')
  })

  it('적격 · 승인된 재고는 공급 · 같은 요청 키 같은 본문은 같은 공급 · 다른 본문은 거절 · 같은 산출물 중복 거절', async () => {
    const q = await qualify(ITEM, 'guided_practice', { task: 'r.inference_link' })
    const a = await approve(q)
    await as(db, ME)
    const d = (await deliver(guided, q, a, 100)).rows[0]!.id
    expect((await deliver(guided, q, a, 100)).rows[0]!.id).toBe(d)
    const q2 = await qualify(ITEM2, 'guided_practice', { task: 'r.inference_link' })
    const a2 = await approve(q2)
    await as(db, ME)
    expect(await errorOf(deliver(guided, q2, a2, 100))).toMatch(/different body/)
    expect(await errorOf(deliver(guided, q, a, 101))).toMatch(/unique|duplicate/i)
  })
  it('존재하지 않는 산출물 · 원천이 null 인 DCP · 지원 안 하는 종류는 공급 거절', async () => {
    let k = 110
    for (const [ref, kind] of [[GHOST, 'dcp_item'], [ORPHAN, 'dcp_item'], ['act-1', 'textbook_activity']] as const) {
      const q = await qualify(ref, 'guided_practice', { task: 'r.inference_link', kind, rev: 'claimed-rev' })
      const a = await approve(q)
      await as(db, ME)
      expect(await errorOf(deliver(guided, q, a, k++)), `${kind}:${ref}`).toMatch(/artifact not found or kind unsupported/)
    }
  })
  it('검수 뒤 내용이 바뀌면(revision 불일치) 공급 거절 — 이전 검수를 상속하지 않는다', async () => {
    const q = await qualify(ITEM2, 'guided_practice', { task: 'r.inference_link' })
    const a = await approve(q)
    await db.query(`update public.csat_dcp_items set answer_key = '{"position":4}' where id = $1`, [ITEM2])
    await as(db, ME)
    expect(await errorOf(deliver(guided, q, a, 120))).toMatch(/artifact changed since qualification/)
    await db.query(`update public.csat_dcp_items set answer_key = '{"position":3}' where id = $1`, [ITEM2])
  })
  it('TASK 불일치 · 승인 없음 · 남의 줄 · 대체된 자격 · 철회된 승인 · 부적격 원천은 거절', async () => {
    const wrongTask = await qualify(ITEM2, 'guided_practice', { task: 'r.central_meaning' })
    const a1 = await approve(wrongTask)
    await as(db, ME)
    expect(await errorOf(deliver(guided, wrongTask, a1, 130))).toMatch(/identity mismatch/)
    const q = await qualify(ITEM2, 'guided_practice', { task: 'r.inference_link' })
    await as(db, ME)
    expect(await errorOf(deliver(guided, q, a1, 131))).toMatch(/approval missing/)
    await as(db, OTHER)
    expect(await errorOf(deliver(guided, q, a1, 132))).toMatch(/not owned/)
    const a = await approve(q)
    const rev = await revOf(db, 'dcp_item', ITEM2)
    await as(db, ADMIN)
    await db.query(`select public.content_qualification_record('FQ1.0','dcp_item',$1,$2,'r.inference_link','guided_practice',$3::jsonb,'src',$4,null,'gold',$4,'{}','{ev}','2인 검수',$5)`,
      [ITEM2, rev, JSON.stringify(AXES()), H64, q])
    await as(db, ME)
    expect(await errorOf(deliver(guided, q, a, 133))).toMatch(/superseded/)
    const q3 = await qualify(ITEM2, 'guided_practice', { task: 'r.inference_link' })
    const a3 = await approve(q3)
    await as(db, ADMIN)
    await db.query(`select public.content_release_revoke($1, '원천 권리 재검토')`, [a3])
    await as(db, ME)
    expect(await errorOf(deliver(guided, q3, a3, 134))).toMatch(/revoked/)
    const q4 = await qualify(ITEM2, 'guided_practice', { task: 'r.inference_link' })
    const a4 = await approve(q4)
    await db.query(`insert into public.ineligible_sources values ($1)`, [ARTICLE])
    await as(db, ME)
    expect(await errorOf(deliver(guided, q4, a4, 135))).toMatch(/source not eligible/)
    await db.query(`delete from public.ineligible_sources where article_id = $1`, [ARTICLE])
  })
  it('G — 새 DCP 직접 평가는 노출 기록이 없어 HOLD(시도 기록이 0 이어도)', async () => {
    const q = await qualify(ITEM2, 'independent_check', { task: 'r.inference_link' })
    const asmt = await approve(q, 'assessment')
    await as(db, ME)
    expect(await errorOf(deliver(check, q, asmt, 140))).toMatch(/G — exposure unknown/)
  })
  it('G — R5 기출 확인 과제: 노출 없음이면 공급 · 같은 문항 응답 · 같은 회차 응시 · 정규화 동일 지문은 거절', async () => {
    const ln = await lineOf(await newDemand('r.flow_order'), 'independent_check')
    const mk = async (ref: string) => {
      const q = await qualify(ref, 'independent_check', { task: 'r.flow_order', kind: 'csat_item' })
      return { q, a: await approve(q, 'assessment') }
    }
    const fresh = await mk('2022-33')
    await as(db, ME)
    expect(await errorOf(deliver(ln, fresh.q, fresh.a, 150))).toBeNull()
    // 2024 회차를 응시해 32번에만 답했다 → 32번은 응답, 31번은 같은 회차 응시
    const s = (await q1<{ id: string }>(`insert into public.csat_dx_session (user_id, exam_id) values ($1, '2024') returning id`, [ME])).id
    await db.query(`insert into public.csat_dx_response (session_id, item_no, item_id) values ($1, 32, '2024-32')`, [s])
    const answered = await mk('2024-32')
    const sameExam = await mk('2024-31')
    await as(db, ME)
    expect(await errorOf(deliver(ln, answered.q, answered.a, 151))).toMatch(/exposure attempted/)
    expect(await errorOf(deliver(ln, sameExam.q, sameExam.a, 152))).toMatch(/exposure exam_seen/)
    // 다른 회차(2021)에서 2024-31 에 답하면, 그 지문과 정규화 동일한 2023-32 는 지문 노출
    const s2 = (await q1<{ id: string }>(`insert into public.csat_dx_session (user_id, exam_id) values ($1, '2021') returning id`, [ME])).id
    await db.query(`insert into public.csat_dx_response (session_id, item_no, item_id) values ($1, 31, '2024-31')`, [s2])
    const shared = await mk('2023-32')
    await as(db, ME)
    expect(await errorOf(deliver(ln, shared.q, shared.a, 153))).toMatch(/exposure shared_passage_seen/)
  })
  it('R5 수직(격리): 수요 → 주문 → 재고 검색 → 승인 재고 공급 → delivered(같은 자격) · 다른 자격으로는 불가 · 다른 학습자 사용 불가', async () => {
    const line = await lineOf(await newDemand('r.flow_order'), 'guided_practice')
    await as(db, ME)
    const order = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 1::smallint, $2) id`, [line, key(200)])).id
    await as(db, ADMIN)
    await db.query(`select public.factory_order_transition($1, 'requested', 'stock_search', null, null, null, $2)`, [order, key(201)])
    const q = await qualify(ITEM, 'guided_practice', { task: 'r.flow_order' })
    const a = await approve(q)
    const other = await qualify(ITEM2, 'guided_practice', { task: 'r.flow_order' })
    await as(db, ME)
    await deliver(line, q, a, 202, order)
    await as(db, ADMIN)
    expect(await errorOf(db.query(`select public.factory_order_transition($1, 'stock_search', 'delivered', null, null, $2, $3)`, [order, other, key(203)]))).toMatch(/needs a delivery row/)
    expect((await q1<{ seq: number }>(`select public.factory_order_transition($1, 'stock_search', 'delivered', null, null, $2, $3) seq`, [order, q, key(204)])).seq).toBe(2)
    await as(db, OTHER)
    expect(await errorOf(deliver(line, q, a, 205, order))).toMatch(/not owned/)
  })
  it('목표 변경 = 다른 수요(새 서명) · 이전 수요의 공급을 상속하지 않는다', async () => {
    const g2 = Number((await q1<{ id: number }>(`insert into public.csat_map_goal_version (user_id) values ($1) returning id`, [ME])).id)
    const d1 = await newDemand('r.flow_order')
    const d2 = await newDemand('r.flow_order', ME, myWs, g2)
    expect(d2).not.toBe(d1)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.workspace_content_delivery where line_id = $1`, [await lineOf(d2, 'guided_practice')])).n).toBe(0)
  })
  it('공급 행은 추가 전용 · 계정 삭제 cascade 는 통과(기록이 계정 삭제를 막지 않는다)', async () => {
    expect(await errorOf(db.query(`delete from public.workspace_content_delivery where line_id = $1`, [guided]))).toMatch(/append-only/)
    expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order where user_id = $1`, [OTHER])).n).toBeGreaterThan(0)
    expect(await errorOf(db.query(`delete from auth.users where id = $1`, [OTHER]))).toBeNull()
    expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order where user_id = $1`, [OTHER])).n).toBe(0)
  })
})
