// apps/web/scripts/final-independent/probe-plan-kst-asof.mjs
// Actual candidate currentAsOf with injected clocks; no network or database writes.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '../../../..')
const head = process.argv[2] ?? 'f8aa32239fc40b741116e5773dfb617992008bcd'
if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Expected frozen commit SHA')
const meta = JSON.parse(fs.readFileSync(path.join(root, '.agent-logs/final-independent/rework-snapshot.json'), 'utf8'))
const req = createRequire(path.join(root, 'apps/web/package.json'))
const { build } = createRequire(createRequire(req.resolve('vitest/package.json')).resolve('vite'))('esbuild')
const files = ['apps/web/src/lib/csat/map/v4/compose.ts', 'apps/web/src/lib/csat/map/v4/as-is.ts', 'apps/web/src/lib/csat/map/v4/definition.ts']
const sourceBindings = files.map(file => {
  const actual = execFileSync('git', ['show', head + ':' + file], { cwd: root })
  if (!actual.equals(fs.readFileSync(path.join(meta.snapshot, file)))) throw new Error('Snapshot source mismatch: ' + file)
  return { file, sha256: createHash('sha256').update(actual).digest('hex') }
})
const built = await build({ stdin: { contents: "export {currentAsOf} from './apps/web/src/lib/csat/map/v4/compose';export {asIsMap} from './apps/web/src/lib/csat/map/v4/as-is'", resolveDir: meta.snapshot, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', tsconfig: path.join(meta.snapshot, 'apps/web/tsconfig.json') })
const mod = { exports: {} }
new Function('require', 'module', 'exports', built.outputFiles[0].text)(req, mod, mod.exports)
const rows = [
  { id: 'kst-current-day-before-nine', now: '2026-10-18T23:47:30.000Z', enteredAt: '2026-10-18T23:47:29.000Z', takenAt: '2026-10-19', expectedGuard: 'allow' },
  { id: 'kst-day-start', now: '2026-10-18T15:05:00.000Z', enteredAt: '2026-10-18T15:04:59.000Z', takenAt: '2026-10-19', expectedGuard: 'allow' },
  { id: 'normal-after-nine', now: '2026-10-19T00:10:00.000Z', enteredAt: '2026-10-19T00:09:59.000Z', takenAt: '2026-10-19', expectedGuard: 'allow' },
  { id: 'normal-prior-day', now: '2026-10-18T23:47:30.000Z', enteredAt: '2026-10-18T23:47:29.000Z', takenAt: '2026-10-18', expectedGuard: 'allow' },
  { id: 'explicit-future-timestamp-remains-denied', now: '2026-10-18T23:47:30.000Z', enteredAt: '2026-10-19T00:00:00.000Z', takenAt: '2026-10-18', expectedGuard: 'deny' },
].map(row => {
  const actualAsOf = mod.exports.currentAsOf(row.now, [{ enteredAt: row.enteredAt, takenAt: row.takenAt }], [])
  const secondsAhead = (Date.parse(actualAsOf) - Date.parse(row.now)) / 1000
  const actualGuard = secondsAhead > 300 ? 'deny' : 'allow'
  const session = { id: 'synthetic-session', examId: 'SYNTHETIC', examLabel: 'Synthetic date record', enteredAt: row.enteredAt, takenAt: row.takenAt, raw: 70, grade: null, diagnosable: true, examReady: true }
  const atNow = mod.exports.asIsMap({ asOf: row.now, sessions: [session], axisProxy: null, checks: [], attempts: [] })
  const expectedRecordUsedAtNow = row.expectedGuard === 'allow'
  const actualRecordAtNow = { used: atNow.sessions[0].used, excluded: atNow.sessions[0].excluded }
  return { ...row, actualAsOf, secondsAhead, actualGuard, expectedRecordUsedAtNow, actualRecordAtNow, pass: actualGuard === row.expectedGuard && actualRecordAtNow.used === expectedRecordUsedAtNow }
})
const sqlFiles = ['supabase/migrations/20261010180218_map_v4_plan.sql', 'supabase/migrations/20261010181834_map_v4_plan_conflict_code.sql']
for (const file of sqlFiles) {
  const sql = execFileSync('git', ['show', head + ':' + file], { cwd: root, encoding: 'utf8' })
  if (!sql.includes("p_as_of > now() + interval '5 minutes'")) throw new Error('Rebind actual SQL future guard')
}
const report = { head, level: 'CODE_VERIFIED_COUNTEREXAMPLE', sourceBindings, sqlGuardSources: sqlFiles, rows, result: rows.every(row => row.pass) ? 'PASS' : 'REWORK', scope: 'Actual currentAsOf/asIsMap functions and exact existing SQL five-minute guard predicate. Injected clocks; no real learner data, network, database writes or actual SQL reexecution. Actual CI RPC422 is separately observed. asIsMap at injected now is the retention condition a fix must satisfy; original default instead advances asOf and triggers RPC rejection.' }
const filename = head === 'f8aa32239fc40b741116e5773dfb617992008bcd' ? 'plan-kst-asof-original.json' : `plan-kst-asof-${head.slice(0, 9)}.json`
fs.writeFileSync(path.join(root, 'docs/research/final-independent-20261018', filename), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ head, result: report.result, rows }))
