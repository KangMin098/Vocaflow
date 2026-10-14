// scripts/csat/map/v62/supply-concurrency.mjs
//
// v6.2 P-F8b — 보류 마이그레이션(C → B)을 **실제 PostgreSQL 17(다중 연결)** 에 올려 동시 트랜잭션을 시험한다.
// PGlite 테스트는 연결이 하나라 동시성을 못 본다. 이 스크립트는 로컬 임시 클러스터(embedded-postgres)를 띄우고 끝나면 지운다.
// 개발 DB 에 닿지 않는다.
//
// 준비(저장소 의존성에 넣지 않는다 — 실행할 때만 임시 폴더에 설치):
//   mkdir <tmp>/pgconc && cd <tmp>/pgconc && npm i embedded-postgres@17.10.0-beta.17 pg@8.13.1
// 실행:
//   node scripts/csat/map/v62/supply-concurrency.mjs --deps <tmp>/pgconc
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const DEPS = process.argv[process.argv.indexOf('--deps') + 1]
if (!DEPS || !fs.existsSync(path.join(DEPS, 'node_modules'))) throw new Error('--deps <embedded-postgres · pg 를 설치한 폴더> 가 필요하다')
const req = createRequire(path.join(DEPS, 'package.json'))
const { default: EmbeddedPostgres } = await import(pathToFileURL(req.resolve('embedded-postgres')).href)
const pg = req('pg')

const STUB = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/map/v62/__tests__/supply-stub.sql'), 'utf8')
const C = fs.readFileSync(path.join(ROOT, 'supabase/migrations/_pending_workspace_supply_c_qualification.sql'), 'utf8')
const B = fs.readFileSync(path.join(ROOT, 'supabase/migrations/_pending_workspace_supply_b_orders.sql'), 'utf8')

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-pgconc-'))
const port = 54000 + Math.floor(Math.random() * 900)
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port, persistent: false })
const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`) }

await server.initialise()
// Windows 관리자 계정에서는 postgres 를 직접 띄우면 거부된다 — pg_ctl 은 제한 토큰으로 내려 실행하므로 pg_ctl 로 띄운다.
const BIN = path.join(DEPS, 'node_modules', '@embedded-postgres', `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`, 'native', 'bin')
const pgctl = (args) => execFileSync(path.join(BIN, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, { stdio: 'ignore' })
pgctl(['-D', dir, '-o', `-p ${port}`, '-w', 'start'])
try {
  const admin = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'pw', database: 'postgres' })
  await admin.connect()
  await admin.query('create database vf')
  await admin.end()
  const pool = new pg.Pool({ host: 'localhost', port, user: 'postgres', password: 'pw', database: 'vf', max: 24 })
  const setup = await pool.connect()
  await setup.query(STUB)
  await setup.query(C)
  await setup.query(B)
  const ADMIN = randomUUID(), ME = randomUUID()
  await setup.query(`insert into auth.users values ($1), ($2); insert into public.admins values ($1, 'admin')`.replace('$1), ($2); insert into public.admins values ($1', `'${ADMIN}'), ('${ME}'); insert into public.admins values ('${ADMIN}'`))
  const ws = (await setup.query(`insert into public.learner_workspace (user_id) values ($1) returning id`, [ME])).rows[0].id
  await setup.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [ws, ME])
  setup.release()

  /** 한 연결에서 사용자로 한 트랜잭션 실행 — 결과 또는 오류 메시지 */
  async function asUser(uid, sql, params) {
    const c = await pool.connect()
    try {
      await c.query('begin')
      await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
      const r = await c.query(sql, params)
      await c.query('commit')
      return { ok: true, row: r.rows[0] }
    } catch (e) {
      await c.query('rollback').catch(() => {})
      return { ok: false, err: e.message }
    } finally {
      c.release()
    }
  }
  const all = (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)))
  const canonical = (task) => JSON.stringify({ v: 1, user: ME, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: 'v6.2', core: task,
    lines: [{ role: 'guided_practice', task, n: 2, types: [], keys: [], requires: [], reason: 'need' }] })

  // ① 같은 수요 동시 기록 20 → 같은 id 1개 · 줄 1벌
  const dem = await all(20, () => asUser(ME, `select public.workspace_demand_record($1) id`, [canonical('r.flow_order')]))
  const demIds = new Set(dem.filter((r) => r.ok).map((r) => r.row.id))
  const lines = (await pool.query(`select count(*)::int n from public.workspace_content_demand_line where demand_id = any($1)`, [[...demIds]])).rows[0].n
  check('같은 수요 동시 20건 → 수요 1 · 줄 1벌', demIds.size === 1 && dem.every((r) => r.ok) && lines === 1, `ids=${demIds.size} ok=${dem.filter((r) => r.ok).length}/20 lines=${lines}`)
  const demandId = [...demIds][0]
  const line = (await pool.query(`select id from public.workspace_content_demand_line where demand_id = $1`, [demandId])).rows[0].id

  // ② 같은 줄 서로 다른 요청 키로 동시 주문 20 → 성공 1 · 나머지 「열린 주문」
  const opens = await all(20, () => asUser(ME, `select public.factory_order_open($1, 'initial', 1::smallint, $2) id`, [line, randomUUID()]))
  const okOpens = opens.filter((r) => r.ok)
  const orders = (await pool.query(`select count(*)::int n from public.factory_order where line_id = $1`, [line])).rows[0].n
  check('같은 줄 동시 주문 20(다른 키) → 주문 1', okOpens.length === 1 && orders === 1, `ok=${okOpens.length} rows=${orders} errs=${[...new Set(opens.filter((r) => !r.ok).map((r) => r.err.slice(0, 40)))].join(' | ')}`)
  const order = okOpens[0].row.id

  // ③ 다른 줄에서 같은 요청 키 동시 재전송 20 → 모두 같은 주문 id
  const d2 = (await asUser(ME, `select public.workspace_demand_record($1) id`, [canonical('r.inference_link')])).row.id
  const line2 = (await pool.query(`select id from public.workspace_content_demand_line where demand_id = $1`, [d2])).rows[0].id
  const k = randomUUID()
  const same = await all(20, () => asUser(ME, `select public.factory_order_open($1, 'initial', 1::smallint, $2) id`, [line2, k]))
  const sameIds = new Set(same.filter((r) => r.ok).map((r) => r.row.id))
  check('같은 요청 키 동시 재전송 20 → 모두 같은 주문', same.every((r) => r.ok) && sameIds.size === 1, `ok=${same.filter((r) => r.ok).length}/20 ids=${sameIds.size} errs=${[...new Set(same.filter((r) => !r.ok).map((r) => r.err.slice(0, 50)))].join(' | ')}`)

  // ④ 같은 기대 상태로 동시 전이 20(서로 다른 키 · 서로 다른 목표) → 성공 1 · 이벤트 1 · 나머지 충돌
  const targets = ['stock_search', 'held', 'failed']
  const moves = await all(20, (i) => asUser(ADMIN, `select public.factory_order_transition($1, 'requested', $2, 'x', null, null, $3) seq`, [order, targets[i % 3], randomUUID()]))
  const okMoves = moves.filter((r) => r.ok)
  const ev = (await pool.query(`select count(*)::int n, max(seq) m from public.factory_order_event where order_id = $1`, [order])).rows[0]
  const st = (await pool.query(`select state, event_seq from public.factory_order where id = $1`, [order])).rows[0]
  check('동시 전이 20 → 성공 1 · 이벤트 1 · 주문 seq = 이벤트 seq', okMoves.length === 1 && ev.n === 1 && st.event_seq === 1, `ok=${okMoves.length} events=${ev.n} order=${st.state}/${st.event_seq}`)

  // ⑤ 같은 자격 동시 대체 10 → 성공 1(선형 이력)
  await pool.query(`insert into public.csat_dcp_items (id, kind, ref_id, payload, answer_key) values ($1, 'article', $2, '{}', '{}')`, [randomUUID(), randomUUID()])
  const item = (await pool.query(`select id from public.csat_dcp_items limit 1`)).rows[0].id
  const rev = (await pool.query(`select public.supply_artifact_revision('dcp_item', $1) r`, [item])).rows[0].r
  const axes = JSON.stringify(Object.fromEntries('ABCDEFGH'.split('').map((x) => [x, { state: 'pass' }])))
  const H = 'a'.repeat(64)
  const rec = (sup) => asUser(ADMIN, `select public.content_qualification_record('FQ1.0','dcp_item',$1,$2,'r.flow_order','guided_practice',$3::jsonb,'s',$4,null,'g',$4,'{}','{e}','m',$5) id`, [item, rev, axes, H, sup])
  const q0 = (await rec(null)).row.id
  const sups = await all(10, () => rec(q0))
  check('같은 자격 동시 대체 10 → 성공 1', sups.filter((r) => r.ok).length === 1, `ok=${sups.filter((r) => r.ok).length}`)

  // ⑥ 같은 줄 · 같은 산출물 동시 공급 10(다른 키) → 성공 1 · 공급 행 1
  const qCur = sups.find((r) => r.ok).row.id
  const appr = (await asUser(ADMIN, `select public.content_release_approve($1, 'public') id`, [qCur])).row.id
  const dels = await all(10, () => asUser(ME, `select public.workspace_delivery_record($1, null, $2, $3, $4) id`, [line, qCur, appr, randomUUID()]))
  const delRows = (await pool.query(`select count(*)::int n from public.workspace_content_delivery where line_id = $1`, [line])).rows[0].n
  check('같은 산출물 동시 공급 10 → 공급 1', dels.filter((r) => r.ok).length === 1 && delRows === 1, `ok=${dels.filter((r) => r.ok).length} rows=${delRows}`)

  // ⑦ 승인 철회와 공급이 경합 — 철회가 먼저 커밋되면 이후 공급은 거절(공급 시점 재검증)
  const d3 = (await asUser(ME, `select public.workspace_demand_record($1) id`, [canonical('r.central_meaning')])).row.id
  const line3 = (await pool.query(`select id from public.workspace_content_demand_line where demand_id = $1`, [d3])).rows[0].id
  const q3 = (await asUser(ADMIN, `select public.content_qualification_record('FQ1.0','dcp_item',$1,$2,'r.central_meaning','guided_practice',$3::jsonb,'s',$4,null,'g',$4,'{}','{e}','m',null) id`, [item, rev, axes, H])).row.id
  const a3 = (await asUser(ADMIN, `select public.content_release_approve($1, 'public') id`, [q3])).row.id
  await asUser(ADMIN, `select public.content_release_revoke($1, 'race')`, [a3])
  const late = await asUser(ME, `select public.workspace_delivery_record($1, null, $2, $3, $4) id`, [line3, q3, a3, randomUUID()])
  check('철회 커밋 뒤 공급 → 거절', !late.ok && /revoked/.test(late.err), late.ok ? 'delivered!' : late.err.slice(0, 60))

  await pool.end()
} finally {
  try { pgctl(['-D', dir, '-m', 'fast', '-w', 'stop']) } catch { /* 이미 멈춤 */ }
  fs.rmSync(dir, { recursive: true, force: true })
}
const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} PASS (PostgreSQL 17 · 다중 연결)`)
process.exit(failed ? 1 : 0)
