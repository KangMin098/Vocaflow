// scripts/research/v2-f1/acceptance-browser.mjs
// Permanent F1 acceptance runner: accepted T1–T4/Workspace/PLAN specs, source binding and owned cleanup.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { browserJobs, renderBrowserRunner } from '../lm-g1-5a-independent/runner-contract.mjs'
import { productHashes, assertSameManifest } from '../lm-g1-5a-independent/binding.mjs'
import { cleanupOwnedAccounts } from '../lm-g1-1-independent/cleanup.mjs'
import { stopOwnedServer } from '../lm-g1-3a-independent/owned-server.mjs'

const root = path.resolve(import.meta.dirname, '../../..'), web = root + '/apps/web'
const req = createRequire(web + '/package.json'), { createClient } = req('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const folder = path.resolve(root, process.argv[2] ?? 'tmp/v2-f1-browser')
if (fs.existsSync(folder + '/summary.json')) throw Error('Immutable evidence already exists')
fs.mkdirSync(folder, { recursive: true })
const base = 'http://localhost:3014', manifest = productHashes(root)
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
fs.writeFileSync(folder + '/source-hashes.json', JSON.stringify(manifest, null, 2))
const expected = { 'v2-1280': 6, 'v2-1440': 6, 't4-1280': 14, 't4-1440': 14, t1: 9, 't2-1280': 26, 't2-1440': 26, 't3-1280': 20, 't3-1440': 20, security: 18, workspace: 36, return: 7, study: 6, supply: 6 }
const jobs = browserJobs(base, folder)
const rows = []
let server = null
try {
  try { await fetch(base + '/login', { signal: AbortSignal.timeout(2000) }); throw Error('Verification port is already in use') }
  catch (e) { if (e.message === 'Verification port is already in use') throw e }
  const stdout = fs.openSync(folder + '/server.log', 'a'), stderr = fs.openSync(folder + '/server-error.log', 'a')
  server = spawn(process.execPath, ['--max-old-space-size=2048', '--tls-max-v1.2', req.resolve('next/dist/bin/next'), 'dev', '-p', '3014'], { cwd: web, env: { ...process.env, NEXT_DIST_DIR: '.next-f1-review' }, windowsHide: true, stdio: ['ignore', stdout, stderr] })
  fs.closeSync(stdout); fs.closeSync(stderr)
  let ready = false
  for (let n = 0; n < 300; n++) {
    if (server.exitCode !== null) throw Error('Owned server exited before readiness')
    try { if ((await fetch(base + '/login', { signal: AbortSignal.timeout(3000) })).status === 200) { ready = true; break } } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  if (!ready) throw Error('Owned server readiness timeout')
  for (const [name, file, args] of jobs) {
    assertSameManifest(productHashes(root), manifest)
    const out = folder + '/' + name, startedAt = new Date().toISOString()
    fs.mkdirSync(out, { recursive: true })
    const source = renderBrowserRunner({ root, file, folder: out, at: startedAt })
    fs.writeFileSync(out + '/runner.mjs', source)
    const r = spawnSync(process.execPath, ['--tls-max-v1.2', out + '/runner.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 900000, maxBuffer: 16 << 20, windowsHide: true })
    const log = ((r.stdout ?? '') + '\n' + (r.stderr ?? '')).replace(/^.*(?:cookie|authorization):[^\r\n]*/gim, '[redacted header]').replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+/g, '[redacted token]')
    fs.writeFileSync(out + '/run.log', log)
    const ids = fs.existsSync(out + '/owned-accounts.local.json') ? JSON.parse(fs.readFileSync(out + '/owned-accounts.local.json', 'utf8')) : []
    // Each spec normally already deleted its accounts. Never treat an unknown lookup as absence.
    const present = []
    let unknown = 0
    for (const id of ids) {
      const g = await db.auth.admin.getUserById(id)
      if (g.error?.status === 404 && g.error?.code === 'user_not_found') continue
      if (g.data?.user && !g.error) present.push(id)
      else unknown++
    }
    const cleanup = await cleanupOwnedAccounts(db.auth.admin, present)
    if (unknown) { cleanup.ok = false; cleanup.unknown += unknown; cleanup.accountsLeft = null; cleanup.errors.push('initial_absence_unconfirmed') }
    const pass = log.split(/\r?\n/).filter(l => /^\[PASS\]|^PASS (?!\d)/.test(l)).length
    const fail = log.split(/\r?\n/).filter(l => /^\[FAIL\]|^FAIL /.test(l)).length
    let sourceStable = true
    try { assertSameManifest(productHashes(root), manifest) } catch { sourceStable = false }
    const row = { name, head, startedAt, exit: r.status, error: r.error?.message ?? null, pass, expected: expected[name], fail, sourceStable, cleanup, ok: r.status === 0 && pass === expected[name] && fail === 0 && sourceStable && cleanup.ok }
    rows.push(row); fs.writeFileSync(folder + '/summary.json', JSON.stringify(rows, null, 2)); console.log(JSON.stringify(row))
    if (!row.ok) break
  }
  process.exitCode = rows.length === jobs.length && rows.every(r => r.ok) ? 0 : 1
} finally {
  fs.writeFileSync(folder + '/server-cleanup.json', JSON.stringify(await stopOwnedServer(server)))
}
