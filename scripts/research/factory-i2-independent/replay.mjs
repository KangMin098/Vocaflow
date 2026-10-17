// scripts/research/factory-i2-independent/replay.mjs
// Replays PR #281 offline inside this review worktree. Never runs SQL or changes product files.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '../../..')
const prefix = 'docs/research/factory-i2-r5-preflight-20261017/'
const script = 'scripts/research/factory-i2-r5-preflight/audit.mts'
const ref = 'b2edad0bcbd4680cd2136bf78222d1f93c488fc9'
const git = (...args) => execFileSync('git', args, { cwd: root })
const original = JSON.parse(git('show', ref + ':' + prefix + 'AUDIT.json'))
const files = [script, ...['db-snapshot.json', 'db-revisions.json'].map(p => prefix + p)]
const generated = prefix + 'AUDIT.json'
const sha = s => crypto.createHash('sha256').update(s).digest('hex')
const stable = o => Array.isArray(o) ? o.map(stable) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map(k => [k, stable(o[k])])) : o
const canonical = o => JSON.stringify(stable(o))
const saved = new Map()
for (const p of [...files, generated]) {
  const abs = path.join(root, p)
  if (!fs.existsSync(abs)) continue
  const bytes = fs.readFileSync(abs)
  assert.equal(sha(bytes), sha(git('show', ref + ':' + p)), 'Refuse to overwrite changed research evidence: ' + p)
  saved.set(p, bytes)
}
const ownDirs = new Set()
function ensure(dir) {
  if (fs.existsSync(dir)) return
  ensure(path.dirname(dir))
  fs.mkdirSync(dir)
  ownDirs.add(dir)
}
function run(i0Ref) {
  const stdout = execFileSync(process.execPath, ['--conditions=react-server', path.join(root, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', 'tsconfig.json', path.join(root, script), '--i0-ref', i0Ref], { cwd: path.join(root, 'apps/web'), encoding: 'utf8' })
  const bytes = fs.readFileSync(path.join(root, generated))
  return { report: JSON.parse(bytes), bytes, stdout }
}
try {
  for (const p of files) { ensure(path.dirname(path.join(root, p))); fs.writeFileSync(path.join(root, p), git('show', ref + ':' + p)) }
  const one = run(original.inputs.i0Head)
  const two = run(original.inputs.i0Head)
  assert.equal(sha(one.bytes), sha(two.bytes))
  // CLI ref spelling is provenance only; exact head and both resolver blob hashes must still match.
  one.report.inputs.i0Ref = original.inputs.i0Ref
  assert.equal(canonical(one.report), canonical(original))
  const latest = run('origin/pr-277')
  assert.equal(canonical(one.report.i0), canonical(latest.report.i0))
  const live = JSON.parse(fs.readFileSync(path.join(root, 'docs/research/factory-i2-independent-20261017/DB-REPLAY.json'), 'utf8'))
  const archived = JSON.parse(git('show', ref + ':' + prefix + 'db-snapshot.json'))
  assert.equal(canonical({ ...live.snapshot, measuredAt: null }), canonical({ ...archived, measuredAt: null }))
  assert.equal(canonical(live.revisions), canonical(JSON.parse(git('show', ref + ':' + prefix + 'db-revisions.json')).rows))
  fs.writeFileSync(path.join(root, prefix, 'db-snapshot.json'), JSON.stringify(live.snapshot, null, 2) + '\n')
  fs.writeFileSync(path.join(root, prefix, 'db-revisions.json'), JSON.stringify({ rows: live.revisions }, null, 2) + '\n')
  const fresh = run('origin/pr-277')
  const evidence = { schema: 'vf.factory-i2-independent-replay/1', pr281: ref,
    archivedInputs: original.inputs, archivedAuditSha256: sha(git('show', ref + ':' + prefix + 'AUDIT.json')),
    pinnedReplay: { head: two.report.inputs.i0Head, blobs: two.report.inputs.i0Blobs, firstSha256: sha(one.bytes), secondSha256: sha(two.bytes), equalIgnoringRefSpelling: true, failures: two.report.verdict.failures },
    latestReplay: { inputs: latest.report.inputs, sameI0Results: true, failures: latest.report.verdict.failures },
    freshReplay: { inputs: fresh.report.inputs, measuredAt: live.snapshot.measuredAt, snapshotEqualExceptTimestamp: true, revisionsEqual: true,
      byRole: fresh.report.byRole, i0: fresh.report.i0, verdict: fresh.report.verdict },
  }
  fs.writeFileSync(path.join(root, 'docs/research/factory-i2-independent-20261017/REPLAY.json'), JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify({ pinnedReplayEqual: true, stable: true, latestI0Equal: true, liveSnapshotEqualExceptTimestamp: true, revisionsEqual: true, failures: fresh.report.verdict.failures }))
} finally {
  // Restore existing research evidence byte-for-byte; remove only newly created files.
  for (const p of [...files, generated]) {
    if (saved.has(p)) fs.writeFileSync(path.join(root, p), saved.get(p))
    else if (fs.existsSync(path.join(root, p))) fs.unlinkSync(path.join(root, p))
  }
  for (const dir of [...ownDirs].reverse()) fs.rmdirSync(dir)
}
