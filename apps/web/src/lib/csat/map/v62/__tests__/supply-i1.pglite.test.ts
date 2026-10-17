// apps/web/src/lib/csat/map/v62/__tests__/supply-i1.pglite.test.ts
// Factory I1 — 보류 SQL C → B → I1 safety(D1 노출 · D2 승인) → I1-P(부분 납품) → I1-D3(공용 계보)를 격리 Postgres(PGlite)에 올려 확인한다.
// 개발 DB 에 닿지 않는다 — 통과는 「격리 DB 에서 의도대로 동작한다」 뿐, 실제 개발 DB 적용 성공이 아니다.
// ⚠️ PGlite 는 연결이 하나다 — 동시 트랜잭션은 scripts/csat/map/v62/supply-i1-concurrency.mjs(실제 PostgreSQL 다중 연결)가 본다.
import fs from 'node:fs'
import path from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

import type { WorkspaceDemand } from '../demand'
import { canonicalDemand } from '../persist-contract'
import { AXES, B_SQL, C_SQL, STUB, as, errorOf, revOf } from './supply-sql-harness'

const MIG = path.resolve(__dirname, '../../../../../../../../supabase/migrations')
const read = (f: string) => fs.readFileSync(path.join(MIG, f), 'utf8')
export const I1_SAFETY = read('_pending_workspace_supply_i1_safety.sql')
export const I1_PARTIAL = read('_pending_workspace_supply_i1_partial.sql')
export const I1_D3 = read('_pending_workspace_supply_i1_d3_lineage.sql')
const I1_STUB = fs.readFileSync(path.join(__dirname, 'supply-i1-stub.sql'), 'utf8')

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const A = '00000000-0000-4000-8000-0000000000b1'
const B = '00000000-0000-4000-8000-0000000000b2'
const H64 = 'a'.repeat(64)
let n = 0
const key = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`

let db: PGlite
let wsA: string
let wsB: string
const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0]!

/** 줄 하나짜리 수요 — 역할 · TASK · 수량을 정한다 */
async function lineFor(uid: string, ws: string, role: string, qty: number, task = 'r.central_meaning'): Promise<string> {
  const d = {
    key: 'k', template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: `v6.2-${++n}`,
    asOf: '2026-10-17T00:00:00Z', core: task, support: [], purpose: { need: null, evidence: 'x', independentItems: null, unknowns: [] },
    lines: [{ role, task, quantity: { n: qty }, csatTypes: ['R-TOPIC'], taskKeys: [], requires: [], reason: 'need' }],
  } as unknown as WorkspaceDemand
  await as(db, uid)
  const dem = (await q1<{ id: string }>(`select public.workspace_demand_record($1) id`, [canonicalDemand(uid, d)])).id
  return (await q1<{ id: string }>(`select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
}
async function qualify(ref: string, role: string, kind = 'csat_item', task = 'r.central_meaning', supersedes: string | null = null): Promise<string> {
  const rev = (await revOf(db, kind, ref)) ?? 'none'
  await as(db, ADMIN)
  return (await q1<{ id: string }>(
    `select public.content_qualification_record('FQ1.1',$1,$2,$3,$4,$5,$6::jsonb,'src',$7,null,'gold',$7,'{}','{ev}','2인 검수',$8) id`,
    [kind, ref, rev, task, role, JSON.stringify(AXES()), H64, supersedes])).id
}
async function approve(q: string, scope: 'public' | 'assessment'): Promise<string> {
  await as(db, ADMIN)
  return (await q1<{ id: string }>(`select public.content_release_approve($1, $2) id`, [q, scope])).id
}
async function revoke(a: string) { await as(db, ADMIN); await db.query(`select public.content_release_revoke($1, 'rights withdrawn')`, [a]) }
const deliver = async (uid: string, line: string, q: string, a: string, k = key(), order: string | null = null) => {
  await as(db, uid)
  return (await db.query<{ id: string }>(`select public.workspace_delivery_record($1, $2, $3, $4, $5) id`, [line, order, q, a, k])).rows[0]!.id
}
const exposure = async (ref: string, uid: string) => (await q1<{ e: string }>(`select public.supply_learner_exposure('csat_item', $1, $2) e`, [ref, uid])).e

/** 평가용 승인 두 범위가 다 있는 문항 */
async function assessmentReady(ref: string, role = 'independent_check') {
  const q = await qualify(ref, role)
  return { q, pub: await approve(q, 'public'), asm: await approve(q, 'assessment') }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(I1_STUB)
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated`)
  await db.exec(C_SQL)
  await db.exec(B_SQL)
  await db.exec(I1_SAFETY)
  await db.exec(I1_PARTIAL)
  await db.exec(I1_D3)
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${A}'), ('${B}');
    insert into public.admins values ('${ADMIN}', 'admin');
    insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values
      ('E1#20', 'E1', 20, 's', 'Fresh passage one.', '[1,2,3,4,5]', 1),
      ('E1#21', 'E1', 21, 's', 'Fresh passage two.', '[1,2,3,4,5]', 2),
      ('E1#22', 'E1', 22, 's', 'Fresh passage three.', '[1,2,3,4,5]', 3),
      ('E1#23', 'E1', 23, 's', 'Fresh passage four.', '[1,2,3,4,5]', 4),
      ('E1#24', 'E1', 24, 's', 'Fresh passage five.', '[1,2,3,4,5]', 5),
      ('E1#25', 'E1', 25, 's', 'Fresh passage six.', '[1,2,3,4,5]', 1),
      ('E1#26', 'E1', 26, 's', 'Fresh passage seven.', '[1,2,3,4,5]', 2),
      ('E1#41', 'E1', 41, 's', 'Shared   Long Passage.', '[1,2,3,4,5]', 1),
      ('E1#42', 'E1', 42, 's', 'shared long passage.', '[1,2,3,4,5]', 2),
      ('E2#30', 'E2', 30, 's', 'Attempted by G2.', '[1,2,3,4,5]', 3),
      ('E2#31', 'E2', 31, 's', 'Explanation only.', '[1,2,3,4,5]', 3),
      ('E2#32', 'E2', 32, 's', 'Trap attempt.', '[1,2,3,4,5]', 3),
      ('E2#33', 'E2', 33, 's', 'Deleted session.', '[1,2,3,4,5]', 3),
      ('E2#34', 'E2', 34, 's', 'Viewed first only.', '[1,2,3,4,5]', 3),
      ('E2#35', 'E2', 35, 's', 'Opened only.', '[1,2,3,4,5]', 3),
      ('E2#36', 'E2', 36, 's', 'Session attempts.', '[1,2,3,4,5]', 3),
      ('E2#37', 'E2', 37, 's', 'Review queue.', '[1,2,3,4,5]', 3),
      ('E2#38', 'E2', 38, 's', 'Repeat attempt.', '[1,2,3,4,5]', 3),
      ('E3#10', 'E3', 10, 's', 'Exam seen.', '[1,2,3,4,5]', 3);`)
  wsA = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [A])).id
  wsB = (await q1<{ id: string }>(`insert into public.learner_workspace (user_id) values ($1) returning id`, [B])).id
  await db.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1), ($3, $4, 1)`, [wsA, A, wsB, B])
  // 학습자 A 의 실제 형태 노출 기록(개발 DB 열과 같은 모양)
  const s = (sql: string) => db.exec(sql)
  await s(`insert into public.learning_task_attempts (user_id, item_ref) values ('${A}', 'E2#30')`)
  await s(`insert into public.learning_task_attempts (user_id, item_ref) values ('${A}', 'E2#38'), ('${A}', 'E2#38')`)
  await s(`insert into public.learning_sessions (user_id, item_ref, explanation_viewed_at, help_level) values ('${A}', 'E2#31', now(), 'independent')`)
  await s(`insert into public.csat_trap_attempts (user_id, item_id) values ('${A}', 'E2#32')`)
  await s(`insert into public.learning_sessions (user_id, item_ref, explanation_server_at, deleted_at) values ('${A}', 'E2#33', now(), now())`)
  await s(`insert into public.learning_sessions (user_id, item_ref, help_level) values ('${A}', 'E2#34', 'viewed_first')`)
  await s(`insert into public.learning_sessions (user_id, item_ref) values ('${A}', 'E2#35')`)
  await s(`insert into public.csat_session_attempts (user_id, item_id) values ('${A}', 'E2#36')`)
  await s(`insert into public.csat_review_queue (user_id, item_id) values ('${A}', 'E2#37')`)
  await s(`insert into public.learning_task_attempts (user_id, item_ref) values ('${A}', 'E1#41')`)
  await s(`insert into public.csat_dx_session (user_id, exam_id) values ('${A}', 'E3')`)
  // 읽기 권한 시험용 — 실제 Supabase 처럼 authenticated 는 표 SELECT 권한을 갖고 RLS 가 행을 거른다
  await s(`grant usage on schema public, auth to authenticated; grant select on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;`)
})

describe('D1 — 학습자 노출(G) 판정', () => {
  it.each([
    ['E2#30', 'attempted', 'G2 확인 과제 시도(learning_task_attempts)'],
    ['E2#38', 'attempted', '반복 수행(같은 문항 두 번)'],
    ['E2#32', 'attempted', '함정 시도(csat_trap_attempts — I0 delta 가 놓친 원장)'],
    ['E2#36', 'attempted', '세션 시도(csat_session_attempts)'],
    ['E2#37', 'attempted', '복습 큐(csat_review_queue)'],
    ['E2#31', 'explanation_seen', '시도 없이 해설만 열람'],
    ['E2#33', 'explanation_seen', '해설 본 뒤 세션 삭제 — 삭제가 노출을 지우지 않는다'],
    ['E2#34', 'explanation_seen', 'viewed_first 도움만(해설 시각 없음)'],
    ['E2#35', 'item_seen', '문항 화면만 열었음'],
    ['E1#42', 'shared_passage_seen', '같은 지문(정규화)의 다른 문항을 G2 로 풀었음'],
    ['E3#10', 'exam_seen', '같은 회차 응시'],
    ['E1#20', 'none', '기록 없음(양성 대조)'],
    ['NOPE#1', 'unknown', '없는 문항'],
  ])('%s → %s (%s)', async (ref, want) => {
    expect(await exposure(ref, A)).toBe(want)
  })
  it('다른 학습자의 기록은 내 노출이 아니다', async () => {
    expect(await exposure('E2#30', B)).toBe('none')
  })
  it('DCP 는 노출 원장이 없어 시도가 없어도 unknown(평가 공급 HOLD)', async () => {
    expect((await q1<{ e: string }>(`select public.supply_learner_exposure('dcp_item', $1, $2) e`, ['11111111-1111-4111-8111-111111111111', A])).e).toBe('unknown')
  })
  it('인자가 없으면 unknown', async () => {
    expect((await q1<{ e: string }>(`select public.supply_learner_exposure('csat_item', 'E1#20', null) e`)).e).toBe('unknown')
  })

  it('노출 기록이 있는 문항은 평가 공급 거절, 기록 없는 문항은 공급', async () => {
    for (const [ref, why] of [['E2#30', 'attempted'], ['E2#31', 'explanation_seen'], ['E1#42', 'shared_passage_seen'], ['E2#35', 'item_seen']] as const) {
      const r = await assessmentReady(ref)
      const line = await lineFor(A, wsA, 'independent_check', 2)
      expect(await errorOf(deliver(A, line, r.q, r.asm))).toContain(`exposure ${why}`)
    }
    const ok = await assessmentReady('E1#21')
    const line = await lineFor(A, wsA, 'independent_check', 2)
    expect(await deliver(A, line, ok.q, ok.asm)).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('노출 원장이 하나라도 없으면 unknown → 공급 거절(설치 누락 = 판정 불가)', async () => {
    const iso = new PGlite()
    await iso.exec(STUB); await iso.exec(I1_STUB); await iso.exec(C_SQL); await iso.exec(B_SQL); await iso.exec(I1_SAFETY)
    await iso.exec(`insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values ('X#1','X',1,'s','p','[1]',1); drop table public.csat_trap_attempts;`)
    expect((await iso.query<{ e: string }>(`select public.supply_learner_exposure('csat_item', 'X#1', '${A}') e`)).rows[0]!.e).toBe('unknown')
    await iso.close()
  })

  it('노출 판정 함수는 학습자가 직접 호출할 수 없다(다른 학습자 기록 조회 통로 차단)', async () => {
    await db.exec('set role authenticated')
    try {
      expect(await errorOf(db.query(`select public.supply_learner_exposure('csat_item', 'E2#30', '${A}')`))).toMatch(/permission denied/)
      expect(await errorOf(db.query(`select public.supply_delivery_valid('${A}')`))).toMatch(/permission denied/)
    } finally { await db.exec('reset role') }
  })
})

describe('D2 — 출시 승인 범위', () => {
  it('평가 역할: public 만 있으면 거절', async () => {
    const q = await qualify('E1#22', 'independent_check')
    const pub = await approve(q, 'public')
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'independent_check', 1), q, pub))).toContain('assessment approval required')
  })
  it('평가 역할: assessment 만 있으면 거절(public 필수)', async () => {
    const q = await qualify('E1#23', 'transfer')
    const asm = await approve(q, 'assessment')
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'transfer', 1), q, asm))).toContain('public approval required')
  })
  it('교수 역할: assessment 승인만으로는 거절(B 는 통과시켰다)', async () => {
    const q = await qualify('E1#23', 'model_explanation')
    const asm = await approve(q, 'assessment')
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'model_explanation', 1), q, asm))).toContain('public approval required')
  })
  it('평가 역할은 기록 승인도 assessment 여야 한다(public 행으로 기록 거절)', async () => {
    const r = await assessmentReady('E1#24', 'delayed_check')
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'delayed_check', 1), r.q, r.pub))).toContain('must record the assessment approval')
  })
  it('public 철회 → 평가 · 교수 모두 거절 / assessment 철회 → 평가 거절', async () => {
    const r = await assessmentReady('E1#25')
    await revoke(r.pub)
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'independent_check', 1), r.q, r.asm))).toContain('public approval required')
    const r2 = await assessmentReady('E1#26')
    await revoke(r2.asm)
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'independent_check', 1), r2.q, r2.asm))).toContain('approval revoked')
  })
  it('다른 자격 행의 승인은 세지 않는다(qualification 결속)', async () => {
    const qa = await qualify('E1#20', 'guided_practice')
    const qb = await qualify('E1#21', 'guided_practice')
    const pb = await approve(qb, 'public')
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'guided_practice', 1), qa, pb))).toContain('approval missing')
  })
  it('TASK · 역할 정체성이 다르면 거절', async () => {
    const q = await qualify('E1#20', 'source_analysis', 'csat_item', 'r.flow_order')
    const p = await approve(q, 'public')
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'source_analysis', 1), q, p))).toContain('identity mismatch')
  })
  it('검수 뒤 산출물이 바뀌면 거절(revision 결속)', async () => {
    const q = await qualify('E1#22', 'source_analysis')
    const p = await approve(q, 'public')
    await db.exec(`update public.csat_items set passage = 'Fresh passage three, edited.' where id = 'E1#22'`)
    expect(await errorOf(deliver(A, await lineFor(A, wsA, 'source_analysis', 1), q, p))).toContain('artifact changed')
    await db.exec(`update public.csat_items set passage = 'Fresh passage three.' where id = 'E1#22'`)
  })
})

describe('사용자 격리 · 멱등 · 권한', () => {
  it('B 는 A 의 줄에 공급할 수 없고, A 의 공급 · 충족도를 읽지 못한다', async () => {
    const q = await qualify('E1#24', 'guided_practice')
    const p = await approve(q, 'public')
    const lineA = await lineFor(A, wsA, 'guided_practice', 3)
    await deliver(A, lineA, q, p)
    expect(await errorOf(deliver(B, lineA, q, p))).toContain('not found or not owned')
    await as(db, B)
    expect(await errorOf(db.query(`select * from public.workspace_line_fulfillment($1)`, [lineA]))).toContain('not owned')
    await db.exec('set role authenticated')
    try {
      const seen = await db.query(`select count(*)::int n from public.workspace_content_delivery where line_id = $1`, [lineA])
      expect((seen.rows[0] as { n: number }).n).toBe(0)
      const pol = await db.query(`select count(*)::int n from public.factory_product_order`)
      expect((pol.rows[0] as { n: number }).n).toBe(0)
    } finally { await db.exec('reset role') }
  })
  it('같은 요청 키 · 같은 본문 = 같은 id, 다른 본문 = 23505', async () => {
    const q = await qualify('E1#25', 'guided_practice')
    const p = await approve(q, 'public')
    const line = await lineFor(A, wsA, 'guided_practice', 3)
    const k = key()
    const first = await deliver(A, line, q, p, k)
    expect(await deliver(A, line, q, p, k)).toBe(first)
    const q2 = await qualify('E1#26', 'guided_practice')
    const p2 = await approve(q2, 'public')
    expect(await errorOf(deliver(A, line, q2, p2, k))).toContain('different body')
  })
  it('새 · 바뀐 함수는 모두 SECURITY DEFINER(판정기 · 쓰기) + search_path 고정, anon 실행권 없음', async () => {
    const fns = ['supply_learner_exposure', 'supply_delivery_valid', 'workspace_delivery_record', 'content_release_revoke', 'workspace_line_fulfillment',
      'factory_order_open', 'factory_order_transition', 'factory_product_order_is_current', 'factory_product_order_register', 'factory_order_link_product']
    const r = await db.query<{ proname: string; prosecdef: boolean; cfg: string | null; anon: boolean; authd: boolean }>(
      `select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') cfg,
              has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') authd
       from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = any($1)`, [fns])
    expect(r.rows.map((x) => x.proname).sort()).toEqual([...fns].sort())
    for (const f of r.rows) {
      expect(f.prosecdef, f.proname).toBe(true)
      expect(f.cfg, f.proname).toContain('search_path=public')
      expect(f.anon, f.proname).toBe(false)
    }
    const internal = ['supply_learner_exposure', 'supply_delivery_valid', 'factory_product_order_is_current']
    for (const f of r.rows.filter((x) => internal.includes(x.proname))) expect(f.authd, f.proname).toBe(false)
  })
  it('직접 INSERT(정의자 함수 밖)는 거부 — 새 D3 표 포함', async () => {
    expect(await errorOf(db.query(`insert into public.factory_product_order (product_order_id, order_revision, order_hash, contract, status, share_key, task_id, role, quantity, registered_by, request_key)
      values ('PO-X', 1, '${H64}', 'textbook-product-order/1', 'active', '${'b'.repeat(32)}', 'r.central_meaning', 'guided_practice', 1, '${ADMIN}', '${key()}')`))).toContain('insert only via supply functions')
  })
})

describe('P — 부분 납품 · 재주문 · 철회', () => {
  it('요청 5 · 적격 2 → delivered 거절, partial 로 닫힘, 남은 부족 3, 부족분 재주문은 ≤ 3', async () => {
    const line = await lineFor(A, wsA, 'guided_practice', 5, 'r.inference_link')
    await as(db, A)
    const order = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 5::smallint, $2) id`, [line, key()])).id
    await as(db, ADMIN)
    await db.query(`select public.factory_order_transition($1, 'requested', 'stock_search', null, null, null, $2)`, [order, key()])
    const qs: string[] = []
    for (const ref of ['E1#20', 'E1#21']) {
      const q = await qualify(ref, 'guided_practice', 'csat_item', 'r.inference_link')
      qs.push(q)
      await deliver(A, line, q, await approve(q, 'public'), key(), order)
    }
    await as(db, ADMIN)
    expect(await errorOf(db.query(`select public.factory_order_transition($1, 'stock_search', 'delivered', null, null, $2, $3)`, [order, qs[0], key()]))).toContain('full quantity')
    expect(await errorOf(db.query(`select public.factory_order_transition($1, 'stock_search', 'partial', null, null, null, $2)`, [order, key()]))).toContain('needs a reason')
    await db.query(`select public.factory_order_transition($1, 'stock_search', 'partial', '재고 2개만 적격', null, null, $2)`, [order, key()])
    await as(db, A)
    const f = await q1<{ requested: number; delivered_total: number; delivered_valid: number; shortfall: number }>(`select * from public.workspace_line_fulfillment($1)`, [line])
    expect(f).toEqual({ requested: 5, delivered_total: 2, delivered_valid: 2, shortfall: 3 })
    expect(await errorOf(db.query(`select public.factory_order_open($1, 'shortfall', 4::smallint, $2)`, [line, key()]))).toContain('exceeds remaining shortfall 3')
    const re = (await q1<{ id: string }>(`select public.factory_order_open($1, 'shortfall', 3::smallint, $2) id`, [line, key()])).id
    expect(re).toMatch(/^[0-9a-f-]{36}$/)
    // 닫힌(partial) 주문으로 공급 거절
    const q3 = await qualify('E1#22', 'guided_practice', 'csat_item', 'r.inference_link')
    expect(await errorOf(deliver(A, line, q3, await approve(q3, 'public'), key(), order))).toContain('order closed (partial)')
  })
  it('권리 철회 → 유효 공급이 줄어 부족이 다시 생기고, 대체 공급 자리가 열린다', async () => {
    const line = await lineFor(A, wsA, 'guided_practice', 1, 'r.flow_order')
    const q = await qualify('E1#23', 'guided_practice', 'csat_item', 'r.flow_order')
    const p = await approve(q, 'public')
    await deliver(A, line, q, p)
    const q2 = await qualify('E1#24', 'guided_practice', 'csat_item', 'r.flow_order')
    const p2 = await approve(q2, 'public')
    expect(await errorOf(deliver(A, line, q2, p2))).toContain('line quantity reached')
    await revoke(p)
    await as(db, A)
    expect(await q1(`select * from public.workspace_line_fulfillment($1)`, [line])).toEqual({ requested: 1, delivered_total: 1, delivered_valid: 0, shortfall: 1 })
    expect(await deliver(A, line, q2, p2)).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('생산 실패 → 같은 주문은 되살리지 않고 retry_after_failure 새 주문', async () => {
    const line = await lineFor(A, wsA, 'guided_practice', 2, 'r.claim_support')
    await as(db, A)
    const o1 = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 2::smallint, $2) id`, [line, key()])).id
    expect(await errorOf(db.query(`select public.factory_order_open($1, 'shortfall', 1::smallint, $2)`, [line, key()]))).toContain('open order exists')
    await as(db, ADMIN)
    await db.query(`select public.factory_order_transition($1, 'requested', 'failed', '생산 실패', null, null, $2)`, [o1, key()])
    await as(db, A)
    expect(await errorOf(db.query(`select public.factory_order_open($1, 'shortfall', 1::smallint, $2)`, [line, key()]))).toContain('partial or delivered parent')
    const o2 = (await q1<{ id: string; parent: string }>(`select public.factory_order_open($1, 'retry_after_failure', 2::smallint, $2) id`, [line, key()])).id
    expect((await q1<{ p: string }>(`select parent_order_id p from public.factory_order where id = $1`, [o2])).p).toBe(o1)
  })
})

describe('독립 수용 R01/R02/R04 — 동일 입력 수정 전후 회귀', () => {
  it('B 회귀: 응답 문항 회차와 세션 회차가 달라도 공유 지문 노출을 거절한다(두 범위 승인 있음)', async () => {
    await db.exec(`insert into csat_items(id,exam_id,passage) values ('SH1#41','SH1','shared response path'),('SH2#42','SH2','shared response path')`)
    const session = (await q1<{ id: string }>(`insert into csat_dx_session(user_id,exam_id) values ($1,'DIFFERENT') returning id`, [A])).id
    await db.query(`insert into csat_dx_response(session_id,item_id) values ($1,'SH1#41')`, [session])
    expect(await exposure('SH2#42',A)).toBe('shared_passage_seen')
    const r = await assessmentReady('SH2#42')
    expect(await errorOf(deliver(A,await lineFor(A,wsA,'independent_check',1),r.q,r.asm))).toContain('exposure shared_passage_seen')
  })
  it('프로필 없는 로그인 사용자: 실제 helper의 NULL이 관리자 승인을 열지 않는다', async () => {
    await as(db, B)
    expect((await q1<{ ok: boolean | null }>(`select is_admin_or_curator() ok`)).ok).toBe(null)
    expect(await errorOf(db.query(`select content_qualification_record('FQ1.1','csat_item','X','rev','r.central_meaning','guided_practice',$1::jsonb,'src',$2,null,'g',$2,'{}','{e}','no-profile',null)`, [JSON.stringify(AXES()), H64]))).toContain('Forbidden')
    expect(await errorOf(db.query(`select content_release_approve($1,'public')`, [key()]))).toContain('Forbidden')
    expect(await errorOf(db.query(`select content_release_revoke($1,'no-profile')`, [key()]))).toContain('Forbidden')
    expect(await errorOf(db.query(`select factory_order_transition($1,'requested','failed','x',null,null,$2)`, [key(),key()]))).toContain('Forbidden')
    expect(await errorOf(db.query(`select factory_product_order_register('NO-PROFILE',1,$1,'active',$2,'r.central_meaning','guided_practice',1,null,$3)`, [H64,'a'.repeat(32),key()]))).toContain('Forbidden')
    expect(await errorOf(db.query(`select factory_order_link_product($1,'X',1,$2,$3)`, [key(),H64,key()]))).toContain('Forbidden')
  })
  it('권한 helper 자체 search_path에서도 임시 프로필 사칭을 막는다', async () => {
    await as(db,B)
    await db.exec(`create temporary table user_profiles(user_id uuid,role text)`)
    try {
      await db.query(`insert into pg_temp.user_profiles values ($1,'admin')`,[B])
      expect((await q1<{ ok: boolean | null }>(`select is_admin_or_curator() ok`)).ok).toBe(null)
      expect(await errorOf(db.query(`select content_release_revoke($1,'temp spoof')`,[key()]))).toContain('Forbidden')
    } finally { await db.exec(`drop table pg_temp.user_profiles`) }
  })
  it('Supabase 기본 ALL의 TRUNCATE·REFERENCES·TRIGGER를 새 원장 10개에서 모두 회수한다', async () => {
    const tables = ['content_qualification','content_release_approval','content_release_revocation','workspace_content_demand','workspace_content_demand_line','factory_order','factory_order_event','workspace_content_delivery','factory_product_order','factory_order_product_link']
    for (const table of tables) {
      for (const role of ['anon','authenticated']) {
        for (const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) {
          expect((await q1<{ ok: boolean }>(`select has_table_privilege($1,$2,$3) ok`, [role,table,privilege])).ok, `${role}:${table}:${privilege}`).toBe(false)
        }
      }
    }
  })
  it('필수 축 state 누락은 NULL 통과가 아니라 잘못된 자격으로 거절한다', async () => {
    const axes = AXES() as Record<string, unknown>
    axes.A = {}
    expect((await q1<{ ok: boolean }>(`select public.fq_axes_valid($1::jsonb) ok`, [JSON.stringify(axes)])).ok).toBe(false)
    expect((await q1<{ ok: boolean }>(`select public.fq_role_ok($1::jsonb,'guided_practice') ok`, [JSON.stringify(axes)])).ok).toBe(false)
  })
  it('R01 supersede 뒤 옛 공급은 보존하되 현재 유효 수량에서 제외한다', async () => {
    const line = await lineFor(A, wsA, 'guided_practice', 1, 'r.supersede_case')
    const q = await qualify('E1#20', 'guided_practice', 'csat_item', 'r.supersede_case')
    const p = await approve(q, 'public')
    const id = await deliver(A, line, q, p)
    await qualify('E1#20', 'guided_practice', 'csat_item', 'r.supersede_case', q)
    expect((await q1<{ valid: boolean }>(`select public.supply_delivery_valid($1) valid`, [id])).valid).toBe(false)
    await as(db, A)
    expect(await q1(`select * from public.workspace_line_fulfillment($1)`, [line])).toEqual({ requested: 1, delivered_total: 1, delivered_valid: 0, shortfall: 1 })
    expect((await q1<{ n: number }>(`select count(*)::int n from workspace_content_delivery where id=$1`, [id])).n).toBe(1)
  })
  it('R02 공급 5 뒤 철회 3: 전이 전에는 delivered 거절, partial 허용; 전이 후에는 이력 delivered와 현재 부족 3을 구분한다', async () => {
    for (const closeFirst of [false, true]) {
      const task = closeFirst ? 'r.closed_revoke' : 'r.before_revoke'
      const line = await lineFor(A, wsA, 'guided_practice', 5, task)
      await as(db, A)
      const order = (await q1<{ id: string }>(`select public.factory_order_open($1,'initial',5::smallint,$2) id`, [line, key()])).id
      await as(db, ADMIN)
      await db.query(`select public.factory_order_transition($1,'requested','stock_search',null,null,null,$2)`, [order, key()])
      const qs: string[] = [], ps: string[] = []
      for (const ref of ['E1#20','E1#21','E1#22','E1#23','E1#24']) {
        const q = await qualify(ref, 'guided_practice', 'csat_item', task)
        const p = await approve(q, 'public'); qs.push(q); ps.push(p)
        await deliver(A, line, q, p, key(), order)
      }
      const close = async (to: string, reason: string | null) => {
        await as(db, ADMIN)
        return db.query(`select public.factory_order_transition($1,'stock_search',$2,$3,null,$4,$5)`, [order, to, reason, qs[4], key()])
      }
      if (closeFirst) await close('delivered', null)
      for (const p of ps.slice(0,3)) await revoke(p)
      await as(db, A)
      expect(await q1(`select * from public.workspace_line_fulfillment($1)`, [line])).toEqual({ requested: 5, delivered_total: 5, delivered_valid: 2, shortfall: 3 })
      if (!closeFirst) {
        expect(await errorOf(close('delivered', null))).toContain('full quantity')
        expect(await errorOf(close('partial', '   '))).toContain('needs a reason')
        await close('partial', '승인 3건 철회')
      }
      expect((await q1<{ state: string }>(`select state from factory_order where id=$1`, [order])).state).toBe(closeFirst ? 'delivered' : 'partial')
      await as(db, A)
      expect(await errorOf(db.query(`select public.factory_order_open($1,'shortfall',4::smallint,$2)`, [line,key()]))).toContain('exceeds remaining shortfall 3')
      await db.query(`select public.factory_order_open($1,'shortfall',3::smallint,$2)`, [line,key()])
    }
  })
  it('R04 revision 불변이어도 현재 원천 적격성 실패는 공급 유효 수량에서 제외한다', async () => {
    const ref = '11111111-1111-4111-8111-111111111111', src = '22222222-2222-4222-8222-222222222222'
    await db.query(`insert into csat_dcp_items(id,kind,ref_id) values ($1,'article',$2)`, [ref,src])
    const line = await lineFor(A, wsA, 'guided_practice', 1, 'r.source_case')
    const q = await qualify(ref, 'guided_practice', 'dcp_item', 'r.source_case')
    const p = await approve(q, 'public')
    const id = await deliver(A, line, q, p)
    const rev = await revOf(db, 'dcp_item', ref)
    await db.query(`insert into ineligible_sources values ($1)`, [src])
    expect(await revOf(db, 'dcp_item', ref)).toBe(rev)
    expect((await q1<{ valid: boolean }>(`select public.supply_delivery_valid($1) valid`, [id])).valid).toBe(false)
    await as(db, A)
    expect(await q1(`select * from public.workspace_line_fulfillment($1)`, [line])).toEqual({ requested: 1, delivered_total: 1, delivered_valid: 0, shortfall: 1 })
  })
  it('R04 기출 Reveal Gate 보류도 revision 불변일 때 현재 공급에서 제외하고 신규 공급을 거절한다', async () => {
    const task = 'r.reveal_case', line = await lineFor(A, wsA, 'guided_practice', 2, task)
    const q = await qualify('E1#26','guided_practice','csat_item',task), p = await approve(q,'public')
    const id = await deliver(A,line,q,p)
    const rev = await revOf(db,'csat_item','E1#26')
    await db.exec(`insert into embargoed_items values ('E1#26')`)
    expect(await revOf(db,'csat_item','E1#26')).toBe(rev)
    expect((await q1<{ v: boolean }>(`select supply_delivery_valid($1) v`,[id])).v).toBe(false)
    const line2 = await lineFor(A,wsA,'guided_practice',1,task)
    expect(await errorOf(deliver(A,line2,q,p))).toContain('source not eligible')
    await db.exec(`delete from embargoed_items where item_id='E1#26'`)
  })
})

describe('되돌리기(_pending_workspace_supply_i1_rollback.sql — 생성물)', () => {
  const ROLLBACK = read('_pending_workspace_supply_i1_rollback.sql')
  it('S만 승인한 DB도 P/D3 없이 안전하게 되돌리고 공급 실행권은 닫아 둔다', async () => {
    const r = new PGlite()
    try {
      for (const s of [STUB, I1_STUB, C_SQL, B_SQL, I1_SAFETY]) await r.exec(s)
      await as(r, B)
      expect(await errorOf(r.query(`select factory_order_transition($1,'requested','failed','no-profile',null,null,$2)`,[key(),key()]))).toContain('Forbidden')
      await r.exec(ROLLBACK)
      expect((await r.query<{ ok: boolean }>(`select has_function_privilege('authenticated','public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid)','execute') ok`)).rows[0]!.ok).toBe(false)
    } finally { await r.close() }
  })
  it('빈 DB: 적용 → 되돌리기 → B 원래 동작(노출은 dx 만 · 평가 역할은 assessment 하나로 통과) · 새 객체 0', async () => {
    const r = new PGlite()
    for (const s of [STUB, I1_STUB, C_SQL, B_SQL, I1_SAFETY, I1_PARTIAL, I1_D3, ROLLBACK]) await r.exec(s)
    await r.exec(`insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values ('R#1','R',1,'s','p','[1]',1);
      insert into public.learning_task_attempts (user_id, item_ref) values ('${A}', 'R#1');`)
    // B 원본 판정기는 G2 시도를 보지 않는다 — 되돌리기가 실제로 원본으로 돌아갔다는 증거
    expect((await r.query<{ e: string }>(`select public.supply_learner_exposure('csat_item', 'R#1', '${A}') e`)).rows[0]!.e).toBe('none')
    const left = await r.query<{ n: number }>(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
      and p.proname in ('supply_delivery_valid','workspace_line_fulfillment','factory_product_order_register','factory_order_link_product','factory_product_order_is_current')`)
    expect(left.rows[0]!.n).toBe(0)
    expect((await r.query<{ t: string | null }>(`select to_regclass('public.factory_product_order')::text t`)).rows[0]!.t).toBe(null)
    const chk = await r.query<{ d: string }>(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'factory_order_state_check'`)
    expect(chk.rows[0]!.d).not.toContain('partial')
    await r.close()
  })
  it('partial 주문이 있으면 되돌리기 전체를 거절하고 아무것도 지우지 않는다', async () => {
    // 본 DB 에는 부분 납품 시험의 partial 주문이 있다
    expect(await errorOf(db.exec(ROLLBACK))).toMatch(/rollback P: partial orders exist/)
    await db.exec('rollback').catch(() => {})
    expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order where state = 'partial'`)).n).toBeGreaterThan(0)
    expect((await q1<{ t: string | null }>(`select to_regclass('public.factory_product_order')::text t`)).t).toBe('factory_product_order')
    expect((await q1<{ e: string }>(`select public.supply_learner_exposure('csat_item', 'E2#30', '${A}') e`)).e).toBe('attempted')
  })
})

describe('D3 — 공용 Product Order 계보', () => {
  const PO = 'TPO-2026-001'
  const share = 'c'.repeat(32)
  const h = (c: string) => c.repeat(64)
  it('등록 → 현재 revision 링크 성공 · 옛 revision · 해시 불일치 · 철회 · TASK 불일치 거절 · 학습자 비노출', async () => {
    await as(db, ADMIN)
    const reg = (rev: number, hash: string, status = 'active', task = 'r.central_meaning', k = key()) =>
      db.query(`select public.factory_product_order_register($1,$2,$3,$4,$5,$6,'guided_practice',10,null,$7)`, [PO, rev, hash, status, share, task, k])
    expect(await errorOf(reg(2, h('1')))).toContain('revision must be 1')
    const k1 = key()
    await reg(1, h('1'), 'active', 'r.central_meaning', k1)
    await reg(1, h('1'), 'active', 'r.central_meaning', k1) // 같은 키 같은 본문 = 멱등
    expect(await errorOf(reg(1, h('2'), 'active', 'r.central_meaning', k1))).toContain('different body')

    const lineA = await lineFor(A, wsA, 'guided_practice', 2, 'r.central_meaning')
    const lineB = await lineFor(B, wsB, 'guided_practice', 2, 'r.central_meaning')
    await as(db, A); const oA = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 2::smallint, $2) id`, [lineA, key()])).id
    await as(db, B); const oB = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 2::smallint, $2) id`, [lineB, key()])).id
    await as(db, A)
    expect(await errorOf(db.query(`select public.factory_order_link_product($1,$2,1,$3,$4)`, [oA, PO, h('1'), key()]))).toContain('Forbidden')
    await as(db, ADMIN)
    const link = (o: string, rev: number, hash: string) => db.query(`select public.factory_order_link_product($1,$2,$3,$4,$5)`, [o, PO, rev, hash, key()])
    await link(oA, 1, h('1'))
    await link(oB, 1, h('1')) // 두 학습자 주문 → 한 공용 주문(N:M)
    expect(await errorOf(link(oA, 1, h('9')))).toContain('order_hash mismatch')
    await reg(2, h('2'))
    expect(await errorOf(link(oA, 1, h('1')))).toBe(null) // 이미 있는 링크 = 같은 결과(멱등)
    const lineC = await lineFor(A, wsA, 'guided_practice', 1, 'r.central_meaning')
    await as(db, A); const oC = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 1::smallint, $2) id`, [lineC, key()])).id
    await as(db, ADMIN)
    expect(await errorOf(link(oC, 1, h('1')))).toContain('not current')
    await link(oC, 2, h('2'))
    await reg(3, h('3'), 'withdrawn')
    expect(await errorOf(link(oC, 3, h('3')))).toContain('not current or withdrawn')
    expect(await errorOf(reg(4, h('4'), 'active', 'r.flow_order'))).toContain('task/role cannot change')
    const lineT = await lineFor(A, wsA, 'guided_practice', 1, 'r.flow_order')
    await as(db, A); const oT = (await q1<{ id: string }>(`select public.factory_order_open($1, 'initial', 1::smallint, $2) id`, [lineT, key()])).id
    await as(db, ADMIN)
    await reg(4, h('4'))
    expect(await errorOf(link(oT, 4, h('4')))).toContain('task/role mismatch')

    // 학습자는 자기 주문은 보지만 공용 등록부 · 링크(다른 학습자와 공유 사실)는 0행
    await as(db, A)
    await db.exec('set role authenticated')
    try {
      expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order_product_link`)).n).toBe(0)
      expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_product_order`)).n).toBe(0)
      expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order where id = $1`, [oB])).n).toBe(0)
      expect((await q1<{ n: number }>(`select count(*)::int n from public.factory_order where id = $1`, [oA])).n).toBe(1)
    } finally { await db.exec('reset role') }
    // 추가 전용
    expect(await errorOf(db.query(`delete from public.factory_order_product_link where order_id = $1`, [oA]))).toContain('append-only')
  })
})
