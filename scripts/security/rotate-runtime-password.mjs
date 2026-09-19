// scripts/security/rotate-runtime-password.mjs
//
// 검증 계정(runtime-test-0705@vocaflow.dev) 비밀번호 교체 — 2026-09-19 평문 노출 대응(design/DECISIONS DD-48).
//
// 실행:
//   node --tls-max-v1.2 scripts/security/rotate-runtime-password.mjs            ← 새 값 생성 → Supabase 에 적용 → apps/web/.env.local 에 기록
//   node scripts/security/rotate-runtime-password.mjs --emit | gh secret set PLAYWRIGHT_RUNTIME_PASSWORD
//                                                                                 ← .env.local 의 현재 값을 **파이프로만** 넘긴다(CI 저장소 시크릿)
//
// ⚠️ 비밀값 규칙(AGENTS.md): 값은 화면·로그·커밋에 절대 나오지 않는다. 쓰는 곳은 apps/web/.env.local 한 곳(gitignore).
//    --emit 은 표준출력이 터미널이면 거부한다 — 파이프일 때만 값을 내보낸다.
//    코드·테스트는 process.env.PLAYWRIGHT_RUNTIME_PASSWORD 만 읽는다(옛 값 대체 문자열은 2026-09-19 전부 제거).

import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENV_FILE = join(ROOT, 'apps/web/.env.local')
const KEY = 'PLAYWRIGHT_RUNTIME_PASSWORD'
const EMAIL = 'runtime-test-0705@vocaflow.dev'

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
if (!user) { console.error('검증 계정을 찾지 못했다'); process.exit(1) }

const next = randomBytes(24).toString('base64url') // 32자 · 영숫자+-_
const { error } = await admin.auth.admin.updateUserById(user.id, { password: next })
if (error) throw error

const line = `${KEY}=${next}`
const nl = raw.includes('\r\n') ? '\r\n' : '\n'
const has = new RegExp(`^${KEY}=.*$`, 'm')
const out = has.test(raw) ? raw.replace(has, line) : raw.replace(/\s*$/, '') + nl + line + nl
writeFileSync(ENV_FILE, out)
console.log(`교체 완료 — Supabase 적용 · ${KEY} 를 apps/web/.env.local 에 기록(값 출력 안 함, 길이 ${next.length})`)
