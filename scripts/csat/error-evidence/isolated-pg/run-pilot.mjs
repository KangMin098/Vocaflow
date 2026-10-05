// scripts/csat/error-evidence/isolated-pg/run-pilot.mjs
// Pilot 마이그레이션 검증 — 기존 마이그레이션 적용 → 기존 흐름으로 데이터 생성 → Pilot 마이그레이션 적용(기존 행 · 해시 · 무결성 보존 확인)
// → 기존 테스트 전부(회귀) → t_pilot → results-pilot.json
import fs from 'node:fs'
import path from 'node:path'
import { REPO, ROOT, record, results, startCluster } from './lib.mjs'
import { stage1 } from './stage1.mjs'

const PILOT = path.join(REPO, 'supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql')
const CAPTURE = path.join(REPO, 'supabase/migrations/20261005150000_csat_ec_capture_support.sql')
const REVEAL = path.join(REPO, 'supabase/migrations/20261005170000_csat_ec_reveal_gate.sql')
const REVOKE = path.join(REPO, 'supabase/migrations/20261005170100_csat_ec_reveal_gate_revoke.sql')
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
    await flow(s.admin, ctx)   // 데이터: 봉인 taxonomy v9.0 · draft 회차 · AI 실행 · claim · 과정 증거

    // 적용 전 스냅샷 — 기존 행 전부(표별 정렬 jsonb 의 md5) · 봉인 해시 · 회차 대상 해시 · 무결성
    const tables = ['csat_ec_taxonomy_version', 'csat_ec_code', 'csat_ec_ai_run', 'csat_ec_claim', 'csat_ec_review_round', 'csat_ec_review_assignment',
      'csat_ec_judgment', 'csat_ec_session_confirmation', 'csat_ec_process_evidence']
    const snap = async (cols) => Object.fromEntries(await Promise.all(tables.map(async (t) => [t,
      (await s.admin.query(`select md5(coalesce(string_agg((to_jsonb(x) - $1::text[])::text, chr(10) order by (to_jsonb(x) - $1::text[])::text), '')) h, count(*) n from public.${t} x`, [cols])).rows[0]])))
    const before = await snap([])
    const intactBefore = (await s.admin.query(`select public.csat_ec_round_inputs_intact($1) ok, (select targets_hash from public.csat_ec_review_round where id = $1) th`, [ctx.round])).rows[0]
    const hashBefore = (await s.admin.query(`select public.csat_ec_judgment_input_hash(session_id, item_no) h from public.csat_ec_ai_run order by id`)).rows.map((r) => r.h)

    let applied
    try { await s.owner.query(fs.readFileSync(PILOT, 'utf8')); await s.owner.query(fs.readFileSync(CAPTURE, 'utf8')); await s.owner.query(fs.readFileSync(REVEAL, 'utf8')); await s.owner.query(fs.readFileSync(REVOKE, 'utf8')); applied = { ok: true } } catch (e) { applied = { ok: false, err: e.message, where: e.where } }
    record('pilot 적용', 'Pilot · 증거 수집 마이그레이션 적용(postgres 역할)', applied.ok, applied.err ?? '')
    if (applied.ok) {
      // 새 컬럼(candidate_codes · evidence_profile)은 기본값이 붙는다 — 그 컬럼을 뺀 나머지가 같아야 한다
      const after = await snap(['candidate_codes', 'evidence_profile'])
      const diff = tables.filter((t) => before[t].h !== after[t].h || before[t].n !== after[t].n)
      record('pilot 적용', '기존 행 보존(새 기본값 컬럼 제외 전부 같음)', diff.length === 0, diff)
      const defaults = (await s.admin.query(`select (select count(*) from public.csat_ec_judgment where candidate_codes <> '{}') j, (select count(*) from public.csat_ec_review_round where evidence_profile <> 'all') r`)).rows[0]
      record('pilot 적용', "기존 행의 새 컬럼 = 기본값('{}' · 'all')", Number(defaults.j) === 0 && Number(defaults.r) === 0, defaults)
      const intactAfter = (await s.admin.query(`select public.csat_ec_round_inputs_intact($1) ok, (select targets_hash from public.csat_ec_review_round where id = $1) th`, [ctx.round])).rows[0]
      record('pilot 적용', '기존 draft 회차 — 무결성 · 대상 해시 그대로', intactBefore.ok === intactAfter.ok && intactBefore.th === intactAfter.th, { intactBefore, intactAfter })
      const hashAfter = (await s.admin.query(`select public.csat_ec_judgment_input_hash(session_id, item_no) h from public.csat_ec_ai_run order by id`)).rows.map((r) => r.h)
      record('pilot 적용', '판정 입력 해시(기존 AI 실행 응답) 바이트 동일', JSON.stringify(hashBefore) === JSON.stringify(hashAfter), hashBefore.length)

      await lifecycle(s.admin, ctx)   // 기존 수명주기 — 새 함수 본문으로 회귀
      // t_pilot 은 기록을 지우는 테스트(t_concurrency · t_delete)보다 먼저 — 같은 학습자 · 관리자를 쓴다
      await (await import('./t_pilot.mjs')).default(s.admin, ctx)
      await (await import('./t_capture.mjs')).default(s.admin, ctx)
      await (await import('./t_reveal.mjs')).default(s.admin, ctx)
      for (const mod of ['t_rls.mjs', 't_funcs.mjs', 't_rq1.mjs', 't_hash.mjs', 't_seal.mjs', 't_p1fix.mjs', 't_p2fix.mjs', 't_concurrency.mjs', 't_delete.mjs']) {
        if (!fs.existsSync(path.join(ROOT, mod))) continue
        const m = await import('./' + mod)
        await m.default(s.admin, ctx)
      }
    }
  }
} catch (e) {
  console.log('RUN ERROR', e.stack)
  record('pilot 적용', '실행 오류 없이 끝남', false, e.message)
} finally {
  for (const p of pools) await p.end().catch(() => {})
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results-pilot.json'), JSON.stringify(results, null, 1))
  const fail = results.filter((r) => !r.pass)
  process.exitCode = fail.length ? 1 : 0
  console.log(`\n합계 ${results.length} · 통과 ${results.length - fail.length} · 실패 ${fail.length}`)
  for (const f of fail) console.log('FAIL', f.area, '·', f.name, '—', JSON.stringify(f.detail).slice(0, 300))
}
