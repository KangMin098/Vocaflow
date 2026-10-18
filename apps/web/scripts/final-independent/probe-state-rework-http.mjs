// apps/web/scripts/final-independent/probe-state-rework-http.mjs
// Actual frozen state API over local HTTP and PostgreSQL; synthetic auth/gate, no dev DB.
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'

const root = path.resolve(import.meta.dirname, '../../../..')
const meta = JSON.parse(fs.readFileSync(path.join(root, '.agent-logs/final-independent/rework-snapshot.json'), 'utf8'))
const req = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const pgReq = createRequire(path.join(root, '.agent-logs/final-independent/pg-deps/package.json'))
const EmbeddedPostgres = pgReq('embedded-postgres').default, { Pool } = pgReq('pg')
export const NOW = Date.parse('2026-10-18T10:00:00Z')
const USER = 'synthetic-state-learner'

export async function stateHarness(gate = async () => ({ held: new Set(), failed: false })) {
  const directory = fs.mkdtempSync(path.join(root, '.agent-logs/final-independent/pg-state-rework-'))
  const listener = http.createServer()
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
  const pgPort = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const server = new EmbeddedPostgres({ databaseDir: directory, user: 'postgres', password: 'isolated', port: pgPort, persistent: true, onLog: () => {}, onError: () => {} })
  const binary = path.join(root, '.agent-logs/final-independent/pg-deps/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe')
  await server.initialise()
  execFileSync(binary, ['-D', directory, '-o', `-p ${pgPort} -h 127.0.0.1`, '-w', 'start'], { windowsHide: true, stdio: 'ignore' })
  const pool = new Pool({ host: '127.0.0.1', port: pgPort, user: 'postgres', password: 'isolated', database: 'postgres', max: 8 })
  await pool.query('create table csat_learner_state(user_id text primary key, record jsonb, updated_at timestamptz)')
  const context = new AsyncLocalStorage()
  const fixture = { barrier: false, reads: 0, ready: Promise.resolve(), release: () => {}, forceConflicts: false, updates: 0, dropResponse: false, gate, context, assets: new Map(), httpStatuses: [] }
  const admin = { from: table => {
    assert.equal(table, 'csat_learner_state')
    return {
      select: () => ({ eq: (column, user) => {
        assert.equal(column, 'user_id')
        return { maybeSingle: async () => {
          const result = await pool.query('select record, updated_at::text as updated_at from csat_learner_state where user_id=$1', [user])
          if (fixture.barrier) { fixture.reads++; if (fixture.reads === 2) fixture.release(); await fixture.ready }
          return { data: result.rows[0] ?? null, error: null }
        } }
      } }),
      insert: async row => {
        try { await pool.query('insert into csat_learner_state values($1,$2::jsonb,$3)', [row.user_id, JSON.stringify(row.record), row.updated_at]); return { error: null } }
        catch (error) { return { error: { code: error.code, message: error.message } } }
      },
      update: patch => {
        const conditions = new Map()
        const chain = { eq: (key, value) => { conditions.set(key, value); return chain }, is: (key, value) => { assert.equal(value, null); conditions.set(key, null); return chain }, select: async () => {
          fixture.updates++
          if (fixture.forceConflicts) return { data: [], error: null }
          assert.ok(conditions.has('user_id') && conditions.has('updated_at'))
          const at = conditions.get('updated_at')
          const result = await pool.query('update csat_learner_state set record=$2::jsonb,updated_at=$3 where user_id=$1 and ' + (at === null ? 'updated_at is null' : 'updated_at=$4::timestamptz') + ' returning user_id', at === null ? [conditions.get('user_id'), JSON.stringify(patch.record), patch.updated_at] : [conditions.get('user_id'), JSON.stringify(patch.record), patch.updated_at, at])
          return { data: result.rows, error: null }
        } }
        return chain
      },
    }
  } }
  fixture.admin = admin
  const priorGlobal = globalThis.__vocaflowStateRework
  globalThis.__vocaflowStateRework = fixture
  const stubs = {
    '@/lib/supabase/admin': 'export const createAdminClient=()=>globalThis.__vocaflowStateRework.admin',
    '@/lib/supabase/server': 'export const createClient=async()=>({auth:{getUser:async()=>({data:{user:globalThis.__vocaflowStateRework.context.getStore()?.user??null}})}})',
    '@/lib/csat/embargo-gate': 'export const itemRevealDecision=(ids)=>globalThis.__vocaflowStateRework.gate(ids);export const revealHeldResponse=()=>new Response(JSON.stringify({held:true}),{status:423})',
    'server-only': 'export {}',
  }
  const built = await build({ stdin: { contents: "export {GET,PUT} from './apps/web/src/app/api/csat/state/route';export {withView} from './apps/web/src/lib/csat/continuity';export {writeMeaningNote,reviseMeaningNote} from './apps/web/src/lib/csat/meaning-note'", resolveDir: meta.snapshot, loader: 'ts' }, bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs', tsconfig: path.join(meta.snapshot, 'apps/web/tsconfig.json'), plugins: [{ name: 'isolated-transports', setup(b) {
    for (const name of Object.keys(stubs)) b.onResolve({ filter: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }, () => ({ path: name, namespace: 'fixture' }))
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'ts' }))
  } }] })
  const mod = { exports: {} }
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [NOW])) } static now() { return NOW } }
  new Function('require', 'module', 'exports', 'Date', built.outputFiles[0].text)(req, mod, mod.exports, FixedDate)
  const api = mod.exports
  const httpServer = http.createServer((request, response) => {
    if (fixture.assets.has(request.url)) { const asset = fixture.assets.get(request.url); response.writeHead(200, { 'content-type': asset.type }); response.end(asset.body); return }
    context.run({ user: request.headers['x-fixture-user'] === 'none' ? null : { id: USER } }, async () => {
      try {
        const chunks = []; for await (const chunk of request) chunks.push(chunk)
        const value = request.method === 'PUT' ? await api.PUT(new Request('http://isolated.test/api/csat/state', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks).toString() })) : await api.GET()
        fixture.httpStatuses.push({ method: request.method, status: value.status })
        if (fixture.dropResponse && request.method === 'PUT' && value.status === 200) { fixture.dropResponse = false; request.socket.destroy(); return }
        response.writeHead(value.status, Object.fromEntries(value.headers)); response.end(Buffer.from(await value.arrayBuffer()))
      } catch (error) { response.writeHead(500); response.end(JSON.stringify({ fixtureError: error.message })) }
    })
  })
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve))
  const base = 'http://127.0.0.1:' + httpServer.address().port
  const put = (record, device = 'tab-one', unauthenticated = false) => fetch(base, { method: 'PUT', headers: { 'content-type': 'application/json', 'user-agent': device, ...(unauthenticated ? { 'x-fixture-user': 'none' } : {}) }, body: JSON.stringify({ record }) })
  const get = async () => { const response = await fetch(base); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); return (await response.json()).record }
  const beginBarrier = () => { fixture.reads = 0; fixture.ready = new Promise(resolve => { fixture.release = resolve }); fixture.barrier = true }
  const close = async () => {
    await new Promise(resolve => httpServer.close(resolve)); await pool.end()
    execFileSync(binary, ['-D', directory, '-m', 'fast', '-w', 'stop'], { windowsHide: true, stdio: 'ignore' })
    assert.equal(fs.existsSync(path.join(directory, 'postmaster.pid')), false)
    globalThis.__vocaflowStateRework = priorGlobal
  }
  return { api, pool, fixture, put, get, beginBarrier, close, USER, base }
}

async function main() {
  const h = await stateHarness(), rows = []
  const binding = { analysisVersion: 1, contentHash: 'aaaaaaaaaaaaaaaa' }
  const make = (unitId, at = NOW) => h.api.withView({ version: 1, seed: 1, onboarded: true, predictions: [], formulas: [], queue: [], completed: [], meaningNotes: [h.api.writeMeaningNote(null, { item: 'SYNTHETIC#1', unitId, text: 'Synthetic first explanation ' + unitId, binding }, at)], updatedAt: at }, 'SYNTHETIC#1', at)
  const check = (id, value) => { assert.ok(value, id); rows.push({ id, pass: true }) }
  try {
    const initial = make('unit-zero'); initial.completed = [{ id: 'synthetic-history', at: NOW - 100 }]
    check('initial-save', (await h.put(initial)).status === 200)
    h.beginBarrier()
    const concurrent = await Promise.all([h.put(make('unit-one'), 'tab-one'), h.put(make('unit-two'), 'other-device')])
    h.fixture.barrier = false
    check('concurrent-save-first-ack-and-conflict-are-honest', concurrent.map(r => r.status).sort().join(',') === '200,409' && h.fixture.reads >= 2 && (await h.get()).meaningNotes.length === 2)
    for (const [i, response] of concurrent.entries()) if (response.status === 409) assert.equal((await h.put(make(i === 0 ? 'unit-one' : 'unit-two'))).status, 200)
    const saved = await h.get()
    check('different-notes-after-retry-both-preserved', saved.meaningNotes.length === 3)
    const revise = at => { const record = structuredClone(saved); record.updatedAt = at; record.meaningNotes[0] = h.api.reviseMeaningNote(record.meaningNotes[0], { text: 'Synthetic revised explanation ' + at, binding }, at); return record }
    h.beginBarrier()
    const edits = await Promise.all([h.put(revise(NOW + 10), 'tab-one'), h.put(revise(NOW + 20), 'other-device')])
    h.fixture.barrier = false
    check('same-note-first-ack-and-conflict-are-honest', edits.map(r => r.status).sort().join(',') === '200,409')
    for (const [i, response] of edits.entries()) if (response.status === 409) assert.equal((await h.put(revise(NOW + (i === 0 ? 10 : 20)))).status, 200)
    const edited = await h.get(), note = edited.meaningNotes.find(n => n.unitId === 'unit-zero')
    check('same-note-newer-revision-preserves-first-and-old-history', note.first === initial.meaningNotes[0].first && note.revised.endsWith(String(NOW + 20)) && edited.completed.some(c => c.id === 'synthetic-history'))
    h.fixture.dropResponse = true
    let lost = false; try { await h.put(make('unit-three'), 'other-device') } catch { lost = true }
    check('response-lost-after-server-commit', lost && (await h.get()).meaningNotes.some(n => n.unitId === 'unit-three'))
    check('same-packet-retry-no-duplicate', (await h.put(make('unit-three'))).status === 200 && (await h.get()).meaningNotes.filter(n => n.unitId === 'unit-three').length === 1)
    check('older-packet-does-not-erase-revision-or-historical-record', (await h.put(initial)).status === 200 && (await h.get()).meaningNotes.find(n => n.unitId === 'unit-zero').revised === note.revised)
    assert.deepEqual(await h.get(), await h.get()); check('fresh-get-consistency', true)
    await h.pool.query('update csat_learner_state set updated_at=null where user_id=$1', [h.USER])
    check('legacy-null-cas', (await h.put(make('unit-four'))).status === 200)
    await h.pool.query("update csat_learner_state set updated_at='2026-10-18T10:00:00.123456Z' where user_id=$1", [h.USER])
    check('legacy-microsecond-cas', (await h.put(make('unit-five'))).status === 200)
    h.fixture.forceConflicts = true; h.fixture.updates = 0
    const conflict = await h.put(make('unit-not-acknowledged')); h.fixture.forceConflicts = false
    check('single-cas-conflict-return409-without-false-ack', conflict.status === 409 && h.fixture.updates === 1 && !(await h.get()).meaningNotes.some(n => n.unitId === 'unit-not-acknowledged'))
    check('unauthenticated-put-rejected', (await h.put(make('denied'), 'tab-one', true)).status === 401)
    const report = { head: meta.head, pr250: meta.pr250, level: 'ISOLATED_DB_VERIFIED', transport: 'actual frozen PUT/GET served over local HTTP + PostgreSQL17.10 pool; forced concurrent reads', rows, scope: 'Synthetic identity and Reveal Gate adapters; actual route/merge/meaning-note source. Different user-agent clients simulate tabs/devices. Manual conflict retry validates API contract; actual browser store retry is separate. No actual dev DB/JWT/Gold approval or learner effect.', sameNoteContract: 'Latest updatedAt revision wins; original first text and unrelated completed records preserved. Does not assert retention of every intermediate edit.', sourceHashes: ['apps/web/src/app/api/csat/state/route.ts', 'apps/web/src/lib/csat/continuity.ts', 'apps/web/src/lib/csat/meaning-note.ts'].map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(path.join(meta.snapshot, file))).digest('hex') })) }
    fs.writeFileSync(path.join(root, 'docs/research/final-independent-20261018/state-rework-http.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ head: meta.head, checks: rows.length, allPassed: rows.every(r => r.pass) }))
  } finally { await h.close() }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
