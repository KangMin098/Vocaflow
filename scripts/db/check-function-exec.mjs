// scripts/db/check-function-exec.mjs
//
// **public 함수 EXECUTE 정책 가드 — 기본 거부.** 정본은 scripts/db/function-exec-manifest.json(함수마다 class).
// 2026-10-05 감사(docs/reports/function-execute-audit-2026-10-05.md)의 원인 4번 — 옛 가드가 「현재 상태」를 기준선으로
// 굳혀 결함 84개를 정상으로 통과시켰다 — 을 되풀이하지 않도록 **기준선 자동 갱신(--update)은 두지 않는다.** class 는 사람이 고친다.
//
// FAIL 조건:
//   ① manifest 에 없는 public 함수(새 함수는 분류를 적어야 통과) · manifest 에만 있는 낡은 항목
//   ② class 별 기대 권한과 실제 has_function_privilege 불일치(PUBLIC 직접 GRANT 포함)
//   ③ ADMIN_RPC 인데 본문에 관리자 검사 없음 · AUTH_SELF_RPC 인데 auth.uid() 없음 · REVIEWER_RPC 인데 배정/관리자 검사 없음
//      (SECURITY INVOKER + RLS 는 관리자 인가로 치지 않는다)
//   ④ AUTH_READ_RPC 가 사용자 id 인자를 받음(그러면 AUTH_SELF 여야 한다)
// 한계(알고 쓰는 것): ③ 은 본문에 검사 호출이 「있는지」를 본다 — 그 검사가 올바른 인자와 비교하는지는 격리 매트릭스 테스트가 본다.
//
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/check-function-exec.mjs [--json out.json]
// 재실행 안전: 읽기 전용 트랜잭션. DB 를 고치지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(path.resolve('scripts/csat/error-evidence/isolated-pg/package.json'))
const pg = require('pg')

const MANIFEST = path.resolve('scripts/db/function-exec-manifest.json')
const outIdx = process.argv.indexOf('--json')
const man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
const CLASSES = {
  PUBLIC_RPC: { anon: true, authenticated: true },
  AUTH_READ_RPC: { anon: false, authenticated: true },
  AUTH_SELF_RPC: { anon: false, authenticated: true },
  REVIEWER_RPC: { anon: false, authenticated: true },
  ADMIN_RPC: { anon: false, authenticated: true },
  SERVICE_ONLY: { anon: false, authenticated: false },
  TRIGGER_ONLY: { anon: false, authenticated: false },
  OWNER_ONLY: { anon: false, authenticated: false },   // 소유자 함수 내부 보조 — service_role 도 필요 없다
}
// 관리자 검사: 헬퍼 호출 또는 user_profiles.role = 'admin' 류 비교
const ADMIN_CHECK = /\b(is_admin|is_admin_or_curator|video_is_admin|_assert_admin_or_service|csat_ec_private\.\w*admin\w*)\s*\(|role\b[^;]{0,120}'admin'/i
const UID_CHECK = /\bauth\.uid\s*\(\s*\)|\b_assert_self_or_service\s*\(/i
const REVIEWER_CHECK = /(csat_ec_review_assignment|reviewer|\bis_admin\s*\()/i

/** 주어진 연결(트랜잭션 안이어도 된다)에서 검사한다 — 마이그레이션 드라이런이 같은 트랜잭션에서 부른다 */
export async function checkFunctionExec(c, man) {
const { rows } = await c.query(`
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig, p.prosrc src, p.prosecdef sd,
    p.prorettype = 'trigger'::regtype trig, pg_get_function_identity_arguments(p.oid) args,
    has_function_privilege('anon', p.oid, 'execute') anon,
    has_function_privilege('authenticated', p.oid, 'execute') au,
    has_function_privilege('service_role', p.oid, 'execute') svc,
    (p.proacl is null or exists(select 1 from aclexplode(p.proacl) x where x.grantee = 0 and x.privilege_type = 'EXECUTE')) pub
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
    and not exists(select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`)

const fails = []
const live = new Set()
const srcBySig = Object.fromEntries(rows.map((r) => [r.sig, r.src]))
for (const f of rows) {
  live.add(f.sig)
  const m = man.functions[f.sig]
  if (!m) { fails.push({ sig: f.sig, rule: '①', why: '미분류 — manifest 에 class 를 적어야 한다' }); continue }
  const exp = CLASSES[m.class]
  if (!exp) { fails.push({ sig: f.sig, rule: '①', why: `모르는 class ${m.class}` }); continue }
  if (f.pub && m.class !== 'PUBLIC_RPC') fails.push({ sig: f.sig, rule: '②', why: 'PUBLIC EXECUTE 가 남아 있다' })
  if (f.anon !== exp.anon) fails.push({ sig: f.sig, rule: '②', why: `anon ${f.anon} ≠ 기대 ${exp.anon}` })
  if (f.au !== exp.authenticated) fails.push({ sig: f.sig, rule: '②', why: `authenticated ${f.au} ≠ 기대 ${exp.authenticated}` })
  // service_role 은 SERVICE_ONLY 에서만 요구한다 — 학습자 · 검수자 RPC 는 auth.uid() 로 도는 설계라 service GRANT 가 없을 수 있다(csat_ec_*)
  if (!f.svc && m.class === 'SERVICE_ONLY') fails.push({ sig: f.sig, rule: '②', why: 'service_role EXECUTE 없음' })
  // delegates_to: 본문이 검사를 가진 다른 overload 를 부른다(예: csat_ec_round_create 5인자 → 4인자) — 대상이 검사를 가져야 통과
  const src = m.delegates_to ? (srcBySig[m.delegates_to] ?? '') : f.src
  if (m.delegates_to && !f.src.includes(m.delegates_to.split('(')[0] + '(')) fails.push({ sig: f.sig, rule: '③', why: `delegates_to ${m.delegates_to} 호출이 본문에 없다` })
  if (m.class === 'ADMIN_RPC' && !ADMIN_CHECK.test(src)) fails.push({ sig: f.sig, rule: '③', why: '관리자 검사 없음' })
  if (m.class === 'AUTH_SELF_RPC' && !UID_CHECK.test(src)) fails.push({ sig: f.sig, rule: '③', why: 'auth.uid() 본인 검사 없음' })
  if (m.class === 'REVIEWER_RPC' && !REVIEWER_CHECK.test(src)) fails.push({ sig: f.sig, rule: '③', why: '검수자 배정 검사 없음' })
  if (m.class === 'AUTH_READ_RPC' && /\bp_user_id\b|\bp_uid\b/.test(f.args)) fails.push({ sig: f.sig, rule: '④', why: '사용자 id 인자 — AUTH_SELF 여야 한다' })
  if (m.class === 'TRIGGER_ONLY' && !f.trig) fails.push({ sig: f.sig, rule: '①', why: 'TRIGGER_ONLY 인데 트리거 함수가 아니다' })
}
for (const sig of Object.keys(man.functions)) if (!live.has(sig)) fails.push({ sig, rule: '①', why: '낡은 항목 — DB 에 없다' })

return { checked: rows.length, fails }
}

if (process.argv[1]?.endsWith('check-function-exec.mjs')) {   // 직접 실행일 때만(드라이런은 import 해서 함수만 쓴다)
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect(); await c.query('begin read only')
const { checked, fails } = await checkFunctionExec(c, man)
await c.query('rollback'); await c.end()
const rows = { length: checked }
const by = {}; for (const f of fails) by[f.rule] = (by[f.rule] || 0) + 1
if (outIdx > 0) fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify({ checked: rows.length, fails }, null, 1))
if (fails.length) {
  for (const f of fails.slice(0, 60)) console.log(`FAIL ${f.rule} ${f.sig} — ${f.why}`)
  if (fails.length > 60) console.log(`… 외 ${fails.length - 60}건`)
  console.log(`\n실패 ${fails.length}건 (${Object.entries(by).map(([k, v]) => `${k} ${v}`).join(' · ')}) / 함수 ${rows.length}`)
  process.exitCode = 1
} else console.log(`통과 — public 함수 ${rows.length}개 전부 분류 · 권한 · 본문 검사 일치`)
}
