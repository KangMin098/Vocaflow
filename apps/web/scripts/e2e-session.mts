// apps/web/scripts/e2e-session.mts
//
// **브라우저 로그인이 막힌 환경에서 e2e 세션을 만든다 — Node 로 받아 쿠키로 주입한다.**
//
// ── 왜 필요한가 (실측 2026-09-15) ─────────────────────────────────────
// 이 머신은 Supabase 로 가는 길이 **경로마다 다르게** 막힌다. 같은 시각에:
//
// ```
// node  supabase-js  signInWithPassword   → 성공 (access_token 1,168자)
// node  fetch GET    /auth/v1/health      → 401 (정상)
// 브라우저 로그인 폼                        → "로그인 중..." 에서 멈춤 (25s 타임아웃)
// ```
//
// 로그인 폼은 **브라우저에서 Supabase 로 직접** 간다. 그 경로만 막히므로, e2e 는 여덟 사이클
// 동안 `beforeAll` 에서 죽었다 — **화면 코드는 멀쩡한데 검증을 못 했다.**
//
// 그래서 세션을 **Node 에서** 받아 Playwright 의 storageState 로 굽는다. 브라우저는 그 쿠키를
// 들고 시작하므로 로그인 폼을 거치지 않는다. 화면이 서버에 보내는 요청은 dev 서버(node)를
// 거치므로 그쪽은 살아 있다.
//
// ⚠️ **이것은 진단 우회이지 계약이 아니다.** 로그인 화면 자체의 회귀(`20-auth-flows`)는
//    이 길로 검증하면 안 된다 — 그건 로그인 폼이 도는지를 묻는 검사다.
//
// ⚠️ `playwright-auth/` 에 쓴다. `test-results/` 에 두면 **다른 실행이 시작할 때 지운다**
//    (이 저장소가 겪은 사고 — apps/web/CLAUDE.md 참조).
//
//   npx tsx scripts/e2e-session.mts .auth-csat-item-map.json

import fs from 'node:fs'
import path from 'node:path'

for (const f of ['.env.local', '../../.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const OUT = process.argv[2] ?? '.auth-e2e.json'
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL_ || !ANON) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없다')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(URL_, ANON, { auth: { persistSession: false } })
const { data, error } = await db.auth.signInWithPassword({
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
})
if (error || !data.session) {
  console.error('로그인 실패:', error?.message ?? '세션이 없다')
  process.exit(1)
}

const ref = new URL(URL_).host.split('.')[0]
const name = `sb-${ref}-auth-token`

/**
 * `@supabase/ssr` 이 읽는 모양: `base64-` + base64(JSON). 4KB 근처에서 브라우저가 쿠키를
 * 버리므로 3,180자씩 `.0` `.1` 로 쪼갠다(그 라이브러리가 쓰는 값과 같아야 읽힌다).
 */
const raw = 'base64-' + Buffer.from(JSON.stringify(data.session), 'utf8').toString('base64')
const CHUNK = 3180
const cookies: { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: 'Lax' }[] = []
const common = {
  domain: 'localhost',
  path: '/',
  expires: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  httpOnly: false,
  secure: false,
  sameSite: 'Lax' as const,
}
if (raw.length <= CHUNK) {
  cookies.push({ name, value: raw, ...common })
} else {
  for (let i = 0, k = 0; i < raw.length; i += CHUNK, k += 1) {
    cookies.push({ name: `${name}.${k}`, value: raw.slice(i, i + CHUNK), ...common })
  }
}

const dir = path.resolve('playwright-auth')
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, OUT)
fs.writeFileSync(file, JSON.stringify({ cookies, origins: [] }, null, 2))
console.log(`세션 구움: ${path.relative(process.cwd(), file)} · 쿠키 ${cookies.length}개 · user ${data.user?.id?.slice(0, 8)}`)

// ⚠️ 즉시 exit 하지 않는다 — supabase-js 의 열린 핸들이 닫히는 중이면 Windows 에서 libuv 가
//    터져 성공한 작업이 종료코드 1 로 보고된다(이 저장소의 다른 스크립트에도 같은 주석).
await new Promise((r) => setTimeout(r, 150))
process.exit(0)
