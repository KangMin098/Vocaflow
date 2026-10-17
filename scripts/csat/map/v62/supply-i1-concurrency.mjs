// scripts/csat/map/v62/supply-i1-concurrency.mjs
//
// Factory I1 — 보류 SQL(C → B → I1 safety → P → D3)을 **실제 PostgreSQL 17(다중 연결)** 에 올려 동시 트랜잭션을 시험한다.
// PGlite 는 연결이 하나라 동시성을 못 본다. 로컬 임시 클러스터(embedded-postgres)를 띄우고 끝나면 지운다. 개발 DB 에 닿지 않는다.
// 통과는 「격리 DB 에서 동시성 계약이 성립한다」 뿐 — 실제 개발 DB 적용 성공이 아니다.
//
// 준비(저장소 의존성에 넣지 않는다): mkdir <tmp>/pgconc && cd <tmp>/pgconc && npm i embedded-postgres@17.10.0-beta.17 pg@8.13.1
// 실행: node scripts/csat/map/v62/supply-i1-concurrency.mjs --deps <tmp>/pgconc [--baseline-b]
//   --baseline-b : I1 없이 B 만 올려 같은 시험을 돌린다(B 의 결함 재현용 — 실패가 기대값)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { independentCases } from './supply-i1-independent.mjs'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const DEPS = process.argv[process.argv.indexOf('--deps') + 1]
const BASELINE = process.argv.includes('--baseline-b')
if (!DEPS || !fs.existsSync(path.join(DEPS, 'node_modules'))) throw new Error('--deps <embedded-postgres · pg 를 설치한 폴더> 가 필요하다')
const req = createRequire(path.join(DEPS, 'package.json'))
const { default: EmbeddedPostgres } = await import(pathToFileURL(req.resolve('embedded-postgres')).href)
const pg = req('pg')

const T = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const STUB = T('apps/web/src/lib/csat/map/v62/__tests__/supply-stub.sql')
const STUB_I1 = T('apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql')
const MIG = (f) => process.argv.includes('--submitted')
  ? execFileSync('git', ['show', `e89ebac493841b6fbcd0ebf0cdda780361ae75d6:supabase/migrations/${f}`], { cwd: ROOT, encoding: 'utf8' })
  : T(`supabase/migrations/${f}`)
const LAYERS = BASELINE
  ? [MIG('_pending_workspace_supply_c_qualification.sql'), MIG('_pending_workspace_supply_b_orders.sql')]
  : [MIG('_pending_workspace_supply_c_qualification.sql'), MIG('_pending_workspace_supply_b_orders.sql'),
     MIG('_pending_workspace_supply_i1_safety.sql'), MIG('_pending_workspace_supply_i1_partial.sql'), MIG('_pending_workspace_supply_i1_d3_lineage.sql')]

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-pgconc-i1-'))
const port = 54000 + Math.floor(Math.random() * 900)
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port, persistent: false })
const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`) }

await server.initialise()
const BIN = path.join(DEPS, 'node_modules', '@embedded-postgres', `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`, 'native', 'bin')
const pgctl = (args) => execFileSync(path.join(BIN, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, { stdio: 'ignore' })
pgctl(['-D', dir, '-o', `-p ${port}`, '-w', 'start'])
try {
  const admin = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'pw', database: 'postgres' })
  await admin.connect(); await admin.query('create database vf'); await admin.end()
  const pool = new pg.Pool({ host: 'localhost', port, user: 'postgres', password: 'pw', database: 'vf', max: 30 })
  const setup = await pool.connect()
  console.log(`server_version=${(await setup.query('show server_version')).rows[0].server_version}`)
  await setup.query(STUB); await setup.query(STUB_I1)
  // 실제 개발 DB pg_default_acl 읽기 감사와 같게: 새 표에 anon/authenticated ALL이 기본 부여된다.
  await setup.query(`alter default privileges in schema public grant all on tables to anon, authenticated`)
  for (const l of LAYERS) await setup.query(l)
  const ADMIN = randomUUID(), ME = randomUUID()
  await setup.query(`insert into auth.users values ('${ADMIN}'), ('${ME}'); insert into public.admins values ('${ADMIN}', 'admin')`)
  const ws = (await setup.query(`insert into public.learner_workspace (user_id) values ($1) returning id`, [ME])).rows[0].id
  await setup.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1, $2, 1)`, [ws, ME])
  const items = Array.from({ length: 30 }, (_, i) => `C#${i}`)
  for (const id of items) await setup.query(`insert into public.csat_items (id, exam_id, no, stem, passage, choices, answer) values ($1, 'C', 1, 's', $2, '[1]', 1)`, [id, `passage ${id}`])
  setup.release()

  async function asUser(uid, sql, params, opts = {}) {
    const c = opts.client ?? await pool.connect()
    try {
      if (!opts.client) await c.query('begin')
      await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid])
      if (opts.timeoutMs) await c.query(`set local statement_timeout = ${opts.timeoutMs}`)
      const r = await c.query(sql, params)
      if (!opts.client) await c.query('commit')
      return { ok: true, row: r.rows[0] }
    } catch (e) {
      if (!opts.client) await c.query('rollback').catch(() => {})
      return { ok: false, err: e.message }
    } finally {
      if (!opts.client) c.release()
    }
  }
  const all = (n, f) => Promise.all(Array.from({ length: n }, (_, i) => f(i)))
  const canonical = (task, role, n, tag) => JSON.stringify({ v: 2, user: ME, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1,
    definitionVersion: `v6.2-${tag}`, core: task, lines: [{ role, task, n, types: [], keys: [], requires: [], reason: 'need' }] })
  const newLine = async (role, n, tag, task = 'r.central_meaning') => {
    const d = (await asUser(ME, `select public.workspace_demand_record($1) id`, [canonical(task, role, n, tag)])).row.id
    return (await pool.query(`select id from public.workspace_content_demand_line where demand_id = $1`, [d])).rows[0].id
  }
  const axes = JSON.stringify(Object.fromEntries('ABCDEFGH'.split('').map((x) => [x, { state: 'pass' }])))
  const H = 'a'.repeat(64)
  const qualifyApprove = async (ref, role, task = 'r.central_meaning') => {
    const rev = (await pool.query(`select public.supply_artifact_revision('csat_item', $1) r`, [ref])).rows[0].r
    const q = (await asUser(ADMIN, `select public.content_qualification_record('FQ1.1','csat_item',$1,$2,$3,$4,$5::jsonb,'s',$6,null,'g',$6,'{}','{e}','m',null) id`, [ref, rev, task, role, axes, H])).row.id
    const p = (await asUser(ADMIN, `select public.content_release_approve($1, 'public') id`, [q])).row.id
    return { q, p }
  }

  // ① 같은 공급 요청 키 동시 재전송 20 → 모두 같은 id(B: unique 위반으로 일부 실패)
  {
    const line = await newLine('guided_practice', 5, 'k1')
    const { q, p } = await qualifyApprove('C#0', 'guided_practice')
    const k = randomUUID()
    const r = await all(20, () => asUser(ME, `select public.workspace_delivery_record($1, null, $2, $3, $4) id`, [line, q, p, k]))
    const ids = new Set(r.filter((x) => x.ok).map((x) => x.row.id))
    check('같은 공급 요청 키 동시 재전송 20 → 모두 같은 공급', r.every((x) => x.ok) && ids.size === 1, `ok=${r.filter((x) => x.ok).length}/20 ids=${ids.size} errs=${[...new Set(r.filter((x) => !x.ok).map((x) => x.err.slice(0, 50)))].join(' | ')}`)
  }

  // ② 줄 수량 3 에 서로 다른 산출물 20 동시 공급 → 정확히 3(B: 상한 없음 → 20)
  {
    const line = await newLine('guided_practice', 3, 'k2')
    const qa = []
    for (let i = 1; i <= 20; i++) qa.push(await qualifyApprove(`C#${i}`, 'guided_practice'))
    const r = await all(20, (i) => asUser(ME, `select public.workspace_delivery_record($1, null, $2, $3, $4) id`, [line, qa[i].q, qa[i].p, randomUUID()]))
    const rows = (await pool.query(`select count(*)::int n from public.workspace_content_delivery where line_id = $1`, [line])).rows[0].n
    check('줄 수량 3 · 동시 공급 20 → 공급 3', rows === 3, `rows=${rows} ok=${r.filter((x) => x.ok).length}`)
  }

  // ③ 철회 ↔ 공급 직렬화 — 공급 트랜잭션이 열려 있으면 철회가 기다리고, 철회가 열려 있으면 공급이 기다린 뒤 거절
  {
    const line = await newLine('guided_practice', 5, 'k3')
    const a1 = await qualifyApprove('C#21', 'guided_practice')
    const c1 = await pool.connect(); await c1.query('begin')
    const d1 = await asUser(ME, `select public.workspace_delivery_record($1, null, $2, $3, $4) id`, [line, a1.q, a1.p, randomUUID()], { client: c1 })
    const blocked = await asUser(ADMIN, `select public.content_release_revoke($1, 'race')`, [a1.p], { timeoutMs: 800 })
    await c1.query('commit'); c1.release()
    const after = await asUser(ADMIN, `select public.content_release_revoke($1, 'race')`, [a1.p])
    check(BASELINE ? '공급 열린 동안 철회 대기(B: 잠금 없음 → 즉시 철회)' : '공급 트랜잭션이 열린 동안 철회는 대기(직렬화)', d1.ok && !blocked.ok && /statement timeout/.test(blocked.err) && after.ok,
      `deliver=${d1.ok} revokeWhileOpen=${blocked.ok ? 'committed' : blocked.err.slice(0, 40)} revokeAfter=${after.ok}`)

    const a2 = await qualifyApprove('C#22', 'guided_practice')
    const c2 = await pool.connect(); await c2.query('begin')
    const rv = await asUser(ADMIN, `select public.content_release_revoke($1, 'race')`, [a2.p], { client: c2 })
    const pending = asUser(ME, `select public.workspace_delivery_record($1, null, $2, $3, $4) id`, [line, a2.q, a2.p, randomUUID()])
    await new Promise((r) => setTimeout(r, 400))
    await c2.query('commit'); c2.release()
    const late = await pending
    check('철회 트랜잭션이 열린 동안 공급은 대기 → 철회 커밋 뒤 거절', rv.ok && !late.ok && /revoked|public approval required/.test(late.err), `revoke=${rv.ok} deliver=${late.ok ? 'delivered!' : late.err.slice(0, 50)}`)
  }

  // ④ 주문 열기 동시 20(다른 키) → 1 (P 가 바꾼 factory_order_open 회귀)
  {
    const line = await newLine('guided_practice', 4, 'k4')
    const r = await all(20, () => asUser(ME, `select public.factory_order_open($1, 'initial', 2::smallint, $2) id`, [line, randomUUID()]))
    const rows = (await pool.query(`select count(*)::int n from public.factory_order where line_id = $1`, [line])).rows[0].n
    check('같은 줄 동시 주문 20 → 주문 1', rows === 1 && r.filter((x) => x.ok).length === 1, `rows=${rows}`)
  }

  if (!BASELINE) {
    // ⑤ 공용 주문 같은 revision 동시 등록 20(다른 키) → 1 · 같은 키 20 → 모두 성공 · 행 1
    const PO = 'TPO-CONC'
    const share = 'c'.repeat(32)
    const reg = (rev, hash, k) => asUser(ADMIN, `select public.factory_product_order_register($1,$2,$3,'active',$4,'r.central_meaning','guided_practice',10,null,$5)`, [PO, rev, hash, share, k])
    const r5 = await all(20, () => reg(1, 'b'.repeat(64), randomUUID()))
    const rows5 = (await pool.query(`select count(*)::int n from public.factory_product_order where product_order_id = $1`, [PO])).rows[0].n
    check('같은 revision 동시 등록 20 → 1', rows5 === 1 && r5.filter((x) => x.ok).length === 1, `rows=${rows5} ok=${r5.filter((x) => x.ok).length}`)
    const k = randomUUID()
    const r5b = await all(20, () => reg(2, 'd'.repeat(64), k))
    const rows5b = (await pool.query(`select count(*)::int n from public.factory_product_order where product_order_id = $1`, [PO])).rows[0].n
    check('같은 등록 키 동시 재전송 20 → 모두 성공 · 새 행 1', r5b.every((x) => x.ok) && rows5b === 2, `ok=${r5b.filter((x) => x.ok).length}/20 rows=${rows5b}`)

    // ⑥ 링크 20 과 새 revision 등록이 경합 → 낡은 revision 에 링크가 새로 생기지 않는다(직렬화)
    const orders = []
    for (let i = 0; i < 20; i++) {
      const line = await newLine('guided_practice', 2, `k6-${i}`)
      orders.push((await asUser(ME, `select public.factory_order_open($1, 'initial', 1::smallint, $2) id`, [line, randomUUID()])).row.id)
    }
    const links = all(20, (i) => asUser(ADMIN, `select public.factory_order_link_product($1,$2,2,$3,$4)`, [orders[i], PO, 'd'.repeat(64), randomUUID()]))
    const bump = reg(3, 'e'.repeat(64), randomUUID())
    const [lr] = await Promise.all([links, bump])
    const bad = lr.filter((x) => !x.ok && !/not current/.test(x.err))
    // created_at 은 트랜잭션 시작 시각이라 커밋 순서를 말하지 않는다 — 판정은 「잠금 순서대로 현재성 검사 → 거절 사유는 not current 뿐 · 교착 0」
    check('링크 20 ↔ 새 revision 경합 → 거절 사유는 「not current」 뿐(교착 · 다른 오류 0)', bad.length === 0, `linked=${lr.filter((x) => x.ok).length} rejected=${lr.filter((x) => !x.ok).length} other=${bad.length}`)
  }
  if (!BASELINE) await independentCases({ pool, asUser, check, newLine, ADMIN, ME, STUB, STUB_I1, LAYERS, rollback: MIG('_pending_workspace_supply_i1_rollback.sql') })
  await pool.end()
} finally {
  try { pgctl(['-D', dir, '-m', 'fast', '-w', 'stop']) } catch { /* 이미 멈춤 */ }
  if (!path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(dir).startsWith('vf-pgconc-i1-')) throw new Error('unsafe temporary cluster cleanup path')
  fs.rmSync(dir, { recursive: true, force: true })
}
const failed = results.filter((r) => !r.ok).length
const sha = (p) => createHash('sha256').update(MIG(path.basename(p))).digest('hex').slice(0, 12)
console.log(`\n${results.length - failed}/${results.length} PASS (PostgreSQL 17 · 다중 연결 · ${BASELINE ? 'B 만(기준선)' : 'C+B+I1'}) safety=${sha('supabase/migrations/_pending_workspace_supply_i1_safety.sql')}`)
process.exit(failed ? 1 : 0)
