// scripts/db/dryrun-reveal2b.mjs
// ②b(20261006110000) 드라이런 — 한 트랜잭션에서 적용하고 권한 · 학습자 조회를 본 뒤 **무조건 ROLLBACK**. 이어서 롤백 SQL 이 원상 복원하는지도
// 같은 트랜잭션에서 확인한다(적용 → 롤백 SQL → relacl 비교).
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/dryrun-reveal2b.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const pg = createRequire(path.resolve('scripts/csat/error-evidence/isolated-pg/package.json'))('pg')
const MIG = fs.readFileSync('supabase/migrations/20261006110000_csat_ec_reveal_gate_revoke_residual.sql', 'utf8')
const RB = fs.readFileSync('scripts/db/rollback-20261006110000.sql', 'utf8').replace(/^\s*(begin|commit)\s*;\s*$/gim, '')
const T = ['csat_dx_session', 'csat_dx_response', 'csat_dx_snapshot', 'csat_learner_state']
const out = []
const rec = (n, p, d = '') => { out.push({ n, p: !!p, d }); console.log(`[${p ? 'PASS' : 'FAIL'}] ${n}${d ? ' — ' + d : ''}`) }
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
// relacl 항목 순서는 GRANT 순서를 따른다 — 의미 비교를 위해 항목을 정렬한다
const acl = async () => Object.fromEntries((await c.query(`select relname, relacl::text a from pg_class where oid = any($1::regclass[]) order by relname`, [T.map((t) => `public.${t}`)])).rows
  .map((r) => [r.relname, r.a.replace(/[{}]/g, '').split(',').sort().join(',')]))
try {
  await c.query('begin'); await c.query(`set local lock_timeout = '5s'`)
  const before = await acl()
  await c.query(MIG)
  const priv = (await c.query(`select t, p, r from unnest($1::text[]) t, unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p, unnest(array['anon','authenticated']) r
     where has_table_privilege(r, 'public.' || t, p)`, [T])).rows
  rec('anon · authenticated 표 단위 권한 0(컬럼 SELECT 는 별도)', priv.length === 0, JSON.stringify(priv))
  const col = (await c.query(`select has_column_privilege('authenticated','public.csat_dx_session','exam_id','select') s, has_column_privilege('authenticated','public.csat_dx_response','chosen_option','select') r,
     has_column_privilege('authenticated','public.csat_dx_session','raw_score','select') raw, has_column_privilege('authenticated','public.csat_dx_response','is_correct','select') ic`)).rows[0]
  rec('② 가 남긴 컬럼 SELECT 유지', col.s && col.r, JSON.stringify(col))
  rec('회수 컬럼(raw_score · is_correct) 여전히 없음', !col.raw && !col.ic)
  await c.query(RB)
  const restored = await acl()
  rec('롤백 SQL 이 relacl 을 정확히 복원', JSON.stringify(restored) === JSON.stringify(before), JSON.stringify(restored))
} catch (e) { rec('드라이런', false, e.message) } finally {
  await c.query('rollback').catch(() => {}); await c.end()
  const f = out.filter((x) => !x.p).length
  console.log(`\n합계 PASS ${out.length - f} · FAIL ${f} · ROLLBACK(커밋 없음)`); process.exitCode = f ? 1 : 0
}
