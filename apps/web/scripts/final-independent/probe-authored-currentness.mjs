// apps/web/scripts/final-independent/probe-authored-currentness.mjs
// Frozen owner server + its synthetic PGlite harness; no env files or live DB writes.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
const root = path.resolve(import.meta.dirname, '../../../..')
const sha = '52a31d988'
const run = fs.mkdtempSync(path.join(root, '.agent-logs/final-independent/currentness-'))
const archive = path.join(run, 'source.tar')
const snapshot = path.join(run, 'snapshot')
fs.mkdirSync(snapshot)
execFileSync('git', ['archive', sha, '--format=tar', '--output=' + archive, 'apps/web/src', 'apps/web/scripts', 'apps/web/package.json', 'apps/web/vitest.config.ts', 'apps/web/tsconfig.json', 'packages', 'supabase', 'docs/final', 'scripts/csat', 'package.json', 'pnpm-workspace.yaml'], { cwd: root, windowsHide: true })
execFileSync('tar.exe', ['-xf', archive, '-C', snapshot], { windowsHide: true })
fs.symlinkSync(path.join(root, 'node_modules'), path.join(snapshot, 'node_modules'), 'junction')
fs.symlinkSync(path.join(root, 'apps/web/node_modules'), path.join(snapshot, 'apps/web/node_modules'), 'junction')
const test = 'src/lib/csat/authored/__tests__/authored-flow.pglite.test.ts'
const extra = `
describe('Independent Codex: revocation after delivery', () => {
  it('captures actual currentness and the server response', async () => {
    await db.exec('begin')
    try {
      const target = ref('r5-cm-ind-1')
      const decision = await q1<{ id: string }>(\`select id from public.content_human_decision where artifact_ref = $1 and kind = 'rights'\`, [target])
      await (admin as unknown as FakeClient).auth()
      await db.query(\`select public.content_human_decision_revoke($1, 'Independent synthetic revocation')\`, [decision.id])
      const current = await q1<{ valid: boolean; historical_evidence: boolean }>(\`select public.supply_delivery_valid(d.id) valid, a.evidence historical_evidence from public.workspace_content_delivery d join public.workspace_delivery_attempt a on a.delivery_id = d.id where d.user_id = $1 and d.artifact_ref = $2\`, [A, target])
      const opened = await openDelivered(admin, learner(A), A, target)
      const supplied = await supply(A, 'check', 2)
      const listed = await listDelivered(learner(A), A, TASK)
      console.log('INDEPENDENT_REVOKED_DELIVERY=' + JSON.stringify({ current, openStatus: opened.status, delivered: supplied.status === 'ok' ? supplied.lines[0] : supplied, listed: Array.isArray(listed) ? listed.find(r => r.ref === target) : listed }))
      expect(current.valid).toBe(false)
      // Assertions describe the observed defect, not the intended secure behavior.
      expect(opened.status).toBe('ok')
      if (supplied.status !== 'ok') throw new Error('supply')
      expect(supplied.lines[0].delivered).toContain(target)
      expect(supplied.lines[0].orderOpened).toBe(false)
      expect(Array.isArray(listed) && listed.find(r => r.ref === target)?.evidence).toBe(true)
    } finally { await db.exec('rollback') }
  })
})
`
fs.appendFileSync(path.join(snapshot, 'apps/web', test), extra)
const vitest = path.join(root, 'apps/web/node_modules/vitest/vitest.mjs')
const result = spawnSync(process.execPath, [vitest, 'run', test], { cwd: path.join(snapshot, 'apps/web'), encoding: 'utf8', windowsHide: true, env: { ...process.env, NODE_OPTIONS: '--require=' + path.join(root, 'scripts/csat/map/v62/r5-read-only-preload.cjs') }, maxBuffer: 4 * 1024 * 1024 })
const output = [result.stdout ?? '', result.stderr ?? ''].join('\n').replace(/\u001b\[[0-9;]*m/g, '')
fs.writeFileSync(path.join(root, 'docs/research/final-independent-20261018/authored-currentness.log'), 'Frozen owner commit: ' + sha + '\nScope: isolated synthetic PGlite; actual server functions; no live DB writes.\n' + output)
process.stdout.write(output)
process.exitCode = result.status ?? 1
