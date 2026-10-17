// scripts/db/factory-i1/independent.mjs
// DB286 independent counterexamples. All writes stay in disposable PostgreSQL 17 clusters.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
const exec = promisify(execFile)
const args = process.argv.slice(2)
const opt = (k) => args[args.indexOf(k) + 1]
const root = path.resolve(args.includes('--subject') ? opt('--subject') : path.resolve(import.meta.dirname, '../../..'))
const submitted = args.includes('--submitted')
const load = (p) => import(pathToFileURL(path.join(root, p)).href)
const { loadDeps, startCluster } = await load('scripts/db/factory-i1/isolated-db.mjs')
const { applyStage, targetOf, readPreflight, evaluatePreflight } = await load('scripts/db/factory-i1/deploy.mjs')
const { STAGES, PROJECT_REF } = await load('scripts/db/factory-i1/spec.mjs')
const { CATALOG_SQL } = await load('scripts/db/factory-i1/catalog.mjs')
const hash = (s) => createHash('sha256').update(s).digest('hex')
const text = fs.readFileSync(path.join(root, STAGES.db1.path), 'utf8'), sha = hash(text)
const deps = await loadDeps(opt('--deps'))
const cluster = await startCluster(deps)
const results = []
function check(id, name, fixed, detail) {
  const known = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'].includes(id)
  const ok = submitted && known ? !fixed : fixed
  results.push({ id, name, safe: !!fixed, expected: submitted && known ? 'reproduced' : 'safe', ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${name} ${JSON.stringify(detail)}`)
}
const history = async (db) => (await db.query('select version from supabase_migrations.schema_migrations order by version')).rows.map((r) => r.version)
const snap = async (db) => (await db.query(CATALOG_SQL)).rows.map((r) => `${r.k}:${r.name}=${r.fp}`).sort()
const run = async (db, opts = {}) => {
  const c = await db.connect()
  try { return await applyStage(c, 'db1', { text, sha, approvedBy: 'test metadata; no user approval', ...opts }) } finally { c.release() }
}
try {
  if (args.includes('--ci-prerequisites-only')) {
    const { prerequisiteSQL } = await load('scripts/ci/factory-i1-prerequisites.mjs')
    const db = await cluster.newDb('ind_ci_prerequisites')
    await db.query('create role service_role nologin')
    await db.query('drop function public.is_admin(); drop function public.csat_source_is_eligible(uuid)')
    await db.query('begin; ' + prerequisiteSQL + '; commit')
    let missingSourceRejected = false
    try { await db.query('select public.csat_source_is_eligible(gen_random_uuid())') } catch (e) { missingSourceRejected = e.code === '42P01' }
    const r = await run(db)
    check('N03', 'canonical CI helpers compile; absent article tables fail closed; unchanged DB-1 applies', missingSourceRejected && r.ok,
      { missingSourceRejected, applied: r.ok, error: r.error?.message })
    if (r.ok) {
      const c = await db.connect()
      let r2
      try {
        const uid = (await c.query("insert into auth.users values (gen_random_uuid()) returning id")).rows[0].id
        await c.query("insert into public.admins values ($1, 'admin')", [uid])
        await c.query("insert into public.csat_items (id,exam_id,no,stem,passage,choices,answer) values ('CI#1','CI',1,'s','p','[1]',1)")
        await c.query('begin')
        await c.query("select set_config('request.jwt.claim.sub', $1, true)", [uid])
        const rev = (await c.query("select public.supply_artifact_revision('csat_item','CI#1') r")).rows[0].r
        await c.query(`select public.content_qualification_record('FQ1.1','csat_item','CI#1',$1,'r.central_meaning','guided_practice',
          '{"A":{"state":"pass"},"B":{"state":"pass"},"C":{"state":"pass"},"D":{"state":"pass"},"E":{"state":"pass"},"F":{"state":"pass"},"G":{"state":"pass"},"H":{"state":"pass"}}'::jsonb,
          's', $2, null, 'g', $2, '{}', '{e}', 'm', null)`, [rev, 'a'.repeat(64)])
        await c.query('commit')
        const db2 = fs.readFileSync(path.join(root, STAGES.db2.path), 'utf8')
        r2 = await applyStage(c, 'db2', { text: db2, sha: hash(db2), approvedBy: 'isolated test' })
      } finally { c.release() }
      const count = (await db.query('select count(*)::int n from public.content_qualification')).rows[0].n
      check('N04', 'DB-2 accepts legitimate DB-1 ledger use and preserves rows', r2.ok && count === 1, { applied: r2.ok, count, error: r2.error?.message })
    }
  } else {
  {
    const url = `postgresql://postgres:x@db.${PROJECT_REF}.supabase.co:5432/postgres?host=127.0.0.1&port=${cluster.port}&sslmode=disable`
    const actual = new deps.pg.Client({ connectionString: url }).connectionParameters
    check('R01', 'URL query cannot override validated target/TLS', !targetOf(url).ok,
      { validatorAccepted: targetOf(url).ok, driverHost: actual.host, driverPort: actual.port, driverSsl: actual.ssl })
  }
  {
    const db = await cluster.newDb('ind_auto')
    const before = await snap(db)
    let status
    try {
      await exec(process.execPath, [path.join(root, 'scripts/db/factory-i1/deploy.mjs'), 'apply', '--stage', 'db1', '--deps', opt('--deps'),
        '--isolated', '--confirm-sha', sha, '--approved-by', 'arbitrary text is not approval'],
      { cwd: root, env: { ...process.env, VFC_AUTOMATED_RUN: '1', AGENT_GUARD_ASK: '0', VF_DEPLOY_DB_URL: `postgresql://postgres:pw@localhost:${cluster.port}/ind_auto` } })
      status = 0
    } catch (e) { status = e.code }
    const wrote = (await history(db)).includes(STAGES.db1.version)
    check('R02', 'auto + arbitrary approval + isolated CLI cannot write', status === 2 && !wrote && JSON.stringify(before) === JSON.stringify(await snap(db)), { status, wrote })
  }
  {
    const db = await cluster.newDb('ind_helper')
    await db.query(`create function public.ind_helper_event() returns event_trigger language plpgsql as $$ begin
      if exists (select 1 from pg_event_trigger_ddl_commands() where object_identity = 'public.factory_order') then
        execute 'create or replace function public.is_admin() returns boolean language sql security definer set search_path to public as ''select true''';
      end if;
    end $$;
    create event trigger ind_helper_event on ddl_command_end when tag in ('CREATE TABLE') execute function public.ind_helper_event();`)
    const before = await snap(db)
    const r = await run(db)
    const unconditional = (await db.query("select prosrc = 'select true' bad from pg_proc where oid = 'public.is_admin()'::regprocedure")).rows[0].bad
    check('R03', 'allowlisted helper may change search_path only, even via event trigger', !r.ok && !unconditional && JSON.stringify(before) === JSON.stringify(await snap(db)),
      { applied: r.ok, unconditionalAdmin: unconditional, error: r.error?.message })
  }
  {
    const db = await cluster.newDb('ind_ack')
    const c = await db.connect()
    const proxy = { on: (...a) => c.on(...a), off: (...a) => c.off(...a), query: async (...a) => {
      const r = await c.query(...a)
      if (a[0] === 'commit') throw Object.assign(new Error('simulated lost COMMIT acknowledgement'), { code: 'ECONNRESET' })
      return r
    } }
    let r
    try { r = await applyStage(proxy, 'db1', { text, sha, approvedBy: 'test' }) } finally { c.release() }
    const committed = (await history(db)).includes(STAGES.db1.version)
    check('R04', 'lost COMMIT acknowledgement is UNKNOWN, never rollback success', !r.ok && r.outcome === 'unknown' && committed,
      { committed, returned: r })
  }
  {
    const db = await cluster.newDb('ind_history')
    const c = await db.connect()
    const pre = await readPreflight(c)
    c.release()
    const beforeBlocks = evaluatePreflight('db1', pre)
    await db.query("insert into supabase_migrations.schema_migrations (version,name) values ('20261016000000','unreviewed_concurrent_history')")
    const r = await run(db)
    check('R05', 'history is rechecked inside the locked apply transaction', beforeBlocks.length === 0 && !r.ok && !(await history(db)).includes(STAGES.db1.version),
      { beforeBlocks, applied: r.ok, error: r.error?.message })
  }
  {
    const db = await cluster.newDb('ind_db2_verify')
    await run(db)
    await db.query('grant execute on function public.supply_learner_exposure(text,text,uuid) to authenticated')
    const db2 = fs.readFileSync(path.join(root, STAGES.db2.path), 'utf8')
    const c = await db.connect()
    let r
    try { r = await applyStage(c, 'db2', { text: db2, sha: hash(db2), approvedBy: 'test' }) } finally { c.release() }
    check('R06', 'DB-2 needs live DB-1 verification, not a forgeable JSON ok flag', !r.ok && !(await history(db)).includes(STAGES.db2.version),
      { applied: r.ok, error: r.error?.message })
  }
  {
    const db = await cluster.newDb('ind_ddl')
    const c = await db.connect()
    const before = await history(db)
    const cut = text.indexOf('-- <<< VF-SEGMENT C')
    const proxy = { on: (...a) => c.on(...a), off: (...a) => c.off(...a), query: async (...a) => {
      if (a[0] !== text) return c.query(...a)
      await c.query(text.slice(0, cut))
      await db.query('create table public.ind_concurrent_ddl (x int)')
      return c.query(text.slice(cut))
    } }
    let r
    try { r = await applyStage(proxy, 'db1', { text, sha, approvedBy: 'test' }) } finally { c.release() }
    check('N01', 'concurrent committed DDL is rejected; foreign transaction persists', !r.ok && r.error.message.includes('[allowlist]')
      && JSON.stringify(before) === JSON.stringify(await history(db)) && (await db.query("select to_regclass('public.ind_concurrent_ddl') is not null present")).rows[0].present,
    { applied: r.ok, error: r.error?.message })
  }
  {
    const db = await cluster.newDb('ind_lock')
    const before = await snap(db)
    const blocker = await db.connect(), c = await db.connect()
    const proxy = { on: (...a) => c.on(...a), off: (...a) => c.off(...a), query: async (...a) => {
      if (a[0] === text) {
        // Compatible with preflight's AccessShareLock, but conflicts with the migration's ALTER TABLE.
        await blocker.query('begin; lock table public.learner_workspace in share row exclusive mode')
      }
      return c.query(...a)
    } }
    let r
    try { r = await applyStage(proxy, 'db1', { text, sha, approvedBy: 'test' }) }
    finally { await blocker.query('rollback'); blocker.release(); c.release() }
    check('N02', 'lock acquired after preflight hits real 15s timeout and rolls back', !r.ok && r.error?.code === '55P03'
      && JSON.stringify(before) === JSON.stringify(await snap(db)) && !(await history(db)).includes(STAGES.db1.version), { error: r.error })
  }
  }
} finally { await cluster.stop() }
const report = { subject: submitted ? '3d4f773d8d134923c92518a8ab5c80951c81f77e' : 'working-tree', server_version: cluster.version,
  db1_sha256: sha, submitted, total: results.length, pass: results.filter((r) => r.ok).length, results }
if (args.includes('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(report, null, 2) + '\n')
console.log(`${report.pass}/${report.total} expected outcomes; development DB writes=0`)
process.exit(report.results.every((r) => r.ok) ? 0 : 1)
