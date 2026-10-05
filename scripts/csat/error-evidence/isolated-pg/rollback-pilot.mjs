// scripts/csat/error-evidence/isolated-pg/rollback-pilot.mjs
// Pilot 마이그레이션 rollback 검증 — 새 클러스터: 원래 마이그레이션 → 스키마 스냅샷 → Pilot 적용 → (새 값 행이 있으면 rollback 거부) → 행 정리 →
// rollback → 스냅샷이 적용 전과 완전히 같다 → Pilot 재적용(멱등이 아니라 「다시 적용 가능」) → results-rollback-pilot.json
import fs from 'node:fs'
import path from 'node:path'
import { REPO, ROOT, record, results, startCluster } from './lib.mjs'
import { stage1 } from './stage1.mjs'

const PILOT = path.join(REPO, 'supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql')
const RB = path.join(REPO, 'scripts/csat/error-evidence/rollback-pilot.sql')
const server = await startCluster()
const pools = []
const schema = async (admin) => (await admin.query(`
  select 'fn:' || p.oid::regprocedure::text k, md5(pg_get_functiondef(p.oid)) v from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'csat\\_ec\\_%'
  union all select 'acl:' || p.oid::regprocedure::text, coalesce(p.proacl::text, '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'csat\\_ec\\_%'
  union all select 'con:' || conrelid::regclass || ':' || conname, md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid::regclass::text like 'csat\\_ec\\_%'
  union all select 'idx:' || indexrelid::regclass, md5(pg_get_indexdef(indexrelid)) from pg_index where indrelid::regclass::text like 'csat\\_ec\\_%'
  union all select 'col:' || c.relname || '.' || a.attname, format_type(a.atttypid, a.atttypmod) || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum where n.nspname = 'public' and c.relname like 'csat\\_ec\\_%' and c.relkind = 'r'
  union all select 'trg:' || tgrelid::regclass || ':' || tgname, md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal and tgname like 'csat\\_ec\\_%'
  union all select 'pol:' || polrelid::regclass || ':' || polname, md5(coalesce(pg_get_expr(polqual, polrelid), '')) from pg_policy where polrelid::regclass::text like 'csat\\_ec\\_%'
  union all select 'tblacl:' || c.relname, coalesce(c.relacl::text, '') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'csat\\_ec\\_%' and c.relkind = 'r'
  order by 1`)).rows
try {
  const s = await stage1()
  pools.push(s.admin, s.owner)
  if (s.ok) {
    const before = await schema(s.admin)
    await s.owner.query(fs.readFileSync(PILOT, 'utf8'))
    record('rollback-pilot', 'Pilot 적용', true)
    // 새 값을 쓰는 행이 있으면 거부
    await s.owner.query(`insert into public.csat_ec_taxonomy_version (version) values ('v9.9')`)
    await s.owner.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group) values ('v9.9', 'R.inference', 'R', 'l', 'd', 'i', 'e', 'flow'), ('v9.9', 'V.word_sense', 'V', 'l', 'd', 'i', 'e', 'word')`)
    await s.owner.query(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ('v9.9', 'r.inference__v.word_sense', 'R.inference', 'V.word_sense', 'accepted', 'x')`)
    let refused
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); refused = { ok: false } } catch (e) { refused = { ok: true, err: e.message } }
    record('rollback-pilot', 'Pilot 모델을 쓰는 행(경계)이 있으면 rollback 거부 · 아무것도 바뀌지 않음', refused.ok && /Pilot 모델을 쓰는 행/.test(refused.err), refused.err)
    const stillThere = (await s.admin.query(`select to_regclass('public.csat_ec_boundary') is not null t`)).rows[0].t
    record('rollback-pilot', '거부된 rollback 은 트랜잭션째 취소(새 표 그대로)', stillThere === true)
    await s.owner.query(`delete from public.csat_ec_boundary where version = 'v9.9'`)
    await s.owner.query(`delete from public.csat_ec_code where version = 'v9.9'`)
    await s.admin.query(`alter table public.csat_ec_taxonomy_version disable trigger csat_ec_taxonomy_guard`)
    await s.admin.query(`delete from public.csat_ec_taxonomy_version where version = 'v9.9'`)
    await s.admin.query(`alter table public.csat_ec_taxonomy_version enable trigger csat_ec_taxonomy_guard`)
    let rb
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); rb = { ok: true } } catch (e) { rb = { ok: false, err: e.message } }
    record('rollback-pilot', 'rollback 실행(postgres 역할)', rb.ok, rb.err ?? '')
    const after = await schema(s.admin)
    const bm = new Map(before.map((x) => [x.k, x.v])), am = new Map(after.map((x) => [x.k, x.v]))
    const diff = [...[...bm].filter(([k, v]) => am.get(k) !== v).map(([k]) => `다름/없음 ${k}`), ...[...am.keys()].filter((k) => !bm.has(k)).map((k) => `남음 ${k}`)]
    record('rollback-pilot', 'rollback 뒤 스키마 = 적용 전(함수 정의 · 권한 · 제약 · 인덱스 · 컬럼 · 트리거 · 정책 · 표 권한)', diff.length === 0, diff.slice(0, 12))
    let again
    try { await s.owner.query(fs.readFileSync(PILOT, 'utf8')); again = { ok: true } } catch (e) { again = { ok: false, err: e.message } }
    record('rollback-pilot', 'rollback 뒤 Pilot 다시 적용 가능', again.ok, again.err ?? '')
  }
} catch (e) {
  console.log('RUN ERROR', e.stack)
  record('rollback-pilot', '실행 오류 없이 끝남', false, e.message)
} finally {
  for (const p of pools) await p.end().catch(() => {})
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results-rollback-pilot.json'), JSON.stringify(results, null, 1))
  const fail = results.filter((r) => !r.pass)
  console.log(`\n합계 ${results.length} · 통과 ${results.length - fail.length} · 실패 ${fail.length}`)
  for (const f of fail) console.log('FAIL', f.area, '·', f.name, '—', JSON.stringify(f.detail).slice(0, 400))
}
