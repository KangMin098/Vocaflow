// scripts/csat/error-evidence/isolated-pg/run.mjs
// 전체 실행 — 새 클러스터 · 적용 · 테스트 · 결과 JSON
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, results, startCluster } from './lib.mjs'
import { stage1 } from './stage1.mjs'

const only = process.argv.slice(2)
const server = await startCluster()
const pools = []
try {
  const s = await stage1()
  pools.push(s.admin, s.owner)
  if (s.ok) {
    const { prepare, flow, lifecycle } = await import('./t_flow.mjs')
    const ctx = await prepare(s.admin)
    pools.push(ctx.owner, ctx.app)
    ctx.post = s.post
    await flow(s.admin, ctx)
    await lifecycle(s.admin, ctx)
    for (const mod of ['t_rls.mjs', 't_funcs.mjs', 't_rq1.mjs', 't_hash.mjs', 't_seal.mjs', 't_p1fix.mjs', 't_p2fix.mjs', 't_concurrency.mjs', 't_delete.mjs']) {
      if (only.length && !only.includes(mod)) continue
      if (!fs.existsSync(path.join(ROOT, mod))) continue
      const m = await import('./' + mod)
      await m.default(s.admin, ctx)
    }
  }
} catch (e) {
  console.log('RUN ERROR', e.stack)
} finally {
  for (const p of pools) await p.end().catch(() => {})
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results.json'), JSON.stringify(results, null, 1))
  const fail = results.filter((r) => !r.pass)
  console.log(`\n합계 ${results.length} · 통과 ${results.length - fail.length} · 실패 ${fail.length}`)
}
