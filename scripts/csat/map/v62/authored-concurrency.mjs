// scripts/csat/map/v62/authored-concurrency.mjs
//
// FI-006(#298) — 보류 창작 공급 SQL 을 **실제 PostgreSQL 17(다중 연결)** 에 올려 같은 학습자 · 같은 지문 정체성의 동시 공급을 시험한다.
// PGlite 는 연결이 하나라 이 경합을 못 본다. 로컬 임시 클러스터(embedded-postgres)를 띄우고 끝나면 지운다. 개발 DB 에 닿지 않는다.
// 통과는 「격리 DB 에서 동시성 계약이 성립한다」 뿐 — 실제 개발 DB 적용 성공이 아니다.
//
// 준비(저장소 의존성에 넣지 않는다): mkdir <tmp>/pgconc && cd <tmp>/pgconc && npm i embedded-postgres@17.10.0-beta.17 pg@8.13.1
// 실행: node scripts/csat/map/v62/authored-concurrency.mjs --deps <tmp>/pgconc
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const DEPS = process.argv[process.argv.indexOf('--deps') + 1]
if (!DEPS || !fs.existsSync(path.join(DEPS, 'node_modules'))) throw new Error('--deps <embedded-postgres · pg 를 설치한 폴더> 가 필요하다')
const req = createRequire(path.join(DEPS, 'package.json'))
const { default: EmbeddedPostgres } = await import(pathToFileURL(req.resolve('embedded-postgres')).href)
const pg = req('pg')

const T = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
// CI 격리 job 은 빈 DB 기동을 위해 supabase/migrations 를 _all_migrations 로 옮겨 둔다
const MIG = fs.existsSync(path.join(ROOT, 'supabase/_all_migrations')) ? 'supabase/_all_migrations' : 'supabase/migrations'
const STUB = T('apps/web/src/lib/csat/map/v62/__tests__/supply-stub.sql')
const STUB_I1 = T('apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql')
const G2_COLUMNS = `alter table public.learning_task_attempts add column if not exists activity text,
  add column if not exists help_level text, add column if not exists content_hash text, add column if not exists received_at timestamptz default now(),
  add column if not exists client_mutation_id uuid; alter table public.learning_sessions add column if not exists stage text;`
const LAYERS = ['_pending_workspace_supply_c_qualification.sql', '_pending_workspace_supply_b_orders.sql', '_pending_workspace_supply_i1_safety.sql',
  '20261018120000_workspace_supply_c_annotation_binding.sql', '20261018120100_r5_delivery_g2_binding.sql', '_pending_authored_supply.sql']
  .map((f) => T(`${MIG}/${f}`))

const ADMIN = '00000000-0000-4000-8000-0000000000a1'
const L = '00000000-0000-4000-8000-0000000000d1'
const L2 = '00000000-0000-4000-8000-0000000000d2'
const L3 = '00000000-0000-4000-8000-0000000000d3'
const L4 = '00000000-0000-4000-8000-0000000000d4'
const TASK = 'r.central_meaning'
const TKEY = 'authored-central-meaning'
const AXES = Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((k) => [k, { state: 'pass' }]))
let seq = 0
const canonical = (v) => v === null ? 'null' : Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : typeof v === 'object' ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v)
const key = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, '0')}`

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-pgconc-authored-'))
const port = 54000 + Math.floor(Math.random() * 900)
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'pw', port, persistent: false })
const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`) }

await server.initialise()
const BIN = path.join(DEPS, 'node_modules', '@embedded-postgres', `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`, 'native', 'bin')
const pgctl = (args) => execFileSync(path.join(BIN, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, { stdio: 'ignore' })
pgctl(['-D', dir, '-o', `-p ${port}`, '-w', 'start'])
try {
  const admin0 = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'pw', database: 'postgres' })
  await admin0.connect(); await admin0.query('create database vf'); await admin0.end()
  const pool = new pg.Pool({ host: 'localhost', port, user: 'postgres', password: 'pw', database: 'vf', max: 10 })
  const s = await pool.connect()
  console.log(`server_version=${(await s.query('show server_version')).rows[0].server_version}`)
  await s.query(STUB); await s.query(STUB_I1); await s.query(G2_COLUMNS)
  for (const sql of LAYERS) await s.query(sql)
  await s.query(`insert into auth.users values ('${ADMIN}'), ('${L}'), ('${L2}'), ('${L3}'), ('${L4}'); insert into public.admins values ('${ADMIN}', 'admin')`)
  const as = (c, uid) => c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  const one = async (c, sql, p = []) => (await c.query(sql, p)).rows[0]

  const body = (sentences, tag) => ({ sentences, stem: 'q', choices: ['a', 'b', 'c', 'd', 'e'], tag })
  const gold = { answer: 2, claim: 1, claimRestated: [], support: [2], supportDisputed: [], opposed: [], relationProbe: { sentence: 2, relation: 'reason' }, gist: 'gist text here', distractors: [] }
  const SAME = ['The same passage one.', 'The same passage two.', 'The same passage three.']
  /** 창작 평가 문항 등록 + 자격 · 사람 결정(격리 fixture) · 출시 승인 */
  async function register(id, role, group, sentences) {
    await as(s, ADMIN)
    const ref = `authored:${id}`
    await s.query(`select public.authored_item_register($1,$2,$3,'assessment',$4,$5,$6::jsonb,$7::jsonb,$8,'{"author":"t","method":"t","derivedFrom":[]}'::jsonb)`,
      [ref, TASK, TKEY, role, group, JSON.stringify(body(sentences, id)), JSON.stringify(gold), `${TKEY}-${id}.v1`])
    const { rev, gh } = await one(s, `select public.supply_artifact_revision('authored_item',$1) rev, public.authored_item_gold_hash($1) gh`, [ref])
    const q = (await one(s, `select public.content_qualification_record('FQ1.1','authored_item',$1,$2,$3,$4,$5::jsonb,'self',$2,null,'gold',$6,$7,$6,'{}','{ev}','concurrency fixture',null) id`,
      [ref, rev, TASK, role, JSON.stringify(AXES), gh, `${TKEY}-${id}.v1`])).id
    await s.query(`select public.content_human_decision_record('rights','authored_item',$1,$2,$2,'self_authored_original','{store,display,transmit,assess}','fixture','human-reviewed')`, [ref, rev])
    await s.query(`select public.content_human_decision_record('gold','authored_item',$1,$2,$3,'human_gold_review','{assess}','fixture','human-reviewed')`, [ref, rev, gh])
    await s.query(`select public.content_release_approve($1,'public')`, [q])
    const asm = (await one(s, `select public.content_release_approve($1,'assessment') id`, [q])).id
    return { ref, role, q, asm }
  }
  /** 학습자의 별도 Workspace · 수요 줄 하나 */
  async function demandLine(uid, role) {
    await as(s, ADMIN)
    const ws = (await one(s, `insert into public.learner_workspace (user_id) values ($1) returning id`, [uid])).id
    await s.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1,$2,1)`, [ws, uid])
    await as(s, uid)
    // canonicalDemand 와 같은 정본(키 정렬 JSON · v 2 · lines[].n) — apps/web/src/lib/csat/map/v62/canonical-json.ts
    const canon = canonical({ v: 2, user: uid, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: `conc-${++seq}`, core: TASK, support: [],
      lines: [{ role, task: TASK, n: 1, types: [], keys: [], requires: {}, reason: 'need' }] })
    const dem = (await one(s, `select public.workspace_demand_record($1) id`, [canon])).id
    const line = (await one(s, `select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id
    await as(s, ADMIN)
    return line
  }
  /** 두 연결: 첫 공급 미커밋 중 둘째 공급 → { waited, err, rows } */
  async function race(uid, a, b) {
    const c1 = await pool.connect(); const c2 = await pool.connect()
    try {
      await as(c1, uid); await as(c2, uid)
      await c1.query('begin')
      await c1.query(`select public.workspace_delivery_record($1, null, $2, $3, $4)`, [a.line, a.item.q, a.item.asm, key()])
      await c2.query('begin')
      let done = false
      const second = c2.query(`select public.workspace_delivery_record($1, null, $2, $3, $4)`, [b.line, b.item.q, b.item.asm, key()])
        .then(() => { done = true; return null }, (e) => { done = true; return e })
      await new Promise((r) => setTimeout(r, 800))
      const waited = done === false
      await c1.query('commit')
      const err = await second
      await c2.query(err ? 'rollback' : 'commit')
      const rows = (await pool.query(`select count(*)::int n from public.workspace_content_delivery where user_id = $1`, [uid])).rows[0].n
      return { waited, err, rows }
    } finally { c1.release(); c2.release() }
  }

  // ① 원래 반례 — 같은 본문 · 다른 그룹 이름 · 다른 ref · 다른 수요 줄
  const a1 = await register('conc-a', 'independent_check', 'g-conc-a', SAME)
  const b1 = await register('conc-b', 'delayed_check', 'g-conc-b', SAME)
  const keys = await one(s, `select public.r5_exposure_key('authored_item',$1) a, public.r5_exposure_key('authored_item',$2) b`, [a1.ref, b1.ref])
  check('같은 본문 · 다른 그룹 이름 = 같은 노출 키(FI-003)', keys.a === keys.b, keys.a)
  // ② 같은 ref · 같은 자격 · 같은 승인 · 서로 다른 Workspace 수요 줄(#298 잔여 1)
  const a2 = await register('conc-same', 'independent_check', 'g-conc-same', ['Same ref passage one.', 'Same ref passage two.', 'Same ref passage three.'])
  // ③ 같은 declared 그룹 · 다른 본문 표현(key 다름)(#298 잔여 2)
  const a3 = await register('conc-g1', 'independent_check', 'g-conc-shared', ['Group passage alpha one.', 'Group passage alpha two.', 'Group passage alpha three.'])
  const b3 = await register('conc-g2', 'delayed_check', 'g-conc-shared', ['Group passage beta one.', 'Group passage beta two.', 'Group passage beta three.'])
  // ④ 정상 대조군 — 서로 다른 본문 · 그룹 · ref
  const a4 = await register('conc-x', 'independent_check', 'g-conc-x', ['Control passage x one.', 'Control passage x two.', 'Control passage x three.'])
  const b4 = await register('conc-y', 'delayed_check', 'g-conc-y', ['Control passage y one.', 'Control passage y two.', 'Control passage y three.'])
  const lines = {
    1: [await demandLine(L, a1.role), await demandLine(L, b1.role)],
    2: [await demandLine(L2, a2.role), await demandLine(L2, a2.role)],
    3: [await demandLine(L3, a3.role), await demandLine(L3, b3.role)],
    4: [await demandLine(L4, a4.role), await demandLine(L4, b4.role)],
  }
  s.release()

  const blocked = (e) => !!e && /exposure|already received/.test(e.message)
  const r1 = await race(L, { line: lines[1][0], item: a1 }, { line: lines[1][1], item: b1 })
  check('① 같은 본문 · 다른 그룹: 둘째는 첫 커밋까지 기다린다', r1.waited, `waited=${r1.waited}`)
  check('① 첫 커밋 뒤 둘째 거절 · 납품 1행', blocked(r1.err) && r1.rows === 1, `${r1.err?.message ?? 'no error'} rows=${r1.rows}`)
  const r2 = await race(L2, { line: lines[2][0], item: a2 }, { line: lines[2][1], item: a2 })
  check('② 같은 ref · 다른 수요 줄: 기다린 뒤 거절 · 납품 1행', r2.waited && blocked(r2.err) && r2.rows === 1, `waited=${r2.waited} ${r2.err?.message ?? 'no error'} rows=${r2.rows}`)
  const r3 = await race(L3, { line: lines[3][0], item: a3 }, { line: lines[3][1], item: b3 })
  check('③ 같은 그룹 · 다른 본문 key: 기다린 뒤 거절 · 납품 1행', r3.waited && blocked(r3.err) && r3.rows === 1, `waited=${r3.waited} ${r3.err?.message ?? 'no error'} rows=${r3.rows}`)
  const r4 = await race(L4, { line: lines[4][0], item: a4 }, { line: lines[4][1], item: b4 })
  check('④ 정상 대조군 — 다른 지문 둘 다 공급(납품 2행)', !r4.err && r4.rows === 2, `${r4.err?.message ?? 'ok'} rows=${r4.rows} waited=${r4.waited}`)
  await pool.end()
} finally {
  try { pgctl(['-D', dir, '-m', 'fast', 'stop']) } catch { /* ignore */ }
  fs.rmSync(dir, { recursive: true, force: true })
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} PASS`)
process.exit(failed.length ? 1 : 0)
