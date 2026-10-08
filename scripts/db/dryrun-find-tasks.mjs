// scripts/db/dryrun-find-tasks.mjs
//
// FIND 과제 보강 시드(seed-20261007-find-tasks.sql) 드라이런 — 개발 DB 한 트랜잭션 안에서 실행 · 확인 · 되돌리기 SQL 확인 뒤 **무조건 ROLLBACK**.
// 실행: SUPABASE_DB_CA_CERT=<CA PEM> CSAT_PG_MODULE_DIR=<pg 가 있는 node_modules> node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/dryrun-find-tasks.mjs
// 인증서 검증 TLS 만 쓴다(CA 없으면 멈춘다 — rejectUnauthorized:false 금지). 이 브랜치에는 pg 의존이 없어 위치를 환경 변수로 받는다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const PG_DIR = process.env.CSAT_PG_MODULE_DIR
if (!PG_DIR) throw new Error('CSAT_PG_MODULE_DIR 가 없다 — pg 가 설치된 node_modules 경로')
const pg = createRequire(path.join(PG_DIR, 'noop.js'))('pg')
const CA = process.env.SUPABASE_DB_CA_CERT
if (!CA || !CA.includes('BEGIN CERTIFICATE')) throw new Error('SUPABASE_DB_CA_CERT 가 없다 — 인증서 검증 없이 접속하지 않는다')
function verified(url) {
  const u = new URL(url)
  // URL 의 sslmode · sslnegotiation 이 ssl 객체(CA)를 덮지 않게 뗀다
  u.searchParams.delete('sslmode')
  u.searchParams.delete('sslnegotiation')
  return { connectionString: u.href, ssl: { ca: CA, rejectUnauthorized: true } }
}

const strip = (sql) => {
  const s = sql.replace(/^\s*(begin|commit)\s*;\s*$/gim, '')
  if (/^\s*commit\s*;/im.test(s)) throw new Error('commit 문이 남아 있다 — 드라이런을 멈춘다')
  return s
}
const SEED = strip(fs.readFileSync('scripts/db/seed-20261007-find-tasks.sql', 'utf8'))
const RB = strip(fs.readFileSync('scripts/db/rollback-seed-20261007-find-tasks.sql', 'utf8'))
let fail = 0
const rec = (name, pass, detail = '') => { if (!pass) fail++; console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail === '' ? '' : ' — ' + JSON.stringify(detail).slice(0, 240)}`) }
const counts = async (c) => (await c.query(`select count(*)::int n, count(distinct line_code)::int l, count(*) filter (where ord = 4)::int f from public.csat_map_task`)).rows[0]

const c = new pg.Client(verified(process.env.SUPABASE_DB_URL))
await c.connect()
try {
  await c.query('begin')
  const before = await counts(c)
  rec('적용 전 = 162 · 라인 54 · ord 4 없음', before.n === 162 && before.l === 54 && before.f === 0, before)
  await c.query(SEED)
  const after = await counts(c)
  rec('적용 후 = 182 · 라인 54 · ord 4 = 20', after.n === 182 && after.l === 54 && after.f === 20, after)
  const dup = (await c.query(`select line_code, count(*)::int n from public.csat_map_task where ord = 4 group by 1 having count(*) > 1`)).rows
  rec('라인당 FIND 하나', dup.length === 0, dup)
  await c.query(SEED)
  rec('다시 실행해도 182(재실행 안전)', (await counts(c)).n === 182)
  await c.query(RB)
  rec('되돌리기 뒤 = 162', (await counts(c)).n === 162)
} catch (e) { rec('드라이런 실행', false, e.message) } finally { await c.query('rollback'); await c.end() }
console.log(fail ? `실패 ${fail}` : '드라이런 통과 — ROLLBACK 완료(개발 DB 변경 없음)')
process.exit(fail ? 1 : 0)
