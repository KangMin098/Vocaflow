// scripts/db/dryrun-g1-g2.mjs
//
// G1 + G2 마이그레이션 드라이런 — 개발 DB 에서 **한 트랜잭션 안에** 두 마이그레이션을 적용하고, 같은 트랜잭션에서
// 정책 가드(check-function-exec)와 역할 매트릭스를 돌린 뒤 **무조건 ROLLBACK** 한다. 커밋 경로가 없다.
// 격리 PG 에는 402 함수 스키마가 없어 정의 컴파일 · 정책 · 의존을 실제 스키마에서 보려는 것이다(2026-09-19 기본 권한 조치와 같은 방식).
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/dryrun-g1-g2.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { checkFunctionExec } from './check-function-exec.mjs'
const require = createRequire(path.resolve('scripts/csat/error-evidence/isolated-pg/package.json'))
const pg = require('pg')

const G1 = fs.readFileSync('supabase/migrations/20261006090000_auto_promote_self_only.sql', 'utf8')
const G2 = fs.readFileSync('supabase/migrations/20261006100000_function_exec_policy.sql', 'utf8')
const man = JSON.parse(fs.readFileSync('scripts/db/function-exec-manifest.json', 'utf8'))
const out = []
const rec = (name, pass, detail = '') => { out.push({ name, pass: !!pass, detail }); console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`) }

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
let committed = false
try {
  await c.query('begin')
  await c.query(`set local lock_timeout = '5s'`)
  await c.query(`set local statement_timeout = '60s'`)
  await c.query(G1)
  rec('G1 적용(트랜잭션 안)', true)
  await c.query(G2)
  rec('G2 적용(트랜잭션 안) — 정의 22개 컴파일 · 402 함수 권한', true)

  const g = await checkFunctionExec(c, man)
  rec('정책 가드 — 미분류 · 권한 · 본문 검사 위반 0', g.fails.length === 0, g.fails.slice(0, 5).map((f) => `${f.rule} ${f.sig} ${f.why}`).join(' | ') || `함수 ${g.checked}`)

  // 역할 매트릭스 — 실제 사용자 id(읽기만): 관리자 1 · 비관리자 1
  const admin = (await c.query(`select user_id from public.user_profiles where role = 'admin' limit 1`)).rows[0]?.user_id
  const learner = (await c.query(`select user_id from public.user_profiles where coalesce(role, '') <> 'admin' limit 1`)).rows[0]?.user_id
  const other = (await c.query(`select user_id from public.user_profiles where user_id <> $1 limit 1`, [learner])).rows[0]?.user_id
  async function as(role, sub, sql, params = []) {
    await c.query('savepoint m')
    try {
      await c.query(`set local role ${role}`)
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role, sub })])
      const r = await c.query(sql, params)
      return { ok: true, n: r.rowCount }
    } catch (e) { return { ok: false, code: e.code, err: e.message } } finally { await c.query('rollback to savepoint m'); await c.query('reset role') }
  }
  const M = [
    ['anon → csat_source_snapshot_take 거부(감사 계기)', 'anon', null, `select public.csat_source_snapshot_take('dryrun')`, [], (r) => !r.ok && r.code === '42501'],
    ['anon → auto_promote(남) 거부(G1)', 'anon', null, `select * from public.auto_promote_v_level_for_user($1)`, [other], (r) => !r.ok && r.code === '42501'],
    ['학습자 → auto_promote(남) 거부(G1)', 'authenticated', learner, `select * from public.auto_promote_v_level_for_user($1)`, [other], (r) => !r.ok && r.code === '42501'],
    ['학습자 → auto_promote(자기) 허용', 'authenticated', learner, `select * from public.auto_promote_v_level_for_user($1)`, [learner], (r) => r.ok],
    ['학습자 → insert_book_analysis 거부(감사 E)', 'authenticated', learner, `select public.insert_book_analysis('00000000-0000-0000-0000-000000000000', '[]', '[]')`, [], (r) => !r.ok && r.code === '42501'],
    ['학습자 → admin_vrl_cron_jobs 거부(본문 검사)', 'authenticated', learner, `select * from public.admin_vrl_cron_jobs()`, [], (r) => !r.ok && r.code === '42501'],
    ['관리자 → admin_vrl_cron_jobs 허용', 'authenticated', admin, `select * from public.admin_vrl_cron_jobs()`, [], (r) => r.ok],
    ['service_role → admin_vrl_cron_jobs 허용', 'service_role', null, `select * from public.admin_vrl_cron_jobs()`, [], (r) => r.ok],
    ['학습자 → refresh_user_known_word_count(남) 거부', 'authenticated', learner, `select public.refresh_user_known_word_count($1)`, [other], (r) => !r.ok && r.code === '42501'],
    ['학습자 → refresh_user_known_word_count(자기) 허용', 'authenticated', learner, `select public.refresh_user_known_word_count($1)`, [learner], (r) => r.ok],
    ['학습자 → recommend_word_sets_for_user(남) 거부', 'authenticated', learner, `select * from public.recommend_word_sets_for_user($1, null)`, [other], (r) => !r.ok && r.code === '42501'],
    ['anon → recommend_word_sets_for_user 거부', 'anon', null, `select * from public.recommend_word_sets_for_user($1, null)`, [learner], (r) => !r.ok && r.code === '42501'],
    ['anon → 공개 서가 list_pd_comic_shelf 허용', 'anon', null, `select * from public.list_pd_comic_shelf()`, [], (r) => r.ok],
    ['anon → 공개 사전 lookup_word_meaning 허용', 'anon', null, `select * from public.lookup_word_meaning('running')`, [], (r) => r.ok],
    ['anon → 도서 목록 SELECT(정책이 is_admin_or_curator 평가) 허용', 'anon', null, `select id from public.library_books where status = 'published' limit 3`, [], (r) => r.ok && r.n > 0],
    ['anon → select_book_comic_all 거부(5컷 상한 우회 차단)', 'anon', null, `select * from public.select_book_comic_all('00000000-0000-0000-0000-000000000000')`, [], (r) => !r.ok && r.code === '42501'],
    ['학습자 → 공개 학급 코드 peek_class_by_code 허용', 'authenticated', learner, `select * from public.peek_class_by_code('ZZZZZZ')`, [], (r) => r.ok],
  ]
  if (!admin || !learner || !other) rec('매트릭스 사용자', false, `admin=${!!admin} learner=${!!learner} other=${!!other}`)
  else for (const [name, role, sub, sql, params, ok] of M) { const r = await as(role, sub, sql, params); rec(name, ok(r), r.ok ? `ok n=${r.n}` : `${r.code} ${r.err}`) }
} catch (e) {
  rec('드라이런 실행', false, `${e.code ?? ''} ${e.message}`)
} finally {
  await c.query('rollback').catch(() => {})   // 무조건 되돌린다
  await c.end()
  const fail = out.filter((r) => !r.pass).length
  fs.writeFileSync('scripts/db/isolated/results-dryrun-g1-g2.json', JSON.stringify({ ranAt: new Date().toISOString(), committed, pass: out.length - fail, fail, out }, null, 1))
  console.log(`\n합계 PASS ${out.length - fail} · FAIL ${fail} · 커밋 ${committed ? '있음(!)' : '없음 — ROLLBACK'}`)
  process.exitCode = fail ? 1 : 0
}
