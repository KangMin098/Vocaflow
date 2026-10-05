// scripts/csat/error-evidence/isolated-pg/rollback-reveal.mjs
// Reveal Gate(20261005170000 ① + 20261005170100 ②) rollback 검증 — 새 클러스터: 원래 · Pilot · 수집 지원 → 스냅샷 → ①② 적용 →
// (capture 행이 있으면 거부) → 정리 → rollback → 적용 전 스냅샷과 같다(함수 · 권한 · 컬럼 권한 · 정책 조건 · 뷰 · 스키마 · 이벤트 목록) → 다시 적용 → results-rollback-reveal.json
import fs from 'node:fs'
import path from 'node:path'
import { REPO, ROOT, record, results, startCluster } from './lib.mjs'
import { stage1 } from './stage1.mjs'

const PILOT = path.join(REPO, 'supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql')
const CAPTURE = path.join(REPO, 'supabase/migrations/20261005150000_csat_ec_capture_support.sql')
const REVEAL = path.join(REPO, 'supabase/migrations/20261005170000_csat_ec_reveal_gate.sql')
const REVOKE = path.join(REPO, 'supabase/migrations/20261005170100_csat_ec_reveal_gate_revoke.sql')
const RB = path.join(REPO, 'scripts/csat/error-evidence/rollback-reveal-gate.sql')
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
  union all select 'fe:' || conname, md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid = 'public.funnel_events'::regclass
  union all select 'colacl:' || table_name || '.' || column_name || ':' || grantee, privilege_type from information_schema.column_privileges where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role') and (table_name like 'csat\_%' or table_name = 'funnel_events')
  union all select 'attacl:' || c.relname || '.' || a.attname, coalesce(a.attacl::text, '') from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and (c.relname like 'csat\_%' or c.relname = 'funnel_events') and a.attnum > 0 and not a.attisdropped and a.attacl is not null
  union all select 'view:' || c.relname, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v' and c.relname like 'csat\_%'
  union all select 'schema:' || nspname, '' from pg_namespace where nspname like 'csat%'
  union all select 'pol2:' || polrelid::regclass || ':' || polname, md5(coalesce(pg_get_expr(polqual, polrelid), '')) from pg_policy where polrelid::regclass::text like 'csat\_%'
  union all select 'trg:' || tgrelid::regclass || ':' || tgname, md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal and tgname like 'csat\\_ec\\_%'
  union all select 'pol:' || polrelid::regclass || ':' || polname, md5(coalesce(pg_get_expr(polqual, polrelid), '')) from pg_policy where polrelid::regclass::text like 'csat\\_ec\\_%'
  union all select 'tblacl:' || c.relname, coalesce(c.relacl::text, '') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'csat\\_ec\\_%' and c.relkind = 'r'
  order by 1`)).rows
try {
  const s = await stage1()
  pools.push(s.admin, s.owner)
  if (s.ok) {
    await s.owner.query(fs.readFileSync(PILOT, 'utf8'))
    await s.owner.query(fs.readFileSync(CAPTURE, 'utf8'))
    const before = await schema(s.admin)
    await s.owner.query(fs.readFileSync(REVEAL, 'utf8'))
    await s.owner.query(fs.readFileSync(REVOKE, 'utf8'))
    record('rollback-reveal', 'Reveal Gate ① ② 적용', true)
    await s.admin.query(`insert into public.csat_ec_capture_tombstone (exam_id, item_ids, prior_status) values ('X', '{}', 'held')`)
    let refused
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); refused = { ok: false } } catch (e) { refused = { ok: true, err: e.message } }
    record('rollback-reveal', '묘비 행이 있으면 rollback 거부(활성 보류를 몰래 풀지 않는다)', refused.ok && /정리 여부/.test(refused.err), refused.err)
    const still = (await s.admin.query(`select count(*)::int n from pg_namespace where nspname = 'csat_ec_private'`)).rows[0].n
    record('rollback-reveal', '거부된 rollback 은 트랜잭션째 취소', still === 1)
    await s.admin.query(`alter table public.csat_ec_capture_tombstone disable trigger csat_ec_tombstone_guard`)
    await s.admin.query(`delete from public.csat_ec_capture_tombstone`)
    let rb
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); rb = { ok: true } } catch (e) { rb = { ok: false, err: e.message } }
    record('rollback-reveal', 'rollback 실행', rb.ok, rb.err ?? '')
    const after = await schema(s.admin)
    const bm = new Map(before.map((x) => [x.k, x.v])), am = new Map(after.map((x) => [x.k, x.v]))
    const diff = [...[...bm].filter(([k, v]) => am.get(k) !== v).map(([k]) => `다름/없음 ${k}`), ...[...am.keys()].filter((k) => !bm.has(k)).map((k) => `남음 ${k}`)]
    record('rollback-reveal', 'rollback 뒤 스키마 = 적용 전(함수 · 권한 · 컬럼 권한 · 정책 조건 · 뷰 · 스키마 · 트리거 · 이벤트 목록)', diff.length === 0, diff.slice(0, 15))
    let again
    try { await s.owner.query(fs.readFileSync(REVEAL, 'utf8')); await s.owner.query(fs.readFileSync(REVOKE, 'utf8')); again = { ok: true } } catch (e) { again = { ok: false, err: e.message } }
    record('rollback-reveal', '다시 적용 가능', again.ok, again.err ?? '')
  }
} catch (e) {
  console.log('RUN ERROR', e.stack)
  record('rollback-pilot', '실행 오류 없이 끝남', false, e.message)
} finally {
  for (const p of pools) await p.end().catch(() => {})
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results-rollback-reveal.json'), JSON.stringify(results, null, 1))
  const fail = results.filter((r) => !r.pass)
  process.exitCode = fail.length ? 1 : 0
  console.log(`\n합계 ${results.length} · 통과 ${results.length - fail.length} · 실패 ${fail.length}`)
  for (const f of fail) console.log('FAIL', f.area, '·', f.name, '—', JSON.stringify(f.detail).slice(0, 400))
}
