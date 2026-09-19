// scripts/design/seed-empty-account.mjs
//
// 「단어 0개」 검증 계정을 만든다(없으면 생성 · 있으면 재사용) → 로그인 세션을 저장한다.
// 목적: 빈 상태 삽화(이미지 체계 Gate 6 · DD-38)를 **실제 경로**로 캡처하려고. 검증 계정(lexicon-test)은 단어가 있어 빈 상태가 안 나온다.
// 실행: node --tls-max-v1.2 scripts/design/seed-empty-account.mjs [--base http://localhost:3000]
//
// ⚠️ 비밀값:
//   - 서비스 키는 apps/web/.env.local 에서 읽기만 하고 출력하지 않는다.
//   - 비밀번호는 **매 실행 무작위로 새로 정해** 메모리에만 두고, 그 자리에서 브라우저 로그인에 쓴다. 파일에 적지 않는다.
//   - 저장하는 것은 세션(storageState)뿐 — apps/web/playwright-auth/.auth-design-empty.json (gitignore).
// 빈 계정 보증: 로그인 전에 이 사용자 소유 행을 센다(vocabularies · texts). 0 이 아니면 **지우지 않고** 멈춘다(데이터 손실 금지).
//   count 가 null(테이블·열 없음)이면 0 으로 삼키지 않고 오류로 멈춘다(AGENTS.md 「하지 말 것」).

import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const req = createRequire(join(ROOT, 'apps/web/package.json'))
const { createClient } = req('@supabase/supabase-js')
const { chromium } = req('@playwright/test')

const EMAIL = 'design-empty@vocaflow.local'
const STATE = join(ROOT, 'apps/web/playwright-auth/.auth-design-empty.json')
const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3000'

const env = Object.fromEntries(
  readFileSync(join(ROOT, 'apps/web/.env.local'), 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
)
const url = env.NEXT_PUBLIC_SUPABASE_URL, service = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !service) { console.error('apps/web/.env.local 에 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 필요하다'); process.exit(2) }
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

// 1) 사용자 — 있으면 재사용, 없으면 생성(이메일 확인 완료 상태)
const password = randomBytes(18).toString('base64url')
let user = null
for (let page = 1; page < 50 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  user = data.users.find((u) => u.email === EMAIL) ?? null
  if (data.users.length < 200) break
}
if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password })
  if (error) throw error
  console.log('계정 재사용:', EMAIL)
} else {
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password, email_confirm: true, user_metadata: { purpose: 'design-empty-state' } })
  if (error) throw error
  user = data.user
  console.log('계정 생성:', EMAIL)
}

// 2) 빈 계정 보증
for (const table of ['vocabularies', 'texts']) {
  const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', user.id)
  if (error || count === null) { console.error(`${table} 을 셀 수 없다 — ${error?.message ?? 'count=null'}`); process.exit(1) }
  console.log(`${table}: ${count}`)
  if (count !== 0) { console.error(`${table} 가 0 이 아니다 — 지우지 않고 멈춘다`); process.exit(1) }
}

// 3) 실제 로그인 화면으로 로그인 → 세션 저장
const b = await chromium.launch()
const ctx = await b.newContext()
const p = await ctx.newPage()
await p.goto(`${base}/login`, { waitUntil: 'networkidle' })
await p.locator('input[type="email"]').fill(EMAIL)
await p.locator('input[type="password"]').fill(password)
await p.locator('form button[type="submit"]').first().click()
await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
console.log('로그인 후 도착:', new URL(p.url()).pathname)
await ctx.storageState({ path: STATE })
await b.close()
console.log('세션 저장:', STATE.replace(ROOT, '.').replace(/\\/g, '/'))
