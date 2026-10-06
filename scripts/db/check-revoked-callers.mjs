// scripts/db/check-revoked-callers.mjs
//
// manifest 에서 authenticated 실행이 없는 함수(SERVICE_ONLY · TRIGGER_ONLY · OWNER_ONLY)의 이름이
// **사용자 세션 · 브라우저 client 를 쓰는 파일**에 문자열로 나오면 실패한다.
// 호출 문법(.rpc('x') · rpc.bind 뒤 rpc('x') · 래퍼 인자)과 무관하게 **이름 문자열**로 찾는다 — 문법 매칭은
// `const rpc = client.rpc.bind(client)` 같은 호출을 놓쳤다(2026-10-06 Codex 리뷰: scriptquiz 퀴즈 · 채점).
// 파일 client 판정: 서비스 키/createAdminClient 만 쓰면 service, 아니면 사용자 세션(보수적으로 사용자 쪽으로 센다).
// 예외는 manifest 항목에 service_caller_ok: '근거'(그 파일이 실제로는 서비스 client 로 부른다)를 적는다.
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/check-revoked-callers.mjs   (DB 는 읽기만 — 없으면 전부 본다)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const man = JSON.parse(fs.readFileSync('scripts/db/function-exec-manifest.json', 'utf8')).functions
const closed = new Map()
for (const [sig, m] of Object.entries(man)) if (['SERVICE_ONLY', 'TRIGGER_ONLY', 'OWNER_ONLY'].includes(m.class) && !m.service_caller_ok) closed.set(sig.split('(')[0], sig)
// 지금 authenticated 가 실행하지 못하는 함수는 G2 로 깨질 수 없다 — DB 가 있으면 「회수로 새로 닫히는 것」만 본다
if (process.env.SUPABASE_DB_URL) {
  const pg = createRequire(path.resolve('scripts/csat/error-evidence/isolated-pg/package.json'))('pg')
  const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
  await c.connect(); await c.query('begin read only')
  const { rows } = await c.query(`select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and not has_function_privilege('authenticated', p.oid, 'execute')`)
  await c.query('rollback'); await c.end()
  for (const { sig } of rows) closed.delete(sig.split('(')[0])
}
const open = new Set(Object.entries(man).filter(([, m]) => !['SERVICE_ONLY', 'TRIGGER_ONLY', 'OWNER_ONLY'].includes(m.class)).map(([s]) => s.split('(')[0]))

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!['__tests__', 'node_modules', '.next'].includes(e.name)) walk(p, acc) }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p)
  }
  return acc
}
const fails = []
for (const f of walk(path.resolve('apps/web/src'))) {
  // 주석은 빼고 본다(설명 속 이름은 호출이 아니다)
  const s = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const service = /createAdminClient|SERVICE_ROLE_KEY|serviceKey|createTopicCorpusClient/.test(s) && !/lib\/supabase\/(server|client)['"]|^['"]use client['"]/m.test(s)
  if (service) continue
  for (const m of s.matchAll(/['"`]([a-z_][a-z0-9_]{3,})['"`]/g)) {
    const n = m[1]
    if (closed.has(n) && !open.has(n)) fails.push({ fn: closed.get(n), file: path.relative('.', f).replace(/\\/g, '/') })
  }
}
const uniq = [...new Map(fails.map((x) => [`${x.fn}|${x.file}`, x])).values()]
if (uniq.length) {
  for (const x of uniq) console.log(`FAIL ${x.fn} ← ${x.file}`)
  console.log(`\n사용자 세션/브라우저 파일에 이름이 나오는 닫힌 함수 ${uniq.length}건 — 실제 호출이면 class 를 올리고, 서비스 client 경로면 service_caller_ok 근거를 적는다`)
  process.exitCode = 1
} else console.log('통과 — 닫힌(SERVICE/TRIGGER/OWNER) 함수 이름이 사용자 세션 · 브라우저 파일에 없다')
