// scripts/research/factory-i2-r5-qualification/independent-postgres.mts
// pnpm exec tsx <this file> --deps <isolated embedded-postgres deps> [--submitted] [--out <json>]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { annotationCases } from './independent-cases'
import { jsonbText } from './verify-content.mjs'

const root = path.resolve(import.meta.dirname, '../../..')
const arg = (k: string) => process.argv[process.argv.indexOf(k) + 1]
const deps = arg('--deps')
if (!deps || !fs.existsSync(path.join(deps, 'node_modules/embedded-postgres'))) throw new Error('isolated --deps required')
const req = createRequire(path.join(deps, 'package.json'))
const EmbeddedPostgres = req('embedded-postgres').default
const { Pool } = req('pg')
const submitted = process.argv.includes('--submitted')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const stub = read('apps/web/src/lib/csat/map/v62/__tests__/supply-stub.sql')
const i1stub = read('apps/web/src/lib/csat/map/v62/__tests__/supply-i1-stub.sql')
const files = ['_pending_workspace_supply_c_qualification.sql', '_pending_workspace_supply_b_orders.sql', '_pending_workspace_supply_i1_safety.sql', '_pending_workspace_supply_i1_partial.sql', '20261018120000_workspace_supply_c_annotation_binding.sql']
const preLockFix = process.argv.includes('--pre-lock-fix')
const layers = files.map(f => ((f.includes('annotation_binding') || f.includes('b_orders')) && submitted) || (f.includes('annotation_binding') && preLockFix)
  ? execFileSync('git', ['show', `${preLockFix ? '15d153d8e' : 'f94ddcbce3dc25afe9e2beb22c4aab1910a9cf4a'}:supabase/migrations/${f}`], { cwd: root, encoding: 'utf8' })
  : read(`supabase/migrations/${f}`))
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-i2-annotation-'))
const port = 55100 + Math.floor(Math.random() * 500)
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'isolated', port, persistent: false })
await server.initialise()
const bin = path.join(deps, 'node_modules/@embedded-postgres', `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`, 'native/bin')
const ctl = (args: string[]) => execFileSync(path.join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, { stdio: 'ignore', windowsHide: true })
ctl(['-D', dir, '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'])
const pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'isolated', database: 'postgres', max: 5 })
let db
try {
  db = await pool.connect()
  if (process.argv.includes('--fail-after-connect')) throw new Error('injected cleanup failure')
  await db.query(stub); await db.query(i1stub)
  await db.query('alter default privileges in schema public grant all on tables to anon, authenticated')
  for (const layer of layers) await db.query(layer)
  const jsonbOracle = []
  for (const fixture of [['alpha', 'beta'], { long: [1, 'x'], b: '"', a: null }, { 한글: 'x', z: 'y', aa: ['a\nb', true] }]) {
    const sql = (await db.query('select $1::jsonb::text t', [JSON.stringify(fixture)])).rows[0].t
    const matches = jsonbText(fixture) === sql
    jsonbOracle.push(matches)
    if (!matches) throw new Error('PostgreSQL JSONB text oracle mismatch')
  }
  const run = await annotationCases(db)
  if (run.current) {
    // Separate connections: supply holds a shared lock against trusted deployment edit.
    await db.query(`update supply_current_annotation set annotation_hash=$1`, ['a'.repeat(64)])
    await db.query(`delete from learning_task_attempts`)
    const tx = await pool.connect(), edit = await pool.connect()
    try {
      await tx.query('begin')
      await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [run.me])
      const key = crypto.randomUUID()
      // A fresh demand avoids replay/unique-item guards masking the annotation lock.
      const ws = (await db.query('select workspace_id from workspace_content_demand_line where id=$1', [run.l])).rows[0].workspace_id
      const c = JSON.stringify({ v: 2, user: run.me, template: 'ws.reading', workspaceId: ws, goalVersion: null, planVersion: 1,
        definitionVersion: key, core: 'r.central_meaning', lines: [{ role: 'transfer', task: 'r.central_meaning', n: 1, types: [], keys: [], requires: [], reason: 'race' }] })
      await tx.query(`select workspace_demand_record($1)`, [c])
      const l = (await tx.query(`select l.id from workspace_content_demand_line l join workspace_content_demand d on d.id=l.demand_id where d.canonical=$1`, [c])).rows[0].id
      await tx.query(`select workspace_delivery_record($1,null,$2,$3,$4)`, [l, run.q, run.asm, key])
      await edit.query('set statement_timeout=500')
      let locked = false
      try { await edit.query(`update supply_current_annotation set annotation_hash=$1`, ['b'.repeat(64)]) }
      catch (e) { locked = (e as { code: string }).code === '57014' }
      run.results.push({ name: 'real concurrent annotation edit waits for supply commit', ok: locked, detail: 'separate connections, statement_timeout=500ms' })
      await tx.query('commit')
      await edit.query(`update supply_current_annotation set annotation_hash=$1`, ['b'.repeat(64)])
      const valid = (await db.query(`select supply_delivery_valid(id) v from workspace_content_delivery where request_key=$1`, [key])).rows[0].v
      run.results.push({ name: 'committed annotation edit invalidates historical current fulfillment', ok: valid === false, detail: '' })
      // Reverse ordering: deployment is first; supply must wait, then observe the new hash.
      await edit.query('begin')
      await edit.query(`update supply_current_annotation set annotation_hash=$1`, ['c'.repeat(64)])
      await tx.query('begin')
      await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [run.me])
      await tx.query('set local statement_timeout=500')
      let blocked = false
      try { await tx.query(`select workspace_delivery_record($1,null,$2,$3,$4)`, [l, run.q, run.asm, crypto.randomUUID()]) }
      catch (e) { blocked = (e as { code: string }).code === '57014' }
      await tx.query('rollback')
      await edit.query('commit')
      await tx.query(`select set_config('request.jwt.claim.sub',$1,false)`, [run.me])
      let mismatch = false
      try { await tx.query(`select workspace_delivery_record($1,null,$2,$3,$4)`, [l, run.q, run.asm, crypto.randomUUID()]) }
      catch (e) { mismatch = /current annotation/.test((e as Error).message) }
      run.results.push({ name: 'deployment first: supply waits then rejects updated annotation', ok: blocked && mismatch, detail: 'separate connections, not a replay' })
    } finally { await tx.query('rollback'); tx.release(); edit.release() }
  }
  if (submitted) {
    // Execute the submitted documented order independently; roles already exist cluster-wide.
    await db.query('create database i2_submitted_order')
    const orderPool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'isolated', database: 'i2_submitted_order' })
    try {
      await orderPool.query(stub.replace('create role anon nologin; create role authenticated nologin;', ''))
      await orderPool.query(i1stub)
      for (const i of [0, 4, 1, 2]) await orderPool.query(layers[i])
      const old = (await orderPool.query(`select count(*)::int n from pg_proc where proname='content_qualification_record'`)).rows[0].n
      run.results.push({ name: 'submitted documented C/binding/B/S order leaves one writer', ok: old === 1, detail: `writer signatures=${old}` })
    } finally { await orderPool.end() }
  }
  const report = { schema: 'vf.factory-i2-independent-postgres/1', submitted, preLockFix,
    version: (await db.query('show server_version')).rows[0].server_version,
    sql: Object.fromEntries(files.map((f, i) => [f, createHash('sha256').update(layers[i]).digest('hex')])), jsonbOracle,
    results: run.results, pass: run.results.filter(r => r.ok).length, fail: run.results.filter(r => !r.ok).length }
  console.log(JSON.stringify(report, null, 2))
  if (process.argv.includes('--out')) fs.writeFileSync(path.resolve(arg('--out')), JSON.stringify(report, null, 2) + '\n')
  if (report.fail) process.exitCode = 1
} finally {
  db?.release()
  try { await pool.end() } finally {
    ctl(['-D', dir, '-m', 'fast', '-w', 'stop'])
    const resolved = path.resolve(dir)
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('vf-i2-annotation-')) fs.rmSync(resolved, { recursive: true })
    console.log('isolated PostgreSQL stopped; owned temporary cluster removed')
  }
}
