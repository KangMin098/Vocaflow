// scripts/csat/error-evidence/isolated-pg/run-detector.mjs
// G4 경계 감지기 검증 — 원래 마이그레이션 → 기존 흐름 데이터 → Pilot · 수집 지원 · Reveal Gate ①②②b → G2 기본 권한(새 함수 authenticated 기본 EXECUTE 없음)
// → 감지기(20261006120000) → 기존 테스트 전부(회귀 — 감지 트리거가 켜진 상태) + t_detector → results-detector.json
import fs from 'node:fs'
import path from 'node:path'
import { REPO, ROOT, record, results, startCluster } from './lib.mjs'
import { stage1 } from './stage1.mjs'

const MIG = (f) => path.join(REPO, 'supabase/migrations', f)
const BEFORE = ['20261005130000_csat_ec_pilot_evidence.sql', '20261005150000_csat_ec_capture_support.sql', '20261005170000_csat_ec_reveal_gate.sql',
  '20261005170100_csat_ec_reveal_gate_revoke.sql', '20261006110000_csat_ec_reveal_gate_revoke_residual.sql']
const DETECTOR = '20261006120000_csat_ec_boundary_detector.sql'
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
    let applied
    try {
      for (const f of BEFORE) await s.owner.query(fs.readFileSync(MIG(f), 'utf8'))
      // G2(20261006100000) 의 ④ — 운영 함수 전체를 다시 쓰는 생성물이라 격리 클러스터에는 그 한 줄만 옮긴다
      await s.owner.query(`alter default privileges in schema public revoke execute on functions from authenticated`)
      await s.owner.query(fs.readFileSync(MIG(DETECTOR), 'utf8'))
      applied = { ok: true }
    } catch (e) { applied = { ok: false, err: e.message, where: e.where } }
    record('detector 적용', 'Pilot · 수집 · Reveal Gate · 감지기 마이그레이션 적용(postgres 역할)', applied.ok, applied.err ? `${applied.err} @ ${applied.where ?? ''}` : '')
    if (applied.ok) {
      await lifecycle(s.admin, ctx)
      await (await import('./t_pilot.mjs')).default(s.admin, ctx)
      await (await import('./t_capture.mjs')).default(s.admin, ctx)
      await (await import('./t_reveal.mjs')).default(s.admin, ctx)
      await (await import('./t_detector.mjs')).default(s.admin, ctx)
      for (const mod of ['t_rls.mjs', 't_funcs.mjs', 't_rq1.mjs', 't_hash.mjs', 't_seal.mjs', 't_p1fix.mjs', 't_p2fix.mjs', 't_concurrency.mjs', 't_delete.mjs']) {
        const m = await import('./' + mod)
        await m.default(s.admin, ctx)
      }
    }
  }
} catch (e) {
  console.log('RUN ERROR', e.stack)
  record('detector 적용', '실행 오류 없이 끝남', false, e.message)
} finally {
  for (const p of pools) await p.end().catch(() => {})
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results-detector.json'), JSON.stringify(results, null, 1))
  const fail = results.filter((r) => !r.pass)
  process.exitCode = fail.length ? 1 : 0
  console.log(`\n합계 ${results.length} · 통과 ${results.length - fail.length} · 실패 ${fail.length}`)
  for (const f of fail) console.log('FAIL', f.area, '·', f.name, '—', JSON.stringify(f.detail).slice(0, 600))
}
