// scripts/csat/error-evidence/isolated-pg/rollback-detector.mjs
// G4 감지기(20261006120000) rollback 검증 — 새 클러스터: 원래 · Pilot · 수집 · Reveal Gate ①②②b → 스냅샷 → 감지기 적용 →
// (실행 기록이 있으면 거부 · 트랜잭션째 취소) → 기록 정리 → rollback → 적용 전과 같다(함수 정의 · 권한 · 표 · 트리거 · 인덱스) → 다시 적용 → results-rollback-detector.json
import fs from 'node:fs'
import path from 'node:path'
import { REPO, ROOT, record, results, startCluster } from './lib.mjs'
import { stage1 } from './stage1.mjs'
import { U, addSession, normalChoice, seedBase } from './seed.mjs'

const MIG = (f) => path.join(REPO, 'supabase/migrations', f)
const BEFORE = ['20261005130000_csat_ec_pilot_evidence.sql', '20261005150000_csat_ec_capture_support.sql', '20261005170000_csat_ec_reveal_gate.sql',
  '20261005170100_csat_ec_reveal_gate_revoke.sql', '20261006110000_csat_ec_reveal_gate_revoke_residual.sql']
const DET = MIG('20261006120000_csat_ec_boundary_detector.sql')
const RB = path.join(REPO, 'scripts/db/rollback-20261006120000.sql')
const server = await startCluster()
const pools = []
const schema = async (admin) => (await admin.query(`
  select 'fn:' || p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) v from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'csat\\_ec\\_%'
  union all select 'acl:' || p.oid::regprocedure::text, coalesce(array_to_string(array(select x::text from unnest(p.proacl) x order by 1), ','), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'csat\\_ec\\_%'
  union all select 'rel:' || c.relname || ':' || c.relkind::text, coalesce(array_to_string(array(select x::text from unnest(c.relacl) x order by 1), ','), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'csat\\_ec\\_%'
  union all select 'con:' || conrelid::regclass || ':' || conname, md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid::regclass::text like 'csat\\_ec\\_%'
  union all select 'idx:' || indexrelid::regclass, md5(pg_get_indexdef(indexrelid)) from pg_index where indrelid::regclass::text like 'csat\\_ec\\_%'
  union all select 'trg:' || tgrelid::regclass || ':' || tgname, md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal and tgname like 'csat\\_ec\\_%'
  union all select 'pol:' || polrelid::regclass || ':' || polname, md5(coalesce(pg_get_expr(polqual, polrelid), '')) from pg_policy where polrelid::regclass::text like 'csat\\_ec\\_%'
  order by 1`)).rows
try {
  const s = await stage1()
  pools.push(s.admin, s.owner)
  if (s.ok) {
    for (const f of BEFORE) await s.owner.query(fs.readFileSync(MIG(f), 'utf8'))
    await s.owner.query(`alter default privileges in schema public revoke execute on functions from authenticated`)
    const before = await schema(s.admin)
    await s.owner.query(fs.readFileSync(DET, 'utf8'))
    record('rollback-detector', '감지기 적용', true)
    // 실행 기록 하나 — 기록이 있으면 rollback 은 멈춰야 한다
    await seedBase(s.admin)
    const sid = { session_id: await addSession(s.admin, U.L1, normalChoice), item_no: 18 }
    await s.admin.query(`insert into public.csat_ec_detector_run (session_id, item_no, detector_version, result) values ($1, $2, 'bd-0.1.0', 'skipped_no_capture')`, [sid.session_id, sid.item_no])
    let refused
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); refused = { ok: false } } catch (e) { refused = { ok: true, err: e.message } }
    const still = (await s.admin.query(`select to_regclass('public.csat_ec_detector_run') is not null d`)).rows[0].d
    record('rollback-detector', '실행 기록이 있으면 rollback 거부 · 트랜잭션째 취소', refused.ok && /감지 실행 기록/.test(refused.err) && still, refused.err)
    await s.admin.query(`delete from public.csat_ec_detector_run`)
    let rb
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); rb = { ok: true } } catch (e) { rb = { ok: false, err: e.message } }
    record('rollback-detector', 'rollback 실행', rb.ok, rb.err ?? '')
    const after = await schema(s.admin)
    const bm = new Map(before.map((x) => [x.k, x.v])), am = new Map(after.map((x) => [x.k, x.v]))
    const diff = [...[...bm].filter(([k, v]) => am.get(k) !== v).map(([k]) => `다름/없음 ${k}`), ...[...am.keys()].filter((k) => !bm.has(k)).map((k) => `남음 ${k}`)]
    record('rollback-detector', 'rollback 뒤 = 적용 전(함수 정의 · 함수 권한 · 표 권한 · 제약 · 인덱스 · 트리거 · 정책)', diff.length === 0 && before.length > 50, { n: before.length, diff: diff.slice(0, 15) })
    let again
    try { await s.owner.query(fs.readFileSync(DET, 'utf8')); again = { ok: true } } catch (e) { again = { ok: false, err: e.message } }
    record('rollback-detector', '다시 적용 가능', again.ok, again.err ?? '')
  }
} catch (e) {
  console.log('RUN ERROR', e.stack)
  record('rollback-detector', '실행 오류 없이 끝남', false, e.message)
} finally {
  for (const p of pools) await p.end().catch(() => {})
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results-rollback-detector.json'), JSON.stringify(results, null, 1))
  const fail = results.filter((r) => !r.pass)
  process.exitCode = fail.length ? 1 : 0
  console.log(`\n합계 ${results.length} · 통과 ${results.length - fail.length} · 실패 ${fail.length}`)
  for (const f of fail) console.log('FAIL', f.area, '·', f.name, '—', JSON.stringify(f.detail).slice(0, 400))
}
