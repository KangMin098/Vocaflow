// scripts/security/rotate-runtime-password.mjs
//
// 검증 계정 비밀번호 교체 — 2026-09-19 평문 노출 대응(design/DECISIONS DD-48).
// 대상 2개: `runtime`(runtime-test-0705@vocaflow.dev · e2e·통합 테스트) · `lexicon`(lexicon-test@vocaflow.local · 단어 8개 시드 계정).
//
// 실행:
//   node --tls-max-v1.2 scripts/security/rotate-runtime-password.mjs [--account runtime|lexicon]
//                                                                                 ← 새 값 생성 → Supabase 적용 → apps/web/.env.local 기록 → 옛 값·새 값 로그인 확인
//   node scripts/security/rotate-runtime-password.mjs --emit [--account …] | gh secret set PLAYWRIGHT_RUNTIME_PASSWORD
//                                                                                 ← .env.local 의 현재 값을 **파이프로만** 넘긴다(CI 저장소 시크릿)
//
// ⚠️ 비밀값 규칙(AGENTS.md): 값은 화면·로그·커밋에 절대 나오지 않는다. 쓰는 곳은 apps/web/.env.local 한 곳(gitignore).
//    --emit 은 표준출력이 터미널이면 거부한다 — 파이프일 때만 값을 내보낸다.
//    코드·테스트는 env 변수만 읽는다(옛 값 대체 문자열은 2026-09-19 전부 제거).
//    교체 뒤 로그인 확인은 성공·실패만 찍는다 — 옛 값이 실패해야 교체가 실제로 끝난 것이다.

import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENV_FILE = join(ROOT, 'apps/web/.env.local')

const ACCOUNTS = {
  runtime: { key: 'PLAYWRIGHT_RUNTIME_PASSWORD', email: 'runtime-test-0705@vocaflow.dev' },
  lexicon: { key: 'PLAYWRIGHT_TEST_PASSWORD', email: 'lexicon-test@vocaflow.local' },
}
const which = process.argv.includes('--account') ? process.argv[process.argv.indexOf('--account') + 1] : 'runtime'
if (!ACCOUNTS[which]) { console.error(`--account 는 ${Object.keys(ACCOUNTS).join(' | ')} 중 하나다`); process.exit(2) }
const { key: KEY, email: EMAIL } = ACCOUNTS[which]

const raw = readFileSync(ENV_FILE, 'utf8')
const env = Object.fromEntries(raw.split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]))

if (process.argv.includes('--emit')) {
  if (process.stdout.isTTY) { console.error('--emit 은 파이프로만 쓴다(값을 화면에 찍지 않는다)'); process.exit(2) }
  if (!env[KEY]) { console.error(`${KEY} 가 .env.local 에 없다`); process.exit(1) }
  process.stdout.write(env[KEY])
  process.exit(0)
}

const { createClient } = createRequire(join(ROOT, 'apps/web/package.json'))('@supabase/supabase-js')
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let user = null
for (let page = 1; page < 50 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  user = data.users.find((u) => u.email === EMAIL) ?? null
  if (data.users.length < 200) break
}
if (!user) { console.error(`검증 계정(${EMAIL})을 찾지 못했다`); process.exit(1) }

const prev = env[KEY] ?? null // 교체 뒤 "옛 값은 더 이상 안 통한다" 를 확인하는 데만 쓴다(메모리 밖으로 안 나간다)
const next = randomBytes(24).toString('base64url') // 32자 · 영숫자+-_
const { error } = await admin.auth.admin.updateUserById(user.id, { password: next })
if (error) throw error

const line = `${KEY}=${next}`
const nl = raw.includes('\r\n') ? '\r\n' : '\n'
const has = new RegExp(`^${KEY}=.*$`, 'm')
const out = has.test(raw) ? raw.replace(has, line) : raw.replace(/\s*$/, '') + nl + line + nl
writeFileSync(ENV_FILE, out)
console.log(`교체 완료 — ${which}(${EMAIL}) · ${KEY} 를 apps/web/.env.local 에 기록(값 출력 안 함, 길이 ${next.length})`)

// 로그인 확인 — 익명 키로 실제 signInWithPassword. 성공·실패만 찍는다.
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!anonKey) { console.error('익명 키가 없어 로그인 확인을 건너뜀 — 수동 확인 필요'); process.exit(1) }
const signIn = async (password) => {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error: e } = await c.auth.signInWithPassword({ email: EMAIL, password })
  if (data?.session) await c.auth.signOut()
  return { ok: Boolean(data?.session), reason: e?.message ?? null }
}
const newLogin = await signIn(next)
console.log(`새 값 로그인: ${newLogin.ok ? '성공' : `실패 — ${newLogin.reason}`}`)
if (prev && prev !== next) {
  const oldLogin = await signIn(prev)
  console.log(`옛 값 로그인: ${oldLogin.ok ? '성공 — 교체가 안 먹었다' : '실패(정상)'}`)
  if (oldLogin.ok) process.exit(1)
}
if (!newLogin.ok) process.exit(1)
