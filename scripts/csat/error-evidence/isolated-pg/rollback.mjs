// scripts/csat/error-evidence/isolated-pg/rollback.mjs
// rollback 실제 실행 — 빈 상태 성공 · 행 있으면 거부 · 원복 확인. 생성 객체 실제 개수도 센다
import fs from 'node:fs'
import path from 'node:path'
import { MIGRATION, ROLLBACK, ROOT, conn, record, results, startCluster } from './lib.mjs'
import { U, addSession, normalChoice, seedBase } from './seed.mjs'

const server = await startCluster()
const admin = conn('supabase_admin', 'admin')
const owner = conn('postgres', 'postgres')
const objects = async () => (await admin.query(`
  select (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'csat\\_ec\\_%' and c.relkind = 'r') tables,
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'csat\\_ec\\_%') functions,
         (select count(*) from pg_trigger where not tgisinternal and tgname like 'csat\\_ec\\_%') triggers,
         (select count(*) from pg_policy where polname like 'csat\\_ec\\_%') policies,
         (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'i' and c.relname like 'csat\\_ec\\_%') named_indexes,
         (select count(*) from pg_index i join pg_class t on t.oid = i.indrelid where t.relname like 'csat\\_ec\\_%') all_indexes,
         (select count(*) from pg_constraint where conrelid::regclass::text like 'csat\\_ec\\_%') constraints,
         (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'csat\\_ec\\_%' and p.prosecdef) definer`)).rows[0]
const base = async () => (await admin.query(`select (select count(*) from public.csat_dx_session) s, (select count(*) from public.csat_dx_response) r, (select count(*) from public.csat_items) i,
  (select count(*) from pg_trigger where tgrelid = 'public.csat_dx_response'::regclass and not tgisinternal) resp_triggers`)).rows[0]
try {
  await admin.query(fs.readFileSync(path.join(ROOT, 'bootstrap.sql'), 'utf8'))
  await seedBase(admin)
  await addSession(admin, U.L1, normalChoice)
  const b0 = await base()
  await owner.query(fs.readFileSync(MIGRATION, 'utf8'))
  const o1 = await objects()
  record('객체', '실제 생성 개수', true, o1)
  // 1. 빈 상태 rollback
  let rb
  try { await owner.query(fs.readFileSync(ROLLBACK, 'utf8')); rb = { ok: true } } catch (e) { rb = { ok: false, err: e.message } }
  record('rollback', '빈 상태 — 성공', rb.ok, rb.err)
  const o2 = await objects(), b1 = await base()
  record('rollback', '남은 csat_ec_* 객체 0(표 · 함수 · 트리거 · 정책 · 인덱스 · 제약)', Object.values(o2).every((v) => Number(v) === 0), o2)
  record('rollback', '응답 삭제 트리거 원복 · 기존 데이터 그대로', JSON.stringify(b1) === JSON.stringify(b0) && Number(b1.resp_triggers) === 0, { b0, b1 })
  // 2. 다시 적용 → 행이 있으면 거부
  let re
  try { await owner.query(fs.readFileSync(MIGRATION, 'utf8')); re = { ok: true } } catch (e) { re = { ok: false, err: e.message } }
  record('rollback', '재적용 성공(되돌린 뒤 같은 마이그레이션을 다시 적용 가능)', re.ok, re.err)
  await owner.query(`insert into public.csat_ec_taxonomy_version (version) values ('v9.9')`)
  let rb2
  try { await owner.query(fs.readFileSync(ROLLBACK, 'utf8')); rb2 = { ok: true } } catch (e) { rb2 = { ok: false, err: e.message } }
  const o3 = await objects()
  record('rollback', '행이 있으면 거부(데이터 손실 방지) · 객체 그대로', !rb2.ok && /rollback 중단/.test(rb2.err) && Number(o3.tables) === 9, { err: rb2.err, tables: o3.tables })
} catch (e) {
  console.log('RUN ERROR', e.stack)
} finally {
  await admin.end(); await owner.end()
  await server.stop()
  fs.writeFileSync(path.join(ROOT, 'results-rollback.json'), JSON.stringify(results, null, 1))
  console.log(`합계 ${results.length} · 실패 ${results.filter((r) => !r.pass).length}`)
}
