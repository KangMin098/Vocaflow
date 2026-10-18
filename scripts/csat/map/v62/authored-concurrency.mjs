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
  await s.query(`insert into auth.users values ('${ADMIN}'), ('${L}'); insert into public.admins values ('${ADMIN}', 'admin')`)
  const as = (c, uid) => c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid])
  const one = async (c, sql, p = []) => (await c.query(sql, p)).rows[0]

  // 같은 지문 정체성의 평가 문항 둘(같은 본문 · 다른 그룹 이름 — FI-003 과 함께 본다)
  const body = (tag) => ({ sentences: ['The same passage one.', 'The same passage two.', 'The same passage three.'], stem: 'q', choices: ['a', 'b', 'c', 'd', 'e'], tag })
  const gold = { answer: 2, claim: 1, claimRestated: [], support: [2], supportDisputed: [], opposed: [], relationProbe: { sentence: 2, relation: 'reason' }, gist: 'gist text here', distractors: [] }
  await as(s, ADMIN)
  const refs = []
  for (const [id, role, group] of [['conc-a', 'independent_check', 'g-conc-a'], ['conc-b', 'delayed_check', 'g-conc-b']]) {
    const b = body(id)
    await s.query(`select public.authored_item_register($1,$2,$3,'assessment',$4,$5,$6::jsonb,$7::jsonb,$8,'{"author":"t","method":"t","derivedFrom":[]}'::jsonb)`,
      [`authored:${id}`, TASK, TKEY, role, group, JSON.stringify(b), JSON.stringify(gold), `${TKEY}-${id}.v1`])
    const ref = `authored:${id}`
    const { rev, gh } = await one(s, `select public.supply_artifact_revision('authored_item',$1) rev, public.authored_item_gold_hash($1) gh`, [ref])
    const q = (await one(s, `select public.content_qualification_record('FQ1.1','authored_item',$1,$2,$3,$4,$5::jsonb,'self',$2,null,'gold',$6,$7,$6,'{}','{ev}','concurrency fixture',null) id`,
      [ref, rev, TASK, role, JSON.stringify(AXES), gh, `${TKEY}-${id}.v1`])).id
    await s.query(`select public.content_human_decision_record('rights','authored_item',$1,$2,$2,'self_authored_original','{store,display,transmit,assess}','fixture','human-reviewed')`, [ref, rev])
    await s.query(`select public.content_human_decision_record('gold','authored_item',$1,$2,$3,'human_gold_review','{assess}','fixture','human-reviewed')`, [ref, rev, gh])
    await s.query(`select public.content_release_approve($1,'public')`, [q])
    const asm = (await one(s, `select public.content_release_approve($1,'assessment') id`, [q])).id
    refs.push({ ref, role, q, asm })
  }
  const keys = await one(s, `select public.r5_exposure_key('authored_item',$1) a, public.r5_exposure_key('authored_item',$2) b`, [refs[0].ref, refs[1].ref])
  check('같은 본문 · 다른 그룹 이름 = 같은 노출 키(FI-003)', keys.a === keys.b, keys.a)

  // 서로 다른 Workspace · 수요 줄
  const lines = []
  for (const r of refs) {
    const ws = (await one(s, `insert into public.learner_workspace (user_id) values ($1) returning id`, [L])).id
    await s.query(`insert into public.learner_workspace_plan (workspace_id, user_id, plan_version) values ($1,$2,1)`, [ws, L])
    await as(s, L)
    // canonicalDemand 와 같은 정본(키 정렬 JSON · v 2 · lines[].n) — apps/web/src/lib/csat/map/v62/canonical-json.ts
    const canon = canonical({ v: 2, user: L, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1, definitionVersion: `conc-${++seq}`, core: TASK, support: [],
      lines: [{ role: r.role, task: TASK, n: 1, types: [], keys: [], requires: {}, reason: 'need' }] })
    const dem = (await one(s, `select public.workspace_demand_record($1) id`, [canon])).id
    lines.push((await one(s, `select id from public.workspace_content_demand_line where demand_id = $1`, [dem])).id)
    await as(s, ADMIN)
  }
  s.release()

  // 두 연결: 첫 공급 미커밋 중 둘째 공급
  const c1 = await pool.connect(); const c2 = await pool.connect()
  await as(c1, L); await as(c2, L)
  await c1.query('begin')
  await c1.query(`select public.workspace_delivery_record($1, null, $2, $3, $4)`, [lines[0], refs[0].q, refs[0].asm, key()])
  await c2.query('begin')
  let secondDone = false
  const second = c2.query(`select public.workspace_delivery_record($1, null, $2, $3, $4)`, [lines[1], refs[1].q, refs[1].asm, key()])
    .then(() => { secondDone = true; return null }, (e) => { secondDone = true; return e })
  await new Promise((r) => setTimeout(r, 800))
  check('둘째 공급은 첫 공급 커밋까지 기다린다(직렬화)', secondDone === false, `secondDone=${secondDone}`)
  await c1.query('commit')
  const err = await second
  await c2.query(err ? 'rollback' : 'commit')
  check('첫 커밋 뒤 둘째 공급은 노출(G)로 거절', !!err && /exposure/.test(err.message), err ? err.message : 'no error')
  const n = (await pool.query(`select count(*)::int n from public.workspace_content_delivery where user_id = $1`, [L])).rows[0].n
  check('같은 지문 정체성 납품 1행', n === 1, `rows=${n}`)
  c1.release(); c2.release()
  await pool.end()
} finally {
  try { pgctl(['-D', dir, '-m', 'fast', 'stop']) } catch { /* ignore */ }
  fs.rmSync(dir, { recursive: true, force: true })
}
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} PASS`)
process.exit(failed.length ? 1 : 0)
