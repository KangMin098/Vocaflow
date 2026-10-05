// scripts/csat/error-evidence/isolated-pg/rollback-capture.mjs
// 증거 수집 지원(20261005150000) rollback 검증 — 새 클러스터: 원래 · Pilot 마이그레이션 → 스냅샷 → 수집 지원 적용 → (새 상태 · 이벤트 행이 있으면 거부) →
// 행 정리 → rollback → 스냅샷이 적용 전과 같다 → 다시 적용 가능 → results-rollback-capture.json
import fs from 'node:fs'
import path from 'node:path'
import { REPO, ROOT, record, results, startCluster } from './lib.mjs'
import { stage1 } from './stage1.mjs'

const PILOT = path.join(REPO, 'supabase/migrations/20261005130000_csat_ec_pilot_evidence.sql')
const CAPTURE = path.join(REPO, 'supabase/migrations/20261005150000_csat_ec_capture_support.sql')
const RB = path.join(REPO, 'scripts/csat/error-evidence/rollback-capture.sql')
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
  union all select 'trg:' || tgrelid::regclass || ':' || tgname, md5(pg_get_triggerdef(oid)) from pg_trigger where not tgisinternal and tgname like 'csat\\_ec\\_%'
  union all select 'pol:' || polrelid::regclass || ':' || polname, md5(coalesce(pg_get_expr(polqual, polrelid), '')) from pg_policy where polrelid::regclass::text like 'csat\\_ec\\_%'
  union all select 'tblacl:' || c.relname, coalesce(c.relacl::text, '') from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'csat\\_ec\\_%' and c.relkind = 'r'
  order by 1`)).rows
try {
  const s = await stage1()
  pools.push(s.admin, s.owner)
  if (s.ok) {
    await s.owner.query(fs.readFileSync(PILOT, 'utf8'))
    const before = await schema(s.admin)
    // preflight — 다른 작업이 더한 이벤트가 있으면 지우지 않도록 적용 전체를 멈춘다
    const liveDef = (await s.admin.query(`select pg_get_constraintdef(oid) d from pg_constraint where conname = 'funnel_events_event_check'`)).rows[0].d
    await s.admin.query(`alter table public.funnel_events drop constraint funnel_events_event_check`)
    await s.admin.query(`alter table public.funnel_events add constraint funnel_events_event_check ${liveDef.replace("'teacher_hub_view'::text", "'teacher_hub_view'::text, 'other_work_event'::text")}`)
    let pre
    try { await s.owner.query(fs.readFileSync(CAPTURE, 'utf8')); pre = { ok: false } } catch (e) { pre = { ok: true, err: e.message } }
    const untouched = (await s.admin.query(`select count(*)::int n from pg_proc where proname = 'csat_ec_add_probe_response'`)).rows[0].n === 0
    record('rollback-capture', '이벤트 목록이 기대와 다르면 적용 전체 중단(다른 작업 이벤트 보존)', pre.ok && /이벤트 허용 목록이 기대와 다르다/.test(pre.err) && untouched, pre.err)
    await s.admin.query(`alter table public.funnel_events drop constraint funnel_events_event_check`)
    await s.admin.query(`alter table public.funnel_events add constraint funnel_events_event_check ${liveDef}`)
    await s.owner.query(fs.readFileSync(CAPTURE, 'utf8'))
    record('rollback-capture', '수집 지원 적용', true)
    await s.admin.query(`insert into public.funnel_events (event) values ('csat_ec_capture_opened')`)
    let refused
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); refused = { ok: false } } catch (e) { refused = { ok: true, err: e.message } }
    record('rollback-capture', '새 이벤트 행이 있으면 rollback 거부', refused.ok && /새 상태/.test(refused.err), refused.err)
    const still = (await s.admin.query(`select count(*)::int n from pg_proc where proname = 'csat_ec_add_probe_response'`)).rows[0].n
    record('rollback-capture', '거부된 rollback 은 트랜잭션째 취소(새 함수 그대로)', still === 1)
    await s.admin.query(`delete from public.funnel_events`)
    let rb
    try { await s.owner.query(fs.readFileSync(RB, 'utf8')); rb = { ok: true } } catch (e) { rb = { ok: false, err: e.message } }
    record('rollback-capture', 'rollback 실행', rb.ok, rb.err ?? '')
    const after = await schema(s.admin)
    const bm = new Map(before.map((x) => [x.k, x.v])), am = new Map(after.map((x) => [x.k, x.v]))
    const diff = [...[...bm].filter(([k, v]) => am.get(k) !== v).map(([k]) => `다름/없음 ${k}`), ...[...am.keys()].filter((k) => !bm.has(k)).map((k) => `남음 ${k}`)]
    record('rollback-capture', 'rollback 뒤 스키마 = 적용 전(함수 정의 · 권한 · 제약 · 이벤트 목록)', diff.length === 0, diff.slice(0, 12))
    let again
    try { await s.owner.query(fs.readFileSync(CAPTURE, 'utf8')); again = { ok: true } } catch (e) { again = { ok: false, err: e.message } }
    record('rollback-capture', '다시 적용 가능', again.ok, again.err ?? '')
  }
} catch (e) {
  console.log('RUN ERROR', e.stack)
  record('rollback-pilot', '실행 오류 없이 끝남', false, e.message)
} finally {
  for (const p of pools) await p.end().catch(() => {})
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results-rollback-capture.json'), JSON.stringify(results, null, 1))
  const fail = results.filter((r) => !r.pass)
  console.log(`\n합계 ${results.length} · 통과 ${results.length - fail.length} · 실패 ${fail.length}`)
  for (const f of fail) console.log('FAIL', f.area, '·', f.name, '—', JSON.stringify(f.detail).slice(0, 400))
}
