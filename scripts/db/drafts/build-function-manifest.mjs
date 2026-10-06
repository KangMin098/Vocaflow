// scripts/db/drafts/build-function-manifest.mjs
// 첫 manifest 를 만든다(한 번 쓰고 이후엔 사람이 class 를 고친다 — 가드에는 --update 가 없다).
// 입력: fn-census.json(감사 분류) · fn-plan.json(정책 의존) · fn-decisions.json(review 60 증거 판정)
import fs from 'node:fs'
const [CENSUS, PLAN, DEC, OUT] = process.argv.slice(2)
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
const dec = Object.fromEntries(JSON.parse(fs.readFileSync(DEC, 'utf8')).map((d) => [d.sig, d]))
const functions = {}
// 감사 대상(anon/authenticated 실행 가능) 밖의 함수 — 이미 닫혀 있다: 트리거 · service 전용 · 소유자 전용
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../csat/error-evidence/isolated-pg/package.json', import.meta.url))
const pg = require('pg')
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect(); await db.query('begin read only')
const closed = (await db.query(`select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig, p.prorettype = 'trigger'::regtype trig,
  has_function_privilege('service_role', p.oid, 'execute') svc from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  and not exists(select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute')`)).rows
await db.query('rollback'); await db.end()
for (const r of closed) functions[r.sig] = r.trig ? { class: 'TRIGGER_ONLY', why: '트리거 함수(이미 닫힘)' } : r.svc ? { class: 'SERVICE_ONLY', why: '이미 service_role 전용' } : { class: 'OWNER_ONLY', why: '소유자 함수 내부 보조(이미 닫힘)' }
for (const f of plan) {
  const sig = `${f.name}(${f.args})`
  const d = dec[sig]
  let cls, why
  if (d) { cls = d.cls; why = d.why }
  else if (f.action === 'keep(anon 정책 의존)') { cls = 'PUBLIC_RPC'; why = `anon 이 평가하는 RLS 정책이 부른다: ${f.anonPolicy.slice(0, 3).join(', ')}` }
  else if (f.cls === 'intended_public') { cls = 'PUBLIC_RPC'; why = '비로그인 제품 흐름(학급 코드 미리보기 · 퍼널 이벤트)' }
  else if (f.cls === 'trigger_only') { cls = 'TRIGGER_ONLY'; why = '트리거 함수 — EXECUTE 는 CREATE TRIGGER 때만 검사된다' }
  else if (f.cls === 'service_only' && f.inPolicy.length) { cls = 'AUTH_READ_RPC'; why = `로그인 사용자 RLS 정책이 부른다: ${f.inPolicy.slice(0, 3).join(', ')}` }
  else if (f.cls === 'service_only' && (f.inView.length || f.inDefault.length)) { cls = 'AUTH_READ_RPC'; why = `뷰/기본값이 부른다: ${[...f.inView, ...f.inDefault].slice(0, 3).join(', ')}` }
  else if (f.cls === 'service_only') { cls = 'SERVICE_ONLY'; why = `학습자 경로 호출부 없음 · 호출부: ${f.caller_files.slice(0, 2).join(' ; ') || '없음(SQL 내부 · cron)'}` }
  else if (f.cls === 'admin_only' || (f.admin_check && !f.uid_check)) { cls = 'ADMIN_RPC'; why = `관리자 화면 호출: ${f.caller_files.slice(0, 2).join(' ; ')}` }
  else if (f.uid_check) { cls = 'AUTH_SELF_RPC'; why = `로그인 학습자 호출 · 본문 auth.uid(): ${f.caller_files.slice(0, 2).join(' ; ')}` }
  else { cls = 'AUTH_READ_RPC'; why = `로그인 경로 호출 · 본인 데이터 아님: ${f.caller_files.slice(0, 2).join(' ; ')}` }
  functions[sig] = { class: cls, why }
}
const sorted = Object.fromEntries(Object.entries(functions).sort(([a], [b]) => a.localeCompare(b)))
fs.writeFileSync(OUT, JSON.stringify({
  note: 'public 함수 EXECUTE 정책의 정본 — scripts/db/check-function-exec.mjs 가 기본 거부로 검사한다. 새 함수는 여기에 class 를 적어야 통과한다. class: PUBLIC_RPC · AUTH_READ_RPC · AUTH_SELF_RPC · REVIEWER_RPC · ADMIN_RPC · SERVICE_ONLY · TRIGGER_ONLY · OWNER_ONLY. 기준선 자동 갱신 없음 — 사람이 고친다.',
  generated: '2026-10-06', functions: sorted,
}, null, 1) + '\n')
const by = {}; for (const v of Object.values(sorted)) by[v.class] = (by[v.class] || 0) + 1
console.log(Object.keys(sorted).length, by)
